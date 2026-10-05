// Тайлы варки: варочная стойка, адский нарост по стадиям, пузырёк и зелья, золотая морковь.
import { PAINTERS, TILE, type Painter } from "../paint";

export const BREWING_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  BREWING_TILES.push(name);
};

add("brewing_stand", (px) => {
  for (let y = 3; y < 13; y++) px(7, y, "#e0c060"); // стержень
  for (let x = 3; x < 13; x++) px(x, 14, "#707070"); // основание
  for (const x of [3, 12]) for (let y = 10; y < 14; y++) px(x, y, "#b0a060");
  for (const [x, y] of [
    [6, 3],
    [8, 3],
    [7, 2],
  ] as const)
    px(x, y, "#f0e090");
});

/** Адский нарост: красные бугорки растут со стадией. */
const wart =
  (k: number): Painter =>
  (px, rng) => {
    const h = Math.round(3 + k * 8);
    for (let col = 2; col < TILE - 1; col += 4) {
      const ch = Math.max(2, h - Math.floor(rng() * 2));
      for (let y = TILE - 1; y >= TILE - ch; y--) {
        px(col, y, y < TILE - ch + 2 ? "#c02a30" : "#8a1a22");
        px(col + 1, y, "#6a1018");
      }
    }
  };
for (let s = 0; s < 4; s++) add(`inferno_wart_${s}`, wart(s / 3));
add("inferno_wart", PAINTERS.inferno_wart_3!);
add("inferno_wart_item", (px) => {
  for (const [x, y] of [
    [6, 6],
    [8, 5],
    [10, 7],
    [7, 9],
    [9, 10],
    [5, 11],
  ] as const) {
    px(x, y, "#c02a30");
    px(x + 1, y, "#8a1a22");
    px(x, y + 1, "#8a1a22");
  }
});

/** Пузырёк: горлышко, пробка и цветное содержимое (null — пустой). */
export const bottle =
  (liquid: string | null): Painter =>
  (px) => {
    for (let y = 2; y < 5; y++) {
      px(7, y, "#d8e8f0");
      px(8, y, "#d8e8f0");
    }
    px(7, 1, "#8a6a3a");
    px(8, 1, "#8a6a3a");
    for (let y = 5; y < 14; y++)
      for (let x = 4; x < 12; x++) {
        const d = Math.hypot(x - 7.5, y - 9.5);
        if (d > 4.3) continue;
        px(x, y, d > 3.4 ? "#c8dce8" : liquid && y > 6 ? liquid : "#eef6fa");
      }
  };
add("glass_bottle", bottle(null));
add("potion_water", bottle("#3a60e0"));
add("potion_awkward", bottle("#5a80f0"));
add("potion_strength", bottle("#9a2020"));
add("potion_regeneration", bottle("#e070a0"));
add("potion_night_vision", bottle("#2030a0"));
add("potion_healing", bottle("#f04060"));
add("potion_swiftness", bottle("#80c8f0"));

// ---- стол зачарований ----
add("enchanting_table_top", (px) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const edge = x === 0 || y === 0 || x === TILE - 1 || y === TILE - 1;
      const book = x > 4 && x < 11 && y > 5 && y < 11;
      px(
        x,
        y,
        edge ? "#1a0a24" : book ? (x === 8 ? "#6a4a20" : "#f0e8d0") : "#8a1a2a",
      );
    }
});
add("enchanting_table_side", (px) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const cloth = y < 4;
      const gem = y === 8 && (x === 3 || x === 12);
      px(
        x,
        y,
        cloth
          ? "#8a1a2a"
          : gem
            ? "#5ee8dc"
            : (x + y) % 5 === 0
              ? "#2a1a3a"
              : "#140a1c",
      );
    }
});

// ---- наковальня и зачарованная книга ----
add("anvil_top", (px) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const face = y > 3 && y < 12;
      px(x, y, face ? ((x + y) % 6 === 0 ? "#5a5a5a" : "#4a4a4a") : "#333333");
    }
});
add("anvil_side", (px) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const w = y < 5 ? 8 : y < 11 ? 3 : 6; // наковальня: широкий верх, узкая шейка, основание
      if (Math.abs(x - 7.5) > w) continue;
      px(x, y, y < 5 ? "#4a4a4a" : "#3a3a3a");
    }
});
add("enchanted_book", (px) => {
  for (let y = 3; y < 13; y++)
    for (let x = 4; x < 12; x++)
      px(
        x,
        y,
        x === 4
          ? "#3a1a5a"
          : y === 3 || y === 12
            ? "#f0ecd8"
            : (x + y) % 4 === 0
              ? "#c080ff"
              : "#6a2aa0",
      );
});

add("golden_carrot", (px) => {
  for (let t = 0; t <= 8; t++) {
    const x = 3 + t,
      y = 13 - t;
    const w = t < 3 ? 1 : t < 6 ? 2 : 3;
    for (let a = 0; a < w; a++)
      for (let b = 0; b < w; b++)
        px(x + a - (w >> 1), y + b - (w >> 1), a === 0 ? "#fff080" : "#e8b830");
  }
  for (const [x, y] of [
    [12, 3],
    [13, 2],
    [14, 1],
    [12, 1],
    [13, 4],
  ] as const)
    px(x, y, "#d8c040");
});
