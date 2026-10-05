// Саженцы, как в Minecraft: растут на случайных тиках при свете ≥ 9 (шанс 1/7), костная мука —
// с шансом 45% (world/behaviours/farming). Нужны земля снизу и место над саженцем; дерево — той же
// породы (worldgen/trees.growTree).
import { BLOCKS, B } from "../../registry/Blocks";
import { WOOD_SPECIES } from "../../registry/blocks/wood";
import { growTree } from "../../worldgen/trees";
import { behaveWhere } from "../blockBehaviour";
import type { ChunkManager } from "../ChunkManager";

/** Саженец → порода дерева. */
const TREE_OF = new Map<number, string>();
for (const s of WOOD_SPECIES)
  if (B[s.sapling] !== undefined) TREE_OF.set(B[s.sapling]!, s.id);

export const isSapling = (id: number): boolean => TREE_OF.has(id);

/** Вырастить дерево из саженца в (x,y,z); false — нет места или не на земле. */
export function growSapling(
  w: ChunkManager,
  x: number,
  y: number,
  z: number,
  rng: () => number,
): boolean {
  const kind = TREE_OF.get(w.getBlock(x, y, z));
  if (!kind) return false;
  const below = w.getBlock(x, y - 1, z);
  if (
    below !== B.grass &&
    below !== B.dirt &&
    below !== B.farmland &&
    below !== B.mud
  )
    return false;
  for (let dy = 1; dy <= 6; dy++) {
    const id = w.getBlock(x, y + dy, z);
    if (
      id !== 0 &&
      !BLOCKS[id]?.replaceable &&
      !(BLOCKS[id]?.name ?? "").endsWith("leaves")
    )
      return false;
  }
  w.setBlock(x, y, z, B.air!);
  growTree(kind, x, y - 1, z, rng, (tx, ty, tz, id, soft) => {
    const cur = w.getBlock(tx, ty, tz);
    if (cur === -1 || (soft && cur !== 0 && !BLOCKS[cur]?.replaceable)) return;
    w.setBlock(tx, ty, tz, id);
  });
  if (below === B.grass || below === B.farmland)
    w.setBlock(x, y - 1, z, B.dirt!); // под стволом — земля
  return true;
}

behaveWhere((d) => TREE_OF.has(d.id), {
  randomTick: (c) => {
    const l = c.world.getLight(c.x, c.y, c.z);
    if (Math.max(l >> 4, l & 15) < 9 || c.rng() >= 1 / 7) return;
    growSapling(c.world, c.x, c.y, c.z, c.rng);
  },
});
