// Тайлы звучащих блоков и пластинок: у каждой пластинки свой цвет канта.
import { PAINTERS, noisy, shade, type Painter } from "../paint";
import { DISCS } from "../../systems/Disc";

export const SOUND_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  SOUND_TILES.push(name);
};

add("jukebox_side", (px, rng) => {
  noisy(px, "#6a4a32", 0.08, rng);
  for (let x = 0; x < 16; x++) {
    px(x, 1, "#4a3020");
    px(x, 14, "#4a3020");
  }
});
add("jukebox_top", (px, rng) => {
  noisy(px, "#7a5a3a", 0.07, rng);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 5.5) px(x, y, d < 1.2 ? "#d8d0b8" : "#2a2a2e"); // пластинка с этикеткой
    }
});
add("note_block", (px, rng) => {
  noisy(px, "#7a5a3a", 0.08, rng);
  for (const [x, y] of [
    [7, 5],
    [7, 6],
    [7, 7],
    [7, 8],
    [6, 9],
    [5, 9],
    [5, 10],
    [6, 10],
    [8, 4],
    [9, 4],
  ] as [number, number][])
    px(x, y, "#2a2a2e"); // нота
});

/** Пластинка: чёрный диск со своим цветом этикетки. */
const DISC_COLOR: Record<string, string> = {
  disc_dawn: "#e8c060",
  disc_drift: "#60a8e8",
  disc_hollow: "#a8a8b0",
  disc_ember: "#e06030",
  disc_void: "#a060e0",
};
for (const d of DISCS)
  add(d.name, (px) => {
    const c = DISC_COLOR[d.name] ?? "#c8c8c8";
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const r = Math.hypot(x - 7.5, y - 7.5);
        if (r > 7) continue;
        px(
          x,
          y,
          r < 2 ? c : r < 2.8 ? shade(c, -0.3) : r > 6 ? "#1a1a1e" : "#2a2a30",
        );
      }
  });
