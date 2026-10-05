// Тайлы вёдер с рыбой, карты сокровищ, сердца моря, раковины наутилуса и проводника.
import {
  PAINTERS,
  TILE,
  noisy,
  shade,
  type Painter,
  type PxFn,
} from "../paint";

export const TREASURE_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  TREASURE_TILES.push(name);
};

/** Ведро с водой и рыбкой цвета fish. */
const fishBucket =
  (fish: string): Painter =>
  (px) => {
    for (let y = 4; y < 15; y++) {
      const w = 5 - Math.floor((y - 4) / 5);
      for (let x = 8 - w; x < 8 + w; x++)
        px(
          x,
          y,
          x === 8 - w || x === 7 + w || y === 14
            ? "#8a8a90"
            : y < 7
              ? "#3a60e0"
              : "#c8c8d0",
        );
    }
    for (let x = 6; x < 10; x++) px(x, 5, fish);
    px(10, 5, fish);
    px(10, 4, fish);
    for (let x = 4; x < 12; x++) px(x, 2, "#6a6a70"); // дужка
  };
add("cod_bucket", fishBucket("#b09a6a"));
add("salmon_bucket", fishBucket("#b05040"));
add("tropical_fish_bucket", fishBucket("#f08a2a"));
add("pufferfish_bucket", fishBucket("#e0c040"));
add("axolotl_bucket", fishBucket("#f0a8c8"));
add("tadpole_bucket", fishBucket("#3a2a1a"));

add("treasure_map", (px, rng) => {
  for (let y = 1; y < 15; y++)
    for (let x = 1; x < 15; x++)
      px(x, y, shade("#d8c08a", (rng() - 0.5) * 0.12));
  for (let k = 0; k < 5; k++) {
    px(9 + k - 2, 9 + k - 2, "#c02020");
    px(9 + 2 - k, 9 + k - 2, "#c02020");
  }
  for (let x = 2; x < 8; x++) px(x, 4 + (x % 2), "#5a8a3a"); // берег
});

add("heart_of_the_sea", (px) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 5.5)
        px(x, y, d < 2 ? "#e0f8ff" : d < 3.8 ? "#4ab8e8" : "#1a6ab0");
    }
});

add("nautilus_shell", (px) => {
  for (let a = 0; a < 40; a++) {
    const t = a / 40;
    const r = 1 + t * 6;
    const ang = t * Math.PI * 3.5;
    const x = Math.round(7.5 + Math.cos(ang) * r),
      y = Math.round(8 + Math.sin(ang) * r);
    for (let k = 0; k < 2; k++)
      px(Math.min(15, x + k), y, a % 4 < 2 ? "#e8d8c0" : "#c8a888");
  }
});

add("conduit", (px: PxFn, rng) => {
  noisy(px, "#a89a7a", 0.1, rng);
  for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) px(x, y, "#4ab8e8");
  px(7, 7, "#e0f8ff");
  px(8, 8, "#e0f8ff");
});
