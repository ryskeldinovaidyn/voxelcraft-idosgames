// Тайлы 16 цветов (registry/blocks/colors.ts): шерсть новых цветов (ковры берут тайл шерсти) и
// красители — горка порошка в мешочке.
import { DYE_COLORS } from "../../registry/blocks/colors";
import { PAINTERS, TILE, shade, type Painter } from "../paint";

export const COLOR_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  COLOR_TILES.push(name);
};

const wool =
  (c: string): Painter =>
  (px, rng) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++)
        px(
          x,
          y,
          shade(c, ((x + y) % 4 === 0 ? -0.07 : 0) + (rng() - 0.5) * 0.08),
        );
  };

const dye =
  (c: string): Painter =>
  (px, rng) => {
    for (let y = 5; y < 14; y++)
      for (let x = 3; x < 13; x++) {
        const d = Math.hypot(x - 7.5, (y - 10) * 1.4);
        if (d < 5) px(x, y, shade(c, (rng() - 0.5) * 0.2 - (y - 5) * 0.02));
      }
    for (let x = 6; x < 10; x++) px(x, 4, shade(c, -0.25)); // завязка
    px(6, 7, shade(c, 0.35));
  };

for (const c of DYE_COLORS) {
  // шерсть 12 прежних цветов рисует TextureAtlas (её painters попадают в PAINTERS позже этого модуля)
  if (!c.legacyWool) add(`${c.id}_wool`, wool(c.hex));
  add(`${c.id}_dye`, dye(c.hex));
}
