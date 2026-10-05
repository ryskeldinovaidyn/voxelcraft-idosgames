// Пепельный череп, маяк и звезда Пекла (registry/blocks/boss.ts, registry/items/boss.ts).
import { PAINTERS, TILE, noisy, shade, type Painter } from "../paint";

export const BOSS_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  BOSS_TILES.push(name);
};

const BONE = "#2e2e2e";

add("ash_skull_side", (px, rng) => noisy(px, BONE, 0.12, rng));
add("ash_skull_top", (px, rng) => noisy(px, shade(BONE, 0.08), 0.1, rng));
add("ash_skull_front", (px, rng) => {
  noisy(px, BONE, 0.12, rng);
  // глазницы и оскал
  for (const x0 of [3, 9])
    for (let y = 5; y < 8; y++)
      for (let x = x0; x < x0 + 4; x++) px(x, y, "#0c0c0c");
  for (let x = 4; x < 12; x++) px(x, 11, x % 2 ? "#0c0c0c" : "#5a5a5a");
  px(7, 9, "#141414");
  px(8, 9, "#141414");
});

add("beacon", (px, rng) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const edge = x === 0 || y === 0 || x === TILE - 1 || y === TILE - 1;
      px(x, y, edge ? "#d8f8f8" : shade("#8ae8e0", (rng() - 0.5) * 0.12));
    }
  // обсидиановое основание и светящееся ядро
  for (let y = 11; y < 15; y++)
    for (let x = 1; x < 15; x++)
      px(x, y, shade("#1c1030", (rng() - 0.5) * 0.2));
  for (let y = 4; y < 11; y++)
    for (let x = 4; x < 12; x++)
      px(x, y, shade("#f0fff8", (rng() - 0.5) * 0.08));
});

add("inferno_star", (px) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const dx = Math.abs(x - 7.5),
        dy = Math.abs(y - 7.5);
      // четырёхлучевая звезда: ромб плюс лучи по осям
      if (dx + dy < 4.5) px(x, y, dx + dy < 2 ? "#ffffff" : "#f0f0c0");
      else if ((dx < 1 && dy < 7) || (dy < 1 && dx < 7)) px(x, y, "#e8e8b0");
    }
});
