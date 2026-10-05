// Протокол мультиплеера VoxelCraft поверх `@idosgames/core/realtime` (звезда: всё идёт через хоста).
//
// Роли:
//  • ХОСТ — координатор: принимает игроков, ведёт список (roster), назначает владельцев измерений,
//    хранит замороженные измерения и состояния игроков (для сейва и передачи хоста), пересылает.
//  • ВЛАДЕЛЕЦ ИЗМЕРЕНИЯ — считает мир своего измерения (net/sim): хост, если он там, иначе первый
//    вошедший игрок. Рассылает изменения блоков, сущности, блочные сущности.
//  • РЕПЛИКА — любой другой игрок в измерении: шлёт свои правки мира и действия с сущностями.
//
// Игрок и инвентарь — у КАЖДОГО свои (решение владельца 27.09.2026, вариант А): игрок сам считает
// себя (физику, голод, смерть, инвентарь), хост и владельцы измерений его только видят и «выдают»
// ему подобранное, урон и отброс.

import { ByteReader, ByteWriter } from "./codec";
import type { DimensionId } from "../world/Dimensions";
import type { DimensionSave, ItemStack, WorldSource } from "../types";
import type { NetEntityAction, NetEntitySnap } from "../entities/EntityManager";
import type { BlockEntity } from "../world/BlockEntities";

/** Версия протокола: разные версии не играют вместе (Hello → «обновите страницу»). */
export const PROTOCOL = 2;

export const M = {
  // ---- надёжный канал (rel)
  HELLO: 1, // гость → хост: JSON Hello
  WELCOME: 2, // хост → гость: JSON Welcome (сжатый)
  REJECT: 3, // хост → гость: JSON { reason }
  ROSTER: 4, // хост → все: JSON Roster
  PMETA: 6, // игрок → хост → все: JSON PlayerMeta (предмет в руке, режим, имя)
  BLOCKS: 7, // владелец → хост → все: двоичные изменения блоков
  EDITS: 8, // реплика → хост → владелец: двоичные правки
  ENT_SPAWN: 9, // владелец → хост → игроки измерения: JSON { dim, list: [id, snap][] }
  ENT_REMOVE: 11, // владелец → …: двоичный список id
  ENT_ACTION: 12, // реплика → хост → владелец: JSON { dim, from, action }
  BE: 13, // владелец/реплика ↔ хост ↔ все: JSON { dim, x, y, z, be }
  WORLD: 15, // хост → все: JSON WorldState (время, погода, сложность, Предел)
  CHAT: 16, // любой → хост → все: JSON { from?, text }
  HIT: 17, // владелец → хост → игрок: JSON Hit (урон, отброс, эффект)
  GIVE: 18, // владелец → хост → игрок: JSON Give (предмет, опыт)
  PSTATE: 19, // игрок → хост: JSON { state } — сейв игрока для мира хоста и передачи хоста
  DIM_ENTER: 20, // игрок → хост: JSON { dim, handoff? } — сменил измерение
  DIM_OWN: 21, // хост → игрок: JSON { dim, save } — теперь ты владелец измерения
  DIM_RESYNC: 22, // хост → владелец: JSON { dim } — пришли всем полный снимок сущностей
  SHADOW: 24, // хост → преемник: JSON Shadow (сжатый) — теневая копия мира
  COMMAND: 25, // игрок → хост: JSON { text } — команда мира (для операторов)
  BE_LIST: 26, // хост → игрок: JSON { dim, list } — блочные сущности измерения при входе
  LOCK: 27, // игрок → хост → владелец: JSON LockMsg — занять / отпустить контейнер
  REPLY: 28, // владелец → хост → игрок: JSON ReplyMsg — ответ на LOCK, отказ сесть
  PORTAL: 29, // игрок → хост → все: JSON PortalMsg — реестр порталов
  // ---- быстрый канал (fast)
  POSE: 5, // игрок → хост → все: двоичная поза
  ENT_POSE: 10, // владелец → …: двоичные позы сущностей
} as const;

// ============================================================ JSON-сообщения

export interface Hello {
  v: number;
  /** Хэш набора блоков и предметов: разные сборки игры не совместимы. */
  build: string;
  name: string;
}

export interface WorldMeta {
  source: WorldSource;
  palette: string[];
  time: unknown;
  weather: unknown;
  difficulty: string;
  beyond: unknown;
  portals: unknown;
  daysAwake: number;
  /** Имя мира у хоста — переходит к новому хосту вместе с миром. Нет у старого хоста. */
  name?: string;
}

export interface RosterEntry {
  slot: number;
  userId: string;
  name: string;
  dim: DimensionId;
  op: boolean;
}

