// Морская жизнь: кораллы пяти цветов (блок, мёртвый блок, растение в воде) — рифы тёплого океана;
// ламинария (растёт столбом к поверхности: верхушка kelp и стебель kelp_plant), морской огурец
// (светится в воде), блок сушёной ламинарии (топливо). Коралловый блок без воды рядом умирает
// (world/behaviours/sealife). Растения в воде — waterlogged, как морская трава.
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { all, block, pillar } from "./define";

export const CORALS = [
  { id: "tube", color: "#3a5ad8", adj: "Трубчатый", adjN: "трубчатый" },
  { id: "brain", color: "#d8609a", adj: "Мозговой", adjN: "мозговой" },
  { id: "bubble", color: "#a03ad8", adj: "Пузырчатый", adjN: "пузырчатый" },
  { id: "fire", color: "#d83a3a", adj: "Огненный", adjN: "огненный" },
  { id: "horn", color: "#e8d040", adj: "Роговой", adjN: "роговой" },
] as const;

/** Растение в воде: крестик без коллизии, клетка остаётся водой. */
const waterPlant = (name: string, extra: Partial<BlockDef> = {}): BlockDef =>
  block({
    name,
    shape: "cross",
    solid: false,
    opaque: false,
    waterlogged: true,
    filter: 2,
    hardness: 0,
    tex: all(name),
    mapColor: 0x2a7a3a,
    ...extra,
  });

export const SEA_LIFE_BLOCKS: BlockDef[] = [
  ...CORALS.flatMap((c) => [
    block({
      name: `${c.id}_coral_block`,
      hardness: 1.5,
      resistance: 6,
      tool: "pickaxe",
      harvest: 1,
      drops: [{ item: `dead_${c.id}_coral_block`, n: 1 }], // как в Minecraft: без шёлка — мёртвый
      tex: all(`${c.id}_coral_block`),
      mapColor: parseInt(c.color.slice(1), 16),
    }),
    block({
      name: `dead_${c.id}_coral_block`,
      hardness: 1.5,
      resistance: 6,
      tool: "pickaxe",
      harvest: 1,
      tex: all(`dead_${c.id}_coral_block`),
      mapColor: 0x8a8680,
    }),
    waterPlant(`${c.id}_coral`, {
      drops: [],
      mapColor: parseInt(c.color.slice(1), 16),
    }),
  ]),
  waterPlant("kelp", { drops: [{ item: "kelp", n: 1 }] }),
  waterPlant("kelp_plant", {
    drops: [{ item: "kelp", n: 1 }],
    noItem: true,
    item: "kelp",
  }),
  block({
    name: "sea_pickle",
    shape: "skull",
    solid: false,
    opaque: false,
    waterlogged: true,
    filter: 2,
    light: 9,
    hardness: 0,
    tex: all("sea_pickle"),
    mapColor: 0x6a8a3a,
  }),
  block({
    name: "dried_kelp_block",
    hardness: 0.5,
    tool: "hoe",
    flammable: true,
    tex: pillar("dried_kelp_block_top", "dried_kelp_block_side"),
    mapColor: 0x3a4a2a,
  }),
];

addNames({
  ...Object.fromEntries(
    CORALS.flatMap((c) => [
      [`${c.id}_coral_block`, `${c.adj} коралловый блок`],
      [`dead_${c.id}_coral_block`, `Мёртвый ${c.adjN} коралловый блок`],
      [`${c.id}_coral`, `${c.adj} коралл`],
    ]),
  ),
  kelp: "Ламинария",
  kelp_plant: "Ламинария",
  sea_pickle: "Морской огурец",
  dried_kelp_block: "Блок сушёной ламинарии",
});
