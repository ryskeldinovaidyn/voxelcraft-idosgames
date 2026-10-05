// Проводник (морской проводник Minecraft): сердце моря в раковинах наутилуса. Стоит в воде; в рамке
// из морского камня (от 16 блоков) раз в 2 с даёт силу моря — Подводное дыхание, Ночное зрение и
// Спешку — тем, кто в воде в радиусе 16 × ⌊рамка/7⌋ (world/blockentities/conduit).
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { all, block } from "./define";

export const TREASURE_BLOCKS: BlockDef[] = [
  block({
    name: "conduit",
    shape: "skull",
    solid: false,
    opaque: false,
    waterlogged: true,
    filter: 2,
    light: 15,
    hardness: 3,
    tool: "pickaxe",
    blockEntity: "conduit",
    tex: all("conduit"),
    mapColor: 0xa89a7a,
  }),
];

addNames({ conduit: "Проводник" });
