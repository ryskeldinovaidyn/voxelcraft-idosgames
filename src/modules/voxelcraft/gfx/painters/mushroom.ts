// Тайлы грибных полей: мицелий, грибы, шляпки и ножка огромных грибов; миска и грибной суп.
import { PAINTERS, noisy, shade, type Painter } from "../paint";

export const MUSHROOM_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  MUSHROOM_TILES.push(name);
};

add("mycelium_top", (px, rng) => {
  noisy(px, "#6f6265", 0.12, rng);
  for (let i = 0; i < 14; i++)
    px((rng() * 16) | 0, (rng() * 16) | 0, rng() < 0.5 ? "#9a8a9e" : "#54484e");
});
add("mycelium_side", (px, rng) => {
  noisy(px, "#79553a", 0.1, rng);
  for (let x = 0; x < 16; x++) {
    const d = 3 + ((rng() * 2) | 0);
    for (let y = 0; y < d; y++)
      px(x, y, shade("#6f6265", (rng() - 0.5) * 0.12));
  }
});

/** Маленький гриб: ножка и шляпка цвета capColor (у красного — белые пятна). */
const small =
  (capColor: string, dots: boolean): Painter =>
  (px) => {
    for (let y = 9; y < 15; y++)
      for (let x = 7; x < 9; x++) px(x, y, "#e8dcc8");
    for (let y = 5; y < 9; y++)
      for (let x = 4; x < 12; x++)
        if (!(y === 5 && (x < 5 || x > 10))) px(x, y, capColor);
    if (dots)
      for (const [x, y] of [
        [5, 7],
        [8, 6],
        [10, 7],
      ] as const)
        px(x, y, "#f4f0e8");
  };
add("brown_mushroom", small("#9a7a5a", false));
add("red_mushroom", small("#c0302a", true));

add("brown_mushroom_block", (px, rng) => noisy(px, "#94704e", 0.1, rng));
add("red_mushroom_block", (px, rng) => {
  noisy(px, "#b82a24", 0.08, rng);
  for (let i = 0; i < 5; i++) {
    const x = 1 + ((rng() * 13) | 0),
      y = 1 + ((rng() * 13) | 0);
    for (let k = 0; k < 4; k++) px(x + (k & 1), y + (k >> 1), "#f0ece4");
  }
});
add("mushroom_stem", (px, rng) => noisy(px, "#e0dcd0", 0.06, rng));

/** Миска; soup — налит грибной суп. */
const bowl =
  (soup: boolean): Painter =>
  (px) => {
    for (let x = 3; x < 13; x++) px(x, 8, soup ? "#b08050" : "#6a4424");
    for (let y = 9; y < 13; y++)
      for (let x = 3 + (y - 9); x < 13 - (y - 9); x++)
        px(x, y, y === 9 ? "#8a5a30" : "#7a4e2a");
    if (soup)
      for (const [x, y] of [
        [5, 8],
        [9, 8],
        [7, 8],
      ] as const)
        px(x, y, "#c89a6a");
  };
add("bowl", bowl(false));
add("mushroom_stew", bowl(true));
