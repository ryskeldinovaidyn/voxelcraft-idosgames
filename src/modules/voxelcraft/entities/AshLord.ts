// Призыв Пепельного владыки, как иссушителя в Minecraft: Т из четырёх блоков песка душ (три в ряд
// и один под серединой), на верхнем ряду — три пепельных черепа, нижние углы по бокам ножки пусты.
// Проверяется, когда ставят череп: он может быть любым из трёх, ряд — вдоль x или вдоль z.
import { BLOCKS, B } from "../registry/Blocks";

type GetBlock = (x: number, y: number, z: number) => number;

export interface Altar {
  /** Где появится владыка: низ ножки Т (клетка, из которой он встаёт). */
  x: number;
  y: number;
  z: number;
  /** Клетки черепов и песка — их убирают при призыве. */
  cells: [number, number, number][];
}

/** Пустая или заменяемая клетка (воздух, трава, снег). */
const clear = (id: number): boolean => id === 0 || !!BLOCKS[id]?.replaceable;

/** Готовый алтарь, частью которого стал череп в (x, y, z), или null. */
export function findAltar(
  get: GetBlock,
  x: number,
  y: number,
  z: number,
): Altar | null {
  const skull = B.ash_skull,
    sand = B.soul_sand;
  if (skull === undefined || sand === undefined || get(x, y, z) !== skull)
    return null;
  for (const [ax, az] of [
    [1, 0],
    [0, 1],
  ] as const)
    for (let k = -2; k <= 0; k++) {
      // середина ряда: череп стоит на позиции k+1 от начала ряда
      const mx = x + ax * (k + 1),
        mz = z + az * (k + 1);
      const row = [-1, 0, 1].map((i) => [mx + ax * i, mz + az * i] as const);
      if (
        !row.every(
          ([rx, rz]) => get(rx, y, rz) === skull && get(rx, y - 1, rz) === sand,
        )
      )
        continue;
      if (get(mx, y - 2, mz) !== sand) continue;
      if (
        !clear(get(mx - ax, y - 2, mz - az)) ||
        !clear(get(mx + ax, y - 2, mz + az))
      )
        continue;
      const cells: [number, number, number][] = [];
      for (const [rx, rz] of row) cells.push([rx, y, rz], [rx, y - 1, rz]);
      cells.push([mx, y - 2, mz]);
      return { x: mx + 0.5, y: y - 2, z: mz + 0.5, cells };
    }
  return null;
}
