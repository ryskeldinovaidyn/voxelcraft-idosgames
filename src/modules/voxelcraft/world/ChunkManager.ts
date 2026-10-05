// Менеджер чанков: стриминг вокруг игрока, мировые getBlock/setBlock,
// очередь пересборки мешей с бюджетом на кадр, планировщик onTick-блоков
// (шов будущей автоматизации: печи/конвейеры регистрируются сами).
import type * as THREE from "three";
import { CONFIG } from "../config";
import { events } from "../core/EventBus";
import { BLOCKS, B } from "../registry/Blocks";
import { Chunk, CHUNK_SIZE, idx } from "./Chunk";
import { ChunkMesher } from "./ChunkMesher";
import { Lighting, OPEN_SKY } from "./Lighting";
import type { WorldGenerator } from "../worldgen/WorldGenerator";
import { DIMENSIONS, dimensionGenerator, type DimensionId } from "./Dimensions";
import { BEHAVIOURS, type Behaviour } from "./blockBehaviour";
import type { TextureAtlas } from "../gfx/TextureAtlas";
import type { BlockEntity } from "./BlockEntities";
import type { ChunkDiffMap, WorldSource } from "../types";

const { SX, SY, SZ } = CHUNK_SIZE;
const key = (cx: number, cz: number): string => cx + "," + cz;

export class ChunkManager {
  scene: THREE.Scene;
  seed: number;
  /** Из чего построен мир — пишется в сейв, чтобы восстановить его генерацией. */
  readonly source: WorldSource;
  generator: WorldGenerator;
  mesher: ChunkMesher;
  chunks: Map<string, Chunk>;
  genQueue: Chunk[];
  pendingDiffs: Map<string, Map<number, [number, number]>>;
  tickingBlocks: Map<string, { x: number; y: number; z: number }>;
  /** Свет клеток (небесный и от блоков): заливка чанков и обновления на setBlock. */
  readonly lighting: Lighting;
  /** Измерение этого мира (у каждого свой ChunkManager). */
  readonly dimension: DimensionId;
  /** Номер симтика — время запланированных тиков. */
  tickN = 0;
  /** Идёт дождь (ставит Game из systems/Weather): огонь под небом гаснет, пашня мокнет. */
  raining = false;
  /** Блочная сущность клетки (ставит Game): компаратор читает заполненность сундука. */
  containerAt:
    ((x: number, y: number, z: number) => BlockEntity | undefined) | null =
    null;
  private readonly scheduled = new Map<
    string,
    { x: number; y: number; z: number; due: number }
  >();
  /** id → есть ли у блока случайный тик (строится при первом тике: поведения уже подключены). */
  private randomTickable: Uint8Array | null = null;

  constructor(
    scene: THREE.Scene,
    atlas: TextureAtlas,
    source: WorldSource,
    dimension: DimensionId = "overworld",
  ) {
    this.scene = scene;
    this.source = source;
    this.dimension = dimension;
    this.generator = dimensionGenerator(dimension, source);
    this.seed = this.generator.seed;
    this.mesher = new ChunkMesher(atlas, this);
    this.chunks = new Map(); // "cx,cz" -> Chunk
    this.genQueue = []; // чанки, ожидающие генерации данных
    this.pendingDiffs = new Map(); // сейв-дифы для ещё не загруженных чанков
    this.tickingBlocks = new Map(); // "x,y,z" -> {x,y,z} — блоки с onTick
    this.lighting = new Lighting(this, DIMENSIONS[dimension].hasSky);
  }

  /** Свет клетки: (небо << 4) | блоки. Незагруженное и выше мира — открытое небо (если оно есть). */
  getLight(wx: number, wy: number, wz: number): number {
    const open = this.lighting.hasSky ? OPEN_SKY : 0;
    if (wy >= SY) return open;
    if (wy < 0) return 0;
    const c = this.chunkAt(wx, wz);
    if (!c || !c.lit) return open;
    return c.light[idx(wx & 15, wy, wz & 15)]!;
  }

