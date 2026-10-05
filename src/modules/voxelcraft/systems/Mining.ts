// Добыча блоков по правилам Minecraft: сколько секунд ломать и выпадет ли что-нибудь.
// Чистые функции без мира — ими пользуются Interaction (игрок) и тесты.
import type { BlockDef, ItemDef } from "../types";
import { SLAB_DOUBLE, TOP } from "../registry/meta";

/**
 * Что выпадает из блока с этой метой: null в описании = сам блок (или его предмет), [] = ничего,
 * chance — вероятность. Вторая половина двери и кровати пуста (дроп — с первой), двойная плита — две.
 */
export function dropsOf(
  def: BlockDef,
  meta: number,
  rng: () => number = Math.random,
): { item: string; n: number }[] {
  if ((def.shape === "door" || def.shape === "bed") && meta & TOP) return [];
  // недозревший посев (стадия < 7) — только то, чем сажали; спелый — урожай из описания
  if (def.shape === "crop" && (meta & 7) < 7)
    return [{ item: def.item ?? def.name, n: 1 }];
  // стручок какао: спелый (возраст 2 в битах 2..3) — 2–3 боба, иначе один
  if (def.shape === "pod")
    return [
      {
        item: def.item ?? def.name,
        n: ((meta >> 2) & 3) >= 2 ? 2 + (rng() < 0.5 ? 1 : 0) : 1,
      },
    ];
  const list = def.drops ?? [{ item: def.item ?? def.name, n: 1 }];
  const k = def.shape === "slab" && (meta & 3) === SLAB_DOUBLE ? 2 : 1;
  return list
    .filter((d) => d.chance === undefined || rng() <= d.chance)
    .map((d) => ({
      item: d.item,
      n: (d.max ? d.n + Math.floor(rng() * (d.max - d.n + 1)) : d.n) * k,
    }));
}

/** Подходит ли инструмент в руке к блоку (кирка к камню, топор к дереву…). */
export function toolMatches(def: BlockDef, held: ItemDef | null): boolean {
  return !!held && !!def.tool && held.toolType === def.tool;
}

/** Выпадет ли дроп: блоку без уровня добычи — всегда, иначе нужен свой инструмент нужного уровня. */
export function canHarvest(def: BlockDef, held: ItemDef | null): boolean {
  if (def.harvest <= 0) return true;
  return toolMatches(def, held) && held!.tier >= def.harvest;
}

/**
 * Секунды ломания: hardness × 1.5 (добывается) или × 5 (не добывается), делённое на скорость
 * подходящего инструмента. 0 — мгновенно, Infinity — неломаемый.
 */
export function breakSeconds(
  def: BlockDef,
  held: ItemDef | null,
  efficiency = 0,
): number {
  if (!Number.isFinite(def.hardness)) return Infinity;
  if (def.hardness <= 0) return 0;
  // Эффективность: к скорости своего инструмента + (уровень² + 1), как в Minecraft
  const speed = toolMatches(def, held)
    ? held!.speed + (efficiency > 0 ? efficiency * efficiency + 1 : 0)
    : 1;
  return (def.hardness * (canHarvest(def, held) ? 1.5 : 5)) / speed;
}
