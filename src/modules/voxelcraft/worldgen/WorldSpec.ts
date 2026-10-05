// Рецепт мира (WorldSpec) — компактный JSON, по которому SpecGenerator детерминированно строит мир.
//
// Зачем рецепт, а не блоки: мир на 256×256×64 — это четыре миллиона блоков; ИИ такое не выдаст, а
// рецепт на пару килобайт — выдаст. Тот же рецепт собирается и без ИИ (картинка разбирается прямо
// в браузере, текст — по ключевым словам) и пишется руками или агентом. Один генератор на всё.
//
// Координаты в рецепте НОРМИРОВАНЫ (0..1 от ширины/глубины мира): рецепт не зависит от размера,
// и модели не надо считать блоки. Каждое поле необязательно: parseWorldSpec() дополняет
// значениями по умолчанию, зажимает числа в допустимые границы и отбрасывает мусор — это
// единственная дверь, через которую рецепт попадает в игру (ИИ, файл, сейв, агент).
import { BLOCKS, LEGACY_BLOCK_COUNT, WOOL_BLOCKS } from "../registry/Blocks";
import { hashString } from "../core/Noise";
import { CONFIG } from "../config";

export const WORLD_SPEC_VERSION = 1 as const;

export const SIZE_MODES = ["island", "bounded", "infinite"] as const;
export type SizeMode = (typeof SIZE_MODES)[number];

export const TERRAIN_SHAPES = [
  "island",
  "archipelago",
  "continent",
  "valley",
  "mountains",
  "plateau",
  "flat",
] as const;
export type TerrainShape = (typeof TERRAIN_SHAPES)[number];

export const BIOMES = [
  "meadow",
  "forest",
  "birch_forest",
  "taiga",
  "snow",
  "desert",
  "badlands",
  "beach",
  "swamp",
  "rocky",
  "savanna",
  "jungle",
] as const;
export type Biome = (typeof BIOMES)[number];

export const TREE_TYPES = [
  "oak",
  "birch",
  "spruce",
  "palm",
  "dead",
  "none",
] as const;
export type TreeType = (typeof TREE_TYPES)[number];

export const STRUCTURE_TYPES = [
  "house",
  "tower",
  "castle",
  "village",
  "wall",
  "road",
  "bridge",
  "ruins",
  "pond",
  "rock",
  "tree_cluster",
  "pyramid",
  "well",
  "farm",
  /** Объект, который ИИ собрал из фигур (самолёт, машина…) — ссылка на WorldSpec.models. */
  "model",
  /** Река по ломаной path: течёт только вниз, прорезает русло сквозь холмы. */
  "river",
] as const;
export type StructureType = (typeof STRUCTURE_TYPES)[number];

/** Фигуры, из которых ИИ собирает модель объекта. */
export const MODEL_SHAPES = [
  "box",
  "cylinder",
  "cone",
  "sphere",
  "line",
] as const;
export type ModelShape = (typeof MODEL_SHAPES)[number];
export const MODEL_AXES = ["x", "y", "z"] as const;
export const MODEL_MIRRORS = ["x", "z"] as const;
/** Линейные постройки: им нужен конец отрезка (x2, z2). */
export const LINE_STRUCTURES: readonly StructureType[] = [
  "wall",
  "road",
  "bridge",
];

export const STRUCTURE_SIZES = ["small", "medium", "large"] as const;
export type StructureSize = (typeof STRUCTURE_SIZES)[number];

export const TIMES_OF_DAY = ["dawn", "day", "sunset", "night"] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

/** Жёсткие рамки — рецепт длиннее этого генератор не строит, откуда бы он ни пришёл. */
export const SPEC_LIMITS = {
  minChunks: 4,
  maxChunks: 48,
  maxZones: 12,
  maxStructures: 40,
  maxNpcs: 12,
  maxGrid: 256,
  maxModels: 4,
  maxParts: 200,
  maxVoxels: 400,
  minSketch: 4,
  maxSketch: 32,
  maxRiverPoints: 16,
  maxModelSide: 64,
  /** Мир высотой 64: модель выше этого просто не поместится над землёй. */
  maxModelHeight: 40,
  minBaseHeight: 6,
  /** Над сушей остаётся место для деревьев и построек (мир высотой CONFIG.chunk.sy). */
  maxBaseHeight: CONFIG.chunk.sy - 16,
  maxAmplitude: 30,
  minWater: 2,
  maxWater: CONFIG.chunk.sy - 20,
} as const;

