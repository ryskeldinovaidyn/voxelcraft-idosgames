// Портал в Пекло, как в Minecraft: рамка из обсидиана (внутри от 2×3 до 21×21, углы не нужны),
// огонь внутри зажигает её. На той стороне ищется портал поблизости, нет — строится новый (рамка
// 4×5; если стоять не на чем — с обсидиановой площадкой). Переход и масштаб координат — main.ts.
import { BLOCKS, B } from "../registry/Blocks";
import { portalState } from "./Support";
import { DIMENSION_IDS, type DimensionId } from "./Dimensions";
import type { ChunkManager } from "./ChunkManager";

export interface PortalFrame {
  /** Нижняя левая клетка внутренности. */
  x0: number;
  y0: number;
  z0: number;
  width: number;
  height: number;
  /** 0 — ширина вдоль x, 1 — вдоль z. */
  axis: 0 | 1;
}

/** Мета блока портала: плоскость x-y — 0, плоскость z-y — 2 (коробки — registry/shapes). */
export const portalMeta = (axis: 0 | 1): number => (axis === 0 ? 0 : 2);

const MAX = 21;

/** Рамка вокруг пустой клетки (x, y, z) в плоскости оси axis; null — рамки нет. */
export function findFrame(
  w: ChunkManager,
  x: number,
  y: number,
  z: number,
  axis: 0 | 1,
): PortalFrame | null {
  const dx = axis === 0 ? 1 : 0,
    dz = 1 - dx;
  const obs = (ax: number, ay: number, az: number): boolean =>
    w.getBlock(ax, ay, az) === B.obsidian;
  const empty = (ax: number, ay: number, az: number): boolean => {
    const b = w.getBlock(ax, ay, az);
    return b === B.air || b === B.fire;
  };
  if (!empty(x, y, z)) return null;
  let y0 = y;
  while (y - y0 < MAX && empty(x, y0 - 1, z)) y0--;
  if (!obs(x, y0 - 1, z)) return null;
  let left = 0;
  while (left < MAX && empty(x - dx * (left + 1), y0, z - dz * (left + 1)))
    left++;
  let right = 0;
  while (right < MAX && empty(x + dx * (right + 1), y0, z + dz * (right + 1)))
    right++;
  const width = left + right + 1;
  if (width < 2 || width > MAX) return null;
  const x0 = x - dx * left,
    z0 = z - dz * left;
  let height = 0;
  while (height < MAX && empty(x0, y0 + height, z0)) height++;
  if (height < 3 || height > MAX) return null;
  for (let i = 0; i < width; i++) {
    const cx = x0 + dx * i,
      cz = z0 + dz * i;
    if (!obs(cx, y0 - 1, cz) || !obs(cx, y0 + height, cz)) return null;
    for (let j = 0; j < height; j++) if (!empty(cx, y0 + j, cz)) return null;
  }
  for (let j = 0; j < height; j++)
    if (
      !obs(x0 - dx, y0 + j, z0 - dz) ||
      !obs(x0 + dx * width, y0 + j, z0 + dz * width)
    )
      return null;
  return { x0, y0, z0, width, height, axis };
}

function fillPortal(w: ChunkManager, f: PortalFrame): void {
  const dx = f.axis === 0 ? 1 : 0,
    dz = 1 - dx;
  portalState.filling = true;
  try {
    for (let i = 0; i < f.width; i++)
      for (let j = 0; j < f.height; j++)
        w.setBlock(
          f.x0 + dx * i,
          f.y0 + j,
          f.z0 + dz * i,
          B.inferno_portal!,
          portalMeta(f.axis),
        );
  } finally {
    portalState.filling = false;
  }
}

/** Огонь в (x, y, z): если это внутренность рамки — залить её порталом. */
export function tryLightPortal(
  w: ChunkManager,
  x: number,
  y: number,
  z: number,
): boolean {
  for (const axis of [0, 1] as const) {
    const f = findFrame(w, x, y, z, axis);
    if (!f) continue;
    fillPortal(w, f);
    return true;
  }
  return false;
}

