// Точка сборки: единственное место, где конструируются все системы и
// внедряются зависимости. Модули общаются через EventBus или переданные ссылки.
// Тик (20 TPS) — симуляция; кадр — ввод, физика игрока, интерполяция, рендер.
import * as THREE from "three";
import { CONFIG } from "./config";
import { events } from "./core/EventBus";
import { GameLoop } from "./core/GameLoop";
import { IntentQueue } from "./core/Intents";
import { TextureAtlas } from "./gfx/TextureAtlas";
import { buildIcons } from "./registry/Items";
import { ChunkManager } from "./world/ChunkManager";
import { Player } from "./player/Player";
import { Input } from "./player/Input";
import { Interaction } from "./player/Interaction";
import { ArmView, ARM_LAYER } from "./player/ArmView";
import { EntityManager } from "./entities/EntityManager";
import { Inventory } from "./systems/Inventory";
import { BlockUpdates } from "./systems/BlockUpdates";
import { BlockEntities } from "./world/BlockEntities";
import {
  DIMENSIONS,
  isDimensionId,
  type DimensionId,
} from "./world/Dimensions";
import { BLOCKS, B } from "./registry/Blocks";
import { findSafeSpot, isStandable } from "./world/safeSpot";
import { MOBS } from "./registry/Mobs";
import { buildPortal, findPortalNear, portalsOf } from "./world/Portal";
import { LAVA_SEA } from "./worldgen/inferno/InfernoGenerator";
import {
  BEYOND_ARRIVAL,
  BeyondGenerator,
  ISLAND_Y,
  OUTER_LANDING,
  beyondPillars,
  exitPortalCells,
  gatewaySpot,
} from "./worldgen/beyond/BeyondGenerator";
import { OUTER_START } from "./worldgen/beyond/outer";
import "./world/behaviours/index"; // поведения блоков регистрируются при импорте
import "./world/blockentities/index"; // типы блочных сущностей (печь, сундук) — тоже
import { FluidSim } from "./systems/FluidSim";
import { DayNight } from "./systems/DayNight";
import { Weather } from "./systems/Weather";
import { MAP_SIZE, newMap, surveyMap, type MapData } from "./systems/Maps";
import { EXPLORER_MAPS } from "./registry/items/mansion";
import { Sculk } from "./systems/Sculk";
import { hitTarget } from "./world/behaviours/extras";
import { anchorCharges } from "./world/behaviours/stand";
import { ArmorStand } from "./gfx/ArmorStand";
import { Fireworks } from "./gfx/Fireworks";
import { EMERGE_TIME } from "./entities/WardenBrain";
import { dripstoneFallDamage } from "./world/behaviours/dripstone";
import { Freezing } from "./systems/Freezing";
import {
  TRIAL_RANGE,
  trialStep,
  type TrialState,
} from "./systems/TrialSpawner";
import { TRIAL_MOBS } from "./registry/blocks/trial";
import type { Mob } from "./entities/Mob";
import { Audio } from "./systems/Audio";
import { SaveSystem, worldSourceOf } from "./systems/Save";
import { HUD } from "./ui/HUD";
import { InventoryUI } from "./ui/InventoryUI";
import { CreateWorldUI } from "./ui/CreateWorldUI";
import { NetUI, friendlyNetError } from "./ui/NetUI";
import { ChatConsole } from "./ui/ChatConsole";
import { SignEditor } from "./ui/SignEditor";
import { BookScreen } from "./ui/BookScreen";
import { NameEditor } from "./ui/NameEditor";
import { TouchControls, touchWanted } from "./ui/TouchControls";
import { Commands } from "./systems/Commands";
import { BeaconBeams } from "./gfx/BeaconBeams";
import { DisplayItems } from "./gfx/DisplayItems";
import { SignText } from "./gfx/SignText";
import { Banners } from "./gfx/Banners";
import { Achievements } from "./systems/Achievements";
import { RAID_WAVES, Raid } from "./systems/Raid";
import { siegeCount, siegeSpot, siegeTonight } from "./systems/Siege";
import { Music, type Mood } from "./systems/Music";
import { AchievementsView } from "./ui/AchievementsView";
import { beaconEffects, inBeaconRange, type BeaconPulse } from "./world/Beacon";
import { WorldStore, newWorldId } from "./systems/WorldStore";
import { WorldEventDirector } from "./world-pulse/WorldEventDirector";
import { OnboardingDirector } from "./onboarding/OnboardingDirector";
import { ensureStarterResourceZone } from "./onboarding/StarterResourceZone";
import type { WorldAI } from "./ai/types";
import { startSource } from "./worlds/startWorld";
import { CURRENT_GEN } from "./worldgen/WorldGenerator";
import type { DimensionSave, EffectId, SaveData, WorldSource } from "./types";
import { sim } from "./net/sim";
import { NetGame, type NetRoom } from "./net/NetGame";
import type { DiffStore } from "./net/DiffStore";
import type {
  RoomSettings,
  Welcome,
  WorldMeta,
  WorldState,
} from "./net/protocol";
import {
  difficulty,
  parseDifficulty,
  setDifficulty,
} from "./systems/Difficulty";

/** Автосейв текущего мира в «Мои миры», секунд игры. */
const AUTOSAVE_EVERY = 30;
/** Восемь клеток вокруг (сначала стороны, потом углы) — где встать у якоря возрождения. */
const AROUND: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

export interface GameOptions {
  /** ИИ-генерация миров (client.ai). null/нет — только путь без ИИ. */
  ai?: WorldAI | null;
  /**
   * Сетевая игра — через систему мультиплеера лобби (ctx.multiplayer). `openForFriends` открывает в
   * лобби «Создать комнату» с этой игрой. null/нет — системы нет, игра только одиночная.
   */
  online?: { available(): boolean; openForFriends(): void } | null;
  /** Имя игрока в сетевой игре (профиль); нет — «Игрок». */
  playerName?: () => string;
}

export class Game {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  private _resizeObserver: ResizeObserver;
  /** Снимает разом все DOM-подписки игры (document/window/канвас) в destroy(). */
  private readonly _abort = new AbortController();
  atlas: TextureAtlas;
  intents: IntentQueue;
  world: ChunkManager;
  player: Player;
  inventory: Inventory;
  entities: EntityManager;
  /** Блоки без опоры (факел, растение, дверь) ломаются вслед за соседом. */
  blockUpdates: BlockUpdates;
  /** Состояние клеток текущего измерения: сундуки, печи… */
  blockEntities: BlockEntities;
  /** Лучи светящих маяков. */
  beams: BeaconBeams;
  /** Предметы, выставленные в рамках. */
  displays: DisplayItems;
  /** Надписи на табличках. */
  signs: SignText;
  banners: Banners;
  armorStands: ArmorStand;
  fireworks: Fireworks;
  /** Достижения мира (systems/Achievements) и музыка (systems/Music). */
  achievements: Achievements;
  music: Music;
  /** Измерение, в котором игрок, и снимки остальных (дифы, сущности) до возвращения в них. */
  dimension: DimensionId = "overworld";
  readonly dims = new Map<DimensionId, DimensionSave>();
  interaction: Interaction;
  /** Вода и лава. */
  fluids: FluidSim;
  dayNight: DayNight;
  /** Дождь и гроза (только в измерениях с небом). */
  weather: Weather;
  /** Секунды в портале; lock — не переносить снова, пока игрок не вышел из портала прибытия. */
  _portalT = 0;
  _portalLock = false;
  /** Известные порталы: обратный путь выводит к своему порталу (в верхнем мире — в 128 блоках). */
  portals = portalsOf(null);
  /** Предел: кристаллы и дракон поставлены, дракон убит, титры показаны (сейв v3, `beyond`). */
  /** Предел: кристаллы и дракон поставлены, дракон убит, титры показаны, где Врата (после победы). */
  beyondState: {
    initialized: boolean;
    dragonKilled: boolean;
    creditsShown: boolean;
    gateway: [number, number, number] | null;
  } = {
    initialized: false,
    dragonKilled: false,
    creditsShown: false,
    gateway: null,
  };
  audio: Audio;
  input: Input;
  armView: ArmView;
  save: SaveSystem;
  worldPulse: WorldEventDirector;
  onboarding: OnboardingDirector;
  hud: HUD;
  invUI: InventoryUI;
  worldUI: CreateWorldUI;
  /** Экран «Сетевая игра» и список игроков по Tab. */
  netUI: NetUI;
  /** Команды консоли и чат (T, /). */
  commands: Commands;
  chat: ChatConsole;
  /** Ввод текста таблички. */
  signEditor: SignEditor;
  bookScreen: BookScreen;
  nameEditor: NameEditor;
  /** Сенсорное управление — только на устройствах с пальцем (или ?touch=1). */
  touch: TouchControls | null;
  playing: boolean;
  private _time: number;
  loop: GameLoop;
  /** Текущий мир в «Моих мирах». Классический стартовый мир — "default". */
  worldId = "default";
  worldName = "VoxelCraft";
  /** Хранилище миров; null — браузер не даёт IndexedDB (игра работает без сохранения). */
  store: WorldStore | null = null;
  private _autosaveT = 0;
  /** Был ли день на прошлом тике — рассвет пополняет товар жителей. */
  private _wasDay = true;
  /** Деревни, в которые уже поселены жители (id региона; сейв v3, `villages`). */
  villagesSettled = new Set<string>();
  private _villageT = 0;
  /** Ночей без сна (сейв v3 `daysAwake`); _slept — спал этой ночью. */
  daysAwake = 0;
  private _slept = false;
  /** Карты мира по номеру (systems/Maps; сейв v3 `maps`). */
  maps = new Map<number, MapData>();
  nextMapId = 1;
  private _mapT = 0;
  private _mapPhase = 0;
  /** Для компаратора: блочная сущность клетки текущего измерения. */
  private readonly _containerAt = (x: number, y: number, z: number) =>
    this.blockEntities.get(x, y, z);
  /** Игрок уже сменил мир до того, как открылось хранилище, — не подменять его последним сейвом. */
  private _worldTouched = false;
  private _destroyed = false;

  // ---- сетевая игра (net/NetGame) ----
  /** Идёт сетевая игра (хост или гость); null — одиночная. */
  net: NetGame | null = null;
  /** Система мультиплеера лобби; нет — сетевой игры нет, кнопки для неё не рисуются. */
  readonly online: { available(): boolean; openForFriends(): void } | null;
  /** Последний мир восстановлен из «Моих миров» (или его нет) — хосту открывать сеть можно. */
  readonly restored: Promise<void>;
  private _restored!: () => void;
  /** Имя этого игрока для других (профиль SDK). */
  readonly playerName: () => string;
  /**
   * Хост: сохранённые игроки сетевой игры по userId (позиция, инвентарь, опыт…). Лежат в сейве мира
   * хоста (`players`): вернувшийся игрок продолжает с тем же инвентарём и там же.
   */
  netPlayers = new Map<string, unknown>();
  /** Лёг спать в сетевой игре: ночь пропускается, когда спят все (как в Minecraft). */
  netSleeping = false;
  /** Мир, в котором игрок был до входа в чужую игру: вернуться в него при выходе. */
  private _soloWorldBeforeNet: string | null = null;

