// Щиток броненосца (сам сбрасывает, щёткой — ещё) и броня для волка из шести щитков: ручному волку ПКМ —
// надеть, берёт на себя WOLF_ARMOR урона (player/Interaction, Mob.hurt).
import type { ItemDef } from "../../types";
import { addNames } from "../names";
import { item } from "./define";

/** Сколько урона выдерживает броня волка. */
export const WOLF_ARMOR = 64;

export const ARMADILLO_ITEMS: ItemDef[] = [
  item({ name: "armadillo_scute", tile: "armadillo_scute" }),
  item({ name: "wolf_armor", tile: "wolf_armor", maxStack: 1 }),
];

addNames({
  armadillo_scute: "Щиток броненосца",
  wolf_armor: "Броня для волка",
});
