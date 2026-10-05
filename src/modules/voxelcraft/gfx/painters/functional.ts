// Тайлы функциональных блоков: печь (бок, верх, топка холодная и горящая), сундук.
import { PAINTERS, TILE, noisy, shade, type Painter } from "../paint";

export const FUNCTIONAL_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  FUNCTIONAL_TILES.push(name);
};

/** Каменная кладка печи. */
const furnaceStone: Painter = (px, rng) => {
  noisy(px, "#7a7a7a", 0.08, rng);
  for (let i = 0; i < TILE; i++) {
    px(i, 0, "#5a5a5a");
    px(i, 15, "#4a4a4a");
    px(0, i, "#5a5a5a");
    px(15, i, "#4a4a4a");
  }
};

add("furnace_side", furnaceStone);
add("furnace_top", (px, rng) => {
  noisy(px, "#8c8c8c", 0.05, rng);
  for (let i = 1; i < 15; i++) {
    px(i, 1, "#a0a0a0");
    px(i, 14, "#6a6a6a");
  }
});

/** Лицо печи: кладка, тёмная топка внизу; горящая — с огнём внутри. */
function furnaceFront(lit: boolean): Painter {
  return (px, rng) => {
    furnaceStone(px, rng);
    for (let y = 8; y < 14; y++)
      for (let x = 3; x < 13; x++) {
        const fire = lit && y >= 10 && rng() < 0.85;
        px(
          x,
          y,
          fire
            ? shade(rng() < 0.35 ? "#ffe27a" : "#f08a24", (rng() - 0.5) * 0.2)
            : "#1c1c1c",
        );
      }
    for (let x = 3; x < 13; x++) px(x, 4, "#3a3a3a"); // решётка над топкой
  };
}
add("furnace_front", furnaceFront(false));
add("furnace_front_on", furnaceFront(true));

/** Доски сундука с тёмной обвязкой. */
const chestWood: Painter = (px, rng) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const edge = x === 0 || x === 15 || y === 0 || y === 15;
      px(x, y, edge ? "#5a3a1c" : shade("#9a7040", (rng() - 0.5) * 0.14));
    }
};
add("chest_side", (px, rng) => {
  chestWood(px, rng);
  for (let x = 0; x < TILE; x++) px(x, 5, "#5a3a1c"); // шов крышки
});
add("chest_top", chestWood);
// ---- кровать ----
add("bed_top", (px, rng) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const edge = x === 0 || x === 15;
      px(x, y, edge ? "#7a1414" : shade("#b82424", (rng() - 0.5) * 0.12));
    }
});
add("bed_head", (px, rng) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const pillow = y < 7 && x > 1 && x < 14;
      const edge = x === 0 || x === 15;
      px(
        x,
        y,
        pillow
          ? shade("#f2f2f2", (rng() - 0.5) * 0.06)
          : edge
            ? "#7a1414"
            : shade("#b82424", (rng() - 0.5) * 0.12),
      );
    }
});
add("bed_side", (px, rng) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      if (y >= 9) continue; // коробка кровати — 9 px высотой
      const wood = y >= 6;
      px(
        x,
        y,
        wood
          ? shade("#8a6a3a", (rng() - 0.5) * 0.1)
          : shade("#b82424", (rng() - 0.5) * 0.12),
      );
    }
});

// ---- TNT ----
add("tnt_side", (px, rng) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const band = y >= 5 && y <= 10;
      const letter =
        band &&
        y >= 6 &&
        y <= 9 &&
        (x === 2 ||
          x === 6 ||
          x === 10 ||
          x === 14 ||
          ((x <= 3 || x >= 13) && y === 6) ||
          (x >= 5 && x <= 7 && y === 6 && x !== 6));
      px(
        x,
        y,
        letter
          ? "#2a2a2a"
          : band
            ? "#ece8e0"
            : shade("#d02020", (rng() - 0.5) * 0.14),
      );
    }
});
add("tnt_top", (px, rng) => {
  noisy(px, "#c81c1c", 0.1, rng);
  for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) px(x, y, "#3a2a1a");
});
add("tnt_bottom", (px, rng) => noisy(px, "#b81818", 0.1, rng));

add("chest_front", (px, rng) => {
  chestWood(px, rng);
  for (let x = 0; x < TILE; x++) px(x, 5, "#5a3a1c");
  for (let y = 4; y < 8; y++) for (let x = 7; x < 9; x++) px(x, y, "#cfcfcf"); // замок
});
