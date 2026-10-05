// Тайлы морской жизни (registry/blocks/sealife.ts, registry/items/sealife.ts).
import { CORALS } from "../../registry/blocks/sealife";
import { PAINTERS, TILE, noisy, shade, type Painter } from "../paint";
import { bottle } from "./brewing";

export const SEA_LIFE_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  SEA_LIFE_TILES.push(name);
};

/** Коралловый блок: пористый, с тёмными порами. */
const coralBlock =
  (base: string): Painter =>
  (px, rng) => {
    noisy(px, base, 0.1, rng);
    for (let i = 0; i < 22; i++)
      px(Math.floor(rng() * TILE), Math.floor(rng() * TILE), shade(base, -0.3));
  };

/** Коралл-растение: ветвистый куст от низа вверх, прозрачный фон. */
const coralPlant =
  (base: string): Painter =>
  (px, rng) => {
    for (let k = 0; k < 4; k++) {
      let x = 4 + Math.floor(rng() * 8);
      for (let y = 15; y > 3 + Math.floor(rng() * 4); y--) {
        px(x, y, shade(base, (rng() - 0.5) * 0.3));
        if (rng() < 0.35)
          x = Math.max(1, Math.min(14, x + (rng() < 0.5 ? -1 : 1)));
        if (rng() < 0.2) px(Math.min(15, x + 1), y, shade(base, 0.15));
      }
    }
  };

for (const c of CORALS) {
  add(`${c.id}_coral_block`, coralBlock(c.color));
  add(`dead_${c.id}_coral_block`, coralBlock("#8a8680"));
  add(`${c.id}_coral`, coralPlant(c.color));
}

const kelp =
  (tip: boolean): Painter =>
  (px, rng) => {
    for (let y = 0; y < TILE; y++) {
      const x = 7 + Math.round(Math.sin(y * 0.6) * 1.5);
      px(x, y, shade("#3a7a2a", (rng() - 0.5) * 0.2));
      if (y % 4 === 1)
        for (let k = 1; k <= 3; k++)
          px(
            Math.max(0, Math.min(15, x + (y % 8 === 1 ? k : -k))),
            y,
            "#4a8a3a",
          );
    }
    if (tip)
      for (let y = 0; y < 4; y++)
        for (let x = 5; x < 11; x++)
          px(x, y, (x + y) % 2 ? "#5a9a4a" : "#3a7a2a");
  };
add("kelp", kelp(true));
add("kelp_plant", kelp(false));
add("sea_pickle", (px) => {
  for (let y = 4; y < 16; y++)
    for (let x = 5; x < 11; x++) px(x, y, (x + y) % 3 ? "#6a8a3a" : "#4a6a2a");
  for (let x = 6; x < 10; x++) px(x, 3, "#c8ff8a"); // светящаяся верхушка
});
add("dried_kelp_block_side", (px, rng) => {
  noisy(px, "#3a4a2a", 0.12, rng);
  for (let x = 0; x < TILE; x++) {
    px(x, 4, "#2a3420");
    px(x, 11, "#2a3420");
  }
});
add("dried_kelp_block_top", (px, rng) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++)
      px(
        x,
        y,
        shade(
          "#3a4a2a",
          (Math.floor(Math.hypot(x - 7.5, y - 7.5)) % 3 === 0 ? -0.2 : 0) +
            (rng() - 0.5) * 0.1,
        ),
      );
});

// предметы
add("dried_kelp", (px) => {
  for (let y = 3; y < 13; y++)
    for (let x = 4 + (y % 2); x < 12 - (y % 2); x++)
      px(x, y, (x + y) % 3 ? "#4a5a2a" : "#2a3420");
});
const fishIcon =
  (body: string, fin: string, stripe?: string): Painter =>
  (px) => {
    for (let y = 4; y < 12; y++)
      for (let x = 2; x < 12; x++)
        if (Math.hypot((x - 7) / 5, (y - 8) / 3.5) < 1)
          px(x, y, stripe && (x === 6 || x === 9) ? stripe : body);
    for (let y = 5; y < 11; y++)
      for (let x = 12; x < 15; x++)
        if (Math.abs(y - 8) <= x - 11) px(x, y, fin);
    px(4, 7, "#101010");
  };
add("tropical_fish", fishIcon("#f08a2a", "#f0f0f0", "#f0f0f0"));
add("pufferfish", (px) => {
  for (let y = 2; y < 14; y++)
    for (let x = 2; x < 14; x++)
      if (Math.hypot(x - 7.5, y - 7.5) < 5.5)
        px(x, y, y > 9 ? "#e8e0b0" : "#e0c040");
  for (const [x, y] of [
    [7, 1],
    [1, 7],
    [14, 7],
    [7, 14],
    [3, 3],
    [12, 3],
  ] as const)
    px(x, y, "#8a6a2a");
  px(5, 6, "#101010");
  px(10, 6, "#101010");
});
add("potion_water_breathing", bottle("#2a5ab8"));
