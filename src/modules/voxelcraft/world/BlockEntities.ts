// Блочные сущности: у клетки своё состояние — содержимое сундука, топливо и плавка печи, око в
// рамке портала. Создаются, когда в клетку ставят блок с `blockEntity`, и исчезают вместе с ним
// (содержимое выпадает). Тикают на симтике, сохраняются в сейве по измерениям.
import { events } from "../core/EventBus";
import { BLOCKS } from "../registry/Blocks";
import { sim } from "../net/sim";
import type { ItemStack } from "../types";
import type { ChunkManager } from "./ChunkManager";
import type { DropSink } from "../systems/BlockUpdates";

/** Состояние — только JSON-совместимые данные: оно целиком уходит в сейв. */
export type BlockEntityState = Record<string, unknown>;

export interface BlockEntity {
  type: string;
  x: number;
  y: number;
  z: number;
  state: BlockEntityState;
}

export interface BlockEntityCtx {
  world: ChunkManager;
  be: BlockEntity;
  dt: number;
  /** Блочная сущность соседней клетки (воронка кладёт в сундук под собой). */
  at?(x: number, y: number, z: number): BlockEntity | undefined;
  /** Сущности мира: дроп, стрелы (воронка, раздатчик). */
  sink?: DropSink;
}

export interface BlockEntityType {
  create(): BlockEntityState;
  tick?(c: BlockEntityCtx): void;
  /** Что выпадает при разрушении блока (содержимое инвентаря). */
  contents?(state: BlockEntityState): readonly (ItemStack | null)[];
  /** Что выпадает вместо содержимого — сам блок с вещами в tag (панцирный сундук). */
  keep?(state: BlockEntityState): ItemStack | null;
  /**
   * События мира про клетку ({x, y, z, …}): пчела влетела в улей, генератор завёл пчёл в гнезде.
   * Сущности ещё нет, а блок её требует (поставлен генератором) — она создаётся (ensure).
   */
  on?: Record<
    string,
    (be: BlockEntity, payload: Record<string, unknown>) => void
  >;
}

const TYPES = new Map<string, BlockEntityType>();

export function registerBlockEntity(type: string, def: BlockEntityType): void {
  TYPES.set(type, def);
}

const key = (x: number, y: number, z: number): string => x + "," + y + "," + z;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export class BlockEntities {
  readonly map = new Map<string, BlockEntity>();

  constructor(
    private readonly world: () => ChunkManager,
    private readonly drops: DropSink,
  ) {
    events.on(
      "blockChanged",
      (d: { x: number; y: number; z: number; id: number; prevId: number }) =>
        this.onChanged(d.x, d.y, d.z, d.prevId, d.id),
    );
    for (const [type, def] of TYPES)
      for (const [ev, fn] of Object.entries(def.on ?? {}))
        events.on(ev, (p: { x: number; y: number; z: number }) => {
          const be = this.ensure(p.x, p.y, p.z);
          if (be?.type === type)
            fn(be, p as unknown as Record<string, unknown>);
        });
  }

  get(x: number, y: number, z: number): BlockEntity | undefined {
    return this.map.get(key(x, y, z));
  }

  /** Сущность клетки; нет, а блок её требует (поставлен генератором), — создать. */
  ensure(x: number, y: number, z: number): BlockEntity | undefined {
    const k = key(x, y, z);
    const cur = this.map.get(k);
    if (cur) return cur;
    const type = BLOCKS[this.world().getBlock(x, y, z)]?.blockEntity;
    if (!type) return undefined;
    const be = this.fresh(type, x, y, z);
    this.map.set(k, be);
    return be;
  }

  /** Сущность блока, поставленного генератором: сундук постройки получает её добычу (lootAt). */
  private fresh(type: string, x: number, y: number, z: number): BlockEntity {
    const state = TYPES.get(type)?.create() ?? {};
    const loot = this.world().generator?.lootAt?.(x, y, z);
    if (loot && Array.isArray(state.items))
      state.items = loot.map((s) => (s ? { ...s } : null));
    return { type, x, y, z, state };
  }

  private onChanged(
    x: number,
    y: number,
    z: number,
    prevId: number,
    id: number,
  ): void {
    const was = BLOCKS[prevId]?.blockEntity ?? null;
    const now = BLOCKS[id]?.blockEntity ?? null;
    if (was === now) return; // тот же тип (печь загорелась — сменилась лишь мета): состояние живёт
    const k = key(x, y, z);
    // нетронутый сундук генератора сущности не имеет — ломая его, получаем его добычу
    const old = this.map.get(k) ?? (was ? this.fresh(was, x, y, z) : undefined);
    // Реплика (net/sim) содержимое не выбрасывает: это сделает владелец измерения, применив ту же
    // правку, — иначе сундук высыпался бы дважды.
    if (old && !sim.authority) this.map.delete(k);
    else if (old) {
      this.map.delete(k);
      for (const s of TYPES.get(old.type)?.contents?.(old.state) ?? [])
        if (s)
          this.drops.spawnDrop(
            x + 0.5,
            y + 0.5,
            z + 0.5,
            s.item,
            s.count,
            s.dmg,
            s.tag,
          );
      const kept = TYPES.get(old.type)?.keep?.(old.state);
      if (kept)
        this.drops.spawnDrop(
          x + 0.5,
          y + 0.5,
          z + 0.5,
          kept.item,
          kept.count,
          kept.dmg,
          kept.tag,
        );
    }
    if (now)
      this.map.set(k, {
        type: now,
        x,
        y,
        z,
        state: TYPES.get(now)?.create() ?? {},
      });
  }

  tick(dt: number): void {
    const world = this.world();
    const at = (x: number, y: number, z: number) => this.get(x, y, z);
    for (const be of this.map.values())
      TYPES.get(be.type)?.tick?.({ world, be, dt, at, sink: this.drops });
  }

  clear(): void {
    this.map.clear();
  }

  /**
   * Сетевая игра: состояние клетки от владельца измерения (или правка реплики у владельца). null —
   * сущности в клетке больше нет. Меняется только состояние: события и дроп — дело того, кто считает.
   */
  applyRemote(x: number, y: number, z: number, be: BlockEntity | null): void {
    const k = key(x, y, z);
    if (!be) {
      this.map.delete(k);
      return;
    }
    if (!isObj(be.state) || typeof be.type !== "string") return;
    this.map.set(k, { type: be.type, x, y, z, state: be.state });
  }

  serialize(): BlockEntity[] {
    return [...this.map.values()].map((b) => ({ ...b }));
  }

  deserialize(list: unknown): void {
    this.clear();
    if (!Array.isArray(list)) return;
    for (const b of list) {
      if (!isObj(b) || typeof b.type !== "string" || !isObj(b.state)) continue;
      const x = Number(b.x),
        y = Number(b.y),
        z = Number(b.z);
      if (![x, y, z].every(Number.isFinite)) continue;
      this.map.set(key(x, y, z), { type: b.type, x, y, z, state: b.state });
    }
  }
}
