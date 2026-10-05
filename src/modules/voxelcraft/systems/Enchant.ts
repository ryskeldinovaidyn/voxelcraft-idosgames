// Зачарования, как в Minecraft: живут в ItemStack.tag.ench ({ id: уровень }) и меняют добычу
// (Эффективность, Удача, Шёлковое касание), бой (Острота, Сила лука), защиту (Защита) и износ
// (Прочность). Стол зачарований предлагает три варианта за уровни опыта и лазурит — enchantOffers.
import { hashString, mulberry32 } from "../core/Noise";
import { ITEMS } from "../registry/Items";
import { trimSuffix } from "../registry/items/trims";
import { bundleSuffix } from "./Bundle";
import type { BlockDef, ItemDef, ItemStack } from "../types";

export type EnchantId =
  | "efficiency"
  | "unbreaking"
  | "fortune"
  | "silk_touch"
  | "sharpness"
  | "protection"
  | "power"
  | "density"
  | "wind_burst";

interface EnchantDef {
  name: string;
  max: number;
  /** Вес при выборе на столе (частые — 10, редкие — 1). */
  weight: number;
  fits(d: ItemDef): boolean;
  excludes?: EnchantId[];
}

const DIGGER = new Set(["pickaxe", "axe", "shovel", "hoe"]);
const digger = (d: ItemDef): boolean => DIGGER.has(d.toolType ?? "");

export const ENCHANTS: Record<EnchantId, EnchantDef> = {
  efficiency: { name: "Эффективность", max: 5, weight: 10, fits: digger },
  unbreaking: {
    name: "Прочность",
    max: 3,
    weight: 5,
    fits: (d) => d.durability > 0,
  },
  fortune: {
    name: "Удача",
    max: 3,
    weight: 2,
    fits: digger,
    excludes: ["silk_touch"],
  },
  silk_touch: {
    name: "Шёлковое касание",
    max: 1,
    weight: 1,
    fits: digger,
    excludes: ["fortune"],
  },
  sharpness: {
    name: "Острота",
    max: 5,
    weight: 10,
    fits: (d) => d.toolType === "sword" || d.toolType === "axe",
  },
  protection: {
    name: "Защита",
    max: 4,
    weight: 10,
    fits: (d) => d.armorSlot !== null,
  },
  power: { name: "Сила", max: 5, weight: 10, fits: (d) => d.name === "bow" },
  // булава: Плотность — +0.5 урона за блок падения за уровень; Порыв ветра — после сокрушения подбрасывает
  density: {
    name: "Плотность",
    max: 5,
    weight: 5,
    fits: (d) => d.name === "mace",
  },
  wind_burst: {
    name: "Порыв ветра",
    max: 3,
    weight: 2,
    fits: (d) => d.name === "mace",
  },
};
export const ENCHANT_IDS = Object.keys(ENCHANTS) as EnchantId[];
const ROMAN = ["", "I", "II", "III", "IV", "V"];

export function enchLevel(
  s: ItemStack | null | undefined,
  id: EnchantId,
): number {
  const e = s?.tag?.ench;
  if (typeof e !== "object" || e === null) return 0;
  const v = (e as Record<string, unknown>)[id];
  return typeof v === "number" ? v : 0;
}

export function enchantsOf(
  s: ItemStack | null | undefined,
): [EnchantId, number][] {
  return ENCHANT_IDS.map((id): [EnchantId, number] => [
    id,
    enchLevel(s, id),
  ]).filter(([, l]) => l > 0);
}

export const enchantLine = (id: EnchantId, lvl: number): string =>
  `${ENCHANTS[id].name} ${ROMAN[lvl] ?? lvl}`;

/** Строки зачарований для подсказки слота («\nОстрота II»); пусто — не зачарован. */
export function enchantSuffix(s: ItemStack): string {
  // заодно отделка брони — подсказки инвентаря, хотбара и торговли показывают её без своих правок
  return (
    enchantsOf(s)
      .map(([id, l]) => "\n" + enchantLine(id, l))
      .join("") +
    trimSuffix(s) +
    bundleSuffix(s)
  );
}

export function withEnchants(
  s: ItemStack,
  add: Partial<Record<EnchantId, number>>,
): ItemStack {
  const e = s.tag?.ench;
  const cur =
    typeof e === "object" && e !== null ? (e as Record<string, number>) : {};
  return { ...s, tag: { ...(s.tag ?? {}), ench: { ...cur, ...add } } };
}

