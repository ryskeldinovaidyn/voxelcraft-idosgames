// Тайлы океана (registry/blocks/ocean.ts, registry/items/ocean.ts).
import { PAINTERS, TILE, noisy, shade, type Painter } from "../paint";

export const OCEAN_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  OCEAN_TILES.push(name);
};

add("seagrass", (px, rng) => {
  // тонкие ленты снизу вверх, прозрачный фон
  for (let k = 0; k < 5; k++) {
    let x = 2 + Math.floor(rng() * 12);
    for (let y = 15; y > 2 + Math.floor(rng() * 5); y--) {
      px(x, y, shade("#2e8a3e", (rng() - 0.5) * 0.25));
      if (rng() < 0.25)
        x = Math.max(0, Math.min(15, x + (rng() < 0.5 ? -1 : 1)));
    }
  }
});
add("sea_stone", (px, rng) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const w =
        Math.sin((x + y) * 0.7) * 0.5 + Math.sin(x * 0.4 - y * 0.9) * 0.5;
      px(x, y, shade(w > 0.3 ? "#7ab8a8" : "#5a9888", (rng() - 0.5) * 0.1));
    }
});
add("sea_bricks", (px, rng) => {
  noisy(px, "#7ab8a8", 0.07, rng);
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++)
      if (y % 4 === 3 || (x + (Math.floor(y / 4) % 2) * 4) % 8 === 7)
        px(x, y, "#4a8878");
});
add("dark_sea_stone", (px, rng) => {
  noisy(px, "#2a5048", 0.1, rng);
  for (let i = 0; i < TILE; i++) {
    px(i, 0, "#1a3a34");
    px(0, i, "#1a3a34");
    px(i, 8, "#3a6a60");
  }
});
add("sea_lantern", (px, rng) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const edge = x === 0 || y === 0 || x === 15 || y === 15;
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      px(
        x,
        y,
        edge
          ? "#9ac8b8"
          : d < 3
            ? "#ffffff"
            : shade("#d8f0e8", (rng() - 0.5) * 0.08),
      );
    }
});
const sponge =
  (base: string): Painter =>
  (px, rng) => {
    noisy(px, base, 0.08, rng);
    for (let i = 0; i < 18; i++)
      px(
        Math.floor(rng() * TILE),
        Math.floor(rng() * TILE),
        shade(base, -0.35),
      );
  };
add("sponge", sponge("#d8c850"));
add("wet_sponge", sponge("#a89a3a"));
add("turtle_egg", (px, rng) => {
  noisy(px, "#e8e0c0", 0.06, rng);
  for (let i = 0; i < 10; i++)
    px(Math.floor(rng() * TILE), Math.floor(rng() * TILE), "#6a9a5a");
});

// предметы
add("sea_shard", (px) => {
  for (let y = 2; y < 14; y++) {
    const w = Math.round(4 - Math.abs(y - 8) * 0.6);
    for (let x = 8 - w; x <= 8 + w; x++)
      px(x, y, (x + y) % 3 ? "#7ab8a8" : "#5a9888");
  }
});
add("sea_crystals", (px) => {
  for (const [cx, cy] of [
    [5, 6],
    [10, 5],
    [8, 10],
  ] as const)
    for (let y = -2; y <= 2; y++)
      for (let x = -2; x <= 2; x++)
        if (Math.abs(x) + Math.abs(y) <= 2)
          px(cx + x, cy + y, x + y < 0 ? "#ffffff" : "#bff0e0");
});
add("scute", (px) => {
  for (let y = 3; y < 13; y++)
    for (let x = 3; x < 13; x++)
      if (Math.hypot(x - 7.5, (y - 8) * 1.2) < 5.5)
        px(x, y, (x + y) % 4 ? "#5a9a4a" : "#3a7a3a");
});
add("turtle_helmet", (px) => {
  for (let y = 3; y < 12; y++)
    for (let x = 1; x < 15; x++)
      if (y < 9 || x < 4 || x > 11)
        px(x, y, (x * 3 + y) % 5 ? "#4a8a3a" : "#2a6a2a");
});
