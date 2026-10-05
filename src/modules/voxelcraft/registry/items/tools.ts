// Инструменты всех уровней и броня — таблицами, как в Minecraft. Деревянные кирка, топор и меч
// описаны в basic.ts (они были до сейва v3 и рисуются прежними тайлами).
import type { ArmorSlot, ItemDef, ToolType } from "../../types";
import { item, tool, type ToolMaterial } from "./define";

const TOOL_TYPES: readonly ToolType[] = [
  "pickaxe",
  "axe",
  "shovel",
  "hoe",
  "sword",
];
const TOOL_MATERIALS: readonly ToolMaterial[] = [
  "wooden",
  "stone",
  "iron",
  "golden",
  "diamond",
  "infernite",
];

export const TOOL_ITEMS: ItemDef[] = [];
for (const m of TOOL_MATERIALS)
  for (const t of TOOL_TYPES) {
    if (m === "wooden" && (t === "pickaxe" || t === "axe" || t === "sword"))
      continue;
    TOOL_ITEMS.push(tool(m, t));
  }

/**
 * Броня Minecraft: очки защиты по слотам (шлем, нагрудник, поножи, ботинки), твёрдость и множитель
 * прочности материала (прочность = множитель × база слота 11/16/15/13).
 */
const ARMOR = {
  leather: { points: [1, 3, 2, 1], toughness: 0, k: 5 },
  chainmail: { points: [2, 5, 4, 1], toughness: 0, k: 15 },
  iron: { points: [2, 6, 5, 2], toughness: 0, k: 15 },
  golden: { points: [2, 5, 3, 1], toughness: 0, k: 7 },
  diamond: { points: [3, 8, 6, 3], toughness: 2, k: 33 },
  infernite: { points: [3, 8, 6, 3], toughness: 3, k: 37 },
} as const;

export type ArmorMaterial = keyof typeof ARMOR;

export const ARMOR_PIECES: readonly [ArmorSlot, string, number][] = [
  ["head", "helmet", 11],
  ["chest", "chestplate", 16],
  ["legs", "leggings", 15],
  ["feet", "boots", 13],
];

export const ARMOR_ITEMS: ItemDef[] = [];
for (const [m, a] of Object.entries(ARMOR) as [
  ArmorMaterial,
  (typeof ARMOR)[ArmorMaterial],
][])
  ARMOR_PIECES.forEach(([slot, piece, base], i) => {
    const name = `${m}_${piece}`;
    ARMOR_ITEMS.push(
      item({
        name,
        kind: "armor",
        armorSlot: slot,
        armor: a.points[i]!,
        toughness: a.toughness,
        durability: base * a.k,
        maxStack: 1,
        tile: name,
      }),
    );
  });
