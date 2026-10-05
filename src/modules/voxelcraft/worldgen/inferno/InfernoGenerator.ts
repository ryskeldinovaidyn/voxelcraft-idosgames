// Пекло (сейв v3): пещерный мир 0..127 — бедрок снизу и сверху, адский камень из 3D-шума (у пола
// и свода гуще, посередине — большие залы), лавовое море до y = 31, песок душ и гравий у берегов,
// светокамень гроздьями под сводами, кварцевая руда, магма у моря и вечный огонь на полу.
// У каждого мира своё Пекло — шум от сида мира.
//
// ⚠ Вывод генератора станет частью формата сейва после релиза (как у OverworldGenerator).
import { Simplex2, Simplex3, hashString, mulberry32 } from "../../core/Noise";
import {
  BASTION_REGION,
  BASTION_Y,
  type Bastion,
  bastionBlockAt,
  bastionLoot,
  inBastion,
  planBastion,
} from "../features/bastion";
import type { ItemStack } from "../../types";
import { B, packWater } from "../../registry/Blocks";
import { CHUNK_SIZE, idx, type Chunk } from "../../world/Chunk";
import type { WorldGenerator } from "../WorldGenerator";
import {
  HUGE_FUNGUS_HEIGHT,
  HUGE_FUNGUS_RADIUS,
  growHugeFungus,
} from "../fungus";

/** Биомы Пекла: пустоши (прежнее Пекло), багровый и искажённый леса, долина душ, базальтовые дельты. */
export type InfernoBiome =
  | "wastes"
  | "crimson_forest"
  | "warped_forest"
  | "soul_valley"
  | "basalt_deltas";

const { SX, SY, SZ } = CHUNK_SIZE;
/** Уровень лавового моря. */
export const LAVA_SEA = 31;
/** Пол коридоров адской крепости. */
export const FORT_Y = 64;
/** Одна крепость на область REGION×REGION; постройка целиком внутри области (≤ 60 от центра). */
const REGION = 256;

/** Коробка части крепости: оболочка — кирпич, внутри — пусто. */
interface FortBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

interface Fortress {
  ox: number;
  oz: number;
  parts: FortBox[];
}

// решётка плотности: шаг 4 по x/z и 8 по y, внутри — трилинейная интерполяция
const GX = SX / 4 + 1,
  GY = SY / 8 + 1,
  GZ = SZ / 4 + 1;

