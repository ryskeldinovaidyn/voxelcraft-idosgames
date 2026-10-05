// Общие типы, разделяемые между модулями. Плоские data-driven-формы реестров
// (блоки/предметы/мобы/рецепты), стек инвентаря, форма сейва и полезные алиасы.
import type { ChunkManager } from "./world/ChunkManager";
import type { DimensionId } from "./world/Dimensions";
import type { WorldSpec } from "./worldgen/WorldSpec";

/** [x, y, z] — вектор/размер в блоках или пикселях. */
export type Vec3 = [number, number, number];

// ---- блоки ------------------------------------------------------------------

export type ToolType =
  "pickaxe" | "axe" | "shovel" | "hoe" | "sword" | "shears";

/**
 * Форма блока: из неё мешер, коллизия и raycast берут коробки (registry/shapes.ts). Мета блока
 * уточняет форму — сторону, половину, открытость, возраст (registry/meta.ts).
 */
export type BlockShape =
  | "cube"
  | "cross"
  | "liquid"
  | "slab"
  | "stairs"
  | "torch"
  | "door"
  | "trapdoor"
  | "fence"
  | "fence_gate"
  | "pane"
  | "wall"
  | "ladder"
  | "scaffold"
  | "stand"
  | "wall_mounted"
  | "carpet"
  | "crop"
  | "portal"
  | "bed"
  | "chest"
  | "frame"
  | "end_portal"
  | "lever"
  | "button"
  | "repeater"
  | "piston"
  | "piston_head"
  | "hopper"
  | "comparator"
  | "rail"
  | "farmland"
  | "cactus"
  | "snow_layer"
  | "lantern"
  | "fire"
  | "egg"
  | "skull"
  | "rod"
  | "stalk"
  | "campfire"
  | "candle"
  | "pod";

/** Тайлы атласа для граней блока (имена тайлов). */
export interface BlockTex {
  top?: string;
  side?: string;
  bottom?: string;
  front?: string;
  /** Верхняя половина двухблочных форм (дверь) или вторая текстура (открытая печь, спелый посев). */
  upper?: string;
  /** Текстура «включённого» состояния: горящая печь, око в рамке. */
  on?: string;
  /** Плоская иконка предмета, если она не совпадает с гранью (дверь). */
  icon?: string;
}

/** Что выпадает из блока/моба: предмет, количество (или случайно n..max), опциональный шанс. */
export interface BlockDrop {
  item: string;
  n: number;
  max?: number;
  chance?: number;
}

/** Хук тика блока с поведением (печи/конвейеры — задел автоматизации). */
export type BlockTickFn = (
  world: ChunkManager,
  x: number,
  y: number,
  z: number,
  meta: number,
) => void;

export interface BlockDef {
  id: number;
  name: string;
  solid: boolean;
  opaque: boolean;
  cross: boolean;
  liquid: boolean;
  /**
   * Твёрдость по шкале Minecraft: время ломания = hardness × (1.5 если добывается, иначе 5) /
   * скорость подходящего инструмента. 0 — мгновенно, Infinity — неломаемый.
   */
  hardness: number;
  tool: ToolType | null;
  drops: BlockDrop[] | null;
  onTick: BlockTickFn | null;
  tex: BlockTex | null;
  /** Репрезентативный цвет блока (0xRRGGBB): подбор блока по пикселю картинки и миникарта. */
  mapColor: number;
  /** Форма (коробки меша/коллизии). */
  shape: BlockShape;
  /** Столб с осью в мете (бревно): 0 — y, 1 — x, 2 — z; торцы смотрят вдоль оси. */
  axis: boolean;
  /** Свечение 0..15 (факел 14, светокамень 15, лава 15). */
  light: number;
  /** Сколько уровней света гасит блок: 15 — непрозрачный, листва 1, вода 2, стекло 0. */
  filter: number;
  /** Стойкость к взрыву (как blast resistance в Minecraft). */
  resistance: number;
  /**
   * Уровень добычи: 0 — дроп при любом способе; N — только инструментом `tool` уровня ≥ N
   * (1 дерево/золото, 2 камень, 3 железо, 4 алмаз, 5 незерит). Иначе блок ломается без дропа.
   */
  harvest: number;
  /** Падает, если под ним пусто (песок, гравий). */
  gravity: boolean;
  /** Горит (огонь распространяется на него). */
  flammable: boolean;
  /** Постановка блока заменяет его (трава, снежный слой, огонь, жидкость). */
  replaceable: boolean;
  /** Тип блочной сущности (сундук, печь…) или null. */
  blockEntity: string | null;
  /** Нет предмета-двойника (воздух, жидкости, огонь, портал, посевы, половинки дверей). */
  noItem: boolean;
  /** Предмет, которым этот блок ставится и который выбирает креатив (семена для посева), если не свой. */
  item: string | null;
  /** Куб, смотрящий в любую из 6 сторон (раздатчик): мета — DIR6, лицо — tex.front. */
  facing6?: boolean;
  /** Стоит в воде (морская трава): для меша, плавания и спавна клетка — вода, поверх — растение. */
  waterlogged?: boolean;
}

