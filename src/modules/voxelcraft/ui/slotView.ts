// Общие детали отрисовки слотов (хотбар, инвентарь, контейнеры).
import { ITEMS } from "../registry/Items";
import type { ItemStack } from "../types";

/** Полоска износа под иконкой инструмента или брони: зелёная → красная, как в Minecraft. */
export function drawDurability(
  slot: HTMLElement,
  stack: ItemStack | null,
): void {
  let bar = slot.querySelector<HTMLElement>(".dur");
  if (!bar) {
    bar = document.createElement("i");
    bar.className = "dur";
    slot.appendChild(bar);
  }
  const max = stack ? (ITEMS[stack.item]?.durability ?? 0) : 0;
  const dmg = stack?.dmg ?? 0;
  if (!max || dmg <= 0) {
    bar.style.display = "none";
    return;
  }
  const left = Math.max(0, 1 - dmg / max);
  bar.style.display = "block";
  bar.style.width = `calc((100% - 8px) * ${left.toFixed(3)})`;
  bar.style.background = `hsl(${Math.round(left * 120)}, 90%, 45%)`;
}
