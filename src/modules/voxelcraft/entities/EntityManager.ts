// Менеджер сущностей: мобы, дроп-предметы, сферы опыта, стрелы. Тик — симуляция (20 TPS),
// updateVisuals — интерполяция для рендера. Перепись (census) держит население мобов вокруг игрока
// по правилам Minecraft: мирные — на траве при свете, враждебные — в темноте (ночью и в пещерах).
// Игрок хранится отдельно (Player), но интерфейс сущностей совместим — в этапе 2 удалённые игроки
// станут ещё одним kind'ом.
import * as THREE from "three";
import { rules } from "../systems/Difficulty";
import { CONFIG } from "../config";
import { events } from "../core/EventBus";
import { BLOCKS, B } from "../registry/Blocks";
import { ITEMS } from "../registry/Items";
import { MOBS } from "../registry/Mobs";
import { frogFor } from "../registry/mobs/frog";
import { dropsOf } from "../systems/Mining";
import { explodeBlocks, explosionDamage } from "../systems/Explosion";
import { rayBox } from "../physics/rayBox";
import { raycastBlocks } from "../world/Raycast";
import { Mob } from "./Mob";
import { ItemDrop } from "./ItemDrop";
import { XpOrb } from "./XpOrb";
import { Arrow } from "./Arrow";
import { tippedEffect } from "../systems/TippedArrow";
import { PrimedTnt } from "./PrimedTnt";
import { Fireball, type FireballKind } from "./Fireball";
import { RimEye } from "./RimEye";
import { CART_VARIANTS, Minecart, type CartVariant } from "./Minecart";
import { Fang } from "./Fang";
import { extractOne, insertOne } from "../world/Containers";
import { HOPPER_COOLDOWN } from "../world/blockentities/hopper";
import { smokedHive } from "../world/Hive";
import type { BlockEntity } from "../world/BlockEntities";
import { Boat } from "./Boat";
import { FishingHook } from "./FishingHook";
import { INFESTED_NAMES } from "../registry/blocks/infested";
import { findAltar } from "./AshLord";
import { startCharge } from "./AshLordBrain";
import { isSnowGolem } from "./SnowGolemBrain";
import { findJob, jobAt } from "../systems/Jobs";
import { CURE_SECONDS, ZOMBIE_VILLAGER, curedTypeOf } from "../systems/Zombify";
import {
  GOLEM_COOLDOWN,
  GOLEM_RADIUS,
  isIronGolem,
  shouldSummonGolem,
} from "../systems/Golem";
import {
  REP_CURE,
  REP_HIT_VILLAGER,
  REP_TRADE,
  clampRep,
} from "../systems/Reputation";

/** Секунд между пополнениями товара за работой у своего блока. */
const VILLAGER_RESTOCK = 120;

/** id заражённых блоков — из них вылезает чешуйница. */
const INFESTED_IDS = new Set(
  INFESTED_NAMES.map((n) => B[n]).filter(
    (id): id is number => id !== undefined,
  ),
);
import type { MobCtx } from "./MobBrain";
import type { ChunkManager } from "../world/ChunkManager";
import type { TextureAtlas } from "../gfx/TextureAtlas";
import type { Player } from "../player/Player";
import { sanitizeStack, type Inventory } from "../systems/Inventory";
import type { ItemStack, MobDef } from "../types";

type Entity =
  | Mob
  | ItemDrop
  | XpOrb
  | Arrow
  | PrimedTnt
  | Fireball
  | RimEye
  | Minecart
  | Boat
  | FishingHook
  | Fang;

// Форма сохранённой сущности (выход serialize()) — дискриминируется по `kind`. Стрелы не сохраняются.
type EntitySave =
  | {
      kind: "mob";
      type: string;
      pos: [number, number, number];
      hp: number;
      baby?: boolean;
      sheared?: boolean;
      /** Житель: использованные сделки до пополнения. */
      uses?: number[];
      /** Житель: занятый рабочий блок и «уже торговал» (systems/Jobs). */
      jobSite?: [number, number, number];
      traded?: boolean;
      /** Житель: опыт профессии (уровни сделок). */
      villagerXp?: number;
      /** Зомби-житель: кем он был и сколько осталось лечиться (systems/Zombify). */
      curedType?: string;
      curing?: number;
      tamed?: boolean;
      /** Имя с бирки (registry/items/nametag). */
      customName?: string;
      sitting?: boolean;
      saddled?: boolean;
      /** Овца: цвет шерсти (нет поля — белая). */
      woolColor?: string;
      /** Волк: запас брони из щитков. */
      wolfArmor?: number;
      /** Дух-помощник: образец и собранное. */
      carry?: string;
      bag?: number;
      /** Вьюк осла, мула, ламы; на поводке. */
      items?: (ItemStack | null)[];
      leashed?: boolean;
      leashPost?: [number, number, number];
      /** Сетевая игра: слот игрока, который держит поводок. */
      leashSlot?: number;
      /** Секунд до ухода странствующего торговца и его лам. */
      leaveT?: number;
      migrationId?: string;
      migrationTarget?: [number, number];
      /** Пчела: свой улей и пыльца. */
      home?: [number, number, number];
      pollen?: boolean;
      /** Капитан мародёров. */
      captain?: boolean;
    }
  | {
      kind: "drop";
      pos: [number, number, number];
      item: string;
      count: number;
      dmg?: number;
      /** Зачарования, вещи панцирного сундука. */
      tag?: Record<string, unknown>;
    }
  | { kind: "xp"; pos: [number, number, number]; value: number }
  | {
      kind: "minecart";
      pos: [number, number, number];
      vel?: [number, number, number];
      /** Вид (нет — обычная) и груз вагонетки с сундуком или воронкой. */
      variant?: CartVariant;
      items?: (ItemStack | null)[];
    }
  | { kind: "boat"; pos: [number, number, number]; wood?: string };

const randInt = (a: number, b: number): number =>
  a + Math.floor(Math.random() * (b - a + 1));

/**
 * Игрок в этом измерении, с которым работают сущности: мобы целятся, предметы подбираются, взрыв
 * бьёт. Локальный — `player`/`inventory` менеджера; удалённые (сетевая игра) — `others()`.
 */
export interface Actor {
  player: Player;
  inventory: Inventory;
}

export type { Entity };

/** Сущность в сети: вид + всё, что нужно, чтобы построить её у другого игрока. */
export type NetEntitySnap =
  | EntitySave
  | {
      kind: "arrow";
      pos: [number, number, number];
      vel: [number, number, number];
      damage: number;
      fromPlayer: boolean;
      stuck?: boolean;
      effect?: { id: string; seconds: number } | null;
      pick?: ItemStack;
    }
  | {
      kind: "fireball";
      ballKind: FireballKind;
      pos: [number, number, number];
      vel: [number, number, number];
      damage: number;
      shooterId: number;
    }
  | { kind: "tnt"; pos: [number, number, number]; fuse: number }
  | {
      kind: "drop";
      pos: [number, number, number];
      item: string;
      count: number;
      dmg?: number;
      tag?: Record<string, unknown>;
      vel?: [number, number, number];
      pickupDelay?: number;
    };

/** Действие игрока-реплики над сущностями — исполняет владелец измерения (net/sim). */
export type NetEntityAction =
  | { a: "spawn"; snap: NetEntitySnap }
  | { a: "hurt"; id: number; damage: number; from: [number, number, number] }
  | { a: "explode"; x: number; y: number; z: number; power: number }
  /** Игрок-реплика поменял сущность действием (остриг, оседлал, назвал, поторговал): только поля, что изменились. */
  | { a: "patch"; id: number; fields: Record<string, unknown> }
  /** Образ погиб у реплики (/kill, рыба в ведро): drops — смерть с дропом, иначе просто исчезла. */
  | { a: "kill"; id: number; drops: boolean }
  /** Сел (on) или слез: пока сидит, сущность ведёт он сам. */
  | { a: "ride"; id: number; on: boolean }
  /** Поза сущности, которую ведёт реплика. */
  | {
      a: "drive";
      id: number;
      pos: [number, number, number];
      vel: [number, number, number];
      yaw: number;
    };

/** Бит «на ней кто-то сидит» во флагах позы сущности (net/protocol ENT_POSE). */
const POSE_RIDDEN = 128;

/**
 * Поля сущности, которые меняет ДЕЙСТВИЕ игрока, а не мозг: их реплика отдаёт владельцу измерения.
 * Любовь и лечение — флагами: сами таймеры тикают у владельца, реплика лишь сообщает «накормил».
 */
function interactState(e: Entity): Record<string, unknown> | null {
  if (e.kind === "minecart") return e.items.length ? { items: e.items } : null;
  if (e.kind !== "mob") return null;
  return {
    sheared: e.sheared,
    tamed: e.tamed,
    sitting: e.sitting,
    saddled: e.saddled,
    woolColor: e.woolColor,
    wolfArmor: e.wolfArmor,
    carry: e.carry ? e.carry.item : null,
    bag: e.bag,
    items: e.items,
    leashed: e.leashed,
    leashPost: e.leashPost,
    leashMob: e.leashMobId !== null,
    love: e.loveT > 0,
    cure: e.curing > 0,
    name: e.customName,
    uses: e.uses,
    traded: e.traded,
    villagerXp: e.villagerXp,
  };
}

export class EntityManager {
  /**
   * Сетевая игра: другие игроки в этом измерении (у владельца измерения). Мобы выбирают ближайшего,
   * предмет подбирает ближайший, взрыв бьёт всех — у удалённого игрока урон уходит ему по сети.
   */
  others: () => Actor[] = () => [];
  /**
   * Реплика (net/sim): сущности живут у владельца измерения, здесь только их образ — без тика,
   * без спавна по событиям. То, что создаёт ДЕЙСТВИЕ этого игрока (бросил предмет, выстрелил),
   * уходит владельцу через `onLocalSpawn`, а удар и взрыв — через `onRemoteAction`.
   */
  replica = false;
  onLocalSpawn: ((snap: NetEntitySnap) => void) | null = null;
  onRemoteAction: ((a: NetEntityAction) => void) | null = null;
  /** Реплика: куда сущность должна прийти по последнему снимку владельца (сглаживание). */
  private readonly _netTargets = new Map<
    number,
    { x: number; y: number; z: number; yaw: number }
  >();
  /** Идёт применение сетевого снимка: спавн регистрируется здесь, а не уходит владельцу. */
  private _netApplying = false;
  /** Сетевая игра: слот своего игрока (поводок держит конкретный игрок); null — одиночная игра. */
  localSlot: number | null = null;
  /** Реплика: состояние взаимодействия образов по последнему слову владельца (см. interactState). */
  private readonly _netBase = new Map<number, string>();
  /** Реплика: сущность, в которой сидит свой игрок, — её ведёт он сам, позы владельца не слушает. */
  drivenId: number | null = null;
  /** Владелец: сущности, которые ведут игроки-реплики (не тикают здесь): id → слот и время позы. */
  private readonly _netDriven = new Map<number, { slot: number; t: number }>();

  scene: THREE.Scene;
  world: ChunkManager;
  atlas: TextureAtlas;
  player: Player;
  inventory: Inventory;
  entities: Map<number, Entity>;
  _nextId: number;
  _spawnTimer: number;
  /** На сколько уровней ночь гасит небесный свет и день ли сейчас — задаёт Game из DayNight. */
  skyDarken = 0;
  isDay = true;
  /** Идёт дождь (Game из systems/Weather). */
  raining = false;
  /** Игрок не спал три ночи — прилетают фантомы (Game.daysAwake). */
  insomnia = false;
  /** Пока новичок учится бою, обычный спавн даёт одного слабого врага за раз. */
  beginnerCombat = false;
  /** Секунд до следующего патруля мародёров. */
  private _patrolT = 300 + Math.random() * 300;

