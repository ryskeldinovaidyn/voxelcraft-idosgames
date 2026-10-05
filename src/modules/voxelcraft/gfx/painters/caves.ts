// Тайлы пещер: аметист, почки и друзы, кальцит, базальт, тонированное стекло, мох, азалии, лозы,
// спороцвет; предметы — осколок, ягоды, подзорная труба.
import { PAINTERS, noisy, shade, type Painter, type PxFn } from "../paint";

export const CAVE_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  CAVE_TILES.push(name);
};

const AMETHYST = "#8a5ac8";

add("amethyst_block", (px, rng) => {
  noisy(px, AMETHYST, 0.14, rng);
  for (let k = 0; k < 6; k++) {
    const x = Math.floor(rng() * 14),
      y = Math.floor(rng() * 14);
    px(x, y, "#c8a8f0");
    px(x + 1, y + 1, "#b08ae0");
  }
});

add("budding_amethyst", (px, rng) => {
  noisy(px, "#7a4ab8", 0.14, rng);
  for (let y = 1; y < 16; y += 5)
    for (let x = 1; x < 16; x += 5) {
      px(x, y, "#2a1a4a");
      px(x + 1, y, "#e0c8ff");
    }
});

/** Кристалл-столбик высотой h с центром x. */
const spike = (px: PxFn, x: number, h: number, w: number): void => {
  for (let y = 15; y > 15 - h; y--)
    for (let dx = 0; dx < w; dx++)
      px(x + dx, y, dx === 0 ? "#e0c8ff" : y < 17 - h ? "#c8a8f0" : "#9a6ad8");
};
add("small_amethyst_bud", (px) => {
  spike(px, 7, 3, 2);
});
add("medium_amethyst_bud", (px) => {
  spike(px, 7, 6, 2);
  spike(px, 4, 3, 1);
  spike(px, 10, 3, 1);
});
add("large_amethyst_bud", (px) => {
  spike(px, 6, 9, 3);
  spike(px, 3, 5, 2);
  spike(px, 11, 6, 2);
});
add("amethyst_cluster", (px) => {
  spike(px, 6, 13, 3);
  spike(px, 2, 8, 2);
  spike(px, 11, 10, 2);
  spike(px, 9, 5, 1);
  spike(px, 4, 4, 1);
});

add("calcite", (px, rng) => {
  noisy(px, "#e0e0dc", 0.08, rng);
  for (let k = 0; k < 8; k++)
    px(Math.floor(rng() * 16), Math.floor(rng() * 16), "#c8c8c4");
});
add("smooth_basalt", (px, rng) => noisy(px, "#3a3a40", 0.1, rng));

add("tinted_glass", (px, rng) => {
  for (let i = 0; i < 16; i++) {
    px(i, 0, "#2a1a3a");
    px(i, 15, "#2a1a3a");
    px(0, i, "#2a1a3a");
    px(15, i, "#2a1a3a");
  }
  for (let k = 2; k < 6; k++)
    px(k + 2, k, shade("#5a3a6a", (rng() - 0.5) * 0.2));
});

add("moss_block", (px, rng) => {
  noisy(px, "#5a7a2a", 0.16, rng);
  for (let k = 0; k < 10; k++)
    px(Math.floor(rng() * 16), Math.floor(rng() * 16), "#7a9a3a");
});

/** Кустик азалии, цветы — цвета bloom. */
const azalea =
  (bloom: string | null): Painter =>
  (px, rng) => {
    for (let y = 2; y < 16; y++)
      for (let x = 1; x < 15; x++) {
        if (Math.hypot(x - 7.5, (y - 8) * 1.2) > 7 || rng() < 0.15) continue;
        px(
          x,
          y,
          bloom && rng() < 0.12 ? bloom : shade("#4a7a2a", (rng() - 0.5) * 0.3),
        );
      }
  };
add("azalea", azalea(null));
add("flowering_azalea", azalea("#d87ad0"));

/** Лоза сверху вниз; ягоды — оранжевые светящиеся. */
const vine =
  (berries: boolean): Painter =>
  (px, rng) => {
    for (let y = 0; y < 16; y++) {
      const x = 7 + Math.round(Math.sin(y * 0.8));
      px(x, y, "#4a7a2a");
      if (y % 3 === 1) px(x + (y % 2 ? 1 : -1), y, "#6a9a3a");
    }
    if (berries)
      for (const [x, y] of [
        [5, 4],
        [9, 8],
        [6, 12],
      ] as const) {
        px(x, y, "#f0a020");
        px(x + 1, y, "#f8c040");
        px(x, y + 1, "#e08010");
      }
    else if (rng() < 0) px(0, 0, "#000"); // (ягод нет)
  };
add("cave_vines", vine(false));
add("cave_vines_lit", vine(true));

add("spore_blossom", (px) => {
  for (let y = 0; y < 3; y++) px(7, y, "#4a7a2a");
  for (let y = 3; y < 9; y++)
    for (let x = 3; x < 13; x++)
      if (Math.hypot(x - 7.5, y - 5) < 4.5)
        px(x, y, y > 6 ? "#e8a0c0" : "#d87aa0");
  for (let x = 4; x < 12; x += 2) px(x, 9 + (x % 3), "#f0c0d8"); // споры
});

add("amethyst_shard", (px) => {
  for (let k = 0; k < 10; k++) {
    px(4 + k, 13 - k, "#c8a8f0");
    px(5 + k, 13 - k, AMETHYST);
    if (k > 2 && k < 8) px(4 + k, 12 - k, "#e0c8ff");
  }
});

add("glow_berries", (px) => {
  for (const [x, y] of [
    [5, 8],
    [9, 6],
    [8, 10],
  ] as const)
    for (let dy = 0; dy < 3; dy++)
      for (let dx = 0; dx < 3; dx++)
        px(x + dx, y + dy, dx + dy === 0 ? "#fff0a0" : "#f0a020");
  for (let y = 2; y < 7; y++) px(8, y, "#4a7a2a");
});

add("spyglass", (px) => {
  for (let k = 0; k < 11; k++)
    for (let w = 0; w < 3; w++)
      px(3 + k + w, 13 - k, k < 4 ? "#c87a3a" : k < 5 ? "#8a5ac8" : "#e0a050");
});
