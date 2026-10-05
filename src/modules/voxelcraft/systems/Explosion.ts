// Взрыв по правилам Minecraft: 1352 луча из центра теряют силу на каждом блоке по его стойкости к
// взрыву; что луч «прожёг» — разрушается. Урон существам считает EntityManager.explode (по
// расстоянию и видимости центра).
import { BLOCKS, B } from "../registry/Blocks";
import type { ChunkManager } from "../world/ChunkManager";

export interface Destroyed {
  x: number;
  y: number;
  z: number;
  id: number;
  meta: number;
}

/** Разрушить блоки взрывом силы power (Шипун 3, TNT 4). Возвращает разрушенные. */
export function explodeBlocks(
  world: ChunkManager,
  cx: number,
  cy: number,
  cz: number,
  power: number,
  rng: () => number = Math.random,
): Destroyed[] {
  const hit = new Map<string, { x: number; y: number; z: number }>();
  for (let i = 0; i < 16; i++)
    for (let j = 0; j < 16; j++)
      for (let k = 0; k < 16; k++) {
        if (i !== 0 && i !== 15 && j !== 0 && j !== 15 && k !== 0 && k !== 15)
          continue;
        let dx = (i / 15) * 2 - 1,
          dy = (j / 15) * 2 - 1,
          dz = (k / 15) * 2 - 1;
        const len = Math.hypot(dx, dy, dz);
        dx /= len;
        dy /= len;
        dz /= len;
        let intensity = power * (0.7 + rng() * 0.6);
        let x = cx,
          y = cy,
          z = cz;
        while (intensity > 0) {
          const bx = Math.floor(x),
            by = Math.floor(y),
            bz = Math.floor(z);
          const id = world.getBlock(bx, by, bz);
          if (id !== 0) {
            const def = BLOCKS[id]!;
            intensity -= (Math.min(def.resistance, 3600) + 0.3) * 0.3;
            if (intensity > 0 && Number.isFinite(def.hardness) && !def.liquid)
              hit.set(bx + "," + by + "," + bz, { x: bx, y: by, z: bz });
          }
          x += dx * 0.3;
          y += dy * 0.3;
          z += dz * 0.3;
          intensity -= 0.225;
        }
      }
  const out: Destroyed[] = [];
  for (const p of hit.values()) {
    const id = world.getBlock(p.x, p.y, p.z);
    if (id) out.push({ ...p, id, meta: world.getMeta(p.x, p.y, p.z) });
  }
  for (const b of out) world.setBlock(b.x, b.y, b.z, B.air!);
  return out;
}

/** Урон существу от взрыва: impact = (1 - дистанция/(2·сила)) × видимость, как в Minecraft. */
export function explosionDamage(impact: number, power: number): number {
  return Math.floor(((impact * impact + impact) / 2) * 7 * (2 * power) + 1);
}
