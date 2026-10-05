// Знамёна 16 цветов: полотно на стене (форма wall_mounted). Узоры кладут на ткацком станке
// (systems/Banner), они живут в блочной сущности banner и рисуются поверх полотна (gfx/Banners).
// Сломанное знамя выпадает со своими узорами в tag — поэтому сам блок не роняет ничего.
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { DYE_COLORS } from "./colors";
import { all, block } from "./define";

const hex = (c: string): number => parseInt(c.slice(1), 16);

/** Средний род прилагательного цвета: «Красный» → «Красное» («знамя» — оно). */
const neuter = (adj: string): string =>
  adj.endsWith("ий") ? adj.slice(0, -2) + "ее" : adj.slice(0, -2) + "ое";

export const BANNER_BLOCKS: BlockDef[] = DYE_COLORS.map((c) =>
  block({
    name: `${c.id}_banner`,
    shape: "wall_mounted",
    solid: false,
    opaque: false,
    hardness: 1,
    tool: "axe",
    flammable: true,
    blockEntity: "banner",
    drops: [],
    tex: all(`${c.id}_banner`),
    mapColor: hex(c.hex),
  }),
);

addNames(
  Object.fromEntries(
    DYE_COLORS.map((c) => [`${c.id}_banner`, `${neuter(c.adj[0])} знамя`]),
  ),
);