// ---- предметы ---------------------------------------------------------------

export type ArmorSlot = "head" | "chest" | "legs" | "feet";

/**
 * Эффекты игрока: зелья (Сила, Регенерация, Ночное зрение, Скорость, Огнестойкость), маяк (Спешка,
 * Сопротивление, Прыгучесть) и Тление — черепа Пепельного владыки и удар Пепельного скелета.
 */
export type EffectId =
  | "strength"
  | "regeneration"
  | "night_vision"
  | "speed"
  | "fire_resistance"
  | "haste"
  | "resistance"
  | "jump_boost"
  | "decay"
  | "levitation"
  | "water_breathing"
  | "mining_fatigue"
  | "poison"
  | "bad_omen"
  | "hero"
  | "darkness"
  | "slowness"
  | "hunger"
  | "weakness";

/** Питьё: эффект на seconds секунд уровня level; clearsEffects — снять все (молоко). */
export interface DrinkDef {
  effect?: EffectId;
  seconds?: number;
  level?: number;
  clearsEffects?: boolean;
  /** Мгновенно вылечить (Зелье лечения — 4). */
  heal?: number;
  /** Мгновенно ранить (Зелье урона — 6): та же механика наоборот. */
  damage?: number;
  /** Утолить голод (бутылочка мёда — 6): питьё, а не еда — пьётся и сытым. */
  food?: number;
}

export interface ItemDef {
  name: string;
  maxStack: number;
  kind: "block" | "material" | "tool" | "armor";
  toolType: ToolType | null;
  /** Множитель скорости добычи блоков своего `tool` (как в Minecraft: дерево 2 … золото 12). */
  speed: number;
  damage: number;
  blockId: number | null;
  tile: string | null;
  food: number;
  saturation: number;
  /** Уровень инструмента: 1 дерево/золото, 2 камень, 3 железо, 4 алмаз, 5 незерит. */
  tier: number;
  /** Прочность (использований до поломки); 0 — не ломается. */
  durability: number;
  /** Слот брони и её очки защиты / прочность брони. */
  armorSlot: ArmorSlot | null;
  armor: number;
  toughness: number;
  /** Секунды горения в печи (0 — не топливо). */
  fuel: number;
  /** Что остаётся в сетке/руке после использования (ведро молока → ведро). */
  remainder: string | null;
  /** Пьётся (зелья, молоко): что даёт; после питья остаётся remainder (пузырёк, ведро). */
  drink?: DrinkDef;
  /** Съеденное накладывает эффекты (иглобрюх — Отравление II). */
  eatEffects?: { id: EffectId; seconds: number; level?: number }[];
  // Заполняются buildIcons() из атласа после его создания.
  icon?: HTMLCanvasElement;
  iconURL?: string;
}

/** Слот инвентаря / крафт-сетки. */
export interface ItemStack {
  item: string;
  count: number;
  /** Износ (потрачено прочности) у инструментов и брони. */
  dmg?: number;
  /** Доп. данные предмета (зачарования, имя, содержимое) — задел, формат задаёт владелец поля. */
  tag?: Record<string, unknown>;
}