// ---- типы -------------------------------------------------------------------

export interface WorldSize {
  mode: SizeMode;
  /** Ширина/глубина основной области в чанках (16 блоков). У infinite — область рецепта. */
  widthChunks: number;
  depthChunks: number;
}

/** Карта высот из картинки: байт 0..255 → высота low..high. Данные — base64, построчно. */
export interface HeightmapLayer {
  w: number;
  h: number;
  low: number;
  high: number;
  data: string;
}

/** Карта поверхности из картинки: байт = индекс в palette (имена блоков). */
export interface SurfaceLayer {
  w: number;
  h: number;
  palette: string[];
  data: string;
}

export interface WorldTerrain {
  shape: TerrainShape;
  /** Средняя высота суши (y). */
  baseHeight: number;
  /** Размах холмов в блоках. */
  amplitude: number;
  /** 0 — плавно, 1 — изрезанно. */
  roughness: number;
  /** Уровень моря (y). */
  waterLevel: number;
  heightmap?: HeightmapLayer;
  surfaceMap?: SurfaceLayer;
  /** Набросок рельефа от ИИ: карта высот сверху цифрами (см. SKETCH_OFFSETS). */
  sketch?: TerrainSketch;
}

/**
 * Карта высот, которую ИИ «рисует» по картинке пейзажа: строки с севера на юг, в строке цифры с
 * запада на восток, 4..32 × 4..32. Цифра — уровень (0 глубокая вода … 9 пики), генератор сглаживает
 * сетку и добавляет естественные детали. Ляжет почти любой пейзаж: горы слева, озеро, обрыв к морю.
 */
export interface TerrainSketch {
  rows: string[];
}

/** Высота уровня наброска относительно уровня моря: 0 — глубина, 2 — берег, 9 — пики. */
export const SKETCH_OFFSETS = [-8, -4, -1, 1, 3, 6, 10, 14, 19, 25] as const;

export interface WorldZone {
  x: number;
  z: number;
  radius: number;
  biome: Biome;
  surface: string;
  subsurface: string;
  /** Плотность деревьев 0..1. */
  trees: number;
  treeType: TreeType;
  grass: number;
  flowers: number;
  /** Сдвиг рельефа зоны в блоках (-20..20). */
  height: number;
}

export interface WorldStructure {
  type: StructureType;
  x: number;
  z: number;
  /** Конец отрезка для wall / road / bridge. */
  x2?: number;
  z2?: number;
  size: StructureSize;
  rotation: 0 | 90 | 180 | 270;
  /** Основной материал (стены). Нет — из palette. */
  material?: string;
  /** Материал крыши. Нет — из palette. */
  roof?: string;
  /** type "model": id модели в WorldSpec.models. */
  model?: string;
  /** type "model": на сколько блоков над землёй (самолёт в полёте). */
  elevation?: number;
  /** type "river": точки от истока к устью, [x, z] в долях мира. */
  path?: [number, number][];
}

export interface WorldNpc {
  name: string;
  role: string;
  x: number;
  z: number;
  persona: string;
}

export type V3 = [number, number, number];

/**
 * Фигура модели в блоках модели: x — от носа к хвосту (длина, x=0 — перёд), y — вверх (y=0 стоит
 * на земле), z — слева направо. Позже нарисованная фигура перекрывает раннюю; block "air" вырезает.
 */
export interface ModelPart {
  shape: ModelShape;
  block: string;
  /** box, line: углы/концы. */
  from?: V3;
  to?: V3;
  /** cylinder, cone: ось, центр начального торца, радиус, длина вдоль оси (минус — в обратную). */
  axis?: (typeof MODEL_AXES)[number];
  center?: V3;
  radius?: number;
  /** cone: радиус дальнего торца (0 — остриё). */
  radius2?: number;
  length?: number;
  /** sphere: полуоси эллипсоида. */
  radii?: V3;
  /** Только оболочка (box, cylinder, cone, sphere). */
  hollow?: boolean;
  /** Дорисовать зеркальную копию через середину модели — крылья, колёса, фары. */
  mirror?: (typeof MODEL_MIRRORS)[number];
}

