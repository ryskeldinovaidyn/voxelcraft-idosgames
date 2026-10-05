// Тайлы меди: стадии окисления медного блока и резной меди, медная лампа, решётка; шаблоны отделки брони.
import { STAGE_COLORS } from "../../registry/blocks/copper";
import { TRIM_PATTERNS, templateOf } from "../../registry/items/trims";
import { PAINTERS, noisy, shade, type Painter } from "../paint";

export const COPPER_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  COPPER_TILES.push(name);
};

for (const [s, [c]] of Object.entries(STAGE_COLORS)) {
  add(`${s}_copper`, (px, rng) => {
    noisy(px, c, 0.1, rng);
    for (let k = 0; k < 10; k++)
      px(Math.floor(rng() * 16), Math.floor(rng() * 16), shade(c, 0.2));
  });
  add(`${s}_cut_copper`, (px, rng) => {
    noisy(px, c, 0.08, rng);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++)
        if (x % 8 === 7 || y % 8 === 7) px(x, y, shade(c, -0.3));
  });
}

/** Лампа: медная рамка, в середине стекло цвета glass. */
const bulb =
  (glass: string): Painter =>
  (px, rng) => {
    noisy(px, "#c06a4a", 0.08, rng);
    for (let y = 3; y < 13; y++)
      for (let x = 3; x < 13; x++)
        px(
          x,
          y,
          x === 3 || x === 12 || y === 3 || y === 12 ? "#8a4a32" : glass,
        );
  };
add("copper_bulb", bulb("#5a3a2a"));
add("copper_bulb_lit", bulb("#f8d880"));

add("copper_grate", (px, rng) => {
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const bar = x % 4 === 0 || y % 4 === 0;
      if (bar) px(x, y, shade("#c06a4a", (rng() - 0.5) * 0.15));
    }
});

// шаблоны: табличка из «незерита» с цветным узором (у каждого узора свой штрих)
Object.keys(TRIM_PATTERNS).forEach((p, i) =>
  add(templateOf(p), (px, rng) => {
    for (let y = 2; y < 14; y++)
      for (let x = 3; x < 13; x++)
        px(x, y, shade("#3a3a42", (rng() - 0.5) * 0.12));
    const col = [
      "#5ab8d8",
      "#d8b85a",
      "#a85ad8",
      "#d85a5a",
      "#5ad88a",
      "#e8e0c8",
      "#8ad8f0",
    ][i % 7]!;
    for (let k = 0; k < 6; k++)
      px(5 + ((i + k * 2) % 6), 4 + ((i * 3 + k) % 8), col);
    px(7, 7, col);
    px(8, 8, col);
  }),
);
