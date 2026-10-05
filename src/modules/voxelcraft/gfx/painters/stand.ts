// Тайлы стойки для брони (светлое дерево), путевого камня (роза ветров на камне) и якоря
// возрождения (тёмный камень со светящейся сердцевиной).
import { PAINTERS, noisy, shade, type Painter } from "../paint";

export const STAND_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  STAND_TILES.push(name);
};

add("armor_stand", (px, rng) => {
  // столб с перекладиной — рисуется на всех гранях формы stand
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++)
      if ((x >= 6 && x <= 9) || (y >= 10 && y <= 12) || y >= 14)
        px(x, y, shade("#c8ac74", (rng() - 0.5) * 0.14));
});

add("lodestone_side", (px, rng) => {
  noisy(px, "#8a8e94", 0.1, rng);
  for (let y = 3; y < 13; y++) px(3, y, "#5a5e64");
  for (let y = 3; y < 13; y++) px(12, y, "#5a5e64");
});
add("lodestone_top", (px, rng) => {
  noisy(px, "#9a9ea4", 0.08, rng);
  // роза ветров
  for (let i = 3; i < 13; i++) {
    px(i, 7, "#3a3e44");
    px(i, 8, "#3a3e44");
    px(7, i, "#3a3e44");
    px(8, i, "#3a3e44");
  }
  for (let y = 5; y < 8; y++) for (let x = 7; x < 9; x++) px(x, y, "#c02a22");
});

add("respawn_anchor_side", (px, rng) => {
  noisy(px, "#2a1a3a", 0.12, rng);
  for (let y = 5; y < 12; y++)
    for (let x = 4; x < 12; x++)
      px(x, y, shade("#6a3aa0", (rng() - 0.5) * 0.2));
});
add("respawn_anchor_top", (px, rng) => {
  noisy(px, "#2a1a3a", 0.12, rng);
  for (let y = 4; y < 12; y++)
    for (let x = 4; x < 12; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 3.6) px(x, y, d < 2 ? "#d8c0ff" : "#8a5ac8");
    }
});
