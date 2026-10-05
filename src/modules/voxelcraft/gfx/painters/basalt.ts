// Тайлы дельт и долины душ: базальт, чернокамень, костяной блок, огонь душ.
import { PAINTERS, noisy, shade, type Painter } from "../paint";

export const BASALT_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  BASALT_TILES.push(name);
};

add("basalt_side", (px, rng) => {
  for (let x = 0; x < 16; x++) {
    const c = x % 5 === 0 ? "#34343a" : "#4a4a52";
    for (let y = 0; y < 16; y++) px(x, y, shade(c, (rng() - 0.5) * 0.12));
  }
});
add("basalt_top", (px, rng) => {
  noisy(px, "#56565e", 0.1, rng);
  for (let i = 0; i < 16; i++) {
    px(i, 0, "#3a3a40");
    px(i, 15, "#3a3a40");
    px(0, i, "#3a3a40");
    px(15, i, "#3a3a40");
  }
});
add("blackstone", (px, rng) => {
  noisy(px, "#2a2428", 0.14, rng);
  for (let i = 0; i < 8; i++) px((rng() * 16) | 0, (rng() * 16) | 0, "#4a3a44");
});
add("bone_block_side", (px, rng) => {
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++)
      px(
        x,
        y,
        shade(x % 5 === 2 ? "#c8c4b0" : "#e0dcc8", (rng() - 0.5) * 0.06),
      );
});
add("bone_block_top", (px, rng) => {
  noisy(px, "#e0dcc8", 0.06, rng);
  for (const [cx, cy] of [
    [4, 4],
    [11, 4],
    [4, 11],
    [11, 11],
  ] as const)
    for (let k = 0; k < 4; k++) px(cx + (k & 1), cy + (k >> 1), "#b8b4a0");
});
/** Огонь душ: языки пламени, как у обычного огня, но бирюзово-синие. */
add("soul_fire", (px, rng) => {
  for (let x = 0; x < 16; x++) {
    const h = 6 + ((rng() * 9) | 0);
    for (let y = 16 - h; y < 16; y++) {
      const t = (y - (16 - h)) / h;
      px(x, y, t < 0.3 ? "#b8f4ff" : t < 0.7 ? "#40c8e0" : "#1a6a9a");
    }
  }
});
