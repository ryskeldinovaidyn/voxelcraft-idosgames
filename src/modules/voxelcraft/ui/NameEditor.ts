// Ввод имени для бирки: ПКМ биркой по мобу открывает строку (как редактор таблички), Enter даёт
// имя, Esc отменяет. Имя вешает сам моб (Mob.setName), бирка тратится только при удаче.
import { events } from "../core/EventBus";
import type { Game } from "../main";

export class NameEditor {
  open = false;
  readonly root: HTMLDivElement;
  private readonly input: HTMLInputElement;
  private entityId: number | null = null;

  constructor(
    private readonly game: Game,
    signal: AbortSignal,
  ) {
    this.root = document.createElement("div");
    this.root.id = "nameEditor";
    this.root.className = "chat";
    this.input = document.createElement("input");
    this.input.className = "chatInput hidden";
    this.input.maxLength = 24;
    this.input.placeholder = "Имя";
    this.input.autocomplete = "off";
    this.input.spellcheck = false;
    this.root.append(this.input);
    document.getElementById("game")!.parentElement!.appendChild(this.root);

    events.on("ui:nameMob", (p: { entityId: number }) => this.show(p.entityId));
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

  show(entityId: number): void {
    const g = this.game;
    if (this.open || !g.playing || g.invUI.open || g.chat.open) return;
    const m = g.entities.entities.get(entityId);
    if (m?.kind !== "mob" || m.dead) return;
    this.entityId = entityId;
    this.open = true;
    g.input.uiOpen = true; // до releaseLock: иначе выход из захвата поставил бы паузу
    g.input.releaseLock();
    this.root.classList.add("open");
    this.input.classList.remove("hidden");
    this.input.value = m.customName ?? "";
    this.input.focus();
  }

  hide(): void {
    if (!this.open) return;
    this.open = false;
    this.entityId = null;
    this.root.classList.remove("open");
    this.input.classList.add("hidden");
    this.input.blur();
    this.game.input.uiOpen = false;
    // мёртвому мышь не захватываем: иначе на экране смерти нечем нажать «Возродиться»
    if (!this.game.player.dead) this.game.input.requestLock();
  }

  /** Дать мобу имя и потратить бирку. */
  submit(): void {
    const id = this.entityId;
    const name = this.input.value.trim();
    this.hide();
    if (id === null || !name) return;
    const m = this.game.entities.entities.get(id);
    if (m?.kind !== "mob" || m.dead) return;
    m.setName(name);
    if (this.game.player.mode !== "creative")
      this.game.inventory.consumeHeld(1);
    events.emit("mobNamed", { entityId: id, name });
  }

  dispose(): void {
    this.root.remove();
  }
}
