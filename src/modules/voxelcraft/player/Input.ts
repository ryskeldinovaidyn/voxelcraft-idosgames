// Ввод: Pointer Lock, клавиши, мышь. НИКОГДА не трогает мир напрямую —
// дискретные действия уходят интентами в очередь, непрерывные состояния
// (WASD, зажатые кнопки мыши, взгляд) читает Player/Interaction на кадре.
import { events } from "../core/EventBus";
import { Intent, type IntentQueue } from "../core/Intents";

/** Присед (и спуск в полёте): Ctrl. Сенсорная кнопка «присесть» жмёт первую из них. */
export const SNEAK_KEYS = ["ControlLeft", "ControlRight"] as const;
/** Бег: Shift (и двойное нажатие W). */
export const RUN_KEYS = ["ShiftLeft", "ShiftRight"] as const;

/**
 * Клавиатура слушается на всём document, а игра живёт в хосте рядом с чужими модулями: набор
 * текста в их полях (чат, форма) не должен открывать инвентарь или переключать слоты.
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

export class Input {
  canvas: HTMLCanvasElement;
  intents: IntentQueue;
  keys: Set<string>;
  leftDown: boolean;
  rightDown: boolean;
  dx: number;
  dy: number;
  locked: boolean;
  uiOpen: boolean;
  _lastSpace: number;
  /** Двойной W — бег до отпускания W. */
  sprintLatch = false;
  _lastW = 0;

  /**
   * Управление без захвата указателя.
   *
   * Pointer Lock есть не везде: в кросс-доменном iframe (превью AI-кодера, встраивание игры на
   * сайте) браузер его запрещает. Раньше это означало, что играть НЕЛЬЗЯ ВООБЩЕ — весь ввод был
   * закрыт проверкой `locked`, а `locked` без API никогда не становился true: игра шла, а клавиши
   * и мышь молчали.
   *
   * Поэтому здесь тот же режим, но своими силами: клик по канвасу «берёт управление»
   * (`softLocked`), Esc отпускает. Мышь двигает камеру без захвата — курсор при этом виден и
   * может уйти за пределы канваса, зато играть можно.
   */
  softLocked: boolean;

  /**
   * Слушает ли игра клавиатуру вообще. Выключается, когда роутер режимов хоста приостанавливает
   * сцену (`Game.setRunning(false)`): обработчики висят на document, и без этого `E` открывал бы
   * инвентарь невидимой игры, пока игрок в другом модуле.
   */
  enabled: boolean;

  /** Есть ли в этом окружении настоящий Pointer Lock. Если да — мягкий режим не нужен. */
  readonly pointerLockAvailable: boolean;

  /** @param signal снимает все подписки разом в `Game.destroy()` */
  constructor(
    canvas: HTMLCanvasElement,
    intents: IntentQueue,
    signal: AbortSignal,
  ) {
    this.canvas = canvas;
    this.intents = intents;
    this.keys = new Set(); // KeyboardEvent.code
    this.leftDown = false;
    this.rightDown = false;
    this.dx = 0;
    this.dy = 0; // накопленное движение мыши за кадр
    this.locked = false;
    this.uiOpen = false; // инвентарь открыт — игровой ввод заморожен
    this._lastSpace = 0; // двойной Space → полёт в креативе
    this.softLocked = false;
    this.enabled = true;
    this.pointerLockAvailable =
      typeof canvas.requestPointerLock === "function" &&
      typeof document.exitPointerLock === "function";
    const opts = { signal };

    document.addEventListener(
      "pointerlockchange",
      () => {
        this.locked = document.pointerLockElement === canvas;
        if (!this.locked && !this.uiOpen) events.emit("ui:pause");
        if (this.locked) events.emit("ui:resume");
        this.keys.clear();
        this.leftDown = this.rightDown = false;
      },
      opts,
    );

    canvas.addEventListener(
      "mousemove",
      (e) => {
        if (!this.active) return;
        // Без захвата курсор реальный: он может уйти с канваса и вернуться, и тогда браузер отдаёт
        // одну гигантскую дельту — камера дёрнулась бы на пол-оборота. Рывки отбрасываем.
        if (
          !this.locked &&
          (Math.abs(e.movementX) > 120 || Math.abs(e.movementY) > 120)
        )
          return;
        this.dx += e.movementX;
        this.dy += e.movementY;
      },
      opts,
    );

    canvas.addEventListener(
      "mousedown",
      (e) => {
        // Первый клик по канвасу в мягком режиме — это «взять управление», а не удар киркой.
        if (!this.locked && !this.softLocked && !this.uiOpen) {
          this.takeControl();
          return;
        }
        if (!this.active) return;
        if (e.button === 0) this.leftDown = true;
        if (e.button === 2) this.rightDown = true;
        if (e.button === 1) {
          e.preventDefault(); // без автопрокрутки браузера
          this.intents.push(Intent.PickBlock);
        }
      },
      opts,
    );
    // Отпускание — на window, а не на канвасе: без захвата курсор может уйти с канваса, и
    // отпущенная там кнопка до канваса не дошла бы — ломание/атака шли бы бесконечно.
    window.addEventListener(
      "mouseup",
      (e) => {
        if (e.button === 0) this.leftDown = false;
        if (e.button === 2) this.rightDown = false;
      },
      opts,
    );
    canvas.addEventListener("contextmenu", (e) => e.preventDefault(), opts);

    canvas.addEventListener(
      "wheel",
      (e) => {
        if (!this.active) return;
        this.intents.push(Intent.SelectSlot, { delta: Math.sign(e.deltaY) });
        e.preventDefault();
      },
      { passive: false, signal },
    );

    document.addEventListener(
      "keydown",
      (e) => {
        if (e.repeat || !this.enabled || isEditableTarget(e.target)) return;
        // E работает и без pointer lock (закрыть инвентарь)
        if (e.code === "KeyE") {
          events.emit("ui:toggleInventory");
          return;
        }
        // Esc в мягком режиме играет роль выхода из захвата: браузер сам его не отдаст.
        if (e.code === "Escape" && this.softLocked) {
          this.releaseControl();
          return;
        }
        if (!this.active) return;
        // Ctrl — присед: его сочетания браузера (Ctrl+S, Ctrl+D, Ctrl+F…) в игре гасим. Ctrl+W,
        // Ctrl+T, Ctrl+N браузер отменить не даёт — от них защита beforeunload ниже.
        if (e.ctrlKey) e.preventDefault();
        this.keys.add(e.code);
        if (e.code === "KeyW") {
          const now = performance.now();
          if (now - this._lastW < 300) this.sprintLatch = true;
          this._lastW = now;
        }
        if (e.code.startsWith("Digit")) {
          const n = +e.code.slice(5);
          if (n >= 1 && n <= 9)
            this.intents.push(Intent.SelectSlot, { slot: n - 1 });
        }
        if (e.code === "KeyC") this.intents.push(Intent.ToggleMode);
        // L — список достижений, как в Minecraft
        if (e.code === "KeyL") events.emit("ui:achievements");
        // Q — выбросить предмет из руки (с Ctrl — весь стак), как в Minecraft
        if (e.code === "KeyQ")
          this.intents.push(Intent.DropItem, { all: e.ctrlKey });
        // чат/консоль: символ клавиши не должен попасть в строку — гасим его
        if (e.code === "KeyT" || e.code === "Slash") {
          e.preventDefault();
          this.keys.delete(e.code);
          events.emit("ui:openConsole", {
            prefix: e.code === "Slash" ? "/" : "",
          });
        }
        if (e.code === "Space") {
          const now = performance.now();
          if (now - this._lastSpace < 300) events.emit("input:doubleSpace");
          this._lastSpace = now;
        }
      },
      opts,
    );
    document.addEventListener(
      "keyup",
      (e) => {
        this.keys.delete(e.code);
        if (e.code === "KeyW") this.sprintLatch = false;
      },
      opts,
    );
    // Присед на Ctrl: «присесть и идти» = Ctrl+W, а это браузер закрывает вкладку, и отменить его
    // игра не может. Пока идёт игра (ввод захвачен и окно в фокусе), браузер спросит «Покинуть
    // сайт?» вместо молчаливого закрытия. Без фокуса — нет: превью AI-кодера перезагружает фрейм,
    // пока издатель пишет в чат рядом, и вопрос там только мешал бы.
    window.addEventListener(
      "beforeunload",
      (e) => {
        if (!this.active || !document.hasFocus()) return;
        e.preventDefault();
        e.returnValue = "";
      },
      opts,
    );
    // Окно потеряло фокус (alt-tab, клик в другой фрейм): keyup/mouseup сюда уже не придут —
    // без сброса персонаж шёл бы сам и ломал блоки дальше.
    window.addEventListener(
      "blur",
      () => {
        this.keys.clear();
        this.leftDown = this.rightDown = false;
      },
      opts,
    );
  }

  /** Читает ли игра ввод прямо сейчас: настоящий захват ИЛИ мягкий режим. */
  get active(): boolean {
    return (this.locked || this.softLocked) && !this.uiOpen;
  }

  /** Взять управление без Pointer Lock (мягкий режим) и снять паузу. */
  takeControl(): void {
    if (this.softLocked) return;
    this.softLocked = true;
    this.keys.clear();
    this.leftDown = this.rightDown = false;
    this.dx = this.dy = 0;
    events.emit("ui:resume");
  }

  /** Отпустить управление в мягком режиме — аналог выхода из захвата по Esc. */
  releaseControl(): void {
    if (!this.softLocked) return;
    this.softLocked = false;
    this.keys.clear();
    this.leftDown = this.rightDown = false;
    if (!this.uiOpen) events.emit("ui:pause");
  }

  /** Захват мыши — только из user gesture (клик по оверлею). */
  requestLock(): void {
    // Там, где Pointer Lock запрещён (кросс-доменный iframe: превью AI-кодера, встраивание игры
    // на сайте), играем без него. Раньше здесь был тихий `return` — и игра оставалась
    // неуправляемой навсегда: `locked` без API не становится true никогда.
    if (!this.pointerLockAvailable) {
      this.takeControl();
      return;
    }
    try {
      // Браузер может бросить, если Esc был нажат <1.2 c назад — тихо игнорируем.
      this.canvas.requestPointerLock()?.catch?.(() => {
        // Обещание отклонено (нет user gesture, политика фрейма) — не оставляем игрока без
        // управления, а переходим в мягкий режим.
        this.takeControl();
      });
    } catch {
      this.takeControl();
    }
  }
  releaseLock(): void {
    if (this.locked && typeof document.exitPointerLock === "function") {
      document.exitPointerLock();
    }
    this.releaseControl();
  }

  /** Забрать накопленную дельту мыши (вызывается раз в кадр). */
  consumeMouse(): { dx: number; dy: number } {
    const d = { dx: this.dx, dy: this.dy };
    this.dx = this.dy = 0;
    return d;
  }

  get forward(): boolean {
    return this.keys.has("KeyW");
  }
  get back(): boolean {
    return this.keys.has("KeyS");
  }
  get left(): boolean {
    return this.keys.has("KeyA");
  }
  get right(): boolean {
    return this.keys.has("KeyD");
  }
  get jump(): boolean {
    return this.keys.has("Space");
  }
  /** Ctrl: присесть; в полёте — вниз (решение владельца 27.09.2026: наоборот, чем в Minecraft). */
  get sneakOrDown(): boolean {
    return SNEAK_KEYS.some((k) => this.keys.has(k));
  }
  get sneak(): boolean {
    return this.sneakOrDown;
  }
  /** Бег — Shift или двойное нажатие W (держится, пока W зажата). */
  get run(): boolean {
    return this.sprintLatch || RUN_KEYS.some((k) => this.keys.has(k));
  }
}