// ---- мобы -------------------------------------------------------------------

export interface MobPart {
  name: string;
  size: Vec3;
  pos: Vec3;
  pivot?: Vec3;
  /** Анимация: legL/legR (шаг), armL/armR, head, wingL/wingR. Одна метка — у скольких угодно частей. */
  anim?: string;
  color: string;
  /** Поворот части в покое (радианы) — руки зомби вперёд. */
  pose?: Vec3;
  /** Светится (глаза Тенехода): не темнеет в темноте. */
  glow?: boolean;
}

export type MobCategory = "passive" | "hostile" | "neutral" | "boss";

export interface MobSpawn {
  /**
   * bright — на траве при свете ≥ 9; dark — при свете блоков 0 и небе ночью/в пещере; any — при
   * любом свете (жители Пекла).
   */
  light: "bright" | "dark" | "any";
  /** Только внутри постройки генератора (адская крепость) — WorldGenerator.structureAt. */
  structure?: string;
  /** На каких блоках появляется (мирные — трава). */
  ground?: readonly string[];
  group: [number, number];
  weight: number;
  dimension?: string;
  /** Только не выше этой высоты (слизни — глубоко под землёй). */
  maxY?: number;
  /** Где появляется, если не на полу: в толще воды (спрут, утопленник) или в воздухе (фантом). */
  medium?: "water" | "air" | "lava";
  /** Только когда игрок не спал три ночи (фантом). */
  insomnia?: boolean;
  /** Только у воды (в 4 блоках) — черепахи на пляжах, а не в пустыне. */
  nearWater?: boolean;
  /** Только в этих биомах (WorldGenerator.biomeOf; мир без биомов — везде). */
  biomes?: readonly string[];
  /** Водный — в пещерных озёрах под землёй, а не у поверхности моря (аксолотль). */
  underground?: boolean;
  /** Только если в 4 блоках есть этот блок (аксолотль — мох пышных пещер). */
  nearBlock?: string;
}

