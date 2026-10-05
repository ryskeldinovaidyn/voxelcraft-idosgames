// Красители, как в Minecraft: из цветов, костной муки, лазурита, кактуса (плавка — recipes/smelting)
// и смешиванием; чёрный — из чернильного мешка спрута, коричневый — из какао-бобов (и по-старому
// красный + зелёный). Шерсть любого цвета + краситель
// → шерсть этого цвета; две шерсти → три ковра.
import type { Recipe } from "../../types";
import { DYE_COLORS } from "../blocks/colors";

const one = (from: string[], dye: string, count = 1): Recipe => ({
  shapeless: from,
  result: { item: `${dye}_dye`, count },
});

export const COLOR_RECIPES: Recipe[] = [
  one(["flower_red"], "red"),
  one(["flower_yellow"], "yellow"),
  one(["bone_meal"], "white"),
  one(["lapis_lazuli"], "blue"),
  one(["ink_sac"], "black"),
  one(["cocoa_beans"], "brown"),
  one(["red_dye", "green_dye"], "brown", 2),
  one(["red_dye", "yellow_dye"], "orange", 2),
  one(["red_dye", "white_dye"], "pink", 2),
  one(["green_dye", "white_dye"], "lime", 2),
  one(["blue_dye", "white_dye"], "light_blue", 2),
  one(["blue_dye", "green_dye"], "cyan", 2),
  one(["red_dye", "blue_dye"], "purple", 2),
  one(["purple_dye", "pink_dye"], "magenta", 2),
  one(["black_dye", "white_dye"], "gray", 2),
  one(["gray_dye", "white_dye"], "light_gray", 2),
  ...DYE_COLORS.map((c): Recipe => ({
    shapeless: [`${c.id}_dye`, "#wool"],
    result: { item: `${c.id}_wool`, count: 1 },
  })),
  ...DYE_COLORS.map((c): Recipe => ({
    pattern: [[`${c.id}_wool`, `${c.id}_wool`]],
    result: { item: `${c.id}_carpet`, count: 3 },
  })),
  // цветное стекло: 8 стёкол вокруг красителя; панели — 6 цветных стёкол → 16 или 8 панелей вокруг красителя
  ...DYE_COLORS.flatMap((c): Recipe[] => {
    const g = `${c.id}_stained_glass`;
    return [
      {
        pattern: [
          ["glass", "glass", "glass"],
          ["glass", `${c.id}_dye`, "glass"],
          ["glass", "glass", "glass"],
        ],
        result: { item: g, count: 8 },
      },
      {
        pattern: [
          [g, g, g],
          [g, g, g],
        ],
        result: { item: `${g}_pane`, count: 16 },
      },
      {
        pattern: [
          ["glass_pane", "glass_pane", "glass_pane"],
          ["glass_pane", `${c.id}_dye`, "glass_pane"],
          ["glass_pane", "glass_pane", "glass_pane"],
        ],
        result: { item: `${g}_pane`, count: 8 },
      },
    ];
  }),
  // знамя: шесть шерстинок своего цвета на палке (узоры кладёт ткацкий станок — systems/Banner)
  ...DYE_COLORS.map((c): Recipe => ({
    pattern: [
      [`${c.id}_wool`, `${c.id}_wool`, `${c.id}_wool`],
      [`${c.id}_wool`, `${c.id}_wool`, `${c.id}_wool`],
      [null, "stick", null],
    ],
    result: { item: `${c.id}_banner`, count: 1 },
  })),
];
