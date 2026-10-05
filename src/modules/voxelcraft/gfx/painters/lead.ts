// Тайл поводка: смотанная верёвка с петлёй.
import { PAINTERS, shade } from "../paint";

export const LEAD_TILES: string[] = [];

PAINTERS.lead = (px, rng) => {
  for (let a = 0; a < 80; a++) {
    const t = (a / 80) * Math.PI * 4;
    const r = 3.5 + (a / 80) * 1.5;
    px(
      Math.round(8 + Math.cos(t) * r),
      Math.round(9 + Math.sin(t) * r * 0.8),
      shade("#a8804a", (rng() - 0.5) * 0.15),
    );
  }
  for (let y = 1; y < 5; y++) px(12, y, "#8a6a3a"); // хвост с петлёй
  px(11, 1, "#8a6a3a");
  px(13, 1, "#8a6a3a");
};
LEAD_TILES.push("lead");
