// Тайлы снегов: снежок.
import { PAINTERS, shade, type Painter } from "../paint";

export const FROST_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  FROST_TILES.push(name);
};

add("snowball", (px, rng) => {
  for (let y = 3; y < 13; y++)
    for (let x = 3; x < 13; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 4.8)
        px(
          x,
          y,
          shade(
            d < 2.5 && x < 8 && y < 8 ? "#ffffff" : "#e4ecf4",
            (rng() - 0.5) * 0.06,
          ),
        );
    }
});
