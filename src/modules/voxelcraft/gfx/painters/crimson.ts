// Тайлы биомов Пекла: нилий, стебли, доски, наросты, светогриб, грибы и корни, почва душ.
import { PAINTERS, noisy, shade, type Painter } from "../paint";

export const CRIMSON_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  CRIMSON_TILES.push(name);
};

const STONE = "#6e2a2a";

for (const [kind, top, fleck] of [
  ["crimson", "#8a1a1a", "#b83030"],
  ["warped", "#1a7a6a", "#30b09a"],
] as const) {
  add(`${kind}_nylium_top`, (px, rng) => {
    noisy(px, top, 0.12, rng);
    for (let i = 0; i < 18; i++) px((rng() * 16) | 0, (rng() * 16) | 0, fleck);
  });
  add(`${kind}_nylium_side`, (px, rng) => {
    noisy(px, STONE, 0.12, rng);
    for (let x = 0; x < 16; x++) {
      const d = 2 + ((rng() * 3) | 0);
      for (let y = 0; y < d; y++) px(x, y, shade(top, (rng() - 0.5) * 0.15));
    }
  });
}

/** Стебель: сбоку — продольные волокна с прожилками, сверху — кольца. */
const stemSide =
  (base: string, vein: string): Painter =>
  (px, rng) => {
    for (let x = 0; x < 16; x++) {
      const c = x % 4 === 0 ? shade(base, -0.15) : base;
      for (let y = 0; y < 16; y++)
        px(x, y, shade(rng() < 0.08 ? vein : c, (rng() - 0.5) * 0.08));
    }
  };
const stemTop =
  (base: string, core: string): Painter =>
  (px) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const r = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        px(x, y, r > 6.5 ? base : Math.floor(r) % 2 ? shade(core, -0.1) : core);
      }
  };
add("crimson_stem_side", stemSide("#7a2a3a", "#d04040"));
add("crimson_stem_top", stemTop("#7a2a3a", "#a04a5a"));
add("warped_stem_side", stemSide("#3a5a5a", "#2ab0a0"));
add("warped_stem_top", stemTop("#3a5a5a", "#4a8a86"));

const planks =
  (base: string): Painter =>
  (px, rng) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const seam = y % 4 === 3 || (x === ((y >> 2) * 5) % 16 && y % 4 !== 3);
        px(x, y, seam ? shade(base, -0.25) : shade(base, (rng() - 0.5) * 0.08));
      }
  };
add("crimson_planks", planks("#6a3448"));
add("warped_planks", planks("#2a6a64"));

add("inferno_wart_block", (px, rng) => noisy(px, "#8a1414", 0.14, rng));
add("warped_wart_block", (px, rng) => noisy(px, "#167a78", 0.14, rng));
add("shroomlight", (px, rng) => {
  noisy(px, "#f0a040", 0.08, rng);
  for (let i = 0; i < 10; i++)
    px((rng() * 16) | 0, (rng() * 16) | 0, "#fff0b0");
});

/** Гриб Пекла: ножка и шляпка; корни — пучок тонких стеблей. */
const fungus =
  (cap: string, stemColor: string): Painter =>
  (px) => {
    for (let y = 9; y < 16; y++) px(7, y, stemColor);
    for (let y = 5; y < 9; y++)
      for (let x = 4; x < 12; x++)
        if (!(y === 5 && (x < 6 || x > 9))) px(x, y, cap);
    px(5, 9, cap);
    px(10, 9, cap);
  };
const roots =
  (color: string): Painter =>
  (px, rng) => {
    for (const x of [3, 5, 7, 9, 11, 13]) {
      const h = 6 + ((rng() * 8) | 0);
      for (let y = 16 - h; y < 16; y++)
        px(x + (y % 3 === 0 ? 1 : 0), y, shade(color, (rng() - 0.5) * 0.15));
    }
  };
add("crimson_fungus", fungus("#b82020", "#e8c890"));
add("warped_fungus", fungus("#20a090", "#e8a040"));
add("crimson_roots", roots("#a0203a"));
add("warped_roots", roots("#20a08a"));
add("soul_soil", (px, rng) => {
  noisy(px, "#4a3a2e", 0.1, rng);
  for (let i = 0; i < 6; i++) px((rng() * 16) | 0, (rng() * 16) | 0, "#2a1e16");
});
