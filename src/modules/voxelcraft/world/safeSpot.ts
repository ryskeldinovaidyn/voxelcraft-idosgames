// Безопасная точка для игрока: спавн, возрождение, якорь. Верх колонки по `surfaceY` — это верхний
// ТВЁРДЫЙ блок, а снег-порох, вода и лава не твёрдые: без этой проверки игрок возрождался на дне
// ямы снега-пороха, замерзал и возрождался там же снова.
import { BLOCKS, B } from "../registry/Blocks";

export interface SpotWorld {
  getBlock(x: number, y: number, z: number): number;
  surfaceY(x: number, z: number): number;
}

/** Клетка, где может быть тело: не твёрдая, не жидкость, не снег-порох, не огонь. */
function roomy(id: number): boolean {
  const def = BLOCKS[id];
  if (!def) return id === 0;
  return (
    !def.solid &&
    !def.liquid &&
    !def.waterlogged &&
    id !== B.powder_snow &&
    id !== B.fire &&
    id !== B.soul_fire
  );
}

/** Можно ли встать ногами в клетку (x, y, z): твёрдый пол под ней и две клетки на рост. */
export function isStandable(
  w: SpotWorld,
  x: number,
  y: number,
  z: number,
): boolean {
  const floor = BLOCKS[w.getBlock(x, y - 1, z)];
  return (
    !!floor?.solid &&
    floor.id !== B.magma_block &&
    roomy(w.getBlock(x, y, z)) &&
    roomy(w.getBlock(x, y + 1, z))
  );
}

/**
 * Ближайшая колонка (по кольцам вокруг (x, z), до `radius`), где на верхнем твёрдом блоке можно
 * стоять. Возвращает клетку ног или null — тогда вызывающий оставляет свою точку.
 */
export function findSafeSpot(
  w: SpotWorld,
  x: number,
  z: number,
  radius = 8,
  above?: number,
): { x: number; y: number; z: number } | null {
  for (let r = 0; r <= radius; r++)
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; // только кольцо
        const cx = x + dx,
          cz = z + dz;
        const y = w.surfaceY(cx, cz) + 1;
        if (above !== undefined && y <= above) continue;
        if (isStandable(w, cx, y, cz)) return { x: cx, y, z: cz };
      }
  return null;
}
