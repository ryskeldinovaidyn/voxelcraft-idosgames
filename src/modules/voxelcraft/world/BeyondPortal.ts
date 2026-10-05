// Портал Предела, как в Minecraft: кольцо из 12 рамок вокруг квадрата 3×3 (углы пустые); когда во
// всех рамках есть Око, квадрат заливается порталом. Рамки ставит цитадель (или игрок в креативе).
import { B } from "../registry/Blocks";
import { TOP } from "../registry/meta";
import type { ChunkManager } from "./ChunkManager";

/** Смещения 12 рамок от центра портала. */
export const FRAME_RING: readonly (readonly [number, number])[] = [
  [-1, -2],
  [0, -2],
  [1, -2],
  [-1, 2],
  [0, 2],
  [1, 2],
  [-2, -1],
  [-2, 0],
  [-2, 1],
  [2, -1],
  [2, 0],
  [2, 1],
];

/** Око вставлено в рамку (x, y, z): если кольцо собрано — залить портал. */
export function tryLightBeyondPortal(
  w: ChunkManager,
  x: number,
  y: number,
  z: number,
): boolean {
  const lit = (ax: number, az: number): boolean =>
    w.getBlock(ax, y, az) === B.rim_frame && (w.getMeta(ax, y, az) & TOP) !== 0;
  for (const [fx, fz] of FRAME_RING) {
    const cx = x - fx,
      cz = z - fz;
    if (!FRAME_RING.every(([dx, dz]) => lit(cx + dx, cz + dz))) continue;
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++)
        w.setBlock(cx + dx, y, cz + dz, B.beyond_portal!);
    return true;
  }
  return false;
}
