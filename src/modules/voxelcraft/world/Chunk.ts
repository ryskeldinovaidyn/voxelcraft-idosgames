// Чанк: плоские типизированные массивы блоков, меты и света.
// Индекс: x | (z<<4) | (y<<8) — горизонтальные срезы непрерывны (мешинг/вода
// читают их кэш-дружелюбно). Формула не зависит от высоты чанка: поэтому дифы сейвов,
// записанные при высоте 64, ложатся на чанк высотой 128 на те же места.
import type * as THREE from "three";
import { CONFIG } from "../config";

const { sx: SX, sy: SY, sz: SZ } = CONFIG.chunk;
export const idx = (x: number, y: number, z: number): number =>
  x | (z << 4) | (y << 8);

/**
 * Высота мира до сейва v3. Старые генераторы (TerrainGenerator, SpecGenerator и постройки рецепта)
 * клампят рельеф и деревья по ней, а не по CONFIG.chunk.sy: иначе подъём потолка мира сдвинул бы
 * их вывод, а вывод генератора — часть формата сейва.
 */
export const LEGACY_SY = 64;

/** Свет: старшие 4 бита — небесный (0..15), младшие — от блоков. */
export const skyLightOf = (v: number): number => v >> 4;
export const blockLightOf = (v: number): number => v & 15;

export class Chunk {
  cx: number;
  cz: number;
  /** id блоков (16 бит: блоков больше 256). */
  blocks: Uint16Array;
  meta: Uint8Array;
  /** Свет клетки: (sky << 4) | block. Считает Lighting, мешер пишет его в вершины. */
  light: Uint8Array;
  modified: Map<number, [number, number]>;
  dirty: boolean;
  waterDirty: boolean;
  generated: boolean;
  /** Свет чанка посчитан (после генерации его заливает Lighting). */
  lit: boolean;
  /** Самый верхний непустой слой: мешер и свет не обходят пустое небо над ним. */
  top: number;
  solidMesh: THREE.Mesh | null;
  foliageMesh: THREE.Mesh | null;
  waterMesh: THREE.Mesh | null;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint16Array(SX * SY * SZ);
    this.meta = new Uint8Array(SX * SY * SZ);
    this.light = new Uint8Array(SX * SY * SZ);
    // Диф от генерации: каждый рантайм-setBlock пишется сюда.
    // Это одновременно формат сейва и полного снапшота этапа 2.
    this.modified = new Map(); // index -> [id, meta]
    this.dirty = false; // нужна пересборка твёрдой/растительной геометрии
    this.waterDirty = false; // нужна пересборка только водной геометрии
    this.generated = false;
    this.lit = false;
    this.top = SY - 1;
    // THREE.Mesh-ы (создаются/пересоздаются мешером)
    this.solidMesh = null;
    this.foliageMesh = null;
    this.waterMesh = null;
  }

  get(x: number, y: number, z: number): number {
    return this.blocks[idx(x, y, z)]!;
  }
  getMeta(x: number, y: number, z: number): number {
    return this.meta[idx(x, y, z)]!;
  }

  /** Прямая запись без записи в diff — используется генератором. */
  setRaw(x: number, y: number, z: number, id: number, meta = 0): void {
    const i = idx(x, y, z);
    this.blocks[i] = id;
    this.meta[i] = meta;
  }

  /** Рантайм-запись: фиксируется в modified (сейв/снапшот). */
  set(x: number, y: number, z: number, id: number, meta = 0): void {
    const i = idx(x, y, z);
    this.blocks[i] = id;
    this.meta[i] = meta;
    this.modified.set(i, [id, meta]);
    if (id !== 0 && y > this.top) this.top = y;
  }

  /** Применить сейв-диф после генерации. */
  applyDiff(entries: Iterable<[number, [number, number]]>): void {
    for (const [i, [id, meta]] of entries) {
      this.blocks[i] = id;
      this.meta[i] = meta;
      this.modified.set(i, [id, meta]);
    }
  }

  /** Пересчитать верхний непустой слой (после генерации и дифов). */
  recomputeTop(): void {
    const layer = SX * SZ;
    for (let y = SY - 1; y >= 0; y--) {
      const from = y * layer;
      for (let i = from; i < from + layer; i++)
        if (this.blocks[i] !== 0) {
          this.top = y;
          return;
        }
    }
    this.top = 0;
  }

  serializeDiff(): [number, number, number][] {
    return [...this.modified.entries()].map(
      ([i, [id, meta]]): [number, number, number] => [i, id, meta],
    );
  }
}

export const CHUNK_SIZE = { SX, SY, SZ };
