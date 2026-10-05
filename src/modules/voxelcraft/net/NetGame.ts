// Сетевая игра VoxelCraft: связывает игру (Game) с `RealtimeSession` (@idosgames/core/realtime).
// Комнату создаёт и в неё входит ЛОББИ (система мультиплеера, ctx.multiplayer) — сюда приходит уже
// открытая сессия (`NetGame.fromRoom`); своего списка комнат, создания и входа по коду у игры нет.
//
// Топология — звезда (комнаты `Host`): каждый гость связан только с хостом, хост пересылает. Роли и
// протокол — net/protocol.ts. Кто считает мир — net/sim.ts: у каждого «живого» измерения один
// владелец (первый вошедший; хост не главнее других), остальные в нём — реплики.
//
// Игрок и инвентарь — у каждого свои (вариант А, 27.09.2026): здесь по сети ходят только мир,
// сущности, блочные сущности и то, что мир делает с игроком (урон, отброс, подобранное).
import * as THREE from "three";
import type { RealtimeSession as Session } from "@idosgames/core/realtime";
import { events } from "../core/EventBus";
import { rules } from "../systems/Difficulty";
import type { NetEntityAction } from "../entities/EntityManager";
import { BLOCKS } from "../registry/Blocks";
import { ITEMS } from "../registry/Items";
import type { DimensionId } from "../world/Dimensions";
import type { DimensionSave, ItemStack } from "../types";
import type { Game } from "../main";
import { sim } from "./sim";
import { DiffStore } from "./DiffStore";
import { OwnerBroadcast } from "./OwnerBroadcast";
import {
  Avatar,
  RemotePlayer,
  remoteInventory,
  type RemoteSink,
} from "./RemotePlayer";
import { decodeJson, encodeJson, encodeJsonSync } from "./codec";
import {
  DIMS,
  M,
  POSE_CREATIVE,
  POSE_DEAD,
  POSE_FLY,
  POSE_GLIDE,
  POSE_SNEAK,
  POSE_SWIM,
  POSE_SWING,
  PROTOCOL,
  buildHash,
  decodeBlocks,
  decodeEntPoses,
  decodeEntRemove,
  decodePose,
  encodeBlocks,
  encodeEntPoses,
  encodeEntRemove,
  encodePose,
  withPoseSlot,
  type BeMsg,
  type BlockDelta,
  type DimEnter,
  type DimOwn,
  type EntActionMsg,
  type EntSpawnMsg,
  type Give,
  type Hello,
  type Hit,
  type LockMsg,
  type PlayerMeta,
  type PortalMsg,
  type ReplyMsg,
  type Pose,
  type Roster,
  type RoomSettings,
  type Shadow,
  type Welcome,
  type WorldState,
} from "./protocol";

/**
 * Комната, которую отдаёт лобби (`MultiplayerRoom` контракта модулей — здесь только нужные поля, чтобы
 * сетевой код игры не зависел от контракта).
 */
export interface NetRoom {
  readonly session: Session;
  readonly isHost: boolean;
  readonly lateJoin: boolean;
  readonly settings: Readonly<Record<string, string | boolean>>;
  leave(): Promise<void>;
}

/** Настройки комнаты, как их объявляет модуль (`registerGame.settings`): режим гостей и команды. */
export function roomSettingsOf(
  settings: Readonly<Record<string, string | boolean>>,
): RoomSettings {
  return {
    guestMode: settings.guestMode === "creative" ? "creative" : "survival",
    cheatsForAll: settings.cheats === true,
  };
}

/** Всё, что знаем о другом игроке. */
interface Peer {
  slot: number;
  userId: string;
  name: string;
  dim: DimensionId;
  op: boolean;
  pose: Pose | null;
  held: string | null;
  mode: "survival" | "creative";
  sleeping: boolean;
  avatar: Avatar | null;
  remote: RemotePlayer | null;
}

/** Хост: сейв игрока (его инвентарь авторитетен у него — здесь копия для мира хоста). */
interface HostRecord {
  slot: number;
  name: string;
  dim: DimensionId;
  op: boolean;
  state: unknown | null;
}

const BUILD = buildHash(
  BLOCKS.map((b) => b.name),
  Object.keys(ITEMS),
);

const EMPTY_DIM = (): DimensionSave => ({
  chunks: {},
  entities: [],
  blockEntities: [],
});

export class NetGame implements RemoteSink {
  readonly session: Session;
  readonly selfId: string;
  slot = 0;
  settings: RoomSettings;
  /** Операторы (хост — всегда). */
  readonly ops = new Set<string>();
  readonly diffs = new DiffStore();
  /** Другие игроки по слоту. */
  readonly peers = new Map<number, Peer>();
  /** Владелец каждого живого измерения (userId). */
  readonly owners = new Map<DimensionId, string>();
  /** Хост ушёл — кто подхватит (объявляет хост в списке игроков). */
  successor: string | null = null;

  // ---- только у хоста
  private readonly records = new Map<string, HostRecord>();
  private nextSlot = 1;
  /** Измерения без владельца: сущности и блочные сущности (дифы — в `diffs`). */
  private readonly frozen = new Map<DimensionId, DimensionSave>();
  /** Блочные сущности всех измерений (для вошедшего в измерение гостя). */
  private readonly beStore = new Map<DimensionId, Map<string, BeMsg["be"]>>();

  // ---- владелец/реплика своего измерения
  private readonly bc = new OwnerBroadcast();
  /** Реплика: что последнее прислал владелец по блочным сущностям — своё отличие уходит ему. */
  private readonly replicaBe = new OwnerBroadcast();
  private pending: BlockDelta[] = [];
  private applyingRemote = false;
  private tickN = 0;
  private lastMeta = "";
  private shadow: Shadow | null = null;
  private hostSilentSince = 0;
  private readonly offs: (() => void)[] = [];
  private closed = false;
  /** Гость: ждём снимок мира. */
  private welcomeWait: ((w: Welcome | string) => void) | null = null;
  /** Очередь обработки надёжного канала (см. конструктор). */
  private inbox: Promise<void> = Promise.resolve();
  /** Гость получил снимок мира (хост — всегда). До него сообщения копятся в `stash`. */
  private welcomed = true;
  private readonly stash: [string, Uint8Array][] = [];
  /** Владелец измерения: занятые контейнеры — ключ (LockMsg.key) → слот игрока. */
  private readonly locks = new Map<string, number>();
  /** Свои запросы контейнера, ждущие ответа владельца. */
  private readonly lockWait = new Map<
    string,
    { open: () => void; dim: DimensionId; timer: ReturnType<typeof setTimeout> }
  >();
  /** Реплика: id сущности, в которой сидит свой игрок (её ведёт он). */
  private driving: number | null = null;

  private constructor(
    readonly game: Game,
    session: Session,
    selfId: string,
    settings: RoomSettings,
    readonly name: string,
    /** Уйти из комнаты — через лобби: оно владеет комнатой и забывает её вместе с сессией. */
    readonly leaveRoom: () => Promise<void>,
  ) {
    this.session = session;
    this.selfId = selfId;
    this.settings = settings;
    this.offs.push(
      session.on("message", ({ from, channel, data }) => {
        // Надёжный канал — строго по порядку: сжатое сообщение распаковывается асинхронно, и без
        // очереди следующее («удалить сущность») обогнало бы предыдущее («создать»). Быстрый канал
        // (позы) порядка не требует и ждать не должен.
        if (channel === "fast") void this.onMessage(from, channel, data);
        else
          this.inbox = this.inbox.then(() =>
            this.onMessage(from, channel, data),
          );
      }),
      session.on("peerOpen", ({ peerId }) => this.onPeerOpen(peerId)),
      session.on("peerClose", ({ peerId }) => this.onPeerClose(peerId)),
      session.on("memberLeft", ({ userId }) => this.onMemberLeft(userId)),
      session.on("hostChanged", ({ hostId, previousHostId }) =>
        this.onHostChanged(hostId, previousHostId),
      ),
      session.on("chat", ({ text }) => game.chat.print(text)),
      // исключили: сервер отвечает «не участник» (после уведомления хоста) или прислал PlayerLeft kicked
      session.on("removed", ({ reason }) =>
        this.end(
          /kicked|not a member|removed/i.test(reason)
            ? "Вас исключили из игры"
            : "Связь с игрой потеряна",
        ),
      ),
      session.on("roomClosed", () => this.end("Игра закрыта")),
    );
    // Реестр порталов общий: зажёг портал любой — знают все (выход на той стороне ищется по нему).
    game.onPortalChange = (dim, pos, add) => {
      const msg = encodeJsonSync(M.PORTAL, {
        dim,
        p: pos,
        add,
      } satisfies PortalMsg);
      if (this.isHost) this.toAll("rel", msg);
      else this.toHost("rel", msg);
    };
    // Правки мира: владелец рассылает все (свои, каскады, пришедшие от реплик), реплика — только свои.
    this.offs.push(
      events.on(
        "blockChanged",
        (d: { x: number; y: number; z: number; id: number; meta: number }) => {
          if (this.applyingRemote && !sim.authority) return;
          this.diffs.apply(this.game.dimension, d.x, d.y, d.z, d.id, d.meta);
          this.pending.push({ x: d.x, y: d.y, z: d.z, id: d.id, meta: d.meta });
        },
      ),
    );
  }

