// Сенсорное управление (телефон, планшет): джойстик слева, обзор перетаскиванием справа, кнопки.
// Пишет в те же поля Input, что клавиатура и мышь (keys, dx/dy, leftDown/rightDown, sprintLatch), —
// второго пути ввода нет, поэтому вся игровая логика и агент работают как с клавиатурой.
//
// Жесты зоны обзора — как в Minecraft для телефона: короткий тап — поставить блок / открыть дверь,
// удержание без движения — ломать, перетаскивание — поворот камеры.
import { events } from "../core/EventBus";
import { Intent } from "../core/Intents";
import { SNEAK_KEYS } from "../player/Input";
import type { Game } from "../main";

const LOOK_SENS = 2.2; // «пикселей мыши» на пиксель пальца
const DEAD = 0.28; // мёртвая зона джойстика (доля радиуса)
const SPRINT_AT = 0.93; // джойстик до упора вперёд — бег
const HOLD_MS = 300; // удержание без движения — ломать
const TAP_MOVE = 10; // пикселей: больше — уже поворот, а не тап

/** Нужно ли сенсорное управление: грубый указатель (палец) или ?touch=1 в адресе (проверка). */
export function touchWanted(): boolean {
  try {
    if (new URLSearchParams(location.search).get("touch") === "1") return true;
    return (
      typeof matchMedia === "function" &&
      matchMedia("(pointer: coarse)").matches
    );
  } catch {
    return false;
  }
}

function el(cls: string, text = ""): HTMLDivElement {
  const d = document.createElement("div");
  d.className = cls;
  d.textContent = text;
  return d;
}

