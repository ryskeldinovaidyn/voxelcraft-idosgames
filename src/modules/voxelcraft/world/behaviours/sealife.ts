// Морская жизнь: коралловый блок без воды рядом умирает на случайном тике; верхушка ламинарии растёт
// вверх, пока над ней вода (до поверхности), оставляя под собой стебель.
import { BLOCKS, B } from "../../registry/Blocks";
import { CORALS } from "../../registry/blocks/sealife";
import { behave } from "../blockBehaviour";
import type { ChunkManager } from "../ChunkManager";

const NEIGHBORS: readonly (readonly [number, number, number])[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

const wet = (id: number): boolean =>
  id === B.water || !!BLOCKS[id]?.waterlogged;

/** Касается ли клетка воды хоть одной гранью. */
export function touchesWater(
  w: ChunkManager,
  x: number,
  y: number,
  z: number,
): boolean {
  return NEIGHBORS.some(([dx, dy, dz]) =>
    wet(w.getBlock(x + dx, y + dy, z + dz)),
  );
}

for (const c of CORALS)
  behave(`${c.id}_coral_block`, {
    randomTick: (t) => {
      if (!touchesWater(t.world, t.x, t.y, t.z))
        t.world.setBlock(t.x, t.y, t.z, B[`dead_${c.id}_coral_block`]!);
    },
  });

behave("kelp", {
  randomTick: (t) => {
    if (t.rng() > 0.14 || t.world.getBlock(t.x, t.y + 1, t.z) !== B.water)
      return;
    t.world.setBlock(t.x, t.y, t.z, B.kelp_plant!);
    t.world.setBlock(t.x, t.y + 1, t.z, B.kelp!);
  },
});
