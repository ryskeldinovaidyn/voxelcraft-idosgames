// Предел (сейв v3): главный остров из камня Предела над пустотой, 10 обсидиановых колонн по кругу
// (на вершине — бедрок под Кристалл Предела; кристаллы — сущности, их ставит игра) и бедроковый
// фонтан в центре — после победы над драконом в нём открывается выходной портал. Дальше OUTER_START
// — внешние острова с эхоцветом и городами Предела (worldgen/beyond/outer.ts); туда ведут Врата,
// открывшиеся после победы (gatewaySpot).
//
// ⚠ Вывод генератора станет частью формата сейва после релиза (как у OverworldGenerator).
import { Simplex2, hashString, mulberry32 } from "../../core/Noise";
import { B } from "../../registry/Blocks";
import { CHUNK_SIZE, type Chunk } from "../../world/Chunk";
import type { ItemStack } from "../../types";
import type { WorldGenerator } from "../WorldGenerator";
import { carveVillages } from "../features/village";
import {
  CITY_REGION,
  ECHO_CHANCE,
  OUTER_START,
  cityLoot,
  echoRoll,
  inBox,
  planCity,
  plantEcho,
  type City,
} from "./outer";

const { SX, SZ } = CHUNK_SIZE;

/** Верх острова в центре (пол фонтана). */
export const ISLAND_Y = 56;
/** Куда прибывает игрок: обсидиановая площадка у края острова (строит Game при каждом прибытии). */
export const BEYOND_ARRIVAL = { x: 64, y: 50, z: 0 };
const PILLAR_RING = 38;
/** Врата на внешние острова — на кольце вокруг главного острова, чуть выше его. */
export const GATEWAY_RING = 72;
/** Куда ведут врата: на это расстояние от центра в ту же сторону. */
export const OUTER_LANDING = 820;
/** Порог шума внешних островов: выше — суша. */
const OUTER_EDGE = 0.1;

export interface Pillar {
  x: number;
  z: number;
  /** Радиус колонны. */
  r: number;
  /** y верхнего обсидиана; на y+1 — бедрок под кристалл. */
  top: number;
}

/** Колонны Предела — чистая функция сида (генератор строит, игра ставит кристаллы). */
export function beyondPillars(seed: number): Pillar[] {
  const rng = mulberry32(hashString(`beyond-pillars:${seed}`));
  return Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    return {
      x: Math.round(Math.cos(a) * PILLAR_RING),
      z: Math.round(Math.sin(a) * PILLAR_RING),
      r: 2 + Math.floor(rng() * 3),
      top: 76 + ((i * 7 + Math.floor(rng() * 10)) % 28),
    };
  });
}

/** Клетки выходного портала в чаше фонтана (y = ISLAND_Y), без центральной колонны. */
export function exitPortalCells(): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let x = -2; x <= 2; x++)
    for (let z = -2; z <= 2; z++) {
      const d = Math.hypot(x, z);
      if (d < 2.5 && d > 0.5) out.push([x, ISLAND_Y, z]);
    }
  return out;
}

/** Нижняя клетка Врат Предела (их две по высоте, бедрок сверху и снизу) — чистая функция сида. */
export function gatewaySpot(seed: number): [number, number, number] {
  const a = mulberry32(hashString(`beyond-gateway:${seed}`))() * Math.PI * 2;
  return [
    Math.round(Math.cos(a) * GATEWAY_RING),
    ISLAND_Y + 8,
    Math.round(Math.sin(a) * GATEWAY_RING),
  ];
}

export class BeyondGenerator implements WorldGenerator {
  readonly seed: number;
  readonly waterLevel = 0;
  readonly pillars: Pillar[];
  private readonly edge: Simplex2;
  private readonly bump: Simplex2;
  private readonly outer: Simplex2;
  /** Города по регионам (CITY_REGION): план считается при первом обращении. */
  private readonly cities = new Map<string, City | null>();