  constructor(
    scene: THREE.Scene,
    world: ChunkManager,
    atlas: TextureAtlas,
    player: Player,
    inventory: Inventory,
  ) {
    this.scene = scene;
    this.world = world;
    this.atlas = atlas;
    this.player = player;
    this.inventory = inventory;
    this.entities = new Map();
    this._nextId = 1;
    this._spawnTimer = 0;
    // TNT, подожжённый огнём (поведение огня не знает про сущности — просит событием)
    events.on(
      "tntPrime",
      (d: { x: number; y: number; z: number; fuse?: number }) =>
        this.spawnTnt(d.x + 0.5, d.y, d.z + 0.5, d.fuse ?? 4),
    );
    // вагонетку поставили на рельс (предмет minecart — world/behaviours/rails)
    events.on(
      "spawnMinecart",
      (d: { x: number; y: number; z: number; variant?: CartVariant }) =>
        this.spawnMinecart(d.x + 0.5, d.y, d.z + 0.5, d.variant),
    );
    events.on(
      "spawnBoat",
      (d: { x: number; y: number; z: number; wood: string }) =>
        this.spawnBoat(d.x + 0.5, d.y, d.z + 0.5, d.wood),
    );
    // из заражённого блока вылезает чешуйница (registry/blocks/infested)
    events.on(
      "blockBreak",
      (d: { x: number; y: number; z: number; id: number }) => {
        if (INFESTED_IDS.has(d.id) && MOBS.silverfish)
          this.spawnMob("silverfish", d.x + 0.5, d.y, d.z + 0.5);
      },
    );
    // мёд собрали — пчёлы в 16 блоках от улья злятся
    events.on("hiveHarvest", (d: { x: number; y: number; z: number }) => {
      if (smokedHive(this.world, d.x, d.y, d.z)) return; // дым костра под ульем их успокаивает
      for (const e of this.entities.values())
        if (
          e.kind === "mob" &&
          e.def.bee &&
          !e.dead &&
          e.pos.distanceTo(new THREE.Vector3(d.x, d.y, d.z)) < 16
        )
          e.aggro = true;
    });
    // черепашье яйцо вылупилось (world/behaviours/ocean); выросший черепашонок роняет щиток
    events.on("turtleHatch", (d: { x: number; y: number; z: number }) => {
      if (MOBS.turtle) this.spawnMob("turtle", d.x + 0.5, d.y, d.z + 0.5, true);
    });
    events.on("mobGrew", ({ entity }: { entity: Mob }) => {
      const item = entity.def.growDrop;
      if (item && ITEMS[item])
        this.spawnDrop(entity.pos.x, entity.pos.y + 0.3, entity.pos.z, item, 1);
    });
    // яйцо нюхача треснуло — детёныш нюхача
    events.on("snifferHatch", (d: { x: number; y: number; z: number }) => {
      if (MOBS.sniffer)
        this.spawnMob("sniffer", d.x + 0.5, d.y, d.z + 0.5, true);
    });
    // лягушачья икра — 2–6 головастиков в воду под ней; головастик вырос — лягушка по биому
    events.on("frogspawnHatch", (d: { x: number; y: number; z: number }) => {
      if (!MOBS.tadpole) return;
      for (let i = randInt(2, 6); i > 0; i--)
        this.spawnMob(
          "tadpole",
          d.x + 0.3 + Math.random() * 0.4,
          d.y - 0.8,
          d.z + 0.3 + Math.random() * 0.4,
        );
    });
    events.on("mobMature", ({ entity }: { entity: Mob }) => {
      const into =
        entity.def.growsInto === "frog"
          ? frogFor(this.world.generator.biomeOf?.(entity.pos.x, entity.pos.z))
          : entity.def.growsInto;
      if (!into || !MOBS[into] || entity.dead) return;
      this.spawnMob(into, entity.pos.x, entity.pos.y, entity.pos.z);
      entity.dead = true; // hp > 0 — без дропа: превратился
    });
    // третий пепельный череп на Т из песка душ — Пепельный владыка (entities/AshLord)
    events.on(
      "blockPlace",
      (d: { x: number; y: number; z: number; id: number }) => {
        if (d.id === B.ash_skull) this.summonAtAltar(d.x, d.y, d.z);
        if (d.id === B.pumpkin)
          // тыква достраивает снеговика или железного голема (systems/Golem)
          if (!this.buildSnowGolem(d.x, d.y, d.z))
            this.buildIronGolem(d.x, d.y, d.z);
      },
    );
    // ручные волки: на того, кого бьёт игрок, и на того, кто бьёт игрока
    events.on("playerHitMob", ({ entity }: { entity: Mob }) => {
      this.guard(entity);
      this.villageAnger(entity);
    });
    // деревня помнит добро: торговля и вылеченный зомби-житель поднимают репутацию
    events.on("trade", () => this._addRep(REP_TRADE));
    events.on("villagerCured", () => this._addRep(REP_CURE));
    // колокол: налётчики вокруг светятся, как в Minecraft
    events.on("bellRing", (p: { x: number; y: number; z: number }) =>
      this.markRaiders(p.x, p.y, p.z),
    );
    events.on("mobAttack", ({ entity }: { entity: Mob }) => this.guard(entity));
  }

  /**
   * Единственная точка регистрации новой сущности. У реплики (net/sim) сущность, созданная
   * действием игрока, здесь НЕ живёт: после того как вызвавший её донастроит (скорость брошенного
   * предмета, эффект стрелы — это делается сразу после spawn*), её снимок уходит владельцу
   * измерения, а тот разошлёт настоящую. Исключения живут у реплики сами: поплавок (рыбалка —
   * своя) и жемчуг Предела (переносит бросившего, а не владельца измерения).
   */
  private _register<T extends Entity>(e: T, ...objects: THREE.Object3D[]): T {
    const ownLocal =
      e.kind === "hook" || (e.kind === "fireball" && e.ballKind === "pearl");
    if (this.replica && !this._netApplying && !ownLocal) {
      queueMicrotask(() => {
        const snap = this.netSnapshot(e);
        if (snap) this.onLocalSpawn?.(snap);
      });
      return e;
    }
    this.entities.set(e.id, e);
    if (objects.length) this.scene.add(...objects);
    return e;
  }

  /** Убрать всех враждебных мобов (переход на мирную сложность — systems/Difficulty). */
  clearHostiles(): void {
    for (const e of this.entities.values())
      if (e.kind === "mob" && e.def.category === "hostile" && !e.def.boss)
        e.dead = true; // hp > 0 — исчезают без дропа, как при удалении игрока
  }

  /** Сдвинуть репутацию игрока в деревне и сказать об этом HUD. */
  private _addRep(by: number): void {
    this.player.villageRep = clampRep(this.player.villageRep + by);
    events.emit("villageRep", { rep: this.player.villageRep });
  }

  /**
   * Ударили жителя: репутация падает, а железные големы рядом бросаются на обидчика — как в
   * Minecraft, где деревня помнит зло (systems/Reputation).
   */
  villageAnger(target: Mob): void {
    if (!target.def.trades || target.dead) return;
    this._addRep(REP_HIT_VILLAGER);
    for (const e of this.entities.values())
      if (
        e.kind === "mob" &&
        !e.dead &&
        e.def.name === "iron_golem" &&
        e.pos.distanceTo(target.pos) < GOLEM_RADIUS
      )
        e.aggro = true;
  }

