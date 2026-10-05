// Воксельный raycast — DDA (Amanatides–Woo). O(дистанции), точные координаты
// блока и нормаль входа (= позиция для постановки). three.js Raycaster
// сознательно не используется: он O(треугольников) и не знает про блоки.
// Блоки не-кубы (ступени, факел, дверь) проверяются по коробкам выделения формы: луч проходит
// сквозь пустую часть клетки дальше.
import { BLOCKS } from "../registry/Blocks";
import { selectionBoxes, type Box } from "../registry/shapes";
import type { ChunkManager } from "./ChunkManager";

interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface RaycastHit {
  x: number;
  y: number;
  z: number;
  id: number;
  meta: number;
  /** Нормаль грани входа (куда ставить соседний блок). */
  nx: number;
  ny: number;
  nz: number;
  dist: number;
  /** Точка попадания в мировых координатах (половина плиты/ступеней при постановке). */
  hx: number;
  hy: number;
  hz: number;
}

/** Луч против коробок клетки: ближайший вход и нормаль. */
function rayBoxes(
  o: Vec3Like,
  d: Vec3Like,
  boxes: readonly Box[],
  bx: number,
  by: number,
  bz: number,
  maxDist: number,
): { t: number; nx: number; ny: number; nz: number } | null {
  const oo = [o.x, o.y, o.z],
    dd = [d.x, d.y, d.z],
    base = [bx, by, bz];
  let best: { t: number; nx: number; ny: number; nz: number } | null = null;
  for (const b of boxes) {
    let t0 = 0,
      t1 = maxDist,
      axis = -1,
      sign = 0,
      ok = true;
    for (let a = 0; a < 3; a++) {
      const mn = base[a]! + b[a]!,
        mx = base[a]! + b[a + 3]!;
      if (Math.abs(dd[a]!) < 1e-12) {
        if (oo[a]! < mn || oo[a]! > mx) {
          ok = false;
          break;
        }
        continue;
      }
      let ta = (mn - oo[a]!) / dd[a]!,
        tb = (mx - oo[a]!) / dd[a]!,
        s = -1; // вход через min-грань — нормаль -1
      if (ta > tb) {
        [ta, tb] = [tb, ta];
        s = 1;
      }
      if (ta > t0) {
        t0 = ta;
        axis = a;
        sign = s;
      }
      t1 = Math.min(t1, tb);
      if (t0 > t1) {
        ok = false;
        break;
      }
    }
    if (!ok || (best && t0 >= best.t)) continue;
    best = {
      t: t0,
      nx: axis === 0 ? sign : 0,
      ny: axis === 1 ? sign : 0,
      nz: axis === 2 ? sign : 0,
    };
  }
  return best;
}

/**
 * @param world
 * @param origin — точка глаза
 * @param dir — нормализованное направление
 * @param maxDist
 * @param hitLiquid — попадать ли по жидкости (ведро)
 */
export function raycastBlocks(
  world: ChunkManager,
  origin: Vec3Like,
  dir: Vec3Like,
  maxDist: number,
  hitLiquid = false,
): RaycastHit | null {
  let x = Math.floor(origin.x),
    y = Math.floor(origin.y),
    z = Math.floor(origin.z);

  const stepX = Math.sign(dir.x),
    stepY = Math.sign(dir.y),
    stepZ = Math.sign(dir.z);
  const tDeltaX = stepX ? Math.abs(1 / dir.x) : Infinity;
  const tDeltaY = stepY ? Math.abs(1 / dir.y) : Infinity;
  const tDeltaZ = stepZ ? Math.abs(1 / dir.z) : Infinity;

  const frac = (v: number): number => v - Math.floor(v);
  let tMaxX =
    stepX > 0
      ? (1 - frac(origin.x)) * tDeltaX
      : stepX < 0
        ? frac(origin.x) * tDeltaX
        : Infinity;
  let tMaxY =
    stepY > 0
      ? (1 - frac(origin.y)) * tDeltaY
      : stepY < 0
        ? frac(origin.y) * tDeltaY
        : Infinity;
  let tMaxZ =
    stepZ > 0
      ? (1 - frac(origin.z)) * tDeltaZ
      : stepZ < 0
        ? frac(origin.z) * tDeltaZ
        : Infinity;

  const hit = (
    t: number,
    id: number,
    meta: number,
    nx: number,
    ny: number,
    nz: number,
  ): RaycastHit => ({
    x,
    y,
    z,
    id,
    meta,
    nx,
    ny,
    nz,
    dist: t,
    hx: origin.x + dir.x * t,
    hy: origin.y + dir.y * t,
    hz: origin.z + dir.z * t,
  });

  let nx = 0,
    ny = 0,
    nz = 0,
    t = 0;
  while (t <= maxDist) {
    const id = world.getBlock(x, y, z);
    const def = id !== 0 ? BLOCKS[id] : undefined;
    if (def && (!def.liquid || hitLiquid)) {
      const meta = world.getMeta(x, y, z);
      if (def.shape === "cube" || def.liquid)
        return hit(t, id, meta, nx, ny, nz);
      const cx = x,
        cy = y,
        cz = z;
      const ctx = {
        neighbor: (dx: number, dy: number, dz: number) =>
          world.getBlock(cx + dx, cy + dy, cz + dz),
      };
      const r = rayBoxes(
        origin,
        dir,
        selectionBoxes(def, meta, ctx),
        x,
        y,
        z,
        maxDist,
      );
      if (r) return hit(r.t, id, meta, r.nx, r.ny, r.nz);
    }

    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX;
      t = tMaxX;
      tMaxX += tDeltaX;
      nx = -stepX;
      ny = 0;
      nz = 0;
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      t = tMaxY;
      tMaxY += tDeltaY;
      nx = 0;
      ny = -stepY;
      nz = 0;
    } else {
      z += stepZ;
      t = tMaxZ;
      tMaxZ += tDeltaZ;
      nx = 0;
      ny = 0;
      nz = -stepZ;
    }
  }
  return null;
}
