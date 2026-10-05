// Медь, как в Minecraft 1.17–1.21: медный блок и резная медь со временем тускнеют → выветриваются →
// окисляются (случайные тики, world/behaviours/copper); соты покрывают воском (бит меты WAXED — стадия
// замирает), топор снимает воск или одну стадию. Медная лампа переключается от каждого нового сигнала
// красного камня; медная решётка — сквозная.
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { all, block } from "./define";

/** Бит меты: покрыто воском — не окисляется. */
export const WAXED = 8;
/** Цепочки окисления: медный блок (он в blocks/ores) и резная медь (blocks/trial). */
export const COPPER_STAGES = [
  ["copper_block", "exposed_copper", "weathered_copper", "oxidized_copper"],
  [
    "cut_copper",
    "exposed_cut_copper",
    "weathered_cut_copper",
    "oxidized_cut_copper",
  ],
] as const;
export const STAGE_COLORS: Record<string, [string, string]> = {
  exposed: ["#a8806a", "Потускневш"],
  weathered: ["#6a9a7a", "Выветренн"],
  oxidized: ["#4ab8a0", "Окисленн"],
};

const COPPER = {
  hardness: 3,
  resistance: 6,
  tool: "pickaxe" as const,
  harvest: 2,
};

export const COPPER_BLOCKS: BlockDef[] = [
  ...Object.entries(STAGE_COLORS).flatMap(([s, [c]]) => [
    block({
      name: `${s}_copper`,
      ...COPPER,
      tex: all(`${s}_copper`),
      mapColor: parseInt(c.slice(1), 16),
    }),
    block({
      name: `${s}_cut_copper`,
      ...COPPER,
      tex: all(`${s}_cut_copper`),
      mapColor: parseInt(c.slice(1), 16),
    }),
  ]),
  block({
    name: "copper_bulb",
    ...COPPER,
    tex: all("copper_bulb"),
    mapColor: 0xc06a4a,
  }),
  block({
    name: "copper_bulb_lit",
    ...COPPER,
    light: 15,
    noItem: true,
    item: "copper_bulb",
    drops: [{ item: "copper_bulb", n: 1 }],
    tex: all("copper_bulb_lit"),
    mapColor: 0xf0c070,
  }),
  block({
    name: "copper_grate",
    ...COPPER,
    opaque: false,
    tex: all("copper_grate"),
    mapColor: 0xc06a4a,
  }),
];

addNames({
  ...Object.fromEntries(
    Object.entries(STAGE_COLORS).flatMap(([s, [, adj]]) => [
      [`${s}_copper`, `${adj}ая медь`],
      [`${s}_cut_copper`, `${adj}ая резная медь`],
    ]),
  ),
  copper_bulb: "Медная лампа",
  copper_bulb_lit: "Медная лампа",
  copper_grate: "Медная решётка",
});
