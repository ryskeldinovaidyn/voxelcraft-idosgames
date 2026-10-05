// Реестр рецептов — декларативный. Описания в registry/recipes/*.ts; новый рецепт = одна запись.
//
// shapeless: { shapeless: ['oak_log'], result: { item: 'planks', count: 4 } }
// shaped:    { pattern: [['#planks'],['#planks']], result: {...} }
//            pattern — массив рядов, null = пустая клетка, "#тег" — любой предмет тега
//            (registry/tags.ts). При загрузке паттерн нормализуется (обрезаются пустые
//            ряды/колонки) и матчится в любом месте сетки 2×2/3×3, включая зеркальное отражение.

import type { Recipe, RecipeResult } from "../types";
import { ingredientMatches } from "./tags";
import { BASIC_RECIPES } from "./recipes/basic";
import { BUILDING_RECIPES } from "./recipes/building";
import { TOOL_RECIPES } from "./recipes/tools";
import { COMBAT_RECIPES } from "./recipes/combat";
import { WOOD_RECIPES } from "./recipes/wood";
import { COLOR_RECIPES } from "./recipes/colors";

type Grid = (string | null)[][];

interface Compiled {
  result: RecipeResult;
  /** Ингредиенты бесформенного рецепта (null — рецепт с формой). */
  shapeless: string[] | null;
  /** Обрезанный паттерн и его зеркало (если оно другое). */
  variants: Grid[];
}

export const RECIPES: Recipe[] = [
  ...BASIC_RECIPES,
  ...BUILDING_RECIPES,
  ...TOOL_RECIPES,
  ...COMBAT_RECIPES,
  ...WOOD_RECIPES,
  ...COLOR_RECIPES,
];

/** Обрезает пустые ряды/колонки, возвращает компактную матрицу или null. */
function trimGrid(grid: Grid): Grid | null {
  let minR = Infinity,
    maxR = -1,
    minC = Infinity,
    maxC = -1;
  for (let r = 0; r < grid.length; r++)
    for (let c = 0; c < grid[r]!.length; c++)
      if (grid[r]![c]) {
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }
  if (maxR < 0) return null;
  const out: Grid = [];
  for (let r = minR; r <= maxR; r++) {
    const row: (string | null)[] = [];
    for (let c = minC; c <= maxC; c++) row.push(grid[r]![c] || null);
    out.push(row);
  }
  return out;
}

const mirror = (grid: Grid): Grid => grid.map((row) => [...row].reverse());
const sameGrid = (a: Grid, b: Grid): boolean =>
  a.length === b.length &&
  a.every(
    (row, r) =>
      row.length === b[r]!.length && row.every((v, c) => v === b[r]![c]),
  );

/** Паттерн (с тегами) против содержимого сетки — клетка в клетку. */
const gridMatches = (pattern: Grid, grid: Grid): boolean =>
  pattern.length === grid.length &&
  pattern.every(
    (row, r) =>
      row.length === grid[r]!.length &&
      row.every((p, c) => ingredientMatches(p, grid[r]![c]!)),
  );

/** Бесформенный: каждому ингредиенту — свой предмет (перебор с возвратом, n ≤ 9). */
function shapelessMatches(patterns: string[], items: string[]): boolean {
  if (patterns.length !== items.length) return false;
  const used = new Array<boolean>(items.length).fill(false);
  const place = (i: number): boolean => {
    if (i === patterns.length) return true;
    for (let j = 0; j < items.length; j++) {
      if (used[j] || !ingredientMatches(patterns[i]!, items[j]!)) continue;
      used[j] = true;
      if (place(i + 1)) return true;
      used[j] = false;
    }
    return false;
  };
  return place(0);
}

let compiled: Compiled[] | null = null;

/** Компиляция при первом матче: к этому моменту все части реестра уже дописали свои рецепты. */
function compile(): Compiled[] {
  if (compiled && compiled.length === RECIPES.length) return compiled;
  compiled = RECIPES.map((r): Compiled => {
    if ("shapeless" in r)
      return { result: r.result, shapeless: r.shapeless, variants: [] };
    const trimmed = trimGrid(r.pattern)!;
    const variants: Grid[] = [trimmed];
    const mir = mirror(trimmed);
    if (!sameGrid(mir, trimmed)) variants.push(mir);
    return { result: r.result, shapeless: null, variants };
  });
  return compiled;
}

/**
 * Матчит содержимое крафт-сетки.
 * @param slots — имена предметов, row-major
 * @param size — 2 или 3
 */
export function matchRecipe(
  slots: (string | null)[],
  size: number,
): RecipeResult | null {
  const grid: Grid = [];
  for (let r = 0; r < size; r++)
    grid.push(slots.slice(r * size, r * size + size));
  const trimmed = trimGrid(grid);
  if (!trimmed) return null;

  const present = slots.filter((s): s is string => !!s);
  for (const rec of compile()) {
    if (rec.shapeless) {
      if (shapelessMatches(rec.shapeless, present)) return rec.result;
    } else {
      // паттерн должен влезать в сетку (меч 1×3 не собрать в 2×2)
      for (const v of rec.variants)
        if (v.length <= size && v[0]!.length <= size && gridMatches(v, trimmed))
          return rec.result;
    }
  }
  return null;
}

/** Рецепты, дающие предмет (книга рецептов). */
export function recipesProducing(item: string): Recipe[] {
  return RECIPES.filter((r) => r.result.item === item);
}