/** Объект из блоков, собранный ИИ по картинкам (самолёт, машина, корабль…). */
export interface VoxelModel {
  /** [длина x, высота y, ширина z] в блоках. */
  size: V3;
  parts: ModelPart[];
  /** Одиночные блоки для мелких деталей: [x, y, z, блок]. */
  voxels: [number, number, number, string][];
}

export interface WorldPalette {
  wall: string;
  roof: string;
  floor: string;
  path: string;
  accent: string;
}

export interface WorldAmbience {
  timeOfDay: TimeOfDay;
}

export interface WorldSpec {
  version: typeof WORLD_SPEC_VERSION;
  name: string;
  description: string;
  seed: number;
  size: WorldSize;
  terrain: WorldTerrain;
  zones: WorldZone[];
  structures: WorldStructure[];
  /** Модели объектов по id; ставятся постройками type "model". */
  models: Record<string, VoxelModel>;
  npcs: WorldNpc[];
  palette: WorldPalette;
  ambience: WorldAmbience;
}

// ---- биомы --------------------------------------------------------------------

export interface BiomePreset {
  surface: string;
  subsurface: string;
  trees: number;
  treeType: TreeType;
  grass: number;
  flowers: number;
  height: number;
}

export const BIOME_PRESETS: Record<Biome, BiomePreset> = {
  meadow: {
    surface: "grass",
    subsurface: "dirt",
    trees: 0.06,
    treeType: "oak",
    grass: 0.35,
    flowers: 0.08,
    height: 0,
  },
  forest: {
    surface: "grass",
    subsurface: "dirt",
    trees: 0.65,
    treeType: "oak",
    grass: 0.2,
    flowers: 0.03,
    height: 1,
  },
  birch_forest: {
    surface: "grass",
    subsurface: "dirt",
    trees: 0.6,
    treeType: "birch",
    grass: 0.25,
    flowers: 0.05,
    height: 1,
  },
  taiga: {
    surface: "grass",
    subsurface: "dirt",
    trees: 0.55,
    treeType: "spruce",
    grass: 0.12,
    flowers: 0.01,
    height: 3,
  },
  snow: {
    surface: "snow",
    subsurface: "dirt",
    trees: 0.12,
    treeType: "spruce",
    grass: 0,
    flowers: 0,
    height: 4,
  },
  desert: {
    surface: "sand",
    subsurface: "sandstone",
    trees: 0.02,
    treeType: "dead",
    grass: 0,
    flowers: 0,
    height: 0,
  },
  badlands: {
    surface: "red_sand",
    subsurface: "terracotta",
    trees: 0.02,
    treeType: "dead",
    grass: 0,
    flowers: 0,
    height: 5,
  },
  beach: {
    surface: "sand",
    subsurface: "sand",
    trees: 0.06,
    treeType: "palm",
    grass: 0.02,
    flowers: 0,
    height: -3,
  },
  swamp: {
    surface: "grass",
    subsurface: "clay",
    trees: 0.3,
    treeType: "oak",
    grass: 0.45,
    flowers: 0,
    height: -3,
  },
  rocky: {
    surface: "stone",
    subsurface: "stone",
    trees: 0.03,
    treeType: "spruce",
    grass: 0.02,
    flowers: 0,
    height: 4,
  },
  savanna: {
    surface: "grass",
    subsurface: "dirt",
    trees: 0.08,
    treeType: "oak",
    grass: 0.55,
    flowers: 0.02,
    height: 0,
  },
  jungle: {
    surface: "grass",
    subsurface: "dirt",
    trees: 0.85,
    treeType: "oak",
    grass: 0.6,
    flowers: 0.05,
    height: 1,
  },
};

// ---- допустимые блоки ------------------------------------------------------------

const NOT_FOR_WORLDGEN = new Set([
  "air",
  "bedrock",
  "crafting_table",
  "coal_ore",
  "iron_ore",
  "water",
]);

/**
 * Палитра рецепта — только блоки, что были до сейва v3. Системный промпт ИИ живёт в конфиге тайтла
 * (правит владелец) и перечисляет ровно их; новые блоки сюда добавляются отдельным шагом вместе
 * с промптом, иначе ИИ о них не знал бы, а валидатор уже принимал бы.
 */
const WORLDGEN_BLOCKS = BLOCKS.slice(0, LEGACY_BLOCK_COUNT);

