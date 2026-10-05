// Книга с пером и написанная книга: текст страниц живёт в tag (systems/Book), пишут и читают их на
// кафедре (world/blockentities/lectern, ui/BookScreen). Стак — один: у каждой книги свой текст.
import type { ItemDef } from "../../types";
import { addNames } from "../names";
import { item } from "./define";

export const BOOK_ITEMS: ItemDef[] = [
  item({ name: "writable_book", tile: "writable_book", maxStack: 1 }),
  item({ name: "written_book", tile: "written_book", maxStack: 1 }),
];

addNames({
  writable_book: "Книга с пером",
  written_book: "Написанная книга",
});
