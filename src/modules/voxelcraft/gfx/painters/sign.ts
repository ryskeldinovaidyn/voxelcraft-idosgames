// Тайл таблички: светлая доска с тёмной окантовкой (текст рисуется поверх — gfx/SignText).
import { PAINTERS, noisy, shade } from "../paint";

export const SIGN_TILES: string[] = ["sign"];

PAINTERS.sign = (px, rng) => {
  noisy(px, "#b89a62", 0.07, rng);
  for (let i = 0; i < 16; i++) {
    px(i, 0, shade("#b89a62", -0.35));
    px(i, 15, shade("#b89a62", -0.35));
    px(0, i, shade("#b89a62", -0.35));
    px(15, i, shade("#b89a62", -0.35));
  }
};
