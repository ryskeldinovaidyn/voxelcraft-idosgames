// Колокол и картины. Колокол звонит по ПКМ (world/behaviours/hall). Картина — четыре сюжета:
// ПКМ меняет сюжет на месте, как нотный блок меняет ноту. Картина висит на стене (форма
// wall_mounted, registry/shapes.ts): ставится только на боковую грань и держится за неё.
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { all, block } from "./define";

/** Сюжеты по кругу — порядок задаёт перебор по ПКМ. */
export const PAINTINGS: readonly string[] = [
  "painting_sunset",
  "painting_pine",
  "painting_eye",
  "painting_diamond",
];

const CANVAS = { hardness: 0.4, tool: "axe" as const, flammable: true };

export const HALL_BLOCKS: BlockDef[] = [
  block({
    name: "bell",
    hardness: 5,
    tool: "pickaxe",
    harvest: 1,
    opaque: false,
    tex: { top: "bell_top", bottom: "bell_top", side: "bell_side" },
    mapColor: 0xe8c840,
  }),
  ...PAINTINGS.map((name, i) =>
    block({
      name,
      shape: "wall_mounted",
      solid: false,
      opaque: false,
      ...CANVAS,
      // в руке и в дропе — одна «Картина»: сюжет меняется на месте
      ...(i === 0
        ? {}
        : {
            noItem: true,
            item: PAINTINGS[0]!,
            drops: [{ item: PAINTINGS[0]!, n: 1 }],
          }),
      tex: all("painting_" + i),
      mapColor: 0xd8c8a8,
    }),
  ),
];

addNames({
  bell: "Колокол",
  painting_sunset: "Картина «Закат»",
  painting_pine: "Картина «Ель»",
  painting_eye: "Картина «Глаз»",
  painting_diamond: "Картина «Ромб»",
});
