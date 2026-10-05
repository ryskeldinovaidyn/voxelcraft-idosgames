// Генератор мира по рецепту (WorldSpec). Детерминирован целиком: один рецепт → бит-в-бит один мир,
// поэтому сейв хранит рецепт + дифы, как классический мир хранит сид + дифы.
//
// Порядок для каждого чанка: рельеф (форма + шум + карта высот картинки + сдвиг зон + маска
// острова) → слои пород и поверхность (зона, карта поверхности картинки, пляж, снег, скалы) →
// вода → руды → растительность → штампы построек. Высота — чистая функция (x, z), поэтому
// соседние чанки сходятся без швов, а постройки заранее «штампуются» по всей своей площади.
import { B } from "../registry/Blocks";
import { packWater } from "../registry/Blocks";
import { Simplex2, mulberry32, hashString } from "../core/Noise";
import { CHUNK_SIZE, LEGACY_SY, idx, type Chunk } from "../world/Chunk";
import { generateOres } from "../world/TerrainGenerator";
import type { WorldGenerator } from "./WorldGenerator";
import {
  BIOME_PRESETS,
  SKETCH_OFFSETS,
  base64ToBytes,
  specBlocks,
  type Biome,
  type TreeType,
  type WorldSpec,
  type WorldZone,
} from "./WorldSpec";
import { buildStructure, resolvePalette, type StampTarget } from "./structures";
import { plantTree, TREE_MAX_HEIGHT, TREE_MAX_RADIUS } from "./trees";
import { rasterizeModel, type RasterModel } from "./voxelModel";

const { SX, SZ } = CHUNK_SIZE;
/** Высота миров по рецепту — прежняя: вывод генератора зафиксирован их сейвами. */
const SY = LEGACY_SY;

/** Ячейка карты поверхности «здесь вода» (в палитре картинки — имя "water"). */
const WATER_CELL = 255;

/** [id, meta, soft]: soft = листва, ставится только туда, где остаётся воздух. */
type StampEntry = [number, number, 0 | 1];

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Ключ колонны в мировых координатах (|x|, |z| < 32768 — с запасом больше любого мира). */
const colKey = (x: number, z: number): number =>
  (x + 0x8000) * 0x10000 + (z + 0x8000);

/** Биомы без песчаного пляжа у воды. */
const NO_BEACH: ReadonlySet<Biome> = new Set([
  "snow",
  "swamp",
  "rocky",
  "badlands",
]);
/** Биомы, где вершины не заснежены. */
const NO_SNOW: ReadonlySet<Biome> = new Set([
  "desert",
  "badlands",
  "beach",
  "savanna",
  "jungle",
]);

/** Порода под поверхностью по блоку поверхности (для карты поверхности из картинки). */
const SUBSURFACE_OF: Record<string, string> = {
  sand: "sand",
  red_sand: "terracotta",
  sandstone: "sandstone",
  terracotta: "terracotta",
  stone: "stone",
  gravel: "stone",
  cobblestone: "stone",
};

/** На чём растёт порода. */
const GROWS_ON: Record<TreeType, readonly string[]> = {
  oak: ["grass", "dirt"],
  birch: ["grass", "dirt"],
  spruce: ["grass", "dirt", "snow"],
  palm: ["sand", "grass"],
  dead: ["sand", "red_sand", "terracotta", "grass", "dirt"],
  none: [],
};

export interface ColumnInfo {
  surface: number;
  subsurface: number;
  zone: WorldZone;
  underwater: boolean;
}

export class SpecGenerator implements WorldGenerator {
  readonly spec: WorldSpec;
  readonly seed: number;
  readonly waterLevel: number;
  /** Размер области рецепта в блоках. Область — [0, W) × [0, D). */
  readonly W: number;
  readonly D: number;

  private readonly hNoise: Simplex2;
  private readonly dNoise: Simplex2;
  private readonly ridge: Simplex2;
  private readonly warp: Simplex2;
  private readonly patch: Simplex2;
  private readonly far: Simplex2;
  private readonly zones: WorldZone[];
  private readonly hm: {
    w: number;
    h: number;
    low: number;
    high: number;
    data: Uint8Array;
  } | null;
  private readonly sm: { w: number; h: number; ids: Uint8Array } | null;
  private readonly snowLine: number;
  private readonly growsOn: Record<TreeType, Set<number>>;
  private readonly stamps = new Map<string, Map<number, StampEntry>>();
  private readonly stampedCols = new Set<number>();
  private stampTops: Map<
    number,
    { y: number; id: number; dug: number }
  > | null = null;
  private readonly spawn: { x: number; z: number };
  /** Модели объектов, растеризованные один раз (одна модель может стоять в мире много раз). */
  private readonly models: Record<string, RasterModel>;
  /** Набросок рельефа от ИИ в высотах; карта высот картинки главнее — при ней набросок не читается. */
  private readonly sketch: {
    w: number;
    h: number;
    heights: Float32Array;
  } | null;

