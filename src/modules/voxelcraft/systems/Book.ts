// Книги: «Книга с пером» пишется на кафедре, «Подписать» превращает её в написанную книгу с
// названием и автором. Текст страниц живёт в tag стака, поэтому переживает сейв и переезд книги с
// кафедры в инвентарь и обратно. Здесь только чистые функции: экран — ui/BookScreen, кафедра —
// world/blockentities/lectern.
import { wrapText } from "./SignText";
import type { ItemStack } from "../types";

/** Размер страницы и сколько страниц помещается в книгу. */
export const PAGE_COLS = 24;
export const PAGE_LINES = 12;
export const MAX_PAGES = 50;

/** Предмет, который пишут, и предмет, который читают. */
export const WRITABLE = "writable_book";
export const WRITTEN = "written_book";

export interface BookData {
  title: string;
  author: string;
  pages: string[];
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Содержимое книги из стака; не книга или пустой tag — пустая книга с одной страницей. */
export function bookOf(s: ItemStack | null): BookData {
  const tag = s?.tag ?? {};
  const raw = Array.isArray(tag.pages) ? tag.pages : [];
  const pages = raw.slice(0, MAX_PAGES).map(str);
  return {
    title: str(tag.title),
    author: str(tag.author),
    pages: pages.length ? pages : [""],
  };
}

/** Книга это или нет (любая из двух). */
export const isBook = (item: string): boolean =>
  item === WRITABLE || item === WRITTEN;

/** Написанную книгу больше не правят — только читают. */
export const isWritable = (s: ItemStack | null): boolean =>
  s?.item === WRITABLE;

/** Тот же стак с новым текстом страниц (пустые хвостовые страницы отбрасываются). */
export function withPages(s: ItemStack, pages: readonly string[]): ItemStack {
  const kept = pages.slice(0, MAX_PAGES);
  while (kept.length > 1 && !kept[kept.length - 1]!.trim()) kept.pop();
  return { ...s, tag: { ...(s.tag ?? {}), pages: kept } };
}

/**
 * Подписать книгу: «Книга с пером» → написанная книга с названием и автором.
 * null — подписывать нечего (не та книга или пустое название).
 */
export function signBook(
  s: ItemStack | null,
  title: string,
  author: string,
): ItemStack | null {
  if (!isWritable(s) || !title.trim()) return null;
  const { pages } = bookOf(s);
  return {
    item: WRITTEN,
    count: 1,
    tag: { ...(s!.tag ?? {}), pages, title: title.trim().slice(0, 32), author },
  };
}

/** Страница, разложенная по строкам экрана. */
export const pageLines = (text: string): string[] =>
  wrapText(text, PAGE_COLS, PAGE_LINES);

/** Подпись книги в списке: «Название — автор» или «Книга с пером». */
export function bookLabel(s: ItemStack | null): string {
  const { title, author } = bookOf(s);
  if (!title) return "Книга с пером";
  return author ? `${title} — ${author}` : title;
}
