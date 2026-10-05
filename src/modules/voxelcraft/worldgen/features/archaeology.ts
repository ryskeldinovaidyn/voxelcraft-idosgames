// Места для раскопок (слой особенностей gen2).
// Пустынный колодец: основание 5×5 из песчаника, вода посередине, низкий бортик, четыре столба и крыша;
// под основанием — подозрительный песок. Засыпанные руины (руины троп Minecraft) в лесах, тайге и
// джунглях: стены из каменного кирпича, замшелого булыжника и терракоты уходят в землю, над травой
// торчат лишь их верхушки; внутри — засыпка из земли и гравия, часть гравия подозрительная.
// Находка каждого подозрительного блока — archaeologyLoot по координатам (через lootAt генератора).
import { hashString, mulberry32 } from "../../core/Noise";
import { B, packWater } from "../../registry/Blocks";
import { ITEMS } from "../../registry/Items";
import type { ItemStack } from "../../types";
import type { TempleTerrain } from "./temple";
import type { Village } from "./village";

export const WELL_REGION = 128;
export const RUINS_REGION = 320;
const RUIN_BIOMES = ["taiga", "forest", "birch_forest", "jungle"];

export interface Dig extends Village {
  /** Подозрительные блоки: "x,y,z". */
  sus: Set<string>;
}

type Put = (
  x: number,
  y: number,
  z: number,
  id: number | undefined,
  meta?: number,
) => void;

function recorder(ops: Map<string, number[]>): Put {
  return (x, y, z, id, meta = 0) => {
    if (id === undefined || y < 1) return;
    const k = (x >> 4) + "," + (z >> 4);
    let a = ops.get(k);
    if (!a) ops.set(k, (a = []));
    a.push(x, y, z, id, meta);
  };
}

export function planWell(
  t: TempleTerrain,
  seed: number,
  rx: number,
  rz: number,
): Dig | null {
  const rng = mulberry32(hashString(`ow-well:${seed}:${rx},${rz}`));
  if (rng() > 0.3) return null;
  const cx = rx * WELL_REGION + 16 + Math.floor(rng() * (WELL_REGION - 32));
  const cz = rz * WELL_REGION + 16 + Math.floor(rng() * (WELL_REGION - 32));
  const h = t.heightAt(cx, cz);
  if (t.biomeAt(cx, cz, h) !== "desert" || h <= t.waterLevel + 1) return null;
  const ops = new Map<string, number[]>();
  const set = recorder(ops);
  for (let dx = -2; dx <= 2; dx++)
    for (let dz = -2; dz <= 2; dz++) {
      const x = cx + dx,
        z = cz + dz;
      for (let y = h - 2; y <= h; y++) set(x, y, z, B.sandstone);
      for (let y = h + 1; y <= h + 5; y++) set(x, y, z, B.air);
    }
  set(cx, h, cz, B.water, packWater(8, true));
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++) {
      if (dx || dz) set(cx + dx, h + 1, cz + dz, B.sandstone); // бортик
      set(cx + dx, h + 4, cz + dz, B.sandstone); // крыша
    }
  for (const [dx, dz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const)
    for (let y = h + 2; y <= h + 3; y++) set(cx + dx, y, cz + dz, B.sandstone);
  // подозрительный песок под основанием
  const sus = new Set<string>();
  const sx = cx + (rng() < 0.5 ? -1 : 1) * (1 + Math.floor(rng() * 2)),
    sz = cz + Math.floor(rng() * 5) - 2,
    sy = h - 1 - Math.floor(rng() * 2);
  set(sx, sy, sz, B.suspicious_sand);
  sus.add(`${sx},${sy},${sz}`);
  return {
    id: `well:${rx},${rz}`,
    x: cx,
    y: h,
    z: cz,
    ops,
    residents: [],
    sus,
  };
}

