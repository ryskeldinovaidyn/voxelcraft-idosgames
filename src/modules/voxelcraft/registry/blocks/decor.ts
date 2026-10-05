// Мелочи для дома: фонарь и фонарь душ (стоят на полу или висят под потолком — форма lantern), цепь
// (тонкий столбик — форма rod), свеча (одна в блоке; огниво зажигает, рука гасит — world/behaviours/decor).
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { all, block } from "./define";

const METAL = {
  opaque: false,
  hardness: 3.5,
  tool: "pickaxe" as const,
  harvest: 1,
};
const WAX = {
  shape: "candle" as const,
  solid: false,
  opaque: false,
  hardness: 0.1,
  flammable: true,
};

export const DECOR_BLOCKS: BlockDef[] = [
  block({
    name: "lantern",
    shape: "lantern",
    ...METAL,
    light: 15,
    tex: all("lantern"),
    mapColor: 0x4a4a52,
  }),
  block({
    name: "soul_lantern",
    shape: "lantern",
    ...METAL,
    light: 10,
    tex: all("soul_lantern"),
    mapColor: 0x3a5a6a,
  }),
  block({
    name: "chain",
    shape: "rod",
    ...METAL,
    hardness: 5,
    tex: all("chain"),
    mapColor: 0x3a3a42,
  }),
  block({ name: "candle", ...WAX, tex: all("candle"), mapColor: 0xe8dcb8 }),
  block({
    name: "candle_lit",
    ...WAX,
    light: 12,
    noItem: true,
    item: "candle",
    drops: [{ item: "candle", n: 1 }],
    tex: all("candle_lit"),
    mapColor: 0xf0d880,
  }),
];

addNames({
  lantern: "Фонарь",
  soul_lantern: "Фонарь душ",
  chain: "Цепь",
  candle: "Свеча",
  candle_lit: "Свеча",
});
