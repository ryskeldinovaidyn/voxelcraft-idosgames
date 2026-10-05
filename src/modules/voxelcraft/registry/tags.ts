// Теги — группы взаимозаменяемых предметов, как в Minecraft (#planks: любые доски годятся для
// палок и верстака). В рецепте тег пишется с решёткой: "#planks".
import { WOOL_BLOCKS } from "./Blocks";
import { WOOD_SPECIES } from "./blocks/wood";

export const TAGS: Record<string, string[]> = {
  // доски Пекла — не порода дерева (registry/blocks/crimson), но в «любых досках» годятся, как в Minecraft
  planks: [
    ...WOOD_SPECIES.map((s) => s.planks),
    "crimson_planks",
    "warped_planks",
  ],
  logs: WOOD_SPECIES.map((s) => s.log),
  leaves: WOOD_SPECIES.map((s) => s.leaves),
  saplings: WOOD_SPECIES.map((s) => s.sapling),
  wool: [...WOOL_BLOCKS],
  /** Камень для каменных инструментов и печи. */
  stone_crafting: ["cobblestone", "cobbled_deepslate"],
  coals: ["coal", "charcoal"],
  sand: ["sand", "red_sand"],
};

/** Дописать предметы в тег (части реестра, сгенерированные из таблиц видов). */
export function addToTag(tag: string, ...items: string[]): void {
  (TAGS[tag] ??= []).push(...items);
}

/** Подходит ли предмет под клетку рецепта: точное имя или "#тег". */
export function ingredientMatches(
  pattern: string | null,
  item: string | null,
): boolean {
  if (pattern === null) return item === null;
  if (item === null) return false;
  if (pattern.startsWith("#"))
    return TAGS[pattern.slice(1)]?.includes(item) ?? false;
  return pattern === item;
}
