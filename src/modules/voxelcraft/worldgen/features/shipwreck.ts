// Затонувший корабль (слой особенностей верхнего мира gen2): деревянный остов на дне океана — днище
// с килем из брёвен, борта с проломами, остатки палубы, обломок мачты. Сундуки: у кормы — припасы,
// у носа — клад (добыча — wreckLoot, отдаётся при первом открытии через WorldGenerator.lootAt).
// План — чистая функция сида и региона, накладывается тем же carveVillages, что деревни.
import { hashString, mulberry32 } from "../../core/Noise";
import { B, packWater } from "../../registry/Blocks";
import { ITEMS } from "../../registry/Items";
import { WOOD_SPECIES } from "../../registry/blocks/wood";
import type { ItemStack } from "../../types";
import type { TempleTerrain } from "./temple";
import type { Village } from "./village";

export const WRECK_REGION = 192;
const MARGIN = 24;
const CHANCE = 0.45;

/** Сундуки корабля: припасы у кормы, карты посередине (карта сокровищ — её кладёт генератор), клад у носа. */
export type WreckLoot = "supply" | "map" | "treasure";

export interface Wreck extends Village {
  /** Сундуки: "x,y,z" → вид добычи. */
  chests: Map<string, WreckLoot>;
}

/** Корабль региона (rx, rz) или null: не выпало, не океан, мелко. */
export function planWreck(
  t: TempleTerrain,
  seed: number,
  rx: number,
  rz: number,
): Wreck | null {
  const rng = mulberry32(hashString(`ow-wreck:${seed}:${rx},${rz}`));
  if (rng() > CHANCE) return null;
  const span = WRECK_REGION - 2 * MARGIN;
  const cx = rx * WRECK_REGION + MARGIN + Math.floor(rng() * span);
  const cz = rz * WRECK_REGION + MARGIN + Math.floor(rng() * span);
  const h = t.heightAt(cx, cz);
  if (!t.biomeAt(cx, cz, h).endsWith("ocean") || h > t.waterLevel - 8)
    return null;

  const wood = WOOD_SPECIES[Math.floor(rng() * WOOD_SPECIES.length)]!;
  const planks = B[wood.planks],
    log = B[wood.log];
  const alongX = rng() < 0.5;
  const at = (a: number, c: number): [number, number] =>
    alongX ? [cx + a, cz + c] : [cx + c, cz + a];
  const ops = new Map<string, number[]>();
  const set = (
    x: number,
    y: number,
    z: number,
    id: number | undefined,
    meta = 0,
  ): void => {
    if (id === undefined || y < 1) return;
    const k = (x >> 4) + "," + (z >> 4);
    let a = ops.get(k);
    if (!a) ops.set(k, (a = []));
    a.push(x, y, z, id, meta);
  };
  const water = packWater(8, true);
  const base = h; // днище на уровне дна — корабль наполовину занесён песком

  for (let a = -6; a <= 6; a++) {
    const width = Math.abs(a) >= 5 ? 1 : 2; // к носу и корме уже
    for (let c = -width; c <= width; c++) {
      const [x, z] = at(a, c);
      set(x, base, z, c === 0 ? log : planks, c === 0 ? (alongX ? 1 : 2) : 0); // киль — бревно вдоль
      const side = Math.abs(c) === width || Math.abs(a) === 6;
      for (let y = base + 1; y <= base + 2; y++)
        if (side && rng() > 0.2) set(x, y, z, planks);
        else set(x, y, z, B.water, water); // пролом или трюм — вода
      if (Math.abs(a) <= 4 && rng() < 0.55) set(x, base + 3, z, planks); // остатки палубы
    }
  }
  const [mx, mz] = at(0, 0);
  for (let y = base + 3; y <= base + 6; y++) set(mx, y, mz, log); // обломок мачты

  const chests = new Map<string, WreckLoot>();
  for (const [a, kind] of [
    [-4, "supply"],
    [-2, "map"],
    [4, "treasure"],
  ] as const) {
    const [x, z] = at(a, 0);
    set(x, base + 1, z, B.chest);
    chests.set(`${x},${base + 1},${z}`, kind);
  }
  return {
    id: `wreck:${rx},${rz}`,
    x: cx,
    y: base,
    z: cz,
    ops,
    residents: [],
    chests,
  };
}

/** Таблицы добычи: [предмет, от, до, вес] — как у затонувших кораблей Minecraft. */
export const LOOT: Record<
  WreckLoot,
  {
    rolls: [number, number];
    table: readonly (readonly [string, number, number, number])[];
  }
> = {
  supply: {
    rolls: [3, 10],
    table: [
      ["paper", 1, 12, 8],
      ["potato", 2, 6, 7],
      ["carrot", 4, 8, 7],
      ["wheat", 8, 21, 7],
      ["coal", 2, 8, 6],
      ["rotten_flesh", 5, 24, 5],
      ["gunpowder", 1, 5, 3],
      ["pumpkin", 1, 3, 2],
      ["tnt", 1, 2, 1],
      ["leather_chestplate", 1, 1, 3],
    ],
  },
  map: {
    rolls: [2, 5],
    table: [
      ["paper", 1, 10, 20],
      ["feather", 1, 5, 10],
      ["book", 1, 5, 5],
      ["clock", 1, 1, 1],
      ["compass", 1, 1, 1],
      ["map", 1, 1, 1],
    ],
  },
  treasure: {
    rolls: [3, 6],
    table: [
      ["iron_ingot", 1, 5, 90],
      ["gold_ingot", 1, 5, 10],
      ["emerald", 1, 5, 40],
      ["diamond", 1, 1, 5],
      ["lapis_lazuli", 1, 10, 20],
      ["gold_nugget", 1, 10, 50],
      ["coast_armor_trim_smithing_template", 1, 1, 15],
    ],
  },
};

/** 27 слотов сундука корабля — чистая функция места. */
export function wreckLoot(
  kind: WreckLoot,
  seed: number,
  x: number,
  y: number,
  z: number,
): (ItemStack | null)[] {
  const rng = mulberry32(hashString(`wreck-loot:${seed}:${x},${y},${z}`));
  const { rolls, table } = LOOT[kind];
  const pool = table.filter(([n]) => ITEMS[n]);
  const total = pool.reduce((s, e) => s + e[3], 0);
  const slots = new Array<ItemStack | null>(27).fill(null);
  for (
    let i = rolls[0] + Math.floor(rng() * (rolls[1] - rolls[0] + 1));
    i > 0 && pool.length;
    i--
  ) {
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
