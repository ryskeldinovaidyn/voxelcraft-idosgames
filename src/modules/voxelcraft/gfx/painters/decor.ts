// Тайлы мелочей для дома: фонари, цепь, свеча; предмет — мешок.
import { PAINTERS, noisy, shade, type Painter } from "../paint";

export const DECOR_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  DECOR_TILES.push(name);
};

/** Фонарь: тёмная рамка, внутри огонь цвета flame (UV от центра — форма lantern). */
const lantern =
  (flame: string, glow: string): Painter =>
  (px, rng) => {
    noisy(px, "#3a3a42", 0.1, rng);
    for (let y = 4; y < 12; y++)
      for (let x = 5; x < 11; x++) px(x, y, (x + y) % 3 ? flame : glow);
    for (let x = 4; x < 12; x++) {
      px(x, 3, "#2a2a30");
      px(x, 12, "#2a2a30");
    }
  };
add("lantern", lantern("#f8c040", "#fff0a0"));
add("soul_lantern", lantern("#40c8e0", "#b0f0f8"));

add("chain", (px) => {
  for (let y = 0; y < 16; y++) {
    const link = Math.floor(y / 4) % 2;
    for (const x of link ? [7, 8] : [6, 9])
      px(x, y, y % 4 === 0 ? "#5a5a62" : "#3a3a42");
    if (link === 0 && y % 4 === 1)
      for (let x = 6; x <= 9; x++) px(x, y, "#4a4a52");
  }
});

/** Свеча: восковой столбик в строках 10–15 (форма candle берёт UV «от низа»), в центре 7–9 — фитиль или
 *  огонёк: его и видно на верхней грани столбика, и на иконке. */
const candle =
  (lit: boolean): Painter =>
  (px, rng) => {
    for (let y = 10; y < 16; y++)
      for (let x = 6; x < 10; x++)
        px(x, y, shade("#e8dcb8", (rng() - 0.5) * 0.08));
    for (let y = 7; y < 10; y++)
      for (let x = 7; x < 9; x++)
        px(
          x,
          y,
          !lit
            ? "#2a2a2a"
            : y === 7
              ? "#fff0a0"
              : y === 8
                ? "#f8c040"
                : "#f8a020",
        );
    if (lit) px(7, 6, "#fff0a0");
  };
add("candle", candle(false));
add("candle_lit", candle(true));

add("bundle", (px, rng) => {
  for (let y = 4; y < 15; y++)
    for (let x = 2; x < 14; x++)
      if (Math.hypot(x - 7.5, (y - 9.5) * 1.1) < 5.8)
        px(x, y, shade("#9a6a3a", (rng() - 0.5) * 0.15));
  for (let x = 5; x < 11; x++) px(x, 4, "#6a4424"); // горловина
  px(7, 3, "#e8e0c8");
  px(8, 2, "#e8e0c8"); // завязка
});