  get isHost(): boolean {
    return this.session.hostId === this.selfId;
  }

  get hostId(): string {
    return this.session.hostId;
  }

  /** Может ли этот игрок командами менять мир (хост и операторы, или «команды всем»). */
  get canCheat(): boolean {
    return (
      this.isHost || this.ops.has(this.selfId) || this.settings.cheatsForAll
    );
  }

  // =========================================================================== старт

  /**
   * Комната пришла из лобби (система мультиплеера, `ctx.multiplayer`): её создали и в неё вошли там,
   * соединения уже открыты — здесь только начинается игра поверх готовой сессии. Хост, запустивший
   * игру, открывает свой мир для остальных; гость (и опоздавший) получает мир хоста.
   */
  static async fromRoom(
    game: Game,
    room: NetRoom,
    fallbackName: string,
  ): Promise<NetGame | string> {
    const session = room.session;
    // имя — публичный профиль игрока в этом тайтле (его кладёт в снимок комнаты сервер)
    const name = session.members.get(session.selfId)?.Username || fallbackName;
    if (room.isHost && !room.lateJoin) {
      const net = new NetGame(
        game,
        session,
        session.selfId,
        roomSettingsOf(room.settings),
        name,
        room.leave,
      );
      net.ops.add(net.selfId);
      net.startAsHost();
      return net;
    }
    const net = new NetGame(
      game,
      session,
      session.selfId,
      { guestMode: "survival", cheatsForAll: false },
      name,
      room.leave,
    );
    net.welcomed = false;
    const w = await new Promise<Welcome | string>((resolve) => {
      net.welcomeWait = resolve;
      setTimeout(() => resolve("Хост не ответил"), 30_000);
      if (session.isOpen(session.hostId)) net.sendHello();
    });
    net.welcomeWait = null;
    if (typeof w === "string") {
      net.dispose();
      await room.leave();
      return w;
    }
    net.applyWelcome(w);
    return net;
  }

  private startAsHost(): void {
    const g = this.game;
    this.slot = 0;
    this.records.set(this.selfId, {
      slot: 0,
      name: this.name,
      dim: g.dimension,
      op: true,
      state: null,
    });
    // Мир хоста целиком в хранилище дифов: живое измерение — с мира, остальные — из сейва измерений.
    this.diffs.load(g.dimension, g.world.serializeDiffs());
    for (const [d, save] of g.dims) {
      this.diffs.load(d, save.chunks);
      this.frozen.set(d, {
        chunks: {},
        entities: save.entities ?? [],
        blockEntities: save.blockEntities ?? [],
      });
    }
    this.owners.set(g.dimension, this.selfId);
    this.becomeOwner(null);
  }

  // =========================================================================== отправка

  private async send(
    to: string,
    channel: "rel" | "fast",
    data: Uint8Array,
  ): Promise<void> {
    if (to === this.selfId) {
      await this.onMessage(this.selfId, channel, data);
      return;
    }
    this.session.send(to, channel, data);
  }

  /** Хосту (у хоста — себе). */
  private toHost(channel: "rel" | "fast", data: Uint8Array): void {
    void this.send(this.hostId, channel, data);
  }

  /** Хост: всем, кроме `except`. */
  private toAll(
    channel: "rel" | "fast",
    data: Uint8Array,
    except?: string,
  ): void {
    this.session.broadcast(channel, data, except);
  }

  /** Хост: всем игрокам измерения, кроме `except` (себе — тоже, если хост там же). */
  private toDim(
    dim: DimensionId,
    channel: "rel" | "fast",
    data: Uint8Array,
    except?: string,
  ): void {
    for (const [uid, r] of this.records)
      if (r.dim === dim && uid !== except) void this.send(uid, channel, data);
  }

  private userOfSlot(slot: number): string | null {
    if (slot === this.slot) return this.selfId;
    return this.peers.get(slot)?.userId ?? null;
  }

  // =========================================================================== приём

  private async onMessage(
    from: string,
    channel: "rel" | "fast",
    data: Uint8Array,
  ): Promise<void> {
    if (this.closed || data.length === 0) return;
    const type = data[0]!;
    // Гость до снимка мира: всё, кроме самого снимка, — в отложенные. Правки хоста легли бы на ЕГО
    // одиночный мир (и ушли бы в «Мои миры»), а выбросить их — значит отстать от снимка навсегда.
    if (!this.welcomed && type !== M.WELCOME && type !== M.REJECT) {
      if (channel === "rel") this.stash.push([from, data]);
      return;
    }
    try {
      if (channel === "fast") return this.onFast(from, type, data);
      switch (type) {
        case M.HELLO:
          if (this.isHost) await this.onHello(from, data);
          return;
        case M.WELCOME: {
          const w = await decodeJson<Welcome>(data);
          if (w && this.welcomeWait) this.welcomeWait(w);
          return;
        }
        case M.REJECT: {
          const r = await decodeJson<{ reason: string }>(data);
          this.welcomeWait?.(r?.reason ?? "Хост отказал во входе");
          return;
        }
        case M.ROSTER: {
          const r = await decodeJson<Roster>(data);
          if (r && !this.isHost) this.applyRoster(r);
          return;
        }
        case M.PMETA:
          return this.onMeta(from, data);
        case M.BLOCKS:
        case M.EDITS:
          return this.onBlocks(from, type, data);
        case M.ENT_SPAWN:
        case M.ENT_REMOVE:
          return this.onEntities(from, type, data);
        case M.ENT_ACTION:
          return this.onEntAction(from, data);
        case M.BE:
          return this.onBe(from, data);
        case M.LOCK:
          return this.onLock(from, data);
        case M.REPLY:
          return this.onReply(from, data);
        case M.PORTAL:
          return this.onPortal(from, data);
        case M.BE_LIST: {
          const m = await decodeJson<{ dim: DimensionId; list: BeMsg[] }>(data);
          if (m && m.dim === this.game.dimension && !sim.authority)
            for (const b of m.list) this.applyBe(b);
          return;
        }
        case M.WORLD: {
          const w = await decodeJson<WorldState>(data);
          if (w && !this.isHost) {
            this.game.applyNetWorldState(w);
            // мирная сложность: враждебные исчезают и в измерении, которое считаю я
            if (sim.authority && !rules().hostiles)
              this.game.entities.clearHostiles();
          }
          return;
        }
        case M.CHAT:
          return this.onChat(from, data);
        case M.HIT:
        case M.GIVE:
          return this.onToPlayer(from, type, data);
        case M.PSTATE: {
          const s = await decodeJson<{ state: unknown }>(data);
          const r = this.records.get(from);
          if (s && r && this.isHost) {
            r.state = s.state;
            this.game.mergeBeyond(
              (s.state as { beyond?: unknown } | null)?.beyond,
            );
          }
          return;
        }
        case M.DIM_ENTER:
          if (this.isHost) {
            const m = await decodeJson<DimEnter>(data);
            if (m) this.onDimEnter(from, m);
          }
          return;
        case M.DIM_OWN: {
          const m = await decodeJson<DimOwn>(data);
          if (m && m.dim === this.game.dimension) this.becomeOwner(m.save);
          return;
        }
        case M.DIM_RESYNC:
          if (sim.authority) this.bc.reset();
          return;
        case M.SHADOW:
          this.shadow = await decodeJson<Shadow>(data);
          return;
        case M.COMMAND: {
          const m = await decodeJson<{ text: string }>(data);
          if (m && this.isHost && this.mayCheat(from))
            this.game.commands.run(m.text);
          return;
        }
      }
    } catch (e) {
      console.warn("[net] bad message", type, e);
    }
  }