  /** Этот процесс считает своё измерение (одиночная игра, хост, владелец измерения) — net/sim. */
  get simulating(): boolean {
    return sim.authority;
  }

  constructor(opts: GameOptions = {}) {
    this.online = opts.online ?? null;
    this.restored = new Promise<void>((r) => (this._restored = r));
    this.playerName = opts.playerName ?? (() => "Игрок");
    // --- рендер ---
    const canvas = document.getElementById("game") as HTMLCanvasElement;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Казуальная картинка: Neutral-тонмаппинг держит насыщенность ярких цветов (ACES их смывает).
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = CONFIG.graphics.exposure;
    this.renderer.shadowMap.enabled = CONFIG.graphics.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // мягкость — shadow.radius (PCFSoft в r185 устарел)
    // Карту теней обновляем сами, раз за кадр (см. frame): теневой проход фильтрует объекты по
    // слоям камеры, и второй проход (рука) перерисовал бы её заново — из одной руки.
    this.renderer.shadowMap.autoUpdate = false;
    this.scene = new THREE.Scene();
    // Пропорции выставит первый же замер ResizeObserver'а — до него кадров не будет.
    this.camera = new THREE.PerspectiveCamera(
      75,
      1,
      0.1,
      CONFIG.renderDistance * 16 + 60,
    );
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera); // рука прикреплена к камере

    // Размер берём из раскладки самого канваса (CSS растягивает его на вьюпорт), а не из
    // window.innerWidth, и через ResizeObserver, а не событие resize: игра может стартовать
    // в ещё не разложенном контейнере — фоновая вкладка или iframe превью, — где на момент
    // конструктора innerWidth равен нулю. Событие resize там уже не придёт, и канвас навсегда
    // остался бы 0x0: симуляция живая, экран чёрный. ResizeObserver сам отдаёт первый замер,
    // как только раскладка появляется.
    this._resizeObserver = new ResizeObserver(() => this._resize());
    this._resizeObserver.observe(canvas);
    this._resize();

    // --- контент: атлас и иконки из одних и тех же процедурных текстур ---
    this.atlas = new TextureAtlas();
    buildIcons(this.atlas);

    // --- системы ---
    this.intents = new IntentQueue();
    this.world = new ChunkManager(this.scene, this.atlas, startSource());
    this.player = new Player(this.world);
    this.inventory = new Inventory();
    this.entities = new EntityManager(
      this.scene,
      this.world,
      this.atlas,
      this.player,
      this.inventory,
    );
    this.blockUpdates = new BlockUpdates(() => this.world, this.entities);
    // броня из инвентаря гасит урон игрока и изнашивается от ударов
    this.player.armorStats = () => this.inventory.armorStats();
    this.player.onArmorHit = (dmg) => this.inventory.damageArmor(dmg);
    this.player.canGlide = () => this.inventory.canGlide();
    this.player.tryTotem = () => {
      if (this.inventory.heldItem()?.item !== "life_totem") return false;
      this.inventory.consumeHeld(1);
      return true;
    };
    this.player.onGlideWear = () => this.inventory.wearWings();
    this.blockEntities = new BlockEntities(() => this.world, this.entities);
    this.beams = new BeaconBeams(this.scene);
    this.displays = new DisplayItems(this.scene, this.atlas);
    this.signs = new SignText(this.scene);
    this.banners = new Banners(this.scene);
    this.armorStands = new ArmorStand(this.scene, this.atlas);
    this.fireworks = new Fireworks(this.scene);
    this.achievements = new Achievements({
      has: (pred) => this.inventory.slots.some((s) => !!s && pred(s.item)),
      wearing: (pred) => this.inventory.armor.some((s) => !!s && pred(s.item)),
      effect: (id) => this.player.effects.has(id as EffectId),
    });
    this.interaction = new Interaction(
      this.world,
      this.player,
      this.inventory,
      this.intents,
      this.scene,
      this.atlas,
      this.entities,
    );
    this.fluids = new FluidSim(this.world);
    this.dayNight = new DayNight(this.scene, this.renderer);
    this.weather = new Weather(this.scene);
    const start = this.world.source;
    if (start.kind === "spec") {
      this.dayNight.setTimeOfDay(start.spec.ambience.timeOfDay);
      this.worldName = start.spec.name;
    }
    this.audio = new Audio();
    this.worldPulse = new WorldEventDirector(this);
    this.music = new Music(this.audio);
    // пластинка в проигрывателе играет свою мелодию (сид и лад — systems/Disc), вынули — тишина
    events.on("discPlay", ({ mood, seed }: { mood: Mood; seed: number }) =>
      this.music.play(mood, seed),
    );
    events.on("discEject", () => this.music.stop());
    this.input = new Input(canvas, this.intents, this._abort.signal);
    this.armView = new ArmView(this.camera, this.atlas);
    // второй проход (рука) видит только свой слой — свет мира включаем и на нём
    this.dayNight.sun.layers.enable(ARM_LAYER);
    this.dayNight.hemi.layers.enable(ARM_LAYER);
    this.save = new SaveSystem(this);
    this.hud = new HUD(this);
    new AchievementsView(this.hud.heartsEl.parentElement!, this.achievements);
    this.invUI = new InventoryUI(this, this._abort.signal);
    this.onboarding = new OnboardingDirector(this);
    this.worldUI = new CreateWorldUI(this, this._abort.signal, opts.ai ?? null);
    this.netUI = new NetUI(this, this._abort.signal);
    this.commands = new Commands(this);
    this.chat = new ChatConsole(this, this._abort.signal);
    this.signEditor = new SignEditor(this, this._abort.signal);
    this.bookScreen = new BookScreen(this, this._abort.signal);
    this.nameEditor = new NameEditor(this, this._abort.signal);
    this.touch = touchWanted()
      ? new TouchControls(this, this._abort.signal)
      : null;
    this.interaction.onCommand = (text) => this.commands.run(text);
    this.interaction.mayToggleMode = () => !this.net || this.net.canCheat;
    this.interaction.onUseMap = () => this.createMap();
    // опыт из печи (и других источников, что не кидают сферы)
    events.on("xpGain", ({ amount }: { amount: number }) =>
      this.player.addXp(amount),
    );
    events.on("playerDied", () => this._onDeath());
    events.on("portalLit", (d: { x: number; y: number; z: number }) =>
      this._rememberPortal(this.dimension, d.x, d.y, d.z),
    );
    events.on("throwEye", (d: { x: number; y: number; z: number }) =>
      this._throwEye(d.x, d.y, d.z),
    );
    events.on("dragonDefeated", () => this._dragonDefeated());
    events.on("ui:useBed", (d: { x: number; y: number; z: number }) =>
      this._useBed(d.x, d.y, d.z),
    );
    events.on("lightning", (d: { x: number; y: number; z: number }) =>
      this._lightning(d.x, d.y, d.z),
    );
    // упавший сталактит бьёт того, кто под ним, и рассыпается острым капельником
    events.on(
      "dripstoneFall",
      (p: { x: number; y: number; z: number; landY: number }) => {
        const pl = this.player;
        if (
          !pl.dead &&
          Math.floor(pl.pos.x) === p.x &&
          Math.floor(pl.pos.z) === p.z &&
          pl.pos.y <= p.y &&
          pl.pos.y >= p.landY - 0.5
        )
          pl.damage(dripstoneFallDamage(p.y - pl.pos.y), "falling_stalactite");
        this.entities.spawnDrop(
          p.x + 0.5,
          p.landY + 0.2,
          p.z + 0.5,
          "pointed_dripstone",
          1,
        );
      },
    );
    // находка из-под кисти — над расчищенным блоком
    events.on(
      "brushLoot",
      (p: { x: number; y: number; z: number; item: string; count: number }) =>
        this.entities.spawnDrop(
          p.x + 0.5,
          p.y + 1.1,
          p.z + 0.5,
          p.item,
          p.count,
        ),
    );
    // дроп, который роняет сам моб (рог козы)
    events.on(
      "mobDrop",
      (p: { x: number; y: number; z: number; item: string }) =>
        this.entities.spawnDrop(p.x, p.y, p.z, p.item, 1),
    );
    // глубокая тьма: сломанные и поставленные игроком блоки и взрывы — вибрации; смерть рядом с
    // катализатором — скалк; место смерти игрока — для компаса возвращения
    const overworld = () => this.dimension === "overworld";
    events.on(
      "blockBreak",
      (p: { x: number; y: number; z: number; byPlayer?: boolean }) => {
        if (overworld())
          this.sculk.vibrate(
            p.x + 0.5,
            p.y + 0.5,
            p.z + 0.5,
            !!p.byPlayer && this.player.mode !== "creative",
          );
      },
    );
    // Жемчуг Предела упал: игрока переносит туда, и он расшибается, как в Minecraft; изредка из
    // точки вылезает клещ Предела (registry/mobs/beyond)
    events.on("pearlLand", (p: { x: number; y: number; z: number }) => {
      const pl = this.player;
      if (pl.dead) return;
      this.warmup(p.x, p.z);
      let y = Math.floor(p.y);
      while (
        y > 1 &&
        !this.world.isSolid(Math.floor(p.x), y - 1, Math.floor(p.z)) &&
        y > Math.floor(p.y) - 4
      )
        y--;
      pl.pos.set(Math.floor(p.x) + 0.5, y, Math.floor(p.z) + 0.5);
      pl.vel.set(0, 0, 0);
      pl._fallDist = 0;
      if (pl.mode !== "creative") pl.damage(5, "teleport");
      events.emit("pearlTeleport", { x: pl.pos.x, y: pl.pos.y, z: pl.pos.z });
      if (Math.random() < 0.05)
        this.entities.spawnMob("rim_mite", pl.pos.x, pl.pos.y, pl.pos.z);
    });
    // фейерверк с земли: ракета взлетает и рассыпается искрами (gfx/Fireworks)
    events.on("fireworkLaunch", (p: { x: number; y: number; z: number }) =>
      this.fireworks.launch(p.x, p.y, p.z),
    );
    // компас по путевому камню: стрелка держится за него, пока камень цел (ui/HUD)
    events.on("lodestoneBind", (p: { x: number; y: number; z: number }) => {
      this.player.lodestone = { x: p.x, z: p.z, dim: this.dimension };
      this.hud.message("Компас привязан к путевому камню", 2000);
    });
    // якорь возрождения: в Пекле — точка возрождения, в верхнем мире взрывается, как в Minecraft
    events.on(
      "anchorUse",
      (p: { x: number; y: number; z: number; charges: number }) => {
        if (!DIMENSIONS[this.dimension].bedsExplode) {
          this.world.setBlock(p.x, p.y, p.z, B.air!);
          this.entities.explode(p.x + 0.5, p.y + 0.5, p.z + 0.5, 5);
          return;
        }
        if (p.charges <= 0) {
          this.hud.message("Якорь не заряжен — нужен светокамень", 2200);
          return;
        }
        this.player.anchorPos = [p.x, p.y, p.z];
        this.player.anchorDim = this.dimension;
        this.hud.message("Точка возрождения — у якоря", 2200);
      },
    );
    // стрела в мишень — красный сигнал по близости к центру (world/behaviours/extras)
    events.on(
      "arrowHit",
      (p: {
        x: number;
        y: number;
        z: number;
        hx?: number;
        hy?: number;
        hz?: number;
      }) => {
        if (p.hx === undefined || p.hy === undefined || p.hz === undefined)
          return;
        hitTarget(this.world, p.x, p.y, p.z, p.hx, p.hy, p.hz);
      },
    );
    events.on("blockPlace", (p: { x: number; y: number; z: number }) => {
      if (overworld())
        this.sculk.vibrate(
          p.x + 0.5,
          p.y + 0.5,
          p.z + 0.5,
          this.player.mode !== "creative",
        );
    });
    events.on("explosion", (p: { x: number; y: number; z: number }) => {
      if (overworld()) this.sculk.vibrate(p.x, p.y, p.z, false);
    });
    events.on("mobDied", (p: { entity: Mob }) => {
      const e = p.entity;
      if (overworld() && e.hitByPlayerT > 0 && !e.def.warden)
        this.sculk.onDeath(e.pos.x, e.pos.y, e.pos.z, e.def.xp?.[1] ?? 1);
    });
    // моб волны спавнера испытаний убит — засчитать спавнеру
    events.on("mobDied", (p: { entity: Mob }) => {
      const f = p.entity.trialFrom;
      const be = f ? this.blockEntities.get(f[0], f[1], f[2]) : undefined;
      if (be?.type === "trial_spawner") (be.state as TrialState).killed++;
    });
    events.on("playerDied", () => {
      const pp = this.player.pos;
      this.lastDeath = { x: pp.x, y: pp.y, z: pp.z, dim: this.dimension };
    });
    // проводник: игрок в воде в его радиусе получает силу моря (дыхание, ночное зрение, спешка)
    events.on(
      "conduitPulse",
      (p: { x: number; y: number; z: number; range: number }) => {
        const pl = this.player;
        if (
          pl.dead ||
          !pl.inWater ||
          pl.pos.distanceTo(
            new THREE.Vector3(p.x + 0.5, p.y + 0.5, p.z + 0.5),
          ) > p.range
        )
          return;
        for (const id of ["water_breathing", "night_vision", "haste"] as const)
          pl.addEffect(id, 13);
        events.emit("conduitPower");
      },
    );
    // маяк: игрок в зоне получает выбранные силы
    events.on("beaconPulse", (p: BeaconPulse) => {
      const pl = this.player;
      if (pl.dead || !inBeaconRange(p, pl.pos.x, pl.pos.y, pl.pos.z)) return;
      for (const e of beaconEffects(p)) pl.addEffect(e.id, e.seconds, e.level);
    });

