// Древний город (слой особенностей gen2): огромная пещера-купол на глубине (пол y 14) в глубокой
// тьме. Пол — глубинносланцевая плитка, крест дорожек из кирпича, в северной части — рама из
// укреплённого сланца в «статуе» из кирпича (портал древнего города Minecraft), вокруг — шесть
// домиков с сундуками; всё поросло скалком с сенсорами и крикунами — крикуны города будят Стража.
// Мобы в городе сами не появляются. План — чистая функция сида.
import { hashString, mulberry32 } from "../../core/Noise";
import { B } from "../../registry/Blocks";
import { CAN_SUMMON } from "../../registry/blocks/sculk";
import { ITEMS } from "../../registry/Items";
import type { ItemStack } from "../../types";
import type { TempleTerrain } from "./temple";
import type { Village } from "./village";

export const ANCIENT_REGION = 800;
const MARGIN = 96;
const CHANCE = 0.7;
/** Полуоси купола и его высота; пол. */
const RX = 34;
const RZ = 26;
const H = 20;
export const ANCIENT_FLOOR = 14;

export interface AncientCity extends Village {
  box: [number, number, number, number, number, number];
  chests: Set<string>;
}

export const inAncientCity = (
  a: AncientCity,
  x: number,
  y: number,
  z: number,
): boolean =>
  x >= a.box[0] &&
  x <= a.box[3] &&
  y >= a.box[1] &&
  y <= a.box[4] &&
  z >= a.box[2] &&
  z <= a.box[5];

export function planAncientCity(
  t: TempleTerrain,
  seed: number,
  rx: number,
  rz: number,
  deep: (x: number, z: number) => boolean,
): AncientCity | null {
  const rng = mulberry32(hashString(`ow-ancient:${seed}:${rx},${rz}`));
  if (rng() > CHANCE) return null;
  const span = ANCIENT_REGION - 2 * MARGIN;
  for (let i = 0; i < 8; i++) {
    const cx = rx * ANCIENT_REGION + MARGIN + Math.floor(rng() * span);
    const cz = rz * ANCIENT_REGION + MARGIN + Math.floor(rng() * span);
    if (!deep(cx, cz)) continue;
    // над куполом — не меньше 12 блоков земли
    const probes: [number, number][] = [
      [0, 0],
      [RX, 0],
      [-RX, 0],
      [0, RZ],
      [0, -RZ],
      [RX >> 1, RZ >> 1],
      [-(RX >> 1), -(RZ >> 1)],
    ];
    if (
      probes.some(
        ([dx, dz]) => t.heightAt(cx + dx, cz + dz) < ANCIENT_FLOOR + H + 12,
      )
    )
      continue;
    return build(rng, rx, rz, cx, cz);
  }
  return null;
}