  private onFast(from: string, type: number, data: Uint8Array): void {
    if (type === M.POSE) {
      if (this.isHost && from !== this.selfId) {
        const r = this.records.get(from);
        if (!r) return;
        const stamped = withPoseSlot(data, r.slot);
        const pose = decodePose(stamped);
        if (r.dim !== pose.dim) r.dim = pose.dim;
        this.toAll("fast", stamped, from);
        this.applyPose(pose);
        return;
      }
      if (!this.isHost) this.applyPose(decodePose(data));
      return;
    }
    if (type === M.ENT_POSE) {
      const { dim } = decodeEntPoses(data);
      if (this.isHost && from !== this.selfId)
        this.toDim(dim, "fast", data, from);
      if (dim === this.game.dimension && !sim.authority && from !== this.selfId)
        for (const p of decodeEntPoses(data).list)
          this.game.entities.netApplyPose(
            p.id,
            p.x,
            p.y,
            p.z,
            p.yaw,
            p.flags,
            p.extra,
          );
    }
  }

  // ---- вход гостя (хост)

  private sendHello(): void {
    const hello: Hello = { v: PROTOCOL, build: BUILD, name: this.name };
    this.toHost("rel", encodeJsonSync(M.HELLO, hello));
  }

  private async onHello(from: string, data: Uint8Array): Promise<void> {
    const h = await decodeJson<Hello>(data);
    if (!h) return;
    if (h.v !== PROTOCOL || h.build !== BUILD) {
      await this.send(
        from,
        "rel",
        encodeJsonSync(M.REJECT, {
          reason: "Версии игры отличаются — обновите страницу",
        }),
      );
      return;
    }
    const g = this.game;
    let r = this.records.get(from);
    if (!r) {
      const saved = g.netPlayers.get(from) ?? null;
      const savedDim = (saved as { dim?: DimensionId } | null)?.dim;
      r = {
        slot: this.nextSlot++,
        name: (h.name || "Игрок").slice(0, 24),
        dim: savedDim && DIMS.includes(savedDim) ? savedDim : "overworld",
        op: this.ops.has(from),
        state: saved,
      };
      this.records.set(from, r);
    }
    const spawnPos = (r.state as { pos?: [number, number, number] } | null)
      ?.pos;
    const sp = g.player.spawnPoint;
    const welcome: Welcome = {
      v: PROTOCOL,
      you: r.slot,
      world: g.netWorldMeta(),
      diffs: this.diffs.all(),
      spawn: {
        dim: r.dim,
        pos:
          Array.isArray(spawnPos) && spawnPos.length === 3
            ? spawnPos
            : [sp.x, sp.y, sp.z],
      },
      state: r.state,
      roster: this.roster(),
    };
    await this.send(from, "rel", await encodeJson(M.WELCOME, welcome));
    this.broadcastRoster();
    this.enterDim(from, r.dim);
  }

  // ---- поза и метаданные

  private applyPose(p: Pose): void {
    if (p.slot === this.slot) return;
    const peer = this.peers.get(p.slot);
    if (!peer) return;
    // ушёл из измерения — то, что он вёл, снова считаю я
    if (peer.dim === this.game.dimension && p.dim !== peer.dim && sim.authority)
      this.game.entities.netReleaseDriver(peer.slot);
    peer.pose = p;
    peer.dim = p.dim;
    const here = p.dim === this.game.dimension;
    if (here) {
      if (!peer.avatar) {
        peer.avatar = new Avatar(peer.name);
        this.game.scene.add(peer.avatar.group);
      }
      peer.avatar.target(p);
      if (sim.authority) {
        if (!peer.remote)
          peer.remote = new RemotePlayer(
            this.game.world,
            p.slot,
            peer.userId,
            this,
          );
        peer.remote.world = this.game.world;
        peer.remote.held = peer.held;
        peer.remote.applyPose(p);
      }
    } else this.dropPeerView(peer);
  }

  private dropPeerView(peer: Peer): void {
    if (peer.avatar) {
      peer.avatar.dispose(this.game.scene);
      peer.avatar = null;
    }
    peer.remote = null;
  }

  private async onMeta(from: string, data: Uint8Array): Promise<void> {
    const m = await decodeJson<PlayerMeta>(data);
    if (!m) return;
    if (this.isHost && from !== this.selfId) {
      const r = this.records.get(from);
      if (!r) return;
      m.slot = r.slot;
      r.name = (m.name || r.name).slice(0, 24);
      this.toAll("rel", encodeJsonSync(M.PMETA, m), from);
      this.hostSleepCheck(from, m);
    }
    const peer = m.slot !== undefined ? this.peers.get(m.slot) : undefined;
    if (!peer) return;
    peer.held = m.held;
    peer.mode = m.mode;
    peer.sleeping = !!(m as { sleeping?: boolean }).sleeping;
    if (m.name && m.name !== peer.name) {
      peer.name = m.name;
      peer.avatar?.setName(m.name);
    }
  }

  // ---- блоки

  private onBlocks(from: string, type: number, data: Uint8Array): void {
    const { dim, list } = decodeBlocks(data);
    if (this.isHost && from !== this.selfId) {
      if (type === M.BLOCKS) {
        // от владельца измерения — всем; дифы хоста для передачи хоста и новых гостей
        if (this.owners.get(dim) !== from) return;
        this.diffs.applyAll(dim, list);
        this.toAll("rel", data, from);
      } else {
        const owner = this.owners.get(dim);
        if (!owner) return;
        if (owner === from) {
          // правки, сделанные ещё репликой, от того, кто уже стал владельцем (вошёл первым и сразу
          // строил портал): у него они есть — остальным от его имени
          this.diffs.applyAll(dim, list);
          for (const b of encodeBlocks(M.BLOCKS, dim, list))
            this.toAll("rel", b, from);
          return;
        }
        if (owner !== this.selfId) {
          void this.send(owner, "rel", data);
          return;
        }
      }
    } else if (this.isHost && type === M.EDITS) {
      // хост сам — реплика (измерение считает гость): его правки — владельцу, иначе терялись
      const owner = this.owners.get(dim);
      if (owner && owner !== this.selfId) {
        void this.send(owner, "rel", data);
        return;
      }
    }
    if (type === M.EDITS) {
      // я владелец: правка реплики — как своя (каскады посчитаются здесь и разойдутся BLOCKS)
      if (!sim.authority || dim !== this.game.dimension) return;
      this.applyBlocks(list, true);
      return;
    }
    if (from === this.selfId) return;
    if (!this.isHost) this.diffs.applyAll(dim, list);
    if (dim === this.game.dimension && !sim.authority)
      this.applyBlocks(list, false);
  }

  private applyBlocks(list: readonly BlockDelta[], asOwner: boolean): void {
    const w = this.game.world;
    this.applyingRemote = !asOwner;
    try {
      for (const b of list) {
        if (b.id < 0 || b.id >= BLOCKS.length) continue;
        w.applyRemoteBlock(b.x, b.y, b.z, b.id, b.meta);
      }
    } finally {
      this.applyingRemote = false;
    }
  }

  // ---- сущности

  private async onEntities(
    from: string,
    type: number,
    data: Uint8Array,
  ): Promise<void> {
    if (type === M.ENT_SPAWN) {
      const m = await decodeJson<EntSpawnMsg>(data);
      if (!m) return;
      if (this.isHost && from !== this.selfId)
        this.toDim(m.dim, "rel", data, from);
      if (
        m.dim === this.game.dimension &&
        !sim.authority &&
        from !== this.selfId
      )
        for (const [id, snap] of m.list)
          this.game.entities.netApplySpawn(id, snap);
      return;
    }
    const { dim, ids } = decodeEntRemove(data);
    if (this.isHost && from !== this.selfId) this.toDim(dim, "rel", data, from);
    if (dim === this.game.dimension && !sim.authority && from !== this.selfId)
      for (const id of ids) this.game.entities.netRemove(id);
  }