const clamp = (v: number, a: number, b: number): number =>
  Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export class InfernoGenerator implements WorldGenerator {
  readonly seed: number;
  readonly waterLevel = LAVA_SEA;
  private readonly cave: Simplex3;
  private readonly detail: Simplex3;
  private readonly patch: Simplex2;
  private readonly forts = new Map<string, Fortress>();
  private readonly bastions = new Map<string, Bastion>();
  /** Шумы биомов — свои сиды, прежние шумы не сдвигаются. */
  private readonly heat: Simplex2;
  private readonly kind: Simplex2;

  constructor(seed: number) {
    this.seed = seed;
    this.cave = new Simplex3(hashString(`inf:cave:${seed}`));
    this.detail = new Simplex3(hashString(`inf:detail:${seed}`));
    this.patch = new Simplex2(hashString(`inf:patch:${seed}`));
    this.heat = new Simplex2(hashString(`inf:biome-heat:${seed}`));
    this.kind = new Simplex2(hashString(`inf:biome-kind:${seed}`));
  }

  /** Биом колонны: леса и долина душ — пятнами по 100–200 блоков, между ними пустоши. */
  biomeAt(x: number, z: number): InfernoBiome {
    const t = this.heat.fbm(x * 0.004, z * 0.004, 3);
    if (t > 0.22)
      return this.kind.fbm(x * 0.003 + 19, z * 0.003 - 7, 2) > 0
        ? "warped_forest"
        : "crimson_forest";
    if (t < -0.28) return "soul_valley";
    // базальтовые дельты — пятнами внутри пустошей
    if (this.kind.fbm(x * 0.005 - 51, z * 0.005 + 33, 2) > 0.3)
      return "basalt_deltas";
    return "wastes";
  }

  /** Для спавна по биомам (MobSpawn.biomes). */
  biomeOf(x: number, z: number): string {
    return this.biomeAt(Math.floor(x), Math.floor(z));
  }

  /** Плотность породы в точке: > 0 — камень. */
  private density(x: number, y: number, z: number): number {
    const n =
      this.cave.noise(x * 0.012, y * 0.024, z * 0.012) +
      0.5 * this.detail.noise(x * 0.04, y * 0.06, z * 0.04);
    const floor = Math.max(0, (28 - y) / 28);
    const roof = Math.max(0, (y - 96) / 28);
    return n + floor * 1.6 + roof * 1.6 - 0.15;
  }

  generate(chunk: Chunk): void {
    const wx0 = chunk.cx * SX,
      wz0 = chunk.cz * SZ;
    const rng = mulberry32(
      hashString(`inf-chunk:${this.seed}:${chunk.cx},${chunk.cz}`),
    );
    const grid = new Float32Array(GX * GY * GZ);
    for (let gx = 0; gx < GX; gx++)
      for (let gy = 0; gy < GY; gy++)
        for (let gz = 0; gz < GZ; gz++)
          grid[(gx * GY + gy) * GZ + gz] = this.density(
            wx0 + gx * 4,
            gy * 8,
            wz0 + gz * 4,
          );
    const at = (gx: number, gy: number, gz: number): number =>
      grid[(gx * GY + gy) * GZ + gz]!;
    const lava = packWater(8, true);

    for (let x = 0; x < SX; x++)
      for (let z = 0; z < SZ; z++) {
        const gx = x >> 2,
          fx = (x & 3) / 4,
          gz = z >> 2,
          fz = (z & 3) / 4;
        for (let y = 0; y < SY; y++) {
          const gy = y >> 3,
            fy = (y & 7) / 8;
          const d = lerp(
            lerp(
              lerp(at(gx, gy, gz), at(gx + 1, gy, gz), fx),
              lerp(at(gx, gy, gz + 1), at(gx + 1, gy, gz + 1), fx),
              fz,
            ),
            lerp(
              lerp(at(gx, gy + 1, gz), at(gx + 1, gy + 1, gz), fx),
              lerp(at(gx, gy + 1, gz + 1), at(gx + 1, gy + 1, gz + 1), fx),
              fz,
            ),
            fy,
          );
          const bedrock =
            y === 0 ||
            y === SY - 1 ||
            (y < 4 && rng() < (4 - y) / 5) ||
            (y > SY - 5 && rng() < (y - (SY - 5)) / 5);
          if (bedrock) chunk.setRaw(x, y, z, B.bedrock!);
          else if (d > 0) chunk.setRaw(x, y, z, B.infernal_stone!);
          else if (y <= LAVA_SEA) chunk.setRaw(x, y, z, B.lava!, lava);
        }
      }
    this.decorate(chunk, rng);
    this.biomes(chunk);
    this.fortress(chunk);
    this.bastion(chunk);
    chunk.generated = true;
  }

  /**
   * Крепость области (rx, rz): коридоры-трубы вдоль x и z крестом, центральный зал, зал Пламени
   * на восточном конце и два отростка. Чистая функция сида и области — чанки сходятся без швов.
   */
  private fortressFor(rx: number, rz: number): Fortress {
    const key = rx + "," + rz;
    const cached = this.forts.get(key);
    if (cached) return cached;
    const r = mulberry32(hashString(`inf-fort:${this.seed}:${key}`));
    const ox = rx * REGION + 64 + Math.floor(r() * 128),
      oz = rz * REGION + 64 + Math.floor(r() * 128);
    const L = 36 + Math.floor(r() * 16);
    const tube = (
      x0: number,
      x1: number,
      z0: number,
      z1: number,
      h = 5,
    ): FortBox => ({
      x0,
      x1,
      z0,
      z1,
      y0: FORT_Y,
      y1: FORT_Y + h,
    });
    const f: Fortress = {
      ox,
      oz,
      parts: [
        tube(ox - L, ox + L, oz - 2, oz + 2), // главный коридор вдоль x
        tube(ox - 2, ox + 2, oz - L, oz + L), // поперечный вдоль z
        tube(ox - 7, ox + 7, oz - 7, oz + 7, 8), // центральный зал
        tube(ox + L - 8, ox + L + 8, oz - 8, oz + 8, 7), // зал Пламени
        tube(ox - L, ox - L + 4, oz + 2, oz + 30), // отросток с запада на юг
        tube(ox + 2, ox + 30, oz - L, oz - L + 4), // отросток с севера на восток
      ],
    };
    this.forts.set(key, f);
    return f;
  }

  private fortress(chunk: Chunk): void {
    const wx0 = chunk.cx * SX,
      wz0 = chunk.cz * SZ;
    const f = this.fortressFor(
      Math.floor(wx0 / REGION),
      Math.floor(wz0 / REGION),
    );
    const parts = f.parts.filter(
      (b) => b.x1 >= wx0 && b.x0 < wx0 + SX && b.z1 >= wz0 && b.z0 < wz0 + SZ,
    );
    if (!parts.length) return;
    const set = (x: number, y: number, z: number, id: number) =>
      chunk.setRaw(x - wx0, y, z - wz0, id);
    const each = (
      b: FortBox,
      pad: number,
      fn: (x: number, z: number) => void,
    ) => {
      for (
        let x = Math.max(b.x0 + pad, wx0);
        x <= Math.min(b.x1 - pad, wx0 + SX - 1);
        x++
      )
        for (
          let z = Math.max(b.z0 + pad, wz0);
          z <= Math.min(b.z1 - pad, wz0 + SZ - 1);
          z++
        )
          fn(x, z);
    };
    // 1) оболочки: пол, свод, стены с окнами-заборами
    for (const b of parts)
      each(b, 0, (x, z) => {
        const edgeX = x === b.x0 || x === b.x1,
          edgeZ = z === b.z0 || z === b.z1;
        for (let y = b.y0; y <= b.y1; y++) {
          if (y !== b.y0 && y !== b.y1 && !edgeX && !edgeZ) continue;
          const window =
            edgeX !== edgeZ && y === b.y0 + 2 && (edgeX ? z : x) % 3 === 0;
          set(x, y, z, window ? B.inferno_brick_fence! : B.inferno_bricks!);
        }
      });
    // 2) пустота внутри — перекрёстки коридоров открываются
    for (const b of parts)
      each(b, 1, (x, z) => {
        for (let y = b.y0 + 1; y < b.y1; y++) set(x, y, z, B.air!);
      });
    // грядка адского нароста в центральном зале — на песке душ, как в крепостях Minecraft
    for (let x = f.ox - 5; x <= f.ox - 3; x++)
      for (let z = f.oz + 3; z <= f.oz + 5; z++) {
        if (x < wx0 || x >= wx0 + SX || z < wz0 || z >= wz0 + SZ) continue;
        set(x, FORT_Y, z, B.soul_sand!);
        chunk.setRaw(
          x - wx0,
          FORT_Y + 1,
          z - wz0,
          B.inferno_wart!,
          (x * 7 + z * 13) & 7,
        );
      }
    // 3) опоры: столбы каждые 8 блоков — вниз до камня (сквозь пустоту и лаву)
    for (const b of parts)
      each(b, 0, (x, z) => {
        if (
          (((x - f.ox) % 8) + 8) % 8 !== 0 ||
          (((z - f.oz) % 8) + 8) % 8 !== 0
        )
          return;
        for (let y = b.y0 - 1; y > 0; y--) {
          const id = chunk.blocks[idx(x - wx0, y, z - wz0)]!;
          if (id !== 0 && id !== B.lava) break;
          set(x, y, z, B.inferno_bricks!);
        }
      });
  }

  /** Бастион области (worldgen/features/bastion) — один на BASTION_REGION. */
  private bastionFor(rx: number, rz: number): Bastion {
    const key = rx + "," + rz;
    let b = this.bastions.get(key);
    if (!b) this.bastions.set(key, (b = planBastion(this.seed, rx, rz)));
    return b;
  }

  /** Блоки бастиона в этом чанке. */
  private bastion(chunk: Chunk): void {
    const wx0 = chunk.cx * SX,
      wz0 = chunk.cz * SZ;
    const b = this.bastionFor(
      Math.floor(wx0 / BASTION_REGION),
      Math.floor(wz0 / BASTION_REGION),
    );
    if (
      Math.abs(b.ox - (wx0 + SX / 2)) > 40 ||
      Math.abs(b.oz - (wz0 + SZ / 2)) > 40
    )
      return;
    for (let x = wx0; x < wx0 + SX; x++)
      for (let z = wz0; z < wz0 + SZ; z++)
        for (let y = BASTION_Y - 6; y <= BASTION_Y + 12; y++) {
          const id = bastionBlockAt(b, x, y, z);
          if (id !== null) chunk.setRaw(x - wx0, y, z - wz0, id);
        }
  }

  /** Добыча сундука бастиона (у крепости сундуков нет). */
  lootAt(x: number, y: number, z: number): (ItemStack | null)[] | null {
    const b = this.bastionFor(
      Math.floor(x / BASTION_REGION),
      Math.floor(z / BASTION_REGION),
    );
    return b.chests.has(`${x},${y},${z}`)
      ? bastionLoot(this.seed, x, y, z)
      : null;
  }

  structureAt(x: number, y: number, z: number): string | null {
    const b = this.bastionFor(
      Math.floor(x / BASTION_REGION),
      Math.floor(z / BASTION_REGION),
    );
    if (inBastion(b, x, y, z)) return "bastion";
    const f = this.fortressFor(Math.floor(x / REGION), Math.floor(z / REGION));
    for (const b of f.parts)
      if (
        x >= b.x0 &&
        x <= b.x1 &&
        y >= b.y0 &&
        y <= b.y1 &&
        z >= b.z0 &&
        z <= b.z1
      )
        return "fortress";
    return null;
  }

  locate(
    kind: string,
    x: number,
    z: number,
  ): { x: number; y: number; z: number } | null {
    if (kind !== "fortress") return null;
    const rx = Math.floor(x / REGION),
      rz = Math.floor(z / REGION);
    let best: Fortress | null = null;
    let bestD = Infinity;
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        const f = this.fortressFor(rx + dx, rz + dz);
        const d = (f.ox - x) ** 2 + (f.oz - z) ** 2;
        if (d < bestD) {
          best = f;
          bestD = d;
        }
      }
    return best ? { x: best.ox, y: FORT_Y + 1, z: best.oz } : null;
  }

  private decorate(chunk: Chunk, rng: () => number): void {
    const wx0 = chunk.cx * SX,
      wz0 = chunk.cz * SZ;
    const get = (x: number, y: number, z: number): number =>
      chunk.blocks[idx(x, y, z)]!;

    // песок душ и гравий — пятнами по берегам лавового моря
    for (let x = 0; x < SX; x++)
      for (let z = 0; z < SZ; z++) {
        const p = this.patch.noise((wx0 + x) * 0.06, (wz0 + z) * 0.06);
        if (Math.abs(p) < 0.25) continue;
        const fill = p > 0 ? B.soul_sand! : B.gravel!;
        for (let y = LAVA_SEA - 2; y <= LAVA_SEA + 6; y++)
          if (get(x, y, z) === B.infernal_stone && get(x, y + 1, z) === 0) {
            chunk.setRaw(x, y, z, fill);
            if (get(x, y - 1, z) === B.infernal_stone)
              chunk.setRaw(x, y - 1, z, fill);
          }
      }

    for (let v = 0; v < 16; v++)
      this.vein(chunk, rng, B.quartz_ore!, 6, 10, 117);
    for (let v = 0; v < 4; v++)
      this.vein(chunk, rng, B.magma_block!, 8, LAVA_SEA - 4, LAVA_SEA + 3);
    // древние обломки: редкие жилки у самого дна, как в Minecraft (y 8..22)
    for (let v = 0; v < 2; v++)
      this.vein(chunk, rng, B.ancient_debris!, 2, 8, 22);

    // светокамень: гроздья, свисающие со сводов
    for (let g = 0; g < 8; g++) {
      const x = Math.floor(rng() * SX),
        z = Math.floor(rng() * SZ);
      let y = SY - 8;
      while (
        y > 40 &&
        !(get(x, y + 1, z) === B.infernal_stone && get(x, y, z) === 0)
      )
        y--;
      if (y <= 40) continue;
      let cx = x,
        cy = y,
        cz = z;
      for (let k = 0; k < 24; k++) {
        if (get(cx, cy, cz) === 0) chunk.setRaw(cx, cy, cz, B.glowstone!);
        cx = clamp(cx + Math.floor(rng() * 3) - 1, 0, SX - 1);
        cz = clamp(cz + Math.floor(rng() * 3) - 1, 0, SZ - 1);
        if (rng() < 0.6) cy = Math.max(1, cy - 1);
      }
    }

    // вечный огонь: адский камень горит без конца (world/behaviours/fire.ts)
    for (let f = 0; f < 3; f++) {
      const x = Math.floor(rng() * SX),
        z = Math.floor(rng() * SZ);
      for (let y = LAVA_SEA + 1; y < 110; y++)
        if (get(x, y - 1, z) === B.infernal_stone && get(x, y, z) === 0) {
          if (rng() < 0.5) chunk.setRaw(x, y, z, B.fire!);
          break;
        }
    }
  }

  /**
   * Биомы поверх пустошей (свой поток случайных чисел — прежнее Пекло не сдвигается): в лесах каждый пол
   * становится нилием с корнями и грибами, на нём растут огромные грибы Пекла (шляпка в чанке); в
   * долине душ пол — песок и почва душ.
   */
  private biomes(chunk: Chunk): void {
    const rng = mulberry32(
      hashString(`inf-biome:${this.seed}:${chunk.cx},${chunk.cz}`),
    );
    const wx0 = chunk.cx * SX,
      wz0 = chunk.cz * SZ;
    const get = (x: number, y: number, z: number): number =>
      chunk.blocks[idx(x, y, z)]!;
    const floorIds = new Set([B.infernal_stone, B.soul_sand, B.gravel]);
    const cols: InfernoBiome[] = [];
    for (let z = 0; z < SZ; z++)
      for (let x = 0; x < SX; x++) {
        const b = this.biomeAt(wx0 + x, wz0 + z);
        cols[x + z * SX] = b;
        if (b === "wastes") continue;
        const crimson = b === "crimson_forest";
        for (let y = LAVA_SEA - 2; y < SY - 6; y++) {
          if (!floorIds.has(get(x, y, z)) || get(x, y + 1, z) !== 0) continue;
          if (b === "soul_valley") {
            // песок и почва душ; на почве изредка — вечный огонь душ
            const soil = rng() >= 0.55;
            chunk.setRaw(x, y, z, soil ? B.soul_soil! : B.soul_sand!);
            if (soil && rng() < 0.03) chunk.setRaw(x, y + 1, z, B.soul_fire!);
            continue;
          }
          if (b === "basalt_deltas") {
            // базальт и чернокамень, пятнышки магмы
            const r = rng();
            chunk.setRaw(
              x,
              y,
              z,
              r < 0.05 ? B.magma_block! : r < 0.6 ? B.basalt! : B.blackstone!,
            );
            continue;
          }
          chunk.setRaw(x, y, z, crimson ? B.crimson_nylium! : B.warped_nylium!);
          const r = rng();
          if (r < 0.12)
            chunk.setRaw(
              x,
              y + 1,
              z,
              crimson ? B.crimson_roots! : B.warped_roots!,
            );
          else if (r < 0.15)
            chunk.setRaw(
              x,
              y + 1,
              z,
              crimson ? B.crimson_fungus! : B.warped_fungus!,
            );
        }
      }
    // базальтовые столбы: густо в дельтах, реже в долине душ
    const pillarFloor = new Set([
      B.basalt,
      B.blackstone,
      B.soul_soil,
      B.soul_sand,
    ]);
    for (let t = 0; t < 8; t++) {
      const x = Math.floor(rng() * SX),
        z = Math.floor(rng() * SZ);
      const b = cols[x + z * SX]!;
      if (b !== "basalt_deltas" && !(b === "soul_valley" && t < 2)) continue;
      const y0 = LAVA_SEA + 1 + Math.floor(rng() * 50);
      for (let y = y0; y < SY - 12; y++) {
        if (!pillarFloor.has(get(x, y - 1, z)) || get(x, y, z) !== 0) continue;
        const h = 2 + Math.floor(rng() * 6);
        for (let k = 0; k < h && get(x, y + k, z) === 0; k++)
          chunk.setRaw(x, y + k, z, B.basalt!);
        break;
      }
    }
    // окаменелость в долине душ: хребет из костяных блоков с рёбрами
    if (cols[8 + 8 * SX] === "soul_valley" && rng() < 0.12) {
      const x0 = 3 + Math.floor(rng() * 6),
        z = 3 + Math.floor(rng() * 10);
      for (let y = LAVA_SEA + 1; y < SY - 8; y++) {
        if (!pillarFloor.has(get(x0, y - 1, z)) || get(x0, y, z) !== 0)
          continue;
        for (let dx = 0; dx < 5; dx++)
          if (get(x0 + dx, y, z) === 0)
            chunk.setRaw(x0 + dx, y, z, B.bone_block!);
        for (const dx of [0, 2, 4])
          for (const dz of [-1, 1])
            if (get(x0 + dx, y + 1, z + dz) === 0)
              chunk.setRaw(x0 + dx, y + 1, z + dz, B.bone_block!);
        break;
      }
    }
    // огромные грибы: попытки в случайных колоннах леса, на нилии с простором над ним
    const R = HUGE_FUNGUS_RADIUS;
    for (let t = 0; t < 10; t++) {
      const x = R + Math.floor(rng() * (SX - 2 * R)),
        z = R + Math.floor(rng() * (SZ - 2 * R));
      const b = cols[x + z * SX]!;
      if (b !== "crimson_forest" && b !== "warped_forest") continue;
      const nylium =
        b === "crimson_forest" ? B.crimson_nylium : B.warped_nylium;
      const y0 = LAVA_SEA + 1 + Math.floor(rng() * 60);
      for (let y = y0; y < SY - HUGE_FUNGUS_HEIGHT - 2; y++) {
        if (get(x, y - 1, z) !== nylium) continue;
        let free = true;
        for (let k = 0; k < HUGE_FUNGUS_HEIGHT && free; k++)
          if (get(x, y + k, z) !== 0 && k > 0) free = false;
        if (!free) continue;
        growHugeFungus(
          (tx, ty, tz, id, soft) => {
            if (!soft || chunk.blocks[idx(tx, ty, tz)] === 0)
              chunk.setRaw(tx, ty, tz, id);
          },
          x,
          y,
          z,
          b === "warped_forest",
          rng,
        );
        break;
      }
    }
  }

  /** Жила руды: случайное блуждание, заменяет только адский камень. */
  private vein(
    chunk: Chunk,
    rng: () => number,
    ore: number,
    len: number,
    minY: number,
    maxY: number,
  ): void {
    let x = rng() * SX,
      y = minY + rng() * (maxY - minY),
      z = rng() * SZ;
    for (let i = 0; i < len; i++) {
      const bx = Math.floor(x),
        by = Math.floor(y),
        bz = Math.floor(z);
      if (bx >= 0 && bx < SX && bz >= 0 && bz < SZ && by > 0 && by < SY - 1)
        if (chunk.blocks[idx(bx, by, bz)] === B.infernal_stone)
          chunk.setRaw(bx, by, bz, ore);
      x += rng() * 2 - 1;
      y += rng() * 2 - 1;
      z += rng() * 2 - 1;
    }
  }

  spawnHint(): { x: number; z: number } {
    return { x: 0, z: 0 };
  }
}
