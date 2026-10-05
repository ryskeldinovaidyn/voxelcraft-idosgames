// Конструкторы описаний предметов: материал по умолчанию, инструменты и броня по таблице уровней.
import type { ItemDef, ToolType } from "../../types";

// food — очки восстановления голода; saturation — буфер сытости
export function item(def: Partial<ItemDef> & { name: string }): ItemDef {
  return {
    maxStack: 64,
    kind: "material",
    toolType: null,
    speed: 1,
    damage: 1,
    blockId: null,
    tile: null,
    food: 0,
    saturation: 0,
    tier: 0,
    durability: 0,
    armorSlot: null,
    armor: 0,
    toughness: 0,
    fuel: 0,
    remainder: null,
    ...def,
  };
}

/**
 * Уровни материалов инструментов — как в Minecraft: уровень добычи, множитель скорости, прочность.
 * bonus — прибавка к урону (урон по образцу Bedrock: там нет кулдауна удара, как и у нас).
 */
export const TIERS = {
  wooden: { tier: 1, speed: 2, durability: 59, bonus: 0 },
  stone: { tier: 2, speed: 4, durability: 131, bonus: 1 },
  iron: { tier: 3, speed: 6, durability: 250, bonus: 2 },
  golden: { tier: 1, speed: 12, durability: 32, bonus: 0 },
  diamond: { tier: 4, speed: 8, durability: 1561, bonus: 3 },
  /** Пеклит — свой металл Пекла (вместо «незерита»): улучшение алмазного на кузнечном столе. */
  infernite: { tier: 5, speed: 9, durability: 2031, bonus: 4 },
} as const;

export type ToolMaterial = keyof typeof TIERS;

/** Базовый урон по типу инструмента (+ bonus материала). */
const BASE_DAMAGE: Partial<Record<ToolType, number>> = {
  sword: 5,
  axe: 4,
  pickaxe: 3,
  shovel: 2,
  hoe: 1,
};

/** Инструмент `{material}_{type}`: деревянные ещё и топливо (10 с, как в Minecraft). */
export function tool(
  material: ToolMaterial,
  type: ToolType,
  extra: Partial<ItemDef> = {},
): ItemDef {
  const t = TIERS[material];
  const name = `${material}_${type}`;
  return item({
    name,
    kind: "tool",
    toolType: type,
    tier: t.tier,
    speed: type === "sword" || type === "hoe" ? 1 : t.speed,
    durability: t.durability,
    damage: type === "hoe" ? 1 : (BASE_DAMAGE[type] ?? 1) + t.bonus,
    maxStack: 1,
    tile: name,
    fuel: material === "wooden" ? 10 : 0,
    ...extra,
  });
}