  private async onEntAction(from: string, data: Uint8Array): Promise<void> {
    const m = await decodeJson<EntActionMsg>(data);
    if (!m) return;
    if (this.isHost) {
      // и от самого хоста, когда он реплика: раньше такие действия до владельца не доходили
      m.from = from === this.selfId ? this.slot : this.records.get(from)?.slot;
      const owner = this.owners.get(m.dim);
      if (owner && owner !== this.selfId) {
        void this.send(owner, "rel", encodeJsonSync(M.ENT_ACTION, m));
        return;
      }
    }
    if (!sim.authority || m.dim !== this.game.dimension) return;
    const em = this.game.entities;
    const a = m.action;
    if (a.a === "spawn") em.netSpawnFromRemote(a.snap);
    else if (a.a === "hurt") {
      const attacker =
        m.from !== undefined ? this.peers.get(m.from)?.remote : null;
      em.hurt(
        a.id,
        a.damage,
        new THREE.Vector3(a.from[0], a.from[1], a.from[2]),
        attacker ?? undefined,
      );
    } else if (a.a === "explode") em.explode(a.x, a.y, a.z, a.power);
    else if (a.a === "patch") em.netPatch(a.id, a.fields ?? {}, m.from);
    else if (a.a === "kill") em.netKill(a.id, !!a.drops);
    else if (a.a === "ride") {
      if (m.from !== undefined && !em.netRide(a.id, m.from, !!a.on))
        this.replyTo({ to: m.from, kind: "ride", id: a.id, ok: false });
    } else if (a.a === "drive") {
      if (m.from !== undefined && Array.isArray(a.pos) && Array.isArray(a.vel))
        em.netDrive(a.id, m.from, a.pos, a.vel, Number(a.yaw));
    }
  }

  /** Реплика: действие над сущностью — владельцу измерения (через хоста). */
  private entAction(action: NetEntityAction): void {
    this.toHost(
      "rel",
      encodeJsonSync(M.ENT_ACTION, {
        dim: this.game.dimension,
        action,
      } satisfies EntActionMsg),
    );
  }

  // ---- контейнеры: один игрок — один открытый контейнер

  /**
   * Открыть контейнер (сундук, печь, вьюк, груз вагонетки, торговлю с жителем). Владелец измерения
   * решает сам, реплика спрашивает его и открывает по ответу — с его содержимым. Занят — подсказка.
   */
  openContainer(key: string, open: () => void): void {
    const g = this.game;
    if (sim.authority) {
      const by = this.lockBy(key, this.slot);
      if (by) return this.busyHint(by);
      this.locks.set(key, this.slot);
      open();
      return;
    }
    if (this.lockWait.has(key)) return;
    const timer = setTimeout(() => {
      if (this.lockWait.delete(key))
        g.hud.message("Нет ответа от игрока, у которого это измерение", 2200);
    }, 4000);
    this.lockWait.set(key, { open, dim: g.dimension, timer });
    this.toHost(
      "rel",
      encodeJsonSync(M.LOCK, {
        dim: g.dimension,
        key,
        open: true,
      } satisfies LockMsg),
    );
  }

  /** Экран контейнера закрыт — отпустить. */
  releaseContainer(key: string): void {
    if (sim.authority) {
      if (this.locks.get(key) === this.slot) this.locks.delete(key);
      return;
    }
    this.toHost(
      "rel",
      encodeJsonSync(M.LOCK, {
        dim: this.game.dimension,
        key,
        open: false,
      } satisfies LockMsg),
    );
  }

  private busyHint(by: string): void {
    this.game.hud.message(`Сейчас открыто у игрока ${by}`, 2000);
  }

  /** Владелец: имя того, кто держит контейнер (если не `slot` и он всё ещё в этом измерении). */
  private lockBy(key: string, slot: number): string | null {
    const cur = this.locks.get(key);
    if (cur === undefined || cur === slot) return null;
    if (cur === this.slot) return this.name;
    const peer = this.peers.get(cur);
    if (peer && peer.dim === this.game.dimension) return peer.name;
    this.locks.delete(key); // держатель ушёл (из измерения или из игры)
    return null;
  }

  private async onLock(from: string, data: Uint8Array): Promise<void> {
    const m = await decodeJson<LockMsg>(data);
    if (!m || typeof m.key !== "string") return;
    if (this.isHost) {
      m.from = from === this.selfId ? this.slot : this.records.get(from)?.slot;
      const owner = this.owners.get(m.dim);
      if (owner && owner !== this.selfId) {
        void this.send(owner, "rel", encodeJsonSync(M.LOCK, m));
        return;
      }
    }
    const slot = m.from;
    if (!sim.authority || m.dim !== this.game.dimension || slot === undefined)
      return;
    if (!m.open) {
      if (this.locks.get(m.key) === slot) this.locks.delete(m.key);
      return;
    }
    const by = this.lockBy(m.key, slot);
    const reply: ReplyMsg = {
      to: slot,
      kind: "lock",
      key: m.key,
      ok: !by,
      ...(by ? { by } : {}),
    };
    if (!by) {
      this.locks.set(m.key, slot);
      // блочная сущность — отсюда: сундук постройки получает добычу здесь, у реплики катилась бы своя
      const b = /^b:(-?\d+),(-?\d+),(-?\d+)$/.exec(m.key);
      if (b) {
        const be = this.game.blockEntities.ensure(+b[1]!, +b[2]!, +b[3]!);
        reply.be = be
          ? {
              type: be.type,
              x: be.x,
              y: be.y,
              z: be.z,
              state: JSON.parse(JSON.stringify(be.state)) as typeof be.state,
            }
          : null;
      }
    }
    this.replyTo(reply);
  }

  /** Ответ игроку `to`: себе — сразу, иначе через хоста (или хост — прямо ему). */
  private replyTo(r: ReplyMsg): void {
    if (r.to === this.slot) {
      this.handleReply(r);
      return;
    }
    const msg = encodeJsonSync(M.REPLY, r);
    if (this.isHost) {
      const to = this.userOfSlot(r.to);
      if (to) void this.send(to, "rel", msg);
    } else this.toHost("rel", msg);
  }

  private async onReply(from: string, data: Uint8Array): Promise<void> {
    const m = await decodeJson<ReplyMsg>(data);
    if (!m) return;
    if (this.isHost && m.to !== this.slot) {
      const to = this.userOfSlot(m.to);
      if (to && to !== from) void this.send(to, "rel", data);
      return;
    }
    if (m.to === this.slot) this.handleReply(m);
  }

  private handleReply(m: ReplyMsg): void {
    const g = this.game;
    if (m.kind === "ride") {
      const r = g.player.riding as unknown as { id?: number } | null;
      if (!m.ok && r && r.id === m.id) {
        g.player.dismount();
        g.hud.message("Место уже занято", 1600);
      }
      return;
    }
    const w = m.key ? this.lockWait.get(m.key) : undefined;
    if (!w || !m.key) return;
    clearTimeout(w.timer);
    this.lockWait.delete(m.key);
    if (!m.ok) return this.busyHint(m.by ?? "?");
    if (w.dim !== g.dimension) {
      this.releaseContainer(m.key);
      return;
    }
    const b = /^b:(-?\d+),(-?\d+),(-?\d+)$/.exec(m.key);
    if (b && m.be !== undefined)
      this.applyBe({
        dim: g.dimension,
        x: +b[1]!,
        y: +b[2]!,
        z: +b[3]!,
        be: m.be,
      });
    w.open();
  }

  // ---- порталы

  private async onPortal(from: string, data: Uint8Array): Promise<void> {
    if (from === this.selfId) return;
    const m = await decodeJson<PortalMsg>(data);
    if (
      !m ||
      !DIMS.includes(m.dim) ||
      !Array.isArray(m.p) ||
      m.p.length !== 3 ||
      !m.p.every(Number.isFinite)
    )
      return;
    if (this.isHost) this.toAll("rel", data, from);
    this.game.applyNetPortal(m.dim, m.p, !!m.add);
  }

