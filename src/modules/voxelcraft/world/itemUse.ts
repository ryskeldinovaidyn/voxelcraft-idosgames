// ПКМ предметом по блоку, когда действие принадлежит предмету, а не блоку: мотыга вспахивает,
// костная мука удобряет. Регистрация — в world/behaviours/*.ts (как и поведения блоков); Interaction
// спрашивает itemUseFor() и зовёт хук на тике с тем же контекстом, что игрок, агент и тесты.
import { ITEMS } from "../registry/Items";
import type { ToolType } from "../types";
import type { ChunkManager } from "./ChunkManager";

export interface ItemUseCtx {
  world: ChunkManager;
  /** Блок, по которому кликнули, и грань клика. */
  x: number;
  y: number;
  z: number;
  id: number;
  meta: number;
  nx: number;
  ny: number;
  nz: number;
  /** Предмет в руке. */
  item: string;
  rng: () => number;
  /** Потратить один предмет (в креативе — ничего). */
  consume(): void;
  /** Износ инструмента на n (в креативе — ничего). */
  wear(n?: number): void;
  /** Отдать предмет в руку взамен одного из стака (пузырёк воды → пустой; в креативе — ничего). */
  give?(item: string): void;
}

/** true — действие состоялось. */
export type ItemUse = (c: ItemUseCtx) => boolean;

const BY_ITEM = new Map<string, ItemUse>();
const BY_TOOL = new Map<ToolType, ItemUse>();

/** Действие конкретного предмета (костная мука). */
export function useItem(name: string, fn: ItemUse): void {
  BY_ITEM.set(name, fn);
}

/** Действие всех инструментов типа (мотыги любого материала). */
export function useTool(type: ToolType, fn: ItemUse): void {
  BY_TOOL.set(type, fn);
}

export function itemUseFor(item: string): ItemUse | undefined {
  const own = BY_ITEM.get(item);
  if (own) return own;
  const type = ITEMS[item]?.toolType;
  return type ? BY_TOOL.get(type) : undefined;
}
