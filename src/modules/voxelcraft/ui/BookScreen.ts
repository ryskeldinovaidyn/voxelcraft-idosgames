// Книга на кафедре: ПКМ кладёт книгу из руки, открывает её на правку («Книга с пером») или на
// чтение (написанная). Правка — по страницам, «Подписать» превращает книгу в написанную.
// Чистая часть (страницы, подпись, перенос строк) — systems/Book; хранение — блочная сущность
// lectern. Экран устроен как редактор таблички: ввод забирает клавиши у игры и отпускает захват.
import { events } from "../core/EventBus";
import {
  MAX_PAGES,
  bookOf,
  isBook,
  isWritable,
  pageLines,
  signBook,
  withPages,
} from "../systems/Book";
import type { LecternState } from "../world/blockentities/lectern";
import type { ItemStack } from "../types";
import type { Game } from "../main";

type At = { x: number; y: number; z: number };

export class BookScreen {
  open = false;
  readonly root: HTMLDivElement;
  private readonly titleEl: HTMLDivElement;
  private readonly pageEl: HTMLDivElement;
  private readonly editEl: HTMLTextAreaElement;
  private readonly countEl: HTMLDivElement;
  private readonly signRow: HTMLDivElement;
  private readonly titleInput: HTMLInputElement;
  private at: At | null = null;
  private page = 0;

  constructor(
    private readonly game: Game,
    signal: AbortSignal,
  ) {
    this.root = document.createElement("div");
    this.root.id = "bookScreen";
    this.root.className = "bookScreen hidden";

    this.titleEl = this._div(this.root, "bookTitle");
    this.pageEl = this._div(this.root, "bookPage");
    this.editEl = document.createElement("textarea");
    this.editEl.className = "bookEdit hidden";
    this.editEl.maxLength = 900;
    this.editEl.spellcheck = false;
    this.root.appendChild(this.editEl);

    const nav = this._div(this.root, "bookNav");
    this._button(nav, "◀", () => this._turn(-1));
    this.countEl = this._div(nav, "bookCount");
    this._button(nav, "▶", () => this._turn(1));

    this.signRow = this._div(this.root, "bookNav");
    this.titleInput = document.createElement("input");
    this.titleInput.className = "bookTitleInput";
    this.titleInput.placeholder = "Название";
    this.titleInput.maxLength = 32;
    this.signRow.appendChild(this.titleInput);
    this._button(this.signRow, "Подписать", () => this._sign());

    const foot = this._div(this.root, "bookNav");
    this._button(foot, "Забрать", () => this._take());
    this._button(foot, "Закрыть", () => this.hide());

    document.getElementById("game")!.parentElement!.appendChild(this.root);

    events.on("ui:openLectern", (p: At) => this.show(p));
    for (const el of [this.editEl, this.titleInput] as HTMLElement[])
      el.addEventListener(
        "keydown",
        (e: KeyboardEvent) => {
          e.stopPropagation(); // клавиши ввода — не игре
          if (e.key === "Escape") this.hide();
        },
        { signal },
      );
  }

  private _div(parent: HTMLElement, cls: string): HTMLDivElement {
    const d = document.createElement("div");
    d.className = cls;
    parent.appendChild(d);
    return d;
  }

  private _button(parent: HTMLElement, text: string, fn: () => void): void {
    const b = document.createElement("div");
    b.className = "bookBtn";
    b.textContent = text;
    b.onmousedown = (e) => {
      e.preventDefault();
      fn();
    };
    parent.appendChild(b);
  }

  /** Книга, лежащая на кафедре. */
  private _book(): ItemStack | null {
    const at = this.at;
    if (!at) return null;
    const be = this.game.blockEntities.ensure(at.x, at.y, at.z);
    return be?.type === "lectern"
      ? ((be.state as LecternState).items[0] ?? null)
      : null;
  }

  private _setBook(s: ItemStack | null): void {
    const at = this.at;
    if (!at) return;
    const be = this.game.blockEntities.ensure(at.x, at.y, at.z);
    if (be?.type === "lectern") (be.state as LecternState).items[0] = s;
  }