  constructor(spec: WorldSpec) {
    this.spec = spec;
    this.seed = spec.seed;
    this.waterLevel = spec.terrain.waterLevel;
    const { W, D } = specBlocks(spec);
    this.W = W;
    this.D = D;
    const s = spec.seed;
    this.hNoise = new Simplex2(hashString("spec-height:" + s));
    this.dNoise = new Simplex2(hashString("spec-detail:" + s));
    this.ridge = new Simplex2(hashString("spec-ridge:" + s));
    this.warp = new Simplex2(hashString("spec-warp:" + s));
    this.patch = new Simplex2(hashString("spec-patch:" + s));
    this.far = new Simplex2(hashString("spec-far:" + s));
    this.zones = spec.zones.length ? spec.zones : [defaultZone(spec)];
    this.snowLine = Math.max(this.waterLevel + 16, SY - 18);
    this.growsOn = Object.fromEntries(
      Object.entries(GROWS_ON).map(([k, names]) => [
        k,
        new Set(names.map((n) => B[n]!)),
      ]),
    ) as Record<TreeType, Set<number>>;

    const hm = spec.terrain.heightmap;
    const hmBytes = hm ? base64ToBytes(hm.data) : null;
    this.hm =
      hm && hmBytes && hmBytes.length === hm.w * hm.h
        ? { w: hm.w, h: hm.h, low: hm.low, high: hm.high, data: hmBytes }
        : null;
    const sm = spec.terrain.surfaceMap;
    const smBytes = sm ? base64ToBytes(sm.data) : null;
    if (sm && smBytes && smBytes.length === sm.w * sm.h) {
      const lut = sm.palette.map((n) =>
        n === "water" ? WATER_CELL : (B[n] ?? B.grass!),
      );
      this.sm = {
        w: sm.w,
        h: sm.h,
        ids: smBytes.map((i) => lut[i] ?? B.grass!),
      };
    } else this.sm = null;

    const sk = spec.terrain.sketch;
    if (sk && !this.hm) {
      const h = sk.rows.length,
        w = sk.rows[0]!.length;
      const heights = new Float32Array(w * h);
      sk.rows.forEach((row, z) => {
        for (let x = 0; x < w; x++)
          heights[x + z * w] =
            this.waterLevel + (SKETCH_OFFSETS[Number(row[x])] ?? 3);
      });
      this.sketch = { w, h, heights };
    } else this.sketch = null;

    this.models = Object.fromEntries(
      Object.entries(spec.models).map(([id, m]) => [id, rasterizeModel(m)]),
    );
    this.buildStamps();
    this.spawn = this.findSpawn();
  }

  // ---- рельеф -------------------------------------------------------------------

  /** y верхнего блока земли. Чистая функция координат: соседние чанки сходятся без швов. */
  heightAt(wx: number, wz: number): number {
    const { W, D } = this;
    const mode = this.spec.size.mode;
    const e = Math.max(-wx, wx - (W - 1), -wz, wz - (D - 1)); // > 0 — вне области рецепта
    const sea = this.waterLevel - 7;
    let h: number;
    if (e > 0 && mode !== "infinite") {
      h = sea - Math.min(5, e / 6); // открытое море вокруг
    } else {
      const u = clamp01(wx / (W - 1)),
        v = clamp01(wz / (D - 1));
      h = this.terrainHeight(wx, wz, u, v);
      if (mode === "infinite") {
        if (e > 0) {
          // за областью рецепта мир продолжается обычной холмистой сушей
          const t = this.spec.terrain;
          const farH =
            t.baseHeight +
            this.far.fbm(wx * 0.006, wz * 0.006, 4) * Math.max(6, t.amplitude);
          h += (farH - h) * smoothstep(0, 64, e);
        }
      } else {
        h = sea + (h - sea) * smoothstep(0, 20, -e); // берег у края ограниченного мира
      }
    }
    return Math.max(2, Math.min(SY - 12, Math.round(h)));
  }

