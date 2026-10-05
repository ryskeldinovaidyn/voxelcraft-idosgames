// Какао (форма pod): стручок на боку ствола тропического дерева, 3 стадии в битах 2..3 меты, сторона ствола —
// в битах 0..1; спелый роняет 2–3 боба (systems/Mining). Сажают бобами (registry/items/cocoa). Факел душ —
// факел со светом 10.
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { all, block } from "./define";

export const COCOA_BLOCKS: BlockDef[] = [
  block({
    name: "cocoa",
    shape: "pod",
    solid: false,
    opaque: false,
    hardness: 0.2,
    tool: "axe",
    noItem: true,
    item: "cocoa_beans",
    tex: all("cocoa"),
    mapColor: 0xa86a30,
  }),
  block({
    name: "soul_torch",
    shape: "torch",
    solid: false,
    hardness: 0,
    light: 10,
    tex: all("soul_torch"),
    mapColor: 0x40c8e0,
  }),
];

addNames({ cocoa: "Какао", soul_torch: "Факел душ" });
