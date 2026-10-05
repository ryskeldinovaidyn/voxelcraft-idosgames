// Расстояние до опоры для клетки строительных лесов, прочитанное из мира: соседей берём из блоков,
// саму арифметику — из systems/Scaffold (она чистая и покрыта тестами).
import { BLOCKS, B } from "../registry/Blocks";
import { FACING_DIRS } from "../registry/meta";
import { NO_SUPPORT, scaffoldDistance } from "../systems/Scaffold";
import type { ChunkManager } from "./ChunkManager";

/** Расстояние до опоры у клетки (сам блок в ней может ещё не стоять — так считает постановка). */
export function scaffoldDistanceAt(
  world: ChunkManager,
  x: number,
  y: number,
  z: number,
): number {
  const scaffold = B.scaffolding;
  const below = world.getBlock(x, y - 1, z);
  const belowSolid = below !== scaffold && (BLOCKS[below]?.solid ?? false);
  const belowScaffold = below === scaffold ? world.getMeta(x, y - 1, z) : null;
  const sides: number[] = [];
  for (const [dx, dz] of FACING_DIRS)
    if (world.getBlock(x + dx, y, z + dz) === scaffold) {
      const d = world.getMeta(x + dx, y, z + dz);
      if (d < NO_SUPPORT) sides.push(d);
    }
  return scaffoldDistance(belowSolid, belowScaffold, sides);
}
