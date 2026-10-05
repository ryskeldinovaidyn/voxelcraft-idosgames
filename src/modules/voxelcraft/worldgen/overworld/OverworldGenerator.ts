// Верхний мир поколения 2 — новые миры по сиду (сейв v3): высота 128, море на 62, материки и
// океаны, горы до ~120, биомы по температуре и влажности, пещеры из 3D-шума с лавой на дне, руды по
// глубине, деревья и травы по биомам. Старые миры по сиду остаются на TerrainGenerator: их вывод
// зафиксирован сейвами v1/v2.
//
// ⚠ Вывод этого генератора станет частью формата сейва, как только миры gen 2 уйдут игрокам
// (релиз). До релиза его можно менять вместе с отпечатком в тесте; после — только новой версией gen.
import { Simplex2, Simplex3, mulberry32, hashString } from "../../core/Noise";
import { B, packWater } from "../../registry/Blocks";
import { CHUNK_SIZE, idx, type Chunk } from "../../world/Chunk";
import type { WorldGenerator } from "../WorldGenerator";
import { growTree, TREE_MAX_HEIGHT, TREE_MAX_RADIUS } from "../trees";
import {
  HUGE_MUSHROOM_HEIGHT,
  HUGE_MUSHROOM_RADIUS,
  growHugeMushroom,
} from "../mushrooms";
import { FACING_DIRS } from "../../registry/meta";
import type { TreeType } from "../WorldSpec";
import {
  carveCitadels,
  citadelAt,
  makeCitadel,
  nearestCitadel,
  type Citadel,
} from "../features/citadel";
import {
  VILLAGE_REGION,
  carveVillages,
  planVillage,
  type Village,
} from "../features/village";
import { HIVE_SEEDED } from "../../registry/blocks/bees";
import {
  TEMPLE_REGION,
  inTemple,
  planTemple,
  seaRoll,
  type Temple,
} from "../features/temple";
import {
  WRECK_REGION,
  planWreck,
  wreckLoot,
  type Wreck,
} from "../features/shipwreck";
import {
  OUTPOST_REGION,
  inOutpost,
  outpostLoot,
  planOutpost,
  type Outpost,
} from "../features/outpost";
import {
  MINESHAFT_REGION,
  type Mineshaft,
  inMineshaft,
  mineshaftLoot,
  planMineshaft,
} from "../features/mineshaft";
import {
  TREASURE_REGION,
  planTreasure,
  treasureLoot,
  type Buried,
} from "../features/treasure";
import {
  MANSION_REGION,
  inMansion,
  mansionLoot,
  planMansion,
  type Mansion,
} from "../features/mansion";
import {
  ANCIENT_REGION,
  ancientLoot,
  inAncientCity,
  planAncientCity,
  type AncientCity,
} from "../features/ancientCity";
import { CAN_SUMMON } from "../../registry/blocks/sculk";
import {
  RUINS_REGION,
  WELL_REGION,
  archaeologyLoot,
  planRuins,
  planWell,
  type Dig,
} from "../features/archaeology";
import {
  TRIAL_REGION,
  inTrialChamber,
  planTrialChamber,
  type TrialChamber,
} from "../features/trialChambers";
import { vaultLootAt } from "../../systems/TrialSpawner";
import { CORALS } from "../../registry/blocks/sealife";
import type { ItemStack } from "../../types";

const { SX, SY, SZ } = CHUNK_SIZE;
export const SEA = 62;

export type OverworldBiome =
  | "ocean"
  | "warm_ocean"
  | "beach"
  | "plains"
  | "forest"
  | "birch_forest"
  | "taiga"
  | "snowy"
  | "desert"
  | "savanna"
  | "jungle"
  | "swamp"
  | "mountains"
  | "dark_forest"
  | "cherry_grove"
  | "mangrove_swamp"
  | "mushroom_fields";

interface BiomeDef {
  surface: string;
  under: string;
  /** Порода: из рецепта мира (TreeType) или новая (jungle, acacia, dark_oak, cherry — registry/blocks/wood). */
  tree: TreeType | "jungle" | "acacia" | "dark_oak" | "cherry" | "mangrove";
  /** Доля попыток посадить дерево (10 на чанк). */
  trees: number;
  grass: number;
  flowers: number;
}

const BIOMES: Record<OverworldBiome, BiomeDef> = {
  ocean: {
    surface: "sand",
    under: "sand",
    tree: "none",
    trees: 0,
    grass: 0,
    flowers: 0,
  },
  warm_ocean: {
    surface: "sand",
    under: "sand",
    tree: "none",
    trees: 0,
    grass: 0,
    flowers: 0,
  },
  beach: {
    surface: "sand",
    under: "sand",
    tree: "none",
    trees: 0,
    grass: 0,
    flowers: 0,
  },
  plains: {
    surface: "grass",
    under: "dirt",
    tree: "oak",
    trees: 0.05,
    grass: 0.35,
    flowers: 0.06,
  },
  forest: {
    surface: "grass",
    under: "dirt",
    tree: "oak",
    trees: 0.9,
    grass: 0.2,
    flowers: 0.04,
  },
  birch_forest: {
    surface: "grass",
    under: "dirt",
    tree: "birch",
    trees: 0.8,
    grass: 0.2,
    flowers: 0.05,
  },
  taiga: {
    surface: "grass",
    under: "dirt",
    tree: "spruce",
    trees: 0.8,
    grass: 0.15,
    flowers: 0.01,
  },
  snowy: {
    surface: "snow",
    under: "dirt",
    tree: "spruce",
    trees: 0.15,
    grass: 0,
    flowers: 0,
  },
  desert: {
    surface: "sand",
    under: "sandstone",
    tree: "dead",
    trees: 0.03,
    grass: 0,
    flowers: 0,
  },
  savanna: {
    surface: "grass",
    under: "dirt",
    tree: "acacia",
    trees: 0.12,
    grass: 0.5,
    flowers: 0.01,
  },
  jungle: {
    surface: "grass",
    under: "dirt",
    tree: "jungle",
    trees: 1,
    grass: 0.5,
    flowers: 0.05,
  },
  swamp: {
    surface: "grass",
    under: "dirt",
    tree: "oak",
    trees: 0.3,
    grass: 0.3,
    flowers: 0.02,
  },
  mountains: {
    surface: "grass",
    under: "dirt",
    tree: "spruce",
    trees: 0.1,
    grass: 0.05,
    flowers: 0,
  },
  // тёмный лес: сплошной полог тёмного дуба, под ним сумрак — там стоят особняки
  dark_forest: {
    surface: "grass",
    under: "dirt",
    tree: "dark_oak",
    trees: 1,
    grass: 0.15,
    flowers: 0.02,
  },
  // вишнёвая роща: редкие розовые вишни на холмах, трава в лепестках
  cherry_grove: {
    surface: "grass",
    under: "dirt",
    tree: "cherry",
    trees: 0.35,
    grass: 0.4,
    flowers: 0,
  },
  // мангровое болото: дно из грязи на мелководье, мангры на корнях прямо в воде
  mangrove_swamp: {
    surface: "mud",
    under: "mud",
    tree: "mangrove",
    trees: 0.7,
    grass: 0,
    flowers: 0,
  },
  // грибные поля: мицелий, огромные грибы вместо деревьев (extras), только грибные коровы, без монстров
  mushroom_fields: {
    surface: "mycelium",
    under: "dirt",
    tree: "none",
    trees: 0,
    grass: 0,
    flowers: 0,
  },
};

/**
 * Руды: [имя, жил на чанк, длина жилы, min y, max y] — пропорции Minecraft 1.18, ужатые в высоту
 * 0..127. Руды, которых ещё нет в реестре, пропускаются.
 */
const ORES: readonly [string, number, number, number, number][] = [
  ["coal_ore", 20, 12, 5, 120],
  ["iron_ore", 12, 8, 5, 72],
  ["copper_ore", 8, 10, 40, 96],
  ["gold_ore", 4, 8, 5, 32],
  ["redstone_ore", 6, 7, 5, 16],
  ["lapis_ore", 2, 6, 5, 30],
  ["diamond_ore", 1, 7, 5, 14],
];

