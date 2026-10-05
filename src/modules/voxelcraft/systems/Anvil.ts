// Наковальня, как в Minecraft: соединить две одинаковые вещи (прочность складывается + 12%,
// зачарования переносятся), починить материалом (единица — четверть прочности, до 4 за раз) или
// перенести зачарования с книги. Цена — уровни опыта; от 40 — «Слишком дорого!». Чистая функция:
// её зовут экран наковальни (ui/InventoryUI) и тесты.
import { ITEMS } from "../registry/Items";
import type { ItemStack } from "../types";
import { ENCHANTS, enchantsOf, withEnchants } from "./Enchant";

/** С этой цены (в уровнях) наковальня отказывает в выживании. */
export const TOO_EXPENSIVE = 40;

export interface AnvilResult {
  result: ItemStack;
  /** Цена в уровнях опыта. */
  cost: number;
  /** Сколько штук забрать из правого слота (материал — до 4). */
  useRight: number;
}

/** Материал починки по префиксу вещи. */
const REPAIR: readonly (readonly [string, string])[] = [
  ["diamond_", "diamond"],
  ["iron_", "iron_ingot"],
  ["golden_", "gold_ingot"],
  ["infernite_", "infernite_ingot"],
  ["wings", "phantom_membrane"], // Крылья Предела чинит мембрана фантома, как элитры
  ["turtle_", "scute"],
];

function repairMaterial(item: string): string | null {
  for (const [prefix, mat] of REPAIR) if (item.startsWith(prefix)) return mat;
  return null;
}

/**
 * Перенести зачарования from на target: равные уровни дают +1 (до максимума), несовместимые и
 * неподходящие (у вещи) пропускаются; на книгу подходят любые. null — ничего не изменилось.
 */
function mergeEnchants(
  target: ItemStack,
  from: ItemStack,
): { stack: ItemStack; levels: number } | null {
  const def = ITEMS[target.item];
  if (!def) return null;
  const book = target.item === "enchanted_book";
  const cur = new Map(enchantsOf(target));
  let levels = 0;
  for (const [id, lvl] of enchantsOf(from)) {
    const e = ENCHANTS[id];
    if (!book && !e.fits(def)) continue;
    const clash = [...cur.keys()].some(
      (k) =>
        k !== id &&
        (e.excludes?.includes(k) || ENCHANTS[k].excludes?.includes(id)),
    );
    if (clash) continue;
    const have = cur.get(id) ?? 0;
    const next = have === lvl ? Math.min(e.max, lvl + 1) : Math.max(have, lvl);
    if (next === have) continue;
    cur.set(id, next);
    levels += next;
  }
  if (levels === 0) return null;
  return { stack: withEnchants(target, Object.fromEntries(cur)), levels };
}

/** Результат наковальни для левого и правого слота; null — ничего не выйдет. */
export function anvilResult(
  left: ItemStack | null,
  right: ItemStack | null,
): AnvilResult | null {
  if (!left || !right) return null;
  const def = ITEMS[left.item];
  if (!def) return null;

  // зачарованная книга — на вещь (или на другую книгу)
  if (right.item === "enchanted_book") {
    const m = mergeEnchants({ ...left, count: 1 }, right);
    return m ? { result: m.stack, cost: m.levels, useRight: 1 } : null;
  }

  const max = def.durability;
  const withDmg = (s: ItemStack, dmg: number): ItemStack => {
    const out: ItemStack = { ...s, count: 1 };
    if (dmg > 0) out.dmg = dmg;
    else delete out.dmg;
    return out;
  };

  // та же вещь: прочность складывается (+12% сверху), зачарования правой переносятся
  if (right.item === left.item && max > 0) {
    const remaining = (s: ItemStack) => max - (s.dmg ?? 0);
    const total = Math.min(
      max,
      remaining(left) + remaining(right) + Math.floor(max * 0.12),
    );
    const repaired = withDmg(left, max - total);
    const m = mergeEnchants(repaired, right);
    if ((left.dmg ?? 0) <= 0 && !m) return null;
    return {
      result: m ? m.stack : repaired,
      cost: 2 + (m?.levels ?? 0),
      useRight: 1,
    };
  }

  // починка материалом: каждая единица — четверть прочности, не больше 4 за раз
  const mat = repairMaterial(left.item);
  if (mat && right.item === mat && max > 0 && (left.dmg ?? 0) > 0) {
    const quarter = Math.max(1, Math.floor(max / 4));
    const units = Math.min(
      right.count,
      Math.ceil((left.dmg ?? 0) / quarter),
      4,
    );
    return {
      result: withDmg(left, Math.max(0, (left.dmg ?? 0) - units * quarter)),
      cost: units,
      useRight: units,
    };
  }
  return null;
}
