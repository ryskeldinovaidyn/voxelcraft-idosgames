import { B, BLOCKS } from "../registry/Blocks";
import type { ChunkManager } from "../world/ChunkManager";
import { CHUNK_SIZE, idx } from "../world/Chunk";
import type { EventContext, EventDefinition, Position } from "./types";
import { PULSE } from "./config";

type HeightGenerator = { heightAt?: (x: number, z: number) => number; surfaceHeight?: (x: number, z: number) => number };

/** Детерминированная высота ещё не загруженного чанка; не грузит сотни чанков ради поисковой проверки. */
export function terrainHeight(world: ChunkManager, x: number, z: number): number {
  const g = world.generator as HeightGenerator;
  const y = g.heightAt?.(x, z) ?? g.surfaceHeight?.(x, z);
  return Number.isFinite(y) ? Math.floor(y!) : world.surfaceY(x, z);
}

export function biomeAt(world: ChunkManager, x: number, z: number): string {
  const g = world.generator as typeof world.generator & { zoneAtWorld?: (x: number, z: number) => { biome: string } };
  return g.biomeOf?.(x, z) ?? g.zoneAtWorld?.(x, z).biome ?? "classic";
}

/** Защита построек: любой пользовательский диф в радиусе (и незагруженный тоже) закрывает место. */
export function hasModifiedBlocks(world: ChunkManager, x: number, z: number, radius: number): boolean {
  const { SX, SZ } = CHUNK_SIZE;
  for (let cx = Math.floor((x - radius) / SX); cx <= Math.floor((x + radius) / SX); cx++)
    for (let cz = Math.floor((z - radius) / SZ); cz <= Math.floor((z + radius) / SZ); cz++) {
      const k = `${cx},${cz}`;
      const diff = world.chunks.get(k)?.modified ?? world.pendingDiffs.get(k);
      if (!diff) continue;
      for (const i of diff.keys()) {
        const wx = cx * SX + (i & 15), wz = cz * SZ + ((i >> 4) & 15);
        if (Math.hypot(wx - x, wz - z) <= radius) return true;
      }
    }
  return false;
}

export function findMeteorSite(c: EventContext, def: EventDefinition, random: () => number): Position | null {
  const { world, player } = c.game;
  const opts = PULSE.meteor;
  for (let attempt = 0; attempt < opts.siteAttempts; attempt++) {
    const angle = random() * Math.PI * 2;
    const distance = def.spawnDistance[0] + random() * (def.spawnDistance[1] - def.spawnDistance[0]);
    const x = Math.floor(player.pos.x + Math.cos(angle) * distance);
    const z = Math.floor(player.pos.z + Math.sin(angle) * distance);
    const base = player.spawnPoint;
    if (Math.hypot(x - base.x, z - base.z) < def.minimumDistanceFromBase + opts.safetyRadius) continue;
    const y = terrainHeight(world, x, z);
    if (y <= world.generator.waterLevel + 2 || y < 9 || y >= CHUNK_SIZE.SY - 12) continue;
    let slope = 0;
    for (const [dx, dz] of [[-9, 0], [9, 0], [0, -9], [0, 9]])
      slope = Math.max(slope, Math.abs(terrainHeight(world, x + dx!, z + dz!) - y));
    if (slope > opts.maxSlope) continue;
    if (hasModifiedBlocks(world, x, z, opts.safetyRadius)) continue;
    // Генератор может знать постройки даже там, где чанк ещё не загружен.
    if ([[0, 0], [-8, 0], [8, 0], [0, -8], [0, 8]].some(([dx, dz]) => world.generator.structureAt?.(x + dx!, terrainHeight(world, x + dx!, z + dz!), z + dz!))) continue;
    if (world.generator.villagesNear?.(x, z, 80)?.length) continue;
    return [x, y, z];
  }
  return null;
}

/** Возвращает изменения кратера; caller применяет их через applyRemoteBlock, включая pendingDiffs. */
export function craterCells(world: ChunkManager, at: Position, seed: number, diameter: number, depth: number): [number, number, number, number][] {
  const [cx, , cz] = at;
  const radius = diameter / 2;
  const out: [number, number, number, number][] = [];
  for (let x = Math.floor(cx - radius - 2); x <= cx + radius + 2; x++)
    for (let z = Math.floor(cz - radius - 2); z <= cz + radius + 2; z++) {
      const noise = Math.sin((x * 127.1 + z * 311.7 + seed) * 0.137) * 0.65;
      const d = Math.max(0, Math.hypot(x - cx, z - cz) + noise);
      if (d > radius + 1.5) continue;
      const top = terrainHeight(world, x, z);
      const cut = Math.max(0, Math.round(depth * (1 - (d / radius) ** 1.7)));
      if (cut > 0) {
        for (let y = top; y > top - cut; y--) out.push([x, y, z, B.air!]);
        out.push([x, top - cut, z, d < radius * 0.42 ? B.obsidian! : B.cobblestone!]);
      } else if (d <= radius + 1.5) out.push([x, top, z, B.cobblestone!]);
    }
  return out;
}

export function isOutdoors(world: ChunkManager, x: number, y: number, z: number): boolean {
  const xi = Math.floor(x), zi = Math.floor(z);
  if (!world.chunkAt(xi, zi)?.generated) return false;
  for (let yy = Math.floor(y) + 2; yy < CHUNK_SIZE.SY; yy++) {
    const id = world.getBlock(xi, yy, zi);
    if (BLOCKS[id]?.solid) return false;
  }
  return true;
}

export function isSafeAnimalSpot(world: ChunkManager, x: number, z: number): number | null {
  const chunk = world.chunkAt(x, z);
  if (!chunk?.generated) return null;
  const y = world.surfaceY(x, z);
  const ground = world.getBlock(x, y, z);
  if (y <= world.generator.waterLevel || ![B.grass, B.dirt, B.sand].includes(ground)) return null;
  if (world.getBlock(x, y + 1, z) !== B.air || world.getBlock(x, y + 2, z) !== B.air) return null;
  // Игроком изменённая клетка или строение — стадо туда не ставим.
  if (chunk.modified.has(idx(x & 15, y, z & 15))) return null;
  return y + 1;
}