export interface MobDef {
  name: string;
  hp: number;
  walkSpeed: number;
  fleeSpeed: number;
  box: { w: number; h: number };
  /** Устаревшее (было у курицы): где появляется. Теперь — spawn.ground. */
  spawnOn?: string;
  drops: BlockDrop[];
  parts: MobPart[];
  category: MobCategory;
  chaseSpeed?: number;
  /** С какого расстояния замечает игрока. */
  follow?: number;
  /** effect — что удар накладывает на игрока (Пепельный скелет — Тление на 10 с); knock — сила отброса. */
  attack?: {
    damage: number;
    reach: number;
    cooldown: number;
    effect?: { id: EffectId; seconds: number };
    knock?: number;
  };
  /** Разбойник: без игрока рядом охотится на жителей и голема, в набеге идёт к центру деревни. */
  illager?: boolean;
  /** Ворожей: держит дистанцию, призывает бесят и пускает клыки из земли (entities/IllagerBrain). */
  conjurer?: boolean;
  /** Топчет листву и посевы на пути (громила). */
  tramples?: boolean;
  /** Живёт столько секунд [от, до], потом слабеет по 1 в секунду (бесёнок). */
  lifespan?: [number, number];
  ranged?: {
    damage: number;
    speed: number;
    cooldown: number;
    range: number;
    /** Чем стреляет: стрела (по умолчанию), шар Плакальщика (взрыв), малый шар Пламени (поджигает). */
    projectile?:
      | "arrow"
      | "fireball"
      | "small_fireball"
      | "potion"
      | "skull"
      | "bullet"
      | "wind_charge"
      | "snowball"
      | "spit";
    /** Выстрелов за залп (Пламень — 3). */
    volley?: number;
    /** Что стрела накладывает на игрока (зимогор — Замедление на 30 с). */
    effect?: { id: EffectId; seconds: number };
  };
  /** Летает без гравитации и держится на height блоков выше цели (или пола). */
  flies?: { height: number };
  /** Лава и огонь не жгут (жители Пекла). */
  fireImmune?: boolean;
  /** Ударил игрок — злится вся стая таких же рядом (Мёртвые свинорылы). */
  groupAnger?: boolean;
  /**
   * Босс: своя логика (entities/DragonBrain.ts, entities/AshLordBrain.ts), полоса здоровья, не
   * исчезает издалека, не отбрасывается.
   */
  boss?: "dragon" | "ash_lord";
  /** Не двигается (Кристалл Предела): ни шагов, ни отброса, ни гравитации. */
  stationary?: boolean;
  /** Глубинник (страж Minecraft): луч с зарядкой, древний ещё и насылает Усталость (entities/DeepBrain). */
  guardian?: "guardian" | "elder";
  /** Страж: слепой, по вибрациям и запаху, звуковой удар (entities/WardenBrain). */
  warden?: boolean;
  /** Коза: высокие прыжки и таран, теряет рога об камень (entities/GoatBrain). */
  rams?: boolean;
  /** Лягушка: кого ловит языком и что после него остаётся (entities/FrogBrain). */
  tongue?: Record<string, string>;
  /** Нюхач: иногда роет землю и выкапывает древние семена (entities/SnifferBrain). */
  sniffs?: boolean;
  /** Снеговик: кидает снежки во враждебных, оставляет снежный след, тает в жаре (entities/SnowGolemBrain). */
  throwsSnow?: boolean;
  /** Пугливый (оцелот): игрок ближе 7 блоков без приманки в руке — убегает (entities/MobBrain). */
  shy?: boolean;
  /** Свинорыл: ПКМ золотым слитком — бартер (systems/Barter). */
  barters?: boolean;
  /** Не нападает на игрока в золотой броне (свинорыл). */
  goldPeace?: boolean;
  /** growsInto срабатывает только вне Пекла (свинорыл → мёртвый свинорыл, хоглин → зоглин). */
  zombifies?: boolean;
  /** Ходит по лаве, как по полу (страйдер). */
  walksOnLava?: boolean;
  /** Седлается без приручения (страйдер). */
  saddleOnly?: boolean;
  /** Ручной садится игроку на плечо, присел игрок — слетает (попугай; entities/Mob, MobBrain.petThink). */
  shoulderPet?: boolean;
  /** Красится красителем (ПКМ), стрижётся шерстью своего цвета (овца). */
  dyeable?: boolean;
  /** С кем ещё размножается и кто родится: лошадь + осёл → мул (EntityManager.findMate / breed). */
  mates?: Record<string, string>;
  /** Броненосец: игрок бежит рядом или ударили — сворачивается (замирает, урон −3), роняет щитки. */
  rollsUp?: boolean;
  /** Ручному можно надеть броню из щитков — она берёт урон на себя (волк). */
  wearsArmor?: boolean;
  /** Дух-помощник: дали предмет — собирает такие же выпавшие и несёт игроку (entities/AllayBrain). */
  collector?: boolean;
  /** Навьючивается сундуком на столько слотов (осёл, мул, лама); присев, ПКМ — открыть вьюк. */
  chestSlots?: number;
  /** Ходит караваном за своими на поводке (лама). */
  caravan?: boolean;
  /** Уходит (исчезает без дропа) через столько секунд [от, до] — странствующий торговец и его ламы. */
  leavesAfter?: [number, number];
  /** Ночью невидим (зелье невидимости), днём снова виден (молоко) — странствующий торговец. */
  nightInvisible?: boolean;
  /** Вырастает в другой вид через growTime секунд (головастик → лягушка по биому, EntityManager). */
  growsInto?: string;
  growTime?: number;
  /** Шипы: ударивший рукой получает столько урона (глубинник, пока не заряжает луч). */
  thorns?: number;
  /** Рыба: на суше задыхается и бьётся на месте. */
  needsWater?: boolean;
  /** Сколько секунд живёт на суше, прежде чем начать сохнуть (аксолотль — 300); без поля — 5 и бьётся. */
  dryTime?: number;
  /** На кого охотится в воде (аксолотль — рыбы, утопленники, глубинники). */
  hunts?: string[];
  /** Охотится по списку `hunts` и на суше (зомби — на жителей). */
  huntsLand?: boolean;
  /** Ломает двери, упёршись в них (зомби ночной осады). */
  breaksDoors?: boolean;
  /** Убитая им жертва-житель становится зомби-жителем (systems/Zombify). */
  turnsVillagers?: boolean;
  /** Лечится золотым яблоком обратно в жителя (зомби-житель). */
  curable?: boolean;
  /** Иглобрюх: раздувается рядом с игроком (Mob.peek) и отравляет касанием (entities/FishBrain). */
  puffs?: boolean;
  /** Вместо детёныша откладывает яйца-блоки этого вида на песок (черепаха). */
  layEggs?: string;
  /** Что роняет, вырастая из детёныша (черепаха — щиток). */
  growDrop?: string;
  /** Сидит на блоке (панцирник): мозг работает, но ни шагов, ни гравитации, ни отброса. */
  anchored?: boolean;
  /** Панцирник: приоткрывается и стреляет пулями (entities/ShellBrain.ts), закрытый — стрелы отскакивают. */
  shell?: boolean;
  /** Летит сквозь блоки без коллизий (дракон ломает их сам). */
  noClip?: boolean;
  /** Взрыв этой силы при смерти (Кристалл Предела — 6). */
  deathExplode?: number;
  explode?: { power: number; fuse: number; radius: number };
  /** Пчела: цветы, пыльца и свой улей (MobBrain.beeThink). */
  bee?: boolean;
  /** Ужалив, погибает (пчела). */
  diesOnAttack?: boolean;
  /** Плавает: в воде без гравитации, держится толщи (спрут, дельфин, утопленник). */
  swims?: boolean;
  /** Летун пикирует на цель и снова набирает высоту (фантом). */
  swoops?: boolean;
  /** Приручается этим (волк — кость, кошка — рыба), шанс за попытку (tameChance, по умолчанию 1/3). */
  tameItems?: string[];
  tameChance?: number;
  /** На нём ездят (лошадь): высота седока и скорость; приручается попытками сесть, едут в седле. */
  rideable?: { seat: number; speed: number };
  /** Ручной охраняет: бросается на тех, кого бьёт игрок и кто бьёт игрока (волк). */
  guards?: boolean;
  /** Шипуны обходят его стороной (кошка). */
  scaresBombers?: boolean;
  /** Не исчезает вдали от игрока и не занимает лимит монстров (железный голем деревни). */
  persistent?: boolean;
  /** Житель: профессия, по которой торгует (systems/Trading.ts). ПКМ — экран торговли. */
  trades?: string;
  /** Ходит только прыжками (слизень): на земле стоит, в воздухе летит к цели. */
  hops?: boolean;
  /** Умирая, распадается на n мобов вида mob (слизень → слизни поменьше). */
  splitsInto?: { mob: string; n: [number, number] };
  burnsInSun?: boolean;
  climbs?: boolean;
  teleports?: boolean;
  provokedByLook?: boolean;
  /** Нейтрален на свету (паук): нападает в темноте или если его ударили. */
  neutralInLight?: boolean;
  /** Идёт за этой едой в руке игрока и размножается от неё. */
  temptItems?: string[];
  /** Что даёт стрижка ножницами (и смерть нестриженого). */
  shearDrop?: BlockDrop;
  /** Опыт за убийство игроком: [min, max]. */
  xp?: [number, number];
  spawn?: MobSpawn;
  /** Высота глаз — доля высоты коробки. */
  eye?: number;
}

