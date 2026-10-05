// Пещеры Minecraft 1.17–1.18. Аметистовые жеоды: шар из гладкого базальта, кальцита и аметиста с
// пустотой внутри; растущий аметист отращивает на своих гранях почки, почка дорастает до друзы, а из
// друзы киркой добываются осколки. Пышные пещеры: мох, моховой ковёр, азалии, пещерные лозы (часть — со
// светящимися ягодами), спороцвет. Поведение — world/behaviours/caves.ts, генерация — OverworldGenerator.
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { all, block } from "./define";

/** Стадии роста аметиста: малая почка → средняя → большая → друза. */
export const AMETHYST_BUDS = [
  "small_amethyst_bud",
  "medium_amethyst_bud",
  "large_amethyst_bud",
  "amethyst_cluster",
] as const;

/** Висят под потолком: держатся за твёрдый блок сверху или за лозу (world/Support.ts, Placement). */
export const HANGING = new Set([
  "cave_vines",
  "cave_vines_lit",
  "spore_blossom",
]);

/** Растение-крестик без коллизии. */
const plant = (name: string, extra: Partial<BlockDef> = {}): BlockDef =>
  block({
    name,
    shape: "cross",
    solid: false,
    opaque: false,
    hardness: 0,
    flammable: true,
    tex: all(name),
    mapColor: 0x5a8a2a,
    ...extra,
  });

export const CAVE_BLOCKS: BlockDef[] = [
  block({
    name: "amethyst_block",
    hardness: 1.5,
    tool: "pickaxe",
    harvest: 1,
    tex: all("amethyst_block"),
    mapColor: 0x8a5ac8,
  }),
  // растущий аметист не добывается ничем, как в Minecraft
  block({
    name: "budding_amethyst",
    hardness: 1.5,
    tool: "pickaxe",
    drops: [],
    tex: all("budding_amethyst"),
    mapColor: 0x8a5ac8,
  }),
  ...AMETHYST_BUDS.map((name, i) =>
    block({
      name,
      shape: "cross",
      solid: false,
      opaque: false,
      hardness: 1.5,
      tool: "pickaxe",
      harvest: i === 3 ? 1 : 0,
      light: [1, 2, 4, 5][i]!,
      drops: i === 3 ? [{ item: "amethyst_shard", n: 4 }] : [],
      tex: all(name),
      mapColor: 0xa87ae8,
    }),
  ),
  block({
    name: "calcite",
    hardness: 0.75,
    tool: "pickaxe",
    harvest: 1,
    tex: all("calcite"),
    mapColor: 0xe0e0dc,
  }),
  block({
    name: "smooth_basalt",
    hardness: 1.25,
    tool: "pickaxe",
    harvest: 1,
    tex: all("smooth_basalt"),
    mapColor: 0x3a3a40,
  }),
  // тонированное стекло: сквозь него видно, но свет не проходит
  block({
    name: "tinted_glass",
    opaque: false,
    filter: 15,
    hardness: 0.3,
    tex: all("tinted_glass"),
    mapColor: 0x3a2a4a,
  }),
  block({
    name: "moss_block",
    hardness: 0.1,
    tool: "hoe",
    flammable: true,
    tex: all("moss_block"),
    mapColor: 0x5a7a2a,
  }),
  block({
    name: "moss_carpet",
    shape: "carpet",
    opaque: false,
    hardness: 0.1,
    flammable: true,
    tex: all("moss_block"),
    mapColor: 0x5a7a2a,
  }),
  plant("azalea"),
  plant("flowering_azalea", { mapColor: 0x9a6a9a }),
  // лоза ставится светящимися ягодами (item), ягоды с неё — ПКМ или сломать
  plant("cave_vines", { noItem: true, item: "glow_berries", drops: [] }),
  plant("cave_vines_lit", {
    noItem: true,
    item: "glow_berries",
    light: 14,
    drops: [{ item: "glow_berries", n: 1 }],
  }),
  plant("spore_blossom", { mapColor: 0xd87aa0 }),
];

addNames({
  amethyst_block: "Аметистовый блок",
  budding_amethyst: "Растущий аметист",
  small_amethyst_bud: "Малая аметистовая почка",
  medium_amethyst_bud: "Средняя аметистовая почка",
  large_amethyst_bud: "Большая аметистовая почка",
  amethyst_cluster: "Аметистовая друза",
  calcite: "Кальцит",
  smooth_basalt: "Гладкий базальт",
  tinted_glass: "Тонированное стекло",
  moss_block: "Блок мха",
  moss_carpet: "Моховой ковёр",
  azalea: "Азалия",
  flowering_azalea: "Цветущая азалия",
  cave_vines: "Пещерная лоза",
  cave_vines_lit: "Пещерная лоза с ягодами",
  spore_blossom: "Спороцвет",
});
