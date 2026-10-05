// Карты, как в Minecraft: заполненная карта — участок 128×128 блоков, выровненный по сетке
// (центр — кратен 128). Пока карта в руке, местность вокруг игрока (радиус 48) прорисовывается
// цветом верхнего блока (BlockDef.mapColor): склон к северу светлее, от севера — темнее, вода — по
// глубине. Пиксель: 0 — не разведано, иначе (id блока << 2 | тень) + 1. Хранит Game (сейв v3 `maps`),
// показывает HUD, у предмета filled_map — tag.map = номер карты.
import { BLOCKS, B } from "../registry/Blocks";
import type { ChunkManager } from "../world/ChunkManager";

export const MAP_SIZE = 128;

export interface MapData {
  id: number;
  /** Северо-западный угол участка (мировые x, z). */
  x0: number;
  z0: number;
  /** Измерение, в котором карту завели. */
  dim: string;
  px: Uint16Array;
  /** Растёт при каждом изменении — HUD перерисовывает холст только тогда. */
  version: number;
  /** Карта сокровищ: крестик над зарытым кладом (мировые x, z). */
  target?: [number, number];
}

/** Угол участка карты для точки: центр участка кратен 128, как в Minecraft. */
export const mapCorner = (v: number): number =>
  Math.floor((v + 64) / MAP_SIZE) * MAP_SIZE - 64;

export function newMap(id: number, x: number, z: number, dim: string): MapData {
  return {
    id,
    x0: mapCorner(x),
    z0: mapCorner(z),
    dim,
    px: new Uint16Array(MAP_SIZE * MAP_SIZE),
    version: 0,
  };
}

/** Верх столба: блок, высота и глубина воды (0 — не вода); null — чанк не загружен. */
function column(
  world: ChunkManager,
  x: number,
  z: number,
): { id: number; y: number; water: number } | null {
  const ch = world.chunkAt(x, z);
  if (!ch || !ch.generated) return null;
  const lx = x & 15,
    lz = z & 15;
  for (let y = ch.top; y >= 0; y--) {
    const id = ch.get(lx, y, lz);
    if (id === 0) continue;
    if (id === B.water) {
      let d = 1;
      while (y - d >= 0 && ch.get(lx, y - d, lz) === B.water) d++;
      return { id, y, water: d };
    }
    return { id, y, water: 0 };
  }
  return null;
}

/**
 * Разведать строки карты с номером `phase` (z mod 4) в круге радиуса `radius` вокруг игрока — за
 * четыре вызова весь круг: нагрузка размазана по тикам. @returns изменилось ли что-нибудь
 */
export function surveyMap(
  world: ChunkManager,
  m: MapData,
  px: number,
  pz: number,
  radius: number,
  phase: number,
): boolean {
  let changed = false;
  const xa = Math.max(m.x0, Math.floor(px - radius)),
    xb = Math.min(m.x0 + MAP_SIZE - 1, Math.floor(px + radius));
  const za = Math.max(m.z0, Math.floor(pz - radius)),
    zb = Math.min(m.z0 + MAP_SIZE - 1, Math.floor(pz + radius));
  for (let z = za; z <= zb; z++) {
    if (((z % 4) + 4) % 4 !== (phase & 3)) continue;
    for (let x = xa; x <= xb; x++) {
      if ((x + 0.5 - px) ** 2 + (z + 0.5 - pz) ** 2 > radius * radius) continue;
      const c = column(world, x, z);
      if (!c) continue;
      let shade = 1;
      if (c.water > 0) shade = c.water < 3 ? 2 : c.water < 6 ? 1 : 0;
      else {
        const n = column(world, x, z - 1);
        if (n) shade = c.y > n.y ? 2 : c.y < n.y ? 0 : 1;
      }
      const v = ((c.id << 2) | shade) + 1;
      const i = x - m.x0 + (z - m.z0) * MAP_SIZE;
      if (m.px[i] !== v) {
        m.px[i] = v;
        changed = true;
      }
    }
  }
  if (changed) m.version++;
  return changed;
}

const SHADE = [0.71, 0.86, 1];

/** Цвет пикселя 0xRRGGBB; -1 — не разведано. */
export function mapRGB(v: number): number {
  if (!v) return -1;
  const id = (v - 1) >> 2,
    f = SHADE[(v - 1) & 3] ?? 1;
  const c = BLOCKS[id]?.mapColor ?? 0x808080;
  const r = Math.round(((c >> 16) & 255) * f),
    g = Math.round(((c >> 8) & 255) * f),
    b = Math.round((c & 255) * f);
  return (r << 16) | (g << 8) | b;
}

export interface MapSave {
  id: number;
  x0: number;
  z0: number;
  dim: string;
  /** Пиксели — Uint16 little-endian в base64. */
  px: string;
  target?: [number, number];
}

export function serializeMap(m: MapData): MapSave {
  const bytes = new Uint8Array(m.px.buffer, m.px.byteOffset, m.px.byteLength);
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192)
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return {
    id: m.id,
    x0: m.x0,
    z0: m.z0,
    dim: m.dim,
    px: btoa(s),
    ...(m.target ? { target: m.target } : {}),
  };
}

export function deserializeMap(d: unknown): MapData | null {
  if (!d || typeof d !== "object") return null;
  const o = d as Partial<MapSave>;
  if (
    ![o.id, o.x0, o.z0].every((v) => typeof v === "number") ||
    typeof o.px !== "string"
  )
    return null;
  try {
    const bin = atob(o.px);
    if (bin.length !== MAP_SIZE * MAP_SIZE * 2) return null;
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return {
      id: o.id!,
      x0: o.x0!,
      z0: o.z0!,
      dim: typeof o.dim === "string" ? o.dim : "overworld",
      px: new Uint16Array(bytes.buffer),
      version: 1,
      ...(Array.isArray(o.target) &&
      o.target.length === 2 &&
      o.target.every((v) => typeof v === "number")
        ? { target: [o.target[0], o.target[1]] as [number, number] }
        : {}),
    };
  } catch {
    return null;
  }
}
