// Тайлы рабочих блоков жителей: точило с круглым камнем, ткацкий станок с нитями, кафедра с книгой,
// стол фехтовальщика с насечками.
import { PAINTERS, noisy, shade, type Painter } from "../paint";

export const JOB_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  JOB_TILES.push(name);
};

const planks =
  (c: string): Painter =>
  (px, rng) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++)
        px(x, y, y % 4 === 3 ? shade(c, -0.22) : shade(c, (rng() - 0.5) * 0.1));
  };

// точило: деревянная рама, между стойками круглый точильный камень
add("grindstone_side", (px, rng) => {
  noisy(px, "#7a5a3a", 0.08, rng);
  for (let y = 3; y < 13; y++)
    for (let x = 3; x < 13; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 4.5) px(x, y, d > 3.5 ? "#9a9a9a" : "#b8b8b8");
    }
});
add("grindstone_top", (px, rng) => {
  noisy(px, "#9a9a9a", 0.1, rng);
  for (let x = 0; x < 16; x++) {
    px(x, 6, "#7a5a3a");
    px(x, 9, "#7a5a3a");
  }
});

// ткацкий станок: доски с натянутыми нитями
add("loom_side", planks("#a08a5a"));
add("loom_top", (px, rng) => {
  noisy(px, "#b8a070", 0.08, rng);
  for (let x = 2; x < 14; x += 3)
    for (let y = 2; y < 14; y++) px(x, y, "#e8e4d8");
});

// кафедра: наклонная подставка с раскрытой книгой
add("lectern_side", planks("#9a7a48"));
add("lectern_top", (px, rng) => {
  noisy(px, "#7a5a32", 0.08, rng);
  for (let y = 3; y < 13; y++)
    for (let x = 2; x < 14; x++)
      px(x, y, x === 7 || x === 8 ? "#8a6a3a" : "#e8e4d0");
});

// стол фехтовальщика: светлая столешница с насечками под древки
add("fletching_table_side", planks("#c8bc98"));
add("fletching_table_top", (px, rng) => {
  noisy(px, "#d8ccA8".toLowerCase(), 0.06, rng);
  for (let x = 3; x < 13; x += 3)
    for (let y = 3; y < 13; y++) px(x, y, "#7a6a4a");
});
