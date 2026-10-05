// Тайлы остальных зелий и сброженного паучьего глаза. Бутылка рисуется той же формой, что у
// первых зелий (gfx/painters/brewing.ts) — цвет жидкости у каждого свой.
import { PAINTERS, type Painter } from "../paint";

export const POTION_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  POTION_TILES.push(name);
};

/** Та же бутылка, что у первых зелий: горлышко, пробка и круглое тело с жидкостью. */
const bottle =
  (liquid: string): Painter =>
  (px) => {
    for (let y = 2; y < 5; y++) {
      px(7, y, "#d8e8f0");
      px(8, y, "#d8e8f0");
    }
    px(7, 1, "#8a6a3a");
    px(8, 1, "#8a6a3a");
    for (let y = 5; y < 14; y++)
      for (let x = 4; x < 12; x++) {
        const d = Math.hypot(x - 7.5, y - 9.5);
        if (d > 4.3) continue;
        px(x, y, d > 3.4 ? "#c8dce8" : y > 6 ? liquid : "#eef6fa");
      }
  };

add("potion_fire_resistance", bottle("#e08a20"));
add("potion_poison", bottle("#4a8a20"));
add("potion_weakness", bottle("#4a5a5a"));
add("potion_slowness", bottle("#5a6a8a"));
add("potion_harming", bottle("#5a1a30"));

// сброженный паучий глаз: тёмный глаз с зеленоватым отливом
add("fermented_spider_eye", (px, rng) => {
  for (let y = 4; y < 12; y++)
    for (let x = 4; x < 12; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 3.8)
        px(x, y, d < 1.6 ? "#c8e070" : rng() < 0.3 ? "#3a4a2a" : "#4a3a5a");
    }
});
