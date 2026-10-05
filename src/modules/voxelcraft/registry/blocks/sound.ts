// Звучащие блоки: проигрыватель (хранит пластинку — блочная сущность jukebox) и нотный блок
// (ПКМ меняет высоту ноты, мета 0..24). Поведение — world/behaviours/sound.ts.
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { block } from "./define";

export const SOUND_BLOCKS: BlockDef[] = [
  block({
    name: "jukebox",
    hardness: 2,
    tool: "axe",
    flammable: true,
    blockEntity: "jukebox",
    tex: { top: "jukebox_top", bottom: "jukebox_side", side: "jukebox_side" },
    mapColor: 0x6a4a32,
  }),
  block({
    name: "note_block",
    hardness: 0.8,
    tool: "axe",
    flammable: true,
    tex: { top: "note_block", bottom: "note_block", side: "note_block" },
    mapColor: 0x7a5a3a,
  }),
];

addNames({ jukebox: "Проигрыватель", note_block: "Нотный блок" });
