// Ведро снега-пороха: ведром по снегу-пороху — набрать, вылить — поставить (player/Interaction._bucket).
import type { ItemDef } from "../../types";
import { addNames } from "../names";
import { item } from "./define";

export const MOUNTAIN_ITEMS: ItemDef[] = [
  item({ name: "powder_snow_bucket", tile: "powder_snow_bucket", maxStack: 1 }),
];

addNames({ powder_snow_bucket: "Ведро снега-пороха" });
