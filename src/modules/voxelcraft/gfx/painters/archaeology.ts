// Тайлы археологии: подозрительный песок и гравий, расписной горшок; предметы — кисть и черепки.
import { SHERDS } from "../../registry/items/archaeology";
import { PAINTERS, noisy, shade, type Painter } from "../paint";

export const ARCHAEOLOGY_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  ARCHAEOLOGY_TILES.push(name);
};

/** Песок или гравий с тёмными вкраплениями «чего-то внутри». */
const suspicious =
  (base: string, speck: string): Painter =>
  (px, rng) => {
    noisy(px, base, 0.12, rng);
    for (let k = 0; k < 6; k++) {
      const x = 2 + Math.floor(rng() * 12),
        y = 2 + Math.floor(rng() * 12);
      px(x, y, speck);
      px(x + 1, y, shade(speck, 0.15));
    }
  };
add("suspicious_sand", suspicious("#d8c890", "#8a6a3a"));
add("suspicious_gravel", suspicious("#8a8680", "#4a3a2a"));

const CLAY = "#9a5a3a";
add("decorated_pot_side", (px, rng) => {
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const w = y < 3 ? 4 : y < 13 ? 7 : 6;
      if (Math.abs(x - 7.5) < w) px(x, y, shade(CLAY, (rng() - 0.5) * 0.1));
    }
  for (let x = 3; x < 13; x++) px(x, 7, "#5a3020"); // узор
  for (let x = 4; x < 12; x += 2) px(x, 9, "#5a3020");
});
add("decorated_pot_top", (px, rng) => {
  noisy(px, CLAY, 0.08, rng);
  for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) px(x, y, "#3a2014"); // горлышко
});

add("brush", (px) => {
  for (let k = 0; k < 8; k++) px(3 + k, 12 - k, "#8a6a3a"); // ручка
  for (let y = 2; y < 6; y++)
    for (let x = 11; x < 15; x++) px(x, y, (x + y) % 2 ? "#e8e0c8" : "#c8a060"); // щетина
  px(11, 5, "#c87a3a");
});

/** Черепок: неровный обломок терракоты, узор — несколько тёмных мазков по номеру узора. */
const sherd =
  (n: number): Painter =>
  (px, rng) => {
    for (let y = 3; y < 14; y++)
      for (let x = 2; x < 14; x++)
        if (Math.hypot(x - 8, y - 8.5) < 5.2 + rng() * 0.8)
          px(x, y, shade(CLAY, (rng() - 0.5) * 0.12));
    const m = (x: number, y: number) => px(x, y, "#3a2014");
    for (let k = 0; k < 4; k++)
      m(5 + ((n * 3 + k * 2) % 6), 6 + ((n + k * 3) % 5));
    m(8, 8);
  };
Object.keys(SHERDS).forEach((id, i) => add(`${id}_sherd`, sherd(i)));
