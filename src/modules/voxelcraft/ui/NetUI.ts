// Сетевая игра внутри VoxelCraft: игроки мира (права оператора, исключение, бан, выход) и список по
// Tab во время игры. Комнаты — НЕ здесь: их список, создание и вход по приглашению живут в лобби
// (система мультиплеера, ctx.multiplayer), одинаковые для всех игр. Кнопка паузы «Играть с друзьями»
// открывает в лобби «Создать комнату» с этой игрой. Чистый DOM, как остальной HUD.
import { events } from "../core/EventBus";
import type { Game } from "../main";

/** Тексты движка и сетевого кода → понятные игроку (текст сервера дословно не показываем). */
export function friendlyNetError(err: string): string {
  const e = err || "";
  if (/removed from this room/i.test(e)) return "Вас исключили из этой игры";
  if (/not found|no longer exists/i.test(e))
    return "Игра не найдена или уже закрыта";
  if (/closed/i.test(e)) return "Игра закрыта";
  if (/Версии|обновите/i.test(e)) return e;
  if (/хост/i.test(e)) return e;
  return "Не получилось. Попробуйте ещё раз";
}

const DIM_NAMES: Record<string, string> = {
  overworld: "Верхний мир",
  inferno: "Пекло",
  beyond: "Предел",
};

export class NetUI {
  open = false;
  private readonly root: HTMLDivElement;
  private readonly tabList: HTMLDivElement;
  private busy = false;
  private readonly button: HTMLButtonElement | null = null;

  constructor(
    private readonly game: Game,
    signal: AbortSignal,
  ) {
    this.root = document.createElement("div");
    this.root.id = "netScreen";
    this.root.className = "hidden";
    this.root.innerHTML = `
      <div class="wsPanel">
        <div class="wsHead">
          <button class="wsTab active">Игроки</button>
          <button class="wsClose" data-act="close" title="Закрыть (Esc)">&times;</button>
        </div>
        <div class="wsBody">
          <div class="wsForm">
            <div class="wsList" data-f="players"></div>
            <div class="wsButtons"><button data-act="leave">Выйти из сетевой игры</button></div>
            <div class="wsStatus" data-f="playersStatus"></div>
          </div>
        </div>
      </div>`;
    this.tabList = document.createElement("div");
    this.tabList.id = "netTabList";
    this.tabList.className = "hidden";
    const host = document.getElementById("game")!.parentElement!;
    host.append(this.root, this.tabList);

    // Кнопка в меню паузы — только если в приложении есть система мультиплеера.
    const buttons = document.querySelector("#overlay .buttons");
    if (buttons && game.online?.available()) {
      const b = document.createElement("button");
      b.id = "btnNet";
      b.addEventListener(
        "click",
        () => (game.net ? this.show() : game.online?.openForFriends()),
        { signal },
      );
      buttons.prepend(b);
      this.button = b;
      this.syncButton();
    }

    this.root.addEventListener(
      "click",
      (e) => {
        const el = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
        if (el) void this.action(el.dataset.act ?? "", el);
      },
      { signal },
    );
    document.addEventListener(
      "keydown",
      (e) => {
        if (this.open && e.code === "Escape") this.hide();
        if (e.code === "Tab" && game.net && game.playing && !this.open) {
          e.preventDefault();
          this.renderTabList();
          this.tabList.classList.remove("hidden");
        }
      },
      { signal },
    );
    document.addEventListener(
      "keyup",
      (e) => {
        if (e.code === "Tab") this.tabList.classList.add("hidden");
      },
      { signal },
    );
    events.on("net:roster", () => {
      this.syncButton();
      if (this.open) this.renderPlayers();
      if (!this.tabList.classList.contains("hidden")) this.renderTabList();
    });
  }

  /** «Играть с друзьями» вне сетевой игры, «Игроки» — в ней. */
  private syncButton(): void {
    if (this.button)
      this.button.textContent = this.game.net ? "Игроки" : "Играть с друзьями";
  }

  private $(f: string): HTMLElement {
    return this.root.querySelector(`[data-f="${f}"]`)!;
  }

  show(): void {
    if (!this.game.net) return;
    this.open = true;
    this.game.input.uiOpen = true;
    this.game.input.releaseLock();
    this.root.classList.remove("hidden");
    this.status("");
    this.renderPlayers();
  }

  hide(): void {
    if (!this.open) return;
    this.open = false;
    this.game.input.uiOpen = false;
    this.root.classList.add("hidden");
  }

  private status(text: string, error = false): void {
    const el = this.$("playersStatus");
    el.textContent = text;
    el.classList.toggle("error", error);
  }

  private async action(act: string, el: HTMLElement): Promise<void> {
    const g = this.game;
    if (act === "close") return this.hide();
    if (this.busy) return;
    this.busy = true;
    try {
      if (act === "leave") {
        await g.net?.leave();
        this.hide();
      } else if (act === "op" || act === "deop")
        g.net?.setOp(el.dataset.user ?? "", act === "op");
      else if (act === "kick" || act === "ban") {
        const err = await g.net?.kick(el.dataset.user ?? "", act === "ban");
        this.status(
          err
            ? friendlyNetError(err)
            : act === "ban"
              ? "Игрок исключён навсегда"
              : "Игрок исключён",
          !!err,
        );
      }
    } finally {
      this.busy = false;
    }
  }

  private renderPlayers(): void {
    const net = this.game.net;
    const list = this.$("players");
    list.textContent = "";
    if (!net) {
      list.textContent = "Вы не в сетевой игре";
      return;
    }
    for (const p of net.playerList()) {
      const item = document.createElement("div");
      item.className = "wsItem";
      const info = document.createElement("div");
      const name = document.createElement("div");
      name.className = "wsItemName";
      name.textContent =
        p.name +
        (p.userId === net.selfId ? " (вы)" : "") +
        (p.host ? " — хост" : p.op ? " — оператор" : "");
      const meta = document.createElement("div");
      meta.className = "wsItemMeta";
      meta.textContent = DIM_NAMES[p.dim] ?? p.dim;
      info.append(name, meta);
      item.appendChild(info);
      if (net.isHost && p.userId !== net.selfId) {
        const mk = (act: string, text: string) => {
          const b = document.createElement("button");
          b.dataset.act = act;
          b.dataset.user = p.userId;
          b.textContent = text;
          return b;
        };
        item.append(
          p.op ? mk("deop", "Снять оператора") : mk("op", "Сделать оператором"),
          mk("kick", "Исключить"),
          mk("ban", "Бан"),
        );
      }
      list.appendChild(item);
    }
  }

  private renderTabList(): void {
    const net = this.game.net;
    this.tabList.textContent = "";
    if (!net) return;
    for (const p of net.playerList()) {
      const row = document.createElement("div");
      row.className = "netTabRow";
      const n = document.createElement("span");
      n.textContent = (p.host ? "★ " : p.op ? "☆ " : "") + p.name;
      const r = document.createElement("span");
      r.className = "netTabPing";
      r.textContent =
        p.userId === net.selfId ? "" : p.rtt ? `${p.rtt} мс` : "…";
      row.append(n, r);
      this.tabList.appendChild(row);
    }
  }

  dispose(): void {
    this.root.remove();
    this.tabList.remove();
    document.getElementById("btnNet")?.remove();
  }
}
