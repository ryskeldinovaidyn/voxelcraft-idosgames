// Крафт: состояние сетки (2×2 инвентарь / 3×3 верстак) + матчинг рецептов.
// Слоты сетки — такие же стаки, как в инвентаре; UI двигает их drag-and-drop'ом.
import { events } from "../core/EventBus";
import { matchRecipe } from "../registry/Recipes";
import type { ItemStack, RecipeResult } from "../types";
import type { Inventory } from "./Inventory";

export class CraftingGrid {
  size: number;
  slots: (ItemStack | null)[];

  constructor(size = 2) {
    this.size = size;
    this.slots = new Array(size * size).fill(null);
  }

  setSize(size: number) {
    this.size = size;
    this.slots = new Array(size * size).fill(null);
  }

  /** Текущий результат по рецептам (не изымает ингредиенты). */
  result(): RecipeResult | null {
    return matchRecipe(
      this.slots.map((s) => (s ? s.item : null)),
      this.size,
    );
  }

  /** Забрать результат: по 1 предмету из каждой занятой клетки. */
  takeResult(): RecipeResult | null {
    const res = this.result();
    if (!res) return null;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (s) {
        s.count -= 1;
        if (s.count <= 0) this.slots[i] = null;
      }
    }
    events.emit("craft", { item: res.item, count: res.count });
    return { ...res };
  }

  /** Вернуть всё из сетки в инвентарь (закрытие окна). */
  dumpInto(inventory: Inventory) {
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (s) {
        // с износом или tag — через addStack: add() вернул бы «новую» вещь без чар и износа
        const left =
          s.dmg || s.tag
            ? inventory.addStack(s)
            : inventory.add(s.item, s.count);
        this.slots[i] = left > 0 ? { ...s, count: left } : null;
        // если инвентарь полон — остаток остаётся в сетке; выбросить его — дело вызывающего
        // (InventoryUI.close), иначе следующий setSize() его обнулит
      }
    }
  }
}