  constructor(seed: number) {
    this.seed = seed;
    this.pillars = beyondPillars(seed);
    this.edge = new Simplex2(hashString(`beyond:edge:${seed}`));
    this.bump = new Simplex2(hashString(`beyond:bump:${seed}`));
    this.outer = new Simplex2(hashString(`beyond:outer:${seed}`));
  }

  private radius(x: number, z: number): number {
    return 58 + this.edge.noise(x * 0.03, z * 0.03) * 8;
  }

  private outerDensity(x: number, z: number): number {
    return this.outer.fbm(x * 0.012, z * 0.012, 3);
  }

  /** y верха острова в колонне; null — пустота. */
  surfaceAt(x: number, z: number): number | null {
    const d = Math.hypot(x, z),
      R = this.radius(x, z);
    if (d <= R)
      return (
        ISLAND_Y +
        Math.round(this.bump.noise(x * 0.05, z * 0.05) * 2) -
        Math.round((d / R) ** 2 * 4)
      );
    if (d < OUTER_START) return null;
    const n = this.outerDensity(x, z);
    if (n < OUTER_EDGE) return null;
    return (
      ISLAND_Y -
      4 +
      Math.round((n - OUTER_EDGE) * 30) +
      Math.round(this.bump.noise(x * 0.05, z * 0.05) * 2)
    );
  }

  /** Толщина внешнего острова в колонне — к краю тоньше. */
  private outerDepth(x: number, z: number): number {
    return Math.round(3 + (this.outerDensity(x, z) - OUTER_EDGE) * 70);
  }

  generate(chunk: Chunk): void {
    const wx0 = chunk.cx * SX,
      wz0 = chunk.cz * SZ;
    for (let x = 0; x < SX; x++)
      for (let z = 0; z < SZ; z++) {
        const wx = wx0 + x,
          wz = wz0 + z;
        const top = this.surfaceAt(wx, wz);
        if (top === null) continue;
        let depth: number;
        if (Math.hypot(wx, wz) < OUTER_START) {
          const k = Math.hypot(wx, wz) / this.radius(wx, wz);
          depth = Math.round(4 + (1 - k * k) * 34); // остров сужается книзу
        } else depth = this.outerDepth(wx, wz);
        for (let y = Math.max(1, top - depth); y <= top; y++)
          chunk.setRaw(x, y, z, B.beyond_stone!);
      }

    // колонны: обсидиан от острова до вершины, сверху — бедрок под кристалл
    for (const p of this.pillars)
      for (let x = 0; x < SX; x++)
        for (let z = 0; z < SZ; z++) {
          const dx = wx0 + x - p.x,
            dz = wz0 + z - p.z;
          if (dx * dx + dz * dz > p.r * p.r + 0.5) continue;
          for (let y = 30; y <= p.top; y++) chunk.setRaw(x, y, z, B.obsidian!);
          if (dx === 0 && dz === 0) chunk.setRaw(x, p.top + 1, z, B.bedrock!);
        }

    // фонтан: чаша из бедрока с колонной в центре; внутри чаши — пусто до победы
    for (let x = 0; x < SX; x++)
      for (let z = 0; z < SZ; z++) {
        const wx = wx0 + x,
          wz = wz0 + z;
        const d = Math.hypot(wx, wz);
        if (d >= 3.5) continue;
        for (let y = ISLAND_Y; y <= ISLAND_Y + 6; y++)
          chunk.setRaw(x, y, z, B.air!);
        chunk.setRaw(x, ISLAND_Y - 1, z, B.bedrock!);
        if (d >= 2.5) chunk.setRaw(x, ISLAND_Y, z, B.bedrock!);
        if (d < 0.5)
          for (let y = ISLAND_Y; y <= ISLAND_Y + 3; y++)
            chunk.setRaw(x, y, z, B.bedrock!);
      }

    if (Math.hypot(wx0 + SX / 2, wz0 + SZ / 2) > OUTER_START - 24)
      this.decorateOuter(chunk);
    chunk.generated = true;
  }

