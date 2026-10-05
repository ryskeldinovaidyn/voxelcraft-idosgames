// Губка впитывает воду вокруг (до 65 клеток в 6 шагах, как в Minecraft) и становится мокрой; мокрая в
// Пекле сразу высыхает (в печи — тоже). Черепашье яйцо на случайных тиках трескается и вылупляется
// черепашонком (событие turtleHatch — его ловит EntityManager).
import { events } from "../../core/EventBus";
import { BLOCKS, B } from "../../registry/Blocks";
import { behave } from "../blockBehaviour";
import type { ChunkManager } from "../ChunkManager";

const REACH = 6;
const MAX_ABSORB = 65;

const DIRS: readonly (readonly [number, number, number])[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

/** Впитать воду вокруг губки: сколько клеток осушено (морская трава тоже уходит). */
export function absorbWater(
  world: ChunkManager,
  x: number,
  y: number,
  z: number,
): number {
  const seen = new Set<string>([x + "," + y + "," + z]);
  const queue: [number, number, number, number][] = [];
  for (const [dx, dy, dz] of DIRS) queue.push([x + dx, y + dy, z + dz, 1]);
  let n = 0;
  while (queue.length && n < MAX_ABSORB) {
    const [cx, cy, cz, d] = queue.shift()!;
    const k = cx + "," + cy + "," + cz;
    if (seen.has(k)) continue;
    seen.add(k);
    const id = world.getBlock(cx, cy, cz);
    if (id !== B.water && !BLOCKS[id]?.waterlogged) continue;
    world.setBlock(cx, cy, cz, B.air!);
    n++;
    if (d < REACH)
      for (const [dx, dy, dz] of DIRS)
        queue.push([cx + dx, cy + dy, cz + dz, d + 1]);
  }
  return n;
}

behave("sponge", {
  neighborChanged: (c) => {
    if (absorbWater(c.world, c.x, c.y, c.z) > 0) {
      c.world.setBlock(c.x, c.y, c.z, B.wet_sponge!);
      events.emit("spongeAbsorb", { x: c.x, y: c.y, z: c.z });
    }
  },
});

behave("wet_sponge", {
  neighborChanged: (c) => {
    if (c.world.dimension !== "inferno") return;
    c.world.setBlock(c.x, c.y, c.z, B.sponge!);
    events.emit("evaporate", { x: c.x, y: c.y, z: c.z });
  },
});

behave("turtle_egg", {
  randomTick: (c) => {
    if (c.rng() > 0.25) return;
    if (c.meta < 2) {
      c.world.setBlock(c.x, c.y, c.z, c.id, c.meta + 1);
      return;
    }
    c.world.setBlock(c.x, c.y, c.z, B.air!);
    events.emit("turtleHatch", { x: c.x, y: c.y, z: c.z });
  },
});