/** Ближайший портал в квадрате radius вокруг (x, z) по всей высоте — нижняя клетка; null — нет. */
export function findPortalNear(
  w: ChunkManager,
  x: number,
  z: number,
  radius: number,
): { x: number; y: number; z: number } | null {
  let best: { x: number; y: number; z: number } | null = null;
  let bestD = Infinity;
  for (let dx = -radius; dx <= radius; dx++)
    for (let dz = -radius; dz <= radius; dz++) {
      const d = dx * dx + dz * dz;
      if (d >= bestD) continue;
      for (let y = 1; y < 127; y++)
        if (
          w.getBlock(x + dx, y, z + dz) === B.inferno_portal &&
          w.getBlock(x + dx, y - 1, z + dz) !== B.inferno_portal
        ) {
          best = { x: x + dx, y, z: z + dz };
          bestD = d;
          break;
        }
    }
  return best;
}

/** Рамка 4×5 вдоль x с внутренностью 2×3 на полу y; сначала обсидиан, потом портал. */
function frameAt(
  w: ChunkManager,
  x: number,
  y: number,
  z: number,
): { x: number; y: number; z: number } {
  for (let i = -1; i <= 2; i++)
    for (let j = -1; j <= 3; j++)
      if (i === -1 || i === 2 || j === -1 || j === 3)
        w.setBlock(x + i, y + j, z, B.obsidian!);
  fillPortal(w, { x0: x, y0: y, z0: z, width: 2, height: 3, axis: 0 });
  return { x, y, z };
}

/**
 * Построить портал у (x, z): на ближайшем ровном месте (твёрдый пол, 4 блока воздуха над ним и по
 * клетке с боков), сверху вниз в [minY, maxY]; места нет — вырезать пустоту на высоте preferY и
 * положить обсидиановую площадку. Возвращает нижнюю клетку портала.
 */
export function buildPortal(
  w: ChunkManager,
  x: number,
  z: number,
  preferY: number,
  minY: number,
  maxY: number,
): { x: number; y: number; z: number } {
  const solid = (ax: number, ay: number, az: number): boolean =>
    BLOCKS[w.getBlock(ax, ay, az)]?.solid ?? false;
  const air = (ax: number, ay: number, az: number): boolean =>
    w.getBlock(ax, ay, az) === B.air;
  const fits = (bx: number, by: number, bz: number): boolean => {
    for (let i = -1; i <= 2; i++) {
      if (!solid(bx + i, by - 1, bz)) return false;
      for (let j = 0; j < 4; j++)
        for (const k of [-1, 0, 1])
          if (!air(bx + i, by + j, bz + k)) return false;
    }
    return true;
  };
  for (let r = 0; r <= 16; r++)
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        for (let y = maxY; y >= minY; y--)
          if (fits(x + dx, y, z + dz)) return frameAt(w, x + dx, y, z + dz);
      }
  const y = Math.max(minY, Math.min(maxY, preferY));
  for (let i = -2; i <= 3; i++)
    for (let k = -2; k <= 2; k++) {
      w.setBlock(x + i, y - 1, z + k, B.obsidian!);
      for (let j = 0; j < 4; j++) w.setBlock(x + i, y + j, z + k, B.air!);
    }
  return frameAt(w, x, y, z);
}

/** Известные порталы по измерениям — клетка внутри каждого (сейв v3, поле `portals`). */
export type KnownPortals = Record<DimensionId, [number, number, number][]>;

/** Список порталов из сейва (чужие данные): битые записи отбрасываются; null — пустой список. */
export function portalsOf(v: unknown): KnownPortals {
  const out: KnownPortals = { overworld: [], inferno: [], beyond: [] };
  if (typeof v !== "object" || v === null) return out;
  const rec = v as Record<string, unknown>;
  for (const d of DIMENSION_IDS) {
    const list = rec[d];
    if (!Array.isArray(list)) continue;
    for (const p of list as unknown[]) {
      if (!Array.isArray(p) || p.length !== 3) continue;
      const [a, b, c] = p as unknown[];
      if (Number.isInteger(a) && Number.isInteger(b) && Number.isInteger(c))
        out[d].push([a as number, b as number, c as number]);
    }
  }
  return out;
}