  private terrainHeight(wx: number, wz: number, u: number, v: number): number {
    const t = this.spec.terrain;
    const f = 0.003 + t.roughness * 0.017;
    const octaves = 3 + Math.round(t.roughness * 2);
    const n = this.hNoise.fbm(wx * f, wz * f, octaves);
    const d =
      this.dNoise.noise(wx * 0.06, wz * 0.06) * (0.4 + t.roughness * 1.4);
    const A = t.amplitude,
      base = t.baseHeight;
    let h: number;
    switch (t.shape) {
      case "flat":
        h = base + n * A * 0.15 + d * 0.3;
        break;
      case "mountains": {
        const r = 1 - Math.abs(this.ridge.fbm(wx * f * 0.7, wz * f * 0.7, 4));
        h = base - A * 0.3 + r * r * A * 1.8 + n * A * 0.25 + d;
        break;
      }
      case "valley": {
        // извилистое русло поперёк мира: дно ниже воды → река
        const c =
          0.5 + 0.18 * Math.sin(v * Math.PI * 2 + (this.seed % 628) / 100);
        const dist = Math.min(1, Math.abs(u - c) * 2.2);
        h = base - A * 0.5 + A * 1.4 * Math.pow(dist, 1.5) + n * A * 0.3 + d;
        break;
      }
      case "plateau": {
        const raw = base + n * A * 1.2;
        const step = Math.max(3, Math.round(A / 3));
        h = Math.floor(raw / step) * step + d * 0.3;
        break;
      }
      default:
        h = base + n * A + d;
    }
    if (this.hm) h += (this.sampleHeightmap(u, v) + d * 0.4 - h) * 0.85;
    else if (this.sketch)
      h += (this.sampleSketch(u, v) + n * A * 0.2 + d * 0.6 - h) * 0.85;
    h += this.zoneOffset(u, v);
    // С наброском береговую линию рисует сам ИИ — маска острова её бы перерезала.
    if (!this.sketch && (t.shape === "island" || t.shape === "archipelago")) {
      const sea = this.waterLevel - 7;
      h = sea + (h - sea) * this.islandMask(wx, wz, u, v);
    }
    return h;
  }

  private islandMask(wx: number, wz: number, u: number, v: number): number {
    const ex = (u - 0.5) * 2,
      ez = (v - 0.5) * 2;
    const r =
      Math.sqrt(ex * ex + ez * ez) +
      this.warp.noise(wx * 0.012, wz * 0.012) * 0.18;
    if (this.spec.terrain.shape === "island")
      return 1 - smoothstep(0.6, 0.95, r);
    const blob = this.warp.fbm(wx * 0.02 + 97, wz * 0.02 - 41, 3);
    let m = smoothstep(0, 0.2, blob + 0.2 - r * 0.35);
    m = Math.max(m, 1 - smoothstep(0.08, 0.22, r)); // центральный остров — под спавн
    return m * (1 - smoothstep(0.85, 1, r));
  }

  private sampleHeightmap(u: number, v: number): number {
    const hm = this.hm!;
    const gx = u * (hm.w - 1),
      gz = v * (hm.h - 1);
    const x0 = Math.floor(gx),
      z0 = Math.floor(gz);
    const x1 = Math.min(hm.w - 1, x0 + 1),
      z1 = Math.min(hm.h - 1, z0 + 1);
    const fx = gx - x0,
      fz = gz - z0;
    const at = (x: number, z: number) => hm.data[x + z * hm.w]!;
    const top = at(x0, z0) + (at(x1, z0) - at(x0, z0)) * fx;
    const bot = at(x0, z1) + (at(x1, z1) - at(x0, z1)) * fx;
    const val = top + (bot - top) * fz;
    return hm.low + (val / 255) * (hm.high - hm.low);
  }

  /** Набросок ИИ: билинейно между центрами клеток. */
  private sampleSketch(u: number, v: number): number {
    const s = this.sketch!;
    const gx = Math.min(s.w - 1, Math.max(0, u * s.w - 0.5)),
      gz = Math.min(s.h - 1, Math.max(0, v * s.h - 0.5));
    const x0 = Math.floor(gx),
      z0 = Math.floor(gz);
    const x1 = Math.min(s.w - 1, x0 + 1),
      z1 = Math.min(s.h - 1, z0 + 1);
    const fx = gx - x0,
      fz = gz - z0;
    const at = (x: number, z: number) => s.heights[x + z * s.w]!;
    const top = at(x0, z0) + (at(x1, z0) - at(x0, z0)) * fx;
    const bot = at(x0, z1) + (at(x1, z1) - at(x0, z1)) * fx;
    return top + (bot - top) * fz;
  }

