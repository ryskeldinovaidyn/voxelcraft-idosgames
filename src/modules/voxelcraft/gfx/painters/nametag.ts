// Тайл бирки: светлый ярлычок с дырочкой и верёвкой.
import { PAINTERS, shade } from "../paint";

export const NAMETAG_TILES: string[] = ["name_tag"];

PAINTERS.name_tag = (px, rng) => {
  for (let y = 5; y < 11; y++)
    for (let x = 2; x < 14; x++)
      px(x, y, shade("#d8c8a0", (rng() - 0.5) * 0.12));
  for (let x = 2; x < 14; x++) {
    px(x, 5, "#8a7a52");
    px(x, 10, "#8a7a52");
  }
  px(4, 7, "#5a4a30"); // дырочка
  px(4, 8, "#5a4a30");
  for (let i = 0; i < 4; i++) px(3 - i + 3, 4 - i, "#9a8a60"); // верёвка
};
