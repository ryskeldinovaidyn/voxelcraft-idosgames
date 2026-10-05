// Заброшенная шахта (abandoned mineshaft): сеть прорубленных в камне штолен с деревянной крепью
// каждые пять блоков, рельсами по полу, паутиной по углам и сундуками с припасами. Как в Minecraft,
// шахта живёт глубоко под землёй и попадается при копании вниз или из пещеры.
// План — чистая функция сида: ни рендера, ни мира внутри (как остальные worldgen/features/*).
import { hashString, mulberry32 } from "../../core/Noise";
import { B } from "../../registry/Blocks";
import { ITEMS } from "../../registry/Items";
import type { ItemStack } from "../../types";
import type { Village, VillageTerrain } from "./village";

/** Сторона региона: одна шахта на регион, и то не всегда. */
export const MINESHAFT_REGION = 320;
const MARGIN = 64;
const CHANCE = 0.55;
/** Глубины, между которыми копают штольни. */
const MIN_Y = 14;
const MAX_Y = 44;
/** Сколько коридоров расходится от ствола и какой они длины. */
const HALLS: readonly [number, number] = [4, 7];
const HALL_LEN: readonly [number, number] = [18, 34];
/** Шаг деревянной крепи. */
const SUPPORT_STEP = 5;

export interface Mineshaft extends Village {
  box: [number, number, number, number, number, number];
  /** Сундуки припасов: "x,y,z". */
  chests: Set<string>;
}

export const inMineshaft = (
  m: Mineshaft,
  x: number,
  y: number,
  z: number,
): boolean =>
  x >= m.box[0] &&
  x <= m.box[3] &&
  y >= m.box[1] &&
  y <= m.box[4] &&
  z >= m.box[2] &&
  z <= m.box[5];

/**
 * План шахты региона (rx, rz) или null. Ствол — вертикальная шахта с лестницей, от него в стороны
 * расходятся штольни; каждая — тоннель 3 в ширину и 3 в высоту с крепью, рельсами и паутиной.
 */
