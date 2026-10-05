// Достижения на экране: всплывашка «Достижение получено!» справа сверху (очередью, если открылось
// несколько сразу) и список всех достижений по клавише L (открытые — отмечены).
import { events } from "../core/EventBus";
import { ACHIEVEMENTS, type Achievements } from "../systems/Achievements";

const TOAST_MS = 3500;

export class AchievementsView {
  private readonly toastEl: HTMLElement;
  private readonly listEl: HTMLElement;
  private readonly queue: string[] = [];
  private busy = false;

  constructor(
    parent: HTMLElement,
    private readonly achievements: Achievements,
  ) {
    this.toastEl = document.createElement("div");
    this.toastEl.id = "achToast";
    this.toastEl.className = "hidden";
    this.listEl = document.createElement("div");
    this.listEl.id = "achList";
    this.listEl.className = "hidden";
    parent.append(this.toastEl, this.listEl);
    events.on("achievement", ({ title }: { title: string }) => {
      this.queue.push(title);
      this._next();
      if (!this.listEl.classList.contains("hidden")) this._render();
    });
    events.on("ui:achievements", () => this.toggle());
  }

  toggle(): void {
    const show = this.listEl.classList.contains("hidden");
    if (show) this._render();
    this.listEl.classList.toggle("hidden", !show);
  }

  private _render(): void {
    const done = this.achievements.done;
    this.listEl.innerHTML = "";
    const h = document.createElement("h3");
    h.textContent = `Достижения ${done.size}/${ACHIEVEMENTS.length} · L — закрыть`;
    this.listEl.appendChild(h);
    for (const a of ACHIEVEMENTS) {
      const row = document.createElement("div");
      row.className = "ach" + (done.has(a.id) ? " done" : "");
      const t = document.createElement("b");
      t.textContent = (done.has(a.id) ? "✔ " : "· ") + a.title;
      const d = document.createElement("span");
      d.textContent = a.desc;
      row.append(t, d);
      this.listEl.appendChild(row);
    }
  }

  private _next(): void {
    if (this.busy) return;
    const title = this.queue.shift();
    if (!title) return;
    this.busy = true;
    this.toastEl.innerHTML = "";
    const head = document.createElement("div");
    head.className = "achHead";
    head.textContent = "Достижение получено!";
    const body = document.createElement("div");
    body.textContent = title;
    this.toastEl.append(head, body);
    this.toastEl.classList.remove("hidden");
    setTimeout(() => {
      this.toastEl.classList.add("hidden");
      this.busy = false;
      setTimeout(() => this._next(), 250);
    }, TOAST_MS);
  }
}
