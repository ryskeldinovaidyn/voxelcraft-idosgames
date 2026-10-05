// Табличка: до четырёх строк текста (systems/SignText). Текст уходит в сейв вместе с миром.
import { registerBlockEntity } from "../BlockEntities";

export type SignState = { lines: string[] };

registerBlockEntity("sign", {
  create: (): SignState => ({ lines: [] }),
});