export function planMineshaft(
  t: VillageTerrain,
  seed: number,
  rx: number,
  rz: number,
): Mineshaft | null {
  const rng = mulberry32(hashString(`ow-mineshaft:${seed}:${rx},${rz}`));
  if (rng() > CHANCE) return null;
  const span = MINESHAFT_REGION - 2 * MARGIN;
  const cx = rx * MINESHAFT_REGION + MARGIN + Math.floor(rng() * span);
  const cz = rz * MINESHAFT_REGION + MARGIN + Math.floor(rng() * span);
  const surface = t.heightAt(cx, cz);
  // под водой шахты не бывает: ствол уходил бы в океан
  if (surface <= t.waterLevel + 1) return null;
  const cy = MIN_Y + Math.floor(rng() * (MAX_Y - MIN_Y));

  const ops = new Map<string, number[]>();
  const chests = new Set<string>();
  const box: Mineshaft["box"] = [cx, cy, cz, cx, cy, cz];
  const set = (
    x: number,
    y: number,
    z: number,
    id: number | undefined,
    meta = 0,
  ): void => {
    if (id === undefined || y < 2) return;
    const k = (x >> 4) + "," + (z >> 4);
    let a = ops.get(k);
    if (!a) ops.set(k, (a = []));
    a.push(x, y, z, id, meta);
    box[0] = Math.min(box[0], x);
    box[1] = Math.min(box[1], y);
    box[2] = Math.min(box[2], z);
    box[3] = Math.max(box[3], x);
    box[4] = Math.max(box[4], y);
    box[5] = Math.max(box[5], z);
  };

  const planks = B.oak_planks,
    fence = B.oak_fence,
    log = B.oak_log;

  /** Один шаг штольни: пустой проём 3×3, пол, иногда крепь, рельсы, паутина, сундук. */
  const dig = (
    x: number,
    y: number,
    z: number,
    along: "x" | "z",
    i: number,
  ): void => {
    for (let dw = -1; dw <= 1; dw++) {
      const px = along === "x" ? x : x + dw;
      const pz = along === "x" ? z + dw : z;
      set(px, y - 1, pz, B.cobblestone); // пол
      for (let dy = 0; dy <= 2; dy++) set(px, y + dy, pz, B.air);
      // крепь: столбы по бокам и перекладина сверху
      if (i % SUPPORT_STEP === 0) {
        if (dw !== 0) {
          set(px, y, pz, fence);
          set(px, y + 1, pz, fence);
        }
        set(px, y + 2, pz, dw === 0 ? planks : log);
      }
    }
    // рельсы по середине
    set(x, y, z, B.rail);
    // паутина в углах и редкий сундук с припасами
    if (rng() < 0.08)
      set(
        x + (along === "x" ? 0 : 1),
        y + 1,
        z + (along === "x" ? 1 : 0),
        B.cobweb,
      );
    if (rng() < 0.05) {
      const bx = along === "x" ? x : x + 1;
      const bz = along === "x" ? z + 1 : z;
      set(bx, y, bz, B.chest);
      chests.add(`${bx},${y},${bz}`);
    }
  };

  // ствол: от потолка шахты до поверхности, с приставной лестницей
  for (let y = cy; y <= surface; y++) {
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) set(cx + dx, y, cz + dz, B.air);
    set(cx + 1, y, cz, B.ladder, 1);
  }
  set(cx, cy - 1, cz, B.cobblestone);

  // штольни в стороны от ствола
  const halls = HALLS[0] + Math.floor(rng() * (HALLS[1] - HALLS[0] + 1));
  for (let h = 0; h < halls; h++) {
    const along: "x" | "z" = rng() < 0.5 ? "x" : "z";
    const sign = rng() < 0.5 ? -1 : 1;
    const len =
      HALL_LEN[0] + Math.floor(rng() * (HALL_LEN[1] - HALL_LEN[0] + 1));
    const y = Math.max(MIN_Y, cy - Math.floor(rng() * 6));
    for (let i = 2; i <= len; i++)
      dig(
        along === "x" ? cx + sign * i : cx,
        y,
        along === "z" ? cz + sign * i : cz,
        along,
        i,
      );
  }

  return {
    id: `${rx},${rz}`,
    x: cx,
    y: cy,
    z: cz,
    ops,
    residents: [],
    box,
    chests,
  };
}

/** Припасы шахтёров: [предмет, от, до, вес]. */
export const LOOT: readonly (readonly [string, number, number, number])[] = [
  ["torch", 1, 8, 20],
  ["bread", 1, 3, 15],
  ["coal", 1, 8, 15],
  ["iron_ingot", 1, 3, 10],
  ["rail", 2, 6, 10],
  ["stick", 1, 6, 10],
  ["wheat", 1, 4, 10],
  ["bucket", 1, 1, 5],
  ["gold_ingot", 1, 2, 5],
  ["pumpkin_seeds", 1, 3, 5],
  ["melon_seeds", 1, 3, 5],
  ["diamond", 1, 1, 2],
  ["golden_apple", 1, 1, 1],
];

/** Содержимое сундука шахты — детерминировано сидом и клеткой. */
export function mineshaftLoot(
  seed: number,
  x: number,
  y: number,
  z: number,
): (ItemStack | null)[] {
  const rng = mulberry32(hashString(`mineshaft-loot:${seed}:${x},${y},${z}`));
  const pool = LOOT.filter(([n]) => ITEMS[n]);
  const total = pool.reduce((s, e) => s + e[3], 0);
  const slots = new Array<ItemStack | null>(27).fill(null);
  for (let i = 3 + Math.floor(rng() * 4); i > 0 && pool.length; i--) {
    let r = rng() * total;
    let e = pool[0]!;
    for (const row of pool) {
      r -= row[3];
      if (r <= 0) {
        e = row;
        break;
      }
    }
    const count = e[1] + Math.floor(rng() * (e[2] - e[1] + 1));
    const free = slots.findIndex((s) => !s);
    if (free >= 0) slots[free] = { item: e[0], count };
  }
  return slots;
}
