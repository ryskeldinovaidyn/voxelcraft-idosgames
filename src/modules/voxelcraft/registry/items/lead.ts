// Поводок: ПКМ по мирному или нейтральному мобу — привязать к себе (идёт следом, дальше 12 блоков рвётся),
// ПКМ по привязанному — отвязать (entities/MobBrain, player/Interaction). 4 нити и слизь → 2.
import type { ItemDef } from "../../types";
import { addNames } from "../names";
import { item } from "./define";

export const LEAD_ITEMS: ItemDef[] = [item({ name: "lead", tile: "lead" })];

addNames({ lead: "Поводок" });
