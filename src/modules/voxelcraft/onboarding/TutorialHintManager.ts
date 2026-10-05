export type TutorialLayer = "critical" | "contextual" | "discovery";

interface Hint {
  key: string;
  text: string;
  layer: TutorialLayer;
  priority: number;
  duration: number;
}

/** Один небольшой HUD toast, очередь с приоритетом и паузой между сообщениями. */
export class TutorialHintManager {
  private readonly el: HTMLElement;
  private readonly queue: Hint[] = [];
  private active: Hint | null = null;
  private readonly shown = new Set<string>();
  private now = 0;
  private until = 0;
  private lastEnd = -100;
  readonly minGap = 3;

  constructor() {
    this.el = document.getElementById("tutorialHint")!;
  }

  offer(key: string, text: string, priority = 1, duration = 6, layer: TutorialLayer = "critical") {
    if (layer === "discovery" || this.shown.has(key) || this.active?.key === key || this.queue.some((h) => h.key === key)) return;
    this.queue.push({ key, text, priority, duration, layer });
    this.queue.sort((a, b) => b.priority - a.priority);
  }

  cancel(key: string) {
    for (let i = this.queue.length - 1; i >= 0; i--)
      if (this.queue[i]!.key === key) this.queue.splice(i, 1);
    if (this.active?.key === key) this.hide();
  }

  clear() {
    this.queue.length = 0;
    this.shown.clear();
    this.hide();
  }

  tick(dt: number, busy: boolean, inCombat: boolean) {
    this.now += dt;
    if (this.active && (this.now >= this.until || (busy && this.active.key !== "combat") || (inCombat && this.active.key !== "combat"))) this.hide();
    if (this.active || busy || this.now - this.lastEnd < this.minGap) return;
    const index = this.queue.findIndex((h) => !inCombat || h.key === "combat");
    if (index < 0) return;
    const hint = this.queue.splice(index, 1)[0]!;
    this.active = hint;
    this.shown.add(hint.key);
    this.until = this.now + hint.duration;
    this.el.textContent = hint.text;
    this.el.classList.add("show");
  }

  private hide() {
    if (!this.active) return;
    this.active = null;
    this.lastEnd = this.now;
    this.el.classList.remove("show");
  }

  status() {
    return { current: this.active?.key ?? null, queue: this.queue.map((h) => h.key), shown: [...this.shown] };
  }

  dispose() { this.clear(); }
}
