// Музыкальные пластинки (systems/Disc): по одной в руке, играются в проигрывателе.
import type { ItemDef } from "../../types";
import { DISCS } from "../../systems/Disc";
import { addNames } from "../names";
import { item } from "./define";

export const SOUND_ITEMS: ItemDef[] = DISCS.map((d) =>
  item({ name: d.name, tile: d.name, maxStack: 1 }),
);

addNames({
  disc_dawn: "Пластинка «Рассвет»",
  disc_drift: "Пластинка «Дрейф»",
  disc_hollow: "Пластинка «Пустоши»",
  disc_ember: "Пластинка «Уголёк»",
  disc_void: "Пластинка «Пустота»",
});
