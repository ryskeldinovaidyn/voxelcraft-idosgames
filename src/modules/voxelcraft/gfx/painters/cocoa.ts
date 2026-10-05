// Тайлы: стручок какао (форма pod, UV от центра), бобы какао, печенье, факел душ.
import { PAINTERS, shade, type Painter } from "../paint";

export const COCOA_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  COCOA_TILES.push(name);
};

add("cocoa", (px, rng) => {
  for (let y = 3; y < 13; y++)
    for (let x = 3; x < 13; x++)
      px(x, y, shade(y % 3 === 0 ? "#8a5a2a" : "#a86a30", (rng() - 0.5) * 0.1));
  for (let x = 3; x < 13; x++) px(x, 3, "#6a4020");
});
add("cocoa_beans", (px) => {
  for (const [cx, cy] of [
    [5, 6],
    [10, 9],
  ] as const)
    for (let y = -2; y <= 2; y++)
      for (let x = -2; x <= 2; x++)
        if (x * x + y * y < 6)
          px(cx + x, cy + y, x === 0 ? "#3a2210" : "#6a3e1a");
});
add("cookie", (px, rng) => {
  for (let y = 3; y < 13; y++)
    for (let x = 3; x < 13; x++)
      if (Math.hypot(x - 7.5, y - 7.5) < 5)
        px(x, y, shade("#d8a050", (rng() - 0.5) * 0.08));
  for (const [x, y] of [
    [6, 6],
    [9, 7],
    [7, 10],
    [10, 10],
  ] as const)
    px(x, y, "#4a2a14");
});
/** Факел душ: палка и бирюзовое пламя (форма torch берёт UV от центра). */
const soulTorch: Painter = (px) => {
  for (let y = 6; y < 16; y++)
    for (let x = 7; x < 9; x++) px(x, y, y < 8 ? "#3a3030" : "#6a4a2a");
  for (let y = 3; y < 6; y++)
    for (let x = 7; x < 9; x++) px(x, y, y === 3 ? "#b8f4ff" : "#40c8e0");
};
add("soul_torch", soulTorch);
