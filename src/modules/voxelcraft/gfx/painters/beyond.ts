// Тайлы пути в Предел: рамка портала (верх, бок, верх с Оком), портал, камень Предела, яйцо
// дракона и Око Предела.
import { PAINTERS, TILE, noisy, shade, type Painter } from "../paint";

export const BEYOND_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  BEYOND_TILES.push(name);
};

const each = (fn: (x: number, y: number) => void): void => {
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) fn(x, y);
};

add("beyond_stone", (px, rng) => {
  noisy(px, "#dcdca0", 0.08, rng);
  for (let i = 0; i < 10; i++)
    px(Math.floor(rng() * TILE), Math.floor(rng() * TILE), "#b8b47a");
});

/** Верх рамки: зеленовато-бирюзовый камень с тёмным гнездом под Око. */
const frameTop =
  (eye: boolean): Painter =>
  (px, rng) =>
    each((x, y) => {
      const d = Math.hypot(x - 7.5, y - 7.5);
      let c = shade("#3a6a5a", (rng() - 0.5) * 0.14);
      if (d < 4)
        c = eye
          ? d < 1.6
            ? "#0a2a1a"
            : shade("#3ae0a0", (rng() - 0.5) * 0.2)
          : "#1a2a24";
      else if (d < 5) c = "#2a4a40";
      px(x, y, c);
    });
add("rim_frame_top", frameTop(false));
add("rim_frame_eye", frameTop(true));
add("rim_frame_side", (px, rng) =>
  each((x, y) => {
    const band = y < 4;
    px(
      x,
      y,
      band
        ? shade("#3a6a5a", (rng() - 0.5) * 0.14)
        : shade("#dcdca0", (rng() - 0.5) * 0.08),
    );
  }),
);
add("beyond_portal", (px, rng) =>
  each((x, y) => {
    const v = rng();
    px(
      x,
      y,
      v < 0.04
        ? "#7ae8d8"
        : v < 0.07
          ? "#c8a0ff"
          : v < 0.09
            ? "#f0f0ff"
            : shade("#0a0a14", v * 0.3),
    );
  }),
);
add("dragon_egg", (px, rng) =>
  each((x, y) => {
    const v = rng();
    px(x, y, v < 0.1 ? "#6a2aa0" : shade("#140a1c", (rng() - 0.5) * 0.2));
  }),
);

// ---- Око Предела ----
add("rim_eye", (px) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d > 5.5) continue;
      px(x, y, d < 1.8 ? "#0a2a1a" : d < 4 ? "#3ae0a0" : "#1f8a5a");
    }
});
