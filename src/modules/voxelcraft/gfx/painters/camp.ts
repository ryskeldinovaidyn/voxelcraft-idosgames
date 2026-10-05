// Тайлы активирующих рельсов, костра и вагонеток с грузом (registry/blocks/camp.ts, items/dyes.ts).
import { PAINTERS, TILE, shade, type Painter, type PxFn } from "../paint";
import { railPainter, type RailLook } from "./redstone";

export const CAMP_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  CAMP_TILES.push(name);
};

const ACTIVATOR: Record<string, RailLook> = {
  activator_rail: { bar: "#a8a8b0", mid: "#6a2a2a" },
  activator_rail_on: { bar: "#a8a8b0", mid: "#ff5a3a" },
};
for (const [name, look] of Object.entries(ACTIVATOR)) {
  add(name, railPainter(look, "ns"));
  add(`${name}_ew`, railPainter(look, "ew"));
}

// костёр: бок — брёвна корой, верх — крест из брёвен и угли (потухший — зола)
add("campfire_side", (px, rng) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const log = y >= 9 || (y >= 3 && y < 7);
      if (!log) continue;
      const end = x < 2 || x > 13;
      px(
        x,
        y,
        end
          ? shade("#b08a5a", (rng() - 0.5) * 0.1)
          : shade("#5a3e24", (x % 4 === 0 ? -0.2 : 0) + (rng() - 0.5) * 0.1),
      );
    }
});
const campTop =
  (hot: boolean): Painter =>
  (px, rng) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const log =
          (x >= 2 && x < 6) ||
          (x >= 10 && x < 14) ||
          (y >= 2 && y < 6) ||
          (y >= 10 && y < 14);
        const mid = x >= 5 && x < 11 && y >= 5 && y < 11;
        if (mid)
          px(
            x,
            y,
            hot
              ? shade(rng() < 0.5 ? "#ff8a1a" : "#ffd040", (rng() - 0.5) * 0.2)
              : shade("#7a7a78", (rng() - 0.5) * 0.2),
          );
        else if (log) px(x, y, shade("#5a3e24", (rng() - 0.5) * 0.15));
      }
  };
add("campfire_top", campTop(true));
add("campfire_off", campTop(false));

// вагонетки с грузом: корпус как у обычной, груз сверху
const cart =
  (cargo: (px: PxFn) => void): Painter =>
  (px) => {
    cargo(px);
    for (let y = 8; y < 13; y++)
      for (let x = 2; x < 14; x++) px(x, y, y === 8 ? "#8a8e94" : "#5e6268");
    for (const cx of [4, 11])
      for (let y = 13; y < 15; y++)
        for (let x = cx - 1; x <= cx; x++) px(x, y, "#2a2a2a");
  };
add(
  "chest_minecart",
  cart((px) => {
    for (let y = 2; y < 8; y++)
      for (let x = 4; x < 12; x++) px(x, y, y === 4 ? "#3a2a1a" : "#a0702a");
    px(7, 4, "#d8d8d8");
    px(8, 4, "#d8d8d8");
  }),
);
add(
  "hopper_minecart",
  cart((px) => {
    for (let y = 3; y < 8; y++)
      for (let x = (3 + (y - 3)) >> 1; x < 13 - ((y - 3) >> 1); x++)
        px(x, y, y === 3 ? "#2a2a2a" : "#5a5a5e");
  }),
);
add(
  "tnt_minecart",
  cart((px) => {
    for (let y = 2; y < 8; y++)
      for (let x = 4; x < 12; x++)
        px(x, y, y === 4 || y === 5 ? "#e8e8e0" : "#c03020");
  }),
);
