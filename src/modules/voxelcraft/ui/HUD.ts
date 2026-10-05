// HUD: прицел, хотбар, сердечки, FPS/дебаг, индикатор времени суток,
// стартовый оверлей с управлением и пауза. Чистый DOM, перерисовка по dirty-флагу.
import { events } from "../core/EventBus";
import { Intent } from "../core/Intents";
import { ITEMS } from "../registry/Items";
import { EFFECT_NAMES, labelOf } from "../registry/names";
import { MAX_AIR } from "../player/Player";
import { RAID_WAVES } from "../systems/Raid";
import { drawDurability } from "./slotView";
import { enchantsOf, enchantSuffix } from "../systems/Enchant";
import { DIMENSIONS } from "../world/Dimensions";
import { MAP_SIZE, mapRGB, type MapData } from "../systems/Maps";
import type { Game } from "../main";

export class HUD {
  game: Game;
  $: (id: string) => HTMLElement;
  hotbarEl: HTMLElement;
  heartsEl: HTMLElement;
  fpsEl: HTMLElement;
  debugEl: HTMLElement;
  timeEl: HTMLElement;
  overlayEl: HTMLElement;
  hurtEl: HTMLElement;
  msgEl: HTMLElement;
  hungerEl: HTMLElement;
  _invDirty: boolean;
  _lastHealth: number;
  _lastFood?: number;
  _modeWas?: string;
  _foodModeWas?: string;
  _msgT?: ReturnType<typeof setTimeout>;
  _slots: HTMLDivElement[];
  _hearts: HTMLSpanElement[];
  _drumsticks: HTMLSpanElement[];
  /** Экран смерти и оранжевая кайма горения. */
  deathEl!: HTMLElement;
  fireEl!: HTMLElement;
  /** Полоса здоровья босса и экран титров. */
  bossEl!: HTMLElement;
  creditsEl!: HTMLElement;
  /** Список эффектов зелий с оставшимся временем. */
  effectsEl!: HTMLElement;
  /** Пузырьки воздуха над едой — только под водой. */
  bubblesEl!: HTMLElement;
  private readonly _bubbles: HTMLSpanElement[] = [];
  /** Компас или часы в руке — стрелка или время у хотбара. */
  gadgetEl!: HTMLElement;
  /** Карта в руке. */
  mapEl!: HTMLElement;
  mapCanvas!: HTMLCanvasElement;
  mapMarker!: HTMLElement;
  /** Крестик карты сокровищ. */
  mapTreasure!: HTMLElement;
  private _mapShown: MapData | null = null;
  private _mapVersion = -1;
  /** Полоса опыта над хотбаром и номер уровня. */
  xpFillEl: HTMLElement;
  xpLevelEl: HTMLElement;
  _lastXp = "";
  /** Шкала брони над сердцами (10 значков, по 2 очка защиты). */
  armorEl: HTMLElement;
  _armorPips: HTMLSpanElement[] = [];
  _lastArmor = -1;

