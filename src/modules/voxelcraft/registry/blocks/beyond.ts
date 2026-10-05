// Предел и путь к нему (сейв v3): рамка портала Предела (бит TOP — вставлено Око), сам портал,
// камень Предела, яйцо дракона. Цитадель — worldgen/overworld, остров — worldgen/beyond.
import type { BlockDef } from "../../types";
import { all, block } from "./define";

export const BEYOND_BLOCKS: BlockDef[] = [
  // рамка: в выживании не ломается (как в Minecraft), в креативе ставится для своих порталов
  block({
    name: "rim_frame",
    shape: "frame",
    opaque: false,
    hardness: Infinity,
    resistance: 3_600_000,
    light: 1,
    tex: {
      top: "rim_frame_top",
      side: "rim_frame_side",
      bottom: "beyond_stone",
      on: "rim_frame_eye",
    },
    mapColor: 0x3a6a5a,
  }),
  block({
    name: "beyond_portal",
    shape: "end_portal",
    solid: false,
    opaque: false,
    hardness: Infinity,
    resistance: 3_600_000,
    light: 15,
    filter: 0,
    drops: [],
    noItem: true,
    tex: all("beyond_portal"),
    mapColor: 0x0a0a14,
  }),
  block({
    name: "beyond_stone",
    hardness: 3,
    resistance: 9,
    tool: "pickaxe",
    harvest: 1,
    tex: all("beyond_stone"),
    mapColor: 0xdcdca0,
  }),
  block({
    name: "dragon_egg",
    shape: "egg",
    opaque: false,
    hardness: 3,
    resistance: 9,
    light: 1,
    gravity: true,
    tex: all("dragon_egg"),
    mapColor: 0x1a0a24,
  }),
];
