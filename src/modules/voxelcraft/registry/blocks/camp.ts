// Активирующие рельсы (под током взводят вагонетку с динамитом, запирают вагонетку с воронкой,
// высаживают седока — EntityManager) и костёр: светит, жарит 4 порции еды по 30 с (блочная
// сущность campfire), жжёт стоящих на нём, дымом под ульем успокаивает пчёл. Потухший костёр —
// отдельный блок без света (лопатой гасят, огнивом зажигают — world/behaviours/camp.ts).
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { block } from "./define";

const campfire = (
  name: string,
  top: string,
  light: number,
  extra: Partial<BlockDef> = {},
): BlockDef =>
  block({
    name,
    shape: "campfire",
    opaque: false,
    hardness: 2,
    tool: "axe",
    light,
    blockEntity: "campfire",
    drops: [{ item: "charcoal", n: 2 }],
    tex: { top, side: "campfire_side", bottom: "campfire_side" },
    mapColor: 0x6a4a2a,
    ...extra,
  });

export const CAMP_BLOCKS: BlockDef[] = [
  block({
    name: "activator_rail",
    shape: "rail",
    solid: false,
    opaque: false,
    hardness: 0.7,
    tool: "pickaxe",
    tex: {
      top: "activator_rail",
      side: "activator_rail",
      bottom: "activator_rail",
      on: "activator_rail_on",
    },
    mapColor: 0x8a5a5a,
  }),
  campfire("campfire", "campfire_top", 15),
  campfire("campfire_out", "campfire_off", 0, {
    item: "campfire",
    noItem: true,
  }),
];

addNames({
  activator_rail: "Активирующие рельсы",
  campfire: "Костёр",
  campfire_out: "Потухший костёр",
  chest_minecart: "Вагонетка с сундуком",
  hopper_minecart: "Вагонетка с воронкой",
  tnt_minecart: "Вагонетка с динамитом",
});