export function planRuins(
  t: TempleTerrain,
  seed: number,
  rx: number,
  rz: number,
): Dig | null {
  const rng = mulberry32(hashString(`ow-ruins:${seed}:${rx},${rz}`));
  if (rng() > 0.45) return null;
  const cx = rx * RUINS_REGION + 32 + Math.floor(rng() * (RUINS_REGION - 64));
  const cz = rz * RUINS_REGION + 32 + Math.floor(rng() * (RUINS_REGION - 64));
  const h = t.heightAt(cx, cz);
  if (!RUIN_BIOMES.includes(t.biomeAt(cx, cz, h)) || h <= t.waterLevel + 2)
    return null;
  const ops = new Map<string, number[]>();
  const set = recorder(ops);
  const sus = new Set<string>();
  const WALL = [
    B.stone_bricks,
    B.mossy_cobblestone,
    B.cobblestone,
    B.terracotta,
  ];
  const y0 = h - 5;
  // три комнаты, стены — от пола до поверхности, кое-где торчат над травой
  for (let r = 0; r < 3; r++) {
    const w = 2 + Math.floor(rng() * 2),
      d = 2 + Math.floor(rng() * 2);
    const ox = cx + Math.floor(rng() * 13) - 6,
      oz = cz + Math.floor(rng() * 13) - 6;
    for (let dx = -w; dx <= w; dx++)
      for (let dz = -d; dz <= d; dz++) {
        const x = ox + dx,
          z = oz + dz;
        const top = t.heightAt(x, z);
        const wall = Math.abs(dx) === w || Math.abs(dz) === d;
        set(x, y0, z, B.stone_bricks); // пол
        for (let y = y0 + 1; y < top; y++) {
          if (wall) set(x, y, z, WALL[Math.floor(rng() * WALL.length)]);
          else if (rng() < 0.12) {
            set(x, y, z, B.suspicious_gravel);
            sus.add(`${x},${y},${z}`);
          } else set(x, y, z, rng() < 0.5 ? B.gravel : B.dirt);
        }
        if (wall && rng() < 0.3)
          set(x, top + 1, z, WALL[Math.floor(rng() * WALL.length)]); // верхушка над травой
      }
  }
  if (!sus.size) return null;
  return {
    id: `ruins:${rx},${rz}`,
    x: cx,
    y: h,
    z: cz,
    ops,
    residents: [],
    sus,
  };
}

/** Находки: [предмет, от, до, вес]. Колодец — как у Minecraft; руины — обычные и редкие (черепки). */
export const LOOT: Record<
  "well" | "ruins",
  readonly (readonly [string, number, number, number])[]
> = {
  well: [
    ["arms_up_sherd", 1, 1, 2],
    ["emerald", 1, 1, 1],
    ["stick", 1, 2, 1],
    ["glow_berries", 1, 2, 1],
    ["sniffer_egg", 1, 1, 1],
  ],
  ruins: [
    ["emerald", 1, 1, 4],
    ["wheat", 1, 3, 3],
    ["wooden_hoe", 1, 1, 2],
    ["string", 1, 2, 2],
    ["beetroot_seeds", 1, 3, 2],
    ["lead", 1, 1, 1],
    ["coal", 1, 2, 2],
    ["angler_sherd", 1, 1, 1],
    ["archer_sherd", 1, 1, 1],
    ["explorer_sherd", 1, 1, 1],
    ["miner_sherd", 1, 1, 1],
    ["prize_sherd", 1, 1, 1],
    ["shelter_sherd", 1, 1, 1],
    ["skull_sherd", 1, 1, 1],
    ["sniffer_egg", 1, 1, 1],
  ],
};

/** Одна находка подозрительного блока (в первом слоте). */
export function archaeologyLoot(
  kind: "well" | "ruins",
  seed: number,
  x: number,
  y: number,
  z: number,
): (ItemStack | null)[] {
  const rng = mulberry32(hashString(`dig-loot:${kind}:${seed}:${x},${y},${z}`));
  const pool = LOOT[kind].filter(([n]) => ITEMS[n]);
  const total = pool.reduce((s, e) => s + e[3], 0);
  let r = rng() * total;
  let e = pool[0]!;
  for (const p of pool) {
    r -= p[3];
    if (r <= 0) {
      e = p;
      break;
    }
  }
  return [{ item: e[0], count: e[1] + Math.floor(rng() * (e[2] - e[1] + 1)) }];
}