export interface Roster {
  hostId: string;
  players: RosterEntry[];
  /** Владелец каждого «живого» измерения. */
  owners: Partial<Record<DimensionId, string>>;
  /** Настройки комнаты («Открыть для сети»). */
  settings: RoomSettings;
}

export interface RoomSettings {
  /** Режим, в котором входят гости. */
  guestMode: "survival" | "creative";
  /** Команды всем, а не только операторам. */
  cheatsForAll: boolean;
}

export interface Welcome {
  v: number;
  you: number;
  world: WorldMeta;
  /** Изменённые блоки ВСЕХ измерений: у гостя полная копия — на ней держится и передача хоста. */
  diffs: Partial<Record<DimensionId, DimensionSave["chunks"]>>;
  /** Где появиться и в каком измерении (у вернувшегося — там, где был). */
  spawn: { dim: DimensionId; pos: [number, number, number] };
  /** Сохранённое состояние этого игрока в мире хоста (вернулся в тот же мир). */
  state: unknown | null;
  roster: Roster;
}

export interface PlayerMeta {
  slot?: number;
  held: string | null;
  mode: "survival" | "creative";
  name: string;
}

export interface WorldState {
  time: unknown;
  weather: unknown;
  difficulty: string;
  beyond: unknown;
  daysAwake: number;
}

export interface Hit {
  to: number;
  amount: number;
  cause: string;
  /** Толчок (изменение скорости), который насчитал владелец измерения. */
  knock?: [number, number, number];
  effect?: { id: string; seconds: number; level: number };
}

export interface Give {
  to: number;
  stack?: ItemStack;
  xp?: number;
}

export interface EntSpawnMsg {
  dim: DimensionId;
  list: [number, NetEntitySnap][];
}

export interface EntActionMsg {
  dim: DimensionId;
  from?: number;
  action: NetEntityAction;
}

/**
 * Контейнер (сундук, печь, вьюк, вагонетка с грузом, житель при торговле) открыт — занят этим
 * игроком, пока он не закроет экран: двое, перекладывающие одно и то же, размножали бы предметы.
 * key: "b:x,y,z" — блочная сущность, "e:id" — сущность.
 */
export interface LockMsg {
  dim: DimensionId;
  from?: number;
  key: string;
  open: boolean;
}

export interface ReplyMsg {
  to: number;
  kind: "lock" | "ride";
  key?: string;
  id?: number;
  ok: boolean;
  /** Кто занял (имя) — для подсказки. */
  by?: string;
  /** Блочная сущность от владельца — открыть её, а не свою (добыча постройки катится у него). */
  be?: BlockEntity | null;
}

export interface PortalMsg {
  dim: DimensionId;
  p: [number, number, number];
  add: boolean;
}

export interface BeMsg {
  dim: DimensionId;
  x: number;
  y: number;
  z: number;
  be: BlockEntity | null;
}

export interface DimEnter {
  dim: DimensionId;
  /** Уходящий владелец отдаёт своё измерение: сущности и блочные сущности. */
  handoff?: { dim: DimensionId; save: DimensionSave };
}

export interface DimOwn {
  dim: DimensionId;
  save: DimensionSave;
}

export interface Shadow {
  world: WorldMeta;
  /** Замороженные и живые измерения хоста — с сущностями. */
  dims: Partial<Record<DimensionId, DimensionSave>>;
  players: Record<string, unknown>;
  settings: RoomSettings;
  ops: string[];
}

// ============================================================ двоичные сообщения

export const DIMS: readonly DimensionId[] = ["overworld", "inferno", "beyond"];
export const dimCode = (d: DimensionId): number => Math.max(0, DIMS.indexOf(d));
export const dimOf = (n: number): DimensionId => DIMS[n] ?? "overworld";

/** Поза игрока. Флаги — вид аватара. */
export interface Pose {
  slot: number;
  dim: DimensionId;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  flags: number;
  health: number;
}

export const POSE_SNEAK = 1,
  POSE_DEAD = 2,
  POSE_FLY = 4,
  POSE_GLIDE = 8,
  POSE_SWIM = 16,
  POSE_SWING = 32,
  POSE_CREATIVE = 64;

export function encodePose(p: Pose): Uint8Array {
  return new ByteWriter(24)
    .u8(M.POSE)
    .u8(p.slot)
    .u8(dimCode(p.dim))
    .f32(p.x)
    .f32(p.y)
    .f32(p.z)
    .angle(p.yaw)
    .angle(p.pitch)
    .u8(p.flags)
    .u8(Math.max(0, Math.min(255, Math.round(p.health * 10))))
    .finish();
}

export function decodePose(msg: Uint8Array): Pose {
  const r = new ByteReader(msg.subarray(1));
  return {
    slot: r.u8(),
    dim: dimOf(r.u8()),
    x: r.f32(),
    y: r.f32(),
    z: r.f32(),
    yaw: r.angle(),
    pitch: r.angle(),
    flags: r.u8(),
    health: r.u8() / 10,
  };
}

