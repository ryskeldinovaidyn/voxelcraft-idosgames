// Стойка для брони: четыре слота брони (шлем, нагрудник, поножи, ботинки). Сломали — всё выпадает.
import type { ItemStack } from "../../types";
import { registerBlockEntity } from "../BlockEntities";

export type ArmorStandState = { items: (ItemStack | null)[] };

registerBlockEntity("armor_stand", {
  create: (): ArmorStandState => ({ items: [null, null, null, null] }),
  contents: (st) => (st as ArmorStandState).items,
});
