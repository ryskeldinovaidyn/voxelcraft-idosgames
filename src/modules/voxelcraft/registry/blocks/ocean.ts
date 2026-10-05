// Океан: морская трава на дне (стоит в воде — waterlogged), морской камень (призмарин Minecraft),
// его кирпичи и тёмный вариант, морской фонарь — из них подводные храмы (worldgen/features/temple);
// губка впитывает воду и становится мокрой (world/behaviours/ocean), черепашье яйцо — на пляже.
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { all, block } from "./define";

const stone = (name: string, mapColor: number): BlockDef =>
  block({
    name,
    hardness: 1.5,
    resistance: 6,
    tool: "pickaxe",
    harvest: 1,
    tex: all(name),
    mapColor,
  });

export const OCEAN_BLOCKS: BlockDef[] = [
  block({
    name: "seagrass",
    shape: "cross",
    solid: false,
    opaque: false,
    waterlogged: true,
    replaceable: true,
    filter: 2,
    hardness: 0,
    tex: all("seagrass"),
    mapColor: 0x2a7a3a,
  }),
  stone("sea_stone", 0x6aa89a),
  stone("sea_bricks", 0x7ab8a8),
  stone("dark_sea_stone", 0x2a5048),
  block({
    name: "sea_lantern",
    opaque: false,
    hardness: 0.3,
    light: 15,
    drops: [{ item: "sea_crystals", n: 2, max: 3 }],
    tex: all("sea_lantern"),
    mapColor: 0xd8f0e8,
  }),
  block({
    name: "sponge",
    hardness: 0.6,
    tool: "hoe",
    tex: all("sponge"),
    mapColor: 0xd8c850,
  }),
  block({
    name: "wet_sponge",
    hardness: 0.6,
    tool: "hoe",
    tex: all("wet_sponge"),
    mapColor: 0xa89a3a,
  }),
  block({
    name: "turtle_egg",
    shape: "skull",
    opaque: false,
    hardness: 0.5,
    drops: [], // как в Minecraft: без шёлкового касания разбивается
    tex: all("turtle_egg"),
    mapColor: 0xe8e0c0,
  }),
];

addNames({
  seagrass: "Морская трава",
  sea_stone: "Морской камень",
  sea_bricks: "Кирпичи морского камня",
  dark_sea_stone: "Тёмный морской камень",
  sea_lantern: "Морской фонарь",
  sponge: "Губка",
  wet_sponge: "Мокрая губка",
  turtle_egg: "Черепашье яйцо",
  sea_temple: "Подводный храм",
});