/** Блоки, которыми можно покрыть землю (цельные, непрозрачные). */
export const SURFACE_BLOCKS: readonly string[] = WORLDGEN_BLOCKS.filter(
  (b) => b.solid && b.opaque && !NOT_FOR_WORLDGEN.has(b.name),
).map((b) => b.name);

/** Блоки для построек: всё твёрдое, включая стекло и листву. */
export const BUILD_BLOCKS: readonly string[] = WORLDGEN_BLOCKS.filter(
  (b) => b.solid && !b.liquid && !NOT_FOR_WORLDGEN.has(b.name),
).map((b) => b.name);

const DEFAULT_PALETTE: WorldPalette = {
  wall: "planks",
  roof: "dark_planks",
  floor: "planks",
  path: "dirt_path",
  accent: "stone_bricks",
};

export const DEFAULT_SIZE: WorldSize = {
  mode: "island",
  widthChunks: 16,
  depthChunks: 16,
};

/** Готовые размеры для экрана «Создать мир». */
export const SIZE_PRESETS = {
  island: { mode: "island", widthChunks: 16, depthChunks: 16 },
  large: { mode: "island", widthChunks: 32, depthChunks: 32 },
  infinite: { mode: "infinite", widthChunks: 16, depthChunks: 16 },
} as const satisfies Record<string, WorldSize>;

/** Размер области рецепта в блоках. */
export function specBlocks(spec: WorldSpec): { W: number; D: number } {
  const { sx, sz } = CONFIG.chunk;
  return {
    W: spec.size.widthChunks * sx,
    D: spec.size.depthChunks * sz,
  };
}

// ---- base64 для слоёв картинки ----------------------------------------------------