  /** Заказать тик блока через delay симтиков (у раньше заказанного остаётся ближайший срок). */
  scheduleTick(x: number, y: number, z: number, delay: number): void {
    const k = x + "," + y + "," + z;
    const due = this.tickN + Math.max(1, delay);
    const cur = this.scheduled.get(k);
    if (!cur || cur.due > due) this.scheduled.set(k, { x, y, z, due });
  }

  /** Вызвать тик поведения блока в клетке. */
  private runTick(
    x: number,
    y: number,
    z: number,
    kind: "randomTick" | "scheduledTick",
  ): void {
    const id = this.getBlock(x, y, z);
    const fn: Behaviour[typeof kind] = BEHAVIOURS.get(id)?.[kind];
    if (fn)
      fn({
        world: this,
        x,
        y,
        z,
        id,
        meta: this.getMeta(x, y, z),
        rng: Math.random,
      });
  }

  /** Случайные тики: CONFIG.randomTickSpeed клеток на каждую секцию 16³ каждого чанка, как в Minecraft. */
  private randomTicks(): void {
    const n = CONFIG.randomTickSpeed;
    if (n <= 0) return;
    const table = (this.randomTickable ??= Uint8Array.from(BLOCKS, (b) =>
      BEHAVIOURS.get(b.id)?.randomTick ? 1 : 0,
    ));
    for (const c of this.chunks.values()) {
      if (!c.generated) continue;
      const sections = (c.top >> 4) + 1;
      for (let s = 0; s < sections; s++)
        for (let k = 0; k < n; k++) {
          const r = (Math.random() * 4096) | 0;
          const lx = r & 15,
            lz = (r >> 4) & 15,
            ly = (s << 4) + (r >> 8);
          if (ly >= SY || !table[c.blocks[idx(lx, ly, lz)]!]) continue;
          this.runTick(c.cx * SX + lx, ly, c.cz * SZ + lz, "randomTick");
        }
    }
  }

  /** Уровень моря текущего мира (у мира из рецепта он свой). */
  get waterLevel(): number {
    return this.generator.waterLevel;
  }

  // ---- доступ к блокам в мировых координатах --------------------------------

  chunkAt(wx: number, wz: number): Chunk | undefined {
    return this.chunks.get(key(Math.floor(wx / SX), Math.floor(wz / SZ)));
  }

  getBlock(wx: number, wy: number, wz: number): number {
    if (wy < 0 || wy >= SY) return B.air!;
    const c = this.chunkAt(wx, wz);
    if (!c || !c.generated) return B.air!;
    return c.blocks[idx(wx & 15, wy, wz & 15)]!;
  }

  /** Как getBlock, но -1 для незагруженного чанка (мешер трактует как «непрозрачно»). */
  getBlockOrUnloaded(wx: number, wy: number, wz: number): number {
    if (wy < 0) return B.bedrock!;
    if (wy >= SY) return B.air!;
    const c = this.chunkAt(wx, wz);
    if (!c || !c.generated) return -1;
    return c.blocks[idx(wx & 15, wy, wz & 15)]!;
  }

  getMeta(wx: number, wy: number, wz: number): number {
    if (wy < 0 || wy >= SY) return 0;
    const c = this.chunkAt(wx, wz);
    if (!c || !c.generated) return 0;
    return c.meta[idx(wx & 15, wy, wz & 15)]!;
  }

  isSolid(wx: number, wy: number, wz: number): boolean {
    return BLOCKS[this.getBlock(wx, wy, wz)]?.solid ?? false;
  }

