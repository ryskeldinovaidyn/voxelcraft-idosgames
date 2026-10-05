// Тайлы изделий: цветное стекло 16 цветов (как простое стекло — рамка и блик, но цветные, с редкими цветными
// прожилками; прозрачные пиксели — вырез), полированный базальт, полированный чернокамень и кирпичи из него.
import { DYE_COLORS } from "../../registry/blocks/colors";
import { PAINTERS, TILE, noisy, shade, type Painter } from "../paint";

export const CRAFTED_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  CRAFTED_TILES.push(name);
};

const stained =
  (c: string): Painter =>
  (px, rng) => {
    for (let i = 0; i < TILE; i++) {
      px(i, 0, shade(c, 0.1));
      px(i, 15, shade(c, -0.1));
      px(0, i, shade(c, 0.1));
      px(15, i, shade(c, -0.1));
    }
    for (let y = 2; y < 14; y++)
      for (let x = 2; x < 14; x++)
        if (rng() < 0.12) px(x, y, shade(c, (rng() - 0.5) * 0.2));
    for (let x = 3; x < 9; x++) px(x, x - 1, shade(c, 0.45)); // блик
  };
for (const c of DYE_COLORS) add(`${c.id}_stained_glass`, stained(c.hex));

add("polished_basalt_side", (px, rng) => {
  for (let x = 0; x < 16; x++) {
    const c = x % 4 === 0 ? "#44444c" : "#5a5a62";
    for (let y = 0; y < 16; y++) px(x, y, shade(c, (rng() - 0.5) * 0.06));
  }
});
add("polished_basalt_top", (px, rng) => {
  noisy(px, "#62626a", 0.06, rng);
  for (let i = 0; i < 16; i++) {
    px(i, 0, "#44444c");
    px(i, 15, "#44444c");
    px(0, i, "#44444c");
    px(15, i, "#44444c");
  }
});
add("polished_blackstone", (px, rng) => {
  noisy(px, "#363036", 0.06, rng);
  for (let i = 0; i < 16; i++) {
    px(i, 0, "#221c22");
    px(0, i, "#221c22");
  }
});
add("polished_blackstone_bricks", (px, rng) => {
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const seam = y % 4 === 3 || (x + (y & 4 ? 4 : 0)) % 8 === 7;
      px(x, y, seam ? "#1a161a" : shade("#302a30", (rng() - 0.5) * 0.1));
    }
});
