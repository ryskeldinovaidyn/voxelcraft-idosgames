// Пепельный череп (падает с Пепельного скелета; три на Т из песка душ — Пепельный владыка,
// entities/AshLord.ts) и маяк (звезда Пекла + стекло + обсидиан; пирамида из железа, золота, алмазов
// или изумрудов даёт силы игроку рядом — world/Beacon.ts). Череп смотрит лицом к игроку (мета —
// facing, как у печи).
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { block } from "./define";

export const BOSS_BLOCKS: BlockDef[] = [
  block({
    name: "ash_skull",
    shape: "skull",
    solid: true,
    opaque: false,
    hardness: 1,
    tex: {
      top: "ash_skull_top",
      bottom: "ash_skull_top",
      side: "ash_skull_side",
      front: "ash_skull_front",
    },
    mapColor: 0x2a2a2a,
  }),
  block({
    name: "beacon",
    opaque: false,
    hardness: 3,
    light: 15,
    blockEntity: "beacon",
    tex: { top: "beacon", side: "beacon", bottom: "beacon" },
    mapColor: 0x7ee8e0,
  }),
];

addNames({ ash_skull: "Пепельный череп", beacon: "Маяк" });
