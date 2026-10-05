// Панцирный сундук (шалкеровый ящик Minecraft): 27 слотов, как сундук, но сломанный не рассыпает
// вещи — выпадает сам, с ними в tag.items. Поставленный такой предмет возвращает их на место
// (событие blockPlace несёт tag стака из руки — player/Interaction).
import type { ItemStack } from "../../types";
import { registerBlockEntity } from "../BlockEntities";
import { CHEST_SIZE, type ChestState } from "./chest";

registerBlockEntity("shell", {
  create: (): ChestState => ({
    items: new Array<ItemStack | null>(CHEST_SIZE).fill(null),
  }),
  keep: (st) => {
    const items = (st as ChestState).items;
    return {
      item: "shell_chest",
      count: 1,
      ...(items.some(Boolean)
        ? { tag: { items: items.map((s) => (s ? { ...s } : null)) } }
        : {}),
    };
  },
  on: {
    blockPlace: (be, p) => {
      const items = (p.tag as { items?: unknown } | undefined)?.items;
      if (!Array.isArray(items)) return;
      const st = be.state as ChestState;
      for (let i = 0; i < CHEST_SIZE; i++) {
        const s = items[i] as ItemStack | null | undefined;
        st.items[i] =
          s && typeof s.item === "string" && s.count > 0 ? { ...s } : null;
      }
    },
  },
});
