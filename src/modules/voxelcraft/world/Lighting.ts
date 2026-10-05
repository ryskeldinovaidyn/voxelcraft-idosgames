// Освещение как в Minecraft. У клетки два уровня 0..15: небесный (15 под открытым небом) и от
// блоков (факел 14, светокамень и лава 15). Свет затухает на 1 за шаг и сильнее сквозь листву и
// воду (filter блока); небесный 15 идёт вниз сквозь прозрачное без потерь — поэтому под навесом
// темнее, чем рядом под небом.
//
// Чанк заливается целиком при загрузке (локальный BFS внутри чанка + обмен светом по границам с
// соседними освещёнными чанками), дальше — инкрементально на каждый setBlock: снятие света,
// зависевшего от изменённой клетки, и повторная заливка от соседей. Изменения света дертят меши.
import { BLOCKS } from "../registry/Blocks";
import { CHUNK_SIZE, idx, type Chunk } from "./Chunk";
import type { ChunkManager } from "./ChunkManager";

const { SX, SY, SZ } = CHUNK_SIZE;
const LAYER = SX * SZ;
const CELLS = SX * SY * SZ;

export const SKY = 0;
export const BLK = 1;

/** Свет выше мира и у незагруженных чанков: открытое небо. */
export const OPEN_SKY = 0xf0;

// фильтр и излучение по id — плоские массивы для горячих циклов
const FILTER = Uint8Array.from(BLOCKS, (b) => Math.min(15, b.filter));
const EMIT = Uint8Array.from(BLOCKS, (b) => b.light);

const get = (L: Uint8Array, i: number, ch: number): number =>
  ch === SKY ? L[i]! >> 4 : L[i]! & 15;
const put = (L: Uint8Array, i: number, ch: number, v: number): void => {
  L[i] = ch === SKY ? (L[i]! & 15) | (v << 4) : (L[i]! & 0xf0) | v;
};

/** Сколько света теряет шаг в клетку с фильтром f (небо 15 вниз сквозь прозрачное — ничего). */
const cost = (ch: number, down: boolean, level: number, f: number): number =>
  ch === SKY && down && level === 15 && f === 0 ? 0 : Math.max(1, f);

/** 6 направлений: dx, dy, dz. Вниз — индекс 3. */
const DIRS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
] as const;

export class Lighting {
  /** @param hasSky — есть ли у измерения небо (в Пекле и Пределе небесного канала нет вовсе) */
  constructor(
    private readonly world: ChunkManager,
    readonly hasSky = true,
  ) {}

  // ---- заливка чанка при загрузке -------------------------------------------------

  /** Посчитать свет свежесгенерированного чанка и обменяться светом с соседями. */
  initChunk(c: Chunk): void {
    const L = c.light,
      blocks = c.blocks;
    L.fill(0);
    const top = Math.min(SY - 1, c.top + 1);
    const q: number[] = [];
    if (this.hasSky) this.skyPass(c, top, q);

    // источники света
    q.length = 0;
    for (let i = 0; i < (top + 1) * LAYER; i++) {
      const e = EMIT[blocks[i]!]!;
      if (e > 0) {
        put(L, i, BLK, e);
        q.push(i);
      }
    }
    this.localSpread(c, BLK, q);

    c.lit = true;
    this.exchange(c);
  }

  /** Небесный свет чанка: колонки сверху вниз, затем растекание вбок под навесы. */
  private skyPass(c: Chunk, top: number, q: number[]): void {
    const L = c.light,
      blocks = c.blocks;
    // выше верхнего непустого слоя — открытое небо
    for (let i = (top + 1) * LAYER; i < CELLS; i++) L[i] = OPEN_SKY;

    // небо по колонкам сверху вниз
    for (let col = 0; col < LAYER; col++) {
      let lvl = 15;
      for (let y = top; y >= 0; y--) {
        const i = col + y * LAYER;
        const f = FILTER[blocks[i]!]!;
        if (!(lvl === 15 && f === 0))
          lvl = f >= 15 ? 0 : Math.max(0, lvl - Math.max(1, f));
        if (lvl === 0) break;
        L[i] = lvl << 4;
      }
    }

    // края освещённых колонок, откуда небо растечётся вбок (под навесы, в пещерные входы)
    for (let i = 0; i < (top + 1) * LAYER; i++) {
      const s = L[i]! >> 4;
      if (s < 2) continue;
      const x = i & 15,
        z = (i >> 4) & 15;
      if (
        (x > 0 && this.darker(c, i - 1, s)) ||
        (x < 15 && this.darker(c, i + 1, s)) ||
        (z > 0 && this.darker(c, i - 16, s)) ||
        (z < 15 && this.darker(c, i + 16, s))
      )
        q.push(i);
    }
    this.localSpread(c, SKY, q);
  }