/** Можно ли зачаровать: одиночный предмет, к которому подходит хоть одно зачарование. */
export function canEnchant(item: string): boolean {
  if (item === "book") return true; // книга становится зачарованной книгой
  const d = ITEMS[item];
  return (
    !!d && d.maxStack === 1 && ENCHANT_IDS.some((id) => ENCHANTS[id].fits(d))
  );
}

/** Что Удача умножает (руды, дающие предмет, а не себя). */
const FORTUNE = new Set([
  "coal",
  "diamond",
  "emerald",
  "lapis_lazuli",
  "redstone",
  "quartz",
  "raw_iron",
  "raw_gold",
  "raw_copper",
]);

/** Дроп блока с учётом зачарований инструмента: Шёлковое касание — сам блок; Удача — больше руды. */
export function enchantDrops(
  def: BlockDef,
  base: { item: string; n: number }[],
  held: ItemStack | null,
  rng: () => number = Math.random,
): { item: string; n: number }[] {
  if (enchLevel(held, "silk_touch") > 0 && !def.noItem && ITEMS[def.name])
    return [{ item: def.name, n: 1 }];
  const f = enchLevel(held, "fortune");
  if (f <= 0) return base;
  return base.map((d) =>
    FORTUNE.has(d.item)
      ? {
          item: d.item,
          n: d.n * (1 + Math.max(0, Math.floor(rng() * (f + 2)) - 1)),
        }
      : d,
  );
}

export interface EnchantOffer {
  /** Сколько лазурита и уровней списывается (1..3). */
  cost: number;
  /** Какой уровень опыта нужен. */
  level: number;
  ench: [EnchantId, number][];
}

function pick(pool: EnchantId[], rng: () => number): EnchantId {
  let total = 0;
  for (const id of pool) total += ENCHANTS[id].weight;
  let r = rng() * total;
  for (const id of pool) {
    r -= ENCHANTS[id].weight;
    if (r <= 0) return id;
  }
  return pool[pool.length - 1]!;
}

/**
 * Три варианта стола — по формуле Minecraft для нужных уровней (полки: до 15) и зерну игрока
 * (после каждого зачарования зерно меняется). null — предмет не зачаровать.
 */
export function enchantOffers(
  item: string,
  shelves: number,
  seed: number,
): EnchantOffer[] | null {
  const d = ITEMS[item];
  if (!d || !canEnchant(item)) return null;
  const rng = mulberry32((seed ^ hashString(item)) >>> 0);
  const b = Math.min(15, shelves);
  const base =
    1 + Math.floor(rng() * 8) + Math.floor(b / 2) + Math.floor(rng() * (b + 1));
  const levels = [
    Math.max(1, Math.floor(base / 3)),
    Math.floor((base * 2) / 3) + 1,
    Math.max(base, b * 2),
  ];
  // книге подходит любое зачарование (потом его переносят наковальней)
  const pool =
    item === "book"
      ? ENCHANT_IDS
      : ENCHANT_IDS.filter((id) => ENCHANTS[id].fits(d));
  const lv = (id: EnchantId, level: number) =>
    Math.max(
      1,
      Math.min(ENCHANTS[id].max, Math.ceil((level / 30) * ENCHANTS[id].max)),
    );
  return levels.map((level, i) => {
    const first = pick(pool, rng);
    const ench: [EnchantId, number][] = [[first, lv(first, level)]];
    // дорогой вариант иногда даёт второе совместимое зачарование
    if (i === 2 && level >= 15) {
      const rest = pool.filter(
        (id) =>
          id !== first &&
          !ENCHANTS[first].excludes?.includes(id) &&
          !ENCHANTS[id].excludes?.includes(first),
      );
      if (rest.length && rng() < 0.6) {
        const second = pick(rest, rng);
        ench.push([second, Math.max(1, lv(second, level) - 1)]);
      }
    }
    return { cost: i + 1, level, ench };
  });
}

/** Книжные полки в кольце 5×5 вокруг стола на его уровне и выше (как в Minecraft). */
export function countShelves(
  get: (x: number, y: number, z: number) => number,
  shelf: number,
  x: number,
  y: number,
  z: number,
): number {
  let n = 0;
  for (let dy = 0; dy <= 1; dy++)
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++)
        if (
          (Math.abs(dx) === 2 || Math.abs(dz) === 2) &&
          get(x + dx, y + dy, z + dz) === shelf
        )
          n++;
  return n;
}
