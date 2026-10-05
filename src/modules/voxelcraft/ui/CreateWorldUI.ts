// Экран «Создать мир»: картинки-референсы + описание → рецепт мира → миникарта → игра.
// Два пути к одному рецепту: без ИИ (первая картинка разбирается в браузере, текст — по ключевым
// словам) и с ИИ (client.ai, фича тайтла "voxel-world"): ИИ видит все картинки и может собрать
// показанный на них объект — самолёт, машину — из блоков. Плюс вкладка «Мои миры».
//
// Чистый DOM, как весь HUD. Пока экран открыт, игровой ввод заморожен (input.uiOpen), а игра
// стоит на паузе под ним.
import type { Game } from "../main";
import type { WorldAI, WorldAIResult, WorldAIStatus } from "../ai/types";
import {
  analyzeMood,
  analyzeTopDown,
  type TopDownResult,
} from "../worldgen/ImageAnalyzer";
import { loadImageFile, type LoadedImage } from "../worldgen/loadImage";
import { SpecGenerator } from "../worldgen/SpecGenerator";
import { drawPreview } from "../worldgen/preview";
import { buildSpecWithoutAI, topDownLayers } from "../worldgen/textSpec";
import {
  SIZE_PRESETS,
  SPEC_LIMITS,
  parseWorldSpec,
  type WorldSize,
  type WorldSpec,
} from "../worldgen/WorldSpec";
import { downloadText, pickTextFile, safeFileName } from "../systems/Save";

type ReadMode = "reference" | "topdown" | "mood";

/**
 * Сколько картинок экран принимает всегда. Больше — если ИИ-фича тайтла разрешает больше
 * (`maxImages()`): потолка у платформы нет, число задаёт издатель.
 */
const MAX_IMAGES = 4;

const BIOME_RU: Record<string, string> = {
  meadow: "луг",
  forest: "лес",
  birch_forest: "березняк",
  taiga: "тайга",
  snow: "снега",
  desert: "пустыня",
  badlands: "красные скалы",
  beach: "пляж",
  swamp: "болото",
  rocky: "камни",
  savanna: "саванна",
  jungle: "джунгли",
};

const STRUCTURE_RU: Record<string, string> = {
  house: "дом",
  tower: "башня",
  castle: "замок",
  village: "деревня",
  wall: "стена",
  road: "дорога",
  bridge: "мост",
  ruins: "руины",
  pond: "пруд",
  rock: "скала",
  tree_cluster: "роща",
  pyramid: "пирамида",
  well: "колодец",
  farm: "ферма",
};

export class CreateWorldUI {
  open = false;
  private readonly root: HTMLElement;
  private readonly $: (id: string) => HTMLElement;
  private images: LoadedImage[] = [];
  private spec: WorldSpec | null = null;
  private busy = false;
  private job: AbortController | null = null;
  private aiStatus: WorldAIStatus | null = null;

  constructor(
    private readonly game: Game,
    signal: AbortSignal,
    private readonly ai: WorldAI | null,
  ) {
    // Все элементы гарантированно есть в разметке (scene.ts) — helper утверждает non-null.
    this.$ = (id: string) => document.getElementById(id)!;
    this.root = this.$("worldScreen");
    const on = <K extends keyof HTMLElementEventMap>(
      el: EventTarget,
      type: K,
      fn: (e: HTMLElementEventMap[K]) => void,
    ) => el.addEventListener(type, fn as EventListener, { signal });

    on(this.$("btnWorlds"), "click", () => this.show("new"));
    on(this.$("wsClose"), "click", () => this.hide());
    on(document, "keydown", (e) => {
      if (this.open && e.code === "Escape") this.hide();
    });
    for (const tab of this.root.querySelectorAll<HTMLButtonElement>(".wsTab"))
      on(tab, "click", () =>
        this.selectTab(tab.dataset.tab === "mine" ? "mine" : "new"),
      );

    // картинки: клик, перетаскивание, вставка из буфера — сразу несколько
    const drop = this.$("wsDrop");
    on(drop, "click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.accept = "image/png,image/jpeg,image/webp,image/gif";
      input.onchange = () => void this.addImages([...(input.files ?? [])]);
      input.click();
    });
    on(drop, "dragover", (e) => {
      e.preventDefault();
      drop.classList.add("over");
    });
    on(drop, "dragleave", () => drop.classList.remove("over"));
    on(drop, "drop", (e) => {
      e.preventDefault();
      drop.classList.remove("over");
      void this.addImages([...(e.dataTransfer?.files ?? [])]);
    });
    on(document, "paste", (e) => {
      if (!this.open) return;
      const files = [...(e.clipboardData?.files ?? [])].filter((x) =>
        x.type.startsWith("image/"),
      );
      if (files.length) void this.addImages(files);
    });
    on(this.$("wsClearImg"), "click", () => {
      this.images = [];
      this.renderThumbs();
    });

