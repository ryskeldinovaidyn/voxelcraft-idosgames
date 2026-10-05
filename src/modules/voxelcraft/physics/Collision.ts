// Коллизии тел с блоками по коробкам форм (registry/shapes.ts) — общий код для игрока и мобов.
// Алгоритм Minecraft: собрать коробки блоков вокруг пути, «срезать» перемещение по осям Y → X → Z
// (тело упирается в ближайшую грань), затем попробовать шаг вверх на ступень или плиту.
// Тонкие стенки не пробиваются: срез идёт по граням, а не по клеткам.
import { BLOCKS } from "../registry/Blocks";
import { collisionBoxes } from "../registry/shapes";
import type { ChunkManager } from "../world/ChunkManager";

/** Тело: центр подошвы (x, z), низ (y), полуширина и высота. */
export interface Body {
  x: number;
  y: number;
  z: number;
  hw: number;
  h: number;
}

export interface MoveOptions {
  /** Высота шага вверх (0.6 у игрока на земле; 0 — не шагать). */
  step?: number;
  /** Не сходить с края (крадущийся шаг). */
  sneak?: boolean;
  /** Тело стояло на земле в начале шага. */
  onGround?: boolean;
  /** Не твёрдые блоки, которые для этого тела — полный куб (снег-порох под кожаными ботинками). */
  extraSolid?: (id: number) => boolean;
}

export interface MoveResult {
  dx: number;
  dy: number;
  dz: number;
  hitX: boolean;
  hitZ: boolean;
  /** Упёрлись вниз (стоим на земле) — в том числе после шага на ступень. */
  hitDown: boolean;
  hitUp: boolean;
}

const EPS = 1e-7;
const scratch: number[] = [];

/** Коробки коллизии блоков в области (мировые координаты, по 6 чисел подряд). */
export function gatherBoxes(
  world: ChunkManager,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
  out: number[],
  extraSolid?: (id: number) => boolean,
): void {
  out.length = 0;
  const x0 = Math.floor(minX),
    x1 = Math.floor(maxX);
  const y0 = Math.floor(minY) - 1, // забор и стена выше своей клетки (1.5)
    y1 = Math.floor(maxY);
  const z0 = Math.floor(minZ),
    z1 = Math.floor(maxZ);
  for (let y = y0; y <= y1; y++)
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) {
        const id = world.getBlock(x, y, z);
        if (id === 0) {
          // незагруженный чанк — стена, как в Minecraft: тело ждёт генерации, а не проваливается
          // сквозь ещё не построенную землю (и не копит высоту падения)
          if (y >= 0 && world.getBlockOrUnloaded(x, y, z) === -1)
            out.push(x, y, z, x + 1, y + 1, z + 1);
          continue;
        }
        const def = BLOCKS[id];
        if (!def?.solid) {
          if (extraSolid?.(id)) out.push(x, y, z, x + 1, y + 1, z + 1);
          continue;
        }
        if (def.shape === "cube") {
          out.push(x, y, z, x + 1, y + 1, z + 1);
          continue;
        }
        const ctx = {
          neighbor: (dx: number, dy: number, dz: number) =>
            world.getBlock(x + dx, y + dy, z + dz),
        };
        for (const b of collisionBoxes(def, world.getMeta(x, y, z), ctx))
          out.push(x + b[0], y + b[1], z + b[2], x + b[3], y + b[4], z + b[5]);
      }
}

/** Срезать перемещение d по оси (0 x, 1 y, 2 z): тело `a` упирается в ближайшую коробку. */
function clipAxis(bx: number[], a: number[], axis: number, d: number): number {
  if (d === 0) return 0;
  const u = (axis + 1) % 3,
    w = (axis + 2) % 3;
  for (let i = 0; i < bx.length; i += 6) {
    if (bx[i + 3 + u]! <= a[u]! + EPS || bx[i + u]! >= a[3 + u]! - EPS)
      continue;
    if (bx[i + 3 + w]! <= a[w]! + EPS || bx[i + w]! >= a[3 + w]! - EPS)
      continue;
    if (d > 0 && a[3 + axis]! <= bx[i + axis]! + EPS)
      d = Math.min(d, bx[i + axis]! - a[3 + axis]!);
    else if (d < 0 && a[axis]! >= bx[i + 3 + axis]! - EPS)
      d = Math.max(d, bx[i + 3 + axis]! - a[axis]!);
  }
  return d;
}

