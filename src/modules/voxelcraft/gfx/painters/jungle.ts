// Тайлы джунглей: бамбук (форма rod — UV от центра, стебель в столбцах 6–9).
import { PAINTERS, shade, type Painter } from "../paint";

export const JUNGLE_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  JUNGLE_TILES.push(name);
};

add("bamboo", (px, rng) => {
  for (let y = 0; y < 16; y++)
    for (let x = 6; x < 10; x++) {
      const joint = y % 6 === 0;
      px(
        x,
        y,
        joint
          ? "#3a6a1a"
          : shade(x === 6 ? "#4a8a22" : "#6ab030", (rng() - 0.5) * 0.08),
      );
    }
  px(10, 3, "#5aa02a");
  px(11, 2, "#5aa02a"); // листок
});
