// Бамбук: тонкий стебель (форма rod), растёт столбиком до 12 на траве, земле, песке и гравии
// (world/behaviours/farming, world/Support); заросли — в джунглях. Еда и приманка панды, 2 → палка.
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { all, block } from "./define";

export const JUNGLE_BLOCKS: BlockDef[] = [
  block({
    name: "bamboo",
    shape: "rod",
    opaque: false,
    hardness: 1,
    tool: "axe",
    flammable: true,
    tex: all("bamboo"),
    mapColor: 0x5a9a2a,
  }),
];

addNames({ bamboo: "Бамбук" });
