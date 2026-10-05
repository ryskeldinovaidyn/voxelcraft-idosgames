// Табличка: висит на стене (форма wall_mounted), ПКМ открывает ввод текста (ui/SignEditor),
// текст рисуется поверх доски (gfx/SignText). Хранит строки в блочной сущности sign.
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { all, block } from "./define";

export const SIGN_BLOCKS: BlockDef[] = [
  block({
    name: "sign",
    shape: "wall_mounted",
    solid: false,
    opaque: false,
    hardness: 1,
    tool: "axe",
    flammable: true,
    blockEntity: "sign",
    tex: all("sign"),
    mapColor: 0xb89a62,
  }),
];

addNames({ sign: "Табличка" });
