// Тайл тотема жизни (registry/items/illager.ts).
import { PAINTERS, type Painter } from "../paint";

export const ILLAGER_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  ILLAGER_TILES.push(name);
};

add("life_totem", (px) => {
  const gold = "#e8c040",
    dark = "#b08a20";
  for (let y = 2; y < 7; y++) for (let x = 5; x < 11; x++) px(x, y, gold); // голова
  px(6, 4, "#2a8a4a");
  px(9, 4, "#2a8a4a"); // изумрудные глаза
  for (let y = 7; y < 13; y++)
    for (let x = 6; x < 10; x++) px(x, y, y % 2 ? dark : gold); // тело
  for (let x = 2; x < 14; x++) if (x < 6 || x > 9) px(x, 8, gold); // руки-крылья
  for (let x = 6; x < 10; x++) px(x, 13, dark);
});
