// Тайлы рабочих блоков: бочка, коптильня, плавильная печь, компостер.
import { PAINTERS, noisy, shade, type Painter } from "../paint";

export const WORKSTATION_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  WORKSTATION_TILES.push(name);
};

const planks =
  (c: string, hoop: string | null): Painter =>
  (px, rng) => {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const hoopRow = hoop && (y === 2 || y === 13);
        px(
          x,
          y,
          hoopRow
            ? hoop
            : x % 4 === 3
              ? shade(c, -0.22)
              : shade(c, (rng() - 0.5) * 0.1),
        );
      }
  };
add("barrel_side", planks("#8a6a3a", "#4a4a50"));
add("barrel_top", (px, rng) => {
  noisy(px, "#9a7a48", 0.08, rng);
  for (let i = 0; i < 16; i++) {
    px(i, 0, "#4a4a50");
    px(i, 15, "#4a4a50");
    px(0, i, "#4a4a50");
    px(15, i, "#4a4a50");
  }
  for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) px(x, y, "#5a3a20"); // крышка-люк
});

/** Каменная печь: бока, верх и лицо с топкой (горящая — с огнём). */
const stoneSide =
  (c: string): Painter =>
  (px, rng) =>
    noisy(px, c, 0.1, rng);
const front =
  (c: string, frame: string, fire: boolean): Painter =>
  (px, rng) => {
    noisy(px, c, 0.1, rng);
    for (let y = 8; y < 14; y++)
      for (let x = 4; x < 12; x++)
        px(
          x,
          y,
          y === 8 || x === 4 || x === 11
            ? frame
            : fire
              ? rng() < 0.5
                ? "#f8a020"
                : "#f8d040"
              : "#1a1a1a",
        );
  };
add("smoker_side", planks("#5a4a3a", null));
add("smoker_top", stoneSide("#4a4a4a"));
add("smoker_front", front("#5a4a3a", "#3a3a3a", false));
add("smoker_front_on", front("#5a4a3a", "#3a3a3a", true));
add("blast_furnace_side", stoneSide("#6a6a72"));
add("blast_furnace_top", stoneSide("#7a7a82"));
add("blast_furnace_front", front("#6a6a72", "#a8acb2", false));
add("blast_furnace_front_on", front("#6a6a72", "#a8acb2", true));

add("composter_side", planks("#7a5a32", null));
add("composter_top", (px, rng) => {
  noisy(px, "#5a3e22", 0.14, rng); // перегной
  for (let i = 0; i < 16; i++) {
    px(i, 0, "#8a6a3a");
    px(i, 15, "#8a6a3a");
    px(0, i, "#8a6a3a");
    px(15, i, "#8a6a3a");
  }
});