  /** Соседняя клетка темнее, чем пустил бы в неё свет s. */
  private darker(c: Chunk, n: number, s: number): boolean {
    return FILTER[c.blocks[n]!]! < 15 && c.light[n]! >> 4 < s - 1;
  }

  /** BFS внутри одного чанка по индексам (быстрый путь заливки при загрузке). */
  private localSpread(c: Chunk, ch: number, q: number[]): void {
    const L = c.light,
      blocks = c.blocks;
    for (let k = 0; k < q.length; k++) {
      const i = q[k]!;
      const l = get(L, i, ch);
      if (l <= 1) continue;
      const x = i & 15,
        z = (i >> 4) & 15,
        y = i >> 8;
      for (let d = 0; d < 6; d++) {
        let n: number;
        switch (d) {
          case 0:
            if (x === 15) continue;
            n = i + 1;
            break;
          case 1:
            if (x === 0) continue;
            n = i - 1;
            break;
          case 2:
            if (y === SY - 1) continue;
            n = i + LAYER;
            break;
          case 3:
            if (y === 0) continue;
            n = i - LAYER;
            break;
          case 4:
            if (z === 15) continue;
            n = i + 16;
            break;
          default:
            if (z === 0) continue;
            n = i - 16;
        }
        const f = FILTER[blocks[n]!]!;
        if (f >= 15) continue;
        const nl = l - cost(ch, d === 3, l, f);
        if (nl > get(L, n, ch)) {
          put(L, n, ch, nl);
          q.push(n);
        }
      }
    }
  }

  /** Обмен светом по границам с уже освещёнными соседними чанками (в обе стороны). */
  private exchange(c: Chunk): void {
    const seeds: number[] = [];
    const x0 = c.cx * SX,
      z0 = c.cz * SZ;
    for (const [dx, dz] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      const n = this.world.chunks.get(c.cx + dx + "," + (c.cz + dz));
      if (!n?.lit) continue;
      const top = Math.min(SY - 1, Math.max(c.top, n.top) + 1);
      for (let y = 0; y <= top; y++)
        for (let t = 0; t < 16; t++) {
          // клетка этого чанка у границы и клетка соседа за ней
          const [ax, az] =
            dx !== 0
              ? [dx < 0 ? x0 : x0 + 15, z0 + t]
              : [x0 + t, dz < 0 ? z0 : z0 + 15];
          seeds.push(ax, y, az, ax + dx, y, az + dz);
        }
    }
    if (!seeds.length) return;
    if (this.hasSky) this.spread(SKY, seeds.slice());
    this.spread(BLK, seeds);
  }

  // ---- инкрементальные обновления ----------------------------------------------------

  /** Блок в клетке сменился: пересчитать свет, если сменились его фильтр или свечение. */
  onChange(x: number, y: number, z: number, prevId: number, id: number): void {
    const c = this.world.chunkAt(x, z);
    if (!c?.lit || y < 0 || y >= SY) return;
    const filterChanged = FILTER[prevId] !== FILTER[id];
    if (filterChanged && this.hasSky) this.relight(SKY, x, y, z);
    if (filterChanged || EMIT[prevId] !== EMIT[id]) this.relight(BLK, x, y, z);
  }

  private relight(ch: number, x: number, y: number, z: number): void {
    const rq: number[] = [],
      aq: number[] = [];
    const old = this.getW(ch, x, y, z);
    if (old > 0) {
      this.setW(ch, x, y, z, 0);
      rq.push(x, y, z, old);
    }
    this.remove(ch, rq, aq);
    const e = ch === BLK ? EMIT[this.world.getBlock(x, y, z)]! : 0;
    if (e > 0) {
      this.setW(ch, x, y, z, e);
      aq.push(x, y, z);
    }
    for (const [dx, dy, dz] of DIRS)
      if (this.getW(ch, x + dx, y + dy, z + dz) > 0)
        aq.push(x + dx, y + dy, z + dz);
    this.spread(ch, aq);
  }

