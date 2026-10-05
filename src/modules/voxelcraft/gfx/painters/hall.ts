// Тайлы колокола и картин: колокол — золочёная чаша на балке, картины — четыре сюжета в раме.
import { PAINTERS, noisy, shade, type Painter } from "../paint";

export const HALL_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  HALL_TILES.push(name);
};

add("bell_side", (px, rng) => {
  noisy(px, "#6a4a2a", 0.08, rng); // деревянная балка сверху и по краям
  for (let y = 3; y < 14; y++)
    for (let x = 3; x < 13; x++) {
      const w = 3 + Math.floor((y - 3) / 2); // чаша расширяется книзу
      if (Math.abs(x - 7.5) > w) continue;
      px(x, y, y > 11 ? "#c8a020" : shade("#e8c840", (rng() - 0.5) * 0.12));
    }
  px(7, 2, "#8a6a2a");
  px(8, 2, "#8a6a2a");
});
add("bell_top", (px, rng) => {
  noisy(px, "#6a4a2a", 0.08, rng);
  for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) px(x, y, "#e8c840");
});

/** Картина: рама из тёмного дерева и сюжет внутри. */
const framed =
  (draw: (px: (x: number, y: number, c: string) => void) => void): Painter =>
  (px, rng) => {
    noisy(px, "#3a2a1a", 0.06, rng);
    for (let y = 2; y < 14; y++)
      for (let x = 2; x < 14; x++) px(x, y, "#d8c8a8");
    draw(px);
  };

// закат над водой
add(
  "painting_0",
  framed((px) => {
    for (let y = 2; y < 8; y++)
      for (let x = 2; x < 14; x++) px(x, y, "#e8a050");
    for (let y = 8; y < 14; y++)
      for (let x = 2; x < 14; x++) px(x, y, "#3a6a9a");
    for (let y = 4; y < 8; y++)
      for (let x = 6; x < 10; x++) px(x, y, "#f8e070");
  }),
);
// ель на снегу
add(
  "painting_1",
  framed((px) => {
    for (let y = 2; y < 14; y++)
      for (let x = 2; x < 14; x++) px(x, y, "#c8d8e8");
    for (let y = 4; y < 12; y++) {
      const w = Math.floor((y - 3) / 2);
      for (let x = 7 - w; x <= 8 + w; x++) px(x, y, "#2a6a3a");
    }
    px(7, 12, "#5a3a1a");
    px(8, 12, "#5a3a1a");
  }),
);
// глаз в темноте
add(
  "painting_2",
  framed((px) => {
    for (let y = 2; y < 14; y++)
      for (let x = 2; x < 14; x++) px(x, y, "#1a1a22");
    for (let x = 5; x < 11; x++) {
      px(x, 7, "#e8e8d0");
      px(x, 8, "#e8e8d0");
    }
    px(7, 7, "#8a30c0");
    px(8, 8, "#8a30c0");
  }),
);
// красный ромб на охре
add(
  "painting_3",
  framed((px) => {
    for (let y = 2; y < 14; y++)
      for (let x = 2; x < 14; x++) px(x, y, "#c8a060");
    for (let y = 3; y < 13; y++) {
      const w = 5 - Math.abs(y - 8);
      for (let x = 7 - w; x <= 8 + w; x++) if (w >= 0) px(x, y, "#a03028");
    }
  }),
);