  // ---- блочные сущности

  private async onBe(from: string, data: Uint8Array): Promise<void> {
    const m = await decodeJson<BeMsg>(data);
    if (!m) return;
    const owner = this.owners.get(m.dim);
    if (this.isHost && from !== this.selfId) {
      if (owner === from) {
        this.storeBe(m);
        this.toDim(m.dim, "rel", data, from);
      } else if (owner && owner !== this.selfId) {
        void this.send(owner, "rel", data);
        return;
      }
    } else if (this.isHost && owner && owner !== this.selfId) {
      // хост сам — реплика: его правка сундука — владельцу (раньше оставалась только у него)
      void this.send(owner, "rel", data);
      return;
    }
    if (m.dim !== this.game.dimension || from === this.selfId) return;
    if (sim.authority) {
      // правка реплики (открытый сундук): принять — diff разошлёт её всем, включая приславшего
      this.game.blockEntities.applyRemote(m.x, m.y, m.z, m.be);
    } else this.applyBe(m);
  }

  private applyBe(m: BeMsg): void {
    this.game.blockEntities.applyRemote(m.x, m.y, m.z, m.be);
    this.replicaBe.markBe(m.be, m.x + "," + m.y + "," + m.z);
  }

  private storeBe(m: BeMsg): void {
    let s = this.beStore.get(m.dim);
    if (!s) this.beStore.set(m.dim, (s = new Map()));
    const k = m.x + "," + m.y + "," + m.z;
    if (m.be) s.set(k, m.be);
    else s.delete(k);
  }

  // ---- игроку: урон, предметы

  hit(
    slot: number,
    amount: number,
    cause: string,
    knock?: [number, number, number],
    effect?: Hit["effect"],
  ): void {
    const h: Hit = {
      to: slot,
      amount,
      cause,
      ...(knock ? { knock } : {}),
      ...(effect ? { effect } : {}),
    };
    this.toHost("rel", encodeJsonSync(M.HIT, h));
  }

  give(slot: number, stack: ItemStack | null, xp?: number): void {
    const g: Give = {
      to: slot,
      ...(stack ? { stack } : {}),
      ...(xp ? { xp } : {}),
    };
    this.toHost("rel", encodeJsonSync(M.GIVE, g));
  }

  private async onToPlayer(
    from: string,
    type: number,
    data: Uint8Array,
  ): Promise<void> {
    const m = await decodeJson<Hit & Give>(data);
    if (!m) return;
    if (this.isHost && m.to !== this.slot) {
      const to = this.userOfSlot(m.to);
      if (to && to !== from) void this.send(to, "rel", data);
      return;
    }
    if (m.to !== this.slot) return;
    const g = this.game;
    if (type === M.HIT) {
      if (m.effect)
        g.player.addEffect(
          m.effect.id as Parameters<typeof g.player.addEffect>[0],
          m.effect.seconds,
          m.effect.level,
        );
      if (m.amount > 0) g.player.damage(m.amount, m.cause);
      if (m.knock)
        g.player.vel.set(
          g.player.vel.x + m.knock[0],
          Math.max(g.player.vel.y, m.knock[1]),
          g.player.vel.z + m.knock[2],
        );
    } else {
      if (m.xp) g.player.addXp(m.xp);
      if (m.stack && ITEMS[m.stack.item]) {
        const left = g.inventory.addStack(m.stack);
        if (left < m.stack.count)
          events.emit("itemPickup", {
            item: m.stack.item,
            count: m.stack.count - left,
          });
        if (left > 0) {
          const p = g.player.pos;
          g.entities.spawnDrop(
            p.x,
            p.y + 0.5,
            p.z,
            m.stack.item,
            left,
            m.stack.dmg,
            m.stack.tag,
          );
        }
      }
    }
  }

  // ---- чат

  sendChat(text: string): void {
    const t = text.slice(0, 256);
    this.game.chat.print(`<${this.name}> ${t}`);
    this.toHost("rel", encodeJsonSync(M.CHAT, { from: this.slot, text: t }));
  }

  private async onChat(from: string, data: Uint8Array): Promise<void> {
    const m = await decodeJson<{ from?: number; text: string }>(data);
    if (!m || from === this.selfId) return;
    if (this.isHost) {
      m.from = this.records.get(from)?.slot;
      this.toAll("rel", encodeJsonSync(M.CHAT, m), from);
    }
    const who =
      m.from !== undefined ? (this.peers.get(m.from)?.name ?? "?") : "?";
    this.game.chat.print(`<${who}> ${String(m.text).slice(0, 256)}`);
  }

  // =========================================================================== владение измерением

  /** Стать владельцем своего измерения: сущности и блочные сущности — из переданного сохранения. */
  private becomeOwner(save: DimensionSave | null): void {
    const g = this.game;
    sim.authority = true;
    g.entities.replica = false;
    g.entities.localSlot = this.slot;
    this.driving = null;
    g.entities.drivenId = null;
    this.locks.clear();
    if (save) {
      g.entities.deserialize(
        (save.entities ?? []) as Parameters<typeof g.entities.deserialize>[0],
      );
      g.blockEntities.deserialize(save.blockEntities ?? []);
    }
    this.bc.reset();
    for (const peer of this.peers.values())
      if (peer.pose && peer.dim === g.dimension && !peer.remote) {
        peer.remote = new RemotePlayer(g.world, peer.slot, peer.userId, this);
        peer.remote.applyPose(peer.pose);
      }
    g.entities.others = () => this.remoteActors();
  }

  /** Стать репликой: сущности — образы от владельца, локальные id — в отдельном диапазоне. */
  private becomeReplica(): void {
    const g = this.game;
    sim.authority = false;
    g.entities.replica = true;
    g.entities.localSlot = this.slot;
    this.driving = null;
    this.locks.clear();
    g.entities._nextId = Math.max(g.entities._nextId, 1_000_000_000);
    g.entities.clear();
    g.entities.others = () => [];
    g.entities.onLocalSpawn = (snap) =>
      this.toHost(
        "rel",
        encodeJsonSync(M.ENT_ACTION, {
          dim: g.dimension,
          action: { a: "spawn", snap },
        } satisfies EntActionMsg),
      );
    g.entities.onRemoteAction = (action) =>
      this.toHost(
        "rel",
        encodeJsonSync(M.ENT_ACTION, {
          dim: g.dimension,
          action,
        } satisfies EntActionMsg),
      );
    for (const peer of this.peers.values()) peer.remote = null;
  }

  private remoteActors() {
    const out = [];
    for (const peer of this.peers.values())
      if (peer.remote && peer.dim === this.game.dimension && peer.pose)
        out.push({
          player: peer.remote as RemotePlayer,
          inventory: remoteInventory(peer.remote, this),
        });
    return out;
  }

  /**
   * Перед сменой измерения (начало Game.changeDimension): у всех есть дифы любого измерения, так
   * что целевое строится без ожидания. Сущности поднимаем, только если станем владельцем сразу
   * (хост, измерение ничьё); иначе их пришлёт владелец или хост отдаст владение.
   */
  beforeDimension(target: DimensionId): void {
    const g = this.game;
    const iOwnTarget = this.isHost && !this.owners.get(target);
    const frozen = this.frozen.get(target);
    g.dims.set(target, {
      chunks: this.diffs.toChunkDiffMap(target),
      entities: iOwnTarget ? (frozen?.entities ?? []) : [],
      blockEntities: iOwnTarget
        ? (frozen?.blockEntities ?? [])
        : [...(this.beStore.get(target)?.values() ?? [])].filter(Boolean),
    });
    if (iOwnTarget) this.frozen.delete(target);
    this.pendingOwnTarget = iOwnTarget;
  }
  private pendingOwnTarget = false;

  /**
   * Середина Game.changeDimension: прежнее измерение уже снято в `dims` (с сущностями — для
   * передачи следующему владельцу), новое ещё не загружено. Здесь переключается роль: реплике нельзя
   * поднимать сущности из сохранения — её spawn ушёл бы владельцу, а сущности там и так есть.
   */
  prepareDimension(): void {
    if (this.pendingOwnTarget) {
      sim.authority = true;
      this.game.entities.replica = false;
    } else this.becomeReplica();
  }