  /** Снять свет, питавшийся от убранного: соседей слабее — погасить, сильнее — перезалить. */
  private remove(ch: number, rq: number[], aq: number[]): void {
    for (let k = 0; k < rq.length; k += 4) {
      const x = rq[k]!,
        y = rq[k + 1]!,
        z = rq[k + 2]!,
        lvl = rq[k + 3]!;
      for (let d = 0; d < 6; d++) {
        const [dx, dy, dz] = DIRS[d]!;
        const nx = x + dx,
          ny = y + dy,
          nz = z + dz;
        const nl = this.getW(ch, nx, ny, nz);
        if (nl <= 0) continue;
        if (nl < lvl || (ch === SKY && d === 3 && lvl === 15 && nl === 15)) {
          this.setW(ch, nx, ny, nz, 0);
          rq.push(nx, ny, nz, nl);
          if (ch === BLK) {
            const e = EMIT[this.world.getBlock(nx, ny, nz)]!;
            if (e > 0) {
              this.setW(ch, nx, ny, nz, e); // источник светит сам
              aq.push(nx, ny, nz);
            }
          }
        } else aq.push(nx, ny, nz);
      }
    }
  }

  /** BFS по миру (через границы чанков). q — тройки x, y, z. */
  private spread(ch: number, q: number[]): void {
    for (let k = 0; k < q.length; k += 3) {
      const x = q[k]!,
        y = q[k + 1]!,
        z = q[k + 2]!;
      const l = this.getW(ch, x, y, z);
      if (l <= 1) continue;
      for (let d = 0; d < 6; d++) {
        const [dx, dy, dz] = DIRS[d]!;
        const nx = x + dx,
          ny = y + dy,
          nz = z + dz;
        const cur = this.getW(ch, nx, ny, nz);
        if (cur < 0) continue; // вне мира или чанк не освещён
        const f = FILTER[this.world.getBlock(nx, ny, nz)]!;
        if (f >= 15) continue;
        const nl = l - cost(ch, d === 3, l, f);
        if (nl > cur) {
          this.setW(ch, nx, ny, nz, nl);
          q.push(nx, ny, nz);
        }
      }
    }
  }

  // ---- доступ к свету в мировых координатах ------------------------------------------

  private lastKey = "";
  private lastChunk: Chunk | undefined;

  private litChunk(x: number, z: number): Chunk | undefined {
    const k = Math.floor(x / SX) + "," + Math.floor(z / SZ);
    if (k !== this.lastKey) {
      this.lastKey = k;
      this.lastChunk = this.world.chunks.get(k);
    }
    const c = this.lastChunk;
    return c && c.lit ? c : undefined;
  }

  /** Уровень канала в клетке; -1 — вне мира или чанк не освещён. */
  private getW(ch: number, x: number, y: number, z: number): number {
    if (y < 0 || y >= SY) return -1;
    const c = this.litChunk(x, z);
    return c ? get(c.light, idx(x & 15, y, z & 15), ch) : -1;
  }

  private setW(ch: number, x: number, y: number, z: number, v: number): void {
    const c = this.litChunk(x, z);
    if (!c) return;
    const lx = x & 15,
      lz = z & 15;
    put(c.light, idx(lx, y, lz), ch, v);
    // меш чанка и соседа по границе (его грани берут свет из этой клетки) пересобрать
    c.dirty = true;
    if (lx === 0) this.dirtyAt(x - 1, z);
    else if (lx === 15) this.dirtyAt(x + 1, z);
    if (lz === 0) this.dirtyAt(x, z - 1);
    else if (lz === 15) this.dirtyAt(x, z + 1);
  }

  private dirtyAt(x: number, z: number): void {
    const c = this.world.chunks.get(
      Math.floor(x / SX) + "," + Math.floor(z / SZ),
    );
    if (c?.generated) c.dirty = true;
  }

  /** Сброс кэша последнего чанка (мир очищен или чанки выгружены). */
  forget(): void {
    this.lastKey = "";
    this.lastChunk = undefined;
  }
}