  /** Внешние острова: кусты эхоцвета, затем город региона поверх. */
  private decorateOuter(chunk: Chunk): void {
    const wx0 = chunk.cx * SX,
      wz0 = chunk.cz * SZ;
    const city = this.cityIn(
      Math.floor(wx0 / CITY_REGION),
      Math.floor(wz0 / CITY_REGION),
    );
    // кусты с началом в чанке и на блок вокруг (ветка заходит в соседа)
    for (let x = wx0 - 1; x <= wx0 + SX; x++)
      for (let z = wz0 - 1; z <= wz0 + SZ; z++) {
        if (
          echoRoll(this.seed, x, z) > ECHO_CHANCE ||
          Math.hypot(x, z) < OUTER_START
        )
          continue;
        const top = this.surfaceAt(x, z);
        if (top === null || (city && inBox(city.box, x, top + 1, z))) continue;
        for (const [px, py, pz, id] of plantEcho(this.seed, x, top, z))
          if (px >= wx0 && px < wx0 + SX && pz >= wz0 && pz < wz0 + SZ)
            chunk.setRaw(px - wx0, py, pz - wz0, id);
      }
    if (city) carveVillages(chunk, [city]);
  }

  /** Город региона (rx, rz) или null (worldgen/beyond/outer). */
  cityIn(rx: number, rz: number): City | null {
    const k = rx + "," + rz;
    if (!this.cities.has(k))
      this.cities.set(k, planCity(this, this.seed, rx, rz));
    return this.cities.get(k)!;
  }

  private cityAt(x: number, z: number): City | null {
    return this.cityIn(
      Math.floor(x / CITY_REGION),
      Math.floor(z / CITY_REGION),
    );
  }

  /** Города с центром ближе r — Game селит в них панцирников (тот же путь, что жители деревень). */
  villagesNear(x: number, z: number, r: number): City[] {
    const rx = Math.floor(x / CITY_REGION),
      rz = Math.floor(z / CITY_REGION);
    const out: City[] = [];
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        const c = this.cityIn(rx + dx, rz + dz);
        if (c && Math.hypot(c.x - x, c.z - z) < r) out.push(c);
      }
    return out;
  }

  structureAt(x: number, y: number, z: number): string | null {
    const c = this.cityAt(x, z);
    return c && inBox(c.box, Math.floor(x), Math.floor(y), Math.floor(z))
      ? "beyond_city"
      : null;
  }

  locate(
    kind: string,
    x: number,
    z: number,
  ): { x: number; y: number; z: number } | null {
    if (kind !== "city") return null;
    const rx = Math.floor(x / CITY_REGION),
      rz = Math.floor(z / CITY_REGION);
    let best: City | null = null;
    for (let ring = 0; ring <= 10 && !best; ring++)
      for (let dx = -ring; dx <= ring; dx++)
        for (let dz = -ring; dz <= ring; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
          const c = this.cityIn(rx + dx, rz + dz);
          if (
            c &&
            (!best ||
              Math.hypot(c.x - x, c.z - z) < Math.hypot(best.x - x, best.z - z))
          )
            best = c;
        }
    return best ? { x: best.x, y: best.y, z: best.z } : null;
  }

  lootAt(x: number, y: number, z: number): (ItemStack | null)[] | null {
    const kind = this.cityAt(x, z)?.chests.get(`${x},${y},${z}`);
    return kind ? cityLoot(kind, this.seed, x, y, z) : null;
  }

  /** Суша внешних островов ближе r к (x, z): где встать (y — над верхом) или null. */
  landingNear(
    x: number,
    z: number,
    r: number,
  ): { x: number; y: number; z: number } | null {
    for (let ring = 0; ring <= r; ring += 2)
      for (let dx = -ring; dx <= ring; dx += 2)
        for (let dz = -ring; dz <= ring; dz += 2) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
          if (Math.hypot(x + dx, z + dz) < OUTER_START) continue;
          const top = this.surfaceAt(x + dx, z + dz);
          if (top !== null) return { x: x + dx, y: top + 1, z: z + dz };
        }
    return null;
  }

  spawnHint(): { x: number; z: number } {
    return { x: BEYOND_ARRIVAL.x, z: BEYOND_ARRIVAL.z };
  }
}