export class TouchControls {
  readonly root: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  constructor(
    private readonly game: Game,
    signal: AbortSignal,
  ) {
    this.root = el("touchUi");
    const opts = { signal };

    // ---- зона обзора (правые 60% экрана) ----
    const look = el("tLook");
    let lookId: number | null = null,
      sx = 0,
      sy = 0,
      lx = 0,
      ly = 0,
      t0 = 0,
      moved = false,
      holding = false,
      holdT: ReturnType<typeof setTimeout> | undefined;
    look.addEventListener(
      "pointerdown",
      (e) => {
        if (lookId !== null || !this.ready()) return;
        lookId = e.pointerId;
        look.setPointerCapture(e.pointerId);
        sx = lx = e.clientX;
        sy = ly = e.clientY;
        t0 = performance.now();
        moved = holding = false;
        holdT = this.later(() => {
          if (!moved) {
            holding = true;
            game.input.leftDown = true; // удержание — ломать
          }
        }, HOLD_MS);
      },
      opts,
    );
    look.addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerId !== lookId) return;
        game.input.dx += (e.clientX - lx) * LOOK_SENS;
        game.input.dy += (e.clientY - ly) * LOOK_SENS;
        lx = e.clientX;
        ly = e.clientY;
        if (Math.hypot(e.clientX - sx, e.clientY - sy) > TAP_MOVE) moved = true;
      },
      opts,
    );
    const lookEnd = (e: PointerEvent) => {
      if (e.pointerId !== lookId) return;
      lookId = null;
      clearTimeout(holdT);
      if (holding) game.input.leftDown = false;
      else if (!moved && performance.now() - t0 < HOLD_MS) this.pulseUse();
    };
    look.addEventListener("pointerup", lookEnd, opts);
    look.addEventListener("pointercancel", lookEnd, opts);

    // ---- джойстик ----
    const stick = el("tStick");
    this.knob = el("tKnob");
    stick.append(this.knob);
    let stickId: number | null = null;
    const setDir = (vx: number, vy: number) => {
      const k = game.input.keys;
      const set = (code: string, on: boolean) =>
        on ? k.add(code) : k.delete(code);
      set("KeyW", vy < -DEAD);
      set("KeyS", vy > DEAD);
      set("KeyA", vx < -DEAD);
      set("KeyD", vx > DEAD);
      game.input.sprintLatch = -vy > SPRINT_AT;
      this.knob.style.transform = `translate(${vx * 40}px, ${vy * 40}px)`;
    };
    const stickMove = (e: PointerEvent) => {
      const r = stick.getBoundingClientRect();
      const R = r.width / 2;
      let vx = (e.clientX - (r.left + R)) / R,
        vy = (e.clientY - (r.top + R)) / R;
      const len = Math.hypot(vx, vy);
      if (len > 1) {
        vx /= len;
        vy /= len;
      }
      setDir(vx, vy);
    };
    stick.addEventListener(
      "pointerdown",
      (e) => {
        if (stickId !== null || !this.ready()) return;
        stickId = e.pointerId;
        stick.setPointerCapture(e.pointerId);
        stickMove(e);
      },
      opts,
    );
    stick.addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerId === stickId) stickMove(e);
      },
      opts,
    );
    const stickEnd = (e: PointerEvent) => {
      if (e.pointerId !== stickId) return;
      stickId = null;
      setDir(0, 0);
    };
    stick.addEventListener("pointerup", stickEnd, opts);
    stick.addEventListener("pointercancel", stickEnd, opts);

    // ---- кнопки ----
    let lastJump = 0;
    const hold = (
      cls: string,
      text: string,
      down: () => void,
      up: () => void = () => {},
    ) => {
      const b = el("tBtn " + cls, text);
      b.addEventListener(
        "pointerdown",
        (e) => {
          if (!this.ready()) return;
          b.setPointerCapture(e.pointerId);
          b.classList.add("on");
          down();
        },
        opts,
      );
      const end = () => {
        b.classList.remove("on");
        up();
      };
      b.addEventListener("pointerup", end, opts);
      b.addEventListener("pointercancel", end, opts);
      return b;
    };
    const jump = hold(
      "tJump",
      "⤒",
      () => {
        game.input.keys.add("Space");
        const now = performance.now();
        if (now - lastJump < 300) events.emit("input:doubleSpace"); // полёт в креативе
        lastJump = now;
      },
      () => game.input.keys.delete("Space"),
    );
    const sneak = el("tBtn tSneak", "⇩");
    sneak.addEventListener(
      "pointerdown",
      () => {
        if (!this.ready()) return;
        const k = game.input.keys;
        const on = !k.has(SNEAK_KEYS[0]);
        if (on) k.add(SNEAK_KEYS[0]);
        else k.delete(SNEAK_KEYS[0]);
        sneak.classList.toggle("on", on);
      },
      opts,
    );
    const attack = hold(
      "tAttack",
      "⚒",
      () => (game.input.leftDown = true),
      () => (game.input.leftDown = false),
    );
    const use = hold("tUse", "✋", () => this.pulseUse());
    const inv = hold("tInv", "▦", () => events.emit("ui:toggleInventory"));
    const chat = hold("tChat", "/", () =>
      events.emit("ui:openConsole", { prefix: "/" }),
    );

    // выбросить предмет из руки (как Q)
    const drop = hold("tDrop", "⇣", () =>
      game.intents.push(Intent.DropItem, { all: false }),
    );

    this.root.append(look, stick, jump, sneak, attack, use, inv, chat, drop);
    document.getElementById("game")!.parentElement!.appendChild(this.root);
    document.body.classList.add("touch");
  }

  /** Игра принимает ввод: берём управление (мягкий режим без Pointer Lock), если его ещё нет. */
  private ready(): boolean {
    const g = this.game;
    if (!g.playing || g.input.uiOpen) return false;
    if (!g.input.active) g.input.takeControl();
    return true;
  }

  /** «Нажать ПКМ» на мгновение: Interaction поставит блок или откроет дверь ровно раз. */
  private pulseUse(): void {
    this.game.input.rightDown = true;
    this.later(() => (this.game.input.rightDown = false), 120);
  }

  private later(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
    return t;
  }

  dispose(): void {
    for (const t of this.timers) clearTimeout(t);
    this.root.remove();
    document.body.classList.remove("touch");
  }
}
