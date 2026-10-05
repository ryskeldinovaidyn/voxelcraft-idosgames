// Тайлы испытательных камер: туф, медь, спавнер испытаний, хранилище; предметы — ключ, стержень вихря,
// заряд ветра, тяжёлое ядро, булава.
import { PAINTERS, noisy, shade, type Painter } from "../paint";

export const TRIAL_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  TRIAL_TILES.push(name);
};

const TUFF = "#6a6a60";
const COPPER = "#c06a4a";

add("tuff", (px, rng) => {
  noisy(px, TUFF, 0.12, rng);
  for (let k = 0; k < 10; k++)
    px(Math.floor(rng() * 16), Math.floor(rng() * 16), "#8a8a7a");
});
add("polished_tuff", (px, rng) => {
  noisy(px, "#6e6e64", 0.05, rng);
  for (let i = 0; i < 16; i++) {
    px(i, 0, "#56564e");
    px(0, i, "#56564e");
  }
});
add("tuff_bricks", (px, rng) => {
  noisy(px, TUFF, 0.08, rng);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++)
      if (y % 8 === 7 || (x + (Math.floor(y / 8) % 2) * 4) % 8 === 7)
        px(x, y, "#4a4a42");
});
add("cut_copper", (px, rng) => {
  noisy(px, COPPER, 0.06, rng);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++)
      if (x % 8 === 7 || y % 8 === 7) px(x, y, "#8a4a32");
});

/** Решётчатая клетка с тёмным нутром и ободом цвета rim. */
const cage =
  (rim: string, core: string): Painter =>
  (px, rng) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const frame = x < 2 || y < 2 || x > 13 || y > 13;
        const bar = !frame && (x % 4 === 1 || y % 4 === 1);
        if (frame || bar) px(x, y, shade(rim, (rng() - 0.5) * 0.1));
        else px(x, y, core);
      }
  };
add("trial_spawner_top", cage("#3a3a3e", "#e8a040"));
add("trial_spawner_side", cage("#3a3a3e", "#1a1a1e"));
add("vault_top", cage("#4a4a52", "#60a0c0"));
add("vault_side", (px, rng) => {
  cage("#4a4a52", "#2a2a2e")(px, rng);
  for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) px(x, y, "#d0a040"); // замок
});

add("trial_key", (px) => {
  for (let x = 3; x < 11; x++) px(x, 8, "#d0a040");
  for (let y = 5; y < 12; y++)
    for (let x = 10; x < 14; x++)
      if (Math.hypot(x - 11.5, y - 8) < 2.4) px(x, y, "#e8c060");
  px(4, 9, "#d0a040");
  px(6, 9, "#d0a040");
});
add("breeze_rod", (px) => {
  for (let k = 0; k < 11; k++) {
    px(3 + k, 13 - k, "#e0f0f8");
    if (k % 3 === 0) px(4 + k, 13 - k, "#a8d8f0");
  }
});
add("wind_charge", (px) => {
  for (let y = 3; y < 13; y++)
    for (let x = 3; x < 13; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 4.8)
        px(x, y, (Math.floor(d * 2) + x) % 3 ? "#c8e8f8" : "#8ab8d8");
    }
});
add("heavy_core", (px, rng) => {
  for (let y = 3; y < 13; y++)
    for (let x = 3; x < 13; x++)
      px(x, y, shade("#4a4a52", (rng() - 0.5) * 0.15));
  for (let i = 4; i < 12; i += 3) px(i, i, "#8a8a92");
});
add("mace", (px) => {
  for (let k = 0; k < 9; k++) px(2 + k, 13 - k, "#8a6a3a"); // рукоять
  for (let y = 2; y < 8; y++)
    for (let x = 9; x < 15; x++) px(x, y, (x + y) % 3 ? "#7a7a82" : "#a0a0a8"); // навершие
});