  /** После смены измерения: отдать прежнее (если владел) и заявить новое. */
  afterDimension(prev: DimensionId, target: DimensionId): void {
    const g = this.game;
    const wasOwner = this.owners.get(prev) === this.selfId;
    const handoff = wasOwner ? g.dims.get(prev) : undefined;
    for (const peer of this.peers.values()) this.dropPeerView(peer);
    if (this.isHost) {
      const r = this.records.get(this.selfId)!;
      r.dim = target;
      if (handoff)
        this.frozen.set(prev, {
          chunks: {},
          entities: handoff.entities ?? [],
          blockEntities: handoff.blockEntities ?? [],
        });
      if (wasOwner) this.owners.delete(prev);
      this.assignOwner(prev);
      if (!this.owners.get(target)) {
        this.owners.set(target, this.selfId);
        this.becomeOwner(null); // сущности уже подняты changeDimension из g.dims
      } else this.enterDim(this.selfId, target);
      this.broadcastRoster();
      return;
    }
    // Синхронно и без сжатия: следом пойдут правки нового измерения (портал на той стороне), и по
    // упорядоченному каналу хост обязан узнать о входе РАНЬШЕ — иначе правки ничейного измерения
    // он бы выбросил.
    const msg: DimEnter = {
      dim: target,
      ...(handoff ? { handoff: { dim: prev, save: handoff } } : {}),
    };
    this.toHost("rel", encodeJsonSync(M.DIM_ENTER, msg));
    // сейв игрока у хоста — сразу, а не через 10 с: уйди хост раньше, гость вернулся бы в прежнее
    // измерение на прежнее место
    this.sendPlayerState();
  }

  /** Хост: игрок вошёл в измерение — владельцем или репликой. */
  private onDimEnter(from: string, m: DimEnter): void {
    const r = this.records.get(from);
    if (!r) return;
    const prev = r.dim;
    r.dim = m.dim;
    if (m.handoff && this.owners.get(m.handoff.dim) === from) {
      this.frozen.set(m.handoff.dim, {
        chunks: {},
        entities: m.handoff.save.entities ?? [],
        blockEntities: m.handoff.save.blockEntities ?? [],
      });
      for (const b of m.handoff.save.blockEntities ?? []) {
        const be = b as BeMsg["be"];
        if (be)
          this.storeBe({ dim: m.handoff.dim, x: be.x, y: be.y, z: be.z, be });
      }
      this.owners.delete(m.handoff.dim);
    }
    this.assignOwner(prev);
    this.enterDim(from, m.dim);
    this.broadcastRoster();
  }

  /** Хост: `who` в измерении `dim` — дать владение (если ничьё) или полный снимок от владельца. */
  private enterDim(who: string, dim: DimensionId): void {
    const owner = this.owners.get(dim);
    if (!owner) {
      this.owners.set(dim, who);
      const save = this.frozen.get(dim) ?? EMPTY_DIM();
      this.frozen.delete(dim);
      if (who === this.selfId) this.becomeOwner(save);
      // синхронно: по упорядоченному каналу владение обязано прийти раньше пересланных следом правок
      else
        void this.send(
          who,
          "rel",
          encodeJsonSync(M.DIM_OWN, { dim, save } satisfies DimOwn),
        );
      return;
    }
    if (owner === who) return;
    void this.send(owner, "rel", encodeJsonSync(M.DIM_RESYNC, { dim }));
    const list = [...(this.beStore.get(dim) ?? new Map())].map(([k, be]) => {
      const [x, y, z] = k.split(",").map(Number) as [number, number, number];
      return { dim, x, y, z, be } satisfies BeMsg;
    });
    // синхронно: следом могут пойти свежие изменения тех же сундуков, старый список не должен их затереть
    if (who !== this.selfId && list.length)
      void this.send(who, "rel", encodeJsonSync(M.BE_LIST, { dim, list }));
  }

  /** Хост: у измерения нет владельца или он ушёл — отдать следующему игроку в нём, иначе заморозить. */
  private assignOwner(dim: DimensionId): void {
    const owner = this.owners.get(dim);
    if (owner && this.records.get(owner)?.dim === dim) return;
    this.owners.delete(dim);
    const next = [...this.records.entries()]
      .filter(([, r]) => r.dim === dim)
      .sort((a, b) => a[1].slot - b[1].slot)[0];
    if (next) this.enterDim(next[0], dim);
  }

  // =========================================================================== список игроков

  private roster(): Roster {
    return {
      hostId: this.selfId,
      players: [...this.records.entries()].map(([userId, r]) => ({
        slot: r.slot,
        userId,
        name: r.name,
        dim: r.dim,
        op: this.ops.has(userId),
      })),
      owners: Object.fromEntries(this.owners),
      settings: this.settings,
      ...(this.successor ? { successor: this.successor } : {}),
    } as Roster;
  }

  private broadcastRoster(): void {
    if (!this.isHost) return;
    const r = this.roster();
    this.applyRoster(r);
    this.toAll("rel", encodeJsonSync(M.ROSTER, r));
  }

  private applyRoster(r: Roster): void {
    this.settings = r.settings;
    this.ops.clear();
    const seen = new Set<number>();
    for (const p of r.players) {
      if (p.op) this.ops.add(p.userId);
      if (p.userId === this.selfId) {
        this.slot = p.slot;
        continue;
      }
      seen.add(p.slot);
      const cur = this.peers.get(p.slot);
      if (cur) {
        cur.name = p.name;
        cur.op = p.op;
        cur.dim = p.dim;
      } else
        this.peers.set(p.slot, {
          slot: p.slot,
          userId: p.userId,
          name: p.name,
          dim: p.dim,
          op: p.op,
          pose: null,
          held: null,
          mode: "survival",
          sleeping: false,
          avatar: null,
          remote: null,
        });
    }
    for (const [slot, peer] of [...this.peers])
      if (!seen.has(slot)) {
        this.dropPeerView(peer);
        this.peers.delete(slot);
      }
    // владелец моего измерения сменился — старые образы сущностей больше не обновятся
    const ownerHere = r.owners[this.game.dimension];
    const prevOwner = this.owners.get(this.game.dimension);
    this.owners.clear();
    for (const [d, u] of Object.entries(r.owners))
      if (u) this.owners.set(d as DimensionId, u);
    if (
      !this.isHost &&
      ownerHere !== prevOwner &&
      ownerHere !== this.selfId &&
      !sim.authority
    )
      this.game.entities.clear();
    const succ = (r as Roster & { successor?: string }).successor ?? null;
    if (succ !== this.successor) {
      this.successor = succ;
      // запасная связь с преемником: передача хоста не ждёт сигналинга
      if (succ === this.selfId)
        this.session.setExtraPeers(r.players.map((p) => p.userId));
      else this.session.setExtraPeers(succ ? [succ] : []);
    }
    events.emit("net:roster");
  }

  /** Игроки для списка по Tab. */
  playerList(): {
    name: string;
    slot: number;
    userId: string;
    host: boolean;
    op: boolean;
    dim: DimensionId;
    rtt: number;
  }[] {
    const out = [
      {
        name: this.name,
        slot: this.slot,
        userId: this.selfId,
        host: this.isHost,
        op: this.ops.has(this.selfId),
        dim: this.game.dimension,
        rtt: 0,
      },
    ];
    for (const p of this.peers.values())
      out.push({
        name: p.name,
        slot: p.slot,
        userId: p.userId,
        host: p.userId === this.hostId,
        op: p.op,
        dim: p.dim,
        rtt: this.session.linkStats(p.userId)?.rttMs ?? 0,
      });
    return out.sort((a, b) => a.slot - b.slot);
  }

  // =========================================================================== тик и кадр

