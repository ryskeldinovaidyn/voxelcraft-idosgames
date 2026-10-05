// Ввод текста таблички: ПКМ по табличке открывает строку (как консоль чата), Enter сохраняет,
// Esc отменяет. Разбивку по строкам делает systems/SignText, показ в мире — gfx/SignText.
import { events } from "../core/EventBus";
import { wrapSignText } from "../systems/SignText";
import type { SignState } from "../world/blockentities/sign";
import type { Game } from "../main";

export class SignEditor {
  open = false;
  readonly root: HTMLDivElement;
  private readonly input: HTMLInputElement;
  private at: { x: number; y: number; z: number } | null = null;

  constructor(
    private readonly game: Game,
    signal: AbortSignal,
  ) {
    this.root = document.createElement("div");
    this.root.id = "signEditor";
    this.root.className = "chat";
    this.input = document.createElement("input");
    this.input.className = "chatInput hidden";
    this.input.maxLength = 96;
    this.input.autocomplete = "off";
    this.input.spellcheck = false;
    this.root.append(this.input);
    document.getElementById("game")!.parentElement!.appendChild(this.root);

    events.on("ui:openSign", (p: { x: number; y: number; z: number }) =>
      this.show(p),
    );
    this.input.addEventListener(
      "keydown",
      (e) => {
        e.stopPropagation(); // клавиши строки — не игре
        if (e.key === "Enter") this.submit();
        else if (e.key === "Escape") this.hide();
      },
      { signal },
    );
  }

  show(p: { x: number; y: number; z: number }): void {
    const g = this.game;
    if (this.open || !g.playing || g.invUI.open || g.chat.open) return;
    const be = g.blockEntities.get(p.x, p.y, p.z);
    if (be?.type !== "sign") return;
    this.at = p;
    this.open = true;
    g.input.uiOpen = true; // до releaseLock: иначе выход из захвата поставил бы паузу
    g.input.releaseLock();
    this.root.classList.add("open");
    this.input.classList.remove("hidden");
    this.input.value = (be.state as SignState).lines.join(" ");
    this.input.focus();
  }

  hide(): void {
    if (!this.open) return;
    this.open = false;
    this.at = null;
    this.root.classList.remove("open");
    this.input.classList.add("hidden");
    this.input.blur();
    this.game.input.uiOpen = false;
    // мёртвому мышь не захватываем: иначе на экране смерти нечем нажать «Возродиться»
    if (!this.game.player.dead) this.game.input.requestLock();
  }

  /** Сохранить набранное в табличку. */
  submit(): void {
    const at = this.at;
    const text = this.input.value;
    this.hide();
    if (!at) return;
    const be = this.game.blockEntities.get(at.x, at.y, at.z);
    if (be?.type !== "sign") return;
    (be.state as SignState).lines = wrapSignText(text);
    events.emit("signEdited", { ...at, text });
  }

  dispose(): void {
    this.root.remove();
  }
}
