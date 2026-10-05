// Однократная проверка нового мира: рядом со стартом есть древесина для первого меча.
// Если генератор дал пустыню/голый остров, на доступной суше лежит короткое поваленное бревно.
import { B, BLOCKS } from "../registry/Blocks";
import { TAGS } from "../registry/tags";
import type { ChunkManager } from "../world/ChunkManager";

export interface NearbyWood { x: number; y: number; z: number; distance: number }

export function nearestStarterWood(world: ChunkManager, px: number, pz: number, radius = 40): NearbyWood | null {
  const cx = Math.floor(px), cz = Math.floor(pz);
  let best: NearbyWood | null = null;
  for (let x = cx - radius; x <= cx + radius; x++)
    for (let z = cz - radius; z <= cz + radius; z++) {
      const distance = Math.hypot(x + 0.5 - px, z + 0.5 - pz);
      if (distance > radius || (best && distance >= best.distance)) continue;
      if (!world.chunkAt(x, z)?.generated) continue;
      const top = world.surfaceY(x, z);
      for (let y = Math.max(1, top - 8); y <= Math.min(255, top + 3); y++) {
        const name = BLOCKS[world.getBlock(x, y, z)]?.name;
        if (name && TAGS.logs?.includes(name)) { best = { x, y, z, distance }; break; }
      }
    }
  return best;
}

export function ensureStarterResourceZone(world: ChunkManager, px: number, pz: number): NearbyWood | null {
  const existing = nearestStarterWood(world, px, pz, 40);
  if (existing) return existing;
  const cx = Math.floor(px), cz = Math.floor(pz);
  for (let r = 2; r <= 22; r++)
    for (let dx = -r; dx <= r; dx++)
      for (const dz of [-r, r]) {
        const x = cx + dx, z = cz + dz;
        if (!world.chunkAt(x, z)?.generated) continue;
        const y = world.surfaceY(x, z);
        if (y <= world.waterLevel || y >= 250 || world.getBlock(x, y + 1, z) !== B.air) continue;
        if (!BLOCKS[world.getBlock(x, y, z)]?.solid) continue;
        if (!world.setBlock(x, y + 1, z, B.oak_log!)) continue;
        // Второй фрагмент только на ровном свободном месте: ничего существующего не перезаписываем.
        if (world.chunkAt(x + 1, z)?.generated && world.surfaceY(x + 1, z) === y && world.getBlock(x + 1, y + 1, z) === B.air)
          world.setBlock(x + 1, y + 1, z, B.oak_log!);
        return { x, y: y + 1, z, distance: Math.hypot(x + 0.5 - px, z + 0.5 - pz) };
      }
  return null;
}
