// Отделка брони (Minecraft 1.20): кузнечные шаблоны узоров лежат в сундуках построек; на кузнечном столе
// шаблон + броня + материал → та же броня с отделкой (tag.trim, systems/Smithing.trimResult). Шаблон
// размножается: 7 алмазов, шаблон и блок-основа → 2 шаблона (recipes/basic).
import type { ItemDef, ItemStack } from "../../types";
import { addNames } from "../names";
import { item } from "./define";

/** Узоры: id → название. Где лежат — в комментарии. */
export const TRIM_PATTERNS: Record<string, string> = {
  sentry: "Страж", // застава
  coast: "Берег", // затонувший корабль
  ward: "Хранитель", // древний город
  vex: "Бесёнок", // особняк
  tide: "Прилив", // древний глубинник
  spire: "Шпиль", // город Предела
  flow: "Поток", // хранилище испытаний
};

/** Материалы отделки: предмет → как называется в подсказке. */
export const TRIM_MATERIALS: Record<string, string> = {
  iron_ingot: "железо",
  gold_ingot: "золото",
  copper_ingot: "медь",
  diamond: "алмаз",
  emerald: "изумруд",
  lapis_lazuli: "лазурит",
  redstone: "красная пыль",
  amethyst_shard: "аметист",
  infernite_ingot: "пеклит",
};

/** Блок-основа для размножения шаблона. */
export const TRIM_BASE: Record<string, string> = {
  sentry: "cobblestone",
  coast: "cobblestone",
  ward: "cobbled_deepslate",
  vex: "cobblestone",
  tide: "sea_bricks",
  spire: "beyond_stone",
  flow: "breeze_rod",
};

const SUFFIX = "_armor_trim_smithing_template";
export const templateOf = (pattern: string): string => pattern + SUFFIX;
/** Узор шаблона или null — это не шаблон отделки. */
export const patternOf = (item: string): string | null =>
  item.endsWith(SUFFIX) && item.slice(0, -SUFFIX.length) in TRIM_PATTERNS
    ? item.slice(0, -SUFFIX.length)
    : null;

/** Отделка предмета из tag.trim или null. */
export function trimOf(
  s: ItemStack,
): { pattern: string; material: string } | null {
  const t = s.tag?.trim as
    { pattern?: unknown; material?: unknown } | undefined;
  return t && typeof t.pattern === "string" && typeof t.material === "string"
    ? { pattern: t.pattern, material: t.material }
    : null;
}

/** Строка отделки для подсказки («\nОтделка «Страж», изумруд»); пусто — без отделки. */
export function trimSuffix(s: ItemStack): string {
  const t = trimOf(s);
  return t
    ? `\nОтделка «${TRIM_PATTERNS[t.pattern] ?? t.pattern}», ${TRIM_MATERIALS[t.material] ?? t.material}`
    : "";
}

export const TRIM_ITEMS: ItemDef[] = Object.keys(TRIM_PATTERNS).map((p) =>
  item({ name: templateOf(p), tile: templateOf(p) }),
);

addNames(
  Object.fromEntries(
    Object.entries(TRIM_PATTERNS).map(([p, n]) => [
      templateOf(p),
      `Шаблон отделки «${n}»`,
    ]),
  ),
);
