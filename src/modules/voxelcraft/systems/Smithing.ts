// Кузнечный стол, как в Minecraft. Без шаблона: алмазная вещь + пеклитовый слиток → та же вещь из
// пеклита. С шаблоном отделки: броня + материал → та же броня с отделкой (tag.trim). Износ и данные
// предмета переносятся — ни улучшение, ни отделка не чинят и не ломают. Чистые функции: их зовут экран
// стола (ui/InventoryUI) и тесты.
import { ITEMS } from "../registry/Items";
import { TRIM_MATERIALS, patternOf } from "../registry/items/trims";
import type { ItemStack } from "../types";

/** Отделка: шаблон + броня + материал отделки → броня с tag.trim; иначе null. */
export function trimResult(
  template: ItemStack | null,
  base: ItemStack | null,
  add: ItemStack | null,
): ItemStack | null {
  const pattern = template ? patternOf(template.item) : null;
  if (
    !pattern ||
    !base ||
    !add ||
    !ITEMS[base.item]?.armorSlot ||
    !(add.item in TRIM_MATERIALS)
  )
    return null;
  return {
    item: base.item,
    count: 1,
    ...(base.dmg ? { dmg: base.dmg } : {}),
    tag: { ...(base.tag ?? {}), trim: { pattern, material: add.item } },
  };
}

export function smithResult(
  base: ItemStack | null,
  add: ItemStack | null,
  template: ItemStack | null = null,
): ItemStack | null {
  if (template) return trimResult(template, base, add);
  if (
    !base ||
    !add ||
    add.item !== "infernite_ingot" ||
    !base.item.startsWith("diamond_")
  )
    return null;
  const item = "infernite_" + base.item.slice("diamond_".length);
  if (!ITEMS[item]) return null;
  return {
    item,
    count: 1,
    ...(base.dmg ? { dmg: base.dmg } : {}),
    ...(base.tag ? { tag: base.tag } : {}),
  };
}
