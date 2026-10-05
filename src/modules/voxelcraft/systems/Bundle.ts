// Мешок, как в Minecraft 1.21: содержимое — в tag.items, вместимость — 64 «веса»: предмет, который
// стакается по N, весит 64/N (камень — 1, жемчуг — 4, седло — 64). Мешок в мешок не кладётся. В инвентаре
// (ui/InventoryUI) ПКМ мешком по предмету или предметом по мешку — положить, ПКМ пустой рукой по мешку —
// достать последнее; в мире ПКМ мешком — высыпать всё (player/Interaction). Чистые функции.
import { ITEMS } from "../registry/Items";
import { labelOf } from "../registry/names";
import type { ItemStack } from "../types";

export const BUNDLE_CAP = 64;

const weightOf = (item: string): number =>
  BUNDLE_CAP / Math.max(1, ITEMS[item]?.maxStack ?? 64);

/** Что лежит в мешке. */
export function bundleItems(b: ItemStack): ItemStack[] {
  const a = b.tag?.items;
  return Array.isArray(a)
    ? a.filter(
        (s): s is ItemStack =>
          !!s &&
          typeof s.item === "string" &&
          typeof s.count === "number" &&
          s.count > 0,
      )
    : [];
}

export const bundleWeight = (b: ItemStack): number =>
  bundleItems(b).reduce((w, s) => w + s.count * weightOf(s.item), 0);

/** Положить в мешок сколько влезет из stack. @returns сколько переложено (stack caller уменьшает сам) */
export function bundleInsert(b: ItemStack, stack: ItemStack): number {
  if (stack.item === "bundle" || stack.count <= 0) return 0;
  const per = weightOf(stack.item);
  const move = Math.min(
    stack.count,
    Math.floor((BUNDLE_CAP - bundleWeight(b)) / per),
  );
  if (move <= 0) return 0;
  const items = bundleItems(b);
  const same =
    !stack.tag && !stack.dmg
      ? items.find((s) => s.item === stack.item && !s.tag && !s.dmg)
      : undefined;
  if (same) same.count += move;
  else items.push({ ...stack, count: move });
  b.tag = { ...(b.tag ?? {}), items };
  return move;
}

/** Достать последнее положенное целиком; null — мешок пуст. */
export function bundleTakeLast(b: ItemStack): ItemStack | null {
  const items = bundleItems(b);
  const out = items.pop() ?? null;
  b.tag = { ...(b.tag ?? {}), items };
  return out;
}

/** Строки подсказки мешка («\nВнутри: 3× Камень… (12/64)»); пусто — не мешок. */
export function bundleSuffix(s: ItemStack): string {
  if (s.item !== "bundle") return "";
  const items = bundleItems(s);
  if (!items.length) return "\nПусто (ПКМ предметом — положить)";
  return `\nВнутри: ${items.map((i) => `${i.count}× ${labelOf(i.item)}`).join(", ")} (${bundleWeight(s)}/${BUNDLE_CAP})`;
}