/** Переписать слот позы (хост пересылает позу гостя остальным под его слотом). */
export function withPoseSlot(msg: Uint8Array, slot: number): Uint8Array {
  const out = msg.slice();
  out[1] = slot;
  return out;
}

/** Изменение блока: мировые координаты, id и мета. */
export interface BlockDelta {
  x: number;
  y: number;
  z: number;
  id: number;
  meta: number;
}

/** BLOCKS / EDITS: [тип][dim][n u16] n × [x i32][y u16][z i32][id u16][meta u8] (13 байт). */
export function encodeBlocks(
  type: number,
  dim: DimensionId,
  list: readonly BlockDelta[],
): Uint8Array[] {
  const out: Uint8Array[] = [];
  // одно сообщение ≤ ~16 КБ, но и без того держим пачки небольшими: 1000 правок = 13 КБ
  for (let i = 0; i < list.length; i += 1000) {
    const part = list.slice(i, i + 1000);
    const w = new ByteWriter(4 + part.length * 13)
      .u8(type)
      .u8(dimCode(dim))
      .u16(part.length);
    for (const d of part) w.i32(d.x).u16(d.y).i32(d.z).u16(d.id).u8(d.meta);
    out.push(w.finish());
  }
  return out;
}

export function decodeBlocks(msg: Uint8Array): {
  dim: DimensionId;
  list: BlockDelta[];
} {
  const r = new ByteReader(msg.subarray(1));
  const dim = dimOf(r.u8());
  const n = r.u16();
  const list: BlockDelta[] = [];
  for (let i = 0; i < n; i++)
    list.push({
      x: r.i32(),
      y: r.u16(),
      z: r.i32(),
      id: r.u16(),
      meta: r.u8(),
    });
  return { dim, list };
}

/** Поза сущности (владелец → игроки измерения). */
export interface EntPose {
  id: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  flags: number;
  extra: number;
}

/** ENT_POSE: [тип][dim][n u16] n × [id u32][x f32][y f32][z f32][yaw i16][flags u8][extra u8] (20 байт). */
export function encodeEntPoses(
  dim: DimensionId,
  list: readonly EntPose[],
): Uint8Array[] {
  const out: Uint8Array[] = [];
  // быстрый канал не режет сообщения — держим каждое заметно меньше 16 КБ
  for (let i = 0; i < list.length; i += 600) {
    const part = list.slice(i, i + 600);
    const w = new ByteWriter(4 + part.length * 20)
      .u8(M.ENT_POSE)
      .u8(dimCode(dim))
      .u16(part.length);
    for (const p of part)
      w.u32(p.id)
        .f32(p.x)
        .f32(p.y)
        .f32(p.z)
        .angle(p.yaw)
        .u8(p.flags)
        .u8(p.extra);
    out.push(w.finish());
  }
  return out;
}

export function decodeEntPoses(msg: Uint8Array): {
  dim: DimensionId;
  list: EntPose[];
} {
  const r = new ByteReader(msg.subarray(1));
  const dim = dimOf(r.u8());
  const n = r.u16();
  const list: EntPose[] = [];
  for (let i = 0; i < n; i++)
    list.push({
      id: r.u32(),
      x: r.f32(),
      y: r.f32(),
      z: r.f32(),
      yaw: r.angle(),
      flags: r.u8(),
      extra: r.u8(),
    });
  return { dim, list };
}

/** ENT_REMOVE: [тип][dim][n u16] n × [id u32]. */
export function encodeEntRemove(
  dim: DimensionId,
  ids: readonly number[],
): Uint8Array {
  const w = new ByteWriter(4 + ids.length * 4)
    .u8(M.ENT_REMOVE)
    .u8(dimCode(dim))
    .u16(ids.length);
  for (const id of ids) w.u32(id);
  return w.finish();
}

export function decodeEntRemove(msg: Uint8Array): {
  dim: DimensionId;
  ids: number[];
} {
  const r = new ByteReader(msg.subarray(1));
  const dim = dimOf(r.u8());
  const n = r.u16();
  const ids: number[] = [];
  for (let i = 0; i < n; i++) ids.push(r.u32());
  return { dim, ids };
}

/**
 * Сборка игры: хэш имён блоков и предметов по порядку. У двух игроков с разными версиями id блоков
 * разошлись бы — один увидел бы на месте сундука печь.
 */
export function buildHash(
  blockNames: readonly string[],
  itemNames: readonly string[],
): string {
  let h = 0x811c9dc5;
  for (const s of [...blockNames, "|", ...itemNames])
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  return h.toString(16);
}