  private sampleSurface(u: number, v: number): number {
    const sm = this.sm!;
    const x = Math.min(sm.w - 1, Math.floor(u * sm.w)),
      z = Math.min(sm.h - 1, Math.floor(v * sm.h));
    return sm.ids[x + z * sm.w]!;
  }

  /** Сдвиг рельефа зон — мягко, к краю зоны сходит на нет. */
  private zoneOffset(u: number, v: number): number {
    let num = 0,
      den = 0;
    for (const z of this.zones) {
      if (!z.height) continue;
      const d = Math.hypot(u - z.x, v - z.z) / z.radius;
      if (d >= 1) continue;
      const w = (1 - d) * (1 - d);
      num += w * z.height;
      den += w;
    }
    return den > 1 ? num / den : num;
  }

  /** Зона точки: ближайшая с учётом радиуса (взвешенная диаграмма Вороного). */
  zoneAt(u: number, v: number): WorldZone {
    let best = this.zones[0]!,
      bestScore = Infinity;
    for (const z of this.zones) {
      const s = Math.hypot(u - z.x, v - z.z) / z.radius;
      if (s < bestScore) {
        bestScore = s;
        best = z;
      }
    }
    return best;
  }

  zoneAtWorld(wx: number, wz: number): WorldZone {
    return this.zoneAt(wx / (this.W - 1), wz / (this.D - 1));
  }

  /** Поверхность колонны: зона → карта картинки → пляж / снег / скалы. */
  columnInfo(wx: number, wz: number, h: number, slope: number): ColumnInfo {
    const u = wx / (this.W - 1),
      v = wz / (this.D - 1);
    const zone = this.zoneAt(u, v);
    const water = this.waterLevel;
    let surface = B[zone.surface] ?? B.grass!;
    let subsurface = B[zone.subsurface] ?? B.dirt!;

    if (h < water - 1) {
      // дно
      const n = this.patch.noise(wx * 0.08, wz * 0.08);
      surface =
        zone.biome === "swamp"
          ? B.clay!
          : n > 0.35
            ? B.gravel!
            : n < -0.4
              ? B.clay!
              : B.sand!;
      subsurface = surface === B.clay ? B.clay! : B.sand!;
      return { surface, subsurface, zone, underwater: true };
    }

    const inCore = u >= 0 && u <= 1 && v >= 0 && v <= 1;
    const mapped = inCore && this.sm ? this.sampleSurface(u, v) : -1;
    if (mapped === WATER_CELL) {
      surface = subsurface = B.sand!;
    } else if (mapped >= 0) {
      surface = mapped;
      subsurface = B[SUBSURFACE_OF[nameOf(mapped)] ?? "dirt"]!;
    } else if (h <= water + 1 && !NO_BEACH.has(zone.biome)) {
      surface = subsurface = B.sand!;
    } else if (h >= this.snowLine && !NO_SNOW.has(zone.biome)) {
      surface = B.snow!;
    } else if (slope >= 3 && (surface === B.grass || surface === B.snow)) {
      surface = B.stone!; // обрывы — голый камень
      subsurface = B.stone!;
    }
    return { surface, subsurface, zone, underwater: h < water };
  }

  // ---- чанк ---------------------------------------------------------------------

