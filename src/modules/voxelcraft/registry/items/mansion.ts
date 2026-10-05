// Карты-исследователи картографа: в руке, как карта сокровищ, становятся картой участка с крестиком
// над целью — особняком в тёмном лесу или подводным храмом (Game._surveyHeldMap).
import type { ItemDef } from "../../types";
import { addNames } from "../names";
import { item } from "./define";

/**
 * Карты с целью: предмет → что искать (`WorldGenerator.locate`). Цель берётся из тега `{x, z}`, а
 * если его нет (карта от картографа или из /give) — ближайшая к игроку, когда карту впервые берут в руку.
 */
export const EXPLORER_MAPS: Record<string, string> = {
  treasure_map: "buried_treasure",
  ocean_explorer_map: "temple",
  woodland_explorer_map: "mansion",
};

export const MANSION_ITEMS: ItemDef[] = [
  item({ name: "ocean_explorer_map", tile: "ocean_explorer_map", maxStack: 1 }),
  item({
    name: "woodland_explorer_map",
    tile: "woodland_explorer_map",
    maxStack: 1,
  }),
];

addNames({
  ocean_explorer_map: "Карта исследователя морей",
  woodland_explorer_map: "Карта исследователя лесов",
  villager_cartographer: "Картограф",
});
