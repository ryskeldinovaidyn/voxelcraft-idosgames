// Чат/консоль: T — открыть строку, / — открыть сразу с «/». Строка с «/» уходит командой
// (интент Command → systems/Commands), остальное — реплика в чат (одиночная игра — только эхо).
// Лог показывает последние строки и гаснет сам; открытая консоль показывает всю историю.
import { events } from "../core/EventBus";
import { Intent } from "../core/Intents";
import type { Game } from "../main";

const MAX_LINES = 30;

export class ChatConsole {
  open = false;
  readonly root: HTMLDivElement;
  private readonly logEl: HTMLDivElement;
  private readonly input: HTMLInputElement;

  constructor(
    private readonly game: Game,
    signal: AbortSignal,
  ) {
    this.root = document.createElement("div");
    this.root.id = "chat";
    this.logEl = document.createElement("div");
    this.logEl.className = "chatLog";
    this.input = document.createElement("input");
    this.input.className = "chatInput hidden";
    this.input.maxLength = 256;
    this.input.autocomplete = "off";
    this.input.spellcheck = false;
    this.root.append(this.logEl, this.input);
    document.getElementById("game")!.parentElement!.appendChild(this.root);

    events.on("ui:openConsole", (d?: { prefix?: string }) =>
      this.show(d?.prefix ?? ""),
    );
    events.on("chat", ({ text }: { text: string }) => this.print(text));
    this.input.addEventListener(
      "keydown",
      (e) => {
        // клавиши строки — не игре (Esc не должен ставить паузу, E — открывать инвентарь)
        e.stopPropagation();
        if (e.key === "Enter") this.submit();
        else if (e.key === "Escape") this.hide();
      },
      { signal },
    );
  }

  show(prefix = ""): void {
    const g = this.game;
    if (this.open || !g.playing || g.invUI.open) return;
    this.open = true;
    g.input.uiOpen = true; // до releaseLock: иначе выход из захвата поставил бы паузу
    g.input.releaseLock();
    this.root.classList.add("open");
    this.input.classList.remove("hidden");
    this.input.value = prefix;
    this.input.focus();
  }

  hide(): void {
    if (!this.open) return;
    this.open = false;
    this.root.classList.remove("open");
    this.input.classList.add("hidden");
    this.input.blur();
    this.game.input.uiOpen = false;
    // мёртвому мышь не захватываем: иначе на экране смерти нечем нажать «Возродиться»
    if (!this.game.player.dead) this.game.input.requestLock();
  }

  private submit(): void {
    const text = this.input.value.trim();
    this.hide();
    if (!text) return;
    if (text.startsWith("/")) this.game.intents.push(Intent.Command, { text });
    else if (this.game.net)
      this.game.net.sendChat(text); // сетевая игра: реплика — всем
    else this.print("<Вы> " + text);
  }

  print(text: string): void {
    const line = document.createElement("div");
    line.className = "chatLine";
    line.textContent = text;
    this.logEl.appendChild(line);
    while (this.logEl.children.length > MAX_LINES)
      this.logEl.firstElementChild!.remove();
  }

  dispose(): void {
    this.root.remove();
  }
}
