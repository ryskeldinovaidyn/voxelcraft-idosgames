// Игровой цикл: rAF-рендер + аккумулятор фиксированного тика (20 TPS).
// Симуляция (мир, мобы, вода, интенты) — на тике; всё, что касается глаза и руки
// (камера, физика игрока, интерполяция, рендер) — на кадре.
import { CONFIG } from "../config";

export class GameLoop {
  onTick: (dt: number, n: number) => void;
  onFrame: (dt: number, alpha: number) => void;
  tickDt: number;
  acc: number;
  tickN: number;
  last: number;
  running: boolean;
  fps: number;
  /**
   * Сколько кадров отработано. Агент ждёт по нему, что нажатие увидел хотя бы один кадр: при
   * страховочном таймере (200 мс) короткий «клик» иначе проскакивал между кадрами.
   */
  frameN = 0;
  private _frames: number;
  private _fpsTime: number;
  /** id запланированного кадра: stop() обязан его отменить, см. там. */
  private _raf = 0;
  /**
   * Таймер шага для скрытой страницы. В фоне (свёрнутое превью AI-кодера, фоновая вкладка) браузер
   * не зовёт requestAnimationFrame вовсе — симуляция вставала, и действия агента (команды, ходьба)
   * висели до возврата на вкладку. Скрытая страница шагает таймером; браузер его душит до ~1 Гц,
   * но тики (maxCatchupTicks за шаг) идут.
   */
  private _timer: ReturnType<typeof setTimeout> | undefined;
  /**
   * Сетевая игра: мир общий, и скрытая вкладка хоста или владельца измерения не может считать его
   * раз в секунду (браузер душит таймеры фоновой страницы до ~1 Гц, а тиков за шаг не больше
   * maxCatchupTicks — мир у ВСЕХ шёл бы вчетверо медленнее). Таймеры выделенного воркера так не
   * душатся: в фоне шаг задаёт его сообщение раз в 50 мс. Подключает Game, пока идёт сетевая игра.
   */
  backgroundTicker: (() => boolean) | null = null;
  private _worker: Worker | null = null;
  private _workerUrl: string | null = null;
  private _workerStep: (() => void) | null = null;

  /**
   * @param onTick   — фиксированный шаг, dt = 1/TPS
   * @param onFrame — alpha = доля тика для интерполяции
   */
  constructor(
    onTick: (dt: number, n: number) => void,
    onFrame: (dt: number, alpha: number) => void,
  ) {
    this.onTick = onTick;
    this.onFrame = onFrame;
    this.tickDt = 1 / CONFIG.tps;
    this.acc = 0;
    this.tickN = 0;
    this.last = 0;
    this.running = false;
    // FPS: скользящее окно за секунду
    this.fps = 0;
    this._frames = 0;
    this._fpsTime = 0;
  }

  start() {
    this.running = true;
    this.last = performance.now();
    const step = (now: number) => {
      if (!this.running) return;
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.25) dt = 0.25; // возврат из фона — не наращивать гигантский долг

      this.acc += dt;
      let ticks = 0;
      while (this.acc >= this.tickDt && ticks < CONFIG.maxCatchupTicks) {
        this.onTick(this.tickDt, this.tickN++);
        this.acc -= this.tickDt;
        ticks++;
      }
      if (ticks === CONFIG.maxCatchupTicks) this.acc = 0; // сбросить долг

      this._frames++;
      this.frameN++;
      this._fpsTime += dt;
      if (this._fpsTime >= 0.5) {
        this.fps = Math.round(this._frames / this._fpsTime);
        this._frames = 0;
        this._fpsTime = 0;
      }

      this.onFrame(Math.min(dt, 0.05), this.acc / this.tickDt);
      schedule();
    };
    const schedule = () => {
      if (typeof document !== "undefined" && document.hidden) {
        if (
          this.backgroundTicker?.() &&
          this._startWorker(() => step(performance.now()))
        )
          return;
        this._timer = setTimeout(() => step(performance.now()), 50);
        return;
      }
      this._workerStep = null;
      // Видимая, но неотрисовываемая страница (панель превью за другой вкладкой, iframe вне
      // экрана) не зовёт rAF и при document.hidden === false. Страховочный таймер шагает сам,
      // если кадр не пришёл за 200 мс; кто сработал первым — шагает, второй отменяется.
      this._raf = requestAnimationFrame((now) => {
        clearTimeout(this._timer);
        step(now);
      });
      this._timer = setTimeout(() => {
        cancelAnimationFrame(this._raf);
        step(performance.now());
      }, 200);
    };
    schedule();
  }

  stop() {
    this.running = false;
    // Уже запланированный кадр отменяем явно: если start() придёт раньше, чем он сработает
    // (suspend+activate в одном кадре), он увидел бы running=true и продолжил бы СВОЮ цепочку
    // рядом с новой — симуляция пошла бы вдвое быстрее.
    cancelAnimationFrame(this._raf);
    clearTimeout(this._timer);
    this._workerStep = null;
    this._worker?.terminate();
    this._worker = null;
    if (this._workerUrl) URL.revokeObjectURL(this._workerUrl);
    this._workerUrl = null;
  }

  /**
   * Следующий шаг скрытой страницы — по сообщению воркера. Воркер тикает всегда, пока жив; шаг
   * берёт только один ожидающий (`_workerStep`), поэтому двойной цепочки не бывает. false —
   * воркер не завести (CSP без blob:, нет Worker) — остаётся обычный таймер.
   */
  private _startWorker(next: () => void): boolean {
    try {
      if (!this._worker) {
        const src = "setInterval(function(){postMessage(0)},50)";
        this._workerUrl = URL.createObjectURL(
          new Blob([src], { type: "text/javascript" }),
        );
        this._worker = new Worker(this._workerUrl);
        this._worker.onmessage = () => {
          const fn = this._workerStep;
          this._workerStep = null;
          fn?.();
        };
      }
      this._workerStep = next;
      return true;
    } catch {
      return false;
    }
  }
}