  generate(chunk: Chunk): void {
    const water = this.waterLevel;
    const rng = mulberry32(
      hashString(`spec:${this.seed}:${chunk.cx},${chunk.cz}`),
    );
    const wx0 = chunk.cx * SX,
      wz0 = chunk.cz * SZ;

    // высоты с каймой в блок — для крутизны склона на краях чанка
    const G = SX + 2;
    const grid = new Int16Array(G * (SZ + 2));
    for (let z = -1; z <= SZ; z++)
      for (let x = -1; x <= SX; x++)
        grid[x + 1 + (z + 1) * G] = this.heightAt(wx0 + x, wz0 + z);

    const heights = new Int16Array(SX * SZ);
    const surfaces = new Uint8Array(SX * SZ);
    const zoneOf: WorldZone[] = new Array<WorldZone>(SX * SZ);
    const iceTop = B.ice!,
      waterMeta = packWater(8, true);

    for (let z = 0; z < SZ; z++)
      for (let x = 0; x < SX; x++) {
        const at = (dx: number, dz: number) =>
          grid[x + 1 + dx + (z + 1 + dz) * G]!;
        const h = at(0, 0);
        const slope = Math.max(
          Math.abs(h - at(1, 0)),
          Math.abs(h - at(-1, 0)),
          Math.abs(h - at(0, 1)),
          Math.abs(h - at(0, -1)),
        );
        const info = this.columnInfo(wx0 + x, wz0 + z, h, slope);
        for (let y = 0; y <= h; y++) {
          let id: number;
          if (y === 0) id = B.bedrock!;
          else if (y === 1 && rng() < 0.5) id = B.bedrock!;
          else if (y === h) id = info.surface;
          else if (y >= h - 3) id = info.subsurface;
          else id = B.stone!;
          chunk.setRaw(x, y, z, id);
        }
        const frozen = info.zone.biome === "snow";
        for (let y = h + 1; y <= water; y++) {
          if (frozen && y === water) chunk.setRaw(x, y, z, iceTop);
          else chunk.setRaw(x, y, z, B.water!, waterMeta);
        }
        const i = x + z * SX;
        heights[i] = h;
        surfaces[i] = info.surface;
        zoneOf[i] = info.zone;
      }

    generateOres(chunk, rng);
    this.vegetation(chunk, rng, heights, surfaces, zoneOf);
    this.applyStamps(chunk);
    chunk.generated = true;
  }

  private vegetation(
    chunk: Chunk,
    rng: () => number,
    heights: Int16Array,
    surfaces: Uint8Array,
    zoneOf: WorldZone[],
  ): void {
    const water = this.waterLevel;
    const m = TREE_MAX_RADIUS; // крона не выходит за чанк
    for (let t = 0; t < 10; t++) {
      const x = m + ((rng() * (SX - 2 * m)) | 0),
        z = m + ((rng() * (SZ - 2 * m)) | 0);
      const i = x + z * SX;
      const zone = zoneOf[i]!,
        h = heights[i]!;
      if (rng() > zone.trees * 0.6) continue;
      if (h <= water || h + TREE_MAX_HEIGHT >= SY) continue;
      if (!this.growsOn[zone.treeType].has(surfaces[i]!)) continue;
      if (chunk.get(x, h + 1, z) !== B.air) continue;
      plantTree(zone.treeType, x, h, z, rng, (tx, ty, tz, id, soft) => {
        if (ty >= SY || tx < 0 || tx >= SX || tz < 0 || tz >= SZ) return;
        if (soft && chunk.get(tx, ty, tz) !== B.air) return;
        chunk.setRaw(tx, ty, tz, id);
      });
    }
    for (let z = 0; z < SZ; z++)
      for (let x = 0; x < SX; x++) {
        const i = x + z * SX;
        const h = heights[i]!,
          zone = zoneOf[i]!;
        if (surfaces[i] !== B.grass || h <= water || h + 1 >= SY) continue;
        if (chunk.get(x, h + 1, z) !== B.air) continue;
        const r = rng();
        const g = zone.grass * 0.25;
        if (r < g) chunk.setRaw(x, h + 1, z, B.tallgrass!);
        else if (r < g + zone.flowers * 0.2)
          chunk.setRaw(
            x,
            h + 1,
            z,
            rng() < 0.5 ? B.flower_yellow! : B.flower_red!,
          );
      }
  }

  // ---- постройки (штампы) --------------------------------------------------------

  private buildStamps(): void {
    const pal = resolvePalette(this.spec.palette);
    const target: StampTarget = {
      groundAt: (x, z) => this.heightAt(x, z),
      surfaceAt: (x, z) =>
        this.columnInfo(x, z, this.heightAt(x, z), 0).surface,
      waterLevel: this.waterLevel,
      treeTypeAt: (x, z) => this.zoneAtWorld(x, z).treeType,
      put: (x, y, z, id, meta = 0) => this.stamp(x, y, z, id, meta, 0),
      putSoft: (x, y, z, id) => this.stamp(x, y, z, id, 0, 1),
    };
    const W1 = this.W - 1,
      D1 = this.D - 1;
    this.spec.structures.forEach((s, i) => {
      const rng = mulberry32(hashString(`struct:${this.seed}:${i}`));
      buildStructure(
        s,
        Math.round(s.x * W1),
        Math.round(s.z * D1),
        Math.round((s.x2 ?? s.x) * W1),
        Math.round((s.z2 ?? s.z) * D1),
        pal,
        target,
        rng,
        this.models,
        s.path?.map(([x, z]): [number, number] => [
          Math.round(x * W1),
          Math.round(z * D1),
        ]),
      );
    });
  }