  /** Конец симтика Game: разослать накопленное. */
  afterTick(): void {
    if (this.closed) return;
    const g = this.game;
    this.tickN++;
    const dim = g.dimension;

    if (this.pending.length) {
      const list = this.pending;
      this.pending = [];
      const type = sim.authority ? M.BLOCKS : M.EDITS;
      for (const msg of encodeBlocks(type, dim, list))
        if (this.isHost && type === M.BLOCKS) this.toAll("rel", msg);
        else this.toHost("rel", msg);
    }

    if (!sim.authority) {
      // свои действия над сущностями (остриг, оседлал, назвал, поторговал) — владельцу
      for (const a of g.entities.netLocalChanges()) this.entAction(a);
      this.syncRide();
    }

    if (sim.authority) {
      // толчки удалённых игроков (взрыв, удар моба) — им
      for (const peer of this.peers.values()) {
        const imp = peer.remote?.takeImpulse();
        if (imp && peer.remote) this.hit(peer.slot, 0, "knock", imp);
      }
      if (this.tickN % 2 === 0 && this.hasOthersIn(dim)) {
        const d = this.bc.diffEntities(g.entities);
        // синхронно: появление обязано уйти раньше удаления следующего тика
        if (d.spawns.length)
          this.ownerSend(
            "rel",
            encodeJsonSync(M.ENT_SPAWN, {
              dim,
              list: d.spawns,
            } satisfies EntSpawnMsg),
          );
        for (const b of encodeEntPoses(dim, d.poses)) this.ownerSend("fast", b);
        if (d.removes.length)
          this.ownerSend("rel", encodeEntRemove(dim, d.removes));
      }
      if (this.tickN % 10 === 0)
        for (const { be, key } of this.bc.diffBlockEntities(g.blockEntities)) {
          const [x, y, z] = key.split(",").map(Number) as [
            number,
            number,
            number,
          ];
          const msg: BeMsg = { dim, x, y, z, be };
          if (this.isHost) this.storeBe(msg);
          if (this.hasOthersIn(dim))
            this.ownerSend("rel", encodeJsonSync(M.BE, msg));
        }
    } else if (this.tickN % 10 === 0) {
      // реплика: своё изменение блочной сущности (переложил в сундуке) — владельцу
      for (const { be, key } of this.replicaBe.diffBlockEntities(
        g.blockEntities,
      )) {
        const [x, y, z] = key.split(",").map(Number) as [
          number,
          number,
          number,
        ];
        this.toHost(
          "rel",
          encodeJsonSync(M.BE, { dim, x, y, z, be } satisfies BeMsg),
        );
      }
    }

    // своя поза — каждый тик; метаданные — по изменению; сейв игрока — раз в 10 с
    this.sendPose();
    this.sendMetaIfChanged();
    if (this.tickN % 200 === 0 && !this.isHost) this.sendPlayerState();

    if (this.isHost) {
      if (this.tickN % 100 === 0)
        this.toAll("rel", encodeJsonSync(M.WORLD, g.netWorldState()));
      if (this.tickN % 200 === 0) this.pickSuccessorAndShadow();
    } else this.watchHost();
  }

  /**
   * Реплика в транспорте или верхом: сущность ведёт этот игрок (EntityManager.drivenId), владелец
   * её не тикает и получает позу 10 раз в секунду. Сел/слез — сказать владельцу.
   */
  private syncRide(): void {
    const g = this.game;
    const em = g.entities;
    const r = g.player.riding as unknown as { id?: number } | null;
    const id =
      r && typeof r.id === "number" && (em.entities.get(r.id) as unknown) === r
        ? r.id
        : null;
    if (id !== this.driving) {
      if (this.driving !== null)
        this.entAction({ a: "ride", id: this.driving, on: false });
      if (id !== null) this.entAction({ a: "ride", id, on: true });
      this.driving = id;
      em.drivenId = id;
    }
    if (id === null || this.tickN % 2 !== 0) return;
    const e = em.entities.get(id);
    if (!e) return;
    const vel = "vel" in e ? e.vel : null;
    this.entAction({
      a: "drive",
      id,
      pos: [e.pos.x, e.pos.y, e.pos.z],
      vel: vel ? [vel.x, vel.y, vel.z] : [0, 0, 0],
      yaw: e.kind === "mob" ? e.yaw : 0,
    });
  }

  /** Владелец рассылает игрокам измерения: хост — сам, гость — через хоста. */
  private ownerSend(channel: "rel" | "fast", data: Uint8Array): void {
    if (this.isHost)
      this.toDim(this.game.dimension, channel, data, this.selfId);
    else this.toHost(channel, data);
  }

  private hasOthersIn(dim: DimensionId): boolean {
    for (const p of this.peers.values()) if (p.dim === dim) return true;
    return false;
  }

  private sendPose(): void {
    const g = this.game;
    const p = g.player;
    const flags =
      (p._sneaking ? POSE_SNEAK : 0) |
      (p.dead ? POSE_DEAD : 0) |
      (p.flying ? POSE_FLY : 0) |
      (p.gliding ? POSE_GLIDE : 0) |
      (p.inWater ? POSE_SWIM : 0) |
      (g.armView._swing > 0 ? POSE_SWING : 0) |
      (p.mode === "creative" ? POSE_CREATIVE : 0);
    const msg = encodePose({
      slot: this.slot,
      dim: g.dimension,
      x: p.pos.x,
      y: p.pos.y,
      z: p.pos.z,
      yaw: p.yaw,
      pitch: p.pitch,
      flags,
      health: p.health,
    });
    if (this.isHost) this.toAll("fast", msg);
    else this.toHost("fast", msg);
  }

  private sendMetaIfChanged(): void {
    const g = this.game;
    const meta: PlayerMeta & { sleeping: boolean } = {
      slot: this.slot,
      held: g.inventory.heldItem()?.item ?? null,
      mode: g.player.mode,
      name: this.name,
      sleeping: g.netSleeping,
    };
    const j = JSON.stringify(meta);
    if (j === this.lastMeta) return;
    this.lastMeta = j;
    if (this.isHost) {
      this.toAll("rel", encodeJsonSync(M.PMETA, meta));
      this.hostSleepCheck(this.selfId, meta);
    } else this.toHost("rel", encodeJsonSync(M.PMETA, meta));
  }

  /** Сон как в Minecraft: ночь пропускается, когда спят ВСЕ игроки Верхнего мира. */
  private hostSleepCheck(_who: string, _m: PlayerMeta): void {
    const g = this.game;
    const inOverworld = [...this.records.entries()].filter(
      ([, r]) => r.dim === "overworld",
    );
    if (!inOverworld.length) return;
    const allAsleep = inOverworld.every(([uid]) =>
      uid === this.selfId
        ? g.netSleeping
        : ([...this.peers.values()].find((p) => p.userId === uid)?.sleeping ??
          false),
    );
    if (allAsleep) {
      g.skipNight();
      this.toAll("rel", encodeJsonSync(M.WORLD, g.netWorldState()));
    }
  }

  frame(dt: number): void {
    for (const peer of this.peers.values()) peer.avatar?.frame(dt);
  }

  // =========================================================================== команды

  private mayCheat(userId: string): boolean {
    return (
      userId === this.selfId ||
      this.ops.has(userId) ||
      this.settings.cheatsForAll
    );
  }

  /**
   * Команда в сетевой игре: «про себя» — здесь, «про мир» — у хоста, без прав — отказ.
   * Возвращает null (исполнять локально) или текст ответа.
   */
  routeCommand(name: string, text: string): string | null {
    const harmless = ["help", "seed", "locate", "achievements", "music", "tutorial"];
    if (harmless.includes(name)) return null;
    if (name === "newworld")
      return "В сетевой игре новый мир не создать — сначала выйдите из неё";
    if (!this.canCheat) return "Команды в этой игре — только у операторов";
    if (["time", "weather", "difficulty"].includes(name) && !this.isHost) {
      this.toHost("rel", encodeJsonSync(M.COMMAND, { text }));
      return "Команда отправлена хосту";
    }
    return null;
  }

  /** Хост: выдать или снять права оператора. */
  setOp(userId: string, op: boolean): void {
    if (!this.isHost || userId === this.selfId) return;
    if (op) this.ops.add(userId);
    else this.ops.delete(userId);
    const r = this.records.get(userId);
    if (r) r.op = op;
    this.broadcastRoster();
  }

  async kick(userId: string, ban: boolean): Promise<string | null> {
    const res = await this.session.kick(userId, ban);
    return res.ok ? null : res.error;
  }

