// Тайл золотого яблока: яблоко из золота с черенком и бликом.
import { PAINTERS } from "../paint";

export const CURE_TILES: string[] = ["golden_apple", "enchanted_golden_apple"];

PAINTERS.golden_apple = (px) => {
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot((x - 7.5) / 5.5, (y - 8.5) / 5);
      if (d > 1) continue;
      px(x, y, d > 0.82 ? "#a8801a" : x < 6 && y < 9 ? "#ffe27a" : "#e8b830");
    }
  px(7, 2, "#5a3a1a"); // черенок
  px(8, 2, "#5a3a1a");
  px(8, 1, "#3a8a3a"); // листок
  px(9, 1, "#3a8a3a");
};

// Зачарованное золотое яблоко: то же яблоко с фиолетовым отблеском зачарования
PAINTERS.enchanted_golden_apple = (px, rng) => {
  PAINTERS.golden_apple!(px, rng);
  for (let y = 3; y < 14; y++)
    for (let x = 3; x < 13; x++)
      if ((x + y) % 5 === 0 && Math.hypot((x - 7.5) / 5.5, (y - 8.5) / 5) < 1)
        px(x, y, "#c060ff");
};
