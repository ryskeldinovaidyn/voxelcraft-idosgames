// Предметы между блоками, как в Minecraft (воронка, выбрасыватель): куда класть и откуда брать по
// одному зависит от стороны. Сундук, воронка и раздатчик — любой слот; печь сверху — вход, сбоку —
// топливо, снизу отдаёт выход; варочная стойка сверху — ингредиент, сбоку — порошок и пузырьки,
// снизу отдаёт зелья.
import { ITEMS } from "../registry/Items";
import { DISCS } from "../systems/Disc";
import { smeltResult } from "../registry/recipes/smelting";
import type { ItemStack } from "../types";
import type { BlockEntity } from "./BlockEntities";
import type { FurnaceState } from "./blockentities/furnace";
import type { BrewingState } from "./blockentities/brewing";

interface Slot {
  get(): ItemStack | null;
  set(s: ItemStack | null): void;
  accepts(s: ItemStack): boolean;
}

/** Откуда пришёл предмет: сверху (воронка над блоком) или сбоку. */
export type Side = "top" | "side";

const field = <T extends object>(
  o: T,
  k: keyof T,
  accepts: (s: ItemStack) => boolean = () => true,
): Slot => ({
  get: () => (o[k] as ItemStack | null) ?? null,
  set: (s) => ((o[k] as ItemStack | null) = s),
  accepts,
});

const arraySlots = (items: (ItemStack | null)[]): Slot[] =>
  items.map((_, i) => ({
    get: () => items[i] ?? null,
    set: (s) => (items[i] = s),
    accepts: () => true,
  }));

const hasItems = (st: unknown): st is { items: (ItemStack | null)[] } =>
  !!st && Array.isArray((st as { items?: unknown }).items);

function inputSlots(be: BlockEntity, side: Side): Slot[] {
  if (be.type === "campfire") return []; // костёр — не контейнер: еду кладут руками

  if (be.type === "furnace") {
    const s = be.state as FurnaceState;
    return side === "top"
      ? [field(s, "input", (x) => !!smeltResult(x.item))]
      : [field(s, "fuel", (x) => (ITEMS[x.item]?.fuel ?? 0) > 0)];
  }
  if (be.type === "brewing") {
    const s = be.state as BrewingState;
    if (side === "top") return [field(s, "ingredient")];
    return [
      field(s, "fuel", (x) => x.item === "flame_powder"),
      ...s.bottles.map((_, i) => ({
        get: () => s.bottles[i] ?? null,
        set: (v: ItemStack | null) => (s.bottles[i] = v),
        accepts: (x: ItemStack) =>
          x.item.startsWith("potion_") || x.item === "glass_bottle",
      })),
    ];
  }
  return hasItems(be.state) ? arraySlots(be.state.items) : [];
}

function outputSlots(be: BlockEntity): Slot[] {
  if (be.type === "campfire") return [];
  if (be.type === "furnace") return [field(be.state as FurnaceState, "output")];
  if (be.type === "brewing") {
    const s = be.state as BrewingState;
    return s.bottles.map((_, i) => ({
      get: () => s.bottles[i] ?? null,
      set: (v: ItemStack | null) => (s.bottles[i] = v),
      accepts: () => true,
    }));
  }
  return hasItems(be.state) ? arraySlots(be.state.items) : [];
}

/**
 * Заполненность контейнера для компаратора, как в Minecraft: 0 — пусто, иначе
 * 1 + ⌊доля заполнения × 14⌋ (доля — сумма count/maxStack по слотам, делённая на число слотов).
 */
export function fillLevel(be: BlockEntity): number {
  // проигрыватель — номер пластинки, рамка — поворот предмета: как в Minecraft, не заполненность
  if (be.type === "jukebox") {
    const item = (be.state as { items: (ItemStack | null)[] }).items[0]?.item;
    const i = DISCS.findIndex((d) => d.name === item);
    return i < 0 ? 0 : i + 1;
  }
  if (be.type === "display") {
    const s = be.state as { items: (ItemStack | null)[]; rot?: number };
    return s.items[0] ? (s.rot ?? 0) + 1 : 0;
  }
  let slots: (ItemStack | null)[];
  if (be.type === "furnace") {
    const s = be.state as FurnaceState;
    slots = [s.input, s.fuel, s.output];
  } else if (be.type === "brewing") {
    const s = be.state as BrewingState;
    slots = [s.ingredient, s.fuel, ...s.bottles];
  } else if (hasItems(be.state)) slots = be.state.items;
  else return 0;
  let sum = 0;
  for (const s of slots)
    if (s) sum += s.count / (ITEMS[s.item]?.maxStack ?? 64);
  return sum > 0 ? Math.floor(1 + (sum / slots.length) * 14) : 0;
}

const stacksWith = (a: ItemStack, b: ItemStack): boolean =>
  a.item === b.item &&
  !a.dmg &&
  !b.dmg &&
  !a.tag &&
  !b.tag &&
  a.count < (ITEMS[a.item]?.maxStack ?? 64);

/** Положить один предмет стака `s` в блок; false — некуда. Стак `s` не меняется. */
export function insertOne(be: BlockEntity, s: ItemStack, side: Side): boolean {
  const slots = inputSlots(be, side).filter((x) => x.accepts(s));
  for (const slot of slots) {
    const cur = slot.get();
    if (cur && stacksWith(cur, s)) {
      cur.count += 1;
      slot.set(cur);
      return true;
    }
  }
  for (const slot of slots)
    if (!slot.get()) {
      slot.set({ ...s, count: 1 });
      return true;
    }
  return false;
}

/** Взять один предмет из блока — если `into` его принял. */
export function extractOne(
  be: BlockEntity,
  into: (s: ItemStack) => boolean,
): boolean {
  for (const slot of outputSlots(be)) {
    const cur = slot.get();
    if (!cur || cur.count <= 0) continue;
    if (!into({ ...cur, count: 1 })) continue;
    cur.count -= 1;
    slot.set(cur.count > 0 ? cur : null);
    return true;
  }
  return false;
}
