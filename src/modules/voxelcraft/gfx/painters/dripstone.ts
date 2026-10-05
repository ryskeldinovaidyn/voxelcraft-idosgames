// Тайлы капельника и котла; предмет — козий рог.
import { PAINTERS, noisy, shade, type Painter, type PxFn } from "../paint";

export const DRIPSTONE_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  DRIPSTONE_TILES.push(name);
};

const DRIP = "#86705a";

add("dripstone_block", (px, rng) => {
  noisy(px, DRIP, 0.1, rng);
  for (let x = 1; x < 16; x += 3)
    for (let y = 0; y < 16; y++) if (rng() < 0.5) px(x, y, shade(DRIP, -0.15));
});

/** Острый конус: up — остриём вверх. */
const spike =
  (up: boolean): Painter =>
  (px: PxFn, rng) => {
    for (let r = 0; r < 16; r++) {
      const y = up ? 15 - r : r;
      const w = Math.max(0, Math.round(3.5 - r * 0.22));
      for (let x = 8 - w; x < 8 + w; x++)
        px(x, y, shade(DRIP, (rng() - 0.5) * 0.2 + (x < 8 ? 0.08 : -0.08)));
    }
  };
add("pointed_dripstone_up", spike(true));
add("pointed_dripstone_down", spike(false));

const IRON = "#3a3a3e";
/** Верх котла: обод и нутро цвета inner. */
const potTop =
  (inner: string): Painter =>
  (px, rng) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const rim = x < 2 || x > 13 || y < 2 || y > 13;
        px(
          x,
          y,
          rim
            ? shade(IRON, (rng() - 0.5) * 0.1)
            : shade(inner, (rng() - 0.5) * 0.12),
        );
      }
  };
add("cauldron_top", potTop("#161618"));
add("cauldron_water", potTop("#3a60e0"));
add("cauldron_lava", potTop("#e06010"));
add("cauldron_side", (px, rng) => {
  noisy(px, IRON, 0.08, rng);
  for (let x = 0; x < 16; x++) px(x, 2, "#4e4e54");
  for (let y = 12; y < 16; y++)
    for (let x = 4; x < 12; x++) px(x, y, "#202024"); // между ножками
});
add("cauldron_bottom", (px, rng) => noisy(px, "#2a2a2e", 0.08, rng));

add("goat_horn", (px) => {
  for (let k = 0; k < 11; k++) {
    const x = 3 + k,
      y = 12 - Math.round(Math.sin((k / 10) * Math.PI) * 5) - Math.floor(k / 3);
    const w = k < 4 ? 3 : k < 8 ? 2 : 1;
    for (let d = 0; d < w; d++)
      px(x, Math.min(15, y + d), k < 3 ? "#8a8070" : "#c8c0a8");
  }
});