  // =========================================================================== хост ушёл

  /** Хост: выбрать преемника (лучшая связь) и отправить ему теневую копию мира. */
  private pickSuccessorAndShadow(): void {
    let best: string | null = null,
      bestRtt = Infinity;
    for (const peer of this.peers.values()) {
      const s = this.session.linkStats(peer.userId);
      if (!s || !this.session.isOpen(peer.userId)) continue;
      const rtt = s.rttMs || 999;
      if (rtt < bestRtt) {
        bestRtt = rtt;
        best = peer.userId;
      }
    }
    if (best !== this.successor) {
      this.successor = best;
      this.session.setSuccessor(best);
      this.broadcastRoster();
    }
    if (!best) return;
    const g = this.game;
    const dims: Partial<Record<DimensionId, DimensionSave>> = {};
    for (const [d, s] of this.frozen) dims[d] = s;
    if (this.owners.get(g.dimension) === this.selfId)
      dims[g.dimension] = {
        chunks: {},
        entities: g.entities.serialize(),
        blockEntities: g.blockEntities.serialize(),
      };
    const players: Record<string, unknown> = {};
    for (const [uid, r] of this.records)
      players[uid] = uid === this.selfId ? g.netPlayerState() : r.state;
    const shadow: Shadow = {
      world: g.netWorldMeta(),
      dims,
      players,
      settings: this.settings,
      ops: [...this.ops],
    };
    void encodeJson(M.SHADOW, shadow).then((b) => this.send(best!, "rel", b));
  }

  private onPeerOpen(peerId: string): void {
    if (!this.isHost && peerId === this.hostId) {
      if (this.welcomeWait) this.sendHello();
      else {
        // новый хост после передачи: представиться заново
        this.lastMeta = "";
        this.sendPlayerState();
      }
    }
  }

  /** Гость: свой сейв хосту (он хранит его в своём мире). */
  private sendPlayerState(): void {
    if (this.isHost) return;
    void encodeJson(M.PSTATE, { state: this.game.netPlayerState() }).then((b) =>
      this.toHost("rel", b),
    );
  }

  private onPeerClose(peerId: string): void {
    if (!this.isHost && peerId === this.hostId)
      this.hostSilentSince = Date.now();
  }

  private onMemberLeft(userId: string): void {
    for (const peer of this.peers.values())
      if (peer.userId === userId && sim.authority)
        this.game.entities.netReleaseDriver(peer.slot);
    const r = this.records.get(userId);
    if (this.isHost && r) {
      this.records.delete(userId);
      if (this.owners.get(r.dim) === userId) {
        this.owners.delete(r.dim);
        this.assignOwner(r.dim);
      }
      this.broadcastRoster();
    }
    for (const [slot, peer] of [...this.peers])
      if (peer.userId === userId) {
        this.dropPeerView(peer);
        this.peers.delete(slot);
      }
    events.emit("net:roster");
  }

  /** Гость: связь с хостом пропала. Преемник через 5 с забирает роль (сервер проверит, что хост молчит). */
  private watchHost(): void {
    if (!this.hostSilentSince || this.successor !== this.selfId) return;
    if (this.session.isOpen(this.hostId)) {
      this.hostSilentSince = 0;
      return;
    }
    if (Date.now() - this.hostSilentSince < 5000 || this.tickN % 40 !== 0)
      return;
    void this.session.claimHost();
  }

  private onHostChanged(hostId: string, previousHostId: string | null): void {
    this.hostSilentSince = 0;
    this.hostIdBefore = previousHostId ?? "";
    if (hostId !== this.selfId) {
      // у нового хоста наш сейв из теневой копии (до 10 с давности); по запасной связи, уже открытой,
      // onPeerOpen не сработает — шлём сразу
      if (this.session.isOpen(hostId)) this.sendPlayerState();
      return;
    }
    this.promote();
  }

  /** Стал хостом: мир из теневой копии и своей копии дифов, прежние владельцы измерений — как были. */
  private promote(): void {
    const g = this.game;
    const sh = this.shadow;
    this.records.clear();
    this.records.set(this.selfId, {
      slot: this.slot,
      name: this.name,
      dim: g.dimension,
      op: true,
      state: null,
    });
    for (const peer of this.peers.values())
      if (this.session.members.has(peer.userId))
        this.records.set(peer.userId, {
          slot: peer.slot,
          name: peer.name,
          dim: peer.dim,
          op: peer.op,
          state: sh?.players[peer.userId] ?? null,
        });
    this.nextSlot = Math.max(this.slot, ...[...this.peers.keys()]) + 1;
    if (sh) {
      this.settings = sh.settings;
      for (const o of sh.ops) this.ops.add(o);
      for (const [d, s] of Object.entries(sh.dims) as [
        DimensionId,
        DimensionSave,
      ][])
        if (!this.owners.has(d) || this.owners.get(d) === this.hostIdBefore)
          this.frozen.set(d, s);
      g.applyNetWorldState({
        ...sh.world,
        difficulty: sh.world.difficulty,
        daysAwake: sh.world.daysAwake,
      } as WorldState);
    }
    this.ops.add(this.selfId);
    // владения прежнего хоста: его измерение — следующему там (может, мне), остальное — как было
    for (const [d, owner] of [...this.owners])
      if (!this.records.has(owner)) {
        this.owners.delete(d);
        this.assignOwner(d);
      }
    if (!this.owners.get(g.dimension)) {
      this.owners.set(g.dimension, this.selfId);
      this.becomeOwner(this.frozen.get(g.dimension) ?? null);
      this.frozen.delete(g.dimension);
    }
    g.adoptNetWorldAsOwn();
    this.broadcastRoster();
    this.toAll("rel", encodeJsonSync(M.WORLD, g.netWorldState()));
    g.hud.message("Хост ушёл — теперь мир у вас", 3000);
  }
  private hostIdBefore = "";

  // =========================================================================== гость: вход

  private applyWelcome(w: Welcome): void {
    this.slot = w.you;
    this.applyRoster(w.roster);
    this.hostIdBefore = w.roster.hostId;
    for (const d of DIMS) this.diffs.load(d, w.diffs[d]);
    this.becomeReplica();
    this.game.loadNetWorld(w, this.diffs, this.settings);
    // правки, накопленные, пока шёл вход, — из СВОЕГО одиночного мира: хосту их слать нельзя
    this.pending = [];
    this.welcomed = true;
    // отложенное — по порядку прихода; правки из снимка применятся повторно, это безвредно
    const stash = this.stash.splice(0);
    for (const [from, data] of stash)
      this.inbox = this.inbox.then(() => this.onMessage(from, "rel", data));
  }

  // =========================================================================== выход

  /** Хост уходит: свежая теневая копия преемнику, и сервер отдаст роль именно ему. */
  prepareExit(): void {
    if (this.closed || !this.isHost) return;
    this.pickSuccessorAndShadow();
    this.session.setSuccessor(this.successor);
  }

  /** Хост: сейвы других игроков — в мир хоста (Game.persist). */
  collectPlayerStates(into: Map<string, unknown>): void {
    if (!this.isHost) return;
    for (const [uid, r] of this.records)
      if (uid !== this.selfId && r.state) into.set(uid, r.state);
  }

  /** Уйти из сетевой игры (кнопка). Хост передаёт мир преемнику. */
  async leave(): Promise<void> {
    if (this.closed) return;
    this.prepareExit();
    this.dispose();
    await this.leaveRoom();
    this.game.exitNet(null);
  }

  private end(reason: string): void {
    if (this.closed) return;
    this.dispose();
    this.game.exitNet(reason);
  }

  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    for (const off of this.offs.splice(0)) off();
    for (const peer of this.peers.values()) this.dropPeerView(peer);
    this.peers.clear();
    const g = this.game;
    g.entities.replica = false;
    g.entities.others = () => [];
    g.entities.onLocalSpawn = null;
    g.entities.onRemoteAction = null;
    g.entities.localSlot = null;
    g.entities.drivenId = null;
    g.onPortalChange = null;
    for (const w of this.lockWait.values()) clearTimeout(w.timer);
    this.lockWait.clear();
    this.locks.clear();
    sim.authority = true;
  }
}
