// Рельсы, как в Minecraft. Форма — мета: 0 север–юг, 1 запад–восток, 2..5 подъём на восток, запад,
// север, юг, 6..9 повороты юг–восток, юг–запад, север–запад, север–восток. Повороты — только у
// обычных рельсов; у разгонных и нажимных форма в битах 0..2, бит RAIL_POWERED — «под током».
// Форма выбирается сама по соседним рельсам (при постановке и когда соседи меняются). Вагонетка
// (entities/Minecart) едет по отрезку между двумя выходами клетки: на повороте — по диагонали.
import { B } from "../registry/Blocks";
import type { ChunkManager } from "./ChunkManager";

export const RAIL_POWERED = 0x8;

export const isRail = (id: number): boolean =>
  id === B.rail ||
  id === B.powered_rail ||
  id === B.detector_rail ||
  id === B.activator_rail;

/** Форма рельса из меты. */
export const railShape = (id: number, meta: number): number =>
  id === B.rail ? meta & 15 : meta & 7;

/** Подъём ли (формы 2..5). */
export const isAscending = (shape: number): boolean => shape >= 2 && shape <= 5;

type P = [number, number, number];
const N = (y: number): P => [0.5, y, 0];
const S = (y: number): P => [0.5, y, 1];
const W = (y: number): P => [0, y, 0.5];
const E = (y: number): P => [1, y, 0.5];

/** Выходы формы в координатах клетки (x, y, z ∈ 0..1). */
const EXITS: readonly [P, P][] = [
  [N(0), S(0)],
  [W(0), E(0)],
  [W(0), E(1)],
  [W(1), E(0)],
  [N(1), S(0)],
  [N(0), S(1)],
  [S(0), E(0)],
  [S(0), W(0)],
  [N(0), W(0)],
  [N(0), E(0)],
];

/** Два выхода рельса формы `shape` в клетке (x, y, z) — мировые точки. */
export function railPoints(
  shape: number,
  x: number,
  y: number,
  z: number,
): [P, P] {
  const [a, b] = EXITS[shape] ?? EXITS[0]!;
  return [
    [x + a[0], y + a[1], z + a[2]],
    [x + b[0], y + b[1], z + b[2]],
  ];
}

/**
 * Форма для рельса в (x,y,z) по соседям: подъём к рельсу на блок выше, поворот, если соседи с двух
 * соседних сторон (только `curves`), иначе прямой вдоль соседей (по умолчанию север–юг).
 */
export function railShapeFor(
  w: ChunkManager,
  x: number,
  y: number,
  z: number,
  curves: boolean,
): number {
  const at = (dx: number, dz: number): number | null => {
    for (const dy of [0, 1, -1])
      if (isRail(w.getBlock(x + dx, y + dy, z + dz))) return dy;
    return null;
  };
  const n = at(0, -1),
    s = at(0, 1),
    wst = at(-1, 0),
    e = at(1, 0);
  if (e === 1) return 2;
  if (wst === 1) return 3;
  if (n === 1) return 4;
  if (s === 1) return 5;
  if (curves) {
    const ns = (n !== null ? 1 : 0) + (s !== null ? 1 : 0);
    const ew = (wst !== null ? 1 : 0) + (e !== null ? 1 : 0);
    if (ns === 1 && ew === 1) {
      if (s !== null) return e !== null ? 6 : 7;
      return wst !== null ? 8 : 9;
    }
  }
  if ((e !== null || wst !== null) && n === null && s === null) return 1;
  return 0;
}

export interface RailHit {
  x: number;
  y: number;
  z: number;
  id: number;
  meta: number;
  shape: number;
}

/** Рельс, по которому едет тело в точке p: в своей клетке или подъём клеткой ниже. */
export function railUnder(
  w: ChunkManager,
  px: number,
  py: number,
  pz: number,
): RailHit | null {
  const x = Math.floor(px),
    y = Math.floor(py + 0.1),
    z = Math.floor(pz);
  for (const cy of [y, y - 1]) {
    const id = w.getBlock(x, cy, z);
    if (!isRail(id)) continue;
    const meta = w.getMeta(x, cy, z);
    const shape = railShape(id, meta);
    if (cy === y || isAscending(shape)) return { x, y: cy, z, id, meta, shape };
  }
  return null;
}
