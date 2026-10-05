// Тайлы снега-пороха, розовых лепестков и ведра снега-пороха.
import { PAINTERS, noisy, type Painter } from "../paint";

export const MOUNTAIN_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  MOUNTAIN_TILES.push(name);
};

add("powder_snow", (px, rng) => {
  noisy(px, "#f4f8fc", 0.05, rng);
  for (let k = 0; k < 14; k++)
    px(Math.floor(rng() * 16), Math.floor(rng() * 16), "#dce8f4");
});

add("pink_petals", (px, rng) => {
  for (let k = 0; k < 22; k++) {
    const x = Math.floor(rng() * 15),
      y = Math.floor(rng() * 15);
    px(x, y, "#f0a8c8");
    px(x + 1, y, "#f8c8dc");
    if (rng() < 0.3) px(x, y + 1, "#e088b0");
  }
});

add("powder_snow_bucket", (px) => {
  for (let y = 4; y < 15; y++) {
    const w = 5 - Math.floor((y - 4) / 5);
    for (let x = 8 - w; x < 8 + w; x++)
      px(
        x,
        y,
        x === 8 - w || x === 7 + w || y === 14
          ? "#8a8a90"
          : y < 7
            ? "#f4f8fc"
            : "#c8c8d0",
      );
  }
  for (let x = 4; x < 12; x++) px(x, 2, "#6a6a70"); // дужка
});
