// Биомы Пекла (worldgen/inferno): багровый и искажённый леса — нилий на полу, огромные грибы Пекла из
// ножки-стебля и шляпки из наростов со светогрибами (worldgen/fungus), корни и грибы; долина душ — песок
// и почва душ. Доски — из стеблей.
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { all, block } from "./define";

const nylium = (name: string, mapColor: number): BlockDef =>
  block({
    name,
    hardness: 0.4,
    tool: "pickaxe",
    harvest: 1,
    drops: [{ item: "infernal_stone", n: 1 }],
    tex: { top: `${name}_top`, side: `${name}_side`, bottom: "infernal_stone" },
    mapColor,
  });
// стебли и доски Пекла не горят, как в Minecraft
const stem = (name: string, mapColor: number): BlockDef =>
  block({
    name,
    hardness: 2,
    tool: "axe",
    tex: { top: `${name}_top`, side: `${name}_side` },
    mapColor,
  });
const planks = (name: string, mapColor: number): BlockDef =>
  block({ name, hardness: 2, tool: "axe", tex: all(name), mapColor });
const wart = (name: string, mapColor: number, light = 0): BlockDef =>
  block({ name, hardness: 1, tool: "hoe", light, tex: all(name), mapColor });
const plant = (name: string, mapColor: number): BlockDef =>
  block({
    name,
    shape: "cross",
    solid: false,
    opaque: false,
    hardness: 0,
    tex: all(name),
    mapColor,
  });

export const CRIMSON_BLOCKS: BlockDef[] = [
  nylium("crimson_nylium", 0x8a1a1a),
  nylium("warped_nylium", 0x1a7a6a),
  stem("crimson_stem", 0x7a2a3a),
  stem("warped_stem", 0x3a5a5a),
  planks("crimson_planks", 0x6a3448),
  planks("warped_planks", 0x2a6a64),
  wart("inferno_wart_block", 0x8a1414),
  wart("warped_wart_block", 0x167a78),
  wart("shroomlight", 0xf0a040, 15),
  plant("crimson_fungus", 0xa02020),
  plant("warped_fungus", 0x20a090),
  plant("crimson_roots", 0x8a1a2a),
  plant("warped_roots", 0x1a8a7a),
  block({
    name: "soul_soil",
    hardness: 0.5,
    tool: "shovel",
    tex: all("soul_soil"),
    mapColor: 0x4a3a2e,
  }),
];

addNames({
  crimson_nylium: "Багровый нилий",
  warped_nylium: "Искажённый нилий",
  crimson_stem: "Багровый стебель",
  warped_stem: "Искажённый стебель",
  crimson_planks: "Багровые доски",
  warped_planks: "Искажённые доски",
  inferno_wart_block: "Блок адского нароста",
  warped_wart_block: "Искажённый нарост",
  shroomlight: "Светогриб",
  crimson_fungus: "Багровый гриб",
  warped_fungus: "Искажённый гриб",
  crimson_roots: "Багровые корни",
  warped_roots: "Искажённые корни",
  soul_soil: "Почва душ",
});
