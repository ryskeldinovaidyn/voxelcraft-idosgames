// Красители 16 цветов (как в Minecraft). Откуда берутся — recipes/colors.ts и плавка кактуса.
import type { ItemDef } from "../../types";
import { DYE_COLORS } from "../blocks/colors";
import { item } from "./define";

export const DYE_ITEMS: ItemDef[] = DYE_COLORS.map((c) =>
  item({ name: `${c.id}_dye`, tile: `${c.id}_dye` }),
);

/** Вагонетка (entities/Minecart): ставится на рельс ПКМ (world/behaviours/rails). */
export const TRANSPORT_ITEMS: ItemDef[] = [
  item({ name: "minecart", tile: "minecart", maxStack: 1 }),
  item({ name: "chest_minecart", tile: "chest_minecart", maxStack: 1 }),
  item({ name: "hopper_minecart", tile: "hopper_minecart", maxStack: 1 }),
  item({ name: "tnt_minecart", tile: "tnt_minecart", maxStack: 1 }),
];
