// Изделия: цветное стекло и стеклянные панели 16 цветов (8 стёкол вокруг красителя; стекло у нас
// «вырезное» — цветные рамка и прожилки, середина прозрачна), полированный базальт, полированный
// чернокамень, кирпичи из него и ступени, плита, стена из чернокамня.
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { DYE_COLORS } from "./colors";
import { all, block } from "./define";

const hex = (c: string): number => parseInt(c.slice(1), 16);
/** «Белая» → «Белое», «Синяя» → «Синее»: стекло — среднего рода. */
const neuter = (f: string): string =>
  f.replace(/ая$/, "ое").replace(/яя$/, "ее");

const STONE = {
  hardness: 1.5,
  resistance: 6,
  tool: "pickaxe",
  harvest: 1,
} as const;
const BLACK = { ...STONE, tex: all("blackstone"), mapColor: 0x2a2428 } as const;

export const CRAFTED_BLOCKS: BlockDef[] = [
  ...DYE_COLORS.map((c) =>
    block({
      name: `${c.id}_stained_glass`,
      opaque: false,
      hardness: 0.3,
      drops: [],
      tex: all(`${c.id}_stained_glass`),
      mapColor: hex(c.hex),
    }),
  ),
  ...DYE_COLORS.map((c) =>
    block({
      name: `${c.id}_stained_glass_pane`,
      shape: "pane",
      hardness: 0.3,
      drops: [],
      tex: all(`${c.id}_stained_glass`),
      mapColor: hex(c.hex),
    }),
  ),
  block({
    name: "polished_basalt",
    ...STONE,
    tex: { top: "polished_basalt_top", side: "polished_basalt_side" },
    mapColor: 0x5a5a62,
  }),
  block({
    name: "polished_blackstone",
    ...STONE,
    tex: all("polished_blackstone"),
    mapColor: 0x363036,
  }),
  block({
    name: "polished_blackstone_bricks",
    ...STONE,
    tex: all("polished_blackstone_bricks"),
    mapColor: 0x302a30,
  }),
  block({ name: "blackstone_stairs", shape: "stairs", ...BLACK }),
  block({ name: "blackstone_slab", shape: "slab", ...BLACK }),
  block({ name: "blackstone_wall", shape: "wall", ...BLACK }),
];

for (const c of DYE_COLORS)
  addNames({
    [`${c.id}_stained_glass`]: `${neuter(c.adj[1])} стекло`,
    [`${c.id}_stained_glass_pane`]: `${c.adj[1]} стеклянная панель`,
  });
addNames({
  polished_basalt: "Полированный базальт",
  polished_blackstone: "Полированный чернокамень",
  polished_blackstone_bricks: "Кирпичи из чернокамня",
  blackstone_stairs: "Ступени из чернокамня",
  blackstone_slab: "Плита из чернокамня",
  blackstone_wall: "Стена из чернокамня",
});