    this.playing = false;
    this._time = 0;

    events.on("ui:pause", () => {
      this.playing = false;
      if (this.invUI.open) this.invUI.close();
      this.hud.showOverlay(true);
      void this.persist();
    });
    events.on("ui:resume", () => {
      this.playing = true;
      this.hud.hideOverlay();
    });
    const { signal } = this._abort;
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.code === "Escape" && this.invUI.open) this.invUI.close();
      },
      { signal },
    );
    // редкий случай: лок слетел, оверлея нет — клик по канвасу возвращает захват
    canvas.addEventListener(
      "click",
      () => {
        if (this.playing && !this.input.active && !this.input.uiOpen)
          this.input.requestLock();
      },
      { signal },
    );

    // --- старт мира ---
    this.warmupAtSpawn();
    this.player.spawn();
    if (!ensureStarterResourceZone(this.world, this.player.pos.x, this.player.pos.z))
      this.entities.spawnDrop(this.player.pos.x + 1, this.player.pos.y + 0.5, this.player.pos.z, "oak_log", 1);
    this.onboarding.load();

    this.loop = new GameLoop(this.tick.bind(this), this.frame.bind(this));
    // сетевая игра: скрытая вкладка продолжает считать мир в полном темпе (core/GameLoop)
    this.loop.backgroundTicker = () => this.net !== null;
    this.hud.showOverlay(false);
    this.loop.start();

    // «Мои миры»: открыть хранилище и продолжить последний мир, если игрок ещё не начал другой
    void WorldStore.open()
      .then(async (store) => {
        if (!store) return;
        if (this._destroyed) return store.close();
        this.store = store;
        const last = await store.lastPlayed().catch(() => undefined);
        if (!last || this._worldTouched || this.playing || this._destroyed)
          return;
        try {
          this.save.apply(last.save);
          this.worldId = last.id;
          this.worldName = last.name;
          this.hud.message("Продолжаем мир «" + last.name + "»", 2200);
        } catch {
          // повреждённый сейв не должен ломать запуск — остаёмся в стартовом мире
        }
      })
      .finally(() => this._restored());
  }

  /** Сохранить текущий мир в «Мои миры» (без хранилища — ничего). Гость чужой мир не сохраняет. */
  async persist(): Promise<void> {
    if (!this.store || this._netGuest) return;
    this.net?.collectPlayerStates(this.netPlayers);
    try {
      await this.store.put({
        id: this.worldId,
        name: this.worldName,
        updatedAt: Date.now(),
        save: this.save.collect(),
      });
    } catch {
      // квота/запрет хранилища: игра продолжается без автосейва
    }
  }

  /** Открыть мир из «Моих миров». */
  async openStoredWorld(id: string): Promise<boolean> {
    if (!this.store) return false;
    const w = await this.store.get(id).catch(() => undefined);
    if (!w) return false;
    if (id !== this.worldId) await this.persist();
    try {
      this.save.apply(w.save);
    } catch {
      return false;
    }
    this._worldTouched = true;
    this.worldId = w.id;
    this.worldName = w.name;
    return true;
  }

  /**
   * Мир из Мастерской: становится НОВОЙ записью в «Моих мирах» — правки игрока не трогают ни
   * публикацию, ни прежний открытый мир (он сохраняется таким, каким его оставили).
   * false — сейв не читается (повреждён или от несовместимой версии), мир остаётся прежним.
   */
  openSharedWorld(save: SaveData, name: string): boolean {
    // persist() снимает сейв синхронно при вызове — до apply ниже, поэтому уходит именно старый мир.
    void this.persist();
    try {
      this.save.apply(save);
    } catch {
      return false;
    }
    this.adoptNewWorld(name);
    this.hud.message("Мир «" + name + "» из Мастерской", 2200);
    return true;
  }

  /** Мир сменился на новый (импорт сейва, новый сид, рецепт): новая запись в «Моих мирах». */
  adoptNewWorld(name: string) {
    this._worldTouched = true;
    this.worldId = newWorldId();
    this.worldName = name;
    void this.persist();
  }

  // ---- сетевая игра (net/NetGame) ---------------------------------------------------------------

  /** Гость в чужом мире: мир не наш — не сохраняем его в «Мои миры» (до передачи хоста). */
  private _netGuest = false;

  /** Мир для входящего гостя: источник, палитра, время, погода, сложность, Предел, порталы. */
  netWorldMeta(): WorldMeta {
    return {
      source: this.world.source,
      palette: BLOCKS.map((b) => b.name),
      time: this.dayNight.serialize(),
      weather: this.weather.serialize(),
      difficulty: difficulty(),
      beyond: this.beyondState,
      portals: this.portals,
      daysAwake: this.daysAwake,
      name: this.worldName,
    };
  }

  /** Общее состояние мира (хост раз в 5 с): время, погода, сложность, Предел. */
  netWorldState(): WorldState {
    return {
      time: this.dayNight.serialize(),
      weather: this.weather.serialize(),
      difficulty: difficulty(),
      beyond: this.beyondState,
      daysAwake: this.daysAwake,
    };
  }

  applyNetWorldState(w: WorldState): void {
    this.dayNight.deserialize(w.time as SaveData["time"]);
    this.weather.deserialize(w.weather as SaveData["weather"]);
    setDifficulty(parseDifficulty(w.difficulty) ?? "normal");
    this.mergeBeyond(w.beyond);
    if (typeof w.daysAwake === "number" && w.daysAwake >= 0)
      this.daysAwake = w.daysAwake;
  }

  /** Предел: победа над драконом и Врата — однажды случившись, не отменяются (слияние «или»). */
  mergeBeyond(b: unknown): void {
    if (!b || typeof b !== "object") return;
    const s = b as Partial<Game["beyondState"]>;
    const st = this.beyondState;
    st.initialized ||= s.initialized === true;
    st.dragonKilled ||= s.dragonKilled === true;
    st.creditsShown ||= s.creditsShown === true;
    if (
      !st.gateway &&
      Array.isArray(s.gateway) &&
      s.gateway.length === 3 &&
      s.gateway.every(Number.isFinite)
    )
      st.gateway = [s.gateway[0]!, s.gateway[1]!, s.gateway[2]!];
  }

  /** Сейв этого игрока для мира хоста: позиция, измерение, инвентарь, опыт, эффекты. */
  netPlayerState(): Record<string, unknown> {
    const p = this.player.pos;
    return {
      ...this.player.serialize(),
      inventory: this.inventory.serialize(),
      dim: this.dimension,
      pos: [p.x, p.y, p.z],
      beyond: this.beyondState,
    };
  }

  /** Ночь пропущена: спали все (сетевая игра) или один (одиночная). */
  skipNight(): void {
    this.dayNight.resetToMorning();
    this.weather.set("clear"); // сон пережидает и непогоду, как в Minecraft
    this._slept = true;
    this.daysAwake = 0;
    this.netSleeping = false;
    this.hud.message("Доброе утро!", 1800);
    events.emit("slept");
  }

  /**
   * Гость: мир хоста вместо своего. Свой уходит в «Мои миры» и вернётся при выходе. Все измерения
   * строятся из присланных дифов — порталы работают без ожидания.
   */
  loadNetWorld(w: Welcome, diffs: DiffStore, settings: RoomSettings): void {
    void this.persist();
    this._soloWorldBeforeNet = this.worldId;
    this._netGuest = true;
    // сейвы чужих игроков — от СВОЕГО прежнего мира: стань мы хостом этого, они бы переехали в него
    this.netPlayers = new Map();
    this._worldTouched = true;
    if (this.invUI.open) this.invUI.close();
    const dim = isDimensionId(w.spawn.dim) ? w.spawn.dim : "overworld";
    const src = worldSourceOf({
      world: w.world.source,
      seed: 0,
    } as unknown as SaveData);
    this.dims.clear();
    for (const d of ["overworld", "inferno", "beyond"] as const)
      if (d !== dim)
        this.dims.set(d, {
          chunks: diffs.toChunkDiffMap(d),
          entities: [],
          blockEntities: [],
        });
    this.rebuildWorld(src, dim);
    this.world.loadDiffs(diffs.toChunkDiffMap(dim));
    this.entities.clear();
    this.blockEntities.clear();
    this.applyNetWorldState({ ...w.world });
    this.portals = portalsOf(w.world.portals);
    this.villagesSettled = new Set();
    this.maps = new Map();
    this.nextMapId = 1;
    this.achievements.load([]);
    const state = w.state as
      (Record<string, unknown> & { inventory?: unknown }) | null;
    if (state && Array.isArray((state as { pos?: unknown }).pos)) {
      this.player.deserialize(
        state as unknown as Parameters<Player["deserialize"]>[0],
      );
      this.inventory.deserialize(
        state.inventory as Parameters<Inventory["deserialize"]>[0],
      );
    } else {
      this.player.resetForNewWorld();
      this.inventory.deserialize({
        slots: new Array(36).fill(null),
        hotbarIndex: 0,
      });
      this.player.mode = settings.guestMode;
    }
    const [x, y, z] = w.spawn.pos;
    this.warmup(x, z);
    this.player.pos.set(x, y, z);
    this.player.vel.set(0, 0, 0);
    this.player._fallDist = 0;
    if (!state) this.player.spawnPoint.set(x, y, z);
    this.onboarding.load(undefined, true);
    this.worldName = "Сетевая игра";
    this._netWorldName =
      typeof w.world.name === "string" && w.world.name.trim()
        ? w.world.name.trim().slice(0, 60)
        : "";
    this.hud.message("Вы в сетевой игре", 2200);
    events.emit("dimensionChanged", { dimension: dim });
  }

  /** Стал хостом после ухода прежнего: этот мир теперь наш — новой записью в «Моих мирах». */
  adoptNetWorldAsOwn(): void {
    this._netGuest = false;
    // имя мира хоста, а не безликое «Сетевой мир»: при переносе мир остаётся тем же миром
    this.adoptNewWorld(this._netWorldName || "Сетевой мир");
  }
  private _netWorldName = "";

  /**
   * Комната пришла из лобби (хост нажал «Играть», или игрок вошёл в уже идущую игру). Хост открывает
   * свой мир — последний, «Моих миров»; гость получает мир хоста. Ошибка — строка для игрока, и
   * комната закрывается: полуначатая сетевая игра хуже одиночной.
   */
  async acceptRoom(room: NetRoom): Promise<void> {
    if (this.net || this._destroyed) return;
    await this.restored;
    const res = await NetGame.fromRoom(this, room, this.playerName());
    if (typeof res === "string") {
      this.hud.message(friendlyNetError(res), 3200);
      await room.leave();
      return;
    }
    this.net = res;
    events.emit("net:roster");
    if (room.isHost && !room.lateJoin)
      this.hud.message("Мир открыт для друзей", 2200);
    this.startPlay();
  }

  /**
   * Сетевая игра закончилась. Гость возвращается в свой мир; хост (и ставший хостом) продолжает
   * в этом мире один. `reason` — показать почему (исключили, хост закрыл игру).
   */
  exitNet(reason: string | null): void {
    const guest = this._netGuest;
    this.net = null;
    this._netGuest = false;
    this.netSleeping = false;
    sim.authority = true;
    this.entities.replica = false;
    this.entities.others = () => [];
    this.entities.onLocalSpawn = null;
    this.entities.onRemoteAction = null;
    if (guest) {
      const back = this._soloWorldBeforeNet;
      this._soloWorldBeforeNet = null;
      if (back)
        void this.openStoredWorld(back).then(
          (ok) => ok || this.newWorld((Math.random() * 1e9) >>> 0),
        );
      else this.newWorld((Math.random() * 1e9) >>> 0);
    }
    if (reason) this.hud.message(reason, 3500);
    events.emit("net:roster");
  }

  /** Подгонка рендера под текущую раскладку канваса. Вызывается ResizeObserver'ом. */
  _resize() {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return; // ещё не разложено — придёт следующим замером

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // updateStyle=false: размерами канваса управляет CSS (#game { position: fixed; inset: 0 }),
    // инлайновый стиль от three конфликтовал бы с ним.
    this.renderer.setSize(w, h, false);
  }

  /** Синхронная прогенерация зоны вокруг точки (старт/телепорт/импорт). */
  warmup(x: number, z: number) {
    for (let i = 0; i < 200; i++) {
      this.world.update(x, z);
      const busy =
        this.world.genQueue.length > 0 ||
        [...this.world.chunks.values()].some(
          (c) => c.generated && (c.dirty || c.waterDirty),
        );
      if (!busy) break;
    }
  }

  /** Прогрузка вокруг точки спавна текущего мира (подсказка генератора). */
  warmupAtSpawn() {
    const s = this.world.generator.spawnHint();
    this.warmup(s.x, s.z);
  }

  /** Пересоздание мира под источник (сид или рецепт) и измерение: регенерация/импорт/портал. */
  rebuildWorld(source: WorldSource, dimension: DimensionId = this.dimension) {
    this.world.clear();
    this.world = new ChunkManager(this.scene, this.atlas, source, dimension);
    this.dimension = dimension;
    this.blockEntities.clear();
    this.player.world = this.world;
    this.entities.world = this.world;
    this.interaction.world = this.world;
    this.fluids.world = this.world;
    this.fluids.clear();
    this.interaction.breaking = null;
    this.interaction.damage.clear(); // трещины старого мира не должны лечь на блоки нового
    this.interaction.eating = null;
    this.intents.clear();
  }

  /** Полностью новый мир: чистые инвентарь, сущности, время. Число — классический мир по сиду. */
  newWorld(source: WorldSource | number) {
    const src: WorldSource =
      typeof source === "number"
        ? { kind: "noise", seed: source, gen: CURRENT_GEN }
        : // новый мир — текущего поколения (у мира из рецепта: цитадель под островом)
          { ...source, gen: source.gen ?? CURRENT_GEN };
    void this.persist(); // старый мир остаётся в «Моих мирах» таким, каким его оставили
    this.dims.clear();
    this.portals = portalsOf(null);
    this.beyondState = {
      initialized: false,
      dragonKilled: false,
      creditsShown: false,
      gateway: null,
    };
    this.villagesSettled = new Set();
    this.achievements.load([]); // достижения — у каждого мира свои, как в Minecraft
    this.maps = new Map();
    this.nextMapId = 1;
    this.daysAwake = 0;
    this.rebuildWorld(src, "overworld");
    this.entities.clear();
    this.worldPulse.load(null);
    this.inventory.deserialize({
      slots: new Array(36).fill(null),
      hotbarIndex: 0,
    });
    if (src.kind === "spec")
      this.dayNight.setTimeOfDay(src.spec.ambience.timeOfDay);
    else this.dayNight.resetToMorning();
    this.warmupAtSpawn();
    this.player.resetForNewWorld(); // кровать, якорь, эффекты, опыт старого мира — не переносятся
    this.freezing.t = 0;
    this.player.spawn();
    if (!ensureStarterResourceZone(this.world, this.player.pos.x, this.player.pos.z))
      this.entities.spawnDrop(this.player.pos.x + 1, this.player.pos.y + 0.5, this.player.pos.z, "oak_log", 1);
    this.onboarding.load();
    const name = src.kind === "spec" ? src.spec.name : "Мир " + src.seed;
    this.adoptNewWorld(name);
    this.hud.message(
      src.kind === "spec"
        ? "Мир «" + src.spec.name + "»"
        : "Новый мир, сид " + src.seed,
      1800,
    );
  }

  /**
   * Перейти в другое измерение (портал, смерть в Пределе): текущее уходит снимком в `dims`,
   * целевое строится из своих дифов, игрок ставится в (x, y, z) целевого измерения.
   */
  changeDimension(target: DimensionId, x: number, y: number, z: number) {
    if (target === this.dimension) return;
    const prev = this.dimension;
    // сетевая игра: целевое измерение — из общей копии дифов (net/NetGame.beforeDimension)
    this.net?.beforeDimension(target);
    this.dims.set(this.dimension, {
      chunks: this.world.serializeDiffs(),
      entities: this.entities.serialize(),
      blockEntities: this.blockEntities.serialize(),
    });
    // прежнее снято (с сущностями — для следующего владельца); теперь роль в новом измерении
    this.net?.prepareDimension();
    const saved = this.dims.get(target);
    this.dims.delete(target);
    this.rebuildWorld(this.world.source, target);
    this.entities.clear();
    if (saved) {
      this.world.loadDiffs(saved.chunks);
      this.entities.deserialize(
        (saved.entities ?? []) as Parameters<EntityManager["deserialize"]>[0],
      );
      this.blockEntities.deserialize(saved.blockEntities);
    }
    this.warmup(x, z);
    this.player.pos.set(x, y, z);
    this.player.vel.set(0, 0, 0);
    this.player._fallDist = 0;
    // сетевая игра: отдать прежнее измерение (если владел) и заявить новое — до любых правок в нём
    this.net?.afterDimension(prev, target);
    this.worldPulse.dimensionChanged();
    events.emit("dimensionChanged", { dimension: target });
  }

  /** Смерть: вещи, броня и опыт выпадают на месте (в выживании), показывается экран смерти. */
  _onDeath() {
    if (this.player.mode !== "creative") {
      const p = this.player.pos;
      const inv = this.inventory;
      for (const s of [...inv.slots, ...inv.armor])
        if (s)
          this.entities.spawnDrop(
            p.x + (Math.random() - 0.5),
            p.y + 0.5,
            p.z + (Math.random() - 0.5),
            s.item,
            s.count,
            s.dmg,
          );
      inv.clearCarried(); // сундук Предела не трогаем — раньше смерть стирала и его
      const xp = Math.min(100, this.player.xpLevel * 7);
      if (xp > 0) this.entities.spawnXp(p.x, p.y + 0.5, p.z, xp);
      this.player.xpLevel = this.player.xpProgress = this.player.xpTotal = 0;
    }
    if (this.invUI.open) this.invUI.close();
    // чат, табличка, книга, бирка поверх экрана смерти: их закрытие вернуло бы захват мыши
    this.chat.hide();
    this.signEditor.hide();
    this.bookScreen.hide();
    this.nameEditor.hide();
    this.input.uiOpen = true; // до releaseLock: без паузы — вместо неё экран смерти
    this.input.releaseLock();
    this.hud.showDeath(this.player.lastCause);
  }

  /** Возродиться: у кровати, если она цела, иначе у точки мира; из других измерений — домой. */
  respawnPlayer() {
    if (!this.player.dead) return;
    this.player.respawn(this.goHome());
    this.hud.hideDeath();
    this.input.uiOpen = false;
    this.input.requestLock();
  }

  /**
   * Домой: в верхний мир (из Пекла и Предела — сменой измерения) к кровати, если она цела, иначе к
   * точке мира; возвращает место на полу. Возрождение и выходной портал Предела.
   */
  goHome(): THREE.Vector3 {
    // якорь возрождения сильнее кровати и возвращает в СВОЁ измерение (обычно в Пекло)
    const anchor = this.anchorHome();
    if (anchor) return anchor;
    const s = this.player.spawnPoint;
    let at = new THREE.Vector3(s.x, s.y, s.z);
    let atBed = false;
    const bed = this.player.bedPos;
    if (this.dimension !== "overworld")
      this.changeDimension("overworld", at.x, at.y, at.z);
    if (bed) {
      this.warmup(bed[0], bed[2]);
      if (
        BLOCKS[this.world.getBlock(bed[0], bed[1], bed[2])]?.shape === "bed"
      ) {
        at = new THREE.Vector3(bed[0] + 0.5, bed[1] + 0.6, bed[2] + 0.5);
        atBed = true;
      } else {
        this.player.bedPos = null;
        this.hud.message("Ваша кровать отсутствует или заблокирована", 2500);
      }
    }
    this.warmup(at.x, at.z);
    // точку могли застроить — поднимаемся до свободного места на рост
    const bx = Math.floor(at.x),
      bz = Math.floor(at.z);
    let y = Math.floor(at.y);
    while (
      y < 126 &&
      (this.world.isSolid(bx, y, bz) || this.world.isSolid(bx, y + 1, bz))
    )
      y++;
    // …и опускаемся до пола: точка возрождения в воздухе — это смерть от падения сразу после неё
    while (y > 1 && this.world.getBlock(bx, y - 1, bz) === B.air) y--;
    at.y = y;
    // …и не в яме снега-пороха, не в лаве: иначе возрождение сразу ведёт к новой смерти, и так по кругу
    // (точка мира из старых сейвов могла быть записана прямо на дне такой ямы)
    if (!atBed && !isStandable(this.world, bx, y, bz)) {
      const safe = findSafeSpot(this.world, bx, bz, 16);
      if (safe) at = new THREE.Vector3(safe.x + 0.5, safe.y, safe.z + 0.5);
    }
    return at;
  }

  /**
   * Портал: 4 с внутри (в креативе — сразу) → другое измерение, координаты Пекла — /8, как в
   * Minecraft. На той стороне — ближайший портал в 16 блоках или новый; обратно — только выйдя из
   * портала прибытия и зайдя снова.
   */
  _tickPortal(dt: number) {
    const p = this.player.pos;
    const cell = (dy: number) =>
      this.world.getBlock(
        Math.floor(p.x),
        Math.floor(p.y + dy),
        Math.floor(p.z),
      );
    const inBeyond = cell(0) === B.beyond_portal;
    const inside =
      inBeyond || [0, 1].some((dy) => cell(dy) === B.inferno_portal);
    if (!inside || this.player.dead) {
      this._portalT = 0;
      this._portalLock = false;
      return;
    }
    if (this._portalLock) return;
    // портал Предела переносит сразу, как в Minecraft
    if (inBeyond) {
      this._portalLock = true;
      this._beyondTravel();
      return;
    }
    this._portalT += dt;
    if (this._portalT < (this.player.mode === "creative" ? 0.25 : 4)) return;
    this._portalT = 0;
    this._portalLock = true;
    const target: DimensionId =
      this.dimension === "inferno" ? "overworld" : "inferno";
    const k =
      target === "inferno"
        ? 1 / DIMENSIONS.inferno.scale
        : DIMENSIONS.inferno.scale;
    const tx = Math.floor(p.x * k),
      tz = Math.floor(p.z * k);
    // портал, через который уходим, — тоже известный (порталы из сейвов до реестра)
    this._rememberPortal(
      this.dimension,
      Math.floor(p.x),
      Math.floor(p.y),
      Math.floor(p.z),
    );
    // свой портал на той стороне: в верхнем мире ищем в 128 блоках, в Пекле — в 16, как в Minecraft
    const known = this._nearestPortal(
      target,
      tx,
      tz,
      target === "overworld" ? 128 : 16,
    );
    this.changeDimension(
      target,
      (known?.[0] ?? tx) + 0.5,
      70,
      (known?.[2] ?? tz) + 0.5,
    );
    let at = known ? findPortalNear(this.world, known[0], known[2], 2) : null;
    if (known && !at) this._forgetPortal(target, known); // сломали — забываем
    if (!at) {
      if (known) this.warmup(tx, tz);
      at =
        findPortalNear(this.world, tx, tz, 16) ??
        (target === "inferno"
          ? buildPortal(this.world, tx, tz, 64, LAVA_SEA + 2, 110)
          : buildPortal(this.world, tx, tz, 70, 4, 120));
      this._rememberPortal(target, at.x, at.y, at.z);
    }
    this.player.pos.set(at.x + 0.5, at.y, at.z + 0.5);
    this.player.vel.set(0, 0, 0);
    this.player._fallDist = 0;
    events.emit("portalTravel", { dimension: target });
  }

  /** Нажатые плиты: клетка → сколько ещё держать после того, как с неё сошли (сек). */
  private readonly _plates = new Map<string, number>();

  /** Нажимные плиты: пока на плите стоит игрок или моб — сигнал; сошли — через секунду отпускает. */
  _tickPlates(dt: number) {
    const plate = B.stone_pressure_plate;
    if (plate === undefined) return;
    const on = new Set<string>();
    // плиту жмут все, нажимные рельсы — только вагонетки
    const mark = (x: number, y: number, z: number, cart = false) => {
      const bx = Math.floor(x),
        by = Math.floor(y + 0.05),
        bz = Math.floor(z);
      const id = this.world.getBlock(bx, by, bz);
      if (id === plate || (cart && id === B.detector_rail))
        on.add(bx + "," + by + "," + bz);
    };
    if (!this.player.dead)
      mark(this.player.pos.x, this.player.pos.y, this.player.pos.z);
    // сетевая игра: плиту жмут и другие игроки этого измерения
    for (const a of this.entities.others())
      if (!a.player.dead) mark(a.player.pos.x, a.player.pos.y, a.player.pos.z);
    for (const e of this.entities.entities.values())
      if (e.kind === "mob" && !e.dead) mark(e.pos.x, e.pos.y, e.pos.z);
      else if (e.kind === "minecart" && !e.dead)
        mark(e.pos.x, e.pos.y, e.pos.z, true);
    const at = (k: string) =>
      k.split(",").map(Number) as [number, number, number];
    for (const k of on) {
      this._plates.set(k, 1);
      const [x, y, z] = at(k);
      const id = this.world.getBlock(x, y, z),
        m = this.world.getMeta(x, y, z);
      if (id === plate && m === 0) this.world.setBlock(x, y, z, plate, 1);
      else if (id === B.detector_rail && !(m & 0x8))
        this.world.setBlock(x, y, z, id, m | 0x8);
    }
    for (const [k, left] of this._plates) {
      if (on.has(k)) continue;
      if (left - dt > 0) {
        this._plates.set(k, left - dt);
        continue;
      }
      this._plates.delete(k);
      const [x, y, z] = at(k);
      const id = this.world.getBlock(x, y, z);
      if (id === plate) this.world.setBlock(x, y, z, plate, 0);
      else if (id === B.detector_rail)
        this.world.setBlock(x, y, z, id, this.world.getMeta(x, y, z) & ~0x8);
    }
  }

  /** Портал Предела: из верхнего мира — на обсидиановую площадку Предела; из Предела — домой. */
  _beyondTravel() {
    if (this.dimension === "beyond") {
      const s = this.player.spawnPoint;
      this.changeDimension("overworld", s.x, s.y, s.z);
      this.player.pos.copy(this.goHome());
      // первый выход после победы — титры
      if (this.beyondState.dragonKilled && !this.beyondState.creditsShown) {
        this.beyondState.creditsShown = true;
        this.hud.showCredits();
      }
    } else {
      const { x, y, z } = BEYOND_ARRIVAL;
      this.changeDimension("beyond", x + 0.5, y, z + 0.5);
      this._arrivalPlatform();
      if (!this.beyondState.initialized) this._initBeyond();
    }
    this.player.vel.set(0, 0, 0);
    this.player._fallDist = 0;
    events.emit("portalTravel", { dimension: this.dimension });
  }

  /** Первый визит в Предел: Кристаллы на вершины колонн и дракон над островом. */
  _initBeyond() {
    this.beyondState.initialized = true;
    for (const p of beyondPillars(this.world.seed))
      this.entities.spawnMob("beyond_crystal", p.x + 0.5, p.top + 2, p.z + 0.5);
    this.entities.spawnMob("void_dragon", 0, 90, 0);
  }

  /** Площадка 5×5 из обсидиана у BEYOND_ARRIVAL и воздух над ней — заново при каждом прибытии, как в Minecraft. */
  _arrivalPlatform() {
    const { x, y, z } = BEYOND_ARRIVAL;
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++) {
        this.world.setBlock(x + dx, y - 1, z + dz, B.obsidian!);
        for (let dy = 0; dy < 3; dy++)
          this.world.setBlock(x + dx, y + dy, z + dz, B.air!);
      }
    this.player.pos.set(x + 0.5, y, z + 0.5);
  }

  /** Врата Предела с нижней клеткой в (x, y, z): две клетки врат, бедрок сверху и снизу. */
  _placeGateway(x: number, y: number, z: number) {
    this.world.setBlock(x, y - 1, z, B.bedrock!);
    this.world.setBlock(x, y, z, B.beyond_gateway!);
    this.world.setBlock(x, y + 1, z, B.beyond_gateway!);
    this.world.setBlock(x, y + 2, z, B.bedrock!);
  }

  /** Врата на кольце вокруг главного острова — после победы (сейв до врат получает их при визите). */
  _openGateway() {
    const [x, y, z] = gatewaySpot(this.world.seed);
    this.warmup(x, z); // запись в незагруженный чанк пропала бы: победа бывает далеко от врат
    this._placeGateway(x, y, z);
    this.beyondState.gateway = [x, y, z];
  }

  /** Идущий набег на деревню (systems/Raid) или null. Не сохраняется: перезагрузка его прекращает. */
  raid: Raid | null = null;

  /**
   * Набег: игрок с Дурным знамением у заселённой деревни — знамение сгорает, начинается набег. Волны
   * приходят с одного края деревни (в 28–34 блоках от центра) и идут к центру; победа — «Герой
   * деревни» уровня знамения, поражение — все жители в 64 блоках мертвы или вышло время.
   */
  _tickRaid(dt: number) {
    if (this.dimension !== "overworld") return;
    const pl = this.player;
    if (!this.raid) {
      const omen = pl.effects.get("bad_omen");
      if (!omen || pl.dead) return;
      const v = (
        this.world.generator.villagesNear?.(pl.pos.x, pl.pos.z, 48) ?? []
      ).find(
        (x) =>
          this.villagesSettled.has(x.id) &&
          x.residents.some((r) => r.type.startsWith("villager_")),
      );
      if (!v) return;
      pl.effects.delete("bad_omen");
      events.emit("effectsChanged", { id: "bad_omen" });
      this.raid = new Raid({ x: v.x + 0.5, y: v.y, z: v.z + 0.5 }, omen.level);
      events.emit("raidStart", { x: v.x, z: v.z });
      this.hud.message("Набег! Защитите деревню", 3500);
      return;
    }
    const r = this.raid;
    const center = new THREE.Vector3(r.center.x, r.center.y, r.center.z);
    let villagers = 0;
    for (const e of this.entities.entities.values())
      if (
        e.kind === "mob" &&
        !e.dead &&
        e.def.trades &&
        e.pos.distanceTo(center) < 64
      )
        villagers++;
    const res = r.tick(
      dt,
      (id) => {
        const e = this.entities.entities.get(id);
        return e?.kind === "mob" && !e.dead;
      },
      villagers,
    );
    if (res.spawn) {
      const a = Math.random() * Math.PI * 2;
      for (const type of res.spawn) {
        if (!MOBS[type]) continue;
        const d = 28 + Math.random() * 6,
          aa = a + (Math.random() - 0.5) * 0.4;
        const x = Math.floor(center.x + Math.cos(aa) * d),
          z = Math.floor(center.z + Math.sin(aa) * d);
        this.warmup(x, z);
        const m = this.entities.spawnMob(
          type,
          x + 0.5,
          this.world.surfaceY(x, z) + 1.01,
          z + 0.5,
        );
        m.raider = true;
        m.goal = center.clone();
        r.add(m.id, m.def.hp);
      }
      this.hud.message(`Набег: волна ${r.wave} из ${RAID_WAVES}`, 2500);
      events.emit("raidWave", { wave: r.wave });
    }
    if (res.end === "won") {
      pl.addEffect("hero", 2400, r.level);
      events.emit("raidWon", { level: r.level });
      this.hud.message(
        "Набег отбит! Вы — герой деревни: жители уступают в цене",
        4500,
      );
      this.raid = null;
    } else if (res.end === "lost") {
      for (const id of r.raiders) {
        const e = this.entities.entities.get(id);
        if (e?.kind === "mob") {
          e.raider = false;
          e.goal = null;
        }
      }
      events.emit("raidLost");
      this.hud.message("Набег: деревня пала", 3500);
      this.raid = null;
    }
  }

  /** Держим, пока игрок не отойдёт от врат прибытия (иначе они сразу вернули бы его). */
  private _gateLock = false;

  /**
   * Врата Предела: коснулся — с главного острова на внешние острова в ту же сторону (OUTER_LANDING),
   * рядом с местом прибытия встают обратные врата; с внешних островов — к площадке прибытия.
   */
  _tickGateway() {
    if (this.dimension !== "beyond" || this.player.dead) return;
    const g = this.beyondState.gateway;
    if (this.beyondState.dragonKilled && !g) this._openGateway();
    // врата не ломаются: записаны, чанк загружен, а их нет — значит, не встали (сейв до починки)
    else if (g && this.world.getBlockOrUnloaded(g[0], g[1], g[2]) === B.air)
      this._placeGateway(g[0], g[1], g[2]);
    const p = this.player.pos;
    let touching = false;
    for (let x = Math.floor(p.x - 0.5); x <= Math.floor(p.x + 0.5); x++)
      for (let y = Math.floor(p.y); y <= Math.floor(p.y + 1.9); y++)
        for (let z = Math.floor(p.z - 0.5); z <= Math.floor(p.z + 0.5); z++)
          if (this.world.getBlock(x, y, z) === B.beyond_gateway)
            touching = true;
    if (!touching) {
      this._gateLock = false;
      return;
    }
    if (this._gateLock) return;
    this._gateLock = true;
    const toOuter = Math.hypot(p.x, p.z) < OUTER_START / 2;
    if (!toOuter) {
      this.warmup(BEYOND_ARRIVAL.x, BEYOND_ARRIVAL.z);
      this._arrivalPlatform();
    } else {
      const a = Math.atan2(p.z, p.x);
      const tx = Math.round(Math.cos(a) * OUTER_LANDING),
        tz = Math.round(Math.sin(a) * OUTER_LANDING);
      this.warmup(tx, tz);
      const gen = this.world.generator;
      const land =
        gen instanceof BeyondGenerator ? gen.landingNear(tx, tz, 96) : null;
      const x = land?.x ?? tx,
        z = land?.z ?? tz;
      let y = land?.y ?? ISLAND_Y;
      if (land) {
        this.warmup(x, z);
        while (
          y < 120 &&
          (this.world.isSolid(x, y, z) || this.world.isSolid(x, y + 1, z))
        )
          y++;
      } else
        // островов рядом нет — площадка из камня Предела, как в Minecraft
        for (let dx = -2; dx <= 2; dx++)
          for (let dz = -2; dz <= 2; dz++)
            this.world.setBlock(x + dx, y - 1, z + dz, B.beyond_stone!);
      this._placeGateway(x + 3, y, z); // обратные врата у места прибытия
      this.player.pos.set(x + 0.5, y, z + 0.5);
      this.hud.message("Внешние острова Предела", 2500);
    }
    this.player.vel.set(0, 0, 0);
    this.player._fallDist = 0;
    events.emit("gatewayTravel", { outer: toOuter });
  }

  /** Дракон повержен: выходной портал в фонтане и яйцо на его колонне. */
  _dragonDefeated() {
    this.beyondState.dragonKilled = true;
    for (const [x, y, z] of exitPortalCells())
      this.world.setBlock(x, y, z, B.beyond_portal!);
    this.world.setBlock(0, ISLAND_Y + 4, 0, B.dragon_egg!);
    this._openGateway();
    this.hud.message(
      "Дракон Предела повержен! Портал домой — в фонтане, Врата на внешние острова — за краем",
      4500,
    );
  }

  /** Бросок Ока Предела: к ближайшей цитадели; в мире без цитаделей Око возвращается в руку. */
  _throwEye(x: number, y: number, z: number) {
    const target = this.world.generator.locate?.("citadel", x, z);
    if (!target) {
      this.hud.message("Око не чувствует цитадели в этом мире", 2200);
      if (this.player.mode !== "creative") this.inventory.add("rim_eye", 1);
      return;
    }
    this.entities.spawnRimEye(new THREE.Vector3(x, y, z), target);
  }

  /** Сетевая игра: реестр порталов изменился здесь — разослать (net/NetGame). */
  onPortalChange:
    | ((dim: DimensionId, p: [number, number, number], add: boolean) => void)
    | null = null;

  /** Запомнить портал: одна запись на портал — рядом с уже известным не дублируем. */
  _rememberPortal(dim: DimensionId, x: number, y: number, z: number) {
    if (this._addPortal(dim, x, y, z))
      this.onPortalChange?.(dim, [x, y, z], true);
  }

  private _addPortal(
    dim: DimensionId,
    x: number,
    y: number,
    z: number,
  ): boolean {
    const list = this.portals[dim];
    const near = list.some(
      ([px, py, pz]) =>
        Math.abs(px - x) <= 3 && Math.abs(py - y) <= 4 && Math.abs(pz - z) <= 3,
    );
    if (!near) list.push([x, y, z]);
    return !near;
  }

  _forgetPortal(dim: DimensionId, p: readonly number[]) {
    this.portals[dim] = this.portals[dim].filter((q) => q !== p);
    this.onPortalChange?.(dim, [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0], false);
  }

  /** Сетевая игра: портал зажгли или сломали у другого игрока. */
  applyNetPortal(dim: DimensionId, p: readonly number[], add: boolean): void {
    const [x = 0, y = 0, z = 0] = p;
    if (add) this._addPortal(dim, x, y, z);
    else
      this.portals[dim] = this.portals[dim].filter(
        (q) => q[0] !== x || q[1] !== y || q[2] !== z,
      );
  }

  /** Ближайший известный портал измерения в квадрате radius вокруг (x, z). */
  _nearestPortal(
    dim: DimensionId,
    x: number,
    z: number,
    radius: number,
  ): [number, number, number] | null {
    let best: [number, number, number] | null = null;
    let bestD = Infinity;
    for (const q of this.portals[dim]) {
      const dx = Math.abs(q[0] - x),
        dz = Math.abs(q[2] - z);
      if (dx > radius || dz > radius) continue;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        best = q;
        bestD = d;
      }
    }
    return best;
  }

  /**
   * Возрождение у заряженного якоря: переносит в его измерение, тратит один заряд. null — якоря
   * нет, он сломан или разряжен (тогда действует обычный путь домой).
   */
  private anchorHome(): THREE.Vector3 | null {
    const a = this.player.anchorPos;
    const dim = this.player.anchorDim;
    if (!a || !dim || !isDimensionId(dim)) return null;
    const [x, y, z] = a;
    if (this.dimension !== dim)
      this.changeDimension(dim, x + 0.5, y + 1, z + 0.5);
    this.warmup(x, z);
    const charges =
      this.world.getBlock(x, y, z) === B.respawn_anchor
        ? anchorCharges(this.world.getMeta(x, y, z))
        : 0;
    if (charges <= 0) {
      this.player.anchorPos = null;
      this.player.anchorDim = null;
      this.hud.message("Якорь возрождения разряжен или сломан", 2500);
      return null;
    }
    this.world.setBlock(x, y, z, B.respawn_anchor!, charges - 1);
    // рядом с якорем, а не в нём: клетка с полом и местом на рост — не лава и не обрыв (в Пекле
    // «не твёрдая» соседняя клетка часто оказывалась озером лавы или пустотой над ним)
    for (const dy of [0, 1, -1])
      for (const [dx, dz] of AROUND) {
        const nx = x + dx,
          ny = y + dy,
          nz = z + dz;
        if (isStandable(this.world, nx, ny, nz))
          return new THREE.Vector3(nx + 0.5, ny, nz + 0.5);
      }
    return new THREE.Vector3(x + 0.5, y + 1, z + 0.5);
  }

  /** ПКМ по кровати: точка возрождения; ночью без монстров рядом — сон до утра. */
  _useBed(x: number, y: number, z: number) {
    if (DIMENSIONS[this.dimension].bedsExplode) {
      // в Пекле и Пределе кровать взрывается, как в Minecraft
      this.world.setBlock(x, y, z, B.air!);
      this.entities.explode(x + 0.5, y + 0.5, z + 0.5, 5);
      return;
    }
    this.player.bedPos = [x, y, z];
    if (this.dayNight.isDay && this.weather.kind !== "thunder") {
      this.hud.message(
        "Спать можно только ночью или в грозу. Точка возрождения — здесь",
        2400,
      );
      return;
    }
    const monsters = [...this.entities.entities.values()].some(
      (e) =>
        e.kind === "mob" &&
        !e.dead &&
        e.def.category === "hostile" &&
        e.pos.distanceTo(this.player.pos) < 8,
    );
    if (monsters) {
      this.hud.message("Нельзя спать — рядом монстры", 2000);
      return;
    }
    // сетевая игра: ночь пропускает хост, когда спят ВСЕ игроки Верхнего мира (net/NetGame)
    if (this.net) {
      this.netSleeping = true;
      this.hud.message("Вы спите. Ночь пройдёт, когда уснут все игроки", 2600);
      return;
    }
    this.skipNight();
  }

  /** ПКМ пустой картой: карта участка вокруг игрока в руку (как в Minecraft; сразу разведан круг). */
  createMap(): void {
    if (this.inventory.heldItem()?.item !== "map") return;
    const p = this.player.pos;
    const m = newMap(this.nextMapId++, p.x, p.z, this.dimension);
    this.maps.set(m.id, m);
    for (let ph = 0; ph < 4; ph++) surveyMap(this.world, m, p.x, p.z, 48, ph);
    const filled = { item: "filled_map", count: 1, tag: { map: m.id } };
    if (this.player.mode !== "creative") this.inventory.consumeHeld(1);
    const i = this.inventory.hotbarIndex;
    if (!this.inventory.slots[i]) this.inventory.setSlot(i, filled);
    else if (this.inventory.addStack(filled) > 0)
      this.entities.spawnDrop(p.x, p.y + 1, p.z, "filled_map", 1);
    events.emit("mapCreated", { id: m.id });
  }

  _trialScanT = 0;
  /** Спавнеры испытаний: раз в секунду завести сущности спавнерам камер рядом и шагнуть их машины. */
  _tickTrials(dt: number): void {
    if (this.dimension !== "overworld") return;
    const p = this.player;
    if ((this._trialScanT -= dt) <= 0) {
      this._trialScanT = 1;
      for (const [x, y, z] of this.world.generator.trialSpawnersNear?.(
        p.pos.x,
        p.pos.z,
        48,
      ) ?? [])
        if (this.world.getBlockOrUnloaded(x, y, z) === B.trial_spawner)
          this.blockEntities.ensure(x, y, z);
    }
    const hunter = !p.dead && p.mode !== "creative";
    for (const be of this.blockEntities.map.values()) {
      if (be.type !== "trial_spawner") continue;
      const mob =
        TRIAL_MOBS[this.world.getMeta(be.x, be.y, be.z) % TRIAL_MOBS.length]!;
      trialStep(be.state as TrialState, {
        dt,
        near:
          hunter &&
          Math.hypot(
            p.pos.x - be.x - 0.5,
            p.pos.y - be.y,
            p.pos.z - be.z - 0.5,
          ) <= TRIAL_RANGE,
        rng: Math.random,
        spawn: () => this._trialSpawn(be.x, be.y, be.z, mob),
        reward: (items) => {
          for (const s of items)
            this.entities.spawnDrop(
              be.x + 0.5,
              be.y + 1.2,
              be.z + 0.5,
              s.item,
              s.count,
            );
          events.emit("trialReward", { x: be.x, y: be.y, z: be.z });
        },
      });
    }
  }

  /** Моб волны спавнера испытаний: клетка с полом и воздухом на рост в 4 блоках от спавнера. */
  _trialSpawn(x: number, y: number, z: number, mob: string): boolean {
    for (let i = 0; i < 10; i++) {
      const sx = x + Math.floor(Math.random() * 9) - 4,
        sz = z + Math.floor(Math.random() * 9) - 4;
      for (let sy = y - 1; sy <= y + 2; sy++) {
        if (!BLOCKS[this.world.getBlock(sx, sy - 1, sz)]?.solid) continue;
        if (
          this.world.getBlock(sx, sy, sz) !== 0 ||
          this.world.getBlock(sx, sy + 1, sz) !== 0
        )
          continue;
        const m = this.entities.spawnMob(mob, sx + 0.5, sy, sz + 0.5);
        m.trialFrom = [x, y, z];
        events.emit("trialSpawn", { x, y, z, mob });
        return true;
      }
    }
    return false;
  }

  freezing = new Freezing();
  /** Снег-порох: холод, урон, иней на экране; кожаные ботинки — снег держит (Player.leatherBoots). */
  _tickFreeze(dt: number): void {
    const p = this.player;
    const armor = this.inventory.armor;
    p.leatherBoots = () => armor.some((s) => s?.item === "leather_boots");
    p.goldArmor = () => armor.some((s) => !!s?.item.startsWith("golden_"));
    // щит принял удар — теряет прочность по урону (как в Minecraft), не меньше 1
    p.onShieldBlock = (n) => {
      if (this.inventory.heldItem()?.item === "shield")
        this.inventory.damageHeld(Math.max(1, Math.floor(n)));
    };
    const leather = armor.some((s) => !!s?.item.startsWith("leather_"));
    const dmg = this.freezing.tick(
      dt,
      p.inPowderSnow && !p.dead,
      leather || p.mode === "creative",
      p.fireT > 0,
    );
    if (dmg) p.damage(dmg, "freeze");
    this.hud.frost(this.freezing.level);
  }

  _hornCd = 0;
  _hornHeld = false;
  /** Козий рог: ПКМ — протрубить (слышно далеко, будит сенсоры скалка), не чаще раза в 7 с. */
  _goatHorn(dt: number): void {
    this._hornCd = Math.max(0, this._hornCd - dt);
    const press =
      this.input.rightDown &&
      !this.player.dead &&
      this.inventory.heldItem()?.item === "goat_horn";
    if (press && !this._hornHeld && this._hornCd <= 0) {
      this._hornCd = 7;
      events.emit("goatHorn");
      const p = this.player.pos;
      if (this.dimension === "overworld")
        this.sculk.vibrate(p.x, p.y, p.z, this.player.mode !== "creative");
    }
    this._hornHeld = press;
  }

  /** Скалк, вибрации и Страж (systems/Sculk.ts) — в верхнем мире. */
  sculk = new Sculk({
    world: () => this.world,
    player: () => this.player,
    wardens: () =>
      [...this.entities.entities.values()].filter(
        (e): e is Mob => e.kind === "mob" && !e.dead && !!e.def.warden,
      ),
    summon: (x, y, z) => {
      const m = this.entities.spawnMob("warden", x, y, z);
      m.emergeT = EMERGE_TIME;
      m.invulnerable = true;
      return m;
    },
  });
  /** Пройдено шагов с последней вибрации (вибрация — каждые 2 блока ходьбы без приседа). */
  _stepDist = 0;
  /** Где игрок умер последний раз — туда указывает компас возвращения (в сейв не пишется). */
  lastDeath: { x: number; y: number; z: number; dim: string } | null = null;

  /** Шаги игрока в верхнем мире — вибрации; наступил на крикуна — он кричит. */
  _tickSculk(dt: number): void {
    if (this.dimension !== "overworld") return;
    this.sculk.tick(dt);
    const p = this.player;
    if (p.dead || p.flying || !p.onGround || p._sneaking) return;
    this._stepDist += Math.hypot(p.vel.x, p.vel.z) * dt;
    if (this._stepDist < 2) return;
    this._stepDist = 0;
    const x = Math.floor(p.pos.x),
      y = Math.floor(p.pos.y),
      z = Math.floor(p.pos.z);
    if (this.world.getBlock(x, y - 1, z) === B.sculk_shrieker)
      this.sculk.shriek(x, y - 1, z);
    this.sculk.vibrate(p.pos.x, p.pos.y, p.pos.z, p.mode !== "creative");
  }

  /** Подзорная труба: ПКМ держать — поле зрения плавно сужается до 10° (как в Minecraft). */
  _spyglass(dt: number): void {
    const on =
      !this.player.dead &&
      this.input.rightDown &&
      this.inventory.heldItem()?.item === "spyglass";
    const want = on ? 10 : 75;
    if (this.camera.fov === want) return;
    this.camera.fov += (want - this.camera.fov) * Math.min(1, dt * 12);
    if (Math.abs(this.camera.fov - want) < 0.1) this.camera.fov = want;
    this.camera.updateProjectionMatrix();
  }

  /** Карта в руке дорисовывает местность вокруг игрока (четверть строк за раз). */
  _surveyHeldMap(): void {
    const h = this.inventory.heldItem();
    // карта сокровищ или исследователя в руке становится картой участка с крестиком над целью:
    // из тега {x, z}, а без него (карта картографа) — ближайшая к игроку цель такого вида
    const kind = h ? EXPLORER_MAPS[h.item] : undefined;
    if (h && kind) {
      let tx = Number(h.tag?.x),
        tz = Number(h.tag?.z);
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) {
        if (this.dimension !== "overworld") return;
        const f = this.world.generator.locate?.(
          kind,
          this.player.pos.x,
          this.player.pos.z,
        );
        if (!f) return;
        tx = f.x;
        tz = f.z;
      }
      const m = newMap(this.nextMapId++, tx, tz, "overworld");
      // карта с целью — по центру цели, а не по сетке карт: иначе ✖ бывает у самого края
      m.x0 = Math.floor(tx) - MAP_SIZE / 2;
      m.z0 = Math.floor(tz) - MAP_SIZE / 2;
      m.target = [tx, tz];
      this.maps.set(m.id, m);
      this.inventory.setSlot(this.inventory.hotbarIndex, {
        item: "filled_map",
        count: 1,
        tag: { map: m.id },
      });
      events.emit("mapCreated", { id: m.id, treasure: true });
      return;
    }
    if (h?.item !== "filled_map") return;
    const m = this.maps.get(Number(h.tag?.map));
    if (!m || m.dim !== this.dimension) return;
    const p = this.player.pos;
    surveyMap(this.world, m, p.x, p.z, 48, this._mapPhase++ & 3);
  }

  /**
   * Ночная осада (systems/Siege): с наступлением ночи к заселённой деревне рядом с игроком выходит
   * отряд зомби с одной стороны. Они охотятся на жителей (MobDef.huntsLand), а убитый житель встаёт
   * зомби-жителем — так зомби-жители появляются в игре сами, без команд. Во время набега осады нет.
   */
  _siege() {
    if (this.dimension !== "overworld" || this.raid) return;
    const p = this.player.pos;
    const v = (this.world.generator.villagesNear?.(p.x, p.z, 72) ?? []).find(
      (x) =>
        this.villagesSettled.has(x.id) &&
        x.residents.some((r) => r.type.startsWith("villager_")),
    );
    if (!v || !siegeTonight()) return;
    const angle = Math.random() * Math.PI * 2;
    let n = 0;
    for (let i = siegeCount(); i > 0; i--) {
      const { x, z } = siegeSpot(v.x + 0.5, v.z + 0.5, angle);
      this.warmup(x, z);
      const y = this.world.surfaceY(x, z);
      if (y <= 0) continue;
      const m = this.entities.spawnMob("zombie", x + 0.5, y + 1.01, z + 0.5);
      // цель — центр деревни: без неё отряд разбредается, не дойдя до жителей (MobBrain, huntsLand)
      m.goal = new THREE.Vector3(v.x + 0.5, v.y, v.z + 0.5);
      n++;
    }
    if (n === 0) return;
    events.emit("siegeStart", { x: v.x, z: v.z, count: n });
    this.hud.message("Ночная осада! Зомби идут к деревне", 3500);
  }

  /**
   * Деревня рядом, в которой ещё никто не живёт: поселить жителей и голема (один раз — список в
   * сейве). Ждёт, пока прогрузятся чанки всех домов, иначе жители упали бы сквозь незагруженное.
   */
  _settleVillages() {
    // деревни верхнего мира и города Предела (панцирники) — один путь: villagesNear генератора
    const p = this.player.pos;
    for (const v of this.world.generator.villagesNear?.(p.x, p.z, 72) ?? []) {
      if (this.villagesSettled.has(v.id)) continue;
      const loaded = v.residents.every(
        (r) =>
          this.world.getBlockOrUnloaded(
            Math.floor(r.x),
            Math.floor(r.y),
            Math.floor(r.z),
          ) !== -1,
      );
      if (!loaded) continue;
      for (const r of v.residents)
        if (MOBS[r.type]) {
          const m = this.entities.spawnMob(r.type, r.x, r.y + 0.01, r.z);
          if (r.captain) m.captain = true;
        }
      this.villagesSettled.add(v.id);
    }
  }

  /** Удар молнии: 5 урона всем в 3 блоках (огонь ставит сама погода). */
  _lightning(x: number, y: number, z: number) {
    const near = (p: THREE.Vector3) =>
      Math.hypot(p.x - x, p.z - z) < 3 && Math.abs(p.y - y) < 4;
    for (const e of this.entities.entities.values())
      if (e.kind === "mob" && !e.dead && near(e.pos)) e.damage(5);
    if (near(this.player.pos)) this.player.damage(5, "lightning");
  }

  startPlay() {
    this.playing = true;
    this.hud.hideOverlay();
    this.audio.unlock();
    this.input.requestLock();
  }

  // ---- симуляция (20 TPS) ----
  tick(dt: number, n: number) {
    // сетевая игра не встаёт на паузе: мир общий, и в меню игрок остаётся в нём (как в Minecraft)
    if (!this.playing && !this.net) return;
    // Кто что считает (net/sim): своё — игрок, его действия, голод, опасности — считает каждый;
    // мир измерения (мобы, жидкости, блоки, машины) — только владелец измерения; погоду и
    // время суток — хост (остальным их присылают, время между присылками идёт само).
    const own = this.simulating;
    const host = !this.net || this.net.isHost;
    this.interaction.tick(dt);
    this.player.tickHunger(dt);
    // спавн мобов зависит от времени суток и погоды: ночью небо «гаснет» до 4, в грозу — и днём
    const sky = DIMENSIONS[this.dimension].hasSky;
    if (host)
      this.weather.tick(
        dt,
        sky && own ? this.world : null,
        this.player.pos.x,
        this.player.pos.z,
      );
    this.world.raining = sky && this.weather.raining;
    this.world.containerAt = this._containerAt;
    this.entities.raining = this.world.raining;
    this.entities.skyDarken = Math.max(
      this.dayNight.skyDarken,
      sky ? this.weather.darken : 0,
    );
    this.entities.isDay = this.dayNight.isDay;
    this.entities.tick(dt); // у реплики — только сглаживание к снимкам владельца
    if (own) this.fluids.tick();
    this.player.tickHazards(dt);
    // черепаший панцирь: над водой копит 10 с Подводного дыхания — под водой их хватает на нырок
    const wb = this.player.effects.get("water_breathing");
    if (
      this.inventory.armor[0]?.item === "turtle_helmet" &&
      !this.player.headInWater &&
      (!wb || wb.time < 9.5)
    )
      this.player.addEffect("water_breathing", 10);
    this._tickPortal(dt);
    this._tickGateway();
    if (own) this._tickRaid(dt);
    this._spyglass(dt);
    if (own) this._tickSculk(dt);
    this._goatHorn(dt);
    this._tickFreeze(dt);
    if (own) {
      this._tickTrials(dt);
      this._tickPlates(dt);
      this.world.tick(); // onTick-блоки, запланированные и случайные тики
      this.blockEntities.tick(dt);
    }
    this.dayNight.tick(dt); // у гостя — между поправками хоста (net WORLD)
    this.onboarding.tick(dt);
    this.worldPulse.tick(dt, host && own);
    // утром жители пополняют товар
    const day = this.dayNight.isDay;
    if (day && !this._wasDay) {
      if (own)
        for (const e of this.entities.entities.values())
          if (e.kind === "mob" && e.def.trades) e.uses = [];
      // ещё одна ночь без сна (сон её обнуляет) — с трёх прилетают фантомы
      if (host) this.daysAwake = this._slept ? 0 : this.daysAwake + 1;
      this._slept = false;
      this.netSleeping = false;
    } else if (!day && this._wasDay && own) this._siege(); // стемнело — может начаться осада деревни
    this.entities.insomnia = this.daysAwake >= 3;
    this._wasDay = day;
    this._villageT += dt;
    if (this._villageT >= 1) {
      this._villageT = 0;
      if (own) this._settleVillages();
    }
    this._mapT += dt;
    if (this._mapT >= 0.25) {
      this._mapT = 0;
      this._surveyHeldMap();
    }
    events.emit("tick", { n });
    this.net?.afterTick();
    this._autosaveT += dt;
    if (this._autosaveT >= AUTOSAVE_EVERY) {
      this._autosaveT = 0;
      void this.persist();
    }
  }

  // ---- кадр ----
  frame(dt: number, alpha: number) {
    this._time += dt;

    if (this.playing) {
      this.music.tick(dt, this.dimension);
      this.player.update(dt, this.input);
      this.interaction.frame(this.input);
      this.interaction.frameTimers(dt);
    }

    // камера из игрока
    const eye = this.player.eyePos;
    this.camera.position.copy(eye);
    this.camera.rotation.set(this.player.pitch, this.player.yaw, 0);

    this.world.update(this.player.pos.x, this.player.pos.z);
    this.entities.updateVisuals(alpha, this._time);
    this.net?.frame(dt);
    this.beams.update(this.blockEntities, this._time);
    this.displays.update(this.blockEntities, this.world);
    this.signs.update(this.blockEntities, this.world);
    this.banners.update(this.blockEntities, this.world);
    this.armorStands.update(this.blockEntities);
    this.fireworks.update(dt);
    this.dayNight.frame(
      this.player.pos,
      this.player.headInLava
        ? "lava"
        : this.player.headInWater
          ? "water"
          : this.player.headInPowderSnow
            ? "powder_snow"
            : "air",
      this.dimension,
      this.player.effects.has("night_vision"),
      DIMENSIONS[this.dimension].hasSky ? this.weather : undefined,
    );
    // Тьма пульсирует: то наползает, то чуть отступает
    if (this.player.effects.has("darkness"))
      this.dayNight.darkness(
        0.75 + 0.25 * Math.abs(Math.sin(this._time * 1.3)),
      );
    this.weather.frame(
      dt,
      eye,
      DIMENSIONS[this.dimension].hasSky ? this.world : null,
    );
    this.worldPulse.frame(dt);

    const walking =
      this.playing &&
      this.player.onGround &&
      (this.input.forward ||
        this.input.back ||
        this.input.left ||
        this.input.right);
    this.armView.frame(dt, this.inventory, walking, this._time);

    // анимация поверхности воды: медленный сдвиг repeat-текстуры
    this.atlas.waterTexture.offset.x = this._time * 0.02;
    this.atlas.waterTexture.offset.y = this._time * 0.013;

    this.hud.frame();
    this.invUI.frame();
    this.renderPasses();
  }

  /** Отрисовка кадра как таковая, без шага симуляции. Вынесена из `frame`, потому что её зовёт ещё
   *  и `capture()`: снимок обязан рисовать РОВНО то же, что игрок видит, а не свою копию проходов. */
  private renderPasses() {
    // Два прохода: мир, затем рука поверх него с чистым depth — иначе вплотную к блоку она уходит
    // внутрь него. Второй проход видит только слой руки (и свет, включённый на этот слой).
    this.renderer.shadowMap.needsUpdate = true; // тени — только в мировом проходе
    this.renderer.render(this.scene, this.camera);
    this.renderer.autoClear = false;
    this.renderer.clearDepth();
    this.camera.layers.set(ARM_LAYER);
    this.renderer.render(this.scene, this.camera);
    this.camera.layers.set(0);
    this.renderer.autoClear = true;
  }

  /**
   * Снимок экрана для кнопки «поделиться» на странице игры.
   *
   * ⚠ Рисует и читает В ОДИН приём. Рендерер создан без `preserveDrawingBuffer` (и так и надо —
   * флаг стоит памяти и копии каждый кадр), поэтому к моменту, когда до канвы доберётся кто-то
   * ещё, буфер уже очищен: `toBlob` вернёт ЧЁРНЫЙ прямоугольник, ничем не пожаловавшись.
   */
  async capture(): Promise<Blob | null> {
    if (this._destroyed) return null;
    this.renderPasses();
    return await new Promise<Blob | null>((resolve) => {
      this.renderer.domElement.toBlob(resolve, "image/png");
    });
  }

  /** Teardown for the host: stop the loop, release the pointer, dispose GPU + observers. Called by
   *  the module's EngineScene when the host destroys the stage. (This engine is authored as a
   *  standalone app; the host adds this so it can live as a composable module.) */
  destroy() {
    // сетевая игра: уйти из комнаты (хост передаёт мир преемнику) — без возврата в свой мир, игра разбирается
    const net = this.net;
    if (net) {
      net.prepareExit();
      net.dispose();
      void net.leaveRoom();
    }
    // последний снимок уходит до разбора мира; дописывается транзакция уже без нас
    void this.persist().finally(() => this.store?.close());
    this.net = null;
    this._destroyed = true;
    this.worldPulse.dispose();
    this.onboarding.dispose();
    this.worldUI.hide();
    this.loop.stop();
    this.input.releaseLock();
    // Шина `events` и DOM-подписки живут дольше игры: хост пересоздаёт Game после перелогина, и
    // без этого старый экземпляр продолжал бы слушать — `E` эмитился дважды (новый инвентарь
    // открывался и тут же закрывался), звуки двоились, весь старый мир держался в памяти.
    this._abort.abort();
    events.clear();
    this.hud.dispose();
    this.netUI.dispose();
    this.chat.dispose();
    this.signEditor.dispose();
    this.bookScreen.dispose();
    this.nameEditor.dispose();
    this.touch?.dispose();
    this.player.dispose();
    this.audio.dispose();
    this._resizeObserver.disconnect();
    this.world.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  /** Pause/resume from the host's Mode Router (only the active mode runs its loop). */
  setRunning(running: boolean) {
    if (running) {
      this.input.enabled = true;
      if (!this.loop.running) this.loop.start();
    } else {
      // сетевая игра: мир общий — у хоста и владельцев измерений он не может встать оттого, что
      // игрок открыл другой режим; останавливается только ввод
      if (!this.net) this.loop.stop();
      this.input.releaseLock();
      this.input.enabled = false; // клавиатура на document — не слушать, пока игрок в другом режиме
      this.playing = false;
    }
  }
}