    for (const r of this.root.querySelectorAll<HTMLInputElement>(
      'input[name="wsSize"]',
    ))
      on(r, "change", () =>
        this.$("wsCustom").classList.toggle(
          "hidden",
          this.radio("wsSize") !== "custom",
        ),
      );

    on(this.$("wsGenerate"), "click", () => void this.generate());
    on(this.$("wsPlay"), "click", () => this.play());
    on(this.$("wsSaveSpec"), "click", () => this.downloadSpec());
    on(this.$("wsLoadSpec"), "click", () => this.loadSpec());
  }

  // ---- открытие -------------------------------------------------------------------

  show(tab: "new" | "mine" = "new"): void {
    if (this.open) return;
    this.open = true;
    this.game.input.uiOpen = true; // игровой ввод заморожен
    this.game.input.releaseLock();
    this.root.classList.remove("hidden");
    this.selectTab(tab);
    void this.refreshAi();
  }

  hide(): void {
    if (!this.open) return;
    this.open = false;
    // Незаконченная ИИ-задача не теряется: сервер доделает её, а resume() дождётся в следующий раз.
    this.job?.abort();
    this.game.input.uiOpen = false;
    this.root.classList.add("hidden");
  }

  private selectTab(tab: "new" | "mine"): void {
    for (const t of this.root.querySelectorAll<HTMLButtonElement>(".wsTab"))
      t.classList.toggle("active", t.dataset.tab === tab);
    this.$("wsNew").classList.toggle("hidden", tab !== "new");
    this.$("wsMine").classList.toggle("hidden", tab !== "mine");
    if (tab === "mine") void this.renderMine();
  }

  // ---- ИИ ------------------------------------------------------------------------

  private async refreshAi(): Promise<void> {
    const label = this.$("wsAiLabel");
    const radio = label.querySelector("input")!; // разметка: радио внутри подписи
    const note = this.$("wsAiNote");
    if (!this.ai) {
      label.classList.add("hidden");
      return;
    }
    note.textContent = "проверяю…";
    this.aiStatus = await this.ai.status().catch((): WorldAIStatus => ({
      available: false,
      reason: "ИИ недоступен",
    }));
    if (this.aiStatus.available) {
      radio.disabled = false;
      const f = this.aiStatus.feature;
      note.textContent = [
        f.priceLabel ? `цена: ${f.priceLabel}` : "бесплатно",
        f.allowImages
          ? `ИИ видит до ${f.maxImages} ${f.maxImages === 1 ? "картинки" : "картинок"}`
          : "картинки ИИ не видит — они читаются локально",
      ].join(" · ");
      // незаконченная задача с прошлого раза — дождаться её
      if (!this.busy)
        void this.runAi(() => this.ai!.resume(this.jobOpts()), true);
    } else {
      radio.disabled = true;
      if (this.radio("wsMode") === "ai") this.setRadio("wsMode", "local");
      note.textContent = this.aiStatus.reason;
    }
  }

  private jobOpts() {
    this.job = new AbortController();
    return {
      signal: this.job.signal,
      onProgress: (p: number | null, text: string) =>
        this.status(p === null ? text : `${text} ${Math.round(p)}%`),
    };
  }

  /** Запустить ИИ-задачу и разобрать итог. resumed = дожидаемся задачи с прошлого раза. */
  private async runAi(
    run: () => Promise<WorldAIResult | null>,
    resumed = false,
  ): Promise<void> {
    this.setBusy(true);
    try {
      const res = await run();
      if (!res) return; // нечего было дожидаться
      if (res.ok) {
        const spec = this.withImageLayers(res.spec);
        this.setSpec(
          spec,
          res.warnings.length
            ? "Поправлено: " + res.warnings.join("; ")
            : resumed
              ? "Готов мир с прошлого раза"
              : "",
        );
        return;
      }
      if (res.kind === "cancelled") return;
      if (res.kind === "invalid" || res.kind === "truncated") {
        // модель ответила не рецептом — строим без ИИ, чтобы игрок не остался ни с чем
        this.buildLocal();
        this.status(`${res.message} Мир построен без ИИ.`);
        return;
      }
      this.status(
        res.refunded ? `${res.message} Списанное возвращено.` : res.message,
        true,
      );
    } finally {
      this.setBusy(false);
    }
  }

  /** Режим «карта сверху»: рельеф и поверхность — из пикселей первой картинки, смысл — от ИИ. */
  private withImageLayers(spec: WorldSpec): WorldSpec {
    const td = this.topDown(spec.size);
    if (!td) return spec;
    const merged = parseWorldSpec({
      ...spec,
      terrain: {
        ...spec.terrain,
        ...topDownLayers(td, spec.terrain.waterLevel),
      },
    });
    return merged.ok ? merged.spec : spec;
  }

  // ---- генерация ---------------------------------------------------------------------

  private async generate(): Promise<void> {
    if (this.busy) return;
    const useAi =
      this.radio("wsMode") === "ai" && this.aiStatus?.available === true;
    if (!useAi) {
      this.status("Строю мир…");
      await nextFrame(); // дать экрану показать статус до синхронной работы
      this.buildLocal();
      if (this.images.length && this.readMode() === "reference")
        this.status(
          "Без ИИ картинка задаёт только стиль мира. Объекты с картинок строит ИИ.",
        );
      return;
    }
    const feature = this.aiStatus?.available ? this.aiStatus.feature : null;
    const images = feature?.allowImages
      ? this.images.slice(0, feature.maxImages)
      : [];
    if (
      feature?.maxImageBytes &&
      images.some((im) => im.aiBytes > feature.maxImageBytes!)
    ) {
      this.status(
        "Одна из картинок слишком большая для ИИ. Возьмите поменьше.",
        true,
      );
      return;
    }
    await this.runAi(() =>
      this.ai!.generate(
        {
          text: this.text(),
          size: this.size(),
          readMode: this.readMode(),
          images: images.map((im) => ({
            dataUrl: im.aiDataUrl,
            contentType: im.aiContentType,
            bytes: im.aiBytes,
          })),
        },
        this.jobOpts(),
      ),
    );
  }

  private buildLocal(): void {
    const size = this.size();
    const seed = (Math.random() * 0xffffffff) >>> 0; // «Сгенерировать» ещё раз — другой вариант
    const first = this.images[0];
    const spec = buildSpecWithoutAI({
      text: this.text(),
      size,
      seed,
      topDown: this.topDown(size),
      mood:
        first && this.readMode() !== "topdown"
          ? analyzeMood(first.image)
          : undefined,
    });
    this.setSpec(spec, "");
  }

  private topDown(size: WorldSize): TopDownResult | undefined {
    const first = this.images[0];
    if (!first || this.readMode() !== "topdown") return undefined;
    const w = Math.min(128, size.widthChunks * 16),
      h = Math.min(128, size.depthChunks * 16);
    return analyzeTopDown(first.image, w, h);
  }

  private setSpec(spec: WorldSpec, note: string): void {
    this.spec = spec;
    const gen = new SpecGenerator(spec);
    drawPreview(this.$("wsMap") as HTMLCanvasElement, gen, 256);
    const biomes = [
      ...new Set(
        (spec.zones.length ? spec.zones : [{ biome: "meadow" }]).map(
          (z) => BIOME_RU[z.biome] ?? z.biome,
        ),
      ),
    ];
    const built = spec.structures.map((s) =>
      s.type === "model"
        ? (s.model ?? "объект")
        : (STRUCTURE_RU[s.type] ?? s.type),
    );
    const blocks = `${spec.size.widthChunks * 16}×${spec.size.depthChunks * 16}`;
    this.$("wsInfo").textContent =
      `«${spec.name}» · ${spec.size.mode === "infinite" ? "бесконечный, область " + blocks : blocks} · ` +
      `${biomes.join(", ")}` +
      (built.length ? ` · ${[...new Set(built)].join(", ")}` : "");
    (this.$("wsPlay") as HTMLButtonElement).disabled = false;
    (this.$("wsSaveSpec") as HTMLButtonElement).disabled = false;
    this.$("wsGenerate").textContent = "Перегенерировать";
    this.status(note || "Готово. Красная точка — место появления.");
  }

  private play(): void {
    if (!this.spec) return;
    this.game.newWorld({ kind: "spec", spec: this.spec });
    this.hide();
    this.game.startPlay(); // клик по кнопке — жест пользователя, захват мыши разрешён
  }

  private downloadSpec(): void {
    if (!this.spec) return;
    downloadText(
      `voxelcraft-world-${safeFileName(this.spec.name)}.json`,
      JSON.stringify(this.spec, null, 2),
    );
  }

  private loadSpec(): void {
    pickTextFile(".json,application/json", (text) => {
      const r = parseWorldSpec(text);
      if (!r.ok) {
        this.status("Это не рецепт мира: " + r.error, true);
        return;
      }
      this.setSpec(
        r.spec,
        r.warnings.length
          ? "Поправлено: " + r.warnings.join("; ")
          : "Рецепт загружен",
      );
    });
  }

  // ---- картинки ------------------------------------------------------------------------

  /**
   * Сколько картинок можно положить на экран: не меньше {@link MAX_IMAGES}, а если ИИ-фича тайтла
   * принимает больше — столько, сколько разрешил издатель (потолка платформы нет).
   */
  private maxImages(): number {
    const f = this.aiStatus?.available ? this.aiStatus.feature : null;
    return Math.max(MAX_IMAGES, f?.allowImages ? f.maxImages : 0);
  }

  private async addImages(files: File[]): Promise<void> {
    const pics = files.filter((f) => f.type.startsWith("image/"));
    if (!pics.length) {
      if (files.length) this.status("Нужны картинки (PNG, JPEG, WebP).", true);
      return;
    }
    const limit = this.maxImages();
    const room = limit - this.images.length;
    if (room <= 0) {
      this.status(`Не больше ${limit} картинок — уберите лишние.`, true);
      return;
    }
    this.status("Читаю картинки…");
    let failed = 0;
    for (const f of pics.slice(0, room)) {
      try {
        this.images.push(await loadImageFile(f));
      } catch {
        failed++;
      }
    }
    this.renderThumbs();
    const skipped = pics.length - Math.min(pics.length, room);
    this.status(
      failed
        ? "Часть картинок не удалось прочитать."
        : skipped
          ? `Добавлены первые ${room}: больше ${MAX_IMAGES} картинок ИИ не примет.`
          : `Картинок: ${this.images.length}.`,
      failed > 0,
    );
  }

  private renderThumbs(): void {
    const box = this.$("wsThumbs");
    box.replaceChildren();
    this.images.forEach((im, i) => {
      const cell = document.createElement("div");
      cell.className = "wsThumb";
      const img = document.createElement("img");
      img.src = im.thumbUrl;
      img.alt = "";
      const x = document.createElement("span");
      x.className = "wsThumbX";
      x.textContent = "×";
      x.title = "Убрать";
      x.onclick = (e) => {
        e.stopPropagation(); // клик по крестику — не выбор новых файлов
        this.images.splice(i, 1);
        this.renderThumbs();
      };
      cell.append(img, x);
      box.append(cell);
    });
    const any = this.images.length > 0;
    box.classList.toggle("hidden", !any);
    this.$("wsDropHint").classList.toggle("hidden", any);
    this.$("wsClearImg").classList.toggle("hidden", !any);
  }

  // ---- «Мои миры» ------------------------------------------------------------------------

  private async renderMine(): Promise<void> {
    const list = this.$("wsList");
    const store = this.game.store;
    if (!store) {
      list.textContent =
        "Этот браузер не даёт сохранять миры (приватный режим или запрет хранилища).";
      return;
    }
    const worlds = await store.list();
    list.replaceChildren();
    if (!worlds.length) {
      list.textContent = "Пока пусто. Сохранение идёт само, пока вы играете.";
      return;
    }
    for (const w of worlds) {
      const row = document.createElement("div");
      row.className = "wsItem" + (w.id === this.game.worldId ? " current" : "");
      const title = document.createElement("div");
      title.className = "wsItemName";
      title.textContent = w.name;
      const meta = document.createElement("div");
      meta.className = "wsItemMeta";
      meta.textContent =
        (w.kind === "spec" ? "по рецепту" : "по сиду") +
        " · " +
        new Date(w.updatedAt).toLocaleString() +
        (w.id === this.game.worldId ? " · сейчас открыт" : "");
      const play = document.createElement("button");
      play.textContent = "Играть";
      play.onclick = () => void this.continueWorld(w.id);
      const del = document.createElement("button");
      del.textContent = "Удалить";
      del.onclick = async () => {
        if (!confirm(`Удалить мир «${w.name}»? Это нельзя отменить.`)) return;
        await store.delete(w.id);
        void this.renderMine();
      };
      const text = document.createElement("div");
      text.append(title, meta);
      row.append(text, play, del);
      list.append(row);
    }
  }

  private async continueWorld(id: string): Promise<void> {
    const ok = await this.game.openStoredWorld(id);
    if (!ok) {
      this.status("Не удалось открыть мир.", true);
      return;
    }
    this.hide();
    this.game.startPlay();
  }

  // ---- форма ------------------------------------------------------------------------

  private radio(name: string): string {
    return (
      this.root.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)
        ?.value ?? ""
    );
  }

  private setRadio(name: string, value: string): void {
    const r = this.root.querySelector<HTMLInputElement>(
      `input[name="${name}"][value="${value}"]`,
    );
    if (r) r.checked = true;
  }

  private readMode(): ReadMode {
    const v = this.radio("wsRead");
    return v === "topdown" || v === "mood" ? v : "reference";
  }

  private text(): string {
    return (this.$("wsText") as HTMLTextAreaElement).value.trim();
  }

  private size(): WorldSize {
    const v = this.radio("wsSize");
    if (v === "large" || v === "infinite" || v === "island")
      return { ...SIZE_PRESETS[v] };
    const clamp = (n: number) =>
      Math.min(
        SPEC_LIMITS.maxChunks,
        Math.max(SPEC_LIMITS.minChunks, Math.round(n) || 16),
      );
    return {
      mode: "island",
      widthChunks: clamp(Number((this.$("wsW") as HTMLInputElement).value)),
      depthChunks: clamp(Number((this.$("wsD") as HTMLInputElement).value)),
    };
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    const btn = this.$("wsGenerate") as HTMLButtonElement;
    btn.disabled = busy; // второй generate того же действия сервер всё равно отбил бы
    if (busy) btn.textContent = "ИИ думает…";
    else btn.textContent = this.spec ? "Перегенерировать" : "Сгенерировать";
  }

  private status(text: string, error = false): void {
    const el = this.$("wsStatus");
    el.textContent = text;
    el.classList.toggle("error", error);
  }
}

/**
 * Дать браузеру отрисовать статус перед синхронной работой. Не requestAnimationFrame: в фоновой
 * вкладке он не срабатывает вовсе, и генерация висела бы до возврата игрока.
 */
function nextFrame(): Promise<void> {
  return new Promise((r) => setTimeout(r, 30));
}
