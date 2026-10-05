// Точило, как в Minecraft: снимает с вещи все зачарования (возвращая опыт) и соединяет две
// одинаковые вещи по прочности (+5%), но уже без зачарований — в отличие от наковальни, опыт не
// берёт, а отдаёт. Чистая функция: её зовут экран точила (ui/InventoryUI) и тесты.
import { ITEMS } from "../registry/Items";
import { enchantsOf } from "./Enchant";
import type { ItemStack } from "../types";

export interface GrindResult {
  result: ItemStack;
  /** Сколько опыта вернуть игроку за снятые зачарования. */
  xp: number;
  /** Забрать ли предмет из правого слота. */
  useRight: boolean;
}

/** Опыт за снятые зачарования: по уровню за уровень, как грубая мера ценности. */
const xpOf = (s: ItemStack | null): number =>
  s ? enchantsOf(s).reduce((n, [, lvl]) => n + lvl, 0) : 0;

/** Та же вещь без зачарований (и без прочих меток — отделка и связка остаются). */
function stripped(s: ItemStack, dmg: number): ItemStack {
  const tag = { ...(s.tag ?? {}) };
  delete tag.ench;
  const out: ItemStack = { ...s, count: 1 };
  if (Object.keys(tag).length) out.tag = tag;
  else delete out.tag;
  if (dmg > 0) out.dmg = dmg;
  else delete out.dmg;
  return out;
}

/**
 * Результат точила для верхнего и нижнего слота; null — ничего не выйдет.
 * Одна вещь — снять зачарования; две одинаковые — сложить прочность (+5%) и снять зачарования.
 */
export function grindResult(
  left: ItemStack | null,
  right: ItemStack | null,
): GrindResult | null {
  const one = left ?? right;
  if (!one) return null;
  const def = ITEMS[one.item];
  if (!def) return null;

  // две одинаковые вещи с прочностью — соединить
  if (left && right && left.item === right.item && def.durability > 0) {
    const max = def.durability;
    const remaining = (s: ItemStack) => max - (s.dmg ?? 0);
    const total = Math.min(
      max,
      remaining(left) + remaining(right) + Math.floor(max * 0.05),
    );
    return {
      result: stripped(left, max - total),
      xp: xpOf(left) + xpOf(right),
      useRight: true,
    };
  }
  if (left && right) return null; // разные вещи точило не берёт

  const xp = xpOf(one);
  if (xp === 0) return null; // снимать нечего
  // зачарованная книга без зачарований — просто книга, как в Minecraft
  const bare = one.item === "enchanted_book" ? { ...one, item: "book" } : one;
  return { result: stripped(bare, one.dmg ?? 0), xp, useRight: !left };
}
