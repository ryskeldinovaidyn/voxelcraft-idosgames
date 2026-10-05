// Кафедра: держит одну книгу (systems/Book). Сломали — книга выпадает со своим текстом в tag.
import type { ItemStack } from "../../types";
import { registerBlockEntity } from "../BlockEntities";

export type LecternState = { items: (ItemStack | null)[] };

registerBlockEntity("lectern", {
  create: (): LecternState => ({ items: [null] }),
  contents: (st) => (st as LecternState).items,
});
