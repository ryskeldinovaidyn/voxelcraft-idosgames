// Стойка для брони (блочная сущность на четыре слота брони, показывает надетое — gfx/ArmorStand),
// путевой камень (ПКМ компасом привязывает к нему стрелку — world/behaviours/stand, ui/HUD) и
// якорь возрождения (заряжается светокамнем, в Пекле задаёт точку возрождения, в верхнем мире
// взрывается — main.goHome).
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { all, block } from "./define";

export const STAND_BLOCKS: BlockDef[] = [
  block({
    name: "armor_stand",
    shape: "stand",
    solid: false,
    opaque: false,
    hardness: 2,
    tool: "axe",
    flammable: true,
    blockEntity: "armor_stand",
    tex: all("armor_stand"),
    mapColor: 0xb89a62,
  }),
  block({
    name: "lodestone",
    hardness: 3.5,
    tool: "pickaxe",
    harvest: 1,
    tex: {
      top: "lodestone_top",
      bottom: "lodestone_side",
      side: "lodestone_side",
    },
    mapColor: 0x8a8e94,
  }),
  block({
    name: "respawn_anchor",
    hardness: 50,
    resistance: 1200,
    tool: "pickaxe",
    harvest: 3,
    light: 7,
    tex: {
      top: "respawn_anchor_top",
      bottom: "respawn_anchor_side",
      side: "respawn_anchor_side",
    },
    mapColor: 0x2a1a3a,
  }),
];

addNames({
  armor_stand: "Стойка для брони",
  lodestone: "Путевой камень",
  respawn_anchor: "Якорь возрождения",
});