function shift(a: number[], axis: number, d: number): void {
  a[axis] = a[axis]! + d;
  a[3 + axis] = a[3 + axis]! + d;
}

/** Пересекает ли коробка [x0..x1]×[y0..y1]×[z0..z1] хоть одну из собранных. */
function overlaps(
  bx: number[],
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
): boolean {
  for (let i = 0; i < bx.length; i += 6)
    if (
      bx[i]! < x1 - EPS &&
      bx[i + 3]! > x0 + EPS &&
      bx[i + 1]! < y1 - EPS &&
      bx[i + 4]! > y0 + EPS &&
      bx[i + 2]! < z1 - EPS &&
      bx[i + 5]! > z0 + EPS
    )
      return true;
  return false;
}

/** Переместить тело на (dx, dy, dz) с коллизиями. Возвращает фактическое смещение и упоры. */
export function moveBody(
  world: ChunkManager,
  b: Body,
  dx: number,
  dy: number,
  dz: number,
  opts: MoveOptions = {},
): MoveResult {
  const step = opts.step ?? 0;
  const start = [
    b.x - b.hw,
    b.y,
    b.z - b.hw,
    b.x + b.hw,
    b.y + b.h,
    b.z + b.hw,
  ];
  const reach = Math.max(step, opts.sneak ? 0.6 : 0);
  gatherBoxes(
    world,
    start[0]! + Math.min(0, dx),
    start[1]! + Math.min(0, dy) - reach,
    start[2]! + Math.min(0, dz),
    start[3]! + Math.max(0, dx),
    start[4]! + Math.max(0, dy) + step,
    start[5]! + Math.max(0, dz),
    scratch,
    opts.extraSolid,
  );

  // Крадущийся шаг: не сходить с края — укорачиваем шаг, пока под смещённым телом есть опора.
  if (opts.sneak && opts.onGround) {
    const down = step > 0 ? step : 0.6;
    const free = (ox: number, oz: number): boolean =>
      !overlaps(
        scratch,
        start[0]! + ox,
        start[1]! - down,
        start[2]! + oz,
        start[3]! + ox,
        start[4]! - down,
        start[5]! + oz,
      );
    const cut = (v: number): number =>
      Math.abs(v) < 0.05 ? 0 : v - Math.sign(v) * 0.05;
    while (dx !== 0 && free(dx, 0)) dx = cut(dx);
    while (dz !== 0 && free(0, dz)) dz = cut(dz);
    while (dx !== 0 && dz !== 0 && free(dx, dz)) {
      dx = cut(dx);
      dz = cut(dz);
    }
  }

  const odx = dx,
    ody = dy,
    odz = dz;
  const a = start.slice();
  dy = clipAxis(scratch, a, 1, dy);
  shift(a, 1, dy);
  dx = clipAxis(scratch, a, 0, dx);
  shift(a, 0, dx);
  dz = clipAxis(scratch, a, 2, dz);
  shift(a, 2, dz);
  let hitDown = ody < 0 && dy > ody + EPS;

  // Шаг вверх: подняться на step, пройти по горизонтали, опуститься — если так прошли дальше.
  const blocked = Math.abs(dx - odx) > EPS || Math.abs(dz - odz) > EPS;
  if (step > 0 && blocked && (opts.onGround || hitDown)) {
    const s = start.slice();
    const up = clipAxis(scratch, s, 1, step);
    shift(s, 1, up);
    const sx = clipAxis(scratch, s, 0, odx);
    shift(s, 0, sx);
    const sz = clipAxis(scratch, s, 2, odz);
    shift(s, 2, sz);
    const settle = clipAxis(scratch, s, 1, -up + Math.min(0, ody));
    shift(s, 1, settle);
    if (sx * sx + sz * sz > dx * dx + dz * dz + EPS) {
      for (let i = 0; i < 6; i++) a[i] = s[i]!;
      dx = sx;
      dz = sz;
      dy = up + settle;
      hitDown = true;
    }
  }

  return {
    dx: a[0]! - start[0]!,
    dy: a[1]! - start[1]!,
    dz: a[2]! - start[2]!,
    hitX: Math.abs(dx - odx) > EPS,
    hitZ: Math.abs(dz - odz) > EPS,
    hitDown,
    hitUp: ody > 0 && dy < ody - EPS,
  };
}
