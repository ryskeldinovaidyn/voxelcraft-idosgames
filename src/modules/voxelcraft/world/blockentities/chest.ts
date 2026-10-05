// Сундук: 27 слотов. Содержимое выпадает, когда сундук ломают.
import type { ItemStack } from "../../types";
import { registerBlockEntity } from "../BlockEntities";

export const CHEST_SIZE = 27;

export type ChestState = { items: (ItemStack | null)[] };

registerBlockEntity("chest", {
  create: (): ChestState => ({
    items: new Array<ItemStack | null>(CHEST_SIZE).fill(null),
  }),
  contents: (st) => (st as ChestState).items,
});