  /**
   * Единственная точка мутации мира. Пишет диф, дертит чанк и соседей
   * на границе, ведёт реестр onTick-блоков, эмитит blockChanged.
   */
  setBlock(
    wx: number,
    wy: number,
    wz: number,
    id: number,
    meta = 0,
    opts: { waterOnly?: boolean } = {},
  ): boolean {
    if (wy < 0 || wy >= SY) return false;
    const c = this.chunkAt(wx, wz);
    if (!c || !c.generated) return false;
    const lx = wx & 15,
      lz = wz & 15;
    const prevId = c.blocks[idx(lx, wy, lz)]!;
    c.set(lx, wy, lz, id, meta);
    this.lighting.onChange(wx, wy, wz, prevId, id);

    // только вода → дешёвая пересборка одного водного меша
    if (
      opts.waterOnly &&
      (id === B.water || prevId === B.water) &&
      !(id !== B.water && prevId !== B.water)
    ) {
      c.waterDirty = true;
    } else {
      c.dirty = true;
      if (lx === 0) this._dirtyNeighbor(wx - 1, wz);
      if (lx === 15) this._dirtyNeighbor(wx + 1, wz);
      if (lz === 0) this._dirtyNeighbor(wx, wz - 1);
      if (lz === 15) this._dirtyNeighbor(wx, wz + 1);
    }

    const tickKey = wx + "," + wy + "," + wz;
    if (BLOCKS[id]?.onTick)
      this.tickingBlocks.set(tickKey, { x: wx, y: wy, z: wz });
    else this.tickingBlocks.delete(tickKey);

    events.emit("blockChanged", { x: wx, y: wy, z: wz, id, meta, prevId });
    return true;
  }

  _dirtyNeighbor(wx: number, wz: number): void {
    const c = this.chunkAt(wx, wz);
    if (c && c.generated) c.dirty = true;
  }

  /** Высота поверхности (первый твёрдый блок сверху) — для спавна. */
  surfaceY(wx: number, wz: number): number {
    for (let y = SY - 1; y >= 0; y--)
      if (BLOCKS[this.getBlock(wx, y, wz)]!.solid) return y;
    return CONFIG.world.baseHeight;
  }

  // ---- стриминг ---------------------------------------------------------------