/** Шесть граней клетки (жеоды, озерца пышных пещер). */
const FACES6: readonly (readonly [number, number, number])[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

/** Пещера ниже этой высоты заполнена лавой (как «лавовое озеро» старого Minecraft). */
const LAVA_LEVEL = 10;

/** Подземная цитадель: y пола зала портала (рамки стоят на нём). */
export const CITADEL_Y = 24;

const clamp = (v: number, a: number, b: number): number =>
  Math.min(b, Math.max(a, v));
const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// решётка 3D-поля пещер: шаг 4 по x/z и 8 по y, как в Minecraft; внутри — трилинейная интерполяция
const GX = SX / 4 + 1,
  GY = SY / 8 + 1,
  GZ = SZ / 4 + 1;

export class OverworldGenerator implements WorldGenerator {
  readonly seed: number;
  readonly waterLevel = SEA;
  private readonly cont: Simplex2;
  private readonly hills: Simplex2;
  private readonly detail: Simplex2;
  private readonly ridge: Simplex2;
  private readonly mtn: Simplex2;
  private readonly temp: Simplex2;
  private readonly hum: Simplex2;
  private readonly patch: Simplex2;
  /** Пятна пышных пещер. */
  private readonly lush: Simplex2;
  /** Пятна глубокой тьмы. */
  private readonly deep: Simplex2;
  /** Пятна капельниковых пещер. */
  private readonly drip: Simplex2;
  private readonly caveA: Simplex3;
  private readonly caveB: Simplex3;
  private readonly cheese: Simplex3;
  private spawn: { x: number; z: number } | null = null;
  /** Три цитадели на кольце 300–700 блоков от центра (в Minecraft — дальше; для браузера ближе). */
  private readonly citadels: Citadel[];
  /** Деревни по регионам (VILLAGE_REGION): план считается при первом обращении. */
  private readonly villages = new Map<string, Village | null>();
  /** Подводные храмы по регионам (TEMPLE_REGION). */
  private readonly temples = new Map<string, Temple | null>();
  /** Затонувшие корабли по регионам (WRECK_REGION). */
  private readonly wrecks = new Map<string, Wreck | null>();
  /** Заброшенные шахты по регионам (MINESHAFT_REGION). */
  private readonly mineshafts = new Map<string, Mineshaft | null>();
  /** Заставы мародёров по регионам (OUTPOST_REGION). */
  private readonly outposts = new Map<string, Outpost | null>();
  /** Зарытые клады по регионам (TREASURE_REGION). */
  private readonly treasures = new Map<string, Buried | null>();
  /** Особняки по регионам (MANSION_REGION). */
  private readonly mansions = new Map<string, Mansion | null>();
  /** Древние города по регионам (ANCIENT_REGION). */
  private readonly ancientCities = new Map<string, AncientCity | null>();
  /** Пустынные колодцы (WELL_REGION) и засыпанные руины (RUINS_REGION) — места раскопок. */
  private readonly wells = new Map<string, Dig | null>();
  private readonly ruins = new Map<string, Dig | null>();
  /** Испытательные камеры по регионам (TRIAL_REGION). */
  private readonly trials = new Map<string, TrialChamber | null>();

  constructor(seed: number) {
    this.seed = seed;
    const n2 = (k: string) => new Simplex2(hashString(`ow:${k}:${seed}`));
    const n3 = (k: string) => new Simplex3(hashString(`ow:${k}:${seed}`));
    this.cont = n2("continent");
    this.hills = n2("hills");
    this.detail = n2("detail");
    this.ridge = n2("ridge");
    this.mtn = n2("mountain");
    this.temp = n2("temperature");
    this.hum = n2("humidity");
    this.patch = n2("patch");
    this.lush = n2("lush");
    this.deep = n2("deep");
    this.drip = n2("drip");
    this.caveA = n3("caveA");
    this.caveB = n3("caveB");
    this.cheese = n3("cheese");
    this.citadels = this.planCitadels();
  }

  /** Три цитадели на кольце 300–700 блоков от центра (worldgen/features/citadel). */
  private planCitadels(): Citadel[] {
    const r = mulberry32(hashString(`ow-citadel:${this.seed}`));
    const a0 = r() * Math.PI * 2;
    return [0, 1, 2].map((k) => {
      const a = a0 + (k * Math.PI * 2) / 3,
        d = 300 + r() * 400;
      return makeCitadel(
        Math.round(Math.cos(a) * d),
        Math.round(Math.sin(a) * d),
        CITADEL_Y,
        r,
      );
    });
  }

  private citadel(chunk: Chunk): void {
    carveCitadels(chunk, this.citadels);
  }

  /** Деревня региона (rx, rz) или null (worldgen/features/village). */
  villageIn(rx: number, rz: number): Village | null {
    const k = rx + "," + rz;
    if (!this.villages.has(k))
      this.villages.set(
        k,
        planVillage(
          this,
          this.seed,
          rx,
          rz,
          mulberry32(hashString(`ow-village:${this.seed}:${rx},${rz}`)),
        ),
      );
    return this.villages.get(k)!;
  }

  /** Подводный храм региона (rx, rz) или null (worldgen/features/temple). */
  templeIn(rx: number, rz: number): Temple | null {
    const k = rx + "," + rz;
    if (!this.temples.has(k))
      this.temples.set(k, planTemple(this, this.seed, rx, rz));
    return this.temples.get(k)!;
  }

  /** Деревни и подводные храмы с центром ближе r к (x, z) — Game селит в них жителей. */
  villagesNear(x: number, z: number, r: number): Village[] {
    const out: Village[] = [];
    for (const [region, get] of [
      [VILLAGE_REGION, (a: number, b: number) => this.villageIn(a, b)],
      [TEMPLE_REGION, (a: number, b: number) => this.templeIn(a, b)],
      [OUTPOST_REGION, (a: number, b: number) => this.outpostIn(a, b)],
      [MANSION_REGION, (a: number, b: number) => this.mansionIn(a, b)],
    ] as const) {
      const rx = Math.floor(x / region),
        rz = Math.floor(z / region);
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++) {
          const v = get(rx + dx, rz + dz);
          if (v && Math.hypot(v.x - x, v.z - z) < r) out.push(v);
        }
    }
    return out;
  }

  structureAt(x: number, y: number, z: number): string | null {
    if (citadelAt(this.citadels, x, y, z)) return "citadel";
    const fx = Math.floor(x),
      fy = Math.floor(y),
      fz = Math.floor(z);
    const t = this.templeIn(
      Math.floor(x / TEMPLE_REGION),
      Math.floor(z / TEMPLE_REGION),
    );
    if (t && inTemple(t, fx, fy, fz)) return "sea_temple";
    const o = this.outpostIn(
      Math.floor(x / OUTPOST_REGION),
      Math.floor(z / OUTPOST_REGION),
    );
    if (o && inOutpost(o, fx, fy, fz)) return "outpost";
    const ms = this.mineshaftIn(
      Math.floor(x / MINESHAFT_REGION),
      Math.floor(z / MINESHAFT_REGION),
    );
    if (ms && inMineshaft(ms, fx, fy, fz)) return "mineshaft";
    const m = this.mansionIn(
      Math.floor(x / MANSION_REGION),
      Math.floor(z / MANSION_REGION),
    );
    if (m && inMansion(m, fx, fy, fz)) return "mansion";
    const ac = this.ancientCityIn(
      Math.floor(x / ANCIENT_REGION),
      Math.floor(z / ANCIENT_REGION),
    );
    if (ac && inAncientCity(ac, fx, fy, fz)) return "ancient_city";
    const tc = this.trialIn(
      Math.floor(x / TRIAL_REGION),
      Math.floor(z / TRIAL_REGION),
    );
    return tc && inTrialChamber(tc, fx, fy, fz) ? "trial_chambers" : null;
  }

  locate(
    kind: string,
    x: number,
    z: number,
  ): { x: number; y: number; z: number } | null {
    if (kind === "village") {
      // ближайшая деревня — кольцами регионов вокруг точки
      const rx = Math.floor(x / VILLAGE_REGION),
        rz = Math.floor(z / VILLAGE_REGION);
      let best: Village | null = null;
      for (let ring = 0; ring <= 6 && !best; ring++)
        for (let dx = -ring; dx <= ring; dx++)
          for (let dz = -ring; dz <= ring; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
            const v = this.villageIn(rx + dx, rz + dz);
            if (
              v &&
              (!best ||
                Math.hypot(v.x - x, v.z - z) <
                  Math.hypot(best.x - x, best.z - z))
            )
              best = v;
          }
      return best ? { x: best.x, y: best.y, z: best.z } : null;
    }
    if (kind === "buried_treasure") {
      const rx = Math.floor(x / TREASURE_REGION),
        rz = Math.floor(z / TREASURE_REGION);
      let best: Buried | null = null;
      for (let ring = 0; ring <= 8 && !best; ring++)
        for (let dx = -ring; dx <= ring; dx++)
          for (let dz = -ring; dz <= ring; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
            const t = this.treasureIn(rx + dx, rz + dz);
            if (
              t &&
              (!best ||
                Math.hypot(t.x - x, t.z - z) <
                  Math.hypot(best.x - x, best.z - z))
            )
              best = t;
          }
      return best ? { x: best.x, y: best.y, z: best.z } : null;
    }
    if (kind === "trial_chambers") {
      const rx = Math.floor(x / TRIAL_REGION),
        rz = Math.floor(z / TRIAL_REGION);
      let best: TrialChamber | null = null;
      for (let ring = 0; ring <= 5 && !best; ring++)
        for (let dx = -ring; dx <= ring; dx++)
          for (let dz = -ring; dz <= ring; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
            const t = this.trialIn(rx + dx, rz + dz);
            if (
              t &&
              (!best ||
                Math.hypot(t.x - x, t.z - z) <
                  Math.hypot(best.x - x, best.z - z))
            )
              best = t;
          }
      return best ? { x: best.x, y: best.y, z: best.z } : null;
    }
    if (kind === "trail_ruins") {
      const rx = Math.floor(x / RUINS_REGION),
        rz = Math.floor(z / RUINS_REGION);
      let best: Dig | null = null;
      for (let ring = 0; ring <= 8 && !best; ring++)
        for (let dx = -ring; dx <= ring; dx++)
          for (let dz = -ring; dz <= ring; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
            const r = this.ruinsIn(rx + dx, rz + dz);
            if (
              r &&
              (!best ||
                Math.hypot(r.x - x, r.z - z) <
                  Math.hypot(best.x - x, best.z - z))
            )
              best = r;
          }
      return best ? { x: best.x, y: best.y, z: best.z } : null;
    }
    if (kind === "ancient_city") {
      const rx = Math.floor(x / ANCIENT_REGION),
        rz = Math.floor(z / ANCIENT_REGION);
      let best: AncientCity | null = null;
      for (let ring = 0; ring <= 5 && !best; ring++)
        for (let dx = -ring; dx <= ring; dx++)
          for (let dz = -ring; dz <= ring; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
            const a = this.ancientCityIn(rx + dx, rz + dz);
            if (
              a &&
              (!best ||
                Math.hypot(a.x - x, a.z - z) <
                  Math.hypot(best.x - x, best.z - z))
            )
              best = a;
          }
      return best ? { x: best.x, y: best.y, z: best.z } : null;
    }
    if (kind === "mansion") {
      const rx = Math.floor(x / MANSION_REGION),
        rz = Math.floor(z / MANSION_REGION);
      let best: Mansion | null = null;
      for (let ring = 0; ring <= 5 && !best; ring++)
        for (let dx = -ring; dx <= ring; dx++)
          for (let dz = -ring; dz <= ring; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
            const m = this.mansionIn(rx + dx, rz + dz);
            if (
              m &&
              (!best ||
                Math.hypot(m.x - x, m.z - z) <
                  Math.hypot(best.x - x, best.z - z))
            )
              best = m;
          }
      return best ? { x: best.x, y: best.y, z: best.z } : null;
    }
    if (kind === "outpost") {
      const rx = Math.floor(x / OUTPOST_REGION),
        rz = Math.floor(z / OUTPOST_REGION);
      let best: Outpost | null = null;
      for (let ring = 0; ring <= 5 && !best; ring++)
        for (let dx = -ring; dx <= ring; dx++)
          for (let dz = -ring; dz <= ring; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
            const o = this.outpostIn(rx + dx, rz + dz);
            if (
              o &&
              (!best ||
                Math.hypot(o.x - x, o.z - z) <
                  Math.hypot(best.x - x, best.z - z))
            )
              best = o;
          }
      return best ? { x: best.x, y: best.y, z: best.z } : null;
    }
    if (kind === "shipwreck") {
      const rx = Math.floor(x / WRECK_REGION),
        rz = Math.floor(z / WRECK_REGION);
      let best: Wreck | null = null;
      for (let ring = 0; ring <= 6 && !best; ring++)
        for (let dx = -ring; dx <= ring; dx++)
          for (let dz = -ring; dz <= ring; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
            const w = this.wreckIn(rx + dx, rz + dz);
            if (
              w &&
              (!best ||
                Math.hypot(w.x - x, w.z - z) <
                  Math.hypot(best.x - x, best.z - z))
            )
              best = w;
          }
      return best ? { x: best.x, y: best.y, z: best.z } : null;
    }
    if (kind === "temple") {
      const rx = Math.floor(x / TEMPLE_REGION),
        rz = Math.floor(z / TEMPLE_REGION);
      let best: Temple | null = null;
      for (let ring = 0; ring <= 5 && !best; ring++)
        for (let dx = -ring; dx <= ring; dx++)
          for (let dz = -ring; dz <= ring; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
            const t = this.templeIn(rx + dx, rz + dz);
            if (
              t &&
              (!best ||
                Math.hypot(t.x - x, t.z - z) <
                  Math.hypot(best.x - x, best.z - z))
            )
              best = t;
          }
      return best ? { x: best.x, y: best.y, z: best.z } : null;
    }
    if (kind !== "citadel") return null;
    const c = nearestCitadel(this.citadels, x, z);
    return c ? { x: c.x, y: c.y, z: c.z } : null;
  }

  /** Сила гор в точке (0..1). */
  private mountains(x: number, z: number): number {
    return smoothstep(
      0.15,
      0.55,
      this.mtn.fbm(x * 0.0022 + 31, z * 0.0022 - 17, 3),
    );
  }

  /** y верхнего блока земли — чистая функция координат (чанки сходятся без швов). */
  heightAt(x: number, z: number): number {
    const c = this.cont.fbm(x * 0.0016, z * 0.0016, 4);
    const hills = this.hills.fbm(x * 0.009, z * 0.009, 4);
    const detail = this.detail.noise(x * 0.05, z * 0.05);
    let h: number;
    if (c < -0.18) {
      h = SEA - 3 - Math.min(30, (-c - 0.18) * 60) + hills * 3; // океан: дно 30..59
    } else {
      const land = smoothstep(-0.18, 0.04, c); // побережье плавно выходит из воды
      const r = 1 - Math.abs(this.ridge.fbm(x * 0.004, z * 0.004, 4));
      h =
        SEA -
        3 +
        land * (6 + hills * 9 + detail * 1.5) +
        land * this.mountains(x, z) * r * r * 58;
    }
    return clamp(Math.round(h), 4, SY - 10);
  }

  /** Биом колонны по высоте, температуре и влажности. */
  biomeAt(x: number, z: number, h: number): OverworldBiome {
    const t = this.temp.fbm(x * 0.0012, z * 0.0012, 3) * 1.6;
    if (h < SEA - 1) return t > 0.3 ? "warm_ocean" : "ocean"; // тёплый океан — коралловые рифы
    const w = this.hum.fbm(x * 0.0014 + 11, z * 0.0014 - 7, 3) * 1.6;
    if (h <= SEA + 1 && t > -0.3) return "beach";
    // грибные поля — редкими пятнами на невысокой суше
    if (
      h < SEA + 16 &&
      this.patch.noise(x * 0.0021 + 77, z * 0.0021 - 41) > 0.6
    )
      return "mushroom_fields";
    if (h > 92 && this.mountains(x, z) > 0.4) return "mountains";
    if (t < -0.3) return w > 0 ? "taiga" : "snowy";
    if (t > 0.3) {
      if (w < -0.1) return "desert";
      if (w > 0.25) return "jungle";
      return "savanna";
    }
    if (w > 0.3 && h < SEA + 6) return t > 0.15 ? "mangrove_swamp" : "swamp"; // тёплое болото — мангровое
    if (w > 0.18 && t > 0.05) return "dark_forest"; // тёплый и влажный лес
    // вишнёвые рощи — пятнами на умеренных холмах
    if (
      h > SEA + 14 &&
      w > -0.05 &&
      t > -0.12 &&
      t < 0.2 &&
      this.patch.noise(x * 0.004, z * 0.004) > 0.3
    )
      return "cherry_grove";
    if (w > 0.1) return t < 0 ? "birch_forest" : "forest";
    if (w > -0.05) return "forest";
    return "plains";
  }

  generate(chunk: Chunk): void {
    const rng = mulberry32(
      hashString(`ow-chunk:${this.seed}:${chunk.cx},${chunk.cz}`),
    );
    const wx0 = chunk.cx * SX,
      wz0 = chunk.cz * SZ;

    // высоты с каймой в блок — крутизна склона на краях чанка
    const G = SX + 2;
    const grid = new Int16Array(G * (SZ + 2));
    for (let z = -1; z <= SZ; z++)
      for (let x = -1; x <= SX; x++)
        grid[x + 1 + (z + 1) * G] = this.heightAt(wx0 + x, wz0 + z);

    const heights = new Int16Array(SX * SZ);
    const biomes: OverworldBiome[] = new Array<OverworldBiome>(SX * SZ);
    const water = packWater(8, true);

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
        const wx = wx0 + x,
          wz = wz0 + z;
        const biome = this.biomeAt(wx, wz, h);
        const def = BIOMES[biome];
        let surface = B[def.surface]!,
          under = B[def.under]!;
        if (biome === "ocean") {
          const n = this.patch.noise(wx * 0.08, wz * 0.08);
          surface = under =
            n > 0.35 ? B.gravel! : n < -0.45 ? B.clay! : B.sand!;
        } else if (h > 104)
          surface = B.snow!; // снежные шапки
        else if (slope >= 3 && surface === B.grass) {
          surface = B.stone!; // обрывы — голый камень
          under = B.stone!;
        } else if (biome === "mountains" && h > 96) surface = under = B.stone!;

        for (let y = 0; y <= h; y++) {
          let id: number;
          if (y === 0) id = B.bedrock!;
          else if (y < 4 && rng() < 0.6 - y * 0.15)
            id = B.bedrock!; // рваное дно
          else if (y === h) id = surface;
          else if (y >= h - 3) id = under;
          // глубинный сланец внизу, с рваной границей y 16..19 (как в Minecraft 1.18)
          else if (y < 16 || (y < 20 && rng() < (20 - y) / 5))
            id = B.deepslate!;
          else id = B.stone!;
          chunk.setRaw(x, y, z, id);
        }
        // снег-порох: пятнами в снегах и на снежных вершинах — сугроб в 2 блока вместо снега
        if (
          surface === B.snow &&
          (biome === "snowy" || biome === "mountains") &&
          this.patch.noise(wx * 0.09 + 50, wz * 0.09 - 30) > 0.45
        ) {
          chunk.setRaw(x, h, z, B.powder_snow!);
          chunk.setRaw(x, h - 1, z, B.powder_snow!);
        }
        for (let y = h + 1; y <= SEA; y++)
          chunk.setRaw(
            x,
            y,
            z,
            y === SEA && (biome === "snowy" || biome === "taiga")
              ? B.ice!
              : B.water!,
            y === SEA && (biome === "snowy" || biome === "taiga") ? 0 : water,
          );
        if (biome === "ocean" || biome === "warm_ocean")
          this.seabed(chunk, x, z, wx, wz, h, biome, water);
        const i = x + z * SX;
        heights[i] = h;
        biomes[i] = biome;
      }

    this.carveCaves(chunk, heights);
    this.ores(chunk, rng, biomes);
    this.geode(chunk, heights);
    this.lushCaves(chunk, heights);
    this.deepDark(chunk, heights);
    this.dripstoneCaves(chunk, heights);
    this.vegetation(chunk, rng, heights, biomes);
    this.citadel(chunk);
    const v = this.villageIn(
      Math.floor(wx0 / VILLAGE_REGION),
      Math.floor(wz0 / VILLAGE_REGION),
    );
    if (v) carveVillages(chunk, [v]);
    const t = this.templeIn(
      Math.floor(wx0 / TEMPLE_REGION),
      Math.floor(wz0 / TEMPLE_REGION),
    );
    if (t) carveVillages(chunk, [t]);
    const wr = this.wreckIn(
      Math.floor(wx0 / WRECK_REGION),
      Math.floor(wz0 / WRECK_REGION),
    );
    if (wr) carveVillages(chunk, [wr]);
    const ms = this.mineshaftIn(
      Math.floor(wx0 / MINESHAFT_REGION),
      Math.floor(wz0 / MINESHAFT_REGION),
    );
    if (ms) carveVillages(chunk, [ms]);
    const op = this.outpostIn(
      Math.floor(wx0 / OUTPOST_REGION),
      Math.floor(wz0 / OUTPOST_REGION),
    );
    if (op) carveVillages(chunk, [op]);
    const tr = this.treasureIn(
      Math.floor(wx0 / TREASURE_REGION),
      Math.floor(wz0 / TREASURE_REGION),
    );
    if (tr) carveVillages(chunk, [tr]);
    const ma = this.mansionIn(
      Math.floor(wx0 / MANSION_REGION),
      Math.floor(wz0 / MANSION_REGION),
    );
    if (ma) carveVillages(chunk, [ma]);
    const ac = this.ancientCityIn(
      Math.floor(wx0 / ANCIENT_REGION),
      Math.floor(wz0 / ANCIENT_REGION),
    );
    if (ac) carveVillages(chunk, [ac]);
    const wl = this.wellIn(
      Math.floor(wx0 / WELL_REGION),
      Math.floor(wz0 / WELL_REGION),
    );
    if (wl) carveVillages(chunk, [wl]);
    const ru = this.ruinsIn(
      Math.floor(wx0 / RUINS_REGION),
      Math.floor(wz0 / RUINS_REGION),
    );
    if (ru) carveVillages(chunk, [ru]);
    const tc = this.trialIn(
      Math.floor(wx0 / TRIAL_REGION),
      Math.floor(wz0 / TRIAL_REGION),
    );
    if (tc) carveVillages(chunk, [tc]);
    chunk.generated = true;
  }

  /** Древний город региона или null (worldgen/features/ancientCity) — только под глубокой тьмой. */
  ancientCityIn(rx: number, rz: number): AncientCity | null {
    const k = rx + "," + rz;
    if (!this.ancientCities.has(k))
      this.ancientCities.set(
        k,
        planAncientCity(this, this.seed, rx, rz, (x, z) => this.isDeep(x, z)),
      );
    return this.ancientCities.get(k)!;
  }

  /** Испытательные камеры региона или null (worldgen/features/trialChambers). */
  trialIn(rx: number, rz: number): TrialChamber | null {
    const k = rx + "," + rz;
    if (!this.trials.has(k))
      this.trials.set(k, planTrialChamber(this, this.seed, rx, rz));
    return this.trials.get(k)!;
  }

  /** Спавнеры испытаний ближе r к (x, z). */
  trialSpawnersNear(
    x: number,
    z: number,
    r: number,
  ): [number, number, number][] {
    const out: [number, number, number][] = [];
    const rx = Math.floor(x / TRIAL_REGION),
      rz = Math.floor(z / TRIAL_REGION);
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++)
        for (const s of this.trialIn(rx + dx, rz + dz)?.spawners ?? [])
          if (Math.hypot(s[0] - x, s[2] - z) < r) out.push(s);
    return out;
  }

  /** Пустынный колодец региона или null (worldgen/features/archaeology). */
  wellIn(rx: number, rz: number): Dig | null {
    const k = rx + "," + rz;
    if (!this.wells.has(k))
      this.wells.set(k, planWell(this, this.seed, rx, rz));
    return this.wells.get(k)!;
  }

  /** Засыпанные руины региона или null (worldgen/features/archaeology). */
  ruinsIn(rx: number, rz: number): Dig | null {
    const k = rx + "," + rz;
    if (!this.ruins.has(k))
      this.ruins.set(k, planRuins(this, this.seed, rx, rz));
    return this.ruins.get(k)!;
  }

  /** Глубокая тьма в колонне (и не пышные пещеры). */
  isDeep(x: number, z: number): boolean {
    return (
      this.deep.fbm(x * 0.006, z * 0.006, 2) > 0.25 &&
      this.lush.fbm(x * 0.008, z * 0.008, 2) < 0.3
    );
  }

  /** Особняк региона или null (worldgen/features/mansion). */
  mansionIn(rx: number, rz: number): Mansion | null {
    const k = rx + "," + rz;
    if (!this.mansions.has(k))
      this.mansions.set(k, planMansion(this, this.seed, rx, rz));
    return this.mansions.get(k)!;
  }

  /** Зарытый клад региона или null (worldgen/features/treasure). */
  treasureIn(rx: number, rz: number): Buried | null {
    const k = rx + "," + rz;
    if (!this.treasures.has(k))
      this.treasures.set(k, planTreasure(this, this.seed, rx, rz));
    return this.treasures.get(k)!;
  }

  /** Заброшенная шахта региона или null (worldgen/features/mineshaft). */
  mineshaftIn(rx: number, rz: number): Mineshaft | null {
    const k = rx + "," + rz;
    if (!this.mineshafts.has(k))
      this.mineshafts.set(k, planMineshaft(this, this.seed, rx, rz));
    return this.mineshafts.get(k)!;
  }

  /** Застава мародёров региона или null; рядом с деревней (ближе 100) заставы не бывает. */
  outpostIn(rx: number, rz: number): Outpost | null {
    const k = rx + "," + rz;
    if (!this.outposts.has(k)) {
      let o = planOutpost(this, this.seed, rx, rz);
      if (o) {
        const vx = Math.floor(o.x / VILLAGE_REGION),
          vz = Math.floor(o.z / VILLAGE_REGION);
        for (let dx = -1; dx <= 1 && o; dx++)
          for (let dz = -1; dz <= 1 && o; dz++) {
            const v = this.villageIn(vx + dx, vz + dz);
            if (v && Math.hypot(v.x - o.x, v.z - o.z) < 100) o = null;
          }
      }
      this.outposts.set(k, o);
    }
    return this.outposts.get(k)!;
  }

  /**
   * Дно океана: в тёплом — коралловые рифы пятнами (блоки одного цвета гнёздами 4×4, на них кораллы и
   * морские огурцы), в обычном — столбы ламинарии до поверхности; морская трава — в обоих.
   */
  private seabed(
    chunk: Chunk,
    x: number,
    z: number,
    wx: number,
    wz: number,
    h: number,
    biome: OverworldBiome,
    water: number,
  ): void {
    if (h >= SEA - 2) return;
    if (
      biome === "warm_ocean" &&
      h < SEA - 3 &&
      this.patch.noise(wx * 0.07, wz * 0.07) > 0.1
    ) {
      const c =
        CORALS[
          Math.floor(seaRoll(this.seed + 11, wx >> 2, wz >> 2) * CORALS.length)
        ]!;
      chunk.setRaw(x, h, z, B[`${c.id}_coral_block`]!);
      const r = seaRoll(this.seed + 13, wx, wz);
      if (r < 0.45) chunk.setRaw(x, h + 1, z, B[`${c.id}_coral`]!, water);
      else if (r < 0.5) chunk.setRaw(x, h + 1, z, B.sea_pickle!, water);
      return;
    }
    if (
      biome === "ocean" &&
      h < SEA - 5 &&
      seaRoll(this.seed + 7, wx, wz) < 0.06
    ) {
      const top = Math.min(
        SEA - 1,
        h + 2 + Math.floor(seaRoll(this.seed + 9, wx, wz) * (SEA - h - 2)),
      );
      for (let y = h + 1; y < top; y++)
        chunk.setRaw(x, y, z, B.kelp_plant!, water);
      chunk.setRaw(x, top, z, B.kelp!, water);
      return;
    }
    if (seaRoll(this.seed, wx, wz) < 0.15)
      chunk.setRaw(x, h + 1, z, B.seagrass!, water);
  }

  /** Затонувший корабль региона (rx, rz) или null (worldgen/features/shipwreck). */
  wreckIn(rx: number, rz: number): Wreck | null {
    const k = rx + "," + rz;
    if (!this.wrecks.has(k))
      this.wrecks.set(k, planWreck(this, this.seed, rx, rz));
    return this.wrecks.get(k)!;
  }

  /** Биом колонны (спавн по биомам). */
  biomeOf(x: number, z: number): string {
    return this.biomeAt(x, z, this.heightAt(x, z));
  }

  /** Добыча сундука затонувшего корабля или заставы мародёров. */
  lootAt(x: number, y: number, z: number): (ItemStack | null)[] | null {
    const k = `${x},${y},${z}`;
    const w = this.wreckIn(
      Math.floor(x / WRECK_REGION),
      Math.floor(z / WRECK_REGION),
    );
    const kind = w?.chests.get(k);
    if (kind) {
      const slots = wreckLoot(kind, this.seed, x, y, z);
      // сундук с картами — карта сокровищ к ближайшему зарытому кладу
      const t = kind === "map" ? this.locate("buried_treasure", x, z) : null;
      if (t)
        slots[13] = { item: "treasure_map", count: 1, tag: { x: t.x, z: t.z } };
      return slots;
    }
    const tr = this.treasureIn(
      Math.floor(x / TREASURE_REGION),
      Math.floor(z / TREASURE_REGION),
    );
    if (tr && tr.x === x && tr.y === y && tr.z === z)
      return treasureLoot(this.seed, x, y, z);
    const ma = this.mansionIn(
      Math.floor(x / MANSION_REGION),
      Math.floor(z / MANSION_REGION),
    );
    if (ma?.chests.has(k)) return mansionLoot(this.seed, x, y, z);
    const ac = this.ancientCityIn(
      Math.floor(x / ANCIENT_REGION),
      Math.floor(z / ANCIENT_REGION),
    );
    if (ac?.chests.has(k)) return ancientLoot(this.seed, x, y, z);
    // находки подозрительного песка и гравия (кисть — world/behaviours/archaeology)
    if (
      this.wellIn(
        Math.floor(x / WELL_REGION),
        Math.floor(z / WELL_REGION),
      )?.sus.has(k)
    )
      return archaeologyLoot("well", this.seed, x, y, z);
    if (
      this.ruinsIn(
        Math.floor(x / RUINS_REGION),
        Math.floor(z / RUINS_REGION),
      )?.sus.has(k)
    )
      return archaeologyLoot("ruins", this.seed, x, y, z);
    // хранилище испытательных камер (открывается ключом — world/behaviours/trial)
    if (
      this.trialIn(
        Math.floor(x / TRIAL_REGION),
        Math.floor(z / TRIAL_REGION),
      )?.vaults.has(k)
    )
      return vaultLootAt(this.seed, x, y, z);
    // сундук припасов заброшенной шахты
    if (
      this.mineshaftIn(
        Math.floor(x / MINESHAFT_REGION),
        Math.floor(z / MINESHAFT_REGION),
      )?.chests.has(k)
    )
      return mineshaftLoot(this.seed, x, y, z);
    const o = this.outpostIn(
      Math.floor(x / OUTPOST_REGION),
      Math.floor(z / OUTPOST_REGION),
    );
    return o?.chest === k ? outpostLoot(this.seed, x, y, z) : null;
  }

  /** Пещеры: «спагетти» (пересечение нулей двух шумов) и «сыр» (большие полости) ниже 50. */
  private carveCaves(chunk: Chunk, heights: Int16Array): void {
    const wx0 = chunk.cx * SX,
      wz0 = chunk.cz * SZ;
    const A = new Float32Array(GX * GY * GZ),
      Bf = new Float32Array(GX * GY * GZ),
      C = new Float32Array(GX * GY * GZ);
    const gi = (gx: number, gy: number, gz: number) =>
      gx + gz * GX + gy * GX * GZ;
    for (let gy = 0; gy < GY; gy++)
      for (let gz = 0; gz < GZ; gz++)
        for (let gx = 0; gx < GX; gx++) {
          const x = wx0 + gx * 4,
            y = gy * 8,
            z = wz0 + gz * 4;
          const k = gi(gx, gy, gz);
          A[k] = this.caveA.noise(x / 48, y / 32, z / 48);
          Bf[k] = this.caveB.noise(x / 48, y / 32, z / 48);
          C[k] = this.cheese.noise(x / 64, y / 40, z / 64);
        }
    const lerp = (f: Float32Array, x: number, y: number, z: number): number => {
      const gx = x >> 2,
        gy = y >> 3,
        gz = z >> 2;
      const fx = (x & 3) / 4,
        fy = (y & 7) / 8,
        fz = (z & 3) / 4;
      const c = (dx: number, dy: number, dz: number) =>
        f[gi(gx + dx, gy + dy, gz + dz)]!;
      const x00 = c(0, 0, 0) + (c(1, 0, 0) - c(0, 0, 0)) * fx;
      const x10 = c(0, 1, 0) + (c(1, 1, 0) - c(0, 1, 0)) * fx;
      const x01 = c(0, 0, 1) + (c(1, 0, 1) - c(0, 0, 1)) * fx;
      const x11 = c(0, 1, 1) + (c(1, 1, 1) - c(0, 1, 1)) * fx;
      const y0 = x00 + (x10 - x00) * fy,
        y1 = x01 + (x11 - x01) * fy;
      return y0 + (y1 - y0) * fz;
    };
    const lavaMeta = packWater(8, true);
    for (let z = 0; z < SZ; z++)
      for (let x = 0; x < SX; x++) {
        const h = heights[x + z * SX]!;
        // под водой и у берега пещеры держатся глубже: иначе море провалилось бы в них
        const ceil = h < SEA + 2 ? h - 8 : h - 1;
        for (let y = 4; y <= Math.min(ceil, SY - 9); y++) {
          const a = lerp(A, x, y, z),
            b = lerp(Bf, x, y, z);
          const tunnel = a * a + b * b < 0.0045;
          const cave = y < 50 && lerp(C, x, y, z) > 0.58;
          if (!tunnel && !cave) continue;
          const cur = chunk.blocks[idx(x, y, z)]!;
          if (cur === B.bedrock || cur === B.water) continue;
          if (y <= LAVA_LEVEL) chunk.setRaw(x, y, z, B.lava!, lavaMeta);
          else chunk.setRaw(x, y, z, B.air!);
        }
      }
  }

  /**
   * Аметистовая жеода (как в Minecraft — примерно в 1 чанке из 24): шар в толще камня y 12..48 —
   * снаружи гладкий базальт, под ним кальцит, внутри слой аметиста (8% — растущий) и пустота с почками
   * и друзами на стенках. Целиком внутри чанка — генерация чанков остаётся независимой. Свой поток
   * случайных чисел — прежние проходы не сдвигаются.
   */
  private geode(chunk: Chunk, heights: Int16Array): void {
    const rng = mulberry32(
      hashString(`ow-geode:${this.seed}:${chunk.cx},${chunk.cz}`),
    );
    if (rng() > 1 / 24) return;
    let low = SY;
    for (const h of heights) low = Math.min(low, h);
    const top = Math.min(48, low - 10);
    if (top < 14) return;
    const R = 3.5 + rng(); // радиус слоя аметиста
    const cx = 7 + Math.floor(rng() * 2),
      cz = 7 + Math.floor(rng() * 2),
      cy = 12 + Math.floor(rng() * (top - 12));
    const k = Math.ceil(R + 2);
    const budding: number[] = [];
    for (let dy = -k; dy <= k; dy++)
      for (let dz = -k; dz <= k; dz++)
        for (let dx = -k; dx <= k; dx++) {
          const x = cx + dx,
            y = cy + dy,
            z = cz + dz;
          if (x < 0 || x >= SX || z < 0 || z >= SZ || y < 1) continue;
          if (chunk.get(x, y, z) === B.bedrock) continue;
          const d =
            Math.sqrt(dx * dx + dy * dy * 1.2 + dz * dz) + (rng() - 0.5) * 0.3;
          if (d > R + 2) continue;
          let id: number;
          if (d <= R - 1) id = B.air!;
          else if (d <= R) {
            id = rng() < 0.08 ? B.budding_amethyst! : B.amethyst_block!;
            if (id === B.budding_amethyst) budding.push(x, y, z);
          } else if (d <= R + 1) id = B.calcite!;
          else id = B.smooth_basalt!;
          chunk.setRaw(x, y, z, id);
        }
    // почки и друзы на внутренних гранях растущего аметиста
    const buds = [
      B.small_amethyst_bud!,
      B.medium_amethyst_bud!,
      B.large_amethyst_bud!,
      B.amethyst_cluster!,
    ];
    for (let i = 0; i < budding.length; i += 3)
      for (const [dx, dy, dz] of FACES6) {
        const x = budding[i]! + dx,
          y = budding[i + 1]! + dy,
          z = budding[i + 2]! + dz;
        if (x < 0 || x >= SX || z < 0 || z >= SZ) continue;
        if (chunk.get(x, y, z) === B.air && rng() < 0.4)
          chunk.setRaw(x, y, z, buds[Math.floor(rng() * 4)]!);
      }
  }

  /**
   * Пышные пещеры: под пятнами шума lush (под сушей) пол пещер зарастает мхом с коврами, азалиями и
   * травой, в полу — озерца с глиной на дне (там живут аксолотли), с потолка свисают пещерные лозы
   * (11% — с ягодами, они светятся) и спороцвет, часть потолка — тоже мох.
   */
  private lushCaves(chunk: Chunk, heights: Int16Array): void {
    const wx0 = chunk.cx * SX,
      wz0 = chunk.cz * SZ;
    const rng = mulberry32(
      hashString(`ow-lush:${this.seed}:${chunk.cx},${chunk.cz}`),
    );
    const rock = (id: number): boolean =>
      id === B.stone ||
      id === B.deepslate ||
      id === B.dirt ||
      id === B.gravel ||
      id === B.moss_block ||
      id === B.clay;
    const water = packWater(8, true);
    for (let z = 0; z < SZ; z++)
      for (let x = 0; x < SX; x++) {
        if (this.lush.fbm((wx0 + x) * 0.008, (wz0 + z) * 0.008, 2) < 0.3)
          continue;
        const h = heights[x + z * SX]!;
        if (h < SEA + 2) continue; // не под морем
        for (let y = LAVA_LEVEL + 3; y < h - 6; y++) {
          if (chunk.get(x, y, z) !== B.air) continue;
          if (rock(chunk.get(x, y - 1, z))) {
            // озерцо: клетка пола, со всех сторон и снизу — камень
            const inside = x > 0 && x < SX - 1 && z > 0 && z < SZ - 1;
            const sealed =
              inside &&
              rock(chunk.get(x, y - 2, z)) &&
              FACES6.every(([dx, dy, dz]) => {
                if (dy !== 0) return true;
                const n = chunk.get(x + dx, y - 1, z + dz);
                return rock(n) || n === B.water;
              });
            if (sealed && rng() < 0.18) {
              chunk.setRaw(x, y - 1, z, B.water!, water);
              chunk.setRaw(x, y - 2, z, B.clay!);
              continue;
            }
            chunk.setRaw(x, y - 1, z, B.moss_block!);
            const r = rng();
            if (r < 0.25) chunk.setRaw(x, y, z, B.moss_carpet!);
            else if (r < 0.3) chunk.setRaw(x, y, z, B.azalea!);
            else if (r < 0.33) chunk.setRaw(x, y, z, B.flowering_azalea!);
            else if (r < 0.45) chunk.setRaw(x, y, z, B.tallgrass!);
          }
          if (chunk.get(x, y, z) === B.air && rock(chunk.get(x, y + 1, z))) {
            const r = rng();
            if (r < 0.12) {
              const n = 1 + Math.floor(rng() * 4);
              for (
                let i = 0;
                i < n &&
                chunk.get(x, y - i, z) === B.air &&
                chunk.get(x, y - i - 1, z) === B.air;
                i++
              )
                chunk.setRaw(
                  x,
                  y - i,
                  z,
                  rng() < 0.11 ? B.cave_vines_lit! : B.cave_vines!,
                );
            } else if (r < 0.125) chunk.setRaw(x, y, z, B.spore_blossom!);
            else if (r < 0.4) chunk.setRaw(x, y + 1, z, B.moss_block!);
          }
        }
      }
  }

  /**
   * Капельниковые пещеры: где шум drip (и не пышные пещеры, не глубокая тьма) — пол и свод пещер
   * местами из капельникового блока, со свода свисают сталактиты до 4 блоков, с пола растут сталагмиты
   * до 3. Свой поток случайных чисел — прежние проходы не сдвигаются.
   */
  private dripstoneCaves(chunk: Chunk, heights: Int16Array): void {
    const wx0 = chunk.cx * SX,
      wz0 = chunk.cz * SZ;
    const rng = mulberry32(
      hashString(`ow-drip:${this.seed}:${chunk.cx},${chunk.cz}`),
    );
    const rock = (id: number): boolean =>
      id === B.stone ||
      id === B.deepslate ||
      id === B.gravel ||
      id === B.dripstone_block;
    for (let z = 0; z < SZ; z++)
      for (let x = 0; x < SX; x++) {
        const wx = wx0 + x,
          wz = wz0 + z;
        if (
          this.drip.fbm(wx * 0.007, wz * 0.007, 2) < 0.3 ||
          this.isDeep(wx, wz)
        )
          continue;
        if (this.lush.fbm(wx * 0.008, wz * 0.008, 2) >= 0.3) continue;
        const h = heights[x + z * SX]!;
        for (let y = LAVA_LEVEL + 2; y < h - 8; y++) {
          if (chunk.get(x, y, z) !== B.air) continue;
          if (rock(chunk.get(x, y - 1, z)) && rng() < 0.6) {
            chunk.setRaw(x, y - 1, z, B.dripstone_block!);
            if (rng() < 0.08) {
              const n = 1 + Math.floor(rng() * 3);
              for (
                let i = 0;
                i < n &&
                chunk.get(x, y + i, z) === B.air &&
                chunk.get(x, y + i + 1, z) === B.air;
                i++
              )
                chunk.setRaw(x, y + i, z, B.pointed_dripstone!);
            }
          }
          if (
            chunk.get(x, y, z) === B.air &&
            rock(chunk.get(x, y + 1, z)) &&
            rng() < 0.6
          ) {
            chunk.setRaw(x, y + 1, z, B.dripstone_block!);
            if (rng() < 0.12) {
              const n = 1 + Math.floor(rng() * 4);
              for (
                let i = 0;
                i < n &&
                chunk.get(x, y - i, z) === B.air &&
                chunk.get(x, y - i - 1, z) === B.air;
                i++
              )
                chunk.setRaw(x, y - i, z, B.pointed_dripstone_down!);
            }
          }
        }
      }
  }

  /**
   * Глубокая тьма: где шум deep (и не пышные пещеры) — пещеры ниже y 34 обрастают скалком: пол и часть
   * свода, прожилки, сенсоры, крикуны (умеют будить Стража) и изредка катализатор. Свой поток
   * случайных чисел — прежние проходы не сдвигаются.
   */
  private deepDark(chunk: Chunk, heights: Int16Array): void {
    const wx0 = chunk.cx * SX,
      wz0 = chunk.cz * SZ;
    const rng = mulberry32(
      hashString(`ow-deep:${this.seed}:${chunk.cx},${chunk.cz}`),
    );
    const rock = (id: number): boolean =>
      id === B.stone ||
      id === B.deepslate ||
      id === B.gravel ||
      id === B.dirt ||
      id === B.sculk;
    for (let z = 0; z < SZ; z++)
      for (let x = 0; x < SX; x++) {
        if (!this.isDeep(wx0 + x, wz0 + z)) continue;
        const top = Math.min(34, heights[x + z * SX]! - 12);
        for (let y = LAVA_LEVEL + 1; y <= top; y++) {
          if (chunk.get(x, y, z) !== B.air) continue;
          if (rock(chunk.get(x, y - 1, z))) {
            const r = rng();
            if (r < 0.75)
              chunk.setRaw(
                x,
                y - 1,
                z,
                r < 0.004 ? B.sculk_catalyst! : B.sculk!,
              );
            const o = rng();
            if (o < 0.02) chunk.setRaw(x, y, z, B.sculk_sensor!);
            else if (o < 0.026)
              chunk.setRaw(x, y, z, B.sculk_shrieker!, CAN_SUMMON);
            else if (o < 0.16) chunk.setRaw(x, y, z, B.sculk_vein!);
          }
          if (
            chunk.get(x, y, z) === B.air &&
            rock(chunk.get(x, y + 1, z)) &&
            rng() < 0.35
          )
            chunk.setRaw(x, y + 1, z, B.sculk!);
        }
      }
  }

  /** Жилы руд по глубине — только по камню и сланцу и внутри чанка. */
  private ores(
    chunk: Chunk,
    rng: () => number,
    biomes: OverworldBiome[],
  ): void {
    const rock = (id: number) => id === B.stone || id === B.deepslate;
    for (const [name, veins, size, minY, maxY] of ORES) {
      const id = B[name];
      if (id === undefined) continue;
      for (let v = 0; v < veins; v++) {
        let x = (rng() * SX) | 0,
          y = (minY + rng() * (maxY - minY)) | 0,
          z = (rng() * SZ) | 0;
        for (let i = 0; i < size; i++) {
          if (
            x >= 0 &&
            x < SX &&
            y >= 1 &&
            y < SY &&
            z >= 0 &&
            z < SZ &&
            rock(chunk.get(x, y, z))
          )
            chunk.setRaw(x, y, z, id);
          x += ((rng() * 3) | 0) - 1;
          y += ((rng() * 3) | 0) - 1;
          z += ((rng() * 3) | 0) - 1;
        }
      }
    }
    // изумруды — одиночными блоками и только в горах, как в Minecraft
    const emerald = B.emerald_ore;
    if (emerald !== undefined && biomes.includes("mountains"))
      for (let k = 0; k < 3; k++) {
        const x = (rng() * SX) | 0,
          y = (60 + rng() * 50) | 0,
          z = (rng() * SZ) | 0;
        if (chunk.get(x, y, z) === B.stone) chunk.setRaw(x, y, z, emerald);
      }
  }

  private vegetation(
    chunk: Chunk,
    rng: () => number,
    heights: Int16Array,
    biomes: OverworldBiome[],
  ): void {
    const m = TREE_MAX_RADIUS; // крона не выходит за чанк — генерация чанков независима
    for (let t = 0; t < 10; t++) {
      const x = m + ((rng() * (SX - 2 * m)) | 0),
        z = m + ((rng() * (SZ - 2 * m)) | 0);
      const i = x + z * SX;
      const def = BIOMES[biomes[i]!];
      const h = heights[i]!;
      if (rng() > def.trees * 0.6 || def.tree === "none") continue;
      // мангр растёт и на мелководье: на грязи под водой до 3 блоков
      const mangrove = def.tree === "mangrove";
      if ((mangrove ? h < SEA - 3 : h <= SEA) || h + TREE_MAX_HEIGHT >= SY)
        continue;
      const ground = chunk.get(x, h, z);
      if (
        mangrove
          ? ground !== B.mud
          : def.tree === "dead"
            ? ground !== B.sand
            : ground !== B.grass && ground !== B.snow
      )
        continue;
      const above = chunk.get(x, h + 1, z);
      if (above !== B.air && !(mangrove && above === B.water)) continue;
      // в лесу каждое пятое дерево — тёмный дуб
      const kind =
        biomes[i] === "forest" && rng() < 0.2 ? "dark_oak" : def.tree;
      if (kind === "cherry" && (x < 3 || x > SX - 4 || z < 3 || z > SZ - 4))
        continue; // крона вишни шире
      growTree(kind, x, h, z, rng, (tx, ty, tz, id, soft) => {
        if (ty >= SY || tx < 0 || tx >= SX || tz < 0 || tz >= SZ) return;
        if (soft && chunk.get(tx, ty, tz) !== B.air) return;
        chunk.setRaw(tx, ty, tz, id);
      });
      // пчелиное гнездо на стволе у 5% дубов и берёз равнин и лесов (пчёл заведёт первый тик)
      const b = biomes[i];
      if (
        (kind === "oak" || kind === "birch") &&
        (b === "plains" || b === "forest" || b === "birch_forest") &&
        rng() < 0.05
      )
        if (z + 1 < SZ && h + 3 < SY)
          chunk.setRaw(x, h + 3, z + 1, B.bee_nest!, HIVE_SEEDED);
    }
    for (let z = 0; z < SZ; z++)
      for (let x = 0; x < SX; x++) {
        const i = x + z * SX;
        const h = heights[i]!,
          def = BIOMES[biomes[i]!];
        if (h <= SEA || h + 1 >= SY) continue;
        if (chunk.get(x, h, z) !== B.grass || chunk.get(x, h + 1, z) !== B.air)
          continue;
        const r = rng();
        const g = def.grass * 0.25;
        if (r < g) chunk.setRaw(x, h + 1, z, B.tallgrass!);
        else if (r < g + def.flowers * 0.2)
          chunk.setRaw(
            x,
            h + 1,
            z,
            rng() < 0.5 ? B.flower_yellow! : B.flower_red!,
          );
        else if (biomes[i] === "cherry_grove" && r < g + 0.2)
          chunk.setRaw(x, h + 1, z, B.pink_petals!);
      }
    this.extras(chunk, heights, biomes);
  }

  /**
   * Тростник у воды, кактусы в пустыне, тыквы на равнинах и в лесу, арбузы в джунглях. Свой поток
   * случайных чисел — прежние проходы генерации не сдвигаются.
   */
  private extras(
    chunk: Chunk,
    heights: Int16Array,
    biomes: OverworldBiome[],
  ): void {
    const rng = mulberry32(
      hashString(`ow-extra:${this.seed}:${chunk.cx},${chunk.cz}`),
    );
    const at = (x: number, z: number) => heights[x + z * SX]!;
    const column = (x: number, y: number, z: number, id: number) => {
      const n = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < n && y + k < SY; k++) chunk.setRaw(x, y + k, z, id);
    };
    for (let t = 0; t < 20; t++) {
      const x = 1 + Math.floor(rng() * (SX - 2)),
        z = 1 + Math.floor(rng() * (SZ - 2));
      const h = at(x, z),
        ground = chunk.get(x, h, z);
      if (chunk.get(x, h + 1, z) !== B.air) continue;
      const biome = biomes[x + z * SX]!;
      const water = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dz]) => chunk.get(x + dx!, h, z + dz!) === B.water);
      if (
        water &&
        (ground === B.grass || ground === B.sand || ground === B.dirt)
      ) {
        column(x, h + 1, z, B.sugar_cane!);
      } else if (biome === "desert" && ground === B.sand && t % 4 === 0) {
        const free = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].every(([dx, dz]) => chunk.get(x + dx!, h + 1, z + dz!) === B.air);
        if (free) column(x, h + 1, z, B.cactus!);
      }
    }
    // тыквы и арбузы — редкими грядками
    const patchBiome = biomes[8 + 8 * SX]!;
    const fruit =
      patchBiome === "jungle" && rng() < 0.3
        ? B.melon!
        : (patchBiome === "plains" || patchBiome === "forest") && rng() < 0.04
          ? B.pumpkin!
          : undefined;
    if (fruit !== undefined)
      for (let k = 0; k < 6; k++) {
        const x = 2 + Math.floor(rng() * (SX - 4)),
          z = 2 + Math.floor(rng() * (SZ - 4));
        const h = at(x, z);
        if (chunk.get(x, h, z) === B.grass && chunk.get(x, h + 1, z) === B.air)
          chunk.setRaw(x, h + 1, z, fruit);
      }
    // грибные поля: огромные грибы (шляпка целиком в чанке); там же, в тёмных лесах, болотах и тайге —
    // россыпь маленьких грибов
    const R = HUGE_MUSHROOM_RADIUS;
    for (let t = 0; t < 6; t++) {
      const x = R + Math.floor(rng() * (SX - 2 * R)),
        z = R + Math.floor(rng() * (SZ - 2 * R));
      const b = biomes[x + z * SX]!,
        h = at(x, z),
        ground = chunk.get(x, h, z);
      if (chunk.get(x, h + 1, z) !== B.air || h <= SEA) continue;
      if (
        b === "mushroom_fields" &&
        ground === B.mycelium &&
        t < 3 &&
        h + HUGE_MUSHROOM_HEIGHT < SY
      ) {
        growHugeMushroom(
          (tx, ty, tz, id, soft) => {
            if (!soft || chunk.get(tx, ty, tz) === B.air)
              chunk.setRaw(tx, ty, tz, id);
          },
          x,
          h + 1,
          z,
          rng() < 0.5,
          rng,
        );
      } else if (
        (b === "mushroom_fields" ||
          b === "dark_forest" ||
          b === "swamp" ||
          b === "taiga") &&
        (ground === B.grass || ground === B.mycelium) &&
        rng() < 0.4
      )
        chunk.setRaw(
          x,
          h + 1,
          z,
          rng() < 0.5 ? B.brown_mushroom! : B.red_mushroom!,
        );
    }
    // заросли бамбука — в каждом третьем чанке джунглей, стебли 4–11 блоков
    if (biomes[8 + 8 * SX] === "jungle" && rng() < 0.35)
      for (let k = 0; k < 12; k++) {
        const x = 1 + Math.floor(rng() * (SX - 2)),
          z = 1 + Math.floor(rng() * (SZ - 2));
        const h = at(x, z);
        if (chunk.get(x, h, z) !== B.grass || chunk.get(x, h + 1, z) !== B.air)
          continue;
        const n = 4 + Math.floor(rng() * 8);
        for (
          let s = 1;
          s <= n && h + s < SY && chunk.get(x, h + s, z) === B.air;
          s++
        )
          chunk.setRaw(x, h + s, z, B.bamboo!);
      }
    // какао на стволах джунглей (2–5 блоков над землёй): стручки разного возраста, к стволу лицом
    for (let t = 0; t < 16; t++) {
      const x = 1 + Math.floor(rng() * (SX - 2)),
        z = 1 + Math.floor(rng() * (SZ - 2));
      if (biomes[x + z * SX] !== "jungle") continue;
      const h = at(x, z);
      for (let k = 2; k <= 5; k++) {
        const y = h + k;
        if (y >= SY || chunk.get(x, y, z) !== B.jungle_log) break;
        if (rng() > 0.3) continue;
        const f = Math.floor(rng() * 4);
        const [dx, dz] = FACING_DIRS[f]!;
        const cx = x - dx,
          cz = z - dz; // ствол — со стороны f от стручка
        if (
          cx < 0 ||
          cx >= SX ||
          cz < 0 ||
          cz >= SZ ||
          chunk.get(cx, y, cz) !== B.air
        )
          continue;
        chunk.setRaw(cx, y, cz, B.cocoa!, f | (Math.floor(rng() * 3) << 2));
      }
    }
  }

  /** Суша ближе всего к началу координат (не океан и не пляж). */
  spawnHint(): { x: number; z: number } {
    if (this.spawn) return this.spawn;
    for (let r = 0; r <= 1024; r += 8) {
      const steps = r === 0 ? 1 : Math.ceil((2 * Math.PI * r) / 8);
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2;
        const x = Math.round(Math.cos(a) * r),
          z = Math.round(Math.sin(a) * r);
        const h = this.heightAt(x, z);
        const b = this.biomeAt(x, z, h);
        if (h > SEA + 1 && !b.endsWith("ocean") && b !== "beach" && h < 90)
          return (this.spawn = { x, z });
      }
    }
    return (this.spawn = { x: 0, z: 0 });
  }
}
