// Застава мародёров (аванпост разбойников Minecraft): башня из тёмного дуба на каменном основании —
// три этажа с лестницей внутри, окна-решётки, наверху площадка с перилами, навесом и сундуком.
// Жители — капитан наверху и двое мародёров у подножия (селит Game, как жителей деревни); ещё
// мародёры появляются у заставы сами (spawn.structure = "outpost"). План — чистая функция сида.
import { hashString, mulberry32 } from "../../core/Noise";
import { B } from "../../registry/Blocks";
import { ITEMS } from "../../registry/Items";
import { WOOD_SPECIES } from "../../registry/blocks/wood";
import type { ItemStack } from "../../types";
import type { TempleTerrain } from "./temple";
import type { Resident, Village } from "./village";

export const OUTPOST_REGION = 400;
const MARGIN = 48;
const CHANCE = 0.5;
const HALF = 3;
const BIOMES = ["plains", "savanna", "desert", "taiga", "snowy"];

export interface Outpost extends Village {
  box: [number, number, number, number, number, number];
  /** Сундук наверху: "x,y,z". */
  chest: string;
}

export const inOutpost = (
  o: Outpost,
  x: number,
  y: number,
  z: number,
): boolean =>
  x >= o.box[0] &&
  x <= o.box[3] &&
  y >= o.box[1] &&
  y <= o.box[4] &&
  z >= o.box[2] &&
  z <= o.box[5];

export function planOutpost(
  t: TempleTerrain,
  seed: number,
  rx: number,
  rz: number,
): Outpost | null {
  const rng = mulberry32(hashString(`ow-outpost:${seed}:${rx},${rz}`));
  if (rng() > CHANCE) return null;
  const span = OUTPOST_REGION - 2 * MARGIN;
  const cx = rx * OUTPOST_REGION + MARGIN + Math.floor(rng() * span);
  const cz = rz * OUTPOST_REGION + MARGIN + Math.floor(rng() * span);
  const h = t.heightAt(cx, cz);
  if (!BIOMES.includes(t.biomeAt(cx, cz, h)) || h <= t.waterLevel + 1)
    return null;

  const dark =
    WOOD_SPECIES.find((s) => s.id === "dark_oak") ?? WOOD_SPECIES[0]!;
  const birch = WOOD_SPECIES.find((s) => s.id === "birch") ?? WOOD_SPECIES[0]!;
  const log = B[dark.log],
    planks = B[dark.planks],
    floorPlanks = B[birch.planks],
    fence = B[`${dark.id}_fence`] ?? B.oak_fence;
  const ops = new Map<string, number[]>();
  const box: Outpost["box"] = [
    cx - 5,
    Infinity,
    cz - 5,
    cx + 5,
    -Infinity,
    cz + 5,
  ];
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
    box[1] = Math.min(box[1], y);
    box[4] = Math.max(box[4], y);
  };

  // каменное основание 9×9 до земли
  for (let dx = -4; dx <= 4; dx++)
    for (let dz = -4; dz <= 4; dz++) {
      for (let y = t.heightAt(cx + dx, cz + dz) + 1; y <= h; y++)
        set(cx + dx, y, cz + dz, B.cobblestone);
      set(cx + dx, h, cz + dz, B.cobblestone);
      for (let y = h + 1; y <= h + 20; y++) set(cx + dx, y, cz + dz, B.air); // расчистка
    }
  const y0 = h + 1;
  // башня 7×7: стены до y0+14, этажи y0, y0+5, y0+10, лестница у стены +z
  for (let dx = -HALF; dx <= HALF; dx++)
    for (let dz = -HALF; dz <= HALF; dz++) {
      const edge = Math.abs(dx) === HALF || Math.abs(dz) === HALF;
      const corner = Math.abs(dx) === HALF && Math.abs(dz) === HALF;
      const ladder = dx === 0 && dz === HALF - 1;
      for (let y = y0; y <= y0 + 14; y++) {
        const floor = (y - y0) % 5 === 0;
        if (corner) set(cx + dx, y, cz + dz, log);
        else if (edge) {
          const window =
            (y - y0) % 5 === 2 && (dx === 0 || dz === 0) && dz !== HALF;
          const door = dz === -HALF && dx === 0 && y > y0 && y <= y0 + 2;
          set(cx + dx, y, cz + dz, door ? B.air : window ? fence : planks);
        } else if (ladder) set(cx + dx, y, cz + dz, B.ladder, 2);
        else set(cx + dx, y, cz + dz, floor ? floorPlanks : B.air);
      }
    }
  // площадка 9×9 наверху с перилами, навес на столбах
  const top = y0 + 15;
  for (let dx = -4; dx <= 4; dx++)
    for (let dz = -4; dz <= 4; dz++) {
      const x = cx + dx,
        z = cz + dz;
      if (dx === 0 && dz === HALF - 1) set(x, top, z, B.ladder, 2);
      else set(x, top, z, planks);
      const rim = Math.abs(dx) === 4 || Math.abs(dz) === 4;
      const post = Math.abs(dx) === 4 && Math.abs(dz) === 4;
      if (post) for (let y = top + 1; y <= top + 3; y++) set(x, y, z, log);
      else if (rim) set(x, top + 1, z, fence);
      set(x, top + 4, z, planks); // навес
    }
  const chest = `${cx + 1},${top + 1},${cz - 1}`;
  set(cx + 1, top + 1, cz - 1, B.chest);
  const residents: Resident[] = [
    { type: "marauder", x: cx + 0.5, y: top + 1, z: cz + 0.5, captain: true },
    // дух-помощник у капитана — в Minecraft его держат в клетке у заставы
    { type: "allay", x: cx + 1.5, y: top + 2, z: cz + 1.5 },
    { type: "marauder", x: cx + 5.5, y: y0, z: cz + 0.5 },
    { type: "marauder", x: cx - 5.5, y: y0, z: cz + 0.5 },
  ];
  return {
    id: `outpost:${rx},${rz}`,
    x: cx,
    y: y0,
    z: cz,
    ops,
    residents,
    box,
    chest,
  };
}

/** Добыча сундука заставы: [предмет, от, до, вес] — как у аванпоста Minecraft (без арбалета). */
export const LOOT: readonly (readonly [string, number, number, number])[] = [
  ["arrow", 2, 7, 7],
  ["wheat", 3, 5, 7],
  ["carrot", 3, 5, 5],
  ["potato", 2, 5, 5],
  ["dark_oak_log", 2, 3, 10],
  ["string", 1, 6, 4],
  ["iron_ingot", 1, 3, 3],
  ["sentry_armor_trim_smithing_template", 1, 1, 2],
];

export function outpostLoot(
  seed: number,
  x: number,
  y: number,
  z: number,
): (ItemStack | null)[] {
  const rng = mulberry32(hashString(`outpost-loot:${seed}:${x},${y},${z}`));
  const pool = LOOT.filter(([n]) => ITEMS[n]);
  const total = pool.reduce((s, e) => s + e[3], 0);
  const slots = new Array<ItemStack | null>(27).fill(null);
  for (let i = 2 + Math.floor(rng() * 2) + 4; i > 0 && pool.length; i--) {
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
