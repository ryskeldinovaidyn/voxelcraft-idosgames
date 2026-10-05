// 16 цветов Minecraft (сейв v3): недостающие цвета шерсти (12 были в legacy) и ковры всех цветов.
// Красители — registry/items/dyes.ts, рецепты — recipes/colors.ts, тайлы — gfx/painters/colors.ts.
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { all, block } from "./define";

export interface DyeColor {
  id: string;
  hex: string;
  /** Прилагательное: м. и ж. род («Белый краситель», «Белая шерсть»). */
  adj: [string, string];
  /** Шерсть этого цвета уже есть (legacy). */
  legacyWool?: boolean;
}

export const DYE_COLORS: DyeColor[] = [
  { id: "white", hex: "#e9ecec", adj: ["Белый", "Белая"], legacyWool: true },
  {
    id: "orange",
    hex: "#f07613",
    adj: ["Оранжевый", "Оранжевая"],
    legacyWool: true,
  },
  { id: "magenta", hex: "#bd44b3", adj: ["Пурпурный", "Пурпурная"] },
  {
    id: "light_blue",
    hex: "#3aafd9",
    adj: ["Голубой", "Голубая"],
    legacyWool: true,
  },
  { id: "yellow", hex: "#f8c527", adj: ["Жёлтый", "Жёлтая"], legacyWool: true },
  { id: "lime", hex: "#70b919", adj: ["Лаймовый", "Лаймовая"] },
  { id: "pink", hex: "#ed8dac", adj: ["Розовый", "Розовая"], legacyWool: true },
  { id: "gray", hex: "#3e4447", adj: ["Серый", "Серая"], legacyWool: true },
  { id: "light_gray", hex: "#8e8e86", adj: ["Светло-серый", "Светло-серая"] },
  { id: "cyan", hex: "#158991", adj: ["Бирюзовый", "Бирюзовая"] },
  {
    id: "purple",
    hex: "#792aac",
    adj: ["Фиолетовый", "Фиолетовая"],
    legacyWool: true,
  },
  { id: "blue", hex: "#35399d", adj: ["Синий", "Синяя"], legacyWool: true },
  {
    id: "brown",
    hex: "#724728",
    adj: ["Коричневый", "Коричневая"],
    legacyWool: true,
  },
  {
    id: "green",
    hex: "#546d1b",
    adj: ["Зелёный", "Зелёная"],
    legacyWool: true,
  },
  { id: "red", hex: "#a12722", adj: ["Красный", "Красная"], legacyWool: true },
  { id: "black", hex: "#141519", adj: ["Чёрный", "Чёрная"], legacyWool: true },
];

const hex = (c: string): number => parseInt(c.slice(1), 16);

export const COLOR_BLOCKS: BlockDef[] = [
  ...DYE_COLORS.filter((c) => !c.legacyWool).map((c) =>
    block({
      name: `${c.id}_wool`,
      hardness: 0.8,
      flammable: true,
      tex: all(`${c.id}_wool`),
      mapColor: hex(c.hex),
    }),
  ),
  ...DYE_COLORS.map((c) =>
    block({
      name: `${c.id}_carpet`,
      shape: "carpet",
      solid: false,
      opaque: false,
      hardness: 0.1,
      flammable: true,
      tex: all(`${c.id}_wool`),
      mapColor: hex(c.hex),
    }),
  ),
];

for (const c of DYE_COLORS) {
  const names: Record<string, string> = {
    [`${c.id}_carpet`]: `${c.adj[0]} ковёр`,
    [`${c.id}_dye`]: `${c.adj[0]} краситель`,
  };
  if (!c.legacyWool) names[`${c.id}_wool`] = `${c.adj[1]} шерсть`;
  addNames(names);
}
