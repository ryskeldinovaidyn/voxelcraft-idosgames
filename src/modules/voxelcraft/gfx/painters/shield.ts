// Тайл щита: деревянные доски в железной оковке.
import { PAINTERS, shade } from "../paint";

export const SHIELD_TILES: string[] = [];

PAINTERS.shield = (px, rng) => {
  for (let y = 2; y < 15; y++)
    for (let x = 3; x < 13; x++) {
      if (y > 11 && Math.abs(x - 7.5) > 14 - y) continue; // низ щита сужается
      const rim =
        x === 3 ||
        x === 12 ||
        y === 2 ||
        (y > 11 && Math.abs(x - 7.5) > 13 - y);
      px(
        x,
        y,
        rim
          ? "#8a8e94"
          : shade(x % 3 === 0 ? "#6a4a2a" : "#8a6a3a", (rng() - 0.5) * 0.1),
      );
    }
  for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) px(x, y, "#a8acb2"); // умбон
};
SHIELD_TILES.push("shield");
