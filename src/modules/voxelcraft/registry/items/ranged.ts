// Арбалет и трезубец (player/Interaction._shootBow):
// арбалет — держишь ПКМ 1.25 с: заряжается (стрела тратится, tag.loaded), заряженный стреляет одним нажатием
//   — сильнее и быстрее лука;
// трезубец — оружие ближнего боя (9 урона); держишь ПКМ и отпускаешь — бросок: летит, втыкается, его можно
//   подобрать (entities/Arrow). Выпадает из утопленников.
import type { ItemDef } from "../../types";
import { addNames } from "../names";
import { item } from "./define";

/** Сколько держать ПКМ, чтобы зарядить арбалет, сек. */
export const CROSSBOW_CHARGE = 1.25;
/** Сколько держать ПКМ перед броском трезубца, сек. */
export const TRIDENT_CHARGE = 0.5;

export const RANGED_ITEMS: ItemDef[] = [
  item({
    name: "crossbow",
    tile: "crossbow",
    kind: "tool",
    maxStack: 1,
    durability: 465,
  }),
  item({
    name: "trident",
    tile: "trident",
    kind: "tool",
    maxStack: 1,
    durability: 250,
    damage: 9,
  }),
];

addNames({ crossbow: "Арбалет", trident: "Трезубец" });
