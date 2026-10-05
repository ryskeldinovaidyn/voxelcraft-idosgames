// Тайлы трёх блоков: сундук Предела (тёмный камень с зелёным глазом), строительные леса (бамбуковая
// рама) и мишень (красно-белые круги).
import { PAINTERS, noisy, shade, type Painter } from "../paint";

export const EXTRA_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  EXTRA_TILES.push(name);
};

add("ender_chest_side", (px, rng) => {
  noisy(px, "#1a3a3a", 0.1, rng);
  for (let y = 5; y < 12; y++)
    for (let x = 3; x < 13; x++)
      px(x, y, shade("#16302f", (rng() - 0.5) * 0.15));
  for (let x = 0; x < 16; x++) px(x, 4, "#0e2020");
});
add("ender_chest_top", (px, rng) => {
  noisy(px, "#1a3a3a", 0.1, rng);
  for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) px(x, y, "#2a5a58");
});
add("ender_chest_front", (px, rng) => {
  noisy(px, "#1a3a3a", 0.1, rng);
  for (let x = 0; x < 16; x++) px(x, 4, "#0e2020");
  // глаз замка: зелёное свечение
  for (let y = 5; y < 10; y++)
    for (let x = 6; x < 10; x++) {
      const d = Math.hypot(x - 7.5, (y - 7) * 1.2);
      if (d < 2.6) px(x, y, d < 1.4 ? "#7ce8b0" : "#2a8a68");
    }
});

add("scaffolding_top", (px, rng) => {
  noisy(px, "#c8a860", 0.08, rng);
  for (let i = 0; i < 16; i++) {
    px(i, 7, shade("#8a6a34", -0.1));
    px(7, i, shade("#8a6a34", -0.1));
  }
});
add("scaffolding_side", (px, rng) => {
  // не закрашенные пиксели остаются прозрачными: между стойками видно насквозь
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++)
      if (x < 3 || x > 12 || y < 2)
        px(x, y, shade("#c8a860", (rng() - 0.5) * 0.12));
});

add("target", (px, rng) => {
  noisy(px, "#e0d8c8", 0.06, rng);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 2.5 || (d > 4.5 && d < 6.5))
        px(x, y, shade("#b02a22", (rng() - 0.5) * 0.12));
    }
});
