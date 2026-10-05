// Мангровое болото: мангр (вторая волна поздних пород — registry/blocks/wood), его корни-ходули, грязь
// (пузырёк воды по земле) и что из неё — утрамбованная грязь и грязевые кирпичи; лягушачья икра на воде
// (world/behaviours/mangrove — из неё головастики) и лягушачий свет трёх цветов (лягушка съела магмовый
// куб — entities/FrogBrain).
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { all, block, pillar } from "./define";
import { lateWoodBlocks } from "./wood";

/** Цвета лягушачьего света: какая лягушка его даёт — registry/mobs/frog. */
export const FROGLIGHTS = [
  { id: "ochre", top: "#f0d890", side: "#e8c060", name: "Охряный" },
  { id: "verdant", top: "#d8f0b0", side: "#a8e080", name: "Изумрудный" },
  { id: "pearlescent", top: "#f8e8f8", side: "#e8c8e8", name: "Перламутровый" },
] as const;

const MUD = 0x3a3030;

export const MANGROVE_BLOCKS: BlockDef[] = [
  ...lateWoodBlocks(2),
  block({
    name: "mud",
    hardness: 0.5,
    tool: "shovel",
    tex: all("mud"),
    mapColor: MUD,
  }),
  block({
    name: "packed_mud",
    hardness: 1,
    tex: all("packed_mud"),
    mapColor: 0x8a6a50,
  }),
  block({
    name: "mud_bricks",
    hardness: 1.5,
    tool: "pickaxe",
    harvest: 1,
    tex: all("mud_bricks"),
    mapColor: 0x8a6a50,
  }),
  block({
    name: "mangrove_roots",
    opaque: false,
    hardness: 0.7,
    tool: "axe",
    flammable: true,
    tex: all("mangrove_roots"),
    mapColor: 0x4a3a2a,
  }),
  // икру не подобрать (как в Minecraft): из неё только головастики
  block({
    name: "frogspawn",
    shape: "carpet",
    solid: false,
    opaque: false,
    hardness: 0,
    noItem: true,
    drops: [],
    tex: all("frogspawn"),
    mapColor: 0x6a6a5a,
  }),
  ...FROGLIGHTS.map((f) =>
    block({
      name: `${f.id}_froglight`,
      hardness: 0.3,
      light: 15,
      axis: true,
      tex: pillar(`${f.id}_froglight_top`, `${f.id}_froglight_side`),
      mapColor: parseInt(f.side.slice(1), 16),
    }),
  ),
];

addNames({
  mud: "Грязь",
  packed_mud: "Утрамбованная грязь",
  mud_bricks: "Грязевые кирпичи",
  mangrove_roots: "Мангровые корни",
  mangrove_propagule: "Пропагула мангра",
  frogspawn: "Лягушачья икра",
  mangrove_swamp: "Мангровое болото",
  ...Object.fromEntries(
    FROGLIGHTS.map((f) => [`${f.id}_froglight`, `${f.name} лягушачий свет`]),
  ),
});
