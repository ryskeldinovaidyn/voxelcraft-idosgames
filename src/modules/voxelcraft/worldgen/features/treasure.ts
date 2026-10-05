// Зарытый клад (слой особенностей верхнего мира gen2): сундук на пляже под слоем песка, один на регион
// с шансом. В нём всегда сердце моря — остальное по таблице Minecraft. Найти — картой сокровищ из
// сундука затонувшего корабля (OverworldGenerator.lootAt кладёт её с координатами ближайшего клада).
import { hashString, mulberry32 } from "../../core/Noise";
import { B } from "../../registry/Blocks";
import { ITEMS } from "../../registry/Items";
import type { ItemStack } from "../../types";
import type { TempleTerrain } from "./temple";
import type { Village } from "./village";

export const TREASURE_REGION = 160;
const CHANCE = 0.7;

export type Buried = Village;

/** Клад региона (rx, rz) или null: не выпало или в регионе не нашлось пляжа. */
export function planTreasure(
  t: TempleTerrain,
  seed: number,
  rx: number,
  rz: number,
): Buried | null {
  const rng = mulberry32(hashString(`ow-treasure:${seed}:${rx},${rz}`));
  if (rng() > CHANCE) return null;
  for (let i = 0; i < 24; i++) {
    const x =
      rx * TREASURE_REGION + 8 + Math.floor(rng() * (TREASURE_REGION - 16));
    const z =
      rz * TREASURE_REGION + 8 + Math.floor(rng() * (TREASURE_REGION - 16));
    const h = t.heightAt(x, z);
    if (t.biomeAt(x, z, h) !== "beach" || h < t.waterLevel) continue;
    const k = (x >> 4) + "," + (z >> 4);
    // сундук под верхним слоем песка
    return {
      id: `treasure:${rx},${rz}`,
      x,
      y: h - 1,
      z,
      ops: new Map([[k, [x, h - 1, z, B.chest!, 0]]]),
      residents: [],
    };
  }
  return null;
}

export const LOOT: readonly (readonly [string, number, number, number])[] = [
  ["iron_ingot", 1, 4, 20],
  ["gold_ingot", 1, 4, 10],
  ["tnt", 1, 2, 5],
  ["emerald", 4, 8, 5],
  ["diamond", 1, 2, 5],
  // пластинки: редкая находка сундуков, как в Minecraft (systems/Disc)
  ["disc_dawn", 1, 1, 3],
  ["disc_drift", 1, 1, 3],
  ["disc_hollow", 1, 1, 2],
  ["sea_crystals", 1, 5, 5],
  ["cooked_cod", 2, 4, 10],
  ["cooked_salmon", 2, 4, 10],
  ["leather_chestplate", 1, 1, 1],
  ["iron_sword", 1, 1, 1],
];

/** 27 слотов клада: сердце моря в середине и 5–8 бросков по таблице. */
export function treasureLoot(
  seed: number,
  x: number,
  y: number,
  z: number,
): (ItemStack | null)[] {
  const rng = mulberry32(hashString(`treasure-loot:${seed}:${x},${y},${z}`));
  const pool = LOOT.filter(([n]) => ITEMS[n]);
  const total = pool.reduce((s, e) => s + e[3], 0);
  const slots = new Array<ItemStack | null>(27).fill(null);
  slots[13] = { item: "heart_of_the_sea", count: 1 };
  for (let i = 5 + Math.floor(rng() * 4); i > 0 && pool.length; i--) {
    let r = rng() * total;
    let e = pool[0]!;
    for (const p of pool) {
      r -= p[3];
      if (r <= 0) {
        e = p;
        break;
      }
    }
    let slot = Math.floor(rng() * 27);
    while (slots[slot]) slot = (slot + 1) % 27;
    slots[slot] = {
      item: e[0],
      count: e[1] + Math.floor(rng() * (e[2] - e[1] + 1)),
    };
  }
  return slots;
}
