// Тайлы отравленных стрел: обычная стрела с цветным наконечником по эффекту.
import { TIPPED_ARROWS } from "../../systems/TippedArrow";
import { PAINTERS, type Painter } from "../paint";

export const TIPPED_TILES: string[] = Object.keys(TIPPED_ARROWS);

/** Цвет наконечника по эффекту — тот же, что у зелья. */
const TIP: Record<string, string> = {
  poison: "#4a8a20",
  slowness: "#5a6a8a",
};

const arrow =
  (tip: string): Painter =>
  (px) => {
    for (let i = 3; i < 13; i++) px(i, 15 - i, "#8a6a3a"); // древко по диагонали
    for (const [x, y] of [
      [2, 13],
      [3, 12],
      [2, 12],
      [3, 14],
    ] as const)
      px(x, y, "#e8e8e8"); // оперение
    for (const [x, y] of [
      [12, 3],
      [13, 2],
      [12, 2],
      [13, 3],
      [11, 3],
      [13, 4],
    ] as const)
      px(x, y, tip); // наконечник в зелье
  };

for (const [name, t] of Object.entries(TIPPED_ARROWS))
  PAINTERS[name] = arrow(TIP[t.effect] ?? "#c0c0c0");
