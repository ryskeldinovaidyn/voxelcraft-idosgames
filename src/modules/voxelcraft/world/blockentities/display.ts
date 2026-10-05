// Рамка: показывает один предмет (gfx/DisplayItems) и помнит его поворот — восемь положений, как в
// Minecraft; их же читает компаратор (world/Containers.fillLevel). Сломали — предмет выпадает.
import type { ItemStack } from "../../types";
import { registerBlockEntity } from "../BlockEntities";

/** Сколько положений у предмета в рамке. */
export const DISPLAY_TURNS = 8;

export type DisplayState = {
  items: (ItemStack | null)[];
  /** Поворот предмета 0..7. */
  rot?: number;
};

registerBlockEntity("display", {
  create: (): DisplayState => ({ items: [null], rot: 0 }),
  contents: (st) => (st as DisplayState).items,
});