// ---- рецепты ----------------------------------------------------------------

export interface RecipeResult {
  item: string;
  count: number;
}

export interface ShapelessRecipe {
  shapeless: string[];
  result: RecipeResult;
}

export interface ShapedRecipe {
  pattern: (string | null)[][];
  result: RecipeResult;
}

export type Recipe = ShapelessRecipe | ShapedRecipe;

// ---- сейв -------------------------------------------------------------------

/**
 * Откуда берётся мир: шум по сиду или рецепт мира (WorldSpec). `gen` — поколение генератора
 * (worldgen/WorldGenerator.ts): нет поля — поколение 1, как у всех сейвов до v3; новые миры по сиду
 * получают CURRENT_GEN. Вывод генератора — часть формата сейва, поэтому поколение пишется в сейв.
 */
export type WorldSource =
  | { kind: "noise"; seed: number; gen?: number }
  | { kind: "spec"; spec: WorldSpec; gen?: number };

/** Дифы блоков по чанкам: "cx,cz" -> [[index, id, meta], ...]. */
export type ChunkDiffMap = Record<string, Array<[number, number, number]>>;

/** Одно измерение в сейве: дифы блоков, сущности, блочные сущности. */
export interface DimensionSave {
  chunks: ChunkDiffMap;
  entities?: unknown[];
  blockEntities?: unknown[];
}