export function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function base64ToBytes(b64: string): Uint8Array | null {
  try {
    const s = atob(b64);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

// ---- разбор ответа модели ----------------------------------------------------------

export type JsonExtract =
  | { ok: true; value: unknown }
  | { ok: false; error: string; truncated: boolean };

/**
 * Достаёт первый JSON-объект из текста модели: срезает ```json-обёртку и болтовню вокруг.
 * Обрезанный ответ (модель упёрлась в лимит токенов — движок такой считает успехом и списывает)
 * распознаётся по незакрытым скобкам: `truncated: true`.
 */
export function extractJsonObject(text: string): JsonExtract {
  let t = text.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)(?:```|$)/i.exec(t);
  if (fence && fence[1] !== undefined) t = fence[1];
  const start = t.indexOf("{");
  if (start < 0)
    return { ok: false, error: "в ответе нет JSON-объекта", truncated: false };
  let depth = 0,
    inStr = false,
    esc = false,
    end = -1;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return { ok: false, error: "JSON оборван", truncated: true };
  try {
    return { ok: true, value: JSON.parse(t.slice(start, end + 1)) };
  } catch {
    return { ok: false, error: "невалидный JSON", truncated: false };
  }
}

// ---- нормализация ---------------------------------------------------------------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function num(v: unknown, def: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}

function pick<T extends string>(v: unknown, allowed: readonly T[], def: T): T {
  if (typeof v !== "string") return def;
  const s = v
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return (allowed as readonly string[]).includes(s) ? (s as T) : def;
}

function str(v: unknown, def: string, maxLen: number): string {
  return typeof v === "string" ? v.trim().slice(0, maxLen) : def;
}

function blockName(
  v: unknown,
  allowed: readonly string[],
  def: string,
): string {
  if (typeof v !== "string") return def;
  const s = v
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return allowed.includes(s) ? s : def;
}

const rotation = (v: unknown): WorldStructure["rotation"] => {
  const n = num(v, 0, -3600, 3600);
  return ((((Math.round(n / 90) % 4) + 4) % 4) *
    90) as WorldStructure["rotation"];
};

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function normHeightmap(
  v: unknown,
  warnings: string[],
): HeightmapLayer | undefined {
  if (!isObj(v)) return undefined;
  const w = Math.round(num(v.w, 0, 0, SPEC_LIMITS.maxGrid));
  const h = Math.round(num(v.h, 0, 0, SPEC_LIMITS.maxGrid));
  const data = typeof v.data === "string" ? v.data : "";
  const bytes = w >= 2 && h >= 2 ? base64ToBytes(data) : null;
  if (!bytes || bytes.length !== w * h) {
    warnings.push("карта высот повреждена — рельеф без неё");
    return undefined;
  }
  const low = Math.round(num(v.low, 16, 1, CONFIG.chunk.sy - 12));
  const high = Math.round(num(v.high, 44, low, CONFIG.chunk.sy - 12));
  return { w, h, low, high, data };
}

function normSurfaceMap(
  v: unknown,
  warnings: string[],
): SurfaceLayer | undefined {
  if (!isObj(v)) return undefined;
  const w = Math.round(num(v.w, 0, 0, SPEC_LIMITS.maxGrid));
  const h = Math.round(num(v.h, 0, 0, SPEC_LIMITS.maxGrid));
  const palette = arr(v.palette).map((p) =>
    blockName(p, [...SURFACE_BLOCKS, "water"], "grass"),
  );
  const data = typeof v.data === "string" ? v.data : "";
  const bytes = w >= 2 && h >= 2 && palette.length ? base64ToBytes(data) : null;
  if (
    !bytes ||
    bytes.length !== w * h ||
    palette.length > 255 ||
    bytes.some((b) => b >= palette.length)
  ) {
    warnings.push("карта поверхности повреждена — поверхность по биомам");
    return undefined;
  }
  return { w, h, palette, data };
}

/** Набросок рельефа: строки цифр 0..9 (или массивы чисел), выровненные в прямоугольник. */
function normSketch(v: unknown, warnings: string[]): TerrainSketch | undefined {
  const raw = isObj(v) ? v.rows : v;
  if (!Array.isArray(raw) || !raw.length) return undefined;
  const L = SPEC_LIMITS;
  const rows = raw
    .map((r) =>
      typeof r === "string"
        ? r.replace(/\s+/g, "").replace(/[^0-9]/g, "4")
        : Array.isArray(r)
          ? r.map((n) => String(Math.round(num(n, 4, 0, 9)))).join("")
          : "",
    )
    .filter((r) => r.length > 0)
    .slice(0, L.maxSketch);
  const w = Math.min(L.maxSketch, Math.max(0, ...rows.map((r) => r.length)));
  if (rows.length < L.minSketch || w < L.minSketch) {
    warnings.push("набросок рельефа меньше 4×4 — рельеф без него");
    return undefined;
  }
  return {
    rows: rows.map((r) => r.slice(0, w).padEnd(w, r[r.length - 1] ?? "4")),
  };
}

function normZone(v: unknown): WorldZone | null {
  if (!isObj(v)) return null;
  const biome = pick(v.biome, BIOMES, "meadow");
  const p = BIOME_PRESETS[biome];
  return {
    x: num(v.x, 0.5, 0, 1),
    z: num(v.z, 0.5, 0, 1),
    radius: num(v.radius, 0.3, 0.02, 1.5),
    biome,
    surface: blockName(v.surface, SURFACE_BLOCKS, p.surface),
    subsurface: blockName(v.subsurface, SURFACE_BLOCKS, p.subsurface),
    trees: num(v.trees, p.trees, 0, 1),
    treeType: pick(v.treeType, TREE_TYPES, p.treeType),
    grass: num(v.grass, p.grass, 0, 1),
    flowers: num(v.flowers, p.flowers, 0, 1),
    height: num(v.height, p.height, -20, 20),
  };
}

function normStructure(
  v: unknown,
  modelIds: ReadonlySet<string>,
): WorldStructure | null {
  if (!isObj(v)) return null;
  // Неизвестный тип постройки отбрасывается, а не превращается в дом: «космодром» от модели
  // не должен молча стать хижиной посреди мира.
  const raw =
    typeof v.type === "string"
      ? v.type
          .trim()
          .toLowerCase()
          .replace(/[\s-]+/g, "_")
      : "";
  if (!(STRUCTURE_TYPES as readonly string[]).includes(raw)) return null;
  const type = raw as StructureType;
  const s: WorldStructure = {
    type,
    x: num(v.x, 0.5, 0, 1),
    z: num(v.z, 0.5, 0, 1),
    size: pick(v.size, STRUCTURE_SIZES, "medium"),
    rotation: rotation(v.rotation),
  };
  if (LINE_STRUCTURES.includes(type)) {
    s.x2 = num(v.x2, Math.min(1, s.x + 0.2), 0, 1);
    s.z2 = num(v.z2, s.z, 0, 1);
  }
  if (v.material !== undefined) {
    const m = blockName(v.material, BUILD_BLOCKS, "");
    if (m) s.material = m;
  }
  if (v.roof !== undefined) {
    const r = blockName(v.roof, BUILD_BLOCKS, "");
    if (r) s.roof = r;
  }
  if (type === "river") {
    const pts = arr(v.path)
      .map((p): [number, number] | null =>
        Array.isArray(p) && p.length >= 2
          ? [num(p[0], NaN, 0, 1), num(p[1], NaN, 0, 1)]
          : null,
      )
      .filter(
        (p): p is [number, number] =>
          p !== null && !Number.isNaN(p[0]) && !Number.isNaN(p[1]),
      )
      .slice(0, SPEC_LIMITS.maxRiverPoints);
    if (pts.length < 2) return null; // река — это хотя бы отрезок
    s.path = pts;
    [s.x, s.z] = pts[0]!;
  }
  if (type === "model") {
    const id = modelId(v.model);
    if (!modelIds.has(id)) return null; // ссылка на несуществующую модель — нечего ставить
    s.model = id;
    s.elevation = Math.round(num(v.elevation, 0, 0, 30));
  }
  return s;
}

function normNpc(v: unknown): WorldNpc | null {
  if (!isObj(v)) return null;
  const name = str(v.name, "", 40);
  if (!name) return null;
  return {
    name,
    role: str(v.role, "", 40),
    x: num(v.x, 0.5, 0, 1),
    z: num(v.z, 0.5, 0, 1),
    persona: str(v.persona, "", 400),
  };
}

// ---- модели объектов ------------------------------------------------------------

/** Блоки для моделей: всё строительное + "air" (вырез). */
const MODEL_BLOCKS: readonly string[] = [...BUILD_BLOCKS, "air"];
// ⚠ только 12 прежних цветов: вывод генератора рецепта — часть сейва, и «cyan» в старых мирах
// должен и дальше сводиться к голубой шерсти (COLOR_ALIAS), а не к бирюзовой шерсти сейва v3
const WOOL_COLORS = new Set(
  WOOL_BLOCKS.filter(
    (n) => BLOCKS.findIndex((b) => b.name === n) < LEGACY_BLOCK_COUNT,
  ).map((n) => n.replace(/_wool$/, "")),
);
/** Цвета Minecraft, которых нет среди нашей шерсти, — на ближайший. */
const COLOR_ALIAS: Record<string, string> = {
  cyan: "light_blue",
  lime: "green",
  magenta: "pink",
  light_gray: "white",
  silver: "white",
};

/**
 * Блок модели. Модели знают блоки Minecraft и охотно пишут red_concrete или cyan_terracotta —
 * такие имена сводятся к шерсти того же цвета, а не выбрасывают деталь целиком.
 */
function modelBlock(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v
    .trim()
    .toLowerCase()
    .replace(/^minecraft:/, "")
    .replace(/[\s-]+/g, "_");
  if (MODEL_BLOCKS.includes(s)) return s;
  const m =
    /^([a-z_]+?)_(concrete_powder|concrete|glazed_terracotta|terracotta|stained_glass_pane|stained_glass|carpet|wool)$/.exec(
      s,
    );
  if (!m) return null;
  if (m[2]!.startsWith("stained_glass")) return "glass";
  const color = COLOR_ALIAS[m[1]!] ?? m[1]!;
  return WOOL_COLORS.has(color) ? color + "_wool" : null;
}

/** id модели: латиница, цифры, _ и -; как в models, так и в ссылке постройки. */
function modelId(v: unknown): string {
  return typeof v === "string"
    ? v
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "_")
        .slice(0, 32)
    : "";
}

function oneOf<T extends string>(
  v: unknown,
  allowed: readonly T[],
): T | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim().toLowerCase();
  return (allowed as readonly string[]).includes(s) ? (s as T) : undefined;
}

/** Точка модели: три числа, с шагом 0.5 (центр между блоками), в разумных пределах. */
function vec3(v: unknown, lim: number): V3 | null {
  if (!Array.isArray(v) || v.length !== 3) return null;
  const out = v.map((n) => num(n, NaN, -lim, lim * 2));
  if (out.some((n) => Number.isNaN(n))) return null;
  return out.map((n) => Math.round(n * 2) / 2) as V3;
}

function normPart(v: unknown, size: V3): ModelPart | null {
  if (!isObj(v)) return null;
  const shape = oneOf(v.shape, MODEL_SHAPES);
  const block = modelBlock(v.block);
  if (!shape || !block) return null;
  const lim = Math.max(...size) + 4;
  const part: ModelPart = { shape, block };
  if (shape === "box" || shape === "line") {
    const from = vec3(v.from, lim),
      to = vec3(v.to, lim);
    if (!from || !to) return null;
    part.from = from;
    part.to = to;
    if (shape === "line") part.radius = num(v.radius, 0, 0, 3);
  } else {
    const center = vec3(v.center, lim);
    if (!center) return null;
    part.center = center;
    if (shape === "sphere") {
      const r = num(v.radius, 2, 0.5, 32);
      const radii =
        Array.isArray(v.radii) && v.radii.length === 3 ? v.radii : [r, r, r];
      part.radii = radii.map((n) => num(n, r, 0.5, 32)) as V3;
    } else {
      part.axis = oneOf(v.axis, MODEL_AXES) ?? "x";
      part.radius = num(v.radius, 1, 0, 32);
      part.length = Math.round(num(v.length, 1, -lim, lim)) || 1;
      if (shape === "cone") part.radius2 = num(v.radius2, 0, 0, 32);
    }
  }
  if (v.hollow === true && shape !== "line") part.hollow = true;
  const mirror = oneOf(v.mirror, MODEL_MIRRORS);
  if (mirror) part.mirror = mirror;
  return part;
}

function normModels(
  v: unknown,
  warnings: string[],
): Record<string, VoxelModel> {
  if (!isObj(v)) return {};
  const L = SPEC_LIMITS;
  const out: Record<string, VoxelModel> = {};
  for (const [rawId, mv] of Object.entries(v)) {
    const id = modelId(rawId);
    if (!id || !isObj(mv) || out[id]) continue;
    if (Object.keys(out).length >= L.maxModels) {
      warnings.push(`модели: оставлены первые ${L.maxModels}`);
      break;
    }
    const sz = Array.isArray(mv.size) ? mv.size : [];
    const size: V3 = [
      Math.round(num(sz[0], 16, 1, L.maxModelSide)),
      Math.round(num(sz[1], 8, 1, L.maxModelHeight)),
      Math.round(num(sz[2], 16, 1, L.maxModelSide)),
    ];
    const raw = arr(mv.parts);
    const parts = raw
      .slice(0, L.maxParts)
      .map((p) => normPart(p, size))
      .filter((p): p is ModelPart => p !== null);
    if (raw.length > L.maxParts)
      warnings.push(`модель ${id}: оставлены первые ${L.maxParts} деталей`);
    const dropped = Math.min(raw.length, L.maxParts) - parts.length;
    if (dropped > 0)
      warnings.push(`модель ${id}: отброшено деталей: ${dropped}`);
    const voxels = arr(mv.voxels)
      .slice(0, L.maxVoxels)
      .map((vx): [number, number, number, string] | null => {
        if (!Array.isArray(vx) || vx.length !== 4) return null;
        const b = modelBlock(vx[3]);
        const c = [0, 1, 2].map((i) =>
          Math.round(num(vx[i], NaN, 0, size[i]! - 1)),
        );
        if (!b || c.some((n) => Number.isNaN(n))) return null;
        return [c[0]!, c[1]!, c[2]!, b];
      })
      .filter((x): x is [number, number, number, string] => x !== null);
    if (!parts.length && !voxels.length) {
      warnings.push(`модель ${id} пуста — пропущена`);
      continue;
    }
    out[id] = { size, parts, voxels };
  }
  return out;
}

export type SpecParseResult =
  | { ok: true; spec: WorldSpec; warnings: string[] }
  | { ok: false; error: string; truncated?: boolean };

/**
 * Единственная дверь в игру для рецепта: принимает объект или текст ответа модели, дополняет
 * пропуски значениями по умолчанию, зажимает числа, отбрасывает неизвестное. Отказ — только если
 * это вообще не объект (или оборванный JSON).
 */
export function parseWorldSpec(
  input: unknown,
  opts: { fallbackSeed?: number } = {},
): SpecParseResult {
  if (typeof input === "string") {
    const ex = extractJsonObject(input);
    if (!ex.ok) return { ok: false, error: ex.error, truncated: ex.truncated };
    input = ex.value;
  }
  if (!isObj(input)) return { ok: false, error: "рецепт мира — не объект" };
  // Небрежные ответы вида { "world": { ... } } — разворачиваем.
  if (!("terrain" in input) && !("size" in input) && !("zones" in input)) {
    const inner = input.world ?? input.spec ?? input.worldSpec;
    if (isObj(inner)) input = inner;
  }
  const o = input as Obj;
  const warnings: string[] = [];

  const name = str(o.name, "Новый мир", 60) || "Новый мир";
  const description = str(o.description, "", 500);
  const seed =
    typeof o.seed === "number" && Number.isFinite(o.seed)
      ? Math.abs(Math.floor(o.seed)) >>> 0
      : typeof o.seed === "string" && o.seed.trim()
        ? hashString(o.seed.trim())
        : (opts.fallbackSeed ?? hashString(name + "|" + description)) >>> 0;

  const so = isObj(o.size) ? o.size : {};
  const mode = pick(so.mode, SIZE_MODES, DEFAULT_SIZE.mode);
  const L = SPEC_LIMITS;
  const size: WorldSize = {
    mode,
    widthChunks: Math.round(
      num(so.widthChunks, DEFAULT_SIZE.widthChunks, L.minChunks, L.maxChunks),
    ),
    depthChunks: Math.round(
      num(so.depthChunks, DEFAULT_SIZE.depthChunks, L.minChunks, L.maxChunks),
    ),
  };

  const to = isObj(o.terrain) ? o.terrain : {};
  const terrain: WorldTerrain = {
    shape: pick(
      to.shape,
      TERRAIN_SHAPES,
      mode === "island" ? "island" : "continent",
    ),
    baseHeight: Math.round(
      num(to.baseHeight, 30, L.minBaseHeight, L.maxBaseHeight),
    ),
    amplitude: num(to.amplitude, 12, 0, L.maxAmplitude),
    roughness: num(to.roughness, 0.5, 0, 1),
    waterLevel: Math.round(
      num(to.waterLevel, CONFIG.world.waterLevel, L.minWater, L.maxWater),
    ),
  };
  const hm = normHeightmap(to.heightmap, warnings);
  if (hm) terrain.heightmap = hm;
  const sm = normSurfaceMap(to.surfaceMap, warnings);
  if (sm) terrain.surfaceMap = sm;
  const sketch = normSketch(to.sketch, warnings);
  if (sketch) terrain.sketch = sketch;

  const cap = <T>(list: (T | null)[], max: number, what: string): T[] => {
    const ok = list.filter((x): x is T => x !== null);
    if (ok.length > max) warnings.push(`${what}: оставлены первые ${max}`);
    return ok.slice(0, max);
  };
  const zones = cap(arr(o.zones).map(normZone), L.maxZones, "зоны");
  const models = normModels(o.models, warnings);
  const modelIds = new Set(Object.keys(models));
  const structures = cap(
    arr(o.structures).map((s) => normStructure(s, modelIds)),
    L.maxStructures,
    "постройки",
  );
  const npcs = cap(arr(o.npcs).map(normNpc), L.maxNpcs, "NPC");

  const po = isObj(o.palette) ? o.palette : {};
  const palette: WorldPalette = {
    wall: blockName(po.wall, BUILD_BLOCKS, DEFAULT_PALETTE.wall),
    roof: blockName(po.roof, BUILD_BLOCKS, DEFAULT_PALETTE.roof),
    floor: blockName(po.floor, BUILD_BLOCKS, DEFAULT_PALETTE.floor),
    path: blockName(po.path, SURFACE_BLOCKS, DEFAULT_PALETTE.path),
    accent: blockName(po.accent, BUILD_BLOCKS, DEFAULT_PALETTE.accent),
  };

  const ao = isObj(o.ambience) ? o.ambience : {};
  const ambience: WorldAmbience = {
    timeOfDay: pick(ao.timeOfDay, TIMES_OF_DAY, "day"),
  };

  return {
    ok: true,
    spec: {
      version: WORLD_SPEC_VERSION,
      name,
      description,
      seed,
      size,
      terrain,
      zones,
      structures,
      models,
      npcs,
      palette,
      ambience,
    },
    warnings,
  };
}

/** Рецепт по умолчанию (пустой ввод → остров-луг). */
export function defaultSpec(seed: number): WorldSpec {
  const r = parseWorldSpec({ seed });
  if (!r.ok) throw new Error(r.error); // пустой объект всегда валиден
  return r.spec;
}
