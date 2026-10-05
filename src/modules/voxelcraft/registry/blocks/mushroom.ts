// Грибные поля: мицелий (земля с лиловым налётом), бурый и красный грибы (растут в полутьме и на мицелии,
// костная мука выращивает огромный гриб — worldgen/mushrooms), шляпки и ножка огромных грибов.
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { all, block } from "./define";

const mushroom = (name: string, light: number, mapColor: number): BlockDef =>
  block({
    name,
    shape: "cross",
    solid: false,
    opaque: false,
    hardness: 0,
    light,
    tex: all(name),
    mapColor,
  });

const cap = (name: string, color: number): BlockDef =>
  block({
    name,
    hardness: 0.2,
    tool: "axe",
    flammable: true,
    drops: [{ item: name.replace("_block", ""), n: 0, max: 2 }],
    tex: all(name),
    mapColor: color,
  });

export const MUSHROOM_BLOCKS: BlockDef[] = [
  block({
    name: "mycelium",
    hardness: 0.6,
    tool: "shovel",
    drops: [{ item: "dirt", n: 1 }],
    tex: { top: "mycelium_top", side: "mycelium_side", bottom: "dirt" },
    mapColor: 0x6f6265,
  }),
  mushroom("brown_mushroom", 1, 0x9a7a5a),
  mushroom("red_mushroom", 0, 0xc0302a),
  cap("brown_mushroom_block", 0x94704e),
  cap("red_mushroom_block", 0xb82a24),
  block({
    name: "mushroom_stem",
    hardness: 0.2,
    tool: "axe",
    flammable: true,
    drops: [],
    tex: all("mushroom_stem"),
    mapColor: 0xe0dcd0,
  }),
];

addNames({
  mycelium: "Мицелий",
  brown_mushroom: "Бурый гриб",
  red_mushroom: "Красный гриб",
  brown_mushroom_block: "Шляпка бурого гриба",
  red_mushroom_block: "Шляпка красного гриба",
  mushroom_stem: "Ножка гриба",
});