  /** Вызывается каждый кадр: догружает кольцо чанков, выгружает дальние. */
  update(px: number, pz: number): void {
    const pcx = Math.floor(px / SX),
      pcz = Math.floor(pz / SZ);
    const R = CONFIG.renderDistance;

    // заказать недостающие чанки (по спирали от игрока — ближние раньше)
    for (let r = 0; r <= R; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const k = key(pcx + dx, pcz + dz);
          if (!this.chunks.has(k)) {
            const chunk = new Chunk(pcx + dx, pcz + dz);
            this.chunks.set(k, chunk);
            this.genQueue.push(chunk);
          }
        }
      }
    }

    // генерация данных с бюджетом
    let gen = 0;
    while (this.genQueue.length && gen < CONFIG.genBudgetPerFrame) {
      const chunk = this.genQueue.shift()!;
      // Успел выгрузиться. Если на его месте уже новый чанк — генерировать надо тот, а этот сирота.
      if (this.chunks.get(key(chunk.cx, chunk.cz)) !== chunk) continue;
      this.generator.generate(chunk);
      const diff = this.pendingDiffs.get(key(chunk.cx, chunk.cz));
      if (diff) {
        chunk.applyDiff(diff);
        this.pendingDiffs.delete(key(chunk.cx, chunk.cz));
        // восстановить onTick-реестр из дифа
        for (const [i, [id]] of chunk.modified)
          if (BLOCKS[id]?.onTick) {
            const x = chunk.cx * SX + (i & 15),
              y = i >> 8,
              z = chunk.cz * SZ + ((i >> 4) & 15);
            this.tickingBlocks.set(x + "," + y + "," + z, { x, y, z });
          }
      }
      chunk.recomputeTop();
      this.lighting.initChunk(chunk); // заливка света + обмен с освещёнными соседями
      chunk.dirty = true;
      // сосед уже отрисован с «глухой» границей — пере-дертить
      this._dirtyNeighbor((chunk.cx - 1) * SX, chunk.cz * SZ);
      this._dirtyNeighbor((chunk.cx + 1) * SX + 1, chunk.cz * SZ);
      this._dirtyNeighbor(chunk.cx * SX, (chunk.cz - 1) * SZ);
      this._dirtyNeighbor(chunk.cx * SX, (chunk.cz + 1) * SZ + 1);
      gen++;
    }

    // выгрузка дальних
    for (const [k, chunk] of this.chunks) {
      if (
        Math.max(Math.abs(chunk.cx - pcx), Math.abs(chunk.cz - pcz)) >
        CONFIG.unloadDistance
      ) {
        this._disposeChunk(chunk);
        this.chunks.delete(k);
        this.lighting.forget();
        if (chunk.modified.size) this.pendingDiffs.set(k, chunk.modified);
      }
    }

    // пересборка мешей: ближние к игроку — приоритетнее
    const dirty: Chunk[] = [];
    for (const chunk of this.chunks.values()) {
      if (!chunk.generated) continue;
      if (chunk.dirty || chunk.waterDirty) dirty.push(chunk);
    }
    dirty.sort(
      (a, b) =>
        Math.abs(a.cx - pcx) +
        Math.abs(a.cz - pcz) -
        (Math.abs(b.cx - pcx) + Math.abs(b.cz - pcz)),
    );
    for (
      let i = 0;
      i < Math.min(dirty.length, CONFIG.meshBudgetPerFrame);
      i++
    ) {
      const chunk = dirty[i]!;
      this.mesher.rebuild(chunk, this.scene, !chunk.dirty && chunk.waterDirty);
    }
  }

  _disposeChunk(chunk: Chunk): void {
    for (const m of [chunk.solidMesh, chunk.foliageMesh, chunk.waterMesh]) {
      if (m) {
        this.scene.remove(m);
        m.geometry.dispose();
      }
    }
    chunk.solidMesh = chunk.foliageMesh = chunk.waterMesh = null;
  }

  /** Симтик мира: onTick-блоки, запланированные тики, случайные тики. */
  tick(): void {
    this.tickN++;
    for (const { x, y, z } of this.tickingBlocks.values()) {
      const def = BLOCKS[this.getBlock(x, y, z)];
      def?.onTick?.(this, x, y, z, this.getMeta(x, y, z));
    }
    if (this.scheduled.size) {
      const due: { x: number; y: number; z: number }[] = [];
      for (const [k, s] of this.scheduled)
        if (s.due <= this.tickN) {
          due.push(s);
          this.scheduled.delete(k);
        }
      for (const s of due) this.runTick(s.x, s.y, s.z, "scheduledTick");
    }
    this.randomTicks();
  }

  /** Полная очистка (регенерация по новому сиду / импорт сейва). */
  clear(): void {
    for (const chunk of this.chunks.values()) this._disposeChunk(chunk);
    this.chunks.clear();
    this.genQueue.length = 0;
    this.pendingDiffs.clear();
    this.tickingBlocks.clear();
    this.scheduled.clear();
    this.lighting.forget();
  }

  /** Сейв: дифы всех чанков (загруженных и отложенных). */
  serializeDiffs(): ChunkDiffMap {
    const out: ChunkDiffMap = {};
    for (const [k, diff] of this.pendingDiffs)
      out[k] = [...diff.entries()].map(
        ([i, [id, meta]]): [number, number, number] => [i, id, meta],
      );
    for (const [k, chunk] of this.chunks)
      if (chunk.modified.size) out[k] = chunk.serializeDiff();
    return out;
  }

  /**
   * Сетевая игра: изменение блока от владельца измерения. В загруженный чанк — как обычная правка
   * (меш, свет, события); в ещё не сгенерированный — в отложенные дифы, как у сейва: `setBlock` такую
   * правку молча выбросил бы, и чанк, догруженный позже, показал бы мир без неё.
   */
  applyRemoteBlock(
    wx: number,
    wy: number,
    wz: number,
    id: number,
    meta: number,
  ): void {
    if (wy < 0 || wy >= SY) return;
    const c = this.chunkAt(wx, wz);
    if (c?.generated) {
      this.setBlock(wx, wy, wz, id, meta);
      return;
    }
    const k = key(Math.floor(wx / SX), Math.floor(wz / SZ));
    let diff = this.pendingDiffs.get(k);
    if (!diff) this.pendingDiffs.set(k, (diff = new Map()));
    diff.set(idx(wx & 15, wy, wz & 15), [id, meta]);
  }

  /** Импорт сейва: дифы применятся к чанкам по мере генерации. */
  loadDiffs(obj: ChunkDiffMap): void {
    for (const [k, arr] of Object.entries(obj))
      this.pendingDiffs.set(
        k,
        new Map(
          arr.map(([i, id, meta]): [number, [number, number]] => [
            i,
            [id, meta],
          ]),
        ),
      );
  }
}
