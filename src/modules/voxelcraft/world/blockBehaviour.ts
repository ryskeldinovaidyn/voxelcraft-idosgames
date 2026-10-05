// Поведение блоков по ПКМ (и другие хуки) — отдельно от данных реестра, чтобы описания блоков
// оставались чистыми данными. Реализации регистрируются в world/behaviours/*.ts.
import { BLOCKS, B } from "../registry/Blocks";
import type { BlockDef } from "../types";
import type { ChunkManager } from "./ChunkManager";

export interface UseCtx {
  world: ChunkManager;
  x: number;
  y: number;
  z: number;
  id: number;
  meta: number;
  /** ПКМ игрока: что в руке, потратить один, износить (в креативе — ничего). Нет у тиков. */
  held?: string | null;
  consume?(): void;
  wear?(n?: number): void;
  /** Уронить предмет у блока (ягоды с лозы). Нет у тиков. */
  drop?(item: string, n?: number): void;
  /** Отдать предмет в руку взамен одного из стака (котёл: ведро воды → ведро); в креативе — ничего. */
  give?(item: string): void;
}

/** Контекст тиков и обновлений блока. */
export interface TickCtx extends UseCtx {
  rng: () => number;
}

export interface Behaviour {
  /** ПКМ по блоку. true — действие состоялось (блок из руки не ставится). */
  use?(c: UseCtx): boolean;
  /** Случайный тик (рост посевов, трава, таяние) — CONFIG.randomTickSpeed на секцию 16³ за тик. */
  randomTick?(c: TickCtx): void;
  /** Тик, заказанный через ChunkManager.scheduleTick (падение песка, течение). */
  scheduledTick?(c: TickCtx): void;
  /** Сосед или сам блок изменился (systems/BlockUpdates). */
  neighborChanged?(c: TickCtx): void;
}

/** id блока → поведение. */
export const BEHAVIOURS = new Map<number, Behaviour>();

export function behave(name: string, b: Behaviour): void {
  const id = B[name];
  if (id === undefined) throw new Error("behave: нет блока " + name);
  BEHAVIOURS.set(id, { ...BEHAVIOURS.get(id), ...b });
}

/** Одно поведение на все блоки, подходящие под условие (все двери, все люки). */
export function behaveWhere(
  pred: (def: BlockDef) => boolean,
  b: Behaviour,
): void {
  for (const d of BLOCKS)
    if (pred(d)) BEHAVIOURS.set(d.id, { ...BEHAVIOURS.get(d.id), ...b });
}
