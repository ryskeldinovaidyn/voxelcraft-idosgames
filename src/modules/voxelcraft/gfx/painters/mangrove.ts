// Тайлы мангрового болота: грязь и что из неё, мангровые корни, лягушачья икра, лягушачий свет;
// предмет — магмовый крем.
import { FROGLIGHTS } from "../../registry/blocks/mangrove";
import { PAINTERS, noisy, shade, type Painter } from "../paint";

export const MANGROVE_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  MANGROVE_TILES.push(name);
};

add("mud", (px, rng) => {
  noisy(px, "#3a3030", 0.14, rng);
  for (let k = 0; k < 8; k++)
    px(Math.floor(rng() * 16), Math.floor(rng() * 16), "#4a4040");
});
add("packed_mud", (px, rng) => noisy(px, "#8a6a50", 0.1, rng));
add("mud_bricks", (px, rng) => {
  noisy(px, "#8a6a50", 0.08, rng);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++)
      if (y % 4 === 3 || (x + (Math.floor(y / 4) % 2) * 4) % 8 === 7)
        px(x, y, "#6a5040");
});
add("mangrove_roots", (px, rng) => {
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const bar = (x + y) % 6 < 2 || (x - y + 16) % 6 < 2;
      if (bar) px(x, y, shade("#4a3a2a", (rng() - 0.5) * 0.2));
    }
});
add("frogspawn", (px, rng) => {
  for (let k = 0; k < 14; k++) {
    const x = 1 + Math.floor(rng() * 13),
      y = 1 + Math.floor(rng() * 13);
    px(x, y, "#b8c0b0");
    px(x + 1, y, "#b8c0b0");
    px(x, y + 1, "#b8c0b0");
    px(x + 1, y + 1, "#101010");
  }
});
for (const f of FROGLIGHTS) {
  add(`${f.id}_froglight_top`, (px, rng) => {
    noisy(px, f.top, 0.06, rng);
    for (let i = 0; i < 16; i++) {
      px(i, 0, f.side);
      px(0, i, f.side);
      px(i, 15, f.side);
      px(15, i, f.side);
    }
  });
  add(`${f.id}_froglight_side`, (px, rng) => {
    noisy(px, f.side, 0.08, rng);
    for (let x = 0; x < 16; x++)
      if (x % 5 === 2)
        for (let y = 0; y < 16; y++) px(x, y, shade(f.side, 0.12));
  });
}
add("magma_cream", (px) => {
  for (let y = 4; y < 13; y++)
    for (let x = 3; x < 13; x++) {
      const d = Math.hypot(x - 8, (y - 8.5) * 1.3);
      if (d < 4.5)
        px(x, y, d < 2 ? "#f8e060" : d < 3.5 ? "#e88a20" : "#a04010");
    }
});
