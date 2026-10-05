// Покровы, как в Minecraft: трава и мицелий на случайном тике расползаются на землю рядом (в кубе 3×5×3,
// над ней свет ≥ 9 и не накрыто), а накрытые непрозрачным блоком снова становятся землёй; нилий под
// непрозрачным блоком — снова адский камень (сам нилий не расползается — только костной мукой в Minecraft).
import { BLOCKS, B } from "../../registry/Blocks";
import type { ChunkManager } from "../ChunkManager";
import { behave, type TickCtx } from "../blockBehaviour";

const covered = (w: ChunkManager, x: number, y: number, z: number): boolean =>
  BLOCKS[w.getBlock(x, y + 1, z)]?.opaque === true;
const lit = (w: ChunkManager, x: number, y: number, z: number): boolean => {
  const l = w.getLight(x, y, z);
  return Math.max(l >> 4, l & 15) >= 9;
};

/** Шаг покрова: накрыт — откат в back; иначе до четырёх попыток занять соседнюю землю. */
export function spreadCover(c: TickCtx, back: number): void {
  if (covered(c.world, c.x, c.y, c.z)) {
    c.world.setBlock(c.x, c.y, c.z, back);
    return;
  }
  if (!lit(c.world, c.x, c.y + 1, c.z)) return;
  for (let i = 0; i < 4; i++) {
    const x = c.x + Math.floor(c.rng() * 3) - 1,
      y = c.y + Math.floor(c.rng() * 5) - 3,
      z = c.z + Math.floor(c.rng() * 3) - 1;
    if (
      c.world.getBlock(x, y, z) !== B.dirt ||
      covered(c.world, x, y, z) ||
      !lit(c.world, x, y + 1, z)
    )
      continue;
    c.world.setBlock(x, y, z, c.id);
  }
}

behave("grass", { randomTick: (c) => spreadCover(c, B.dirt!) });
behave("mycelium", { randomTick: (c) => spreadCover(c, B.dirt!) });
for (const name of ["crimson_nylium", "warped_nylium"])
  behave(name, {
    randomTick: (c) => {
      if (covered(c.world, c.x, c.y, c.z))
        c.world.setBlock(c.x, c.y, c.z, B.infernal_stone!);
    },
  });