  constructor(game: Game) {
    this.game = game;
    // Все элементы гарантированно есть в разметке — helper утверждает non-null.
    this.$ = (id: string): HTMLElement => document.getElementById(id)!;
    this.hotbarEl = this.$("hotbar");
    this.heartsEl = this.$("hearts");
    this.fpsEl = this.$("fps");
    this.debugEl = this.$("debug");
    this.timeEl = this.$("timeIndicator");
    this.overlayEl = this.$("overlay");
    this.hurtEl = this.$("hurtFlash");
    this.msgEl = this.$("message");

    this._invDirty = true;
    this._lastHealth = -1;
    events.on("invChanged", () => {
      this._invDirty = true;
    });
    events.on("playerHurt", () => this._flashHurt());
    // короткие подсказки из систем без доступа к HUD («Нужно седло»)
    events.on("ui:hint", ({ text }: { text: string }) =>
      this.message(text, 1600),
    );
    // экран смерти и огонь на экране
    this.deathEl = document.createElement("div");
    this.deathEl.id = "deathScreen";
    this.deathEl.className = "hidden";
    this.deathEl.innerHTML =
      '<div class="deathPanel"><h1>Вы погибли</h1><p class="deathCause"></p>' +
      '<button class="deathBtn">Возродиться</button></div>';
    this.deathEl.querySelector("button")!.onclick = () => game.respawnPlayer();
    this.fireEl = document.createElement("div");
    this.fireEl.id = "fireOverlay";
    // полоса босса и титры после победы над драконом
    this.bossEl = document.createElement("div");
    this.bossEl.id = "bossBar";
    this.bossEl.className = "hidden";
    this.bossEl.innerHTML =
      '<div class="bossName"></div><div class="bossTrack"><div class="bossFill"></div></div>';
    this.creditsEl = document.createElement("div");
    this.creditsEl.id = "creditsScreen";
    this.creditsEl.className = "hidden";
    this.creditsEl.innerHTML =
      '<div class="deathPanel"><h1>Победа</h1><p class="credits">Дракон Предела повержен.<br>' +
      "Путь пройден: верхний мир — Пекло — Предел.<br>Мир остаётся твоим: строй, исследуй, " +
      "возвращайся.<br><br>Спасибо, что играешь в VoxelCraft.</p>" +
      '<button class="deathBtn">Продолжить</button></div>';
    this.creditsEl.querySelector("button")!.onclick = () => {
      this.creditsEl.classList.add("hidden");
      game.input.uiOpen = false;
      game.input.requestLock();
    };
    this.effectsEl = document.createElement("div");
    this.effectsEl.id = "effects";
    // компас и часы в руке
    this.gadgetEl = document.createElement("div");
    this.gadgetEl.id = "gadget";
    this.gadgetEl.className = "hidden";
    this.heartsEl.parentElement!.appendChild(this.gadgetEl);
    // карта в руке: холст 128×128 (растянут) и метка игрока
    this.mapEl = document.createElement("div");
    this.mapEl.id = "mapView";
    this.mapEl.className = "hidden";
    this.mapCanvas = document.createElement("canvas");
    this.mapCanvas.width = this.mapCanvas.height = MAP_SIZE;
    this.mapMarker = document.createElement("span");
    this.mapMarker.className = "mapMarker";
    this.mapMarker.textContent = "▲";
    this.mapTreasure = document.createElement("span");
    this.mapTreasure.className = "mapTreasure";
    this.mapTreasure.textContent = "✖";
    this.mapEl.append(this.mapCanvas, this.mapTreasure, this.mapMarker);
    this.heartsEl.parentElement!.appendChild(this.mapEl);
    this.heartsEl.parentElement!.append(
      this.deathEl,
      this.fireEl,
      this.bossEl,
      this.creditsEl,
      this.effectsEl,
    );
    events.on("modeChanged", ({ mode }) =>
      this.message(
        mode === "creative"
          ? "Режим: КРЕАТИВ (двойной Space — полёт)"
          : "Режим: выживание",
        1600,
      ),
    );

    // слоты хотбара
    this._slots = [];
    for (let i = 0; i < 9; i++) {
      const d = document.createElement("div");
      d.className = "slot";
      d.innerHTML = '<img draggable="false"><span class="count"></span>';
      // тап/клик по слоту — выбрать его (на телефоне колёсика и цифр нет)
      d.addEventListener("pointerdown", () =>
        game.intents.push(Intent.SelectSlot, { slot: i }),
      );
      this.hotbarEl.appendChild(d);
      this._slots.push(d);
    }
    // сердечки
    this._hearts = [];
    for (let i = 0; i < 10; i++) {
      const s = document.createElement("span");
      s.className = "heart";
      s.textContent = "❤";
      this.heartsEl.appendChild(s);
      this._hearts.push(s);
    }
    // опыт
    const xpBar = document.createElement("div");
    xpBar.id = "xpBar";
    this.xpFillEl = document.createElement("div");
    this.xpFillEl.className = "xpFill";
    xpBar.appendChild(this.xpFillEl);
    this.xpLevelEl = document.createElement("div");
    this.xpLevelEl.id = "xpLevel";
    this.heartsEl.parentElement!.append(xpBar, this.xpLevelEl);
    // броня
    this.armorEl = document.createElement("div");
    this.armorEl.id = "armorBar";
    this.heartsEl.parentElement!.appendChild(this.armorEl);
    for (let i = 0; i < 10; i++) {
      const s = document.createElement("span");
      s.className = "armorPip";
      s.textContent = "⛨";
      this.armorEl.appendChild(s);
      this._armorPips.push(s);
    }
    // окорочка (голод)
    this.hungerEl = this.$("hunger");
    this._drumsticks = [];
    for (let i = 0; i < 10; i++) {
      const s = document.createElement("span");
      s.className = "drumstick";
      s.textContent = "🍗";
      this.hungerEl.appendChild(s);
      this._drumsticks.push(s);
    }
    this.bubblesEl = document.createElement("div");
    this.bubblesEl.id = "bubbles";
    this.bubblesEl.style.display = "none";
    for (let i = 0; i < 10; i++) {
      const s = document.createElement("span");
      s.className = "bubble";
      s.textContent = "◯";
      this.bubblesEl.appendChild(s);
      this._bubbles.push(s);
    }
    this.hungerEl.parentElement!.appendChild(this.bubblesEl);

    // кнопки паузы
    this.$("btnExport").onclick = () => game.save.exportFile();
    this.$("btnImport").onclick = () =>
      game.save.importFile((err: unknown) => {
        this.message(
          err ? "Ошибка импорта: " + (err as Error).message : "Мир загружен",
          1800,
        );
      });
    this.$("btnNewSeed").onclick = () => {
      const s = prompt(
        "Сид нового мира (число):",
        String((Math.random() * 1e9) | 0),
      );
      if (s !== null && s.trim() !== "") game.newWorld(Number(s) || 0);
    };
    this.$("btnTutorial").onclick = () => {
      game.onboarding.reset();
      this.$("btnTutorialToggle").textContent = "Скрыть подсказки";
      this.$("overlayHint").textContent = "Обучение включено. Клик — продолжить";
    };
    this.$("btnTutorialToggle").onclick = () => {
      const enabled = game.onboarding.mode === "off";
      game.onboarding.setMode(enabled ? "full" : "off");
      this.$("btnTutorialToggle").textContent = enabled ? "Скрыть подсказки" : "Показать подсказки";
      this.$("overlayHint").textContent = enabled ? "Подсказки включены. Клик — продолжить" : "Подсказки скрыты. Клик — продолжить";
    };
    this.overlayEl.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("button")) return; // кнопки не запускают игру
      game.startPlay();
    });
  }

  showOverlay(paused: boolean) {
    this.overlayEl.classList.remove("hidden");
    this.$("btnTutorialToggle").textContent = this.game.onboarding.mode === "off" ? "Показать подсказки" : "Скрыть подсказки";
    this.$("overlayTitle").textContent = paused ? "Пауза" : "VoxelCraft";
    this.$("overlayHint").textContent = paused
      ? "Клик — продолжить"
      : "Клик — играть";
  }
  hideOverlay() {
    this.overlayEl.classList.add("hidden");
  }

  /** Экран «Вы погибли» с причиной и кнопкой возрождения. */
  showDeath(cause: string) {
    const CAUSES: Record<string, string> = {
      attack: "Вас убил монстр",
      projectile: "Вас застрелили",
      explosion: "Вас взорвали",
      lava: "Вы искупались в лаве",
      fire: "Вы сгорели",
      fall: "Вы упали с высоты",
      starve: "Вы умерли от голода",
      void: "Вы выпали из мира",
      cactus: "Вас искололо кактусом",
      magic: "Вас сгубило колдовство",
      lightning: "Вас поразила молния",
      decay: "Вы истлели",
      skull: "Вас сразил Пепельный владыка",
      bullet: "Вас подбил панцирник",
      drown: "Вы утонули",
      beam: "Вас сжёг луч глубинника",
      thorns: "Вы укололись о шипы глубинника",
      wall: "Вы врезались в стену на лету",
      // причины, для которых экран смерти молчал (замёрзнуть в снегу-порохе — самая частая)
      freeze: "Вы замёрзли",
      stalagmite: "Вас пронзил сталагмит",
      falling_stalactite: "На вас упал сталактит",
      teleport: "Неудачный бросок жемчуга",
      sonic_boom: "Вас оглушил вопль глубинника",
      wind: "Вас сдуло ветром",
      poison: "Вас отравили",
    };
    this.deathEl.querySelector(".deathCause")!.textContent =
      CAUSES[cause] ?? ""; // заголовок панели уже «Вы погибли» — без повтора
    this.deathEl.classList.remove("hidden");
  }
  hideDeath() {
    this.deathEl.classList.add("hidden");
  }

  /** Титры после первой победы над драконом (кнопка «Продолжить» возвращает управление). */
  showCredits() {
    this.game.input.uiOpen = true;
    this.game.input.releaseLock();
    this.creditsEl.classList.remove("hidden");
  }

  message(text: string, ms = 1500) {
    this.msgEl.textContent = text;
    this.msgEl.classList.add("show");
    clearTimeout(this._msgT);
    this._msgT = setTimeout(() => this.msgEl.classList.remove("show"), ms);
  }

  /** Teardown: таймер сообщения не должен пережить игру. */
  dispose() {
    clearTimeout(this._msgT);
  }

  _flashHurt() {
    this.hurtEl.classList.remove("show");
    void this.hurtEl.offsetWidth; // перезапуск CSS-анимации
    this.hurtEl.classList.add("show");
  }

  frame() {
    const g = this.game;
    if (this._invDirty) {
      this._renderHotbar();
      this._invDirty = false;
    }
    if (
      g.player.health !== this._lastHealth ||
      this._modeWas !== g.player.mode
    ) {
      this._renderHearts();
      this._lastHealth = g.player.health;
      this._modeWas = g.player.mode;
    }
    if (
      g.player.food !== this._lastFood ||
      this._foodModeWas !== g.player.mode
    ) {
      this._renderHunger();
      this._lastFood = g.player.food;
      this._foodModeWas = g.player.mode;
    }

    const xpKey =
      g.player.xpLevel +
      ":" +
      Math.round(g.player.xpProgress * 200) +
      ":" +
      g.player.mode;
    if (xpKey !== this._lastXp) {
      this._lastXp = xpKey;
      const show = g.player.mode !== "creative";
      this.xpFillEl.parentElement!.style.display = show ? "" : "none";
      this.xpFillEl.style.width = (g.player.xpProgress * 100).toFixed(1) + "%";
      this.xpLevelEl.textContent =
        show && g.player.xpLevel > 0 ? String(g.player.xpLevel) : "";
    }

    const armor = g.inventory.armorStats().points;
    if (armor !== this._lastArmor) {
      this._lastArmor = armor;
      this.armorEl.style.display =
        armor > 0 && g.player.mode !== "creative" ? "" : "none";
      for (let i = 0; i < 10; i++) {
        const v = armor - i * 2;
        this._armorPips[i]!.className =
          "armorPip" + (v >= 2 ? "" : v >= 1 ? " half" : " empty");
      }
    }

    this.fireEl.classList.toggle("show", g.player.fireT > 0 && !g.player.dead);
    // эффекты зелий и маяка: «Сила 2:31»; Тление чернит сердца
    this.heartsEl.classList.toggle("decay", g.player.effects.has("decay"));
    // пузырьки: сколько воздуха осталось под водой
    const pl = g.player;
    const showAir =
      pl.mode !== "creative" && !pl.dead && pl.air < MAX_AIR - 0.01;
    this.bubblesEl.style.display = showAir ? "" : "none";
    if (showAir) {
      const n = Math.ceil((pl.air / MAX_AIR) * 10);
      this._bubbles.forEach(
        (b, i) => (b.className = "bubble" + (i < n ? "" : " empty")),
      );
    }
    let fx = "";
    for (const [id, e] of g.player.effects) {
      const s = Math.max(0, Math.ceil(e.time));
      fx +=
        `${EFFECT_NAMES[id] ?? id}${e.level > 1 ? " " + e.level : ""} ` +
        `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}\n`;
    }
    if (this.effectsEl.textContent !== fx) this.effectsEl.textContent = fx;
    // полоса босса: живой босс в загруженном мире
    let boss: { name: string; hp: number; max: number } | null = null;
    for (const e of g.entities.entities.values())
      if (e.kind === "mob" && e.def.boss && !e.dead)
        boss = { name: e.def.name, hp: e.hp, max: e.def.hp };
    // нет босса, идёт набег — полоса набега: здоровье живых разбойников волны
    const raid = g.raid;
    if (!boss && raid) {
      let hp = 0;
      for (const id of raid.raiders) {
        const e = g.entities.entities.get(id);
        if (e?.kind === "mob" && !e.dead) hp += e.hp;
      }
      boss =
        raid.state === "fighting"
          ? {
              name: `Набег · волна ${raid.wave} из ${RAID_WAVES}`,
              hp,
              max: Math.max(1, raid.hpTotal),
            }
          : {
              name: `Набег · волна ${raid.wave + 1} из ${RAID_WAVES} — скоро`,
              hp: 0,
              max: 1,
            };
    }
    this.bossEl.classList.toggle("hidden", !boss);
    if (boss) {
      this.bossEl.querySelector(".bossName")!.textContent = labelOf(boss.name);
      (this.bossEl.querySelector(".bossFill") as HTMLElement).style.width =
        ((boss.hp / boss.max) * 100).toFixed(1) + "%";
    }
    this.fpsEl.textContent = g.loop.fps + " FPS";
    // дебаг-строка
    const p = g.player.pos;
    this.debugEl.textContent =
      `xyz: ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)} | ` +
      `чанки: ${g.world.chunks.size} | жидкости: ${g.fluids.queueSize} | сид: ${g.world.seed}`;

    // индикатор времени: стрелка-дуга солнца/луны
    const ph = g.dayNight.phase;
    // в Пекле и Пределе неба нет — и времени суток на экране тоже
    this.timeEl.textContent = DIMENSIONS[g.dimension].hasSky
      ? (g.dayNight.isDay ? "☀" : "☾") +
        " " +
        (ph < 0.5 ? "день" : "ночь") +
        (g.weather.kind === "thunder"
          ? " · гроза"
          : g.weather.kind === "rain"
            ? " · дождь"
            : "")
      : "";
    this._gadget();
    this._mapView();
  }

  /** Карта в руке: холст перерисовывается, только когда карта изменилась; метка — каждый кадр. */
  private _mapView() {
    const g = this.game;
    const h = g.inventory.heldItem();
    const m =
      h?.item === "filled_map" ? g.maps.get(Number(h.tag?.map)) : undefined;
    if (!m) {
      this.mapEl.classList.add("hidden");
      return;
    }
    this.mapEl.classList.remove("hidden");
    if (this._mapShown !== m || this._mapVersion !== m.version) {
      this._mapShown = m;
      this._mapVersion = m.version;
      const ctx = this.mapCanvas.getContext("2d");
      if (ctx) {
        const img = ctx.createImageData(MAP_SIZE, MAP_SIZE);
        for (let i = 0; i < m.px.length; i++) {
          const c = mapRGB(m.px[i]!);
          const o = i * 4;
          img.data[o] = c < 0 ? 214 : (c >> 16) & 255;
          img.data[o + 1] = c < 0 ? 190 : (c >> 8) & 255;
          img.data[o + 2] = c < 0 ? 150 : c & 255;
          img.data[o + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
      }
    }
    const p = g.player.pos;
    const u = (p.x - m.x0) / MAP_SIZE,
      v = (p.z - m.z0) / MAP_SIZE;
    const inside =
      m.dim === g.dimension && u >= 0 && u <= 1 && v >= 0 && v <= 1;
    this.mapMarker.style.display = inside ? "" : "none";
    this.mapMarker.style.left = (u * 100).toFixed(2) + "%";
    this.mapMarker.style.top = (v * 100).toFixed(2) + "%";
    this.mapMarker.style.transform = `translate(-50%, -50%) rotate(${((-g.player.yaw * 180) / Math.PI).toFixed(1)}deg)`;
    // карта сокровищ: красный крестик над кладом
    const t = m.target;
    this.mapTreasure.style.display = t ? "" : "none";
    if (t) {
      this.mapTreasure.style.left =
        (((t[0] + 0.5 - m.x0) / MAP_SIZE) * 100).toFixed(2) + "%";
      this.mapTreasure.style.top =
        (((t[1] + 0.5 - m.z0) / MAP_SIZE) * 100).toFixed(2) + "%";
    }
  }

  private frostEl: HTMLElement | null = null;
  /** Иней по краям экрана — насколько игрок промёрз в снегу-порохе (0..1, systems/Freezing). */
  frost(k: number): void {
    if (!this.frostEl) {
      if (k <= 0) return;
      const el = document.createElement("div");
      el.style.cssText =
        "position:fixed;inset:0;pointer-events:none;opacity:0;" +
        "background:radial-gradient(ellipse at center,rgba(255,255,255,0) 40%,rgba(220,240,255,.9) 100%)";
      this.heartsEl.parentElement!.appendChild(el);
      this.frostEl = el;
    }
    this.frostEl.style.opacity = k.toFixed(2);
  }

  /**
   * Компас и часы в руке: у хотбара — стрелка на точку появления мира (в Пекле и Пределе крутится)
   * или время суток (без неба — «??:??»), как у приборов Minecraft.
   */
  private _gadget() {
    const g = this.game;
    const held = g.inventory.heldItem()?.item;
    const el = this.gadgetEl;
    if (held !== "compass" && held !== "clock" && held !== "recovery_compass") {
      el.classList.add("hidden");
      return;
    }
    el.classList.remove("hidden");
    if (held === "compass" || held === "recovery_compass") {
      // компас — на путевой камень (если привязан здесь) или на точку появления,
      // компас возвращения — на место последней смерти в этом измерении
      const d = g.lastDeath;
      const lode = g.player.lodestone;
      const s =
        held === "compass"
          ? lode && lode.dim === g.dimension
            ? { x: lode.x, z: lode.z }
            : g.dimension === "overworld"
              ? g.world.generator.spawnHint()
              : null
          : d && d.dim === g.dimension
            ? { x: Math.floor(d.x), z: Math.floor(d.z) }
            : null;
      let deg: number;
      if (!s) deg = (performance.now() / 3) % 360;
      else {
        const p = g.player.pos;
        const target = Math.atan2(-(s.x + 0.5 - p.x), -(s.z + 0.5 - p.z));
        deg = (-(target - g.player.yaw) * 180) / Math.PI;
      }
      el.innerHTML = `<span class="needle" style="transform:rotate(${deg.toFixed(1)}deg)">▲</span>`;
      return;
    }
    if (!DIMENSIONS[g.dimension].hasSky) {
      el.textContent = "🕒 ??:??";
      return;
    }
    const h = (6 + g.dayNight.phase * 24) % 24;
    el.textContent = `🕒 ${String(Math.floor(h)).padStart(2, "0")}:${String(Math.floor((h % 1) * 60)).padStart(2, "0")}`;
  }

  _renderHotbar() {
    const inv = this.game.inventory;
    for (let i = 0; i < 9; i++) {
      const el = this._slots[i]!;
      const s = inv.slots[i];
      el.classList.toggle("selected", i === inv.hotbarIndex);
      const img = el.querySelector("img")!; // разметка слота всегда содержит <img>
      const count = el.querySelector(".count")!; // …и .count
      if (s) {
        img.src = ITEMS[s.item]?.iconURL ?? ""; // iconURL заполняется buildIcons() до первого рендера; неизвестный предмет (чужой сейв) — пустая иконка, а не падение
        img.style.display = "";
        img.title = labelOf(s.item) + enchantSuffix(s);
        el.classList.toggle("ench", enchantsOf(s).length > 0);
        // textContent-сеттер сам приводит число к строке; каст только для типов (в JS не компилируется)
        count.textContent = (s.count > 1 ? s.count : "") as unknown as string;
      } else {
        img.style.display = "none";
        count.textContent = "";
        el.classList.remove("ench");
      }
      drawDurability(el, s ?? null);
    }
  }

  _renderHearts() {
    const g = this.game;
    this.heartsEl.style.display = g.player.mode === "creative" ? "none" : "";
    const hp = g.player.health;
    for (let i = 0; i < 10; i++) {
      const v = hp - i * 2;
      this._hearts[i]!.className =
        "heart" + (v >= 2 ? "" : v >= 1 ? " half" : " empty");
    }
  }

  _renderHunger() {
    const g = this.game;
    this.hungerEl.style.display = g.player.mode === "creative" ? "none" : "";
    const food = g.player.food;
    for (let i = 0; i < 10; i++) {
      const v = food - i * 2;
      this._drumsticks[i]!.className =
        "drumstick" + (v >= 2 ? "" : v >= 1 ? " half" : " empty");
    }
  }
}
