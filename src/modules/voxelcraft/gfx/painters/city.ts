// Тайлы внешних островов Предела (registry/blocks/city.ts, registry/items/city.ts).
import { PAINTERS, TILE, noisy, shade, type Painter } from "../paint";

export const CITY_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  CITY_TILES.push(name);
};

const LILAC = "#a878a8";

add("lilac_block", (px, rng) => {
  noisy(px, LILAC, 0.08, rng);
  // плитка 2×2 со светлыми швами
  for (let i = 0; i < TILE; i++) {
    px(i, 0, "#c8a0c8");
    px(0, i, "#c8a0c8");
    px(i, 8, "#8a5a8a");
    px(8, i, "#8a5a8a");
  }
});
add("lilac_pillar_side", (px, rng) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++)
      px(
        x,
        y,
        shade(LILAC, (x % 4 === 0 ? -0.15 : 0.05) + (rng() - 0.5) * 0.06),
      );
});
add("lilac_pillar_top", (px, rng) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      px(
        x,
        y,
        shade(
          LILAC,
          (Math.floor(d) % 3 === 0 ? -0.15 : 0.06) + (rng() - 0.5) * 0.06,
        ),
      );
    }
});
add("beyond_bricks", (px, rng) => {
  noisy(px, "#dcdca0", 0.06, rng);
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++)
      if (y % 8 === 7 || (x + (y < 8 ? 0 : 8)) % 16 === 15) px(x, y, "#a8a470");
});
add("beyond_rod", (px) => {
  for (let y = 0; y < TILE; y++) {
    px(7, y, "#fff8ff");
    px(8, y, "#e8d8f0");
  }
  for (let x = 5; x < 11; x++) px(x, 15, "#b8a0c0"); // основание
});
add("echo_plant", (px, rng) => {
  noisy(px, "#6a4a7a", 0.14, rng);
  for (let i = 0; i < 6; i++)
    px(Math.floor(rng() * TILE), Math.floor(rng() * TILE), "#9a78a8");
});
add("echo_flower", (px, rng) => {
  noisy(px, "#b090c8", 0.12, rng);
  for (let i = 0; i < TILE; i += 5)
    for (let y = 0; y < TILE; y++) px(i, y, "#8a68a0");
});
add("echo_flower_top", (px, rng) => {
  noisy(px, "#c8a8e0", 0.1, rng);
  for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) px(x, y, "#e8d8f8");
});
add("shell_chest_side", (px, rng) => {
  noisy(px, "#8a5a9a", 0.1, rng);
  for (let x = 0; x < TILE; x++) px(x, 7, "#5a3a6a"); // шов крышки
});
add("shell_chest_top", (px, rng) => {
  noisy(px, "#9a6aaa", 0.1, rng);
  for (let i = 0; i < TILE; i++) {
    px(i, 0, "#5a3a6a");
    px(0, i, "#5a3a6a");
    px(i, 15, "#5a3a6a");
    px(15, i, "#5a3a6a");
  }
});
add("dragon_head_side", (px, rng) => noisy(px, "#1a1420", 0.2, rng));
add("dragon_head_front", (px, rng) => {
  noisy(px, "#1a1420", 0.2, rng);
  for (const x0 of [3, 10])
    for (let y = 4; y < 6; y++)
      for (let x = x0; x < x0 + 3; x++) px(x, y, "#c040ff");
  for (let x = 3; x < 13; x++) px(x, 11, "#0a060e");
});

// предметы
add("echo_fruit", (px, rng) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++)
      if (Math.hypot(x - 7.5, y - 8.5) < 5.5)
        px(x, y, shade("#9a70b0", (rng() - 0.5) * 0.2));
  px(8, 2, "#5a3a6a");
  px(8, 3, "#5a3a6a");
});
add("popped_echo_fruit", (px, rng) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++)
      if (Math.hypot(x - 7.5, y - 8.5) < 5.5)
        px(x, y, shade("#c8a0c8", (rng() - 0.5) * 0.25));
});
add("shell_plate", (px, rng) => {
  for (let y = 3; y < 13; y++)
    for (let x = 2; x < 14; x++)
      if (Math.abs(x - 7.5) + (y - 3) * 0.4 < 7)
        px(x, y, shade("#8a5a9a", (rng() - 0.5) * 0.14));
});
add("wings", (px) => {
  for (let y = 1; y < 15; y++)
    for (let x = 1; x < 15; x++) {
      const w = Math.abs(x - 7.5);
      if (w > 1 && w < 7 - (y > 10 ? (y - 10) * 1.2 : 0))
        px(x, y, (x + y) % 3 ? "#8a8aa8" : "#6a6a88");
    }
});
add("rocket", (px) => {
  for (let y = 4; y < 13; y++)
    for (let x = 6; x < 10; x++) px(x, y, y < 7 ? "#d04040" : "#e8e0d0");
  for (let y = 13; y < 16; y++) px(8, y, "#5a4a3a"); // фитиль
  px(7, 3, "#d04040");
  px(8, 3, "#d04040");
});
