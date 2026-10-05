// Тайлы книг: книга с пером (обложка с торчащим пером) и написанная книга с закладкой. Фон не
// красим — незакрашенные пиксели тайла прозрачны, как у прочих плоских иконок.
import { PAINTERS, shade, type PxFn } from "../paint";

export const BOOK_TILES: string[] = ["writable_book", "written_book"];

/** Обложка: тёмный корешок слева, страницы справа. */
const cover = (px: PxFn, hex: string): void => {
  for (let y = 2; y < 15; y++)
    for (let x = 3; x < 13; x++)
      px(x, y, x < 5 ? shade(hex, -0.3) : x > 11 ? "#f0ecd8" : hex);
};

PAINTERS.writable_book = (px) => {
  cover(px, "#a06a4a");
  // перо наискось через обложку
  for (let i = 0; i < 9; i++) px(5 + i, 13 - i, i < 3 ? "#d8d8d8" : "#f4f4f4");
};

PAINTERS.written_book = (px) => {
  cover(px, "#7a4a8a");
  for (let y = 2; y < 16; y++) px(9, y, "#e8c040"); // закладка
};
