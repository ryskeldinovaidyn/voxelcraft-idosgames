// Бобы какао (сажают стручок на ствол тропического дерева — registry/blocks/cocoa) и печенье: пшеница,
// какао, пшеница → 8. Печенье попугаю ядовито (player/Interaction), как в Minecraft.
import type { ItemDef } from "../../types";
import { B } from "../Blocks";
import { addNames } from "../names";
import { item } from "./define";

export const COCOA_ITEMS: ItemDef[] = [
  item({
    name: "cocoa_beans",
    tile: "cocoa_beans",
    kind: "block",
    blockId: B.cocoa!,
  }),
  item({ name: "cookie", tile: "cookie", food: 2, saturation: 0.4 }),
];

addNames({ cocoa_beans: "Какао-бобы", cookie: "Печенье" });