  show(p: At): void {
    const g = this.game;
    if (this.open || !g.playing || g.invUI.open || g.chat.open) return;
    const be = g.blockEntities.ensure(p.x, p.y, p.z);
    if (be?.type !== "lectern") return;
    this.at = p;
    // кафедра пуста, а в руке книга — она ложится на кафедру, как в Minecraft
    const st = be.state as LecternState;
    const held = g.inventory.heldItem();
    if (!st.items[0] && held && isBook(held.item)) {
      st.items[0] = { ...held, count: 1 };
      g.inventory.consumeHeld(1);
      events.emit("bookPlaced", { ...p, item: held.item });
    }
    if (!st.items[0]) {
      this.at = null;
      return; // класть нечего и читать нечего
    }
    this.open = true;
    this.page = 0;
    g.input.uiOpen = true; // до releaseLock: иначе выход из захвата поставил бы паузу
    g.input.releaseLock();
    this.root.classList.remove("hidden");
    this._render();
  }

  hide(): void {
    if (!this.open) return;
    this._save();
    this.open = false;
    this.at = null;
    this.root.classList.add("hidden");
    this.editEl.blur();
    this.titleInput.blur();
    this.game.input.uiOpen = false;
    // мёртвому мышь не захватываем: иначе на экране смерти нечем нажать «Возродиться»
    if (!this.game.player.dead) this.game.input.requestLock();
  }

  /** Записать набранную страницу в книгу (правится только «книга с пером»). */
  private _save(): void {
    const book = this._book();
    if (!book || !isWritable(book)) return;
    const pages = bookOf(book).pages.slice();
    while (pages.length <= this.page) pages.push("");
    pages[this.page] = this.editEl.value;
    this._setBook(withPages(book, pages));
  }

  private _turn(d: number): void {
    this._save();
    const book = this._book();
    if (!book) return;
    const pages = bookOf(book).pages;
    const last = isWritable(book)
      ? Math.min(pages.length, MAX_PAGES - 1) // у книги с пером можно завести следующую
      : pages.length - 1;
    this.page = Math.max(0, Math.min(last, this.page + d));
    this._render();
  }

  /** Подписать: книга с пером становится написанной и больше не правится. */
  private _sign(): void {
    this._save();
    const signed = signBook(this._book(), this.titleInput.value, "Игрок");
    if (!signed) return;
    this._setBook(signed);
    this.titleInput.value = "";
    this.page = 0;
    events.emit("bookSigned", { title: signed.tag!.title as string });
    this._render();
  }

  /** Забрать книгу с кафедры в инвентарь. */
  private _take(): void {
    this._save();
    const book = this._book();
    if (!book) return this.hide();
    this._setBook(null);
    const p = this.game.player.pos;
    if (this.game.inventory.addStack(book) > 0)
      this.game.entities.spawnDrop(
        p.x,
        p.y + 1,
        p.z,
        book.item,
        1,
        undefined,
        book.tag,
      );
    this.hide();
  }

  private _render(): void {
    const book = this._book();
    if (!book) return this.hide();
    const { title, author, pages } = bookOf(book);
    const writable = isWritable(book);
    this.titleEl.textContent = writable
      ? "Книга с пером"
      : title + (author ? ` — ${author}` : "");
    this.countEl.textContent = `${this.page + 1} / ${Math.max(pages.length, this.page + 1)}`;
    this.signRow.classList.toggle("hidden", !writable);
    this.editEl.classList.toggle("hidden", !writable);
    this.pageEl.classList.toggle("hidden", writable);
    if (writable) {
      this.editEl.value = pages[this.page] ?? "";
      this.editEl.focus();
    } else {
      this.pageEl.textContent = "";
      for (const line of pageLines(pages[this.page] ?? "")) {
        const d = document.createElement("div");
        d.textContent = line;
        this.pageEl.appendChild(d);
      }
    }
  }

  dispose(): void {
    this.root.remove();
  }
}
