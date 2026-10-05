// Изменённые блоки ВСЕХ измерений у каждого участника сетевой игры. Мир — это сид/рецепт плюс эти
// дифы, поэтому у кого они есть, тот может построить любое измерение сам: перейти через портал без
// ожидания, стать владельцем измерения или хостом, если прежний ушёл.
import { idx } from "../world/Chunk";
import type { DimensionId } from "../world/Dimensions";
import type { ChunkDiffMap } from "../types";
import type { BlockDelta } from "./protocol";

type ChunkDiff = Map<number, [number, number]>;

export class DiffStore {
  private readonly dims = new Map<DimensionId, Map<string, ChunkDiff>>();

  private dim(d: DimensionId): Map<string, ChunkDiff> {
    let m = this.dims.get(d);
    if (!m) this.dims.set(d, (m = new Map()));
    return m;
  }

  /** Заменить дифы измерения целиком (снимок мира, сейв). */
  load(d: DimensionId, diffs: ChunkDiffMap | undefined): void {
    const m = new Map<string, ChunkDiff>();
    for (const [k, arr] of Object.entries(diffs ?? {})) {
      if (!Array.isArray(arr)) continue;
      const cd: ChunkDiff = new Map();
      for (const e of arr)
        if (Array.isArray(e) && e.length === 3 && e.every(Number.isInteger))
          cd.set(e[0], [e[1], e[2]]);
      m.set(k, cd);
    }
    this.dims.set(d, m);
  }

  apply(
    d: DimensionId,
    x: number,
    y: number,
    z: number,
    id: number,
    meta: number,
  ): void {
    const k = Math.floor(x / 16) + "," + Math.floor(z / 16);
    const m = this.dim(d);
    let cd = m.get(k);
    if (!cd) m.set(k, (cd = new Map()));
    cd.set(idx(x & 15, y, z & 15), [id, meta]);
  }

  applyAll(d: DimensionId, list: readonly BlockDelta[]): void {
    for (const b of list) this.apply(d, b.x, b.y, b.z, b.id, b.meta);
  }

  toChunkDiffMap(d: DimensionId): ChunkDiffMap {
    const out: ChunkDiffMap = {};
    for (const [k, cd] of this.dims.get(d) ?? [])
      out[k] = [...cd].map(([i, [id, meta]]): [number, number, number] => [
        i,
        id,
        meta,
      ]);
    return out;
  }

  /** Все измерения — для снимка мира гостю. */
  all(): Partial<Record<DimensionId, ChunkDiffMap>> {
    const out: Partial<Record<DimensionId, ChunkDiffMap>> = {};
    for (const d of this.dims.keys()) out[d] = this.toChunkDiffMap(d);
    return out;
  }

  /** Сколько изменённых блоков в измерении (для отладки и тестов). */
  count(d: DimensionId): number {
    let n = 0;
    for (const cd of this.dims.get(d)?.values() ?? []) n += cd.size;
    return n;
  }
}