  /** Звон колокола: налётчики в 32 блоках светятся 3 секунды (видно сквозь стены). */
  markRaiders(x: number, y: number, z: number): void {
    const at = new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5);
    for (const e of this.entities.values())
      if (e.kind === "mob" && !e.dead && e.raider && e.pos.distanceTo(at) < 32)
        e.glowT = 3;
  }

  /** Череп в (x,y,z) достроил алтарь — блоки исчезают, встаёт владыка и набирает силу. */
  summonAtAltar(x: number, y: number, z: number): Mob | null {
    const a = findAltar(
      (bx, by, bz) => this.world.getBlock(bx, by, bz),
      x,
      y,
      z,
    );
    if (!a || !MOBS.ash_lord) return null;
    for (const [cx, cy, cz] of a.cells) this.world.setBlock(cx, cy, cz, B.air!);
    const m = this.spawnMob("ash_lord", a.x, a.y, a.z);
    startCharge(m);
    events.emit("ashLordSummoned", { x: a.x, y: a.y, z: a.z });
    return m;
  }

  /** Железный голем: тыква на фигуре из четырёх железных блоков — блоки исчезают, встаёт голем. */
  buildIronGolem(x: number, y: number, z: number): Mob | null {
    const get = (bx: number, by: number, bz: number) =>
      this.world.getBlock(bx, by, bz);
    if (!MOBS.iron_golem || !isIronGolem(get, x, y, z)) return null;
    const armsX = get(x - 1, y - 1, z) === B.iron_block;
    for (const [cx, cy, cz] of [
      [x, y, z],
      [x, y - 1, z],
      [x, y - 2, z],
      armsX ? [x - 1, y - 1, z] : [x, y - 1, z - 1],
      armsX ? [x + 1, y - 1, z] : [x, y - 1, z + 1],
    ] as [number, number, number][])
      this.world.setBlock(cx, cy, cz, B.air!);
    const m = this.spawnMob("iron_golem", x + 0.5, y - 2, z + 0.5);
    events.emit("ironGolemBuilt", { x, y, z });
    return m;
  }

  /** Снеговик: тыква на двух блоках снега — блоки исчезают, на их месте снеговик. */
  buildSnowGolem(x: number, y: number, z: number): Mob | null {
    if (
      !MOBS.snow_golem ||
      !isSnowGolem((bx, by, bz) => this.world.getBlock(bx, by, bz), x, y, z)
    )
      return null;
    for (let k = 0; k < 3; k++) this.world.setBlock(x, y - k, z, B.air!);
    const m = this.spawnMob("snow_golem", x + 0.5, y - 2, z + 0.5);
    events.emit("snowGolemBuilt", { x, y, z });
    return m;
  }

  /** Клыки ворожея: 16 штук по прямой от from к to через 1.25 блока, каждый позже предыдущего. */
  spawnFangs(from: THREE.Vector3, to: THREE.Vector3, ownerId: number): void {
    const dir = to.clone().sub(from).setY(0);
    const len = dir.length();
    if (len < 1e-3) return;
    dir.divideScalar(len);
    for (let i = 1; i <= 16; i++) {
      const x = from.x + dir.x * i * 1.25,
        z = from.z + dir.z * i * 1.25;
      // пол у линии: твёрдый блок в нескольких блоках от высоты ворожея
      let y = Math.floor(from.y) + 2;
      for (
        let k = 0;
        k < 6 &&
        !BLOCKS[this.world.getBlock(Math.floor(x), y - 1, Math.floor(z))]
          ?.solid;
        k++
      )
        y--;
      const f = new Fang(this._nextId++, x, y, z, i * 0.05, ownerId);
      this._register(f, f.mesh);
    }
  }

  /** До следующей попытки прихода странствующего торговца, сек. */
  private _traderT = 1200;
  /** Перезарядка вызова железного голема деревней (systems/Golem). */
  private _golemT = 0;

  /** Странствующий торговец с двумя ламами на поводке — на суше в 16–32 блоках от игрока. */
  spawnWanderingTrader(): Mob | null {
    if (this.world.dimension !== "overworld" || !MOBS.wandering_trader)
      return null;
    const p = this.player.pos;
    for (let k = 0; k < 8; k++) {
      const a = Math.random() * Math.PI * 2,
        r = 16 + Math.random() * 16;
      const x = Math.floor(p.x + Math.cos(a) * r),
        z = Math.floor(p.z + Math.sin(a) * r);
      const top = this.world.surfaceY(x, z);
      const g = BLOCKS[this.world.getBlock(x, top, z)];
      if (
        !g?.solid ||
        g.liquid ||
        this.world.getBlock(x, top + 1, z) !== 0 ||
        this.world.getBlock(x, top + 2, z) !== 0
      )
        continue;
      const t = this.spawnMob("wandering_trader", x + 0.5, top + 1, z + 0.5);
      for (const dx of [-1.5, 1.5]) {
        const l = this.spawnMob("trader_llama", x + 0.5 + dx, top + 1, z + 0.5);
        l.leashed = true;
        l.leashMobId = t.id;
      }
      events.emit("traderArrived", { x, y: top + 1, z });
      return t;
    }
    return null;
  }

  /** Патруль мародёров: 2–5 во главе с капитаном на суше в 24–48 блоках от игрока. */
  spawnPatrol(): number {
    if (this.world.dimension !== "overworld" || !MOBS.marauder) return 0;
    const p = this.player.pos;
    const a = Math.random() * Math.PI * 2,
      r = 24 + Math.random() * 24;
    const x = Math.floor(p.x + Math.cos(a) * r),
      z = Math.floor(p.z + Math.sin(a) * r);
    const top = this.world.surfaceY(x, z);
    if (
      !BLOCKS[this.world.getBlock(x, top, z)]?.solid ||
      this.world.getBlock(x, top + 1, z) !== 0
    )
      return 0;
    const n = randInt(2, 5);
    for (let i = 0; i < n; i++) {
      const sx = x + (i ? randInt(-2, 2) : 0),
        sz = z + (i ? randInt(-2, 2) : 0);
      const m = this.spawnMob(
        "marauder",
        sx + 0.5,
        this.world.surfaceY(sx, sz) + 1.01,
        sz + 0.5,
      );
      if (i === 0) m.captain = true;
    }
    events.emit("patrolSpawned", { x, z, n });
    return n;
  }

  /** Черепаха после размножения откладывает 1–4 яйца на песок рядом. */
  layEggs(m: Mob): number {
    const egg = B[m.def.layEggs ?? ""];
    if (egg === undefined) return 0;
    // лягушка — одну икру на воду, нюхач — одно яйцо на любой твёрдый блок, черепаха — 1–4 яйца на песок
    const spawn = m.def.layEggs === "frogspawn",
      sniffer = m.def.layEggs === "sniffer_egg";
    const baseOk = (id: number): boolean =>
      spawn
        ? id === B.water
        : sniffer
          ? !!BLOCKS[id]?.solid && BLOCKS[id]?.shape === "cube"
          : id === B.sand;
    let left = spawn || sniffer ? 1 : randInt(1, 4);
    const x0 = Math.floor(m.pos.x),
      y0 = Math.floor(m.pos.y),
      z0 = Math.floor(m.pos.z);
    for (let dx = -2; dx <= 2 && left > 0; dx++)
      for (let dz = -2; dz <= 2 && left > 0; dz++)
        for (let dy = -1; dy <= 1 && left > 0; dy++) {
          const x = x0 + dx,
            y = y0 + dy,
            z = z0 + dz;
          if (
            !baseOk(this.world.getBlock(x, y - 1, z)) ||
            this.world.getBlock(x, y, z) !== B.air
          )
            continue;
          this.world.setBlock(x, y, z, egg, 0);
          left--;
        }
    events.emit("eggsLaid", { entity: m });
    return left;
  }

  /** Вода в квадрате r вокруг клетки (на её высоте и выше на блок) — пляж, а не пустыня. */
  /** Есть ли блок id в кубе радиуса r (аксолотль — мох пышных пещер рядом с озером). */
  private _blockNear(
    x: number,
    y: number,
    z: number,
    id: number | undefined,
    r: number,
  ): boolean {
    if (id === undefined) return false;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++)
          if (this.world.getBlock(x + dx, y + dy, z + dz) === id) return true;
    return false;
  }

  private _waterNear(x: number, y: number, z: number, r: number): boolean {
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++)
        for (let dy = 0; dy <= 1; dy++)
          if (this.world.getBlock(x + dx, y + dy, z + dz) === B.water)
            return true;
    return false;
  }

  /** Выпустить пчелу из улья (x,y,z) в свободную соседнюю клетку; false — места нет. */
  spawnBee(x: number, y: number, z: number): boolean {
    for (const [dx, dy, dz] of [
      [0, 0, -1],
      [1, 0, 0],
      [0, 0, 1],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
    ] as const) {
      if (this.world.getBlock(x + dx, y + dy, z + dz) !== 0) continue;
      const b = this.spawnMob("bee", x + dx + 0.5, y + dy + 0.1, z + dz + 0.5);
      b.home = [x, y, z];
      return true;
    }
    return false;
  }

  /** Ручные волки рядом с игроком (24 блока) бросаются на `target`. */
  guard(target: Mob): void {
    if (target.tamed || target.dead) return;
    for (const e of this.entities.values())
      if (
        e.kind === "mob" &&
        e !== target &&
        e.tamed &&
        e.def.guards &&
        !e.sitting &&
        !e.dead &&
        e.pos.distanceTo(this.player.pos) < 24
      )
        e.targetId = target.id;
  }

  /** Груз вагонетки как контейнер (воронка под рельсом и в вагонетку, экран сундука). */
  /** Груз вагонетки или вьюк моба — как контейнер для экрана сундука. */
  cartBox(c: Minecart | Mob): BlockEntity {
    return {
      type:
        c.kind === "minecart" && c.variant === "hopper" ? "hopper" : "chest",
      x: Math.floor(c.pos.x),
      y: Math.floor(c.pos.y),
      z: Math.floor(c.pos.z),
      state: { items: c.items },
    };
  }

  /** Вагонетка с грузом в клетке (x, y, z) — как контейнер; null — нет такой. */
  cartItems(x: number, y: number, z: number): BlockEntity | null {
    for (const e of this.entities.values())
      if (
        e.kind === "minecart" &&
        !e.dead &&
        e.items.length &&
        Math.floor(e.pos.x) === x &&
        Math.floor(e.pos.y) === y &&
        Math.floor(e.pos.z) === z
      )
        return this.cartBox(e);
    return null;
  }

  /**
   * Работа вагонетки за тик: динамит взрывается, запитанные активирующие рельсы высаживают седока и
   * запирают воронку; вагонетка с воронкой берёт из контейнера над собой или лежащие рядом предметы.
   */
  private _cartWork(c: Minecart, dt: number): void {
    if (c.boom) {
      c.dead = true;
      this.explode(c.pos.x, c.pos.y + 0.5, c.pos.z, 4);
      return;
    }
    if (c.onActivator && c.rider && this.player.riding === c)
      this.player.dismount();
    if (c.variant !== "hopper" || c.onActivator) return;
    c.hopCd -= dt;
    if (c.hopCd > 0) return;
    c.hopCd = HOPPER_COOLDOWN;
    const box = this.cartBox(c);
    const into = (s: ItemStack) => insertOne(box, s, "top");
    const above = this.world.containerAt?.(box.x, box.y + 1, box.z);
    if (above) extractOne(above, into);
    else
      this.takeDrop(
        c.pos.x - 0.7,
        c.pos.y - 0.2,
        c.pos.z - 0.7,
        c.pos.x + 0.7,
        c.pos.y + 1.2,
        c.pos.z + 0.7,
        into,
      );
  }

  spawnMinecart(
    x: number,
    y: number,
    z: number,
    variant: CartVariant = "plain",
  ): Minecart {
    const c = new Minecart(this._nextId++, x, y, z, variant);
    return this._register(c, c.mesh);
  }

  spawnBoat(x: number, y: number, z: number, wood: string): Boat {
    const b = new Boat(this._nextId++, x, y, z, wood);
    return this._register(b, b.mesh);
  }

  /** Забросить поплавок игрока (прежний, если был, исчезает). */
  castHook(pos: THREE.Vector3, vel: THREE.Vector3): FishingHook {
    const old = this.playerHook();
    if (old) old.dead = true;
    const h = new FishingHook(this._nextId++, pos, vel);
    return this._register(h, h.mesh, h.line);
  }

  /** Поплавок игрока в мире или null. */
  playerHook(): FishingHook | null {
    for (const e of this.entities.values())
      if (e.kind === "hook" && !e.dead) return e;
    return null;
  }

  /** Луч по транспорту (вагонетки, лодки): ближайший и расстояние до него. */
  raycastRide(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    maxDist: number,
  ): { cart: Minecart | Boat; t: number } | null {
    let best: { cart: Minecart | Boat; t: number } | null = null;
    for (const e of this.entities.values()) {
      // своя вагонетка или лодка (в ней сидит игрок) лучу не мешает
      if ((e.kind !== "minecart" && e.kind !== "boat") || e.dead || e.rider)
        continue;
      const hw = e.kind === "boat" ? 0.7 : 0.49;
      const t = rayBox(
        origin,
        dir,
        best ? best.t : maxDist,
        { x: e.pos.x - hw, y: e.pos.y, z: e.pos.z - hw },
        {
          x: e.pos.x + hw,
          y: e.pos.y + (e.kind === "boat" ? 0.6 : 0.7),
          z: e.pos.z + hw,
        },
      );
      if (t !== null) best = { cart: e, t };
    }
    return best;
  }

  // ---- появление ------------------------------------------------------------------------

  spawnDrop(
    x: number,
    y: number,
    z: number,
    item: string,
    count: number,
    dmg?: number,
    tag?: Record<string, unknown>,
  ): ItemDrop {
    // слияние с ближайшим таким же дропом (инструменты с износом и вещи с tag не сливаются). У реплики
    // (net/sim) не сливаем и не вытесняем: её дропы — образы чужих, решает владелец измерения.
    const mergeable =
      !this.replica && !dmg && !tag && (ITEMS[item]?.maxStack ?? 64) > 1;
    for (const e of mergeable ? this.entities.values() : []) {
      if (
        e.kind === "drop" &&
        e.item === item &&
        !e.dead &&
        !e.dmg &&
        e.pos.distanceToSquared({ x, y, z }) < CONFIG.drops.mergeRadius ** 2
      ) {
        e.count += count;
        return e;
      }
    }
    // лимит: убиваем самый старый дроп (уже помеченные на удаление не считаем)
    const drops = this.replica
      ? []
      : [...this.entities.values()].filter(
          (e): e is ItemDrop => e.kind === "drop" && !e.dead,
        );
    if (drops.length >= CONFIG.drops.maxCount)
      drops.sort((a, b) => b.age - a.age)[0]!.dead = true;
    const drop = new ItemDrop(this._nextId++, this.atlas, x, y, z, item, count);
    if (dmg) drop.dmg = dmg;
    if (tag) drop.tag = tag;
    return this._register(drop, drop.mesh);
  }

  /** Воронка: забрать из лежащего в коробке дропа один предмет, если accept его взял. */
  takeDrop(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    accept: (s: ItemStack) => boolean,
  ): boolean {
    for (const e of this.entities.values()) {
      if (e.kind !== "drop" || e.dead) continue;
      const p = e.pos;
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1 || p.z < z0 || p.z > z1)
        continue;
      if (!accept({ item: e.item, count: 1, ...(e.dmg ? { dmg: e.dmg } : {}) }))
        continue;
      e.count -= 1;
      if (e.count <= 0) e.dead = true;
      return true;
    }
    return false;
  }

  /** Выбрасыватель: стак со скоростью, поднять можно не сразу. */
  ejectItem(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    s: ItemStack,
  ): void {
    const d = this.spawnDrop(x, y, z, s.item, s.count, s.dmg, s.tag);
    d.vel.set(vx, vy, vz);
    d.pickupDelay = 1;
  }

  /** Раздатчик: стрела без стрелка; отравленная несёт свой эффект (systems/TippedArrow). */
  shootArrow(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    item = "arrow",
  ): void {
    const a = this.spawnArrow(
      new THREE.Vector3(x, y, z),
      new THREE.Vector3(vx, vy, vz),
      3,
      false,
      -1,
    );
    if (item !== "arrow") {
      a.effect = tippedEffect(item);
      a.pick = { item, count: 1 };
    }
  }

  spawnMob(type: string, x: number, y: number, z: number, baby = false): Mob {
    const mob = new Mob(this._nextId++, MOBS[type]!, x, y, z, baby);
    return this._register(mob, mob.mesh);
  }

  /** Опыт сферами (крупные номиналы, как в Minecraft), не больше 10 сфер. */
  spawnXp(x: number, y: number, z: number, amount: number): void {
    let left = Math.round(amount);
    for (let n = 0; left > 0 && n < 10; n++) {
      const v =
        n === 9 ? left : left >= 17 ? 17 : left >= 7 ? 7 : left >= 3 ? 3 : 1;
      const orb = new XpOrb(this._nextId++, x, y, z, v);
      this._register(orb, orb.mesh);
      left -= v;
    }
  }

  spawnArrow(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    damage: number,
    fromPlayer: boolean,
    shooterId: number,
  ): Arrow {
    const a = new Arrow(
      this._nextId++,
      pos,
      vel,
      damage,
      fromPlayer,
      shooterId,
    );
    return this._register(a, a.mesh);
  }

  /** Огненный шар моба Пекла. */
  spawnFireball(
    kind: FireballKind,
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    damage: number,
    shooterId: number,
  ): Fireball {
    const f = new Fireball(this._nextId++, kind, pos, vel, damage, shooterId);
    return this._register(f, f.mesh);
  }

  /** Брошенное Око Предела — летит к цели (цитадели). */
  spawnRimEye(from: THREE.Vector3, target: { x: number; z: number }): RimEye {
    const e = new RimEye(this._nextId++, from, target);
    this._register(e, e.mesh);
    events.emit("eyeThrown", { x: from.x, y: from.y, z: from.z });
    return e;
  }

  /** Ударили моба со стайной злостью — злятся все такие же в 32 блоках. */
  private _angerGroup(m: Mob): void {
    m.angerCall = false;
    for (const e of this.entities.values())
      if (
        e.kind === "mob" &&
        !e.dead &&
        e.def.name === m.def.name &&
        e.pos.distanceTo(m.pos) < 32
      )
        e.aggro = true;
  }

  /** Взведённая взрывчатка (огниво, огонь, соседний взрыв). */
  spawnTnt(x: number, y: number, z: number, fuse: number): PrimedTnt {
    const t = new PrimedTnt(this._nextId++, this.atlas, x, y, z, fuse);
    this._register(t, t.mesh);
    events.emit("tntFuse", { x, y, z });
    return t;
  }

  /**
   * Удар игрока по мобу. `attacker` — кто бил (сетевая игра: удалённый игрок; по умолчанию свой).
   * У реплики (net/sim) удар уходит владельцу измерения — моб живёт там.
   */
  hurt(
    entityId: number,
    damage: number,
    fromPos: THREE.Vector3,
    attacker: Player = this.player,
  ): void {
    if (this.replica && !this._netApplying) {
      this.onRemoteAction?.({
        a: "hurt",
        id: entityId,
        damage,
        from: [fromPos.x, fromPos.y, fromPos.z],
      });
      return;
    }
    const e = this.entities.get(entityId);
    if (!e || e.kind !== "mob" || e.dead) return;
    // дракон: по голове — полный урон, по телу — четверть (как в Minecraft)
    if (e.def.boss === "dragon" && !this._headHit(e, attacker))
      damage = Math.max(1, damage / 4);
    e.hurt(damage, fromPos, true);
    // шипы глубинника: бьёшь, пока он не заряжает луч, — укол в ответ
    if (e.def.thorns && e.beamT <= 0) attacker.damage(e.def.thorns, "thorns");
  }

  /** Луч взгляда игрока проходит у головы дракона (перед центром, на половине ширины). */
  private _headHit(m: Mob, who: Player = this.player): boolean {
    const fwd = new THREE.Vector3(-Math.sin(m.yaw), 0, -Math.cos(m.yaw));
    const head = m.pos
      .clone()
      .addScaledVector(fwd, m.width * 0.5)
      .setY(m.pos.y + m.height * 0.6);
    const eye = who.eyePos,
      dir = who.lookDir();
    const t = Math.max(0, head.clone().sub(eye).dot(dir));
    return eye.clone().addScaledVector(dir, t).distanceTo(head) < 2.5;
  }

  // ---- взрыв -------------------------------------------------------------------------------

  /** Взрыв силы power: блоки (дроп с шансом 1/сила), урон и отброс игроку, мобам и предметам. */
  explode(x: number, y: number, z: number, power: number): void {
    // реплика (net/sim): взрыв от действия игрока (кровать в Пекле) считает владелец измерения
    if (this.replica && !this._netApplying) {
      this.onRemoteAction?.({ a: "explode", x, y, z, power });
      return;
    }
    const destroyed = explodeBlocks(this.world, x, y, z, power);
    for (const b of destroyed)
      // соседняя взрывчатка взводится с коротким фитилём — цепная реакция
      if (b.id === B.tnt)
        this.spawnTnt(b.x + 0.5, b.y, b.z + 0.5, 0.5 + Math.random());
      else if (Math.random() < 1 / power)
        for (const d of dropsOf(BLOCKS[b.id]!, b.meta))
          if (ITEMS[d.item])
            this.spawnDrop(b.x + 0.5, b.y + 0.5, b.z + 0.5, d.item, d.n);

    const center = new THREE.Vector3(x, y, z);
    const R = power * 2;
    const blast = (
      pos: THREE.Vector3,
      h: number,
      apply: (dmg: number, dir: THREE.Vector3, impact: number) => void,
    ) => {
      const c = new THREE.Vector3(pos.x, pos.y + h / 2, pos.z);
      const dist = c.distanceTo(center);
      if (dist >= R) return;
      const dir = c.clone().sub(center);
      const len = dir.length();
      if (len > 1e-4) dir.divideScalar(len);
      else dir.set(0, 1, 0);
      const exposure =
        len > 1e-4 && raycastBlocks(this.world, center, dir, len) ? 0.3 : 1;
      const impact = (1 - dist / R) * exposure;
      apply(explosionDamage(impact, power), dir, impact);
    };
    // все игроки измерения: у удалённого урон и отброс уйдут ему по сети (net/RemotePlayer)
    for (const { player } of this.actors())
      blast(player.pos, 1.8, (dmg, dir, impact) => {
        player.damage(dmg, "explosion");
        player.vel.addScaledVector(dir, impact * 12);
      });
    for (const e of this.entities.values()) {
      if (e.kind === "mob" && !e.dead)
        blast(e.pos, e.height, (dmg, dir, impact) => {
          e.hurt(dmg, center, false);
          e.vel.addScaledVector(dir, impact * 12);
        });
      else if (e.kind === "drop" || e.kind === "tnt")
        blast(e.pos, 0.5, (_d, dir, impact) =>
          e.vel.addScaledVector(dir, impact * 10),
        );
    }
    events.emit("explosion", { x, y, z, power });
  }

  // ---- симуляция ----------------------------------------------------------------------------

  private _ctx(): MobCtx {
    const held = this.inventory.heldItem();
    return {
      world: this.world,
      player: this.player,
      isDay: this.isDay,
      skyDarken: this.skyDarken,
      raining: this.raining,
      heldItem: held ? held.item : null,
      shoot: (from, to, speed, damage, shooter, kind = "arrow") => {
        if (kind !== "arrow" && kind !== "potion" && kind !== "snowball") {
          // огненный шар летит по прямой — без поправки на падение
          const dir = to.clone().sub(from).normalize();
          this.spawnFireball(
            kind,
            from.clone().addScaledVector(dir, 0.8),
            dir.multiplyScalar(speed),
            damage,
            shooter.id,
          );
          events.emit("mobShoot", { entity: shooter });
          return;
        }
        const d = to.clone().sub(from);
        const dist = d.length();
        const t = dist / speed;
        d.y += 0.5 * 20 * t * t; // поправка на падение стрелы
        d.x += (Math.random() - 0.5) * dist * 0.08;
        d.z += (Math.random() - 0.5) * dist * 0.08;
        d.normalize();
        if (kind === "potion" || kind === "snowball")
          // зелье ведьмы и снежок снеговика — дугой, как стрела (та же поправка на падение)
          this.spawnFireball(
            kind,
            from.clone().addScaledVector(d, 0.6),
            d.clone().multiplyScalar(speed),
            damage,
            shooter.id,
          );
        else
          this.spawnArrow(
            from.clone().addScaledVector(d, 0.6),
            d.clone().multiplyScalar(speed),
            damage,
            false,
            shooter.id,
          ).effect = shooter.def.ranged?.effect ?? null; // стрела зимогора замедляет
        events.emit("mobShoot", { entity: shooter });
      },
      convert: (villager) => this.convertToZombie(villager),
      crystals: () => {
        const out: Mob[] = [];
        for (const e of this.entities.values())
          if (e.kind === "mob" && !e.dead && e.def.name === "beyond_crystal")
            out.push(e);
        return out;
      },
      explode: (x, y, z, p) => this.explode(x, y, z, p),
      summon: (type, x, y, z) =>
        MOBS[type] ? this.spawnMob(type, x, y, z) : null,
      fangs: (from, to, owner) => this.spawnFangs(from, to, owner.id),
      // владыка ломает блоки вокруг себя — с дропом; неломаемые (бедрок, порталы) и жидкости стоят
      breakBlock: (x, y, z) => {
        const id = this.world.getBlock(x, y, z);
        const def = BLOCKS[id];
        if (!id || !def || def.liquid || !Number.isFinite(def.hardness))
          return false;
        const meta = this.world.getMeta(x, y, z);
        this.world.setBlock(x, y, z, B.air!);
        for (const d of dropsOf(def, meta))
          if (ITEMS[d.item])
            this.spawnDrop(x + 0.5, y + 0.5, z + 0.5, d.item, d.n);
        return true;
      },
      mob: (id) => {
        const e = this.entities.get(id);
        return e && e.kind === "mob" && !e.dead ? e : null;
      },
      near: (pos, r, pred) => {
        for (const e of this.entities.values())
          if (
            e.kind === "mob" &&
            !e.dead &&
            e.pos.distanceTo(pos) < r &&
            pred(e)
          )
            return e;
        return null;
      },
      nearDrop: (pos, r, item) => {
        let best: ItemDrop | null = null,
          bd = r * r;
        for (const e of this.entities.values()) {
          if (
            e.kind !== "drop" ||
            e.dead ||
            e.item !== item ||
            e.age < e.pickupDelay
          )
            continue;
          const d2 = e.pos.distanceToSquared(pos);
          if (d2 < bd) {
            bd = d2;
            best = e;
          }
        }
        return best ? { id: best.id, pos: best.pos } : null;
      },
      takeDrop: (id, max) => {
        const e = this.entities.get(id);
        if (!e || e.kind !== "drop" || e.dead) return 0;
        const n = Math.min(max, e.count);
        e.count -= n;
        if (e.count <= 0) e.dead = true;
        return n;
      },
      giveDrop: (x, y, z, item, count) => {
        this.spawnDrop(x, y, z, item, count);
      },
      findMate: (m) => {
        let best: Mob | null = null,
          bd = 64;
        for (const e of this.entities.values()) {
          if (e.kind !== "mob" || e === m || e.dead || e.baby) continue;
          // своя порода или указанная в mates (лошадь и осёл)
          if ((e.def !== m.def && !m.def.mates?.[e.def.name]) || e.loveT <= 0)
            continue;
          const d2 = e.pos.distanceToSquared(m.pos);
          if (d2 < bd) {
            bd = d2;
            best = e;
          }
        }
        return best;
      },
      breed: (a, b) => {
        a.loveT = b.loveT = 0;
        a.breedCd = b.breedCd = 300; // 5 минут, как в Minecraft
        if (a.def.layEggs)
          this.layEggs(a); // черепаха — яйцами на песок
        else
          this.spawnMob(
            // разные породы — детёныш из таблицы mates (лошадь + осёл → мул)
            a.def === b.def
              ? a.def.name
              : (a.def.mates?.[b.def.name] ?? a.def.name),
            (a.pos.x + b.pos.x) / 2,
            a.pos.y,
            (a.pos.z + b.pos.z) / 2,
            true,
          );
        this.spawnXp(a.pos.x, a.pos.y + 0.5, a.pos.z, randInt(1, 7));
        events.emit("mobBred", { type: a.def.name });
      },
    };
  }

  /** Все игроки этого измерения: свой и удалённые (сетевая игра). */
  actors(): Actor[] {
    const own: Actor = { player: this.player, inventory: this.inventory };
    const rest = this.others();
    return rest.length ? [own, ...rest] : [own];
  }

  /**
   * Ближайший к точке игрок: мобы целятся в него, предмет летит к нему. Живые впереди мёртвых —
   * иначе моб «застревал» бы на трупе, пока рядом бегает живой.
   */
  nearestActor(pos: { x: number; y: number; z: number }): Actor {
    const list = this.actors();
    if (list.length === 1) return list[0]!;
    let best = list[0]!,
      bd = Infinity;
    for (const a of list) {
      const p = a.player.pos;
      const d =
        (p.x - pos.x) ** 2 +
        (p.y - pos.y) ** 2 +
        (p.z - pos.z) ** 2 +
        (a.player.dead ? 1e12 : 0);
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    return best;
  }

  /**
   * Игрок для сущности: моба на поводке ведёт ТОТ, кто держит поводок (у двух игроков рядом моб
   * иначе шёл бы к ближайшему); остальным — ближайший.
   */
  private _actorFor(e: Entity): Actor {
    if (
      e.kind === "mob" &&
      e.leashed &&
      !e.leashPost &&
      e.leashMobId === null &&
      e.leashSlot !== null
    ) {
      if (e.leashSlot === this.localSlot)
        return { player: this.player, inventory: this.inventory };
      const held = this.others().find(
        (o) => (o.player as Player & { slot?: number }).slot === e.leashSlot,
      );
      if (held) return held;
    }
    return this.nearestActor(e.pos);
  }

  tick(dt: number): void {
    if (this.replica) {
      this._replicaTick(dt);
      return;
    }
    const ctx = this._ctx();
    const ownHeld = ctx.heldItem;
    const multi = this.others().length > 0;
    const mobs = [...this.entities.values()].filter(
      (e): e is Mob => e.kind === "mob",
    );
    const now = performance.now();
    for (const e of this.entities.values()) {
      // её ведёт игрок-реплика: позу шлёт он (netDrive); замолчал 3 с — снова наша
      const drv = this._netDriven.get(e.id);
      if (drv && !e.dead) {
        if (now - drv.t < 3000) continue;
        this._release(e.id);
      }
      const a = multi
        ? this._actorFor(e)
        : { player: this.player, inventory: this.inventory };
      if (e.kind === "drop") e.tick(dt, this.world, a.player, a.inventory);
      else if (e.kind === "mob") {
        if (multi) {
          ctx.player = a.player;
          ctx.heldItem =
            a.player === this.player
              ? ownHeld
              : (a.inventory.heldItem()?.item ?? null);
        }
        e.tick(dt, ctx);
        if (e.angerCall) this._angerGroup(e);
      } else if (e.kind === "xp") e.tick(dt, this.world, a.player);
      else if (e.kind === "tnt")
        e.tick(dt, this.world, (x, y, z, p) => this.explode(x, y, z, p));
      else if (e.kind === "fireball")
        e.tick(
          dt,
          this.world,
          a.player,
          (x, y, z, p) => this.explode(x, y, z, p),
          mobs,
        );
      else if (e.kind === "minecart" || e.kind === "boat") {
        e.tick(dt, this.world);
        if (e.kind === "minecart") this._cartWork(e, dt);
      } else if (e.kind === "hook")
        e.tick(
          dt,
          this.world,
          this.player.pos,
          this.raining,
          this.inventory.heldItem()?.item === "fishing_rod",
        );
      else if (e.kind === "rimeye") {
        // долетело: в 80% падает предметом, иначе разбивается
        if (e.tick(dt)) {
          if (Math.random() < 0.8)
            this.spawnDrop(e.pos.x, e.pos.y, e.pos.z, "rim_eye", 1);
          else
            events.emit("eyeShatter", { x: e.pos.x, y: e.pos.y, z: e.pos.z });
        }
      } else e.tick(dt, this.world, a.player, mobs, a.inventory);
      if (e.dead) {
        if (e.kind === "mob" && e.hp <= 0) this._mobDied(e);
        e.dispose(this.scene);
        this.entities.delete(e.id);
      }
    }
    this._census(dt);
  }

  /** Смерть моба: дроп по таблице (у детёнышей нет) и опыт, если бил игрок. */
  private _mobDied(m: Mob): void {
    events.emit("mobDied", { entity: m });
    // капитан мародёров от руки игрока — Дурное знамение, уровень растёт до 5 (как в Minecraft)
    if (m.captain && m.hitByPlayerT > 0) {
      const level = Math.min(
        5,
        (this.player.effects.get("bad_omen")?.level ?? 0) + 1,
      );
      this.player.addEffect("bad_omen", 6000, level);
      events.emit("badOmen", { level });
    }
    if (m.def.deathExplode) {
      // лечивший дракона кристалл, взорвавшись, ранит его на 10 (как в Minecraft)
      for (const e of this.entities.values())
        if (e.kind === "mob" && e.def.boss && e.healFrom === m.id) {
          e.healFrom = null;
          e.damage(10);
        }
      this.explode(m.pos.x, m.pos.y + 1, m.pos.z, m.def.deathExplode);
    }
    // слизень распадается на слизней поменьше
    const split = m.def.splitsInto;
    if (split)
      for (let i = randInt(split.n[0], split.n[1]); i > 0; i--)
        this.spawnMob(
          split.mob,
          m.pos.x + (Math.random() - 0.5) * m.width,
          m.pos.y + 0.2,
          m.pos.z + (Math.random() - 0.5) * m.width,
        );
    const drop = (item: string, n: number) => {
      if (n > 0 && ITEMS[item])
        this.spawnDrop(m.pos.x, m.pos.y + 0.3, m.pos.z, item, n);
    };
    if (!m.baby) {
      for (const d of m.def.drops) {
        if (d.chance !== undefined && Math.random() > d.chance) continue;
        drop(d.item, d.max ? randInt(d.n, d.max) : d.n);
      }
      const s = m.def.shearDrop;
      if (s && !m.sheared) drop(m.woolItem(), s.n);
      if (m.carry) drop(m.carry.item, 1 + m.bag); // дух-помощник роняет образец и собранное
      // вьюк: вещи и сам сундук; поводок
      if (m.items.length) {
        drop("chest", 1);
        // с износом и tag: зачарованная броня из вьюка не должна выпадать «чистой»
        for (const it of m.items)
          if (it && ITEMS[it.item])
            this.spawnDrop(
              m.pos.x,
              m.pos.y + 0.3,
              m.pos.z,
              it.item,
              it.count,
              it.dmg,
              it.tag,
            );
      }
      if (m.saddled) drop("saddle", 1); // седло с убитой лошади/свиньи — как в Minecraft
      if (m.leashed) drop("lead", 1);
      if (m.hitByPlayerT > 0 && m.def.xp)
        this.spawnXp(
          m.pos.x,
          m.pos.y + 0.5,
          m.pos.z,
          randInt(m.def.xp[0], m.def.xp[1]),
        );
    }
  }

  /**
   * Профессия от рабочего блока (systems/Jobs), раз в секунду: безработный житель занимает свободный
   * блок рядом и становится мастером; у кого рабочий блок сломали — теряет профессию, если ни разу
   * не торговал. Житель из деревни рабочего места не имеет и профессию не теряет, как в Minecraft.
   */
  private _villagerJobs(): void {
    const villagers: Mob[] = [];
    for (const e of this.entities.values())
      if (
        e.kind === "mob" &&
        !e.dead &&
        (e.def.name === "villager" || e.def.name.startsWith("villager_"))
      )
        villagers.push(e);
    if (!villagers.length) return;
    const claimed = villagers.flatMap((v) => (v.jobSite ? [v.jobSite] : []));
    const blockAt = (x: number, y: number, z: number): string =>
      BLOCKS[this.world.getBlock(x, y, z)]?.name ?? "air";
    for (const v of villagers) {
      const site = v.jobSite;
      if (v.def.trades) {
        // работа у своего блока пополняет товар (в Minecraft — дважды за день, здесь — по таймеру)
        if (site && v.uses.length) {
          v.workT -= 1;
          if (
            v.workT <= 0 &&
            Math.abs(v.pos.x - (site[0] + 0.5)) < 2.5 &&
            Math.abs(v.pos.z - (site[2] + 0.5)) < 2.5 &&
            Math.abs(v.pos.y - site[1]) < 3
          ) {
            v.uses = [];
            v.workT = VILLAGER_RESTOCK;
            events.emit("villagerRestock", { mob: v.def.name });
          }
        }
        // рабочий блок сломали или подменили — обратно в безработные (торговавший остаётся мастером)
        if (
          site &&
          !v.traded &&
          jobAt(blockAt(site[0], site[1], site[2])) !== v.def.trades
        )
          this._reprofess(v, "villager", null);
        continue;
      }
      const found = findJob(
        blockAt,
        Math.floor(v.pos.x),
        Math.floor(v.pos.y),
        Math.floor(v.pos.z),
        (x, y, z) =>
          claimed.some((c) => c[0] === x && c[1] === y && c[2] === z),
      );
      if (!found) continue;
      claimed.push(found.site);
      this._reprofess(v, "villager_" + found.job, found.site);
    }
  }

  /**
   * Деревня зовёт голема (systems/Golem): рядом с жителями враждебные (ночная осада) — раз в
   * GOLEM_COOLDOWN секунд встаёт один железный голем. Так деревня отвечает на осаду сама.
   */
  private _villagerGolem(): void {
    if (this._golemT > 0) {
      this._golemT -= 1;
      return;
    }
    // ⚠ кандидатов перебираем всех: в мире живёт не одна кучка жителей, и у соседней деревни свой
    // голем уже есть — по первому встречному жителю вызов не сработал бы никогда.
    const mobs: Mob[] = [];
    for (const e of this.entities.values())
      if (e.kind === "mob" && !e.dead) mobs.push(e);
    for (const host of mobs) {
      if (!host.def.trades || host.baby) continue;
      let villagers = 0,
        golems = 0,
        danger = false;
      for (const e of mobs) {
        if (e.pos.distanceTo(host.pos) > GOLEM_RADIUS) continue;
        if (e.def.trades) villagers++;
        else if (e.def.name === "iron_golem") golems++;
        else if (e.def.category === "hostile") danger = true;
      }
      if (!shouldSummonGolem({ villagers, golems, danger, cooldown: 0 }))
        continue;
      const x = Math.floor(host.pos.x) + (Math.random() < 0.5 ? 2 : -2),
        z = Math.floor(host.pos.z) + (Math.random() < 0.5 ? 2 : -2);
      const y = this.world.surfaceY(x, z);
      if (y <= 0) continue;
      this.spawnMob("iron_golem", x + 0.5, y + 1.01, z + 0.5);
      this._golemT = GOLEM_COOLDOWN;
      events.emit("golemSummoned", { x, y, z });
      return;
    }
  }

  /** Лечение зомби-жителя (systems/Zombify): раз в секунду, на нуле — обратно в свою профессию. */
  private _tickCuring(): void {
    for (const e of this.entities.values()) {
      if (e.kind !== "mob" || e.dead || e.curing <= 0) continue;
      e.curing -= 1;
      if (e.curing > 0) continue;
      const back = this._reprofess(e, curedTypeOf(e.curedType), e.jobSite);
      events.emit("villagerCured", { mob: back.def.name });
    }
  }

  /**
   * Житель, убитый зомби, встаёт зомби-жителем и помнит профессию (systems/Zombify).
   * Зовёт мозг зомби через MobCtx.convert.
   */
  convertToZombie(v: Mob): Mob {
    const z = this._reprofess(v, ZOMBIE_VILLAGER, v.jobSite);
    z.hp = z.def.hp;
    z.curedType = v.def.name;
    events.emit("villagerZombified", { mob: v.def.name });
    return z;
  }

  /** Тот же житель на том же месте, но другим типом моба: типы жителей — по профессии. */
  private _reprofess(
    v: Mob,
    type: string,
    site: [number, number, number] | null,
  ): Mob {
    const n = this.spawnMob(type, v.pos.x, v.pos.y, v.pos.z, v.baby);
    n.hp = v.hp;
    n.yaw = v.yaw;
    n.jobSite = site;
    n.traded = v.traded;
    n.villagerXp = v.villagerXp; // опыт профессии переживает и смену профессии, и лечение
    v.dead = true; // hp > 0 — исчезает без дропа
    events.emit("villagerJob", { mob: type });
    return n;
  }

  /** Перепись: враждебные вдали исчезают, население добирается попытками спавна. */
  _census(dt: number): void {
    this._spawnTimer -= dt;
    if (this._spawnTimer > 0) return;
    this._spawnTimer = 1;
    // патрули мародёров — раз в 5–10 минут, как в Minecraft
    this._patrolT -= 1;
    if (this._patrolT <= 0) {
      this._patrolT = 300 + Math.random() * 300;
      this.spawnPatrol();
    }
    // странствующий торговец — раз в 20 минут с шансом 25%, если его ещё нет (как в Minecraft)
    this._traderT -= 1;
    if (this._traderT <= 0) {
      this._traderT = 1200;
      const here = [...this.entities.values()].some(
        (e) => e.kind === "mob" && !e.dead && e.def.name === "wandering_trader",
      );
      if (!here && Math.random() < 0.25) this.spawnWanderingTrader();
    }
    this._villagerJobs();
    this._tickCuring();
    this._villagerGolem();
    const M = CONFIG.mobs;
    // сетевая игра: «рядом с игроком» — рядом с БЛИЖАЙШИМ игроком измерения, и спавн — вокруг
    // случайного из них (как в Minecraft на сервере: население держится вокруг каждого игрока)
    const actors = this.actors();
    const center =
      actors[Math.floor(Math.random() * actors.length)]!.player.pos;
    let passive = 0,
      hostile = 0;
    for (const e of this.entities.values()) {
      if (e.kind !== "mob" || e.dead) continue;
      let d = Infinity;
      for (const a of actors) d = Math.min(d, e.pos.distanceTo(a.player.pos));
      if (e.def.category === "passive") {
        if (d < M.countRadius) passive++;
        continue;
      }
      // голем деревни, ручные, названные биркой, набег и волна испытаний не исчезают
      if (
        e.def.persistent ||
        e.tamed ||
        e.customName ||
        e.raider ||
        e.trialFrom
      )
        continue;
      if (d > M.despawnRadius && !e.def.boss && !e.def.stationary) {
        e.dead = true; // hp > 0 — без дропа
        continue;
      }
      if (d < M.countRadius) hostile++;
    }
    for (let a = 0; a < M.spawnAttempts; a++) {
      const wantHostile =
        hostile < M.hostileCap &&
        (!this.beginnerCombat || hostile === 0) &&
        (passive >= M.passiveCap || Math.random() < 0.75);
      if (!wantHostile && passive >= M.passiveCap) return;
      const n = this._trySpawn(wantHostile ? "dark" : "bright", center);
      if (wantHostile) hostile += n;
      else passive += n;
    }
  }

  private _pickType(light: "bright" | "dark"): MobDef | null {
    const dim = this.world.dimension;
    if (light === "dark" && dim === "overworld" && this.beginnerCombat) return MOBS.zombie ?? null;
    const list = Object.values(MOBS).filter(
      (d) =>
        d.spawn &&
        (d.spawn.light === light ||
          (light === "dark" && d.spawn.light === "any")) &&
        (d.spawn.dimension ?? "overworld") === dim,
    );
    let total = 0;
    for (const d of list) total += d.spawn!.weight;
    let r = Math.random() * total;
    for (const d of list) {
      r -= d.spawn!.weight;
      if (r <= 0) return d;
    }
    return list[0] ?? null;
  }

  private _trySpawn(
    light: "bright" | "dark",
    p: THREE.Vector3 = this.player.pos,
  ): number {
    const def = this._pickType(light);
    if (!def) return 0;
    const [rMin, rMax] = CONFIG.mobs.spawnRadius;
    const ang = Math.random() * Math.PI * 2;
    // жители построек (крепость, храм) — ближе: постройка может быть меньше обычного кольца спавна
    const r = def.spawn!.structure
      ? 6 + Math.random() * 26
      : rMin! + Math.random() * (rMax! - rMin!);
    const x = Math.floor(p.x + Math.cos(ang) * r),
      z = Math.floor(p.z + Math.sin(ang) * r);
    let y: number;
    if (this.world.dimension === "inferno") {
      // пещерный мир: «поверхность» — свод из бедрока; берём высоту около игрока и спускаемся до пола
      y = Math.max(8, Math.min(120, Math.floor(p.y) + randInt(-16, 16)));
      for (
        let k = 0;
        k < 24 && y > 1 && !BLOCKS[this.world.getBlock(x, y - 1, z)]?.solid;
        k++
      )
        y--;
    } else {
      const top = this.world.surfaceY(x, z);
      // тьма — на поверхности (ночью) или случайно в толще (пещеры)
      y =
        light === "bright" || Math.random() < 0.5
          ? top + 1
          : 5 + Math.floor(Math.random() * Math.max(1, top - 8));
    }
    // не на полу: спрут и утопленник — в толще воды, фантом — высоко в воздухе
    const med = def.spawn!.medium;
    if (med === "water" && def.spawn!.underground) {
      // пещерное озеро: случайная высота под поверхностью и вниз до воды
      let wy = 12 + randInt(0, Math.max(0, this.world.surfaceY(x, z) - 24));
      for (
        let k = 0;
        k < 24 && wy > 1 && this.world.getBlock(x, wy, z) !== B.water;
        k++
      )
        wy--;
      y = wy;
    } else if (med === "water") {
      let wy = this.world.surfaceY(x, z) + 1;
      for (
        let k = 0;
        k < 12 && wy > 1 && this.world.getBlock(x, wy, z) !== B.water;
        k++
      )
        wy--;
      // в толще у поверхности; житель подводной постройки — на любой глубине
      y = def.spawn!.structure
        ? randInt(8, Math.max(8, wy))
        : wy - randInt(0, 2);
    } else if (med === "lava")
      y = this.world.generator.waterLevel + 1; // страйдер — на лавовом море
    else if (med === "air")
      // летучая мышь — в воздухе пещер, фантом — высоко над поверхностью
      y = def.spawn!.underground
        ? 5 + randInt(0, Math.max(0, this.world.surfaceY(x, z) - 12))
        : this.world.surfaceY(x, z) + randInt(12, 20);
    if (!this._canSpawn(def, x, y, z)) return 0;
    const [gMin, gMax] = def.spawn!.group;
    const n = this.beginnerCombat && def.category === "hostile" ? 1 : randInt(gMin, gMax);
    let spawned = 0;
    for (let i = 0; i < n; i++) {
      const sx = x + (i ? randInt(-2, 2) : 0),
        sz = z + (i ? randInt(-2, 2) : 0);
      if (i && !this._canSpawn(def, sx, y, sz)) continue;
      this.spawnMob(def.name, sx + 0.5, y + 0.01, sz + 0.5);
      spawned++;
    }
    return spawned;
  }

  /** Место для спавна: пол непрозрачный, над ним воздух на рост, свет по правилу вида. */
  private _canSpawn(def: MobDef, x: number, y: number, z: number): boolean {
    const w = this.world;
    if (y < 1) return false;
    const sp = def.spawn!;
    // на мирной сложности монстров нет вовсе (systems/Difficulty)
    if (def.category === "hostile" && !rules().hostiles) return false;
    if (sp.insomnia && !this.insomnia) return false;
    // по биомам: тропическая рыба — в тёплом океане (у мира без биомов фильтра нет)
    // в грибных полях монстры не появляются (и в пещерах под ними), кроме жителей построек
    if (
      def.category === "hostile" &&
      !sp.structure &&
      w.generator.biomeOf?.(x, z) === "mushroom_fields"
    )
      return false;
    const bio = sp.biomes ? w.generator.biomeOf?.(x, z) : undefined;
    if (sp.biomes && bio !== undefined && !sp.biomes.includes(bio))
      return false;
    // на лаве: под ногами лава, над ней воздух на рост
    if (sp.medium === "lava") {
      if (w.getBlock(x, y - 1, z) !== B.lava) return false;
      for (let dy = 0; dy < Math.ceil(def.box.h); dy++)
        if (w.getBlock(x, y + dy, z) !== 0) return false;
      return true;
    }
    if (sp.medium) {
      // вода или воздух на весь рост, свет — по правилу вида
      const want = sp.medium === "water" ? B.water : 0;
      for (let dy = 0; dy < Math.max(1, Math.ceil(def.box.h)); dy++) {
        const id = w.getBlock(x, y + dy, z);
        if (id !== want && !(want === B.water && BLOCKS[id]?.waterlogged))
          return false;
      }
      if (sp.structure && w.generator.structureAt?.(x, y, z) !== sp.structure)
        return false;
      if (sp.underground && y >= w.surfaceY(x, z) - 4) return false;
      if (sp.nearBlock && !this._blockNear(x, y, z, B[sp.nearBlock], 4))
        return false;
      const l = w.getLight(x, y, z);
      const sky = (l >> 4) - this.skyDarken,
        blk = l & 15;
      if (sp.light === "any") return true;
      if (sp.light === "bright") return Math.max(sky, blk) >= 9;
      return blk === 0 && sky <= 7;
    }
    const bd = BLOCKS[w.getBlock(x, y - 1, z)];
    if (!bd || !bd.solid || !bd.opaque) return false;
    for (let dy = 0; dy < Math.ceil(def.box.h); dy++)
      if (w.getBlock(x, y + dy, z) !== 0) return false;
    const l = w.getLight(x, y, z);
    const sky = (l >> 4) - this.skyDarken,
      blk = l & 15;
    const s = def.spawn!;
    if (s.maxY !== undefined && y > s.maxY) return false;
    if (
      s.structure &&
      this.world.generator.structureAt?.(x, y, z) !== s.structure
    )
      return false;
    if (s.nearWater && !this._waterNear(x, y - 1, z, 4)) return false;
    if (s.light === "any") return !s.ground || s.ground.includes(bd.name);
    if (s.light === "bright") {
      if (s.ground && !s.ground.includes(bd.name)) return false;
      return Math.max(sky, blk) >= 9;
    }
    return blk === 0 && sky <= 7;
  }

  /** Луч по AABB мобов (slab-тест) — для атаки и кормления. Возвращает ближайшего. */
  raycast(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    maxDist: number,
  ): Mob | null {
    let best: Mob | null = null,
      bestT = maxDist;
    for (const e of this.entities.values()) {
      if (e.kind !== "mob" || e.dead || e.rider) continue; // лошадь под игроком лучу не мешает
      const w = e.width / 2;
      const t = rayBox(
        origin,
        dir,
        bestT,
        { x: e.pos.x - w, y: e.pos.y, z: e.pos.z - w },
        { x: e.pos.x + w, y: e.pos.y + e.height, z: e.pos.z + w },
      );
      if (t !== null && t < bestT) {
        bestT = t;
        best = e;
      }
    }
    return best;
  }

  updateVisuals(alpha: number, time: number): void {
    for (const e of this.entities.values()) {
      if (e.kind === "mob") {
        // свет места: в пещере моб темнее (ночь приглушает свет сцены и так)
        const l = this.world.getLight(
          Math.floor(e.pos.x),
          Math.floor(e.pos.y + e.height * 0.5),
          Math.floor(e.pos.z),
        );
        const lvl = Math.max(l >> 4, l & 15);
        // без неба (Пекло, Предел) свет блоков почти всюду 0 — там свой фоновый порог
        const floor = this.world.dimension === "overworld" ? 0.05 : 0.6;
        e.updateVisual(alpha, time, Math.max(floor, Math.pow(0.8, 15 - lvl)));
      } else if (
        e.kind === "arrow" ||
        e.kind === "fireball" ||
        e.kind === "minecart" ||
        e.kind === "boat"
      )
        e.updateVisual(alpha);
      else if (e.kind === "hook") {
        // леска — от кончика удочки: чуть впереди, правее и ниже глаз
        const eye = this.player.eyePos,
          yaw = this.player.yaw;
        const tip = eye
          .clone()
          .addScaledVector(this.player.lookDir(), 0.7)
          .add(
            new THREE.Vector3(Math.cos(yaw) * 0.3, -0.3, -Math.sin(yaw) * 0.3),
          );
        e.updateVisual(alpha, tip);
      } else e.updateVisual(alpha, time);
    }
    this._beam();
  }

  /** Луч от лечащего Кристалла Предела к дракону. */
  private beamLine: THREE.Line | null = null;
  private _beam(): void {
    let pts: THREE.Vector3[] | null = null;
    for (const e of this.entities.values()) {
      if (e.kind !== "mob" || !e.def.boss || e.healFrom === null) continue;
      const k = this.entities.get(e.healFrom);
      if (k && k.kind === "mob" && !k.dead)
        pts = [
          k.group.position.clone().setY(k.group.position.y + 1),
          e.group.position.clone().setY(e.group.position.y + e.height * 0.5),
        ];
    }
    if (!pts) {
      if (this.beamLine) this.beamLine.visible = false;
      return;
    }
    if (!this.beamLine) {
      this.beamLine = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color: 0xff80ff }),
      );
      this.scene.add(this.beamLine);
    }
    this.beamLine.geometry.setFromPoints(pts);
    this.beamLine.visible = true;
  }

  clear(): void {
    this._netBase.clear();
    this._netDriven.clear();
    this.drivenId = null;
    // игрок сидел в вагонетке/лодке этого мира — ссаживаем без телепорта: иначе Player.update
    // каждый кадр ставил бы его к выброшенной сущности (после портала — в координаты прошлого
    // измерения), а «присесть» высаживало бы туда же
    const ride = this.player?.riding;
    if (ride) {
      ride.rider = false;
      this.player.riding = null;
    }
    // выброшенные сущности — мёртвые для всех, кто держит на них ссылку (экран торговли с жителем,
    // груз вагонетки, поводок): иначе после портала экран жил бы с призраком из прошлого измерения
    for (const e of this.entities.values()) {
      e.dead = true;
      e.dispose(this.scene);
    }
    this.entities.clear();
    if (this.beamLine) this.beamLine.visible = false;
  }

  serialize() {
    const out: unknown[] = [];
    for (const e of this.entities.values())
      if (
        e.kind !== "arrow" &&
        e.kind !== "tnt" &&
        e.kind !== "fireball" &&
        e.kind !== "rimeye" &&
        e.kind !== "hook" &&
        e.kind !== "fang"
      )
        out.push(e.serialize());
    return out;
  }

  deserialize(list?: EntitySave[]): void {
    this.clear();
    for (const d of Array.isArray(list) ? list : []) this._loadOne(d);
  }

  /** Координаты записи годны: чужой файл (Мастерская, другая версия, сеть) мог прислать что угодно. */
  private static _validPos(d: unknown): boolean {
    const pos: unknown = (d as { pos?: unknown } | null)?.pos;
    return (
      !!d &&
      typeof d === "object" &&
      Array.isArray(pos) &&
      pos.length >= 3 &&
      pos.slice(0, 3).every((n) => Number.isFinite(n))
    );
  }

  /** Одна сохранённая сущность → живая (сейв, Мастерская, сетевой снимок). null — запись негодна. */
  private _loadOne(d: EntitySave): Entity | null {
    // запись из чужого файла (Мастерская, другая версия): null или без координат ронял загрузку
    // посреди замены мира — мир уже новый, а сущности и блоки ещё старые
    if (!EntityManager._validPos(d)) return null;
    {
      if (d.kind === "mob" && MOBS[d.type]) {
        const m = this.spawnMob(d.type, d.pos[0], d.pos[1], d.pos[2], !!d.baby);
        // NaN в здоровье делал моба бессмертным: hp − урон = NaN, а NaN ≤ 0 — ложь
        if (Number.isFinite(d.hp) && d.hp > 0) m.hp = d.hp;
        m.sheared = !!d.sheared;
        if (Array.isArray(d.uses))
          m.uses = d.uses.filter((n) => typeof n === "number");
        if (Array.isArray(d.jobSite) && d.jobSite.length === 3)
          m.jobSite = [d.jobSite[0], d.jobSite[1], d.jobSite[2]];
        m.traded = !!d.traded;
        if (typeof d.villagerXp === "number") m.villagerXp = d.villagerXp;
        if (typeof d.curedType === "string") m.curedType = d.curedType;
        if (typeof d.curing === "number") m.curing = d.curing;
        m.tamed = !!d.tamed;
        if (typeof d.customName === "string") m.setName(d.customName);
        m.sitting = !!d.sitting;
        m.saddled = !!d.saddled;
        // нет поля — белая (случайный цвет новорождённой овцы здесь не нужен)
        m.woolColor = typeof d.woolColor === "string" ? d.woolColor : null;
        if (typeof d.wolfArmor === "number") m.wolfArmor = d.wolfArmor;
        if (typeof d.carry === "string") {
          m.carry = { item: d.carry, count: 1 };
          m.bag = typeof d.bag === "number" ? d.bag : 0;
        }
        if (Array.isArray(d.items) && m.def.chestSlots)
          m.items = d.items.map((s) => sanitizeStack(s));
        m.leashed = !!d.leashed;
        if (typeof d.leashSlot === "number") m.leashSlot = d.leashSlot;
        if (typeof d.leaveT === "number") m.leaveT = d.leaveT;
        if (typeof d.migrationId === "string" && Array.isArray(d.migrationTarget) && d.migrationTarget.length === 2 && d.migrationTarget.every(Number.isFinite)) {
          m.migrationId = d.migrationId;
          m.migrationTarget = [d.migrationTarget[0], d.migrationTarget[1]];
        }
        if (Array.isArray(d.leashPost) && d.leashPost.length === 3)
          m.leashPost = [d.leashPost[0], d.leashPost[1], d.leashPost[2]];
        if (Array.isArray(d.home) && d.home.length === 3)
          m.home = [d.home[0], d.home[1], d.home[2]];
        m.pollen = !!d.pollen;
        m.captain = !!d.captain;
        return m;
      } else if (d.kind === "drop") {
        // предмет, которого нет в игре (чужая версия сейва), рисовать нечем — ItemMesh упал бы
        if (!ITEMS[d.item] || !(d.count > 0)) return null;
        const drop = this.spawnDrop(
          d.pos[0],
          d.pos[1],
          d.pos[2],
          d.item,
          d.count,
          d.dmg,
          d.tag,
        );
        if (drop) drop.vel.set(0, 0, 0);
        return drop;
      } else if (d.kind === "xp") {
        this.spawnXp(d.pos[0], d.pos[1], d.pos[2], d.value);
        return null;
      } else if (d.kind === "minecart") {
        const variant =
          d.variant && CART_VARIANTS.includes(d.variant) ? d.variant : "plain";
        const c = this.spawnMinecart(d.pos[0], d.pos[1], d.pos[2], variant);
        if (Array.isArray(d.vel)) c.vel.fromArray(d.vel);
        if (Array.isArray(d.items))
          d.items.forEach((s, i) => {
            if (i < c.items.length) c.items[i] = sanitizeStack(s);
          });
        return c;
      } else if (d.kind === "boat")
        return this.spawnBoat(d.pos[0], d.pos[1], d.pos[2], d.wood ?? "oak");
    }
    return null;
  }

  // ---- сеть (net/NetGame) ----------------------------------------------------------------------

  /**
   * Сущность → снимок для другого игрока. null — вид в сети не живёт (поплавок и клыки — локальные
   * и короткие, Око Предела — чистая анимация у бросившего).
   */
  netSnapshot(e: Entity): NetEntitySnap | null {
    const v3 = (v: THREE.Vector3): [number, number, number] => [v.x, v.y, v.z];
    switch (e.kind) {
      case "mob":
      case "minecart":
      case "boat":
        return e.serialize() as NetEntitySnap;
      case "drop":
        return {
          kind: "drop",
          pos: v3(e.pos),
          item: e.item,
          count: e.count,
          ...(e.dmg ? { dmg: e.dmg } : {}),
          ...(e.tag ? { tag: e.tag } : {}),
          vel: v3(e.vel),
          pickupDelay: Math.max(0, e.pickupDelay - e.age),
        };
      case "xp":
        return { kind: "xp", pos: v3(e.pos), value: e.value };
      case "arrow":
        return {
          kind: "arrow",
          pos: v3(e.pos),
          vel: v3(e.vel),
          damage: e.damage,
          fromPlayer: e.fromPlayer,
          stuck: e.stuck,
          effect: e.effect,
          pick: e.pick,
        };
      case "fireball":
        return {
          kind: "fireball",
          ballKind: e.ballKind,
          pos: v3(e.pos),
          vel: v3(e.vel),
          damage: e.damage,
          shooterId: e.shooterId,
        };
      case "tnt":
        return { kind: "tnt", pos: v3(e.pos), fuse: e.fuse };
      default:
        return null;
    }
  }

  /** Снимок → живая сущность этого менеджера (id — свой). null — снимок негоден. */
  private _createFromSnap(s: NetEntitySnap): Entity | null {
    if (!EntityManager._validPos(s)) return null;
    const at = new THREE.Vector3(s.pos[0], s.pos[1], s.pos[2]);
    const vel = (v: unknown) =>
      Array.isArray(v) && v.length === 3 && v.every(Number.isFinite)
        ? new THREE.Vector3(v[0], v[1], v[2])
        : new THREE.Vector3();
    switch (s.kind) {
      case "drop": {
        if (!ITEMS[s.item] || !(s.count > 0)) return null;
        const d = this.spawnDrop(
          at.x,
          at.y,
          at.z,
          s.item,
          s.count,
          s.dmg,
          s.tag,
        );
        d.vel.copy(vel((s as { vel?: unknown }).vel));
        const delay = (s as { pickupDelay?: unknown }).pickupDelay;
        if (typeof delay === "number" && Number.isFinite(delay))
          d.pickupDelay = delay;
        return d;
      }
      case "xp": {
        const orb = new XpOrb(
          this._nextId++,
          at.x,
          at.y,
          at.z,
          Math.max(1, Math.round(s.value) || 1),
        );
        return this._register(orb, orb.mesh);
      }
      case "arrow": {
        const a = this.spawnArrow(
          at,
          vel(s.vel),
          Number(s.damage) || 0,
          !!s.fromPlayer,
          -1,
        );
        if (s.stuck) a.stuck = true;
        if (s.effect) a.effect = s.effect as Arrow["effect"];
        if (s.pick && ITEMS[s.pick.item])
          a.pick = sanitizeStack(s.pick) ?? a.pick;
        return a;
      }
      case "fireball":
        return this.spawnFireball(
          s.ballKind,
          at,
          vel(s.vel),
          Number(s.damage) || 0,
          s.shooterId,
        );
      case "tnt":
        return this.spawnTnt(
          at.x,
          at.y,
          at.z,
          Math.max(0, Number(s.fuse) || 0),
        );
      default:
        return this._loadOne(s);
    }
  }

  /**
   * Владелец измерения: реплика попросила создать сущность (бросила предмет, выстрелила). Создаётся
   * по обычным правилам — с id этого менеджера, и разойдётся всем обычным снимком.
   */
  netSpawnFromRemote(s: NetEntitySnap): Entity | null {
    return this._createFromSnap(s);
  }

  /** Реплика: сущность владельца с ЕГО id (повтор того же id — замена: сменился вид). */
  netApplySpawn(id: number, s: NetEntitySnap): void {
    // в ней сидит свой игрок: объект не подменяем (Player.riding держит ссылку), ведём сами
    if (id === this.drivenId && this.entities.has(id)) return;
    this.netRemove(id);
    this._netApplying = true;
    let e: Entity | null;
    try {
      e = this._createFromSnap(s);
    } finally {
      this._netApplying = false;
    }
    if (!e) return;
    this.entities.delete(e.id);
    e.id = id;
    this.entities.set(id, e);
    this._netTargets.set(id, {
      x: e.pos.x,
      y: e.pos.y,
      z: e.pos.z,
      yaw: e.kind === "mob" ? e.yaw : 0,
    });
    this._rebase(e);
  }

  /** Реплика: запомнить состояние образа как «слово владельца» (изменения от него — не наши). */
  private _rebase(e: Entity): void {
    const st = interactState(e);
    if (st) this._netBase.set(e.id, JSON.stringify(st));
    else this._netBase.delete(e.id);
  }

  /**
   * Реплика: поза по снимку владельца. Сущность идёт к ней сглаженно (_replicaTick), а флаги вида
   * применяются сразу. Незнакомый id — пропуск: снимок появления придёт надёжным каналом.
   */
  netApplyPose(
    id: number,
    x: number,
    y: number,
    z: number,
    yaw: number,
    flags: number,
    extra: number,
  ): void {
    const e = this.entities.get(id);
    if (!e || id === this.drivenId) return;
    if (e.kind === "minecart" || e.kind === "boat")
      e.rider = (flags & POSE_RIDDEN) !== 0;
    const t = this._netTargets.get(id);
    if (t) {
      t.x = x;
      t.y = y;
      t.z = z;
      t.yaw = yaw;
    } else this._netTargets.set(id, { x, y, z, yaw });
    if (e.kind === "mob") {
      e.onGround = (flags & 1) !== 0;
      if (flags & 2 && e.swing <= 0) e.swing = 0.3;
      e.sheared = (flags & 4) !== 0;
      e.sitting = (flags & 8) !== 0;
      e.tamed = (flags & 16) !== 0;
      e.saddled = (flags & 32) !== 0;
      e.invisible = (flags & 64) !== 0;
      e.rider = (flags & POSE_RIDDEN) !== 0;
      if (e.def.explode) e.fuse = (extra / 255) * e.def.explode.fuse;
      else e.peek = extra / 255;
      // поза несёт только эти поля — и только их она делает «словом владельца»: правка из экрана
      // (торговля, груз, имя), сделанная между тиками, иначе приняла бы вид чужой и не ушла бы
      const base = this._netBase.get(id);
      if (base) {
        const b = JSON.parse(base) as Record<string, unknown>;
        b.sheared = e.sheared;
        b.sitting = e.sitting;
        b.tamed = e.tamed;
        b.saddled = e.saddled;
        this._netBase.set(id, JSON.stringify(b));
      }
    }
  }

  /** Поза сущности для снимка: флаги вида (см. netApplyPose) и «лишний» байт (фитиль/раскрытие). */
  netPose(e: Entity): { yaw: number; flags: number; extra: number } {
    if (e.kind === "minecart" || e.kind === "boat")
      return { yaw: 0, flags: e.rider ? POSE_RIDDEN : 0, extra: 0 };
    if (e.kind !== "mob") return { yaw: 0, flags: 0, extra: 0 };
    const flags =
      (e.onGround ? 1 : 0) |
      (e.swing > 0 ? 2 : 0) |
      (e.sheared ? 4 : 0) |
      (e.sitting ? 8 : 0) |
      (e.tamed ? 16 : 0) |
      (e.saddled ? 32 : 0) |
      (e.invisible ? 64 : 0) |
      (e.rider ? POSE_RIDDEN : 0);
    const extra = e.def.explode
      ? Math.round(Math.min(1, Math.max(0, e.fuse / e.def.explode.fuse)) * 255)
      : Math.round(Math.min(1, Math.max(0, e.peek)) * 255);
    return { yaw: e.yaw, flags, extra };
  }

  /** Реплика: сущность ушла у владельца (умерла, подобрана, вышла из зоны видимости). */
  netRemove(id: number): void {
    const e = this.entities.get(id);
    this._netTargets.delete(id);
    this._netBase.delete(id);
    if (!e) return;
    e.dead = true;
    e.dispose(this.scene);
    this.entities.delete(id);
  }

  /**
   * Тик реплики: никакой симуляции — только ход к позе из последнего снимка (снимки приходят 10 раз
   * в секунду, тик — 20: без сглаживания мобы двигались бы рывками). Свои локальные сущности
   * (поплавок, жемчуг) тикают по-настоящему.
   */
  private _replicaTick(dt: number): void {
    for (const e of this.entities.values()) {
      if (e.id === this.drivenId && !e.dead) {
        // в ней сидит свой игрок: настоящая физика здесь, позу владельцу шлёт NetGame
        if (e.kind === "mob") e.tick(dt, this._ctx());
        else if (e.kind === "minecart" || e.kind === "boat")
          e.tick(dt, this.world);
      } else if (e.kind === "hook") {
        e.tick(
          dt,
          this.world,
          this.player.pos,
          this.raining,
          this.inventory.heldItem()?.item === "fishing_rod",
        );
      } else if (
        e.kind === "fireball" &&
        e.ballKind === "pearl" &&
        !this._netTargets.has(e.id)
      ) {
        e.tick(
          dt,
          this.world,
          this.player,
          (x, y, z, p) => this.explode(x, y, z, p),
          [],
        );
      } else {
        const t = this._netTargets.get(e.id);
        if ("prevPos" in e) e.prevPos.copy(e.pos);
        if (t) {
          const dx = t.x - e.pos.x,
            dy = t.y - e.pos.y,
            dz = t.z - e.pos.z;
          // далёкий скачок (телепорт, первая поза) — сразу; иначе полпути за тик
          if (dx * dx + dy * dy + dz * dz > 64) e.pos.set(t.x, t.y, t.z);
          else
            e.pos.set(
              e.pos.x + dx * 0.5,
              e.pos.y + dy * 0.5,
              e.pos.z + dz * 0.5,
            );
          if (e.kind === "mob") {
            let dyaw = t.yaw - e.yaw;
            while (dyaw > Math.PI) dyaw -= Math.PI * 2;
            while (dyaw < -Math.PI) dyaw += Math.PI * 2;
            e.yaw += dyaw * 0.5;
            if (dx * dx + dz * dz > 1e-4) e.animTime += dt;
            if (e.swing > 0) e.swing = Math.max(0, e.swing - dt);
          }
        }
        // «накормил» гаснет и здесь, иначе второй раз того же зверя не покормить; это не наша правка
        if (e.kind === "mob" && e.loveT > 0) {
          e.loveT = Math.max(0, e.loveT - dt);
          if (e.loveT === 0) this._rebase(e);
        }
      }
      if (e.dead) {
        // образ сущности владельца погиб ЗДЕСЬ (/kill, рыба в ведро, превращение) — пусть и там
        if (this._netTargets.has(e.id))
          this.onRemoteAction?.({
            a: "kill",
            id: e.id,
            drops: e.kind === "mob" && e.hp <= 0,
          });
        e.dispose(this.scene);
        this.entities.delete(e.id);
        this._netTargets.delete(e.id);
        this._netBase.delete(e.id);
      }
    }
  }

  /**
   * Реплика: что игрок поменял в сущностях своими действиями с прошлого тика — только изменившиеся
   * поля. Зовётся в конце тика (NetGame.afterTick): между изменением и сравнением снимки владельца
   * прийти не могут, так что всё отличие от «слова владельца» — наше.
   */
  netLocalChanges(): NetEntityAction[] {
    const out: NetEntityAction[] = [];
    for (const [id, base] of this._netBase) {
      const e = this.entities.get(id);
      if (!e || e.dead) continue;
      const st = interactState(e);
      if (!st) continue;
      const cur = JSON.stringify(st);
      if (cur === base) continue;
      const prev = JSON.parse(base) as Record<string, unknown>;
      const fields: Record<string, unknown> = {};
      for (const k of Object.keys(st))
        if (JSON.stringify(st[k]) !== JSON.stringify(prev[k]))
          fields[k] = st[k];
      this._netBase.set(id, cur);
      out.push({ a: "patch", id, fields });
    }
    return out;
  }

  /** Владелец: правка сущности игроком-реплики (см. interactState). `slot` — кто правил. */
  netPatch(id: number, f: Record<string, unknown>, slot?: number): void {
    const e = this.entities.get(id);
    if (!e || e.dead) return;
    const slots = (v: unknown, n: number): (ItemStack | null)[] | null =>
      Array.isArray(v) && v.length === n
        ? v.map((s) => sanitizeStack(s))
        : null;
    if (e.kind === "minecart") {
      const items = slots(f.items, e.items.length);
      if (items) e.items = items;
      return;
    }
    if (e.kind !== "mob") return;
    const bool = (k: string): boolean | undefined =>
      typeof f[k] === "boolean" ? (f[k] as boolean) : undefined;
    const num = (k: string): number | undefined =>
      typeof f[k] === "number" && Number.isFinite(f[k])
        ? Math.max(0, f[k] as number)
        : undefined;
    const v = {
      sheared: bool("sheared"),
      tamed: bool("tamed"),
      sitting: bool("sitting"),
      saddled: bool("saddled"),
      leashed: bool("leashed"),
      traded: bool("traded"),
    };
    if (v.sheared !== undefined) e.sheared = v.sheared;
    if (v.tamed !== undefined) {
      e.tamed = v.tamed;
      if (e.tamed) e.aggro = false;
    }
    if (v.sitting !== undefined) {
      e.sitting = v.sitting;
      e.speed = 0;
    }
    if (v.saddled !== undefined) e.saddled = v.saddled;
    if (v.traded !== undefined) e.traded = v.traded;
    if ("woolColor" in f)
      e.woolColor =
        typeof f.woolColor === "string" && f.woolColor.length < 32
          ? f.woolColor
          : null;
    const armor = num("wolfArmor");
    if (armor !== undefined) e.wolfArmor = Math.floor(armor);
    if ("carry" in f)
      e.carry =
        typeof f.carry === "string" && ITEMS[f.carry]
          ? { item: f.carry, count: 1 }
          : null;
    const bag = num("bag");
    if (bag !== undefined) e.bag = Math.floor(bag);
    if ("items" in f && e.def.chestSlots) {
      if (Array.isArray(f.items) && f.items.length === 0) e.items = [];
      else {
        const items = slots(f.items, e.def.chestSlots);
        if (items) e.items = items;
      }
    }
    if (v.leashed !== undefined) {
      e.leashed = v.leashed;
      if (!e.leashed) {
        e.leashPost = null;
        e.leashMobId = null;
        e.leashSlot = null;
      } else if (!Array.isArray(f.leashPost) && !e.leashPost)
        e.leashSlot = slot ?? null;
    }
    if ("leashPost" in f) {
      const lp = f.leashPost;
      e.leashPost =
        Array.isArray(lp) && lp.length === 3 && lp.every(Number.isFinite)
          ? [lp[0] as number, lp[1] as number, lp[2] as number]
          : null;
    }
    if (f.leashMob === false) e.leashMobId = null;
    // накормил / начал лечить: условия проверяет владелец — его таймеры точнее образа реплики
    if (f.love === true && !e.baby && e.loveT <= 0 && e.breedCd <= 0) {
      e.loveT = 30;
      events.emit("mobFed", { entity: e });
    }
    if (f.cure === true && e.def.curable && e.curing <= 0)
      e.curing = CURE_SECONDS;
    if ("name" in f) e.setName(typeof f.name === "string" ? f.name : null);
    if (Array.isArray(f.uses))
      e.uses = f.uses.map((n) =>
        typeof n === "number" && Number.isFinite(n)
          ? Math.max(0, Math.floor(n))
          : 0,
      );
    const xp = num("villagerXp");
    if (xp !== undefined) e.villagerXp = Math.floor(xp);
  }

  /** Владелец: образ сущности погиб у реплики — с дропом (убили) или без (исчезла, превратилась). */
  netKill(id: number, drops: boolean): void {
    const e = this.entities.get(id);
    if (!e || e.dead) return;
    if (drops && e.kind === "mob") e.damage(e.hp);
    else e.dead = true;
  }

  /**
   * Владелец: игрок-реплика сел (on) или слез. Пока сидит, сущность здесь не тикает — её ведёт он.
   * @returns false — место занято (сел кто-то другой, или сидит свой игрок)
   */
  netRide(id: number, slot: number, on: boolean): boolean {
    const e = this.entities.get(id);
    if (
      !e ||
      e.dead ||
      !(e.kind === "mob" || e.kind === "minecart" || e.kind === "boat")
    )
      return !on;
    const cur = this._netDriven.get(id);
    if (!on) {
      if (cur?.slot === slot) this._release(id);
      return true;
    }
    if ((cur && cur.slot !== slot) || (this.player.riding as unknown) === e)
      return false;
    this._netDriven.set(id, { slot, t: performance.now() });
    e.rider = true;
    return true;
  }

  /** Владелец: поза сущности, которую ведёт реплика (чужая поза той же сущности — мимо). */
  netDrive(
    id: number,
    slot: number,
    pos: readonly number[],
    vel: readonly number[],
    yaw: number,
  ): void {
    const cur = this._netDriven.get(id);
    const e = this.entities.get(id);
    if (!cur || cur.slot !== slot || !e || e.dead) return;
    if (pos.length !== 3 || !pos.every(Number.isFinite)) return;
    if ("prevPos" in e) e.prevPos.copy(e.pos);
    e.pos.set(pos[0]!, pos[1]!, pos[2]!);
    if ("vel" in e && vel.length === 3 && vel.every(Number.isFinite))
      e.vel.set(vel[0]!, vel[1]!, vel[2]!);
    if (e.kind === "mob" && Number.isFinite(yaw)) e.yaw = e.targetYaw = yaw;
    cur.t = performance.now();
  }

  /** Владелец: игрок ушёл (из измерения, из игры) — всё, что он вёл, снова симулируется здесь. */
  netReleaseDriver(slot: number): void {
    for (const [id, d] of [...this._netDriven])
      if (d.slot === slot) this._release(id);
  }

  private _release(id: number): void {
    this._netDriven.delete(id);
    const e = this.entities.get(id);
    if (e && (e.kind === "mob" || e.kind === "minecart" || e.kind === "boat"))
      e.rider = false;
  }
}