export interface InventorySave {
  slots: (ItemStack | null)[];
  hotbarIndex: number;
  /** v3: броня — шлем, нагрудник, поножи, ботинки. */
  armor?: (ItemStack | null)[];
  /** Сундук Предела: общий склад игрока (нет поля — пуст). */
  ender?: (ItemStack | null)[];
}

/**
 * Полный снапшот мира. Вложенные serialize()-блобы player/entities намеренно
 * динамические (проходят JSON round-trip и раздаются в *.deserialize()) — any здесь оправдан.
 */
export interface SaveData {
  version: number;
  /** Сид мира. У мира из рецепта — сид рецепта; сейв v1 восстанавливает мир только по нему. */
  seed: number;
  /** v2+: источник мира. Нет поля (сейв v1) = шумовой мир по `seed`. */
  world?: WorldSource;
  time: { time?: number };
  /** v3: погода — ясно, дождь или гроза, и сколько секунд до смены. Нет поля — ясно. */
  weather?: { kind?: string; left?: number };
  /** Уровень сложности (нет поля — обычная). */
  difficulty?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  player: any;
  /** Дифы верхнего мира (у сейвов v1/v2 — единственного). Остальные измерения — в `dimensions`. */
  chunks: ChunkDiffMap;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entities: any;
  /** v3: id блока → имя на момент сейва. Дифы переносятся по именам и переживают смену id. */
  palette?: string[];
  /** v3: блочные сущности верхнего мира. */
  blockEntities?: unknown[];
  /** v3: измерение, в котором игрок. Нет — верхний мир. */
  dimension?: DimensionId;
  /** v3: остальные измерения (Пекло, Предел), если в них уже бывали. */
  dimensions?: Partial<Record<DimensionId, DimensionSave>>;
  /** v3: известные порталы по измерениям (клетка внутри каждого) — обратный путь к своему порталу. */
  portals?: Partial<Record<DimensionId, [number, number, number][]>>;
  /** v3: Предел — кристаллы и дракон уже поставлены, дракон убит, титры показаны, где Врата. */
  beyond?: {
    initialized?: boolean;
    dragonKilled?: boolean;
    creditsShown?: boolean;
    gateway?: unknown;
  };
  /** v3: деревни (id региона), в которые уже поселены жители — второй раз не селятся. */
  villages?: string[];
  /** v3: открытые достижения (id из systems/Achievements). */
  achievements?: string[];
  /** v3: карты (systems/Maps) — участок, измерение, пиксели в base64. */
  maps?: unknown[];
  /** v3: сколько ночей игрок не спал (с трёх прилетают фантомы). */
  daysAwake?: number;
  /**
   * Сетевая игра: другие игроки этого мира по userId (позиция, измерение, инвентарь, опыт) —
   * вернувшийся продолжает там же и с тем же. Нет поля — в мире не играли по сети.
   */
  players?: Record<string, unknown>;
  /** World Pulse V1. Старые миры без поля запускают чистый директор. */
  worldPulse?: import("./world-pulse/types").WorldPulseSave;
  /** Прогресс обучения в этом мире; общие навыки сохраняются отдельно на устройстве. */
  onboarding?: import("./onboarding/OnboardingDirector").OnboardingSave;
}