  private stamp(
    x: number,
    y: number,
    z: number,
    id: number,
    meta: number,
    soft: 0 | 1,
  ): void {
    if (y < 1 || y >= SY) return;
    const cx = Math.floor(x / SX),
      cz = Math.floor(z / SZ);
    const key = cx + "," + cz;
    let m = this.stamps.get(key);
    if (!m) this.stamps.set(key, (m = new Map()));
    const i = idx(x - cx * SX, y, z - cz * SZ);
    if (soft) {
      const prev = m.get(i);
      if (prev && !prev[2] && prev[0] !== B.air) return; // листва не затирает стены
    }
    m.set(i, [id, meta, soft]);
    if (id !== B.air) this.stampedCols.add(colKey(x, z));
  }

  private applyStamps(chunk: Chunk): void {
    const m = this.stamps.get(chunk.cx + "," + chunk.cz);
    if (!m) return;
    for (const [i, [id, meta, soft]] of m) {
      if (soft && chunk.blocks[i] !== B.air) continue;
      chunk.blocks[i] = id;
      chunk.meta[i] = meta;
    }
  }

  /**
   * Верх построек в колонне — для миникарты: верхний непустой блок и нижний вырезанный (air).
   * Вырез ниже поверхности значит, что постройка срыла верх (русло, пруд) — тогда видна она, а не
   * земля над ней.
   */
  stampTopAt(
    wx: number,
    wz: number,
  ): { y: number; id: number; dug: number } | undefined {
    if (!this.stampTops) {
      const tops = new Map<number, { y: number; id: number; dug: number }>();
      for (const [key, m] of this.stamps) {
        const [cx, cz] = key.split(",").map(Number) as [number, number];
        for (const [i, [id, , soft]] of m) {
          const x = cx * SX + (i & 15),
            z = cz * SZ + ((i >> 4) & 15),
            y = i >> 8;
          const k = colKey(x, z);
          let t = tops.get(k);
          if (!t) tops.set(k, (t = { y: -1, id: B.air!, dug: Infinity }));
          if (id === B.air) {
            if (!soft) t.dug = Math.min(t.dug, y);
          } else if (y > t.y) {
            t.y = y;
            t.id = id;
          }
        }
      }
      for (const [k, t] of tops) if (t.y < 0) tops.delete(k); // одни вырезы без блоков — не постройка
      this.stampTops = tops;
    }
    return this.stampTops.get(colKey(wx, wz));
  }

  // ---- спавн ----------------------------------------------------------------------

  /** Суша ближе всего к центру, с площадкой 5×5 без построек: не внутри дома и не вплотную к стене. */
  private findSpawn(): { x: number; z: number } {
    const cx = Math.floor(this.W / 2),
      cz = Math.floor(this.D / 2);
    const clear = (x: number, z: number): boolean => {
      for (let dz = -2; dz <= 2; dz++)
        for (let dx = -2; dx <= 2; dx++)
          if (this.stampedCols.has(colKey(x + dx, z + dz))) return false;
      return true;
    };
    const maxR = Math.max(this.W, this.D) / 2;
    for (let r = 0; r <= maxR; r += 4) {
      const steps = r === 0 ? 1 : Math.ceil((2 * Math.PI * r) / 4);
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2;
        const x = Math.round(cx + Math.cos(a) * r),
          z = Math.round(cz + Math.sin(a) * r);
        if (this.heightAt(x, z) > this.waterLevel + 1 && clear(x, z))
          return { x, z };
      }
    }
    return { x: cx, z: cz };
  }

  spawnHint(): { x: number; z: number } {
    return this.spawn;
  }
}

function defaultZone(spec: WorldSpec): WorldZone {
  const biome: Biome = spec.terrain.shape === "mountains" ? "taiga" : "meadow";
  return { x: 0.5, z: 0.5, radius: 2, biome, ...BIOME_PRESETS[biome] };
}

const NAMES: string[] = [];
function nameOf(id: number): string {
  if (!NAMES.length) for (const [n, i] of Object.entries(B)) NAMES[i] = n;
  return NAMES[id] ?? "";
}
