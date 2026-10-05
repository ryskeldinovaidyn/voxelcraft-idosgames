// Бастион (bastion remnant): крепость свинорылов из чернокамня посреди Пекла — площадка на
// столбах, стена с зубцами, четыре угловые башни, во дворе — золотая казна под охраной.
// Это дом Громилы-свинорыла: он появляется именно здесь (registry/mobs/crimson, spawn.structure).
// План — чистые коробки от сида, как у адской крепости; блоки расставляет InfernoGenerator.
import { hashString, mulberry32 } from "../../core/Noise";
import { B } from "../../registry/Blocks";
import { ITEMS } from "../../registry/Items";
import type { ItemStack } from "../../types";

/** Сторона региона бастиона и высота, на которой он стоит. */
export const BASTION_REGION = 256;
export const BASTION_Y = 48;
/** Полуразмер двора (стена — по его краю). */
const HALF = 12;
const WALL_H = 6;
const TOWER_H = 11;
/** Насколько расчищено вокруг стен. */
const CLEAR = 4;

export interface Bastion {
  /** Центр двора. */
  ox: number;
  oz: number;
  /** Сундуки казны: "x,y,z". */
  chests: Set<string>;
}

/** Бастион региона: центр выбирается сидом, один на регион. */
export function planBastion(seed: number, rx: number, rz: number): Bastion {
  const r = mulberry32(hashString(`inf-bastion:${seed}:${rx},${rz}`));
  const ox = rx * BASTION_REGION + 64 + Math.floor(r() * 128);
  const oz = rz * BASTION_REGION + 64 + Math.floor(r() * 128);
  // казна — два сундука по краям золотой кучи в центре двора
  const chests = new Set([
    `${ox - 1},${BASTION_Y + 1},${oz}`,
    `${ox + 1},${BASTION_Y + 1},${oz}`,
  ]);
  return { ox, oz, chests };
}

/** Внутри ли клетка бастиона (двор со стенами и площадка под ним). */
export const inBastion = (
  b: Bastion,
  x: number,
  y: number,
  z: number,
): boolean =>
  Math.abs(x - b.ox) <= HALF &&
  Math.abs(z - b.oz) <= HALF &&
  y >= BASTION_Y - 6 &&
  y <= BASTION_Y + TOWER_H;

/** Что за блок стоит в клетке бастиона; null — бастион этой клетки не трогает. */
export function bastionBlockAt(
  b: Bastion,
  x: number,
  y: number,
  z: number,
): number | null {
  const dx = x - b.ox,
    dz = z - b.oz;
  const ax = Math.abs(dx),
    az = Math.abs(dz);
  // вокруг стен — расчищенная площадка: иначе крепость оказывается замурованной в породе
  if (ax > HALF || az > HALF)
    return ax <= HALF + CLEAR &&
      az <= HALF + CLEAR &&
      y > BASTION_Y &&
      y <= BASTION_Y + TOWER_H + 3
      ? 0
      : null;
  const edge = ax === HALF || az === HALF;
  const corner = ax >= HALF - 1 && az >= HALF - 1;
  const brick = B.polished_blackstone_bricks ?? B.blackstone;
  // опоры: столбы по углам двора вниз, чтобы крепость висела над лавой не в воздухе
  if (y < BASTION_Y)
    return corner && y >= BASTION_Y - 6 ? (B.blackstone ?? null) : null;
  if (y === BASTION_Y) return brick ?? null; // пол двора
  if (corner && y <= BASTION_Y + TOWER_H) {
    // угловые башни: стены полые
    const inner = ax <= HALF - 1 && az <= HALF - 1;
    return inner && y < BASTION_Y + TOWER_H ? 0 : (brick ?? null);
  }
  if (edge && y <= BASTION_Y + WALL_H) {
    // стена с зубцами: верхний ряд — через один
    if (y === BASTION_Y + WALL_H && (ax + az) % 2 === 0) return 0;
    return brick ?? null;
  }
  // казна: золотая куча 3×3 в центре и два сундука по бокам
  if (y === BASTION_Y + 1) {
    if (ax <= 1 && az <= 1) return B.gold_block ?? null;
    if (az === 0 && ax === 2) return B.chest ?? null;
  }
  return y > BASTION_Y ? 0 : null; // двор пустой
}

/** Добыча бастиона: золото, доспехи и пеклитовый лом — как в Minecraft. */
export const LOOT: readonly (readonly [string, number, number, number])[] = [
  ["gold_ingot", 2, 8, 25],
  ["gold_nugget", 4, 12, 20],
  ["golden_apple", 1, 1, 10],
  ["golden_sword", 1, 1, 8],
  ["golden_chestplate", 1, 1, 8],
  ["golden_carrot", 1, 4, 8],
  ["obsidian", 1, 3, 8],
  ["inferno_wart", 1, 3, 6],
  ["infernite_scrap", 1, 2, 4],
  ["arrow", 4, 12, 6],
  ["string", 2, 6, 6],
  ["magma_cream", 1, 2, 5],
];

/** Содержимое сундука бастиона — детерминировано сидом и клеткой. */
export function bastionLoot(
  seed: number,
  x: number,
  y: number,
  z: number,
): (ItemStack | null)[] {
  const rng = mulberry32(hashString(`bastion-loot:${seed}:${x},${y},${z}`));
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
