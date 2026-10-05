// Тайлы глубокой тьмы: скалк, прожилки, катализатор, сенсор, крикун, сланец древнего города; предметы —
// осколок эха и компас возвращения.
import { PAINTERS, noisy, shade, type Painter, type PxFn } from "../paint";

export const SCULK_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  SCULK_TILES.push(name);
};

const SCULK = "#0d1e24";
const TEAL = "#1f8a8a";
const SOUL = "#4af0e0";
const BONE = "#d8d0c0";

/** Скалк с бирюзовыми крапинами. */
const sculk = (px: PxFn, rng: () => number): void => {
  noisy(px, SCULK, 0.2, rng);
  for (let k = 0; k < 10; k++)
    px(
      Math.floor(rng() * 16),
      Math.floor(rng() * 16),
      rng() < 0.3 ? SOUL : TEAL,
    );
};

add("sculk", sculk);

add("sculk_vein", (px, rng) => {
  for (let k = 0; k < 5; k++) {
    let x = Math.floor(rng() * 16),
      y = Math.floor(rng() * 16);
    for (let s = 0; s < 8; s++) {
      px(x & 15, y & 15, s % 3 ? SCULK : TEAL);
      x += rng() < 0.5 ? 1 : -1;
      y += rng() < 0.5 ? 1 : 0;
    }
  }
});

add("sculk_catalyst_top", (px, rng) => {
  sculk(px, rng);
  for (let y = 3; y < 13; y++)
    for (let x = 3; x < 13; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 5 && d > 3) px(x, y, BONE);
      else if (d <= 2) px(x, y, SOUL);
    }
});
add("sculk_catalyst_side", (px, rng) => {
  sculk(px, rng);
  for (let x = 0; x < 16; x++)
    for (let y = 0; y < 4; y++) px(x, y, shade(BONE, (rng() - 0.5) * 0.15));
});

const sensorTop =
  (glow: string): Painter =>
  (px, rng) => {
    sculk(px, rng);
    for (const [x, y] of [
      [4, 4],
      [11, 4],
      [4, 11],
      [11, 11],
    ] as const)
      for (let k = 0; k < 3; k++) px(x, y - k, glow);
  };
add("sculk_sensor_top", sensorTop(TEAL));
add("sculk_sensor_on_top", sensorTop(SOUL));
add("sculk_sensor_side", (px, rng) => {
  noisy(px, "#08161a", 0.2, rng);
  for (let x = 0; x < 16; x++) px(x, 5, TEAL);
  for (let x = 2; x < 16; x += 4) px(x, 4, SOUL);
});

add("sculk_shrieker_top", (px, rng) => {
  sculk(px, rng);
  for (let y = 2; y < 14; y++)
    for (let x = 2; x < 14; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 6 && d > 4) px(x, y, BONE);
      else if (d <= 4) px(x, y, "#050a0c");
    }
});
add("sculk_shrieker_side", (px, rng) => {
  sculk(px, rng);
  for (let x = 0; x < 16; x++)
    for (let y = 0; y < 6; y++)
      px(x, y, (x + y) % 5 === 0 ? SCULK : shade(BONE, (rng() - 0.5) * 0.15));
});

const SLATE = "#46464a";
add("polished_deepslate", (px, rng) => {
  noisy(px, "#4a4a50", 0.06, rng);
  for (let i = 0; i < 16; i++) {
    px(i, 0, "#38383c");
    px(0, i, "#38383c");
    px(i, 15, "#5a5a60");
    px(15, i, "#5a5a60");
  }
});
add("deepslate_bricks", (px, rng) => {
  noisy(px, SLATE, 0.08, rng);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++)
      if (y % 4 === 3 || (x + (Math.floor(y / 4) % 2) * 4) % 8 === 7)
        px(x, y, "#2e2e32");
});
add("deepslate_tiles", (px, rng) => {
  noisy(px, "#3e3e42", 0.08, rng);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++)
      if (x % 4 === 3 || y % 4 === 3) px(x, y, "#26262a");
});
add("reinforced_deepslate_top", (px, rng) => {
  noisy(px, "#3a3a3e", 0.08, rng);
  for (const [x, y] of [
    [1, 1],
    [12, 1],
    [1, 12],
    [12, 12],
  ] as const)
    for (let dy = 0; dy < 3; dy++)
      for (let dx = 0; dx < 3; dx++) px(x + dx, y + dy, BONE);
});
add("reinforced_deepslate_side", (px, rng) => {
  noisy(px, "#3a3a3e", 0.08, rng);
  for (let x = 0; x < 16; x++) {
    px(x, 2, BONE);
    px(x, 13, BONE);
  }
});

add("echo_shard", (px) => {
  for (let k = 0; k < 10; k++) {
    px(4 + k, 13 - k, "#0e5a64");
    px(5 + k, 13 - k, TEAL);
    if (k > 3 && k < 8) px(5 + k, 12 - k, SOUL);
  }
});

add("recovery_compass", (px) => {
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 7) px(x, y, d > 5.8 ? "#0e3a44" : "#10262c");
    }
  for (let k = 0; k < 4; k++) px(7 + (k > 1 ? 1 : 0), 4 + k, SOUL);
  px(7, 8, "#e0e0e0");
});