function build(
  rng: () => number,
  rx: number,
  rz: number,
  cx: number,
  cz: number,
): AncientCity {
  const ops = new Map<string, number[]>();
  const y0 = ANCIENT_FLOOR;
  const box: AncientCity["box"] = [
    cx - RX,
    y0 - 1,
    cz - RZ,
    cx + RX,
    y0 + H,
    cz + RZ,
  ];
  const set = (
    x: number,
    y: number,
    z: number,
    id: number | undefined,
    meta = 0,
  ): void => {
    if (id === undefined) return;
    const k = (x >> 4) + "," + (z >> 4);
    let a = ops.get(k);
    if (!a) ops.set(k, (a = []));
    a.push(x, y, z, id, meta);
  };

  // купол: пол, под ним сплошной сланец, воздух до свода; скалк, сенсоры и крикуны по полу
  for (let dx = -RX; dx <= RX; dx++)
    for (let dz = -RZ; dz <= RZ; dz++) {
      const e = (dx / RX) ** 2 + (dz / RZ) ** 2;
      if (e > 1) continue;
      const x = cx + dx,
        z = cz + dz;
      const top = y0 + Math.round(H * Math.sqrt(1 - e));
      const path = Math.abs(dx) <= 1 || Math.abs(dz) <= 1;
      const r = rng();
      set(x, y0 - 1, z, B.deepslate);
      set(
        x,
        y0,
        z,
        path ? B.deepslate_bricks : r < 0.3 ? B.sculk : B.deepslate_tiles,
      );
      for (let y = y0 + 1; y <= top; y++) set(x, y, z, B.air);
      if (path) continue;
      const o = rng();
      if (o < 0.012) set(x, y0 + 1, z, B.sculk_sensor);
      else if (o < 0.016) set(x, y0 + 1, z, B.sculk_shrieker, CAN_SUMMON);
      else if (r < 0.3 && o < 0.2) set(x, y0 + 1, z, B.sculk_vein);
    }

  // рама из укреплённого сланца в кирпичной «статуе»; дорожка проходит сквозь раму
  for (let dz = 8; dz <= 10; dz++)
    for (let dx = -11; dx <= 11; dx++)
      for (let y = y0 + 1; y <= y0 + 15; y++) {
        const inFrame = Math.abs(dx) <= 9 && y <= y0 + 12;
        const border = Math.abs(dx) === 9 || y === y0 + 12;
        set(
          cx + dx,
          y,
          cz + dz,
          !inFrame
            ? B.deepslate_bricks
            : !border
              ? B.air
              : dz === 9
                ? B.reinforced_deepslate
                : B.deepslate_bricks,
        );
      }
  set(cx - 12, y0 + 1, cz + 9, B.sculk_catalyst);
  set(cx + 12, y0 + 1, cz + 9, B.sculk_catalyst);

  // домики 5×5 с сундуком у задней стены; дверь — к центру города
  const chests = new Set<string>();
  const houses: [number, number][] = [
    [-22, -12],
    [22, -12],
    [-22, 12],
    [22, 12],
    [-10, -18],
    [10, -18],
  ];
  for (const [hx, hz] of houses) {
    const x0 = cx + hx,
      z0 = cz + hz;
    const doorDx = hx < 0 ? 2 : -2; // дверь в стене, что ближе к центру
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++) {
        set(x0 + dx, y0, z0 + dz, B.deepslate_tiles);
        const wall = Math.abs(dx) === 2 || Math.abs(dz) === 2;
        for (let y = y0 + 1; y <= y0 + 3; y++) {
          const door = dx === doorDx && dz === 0 && y <= y0 + 2;
          set(x0 + dx, y, z0 + dz, wall && !door ? B.deepslate_bricks : B.air);
        }
        set(x0 + dx, y0 + 4, z0 + dz, B.polished_deepslate);
      }
    const chx = x0 - doorDx / 2;
    set(chx, y0 + 1, z0, B.chest);
    chests.add(`${chx},${y0 + 1},${z0}`);
  }
  return {
    id: `ancient_city:${rx},${rz}`,
    x: cx,
    y: y0 + 1,
    z: cz,
    ops,
    residents: [],
    box,
    chests,
  };
}

/** Добыча сундука древнего города: [предмет, от, до, вес]; предметов, которых нет в реестре, нет. */
export const LOOT: readonly (readonly [string, number, number, number])[] = [
  ["echo_shard", 1, 3, 40],
  ["amethyst_shard", 1, 15, 20],
  ["bone", 1, 15, 20],
  ["glow_berries", 1, 15, 15],
  ["coal", 6, 15, 15],
  ["sculk", 4, 10, 10],
  ["sculk_sensor", 1, 3, 10],
  ["sculk_catalyst", 1, 2, 10],
  ["book", 3, 10, 10],
  ["compass", 1, 1, 8],
  ["lead", 1, 1, 8],
  ["name_tag", 1, 1, 8],
  ["saddle", 1, 1, 5],
  ["golden_apple", 1, 2, 8],
  ["iron_leggings", 1, 1, 5],
  ["diamond_hoe", 1, 1, 5],
  ["diamond_leggings", 1, 1, 3],
  ["enchanted_golden_apple", 1, 1, 1],
  ["ward_armor_trim_smithing_template", 1, 1, 4],
];

export function ancientLoot(
  seed: number,
  x: number,
  y: number,
  z: number,
): (ItemStack | null)[] {
  const rng = mulberry32(hashString(`ancient-loot:${seed}:${x},${y},${z}`));
  const pool = LOOT.filter(([n]) => ITEMS[n]);
  const total = pool.reduce((s, e) => s + e[3], 0);
  const slots = new Array<ItemStack | null>(27).fill(null);
  for (let i = 5 + Math.floor(rng() * 6); i > 0 && pool.length; i--) {
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
