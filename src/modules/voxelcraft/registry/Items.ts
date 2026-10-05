// Реестр предметов. Каждому блоку без флага noItem автоматически создаётся предмет-двойник
// (blockId), остальное — описания в registry/items/*.ts.
//
// Поля (подробно — ItemDef в types.ts):
//   maxStack — размер стака (инструменты не стакаются)
//   kind     — 'block' | 'material' | 'tool' | 'armor'
//   toolType/tier/speed — тип и уровень инструмента, множитель скорости добычи
//   damage   — урон по сущностям (1 — «кулак»)
//   durability — прочность; fuel — секунды горения в печи
//   tile     — тайл атласа для плоской иконки (у не-блоков)
import { BLOCKS, B } from "./Blocks";
import { BASIC_ITEMS } from "./items/basic";
import { MATERIAL_ITEMS } from "./items/materials";
import { ARMOR_ITEMS, TOOL_ITEMS } from "./items/tools";
import { MOB_ITEMS } from "./items/mobdrops";
import { UTILITY_ITEMS } from "./items/utility";
import { FARMING_ITEMS } from "./items/farming";
import { INFERNO_ITEMS } from "./items/inferno";
import { BEYOND_ITEMS } from "./items/beyond";
import { BREWING_ITEMS } from "./items/brewing";
import { DYE_ITEMS, TRANSPORT_ITEMS } from "./items/dyes";
import { OUTDOOR_ITEMS } from "./items/outdoor";
import { BOSS_ITEMS } from "./items/boss";
import { CITY_ITEMS } from "./items/city";
import { OCEAN_ITEMS } from "./items/ocean";
import { SEA_LIFE_ITEMS } from "./items/sealife";
import { ILLAGER_ITEMS } from "./items/illager";
import { TREASURE_ITEMS } from "./items/treasure";
import { MANSION_ITEMS } from "./items/mansion";
import { CAVE_ITEMS } from "./items/caves";
import { SCULK_ITEMS } from "./items/sculk";
import { GOAT_ITEMS } from "./items/goat";
import { MOUNTAIN_ITEMS } from "./items/mountain";
import { ARCHAEOLOGY_ITEMS } from "./items/archaeology";
import { FROG_ITEMS } from "./items/frog";
import { SNIFFER_ITEMS } from "./items/sniffer";
import { TRIAL_ITEMS } from "./items/trial";
import { TRIM_ITEMS } from "./items/trims";
import { DECOR_ITEMS } from "./items/decor";
import { FROST_ITEMS } from "./items/frost";
import { MUSHROOM_ITEMS } from "./items/mushroom";
import { COCOA_ITEMS } from "./items/cocoa";
import { ARMADILLO_ITEMS } from "./items/armadillo";
import { LEAD_ITEMS } from "./items/lead";
import { SHIELD_ITEMS } from "./items/shield";
import { RANGED_ITEMS } from "./items/ranged";
import { CURE_ITEMS } from "./items/cure";
import { SOUND_ITEMS } from "./items/sound";
import { BOOK_ITEMS } from "./items/book";
import { POTION_ITEMS } from "./items/potions";
import { TIPPED_ITEMS } from "./items/tipped";
import { NAMETAG_ITEMS } from "./items/nametag";
import { item } from "./items/define";
import type { BlockDef, ItemDef } from "../types";
import type { TextureAtlas } from "../gfx/TextureAtlas";

export { item } from "./items/define";

const PARTS: readonly (readonly ItemDef[])[] = [
  BASIC_ITEMS,
  MATERIAL_ITEMS,
  TOOL_ITEMS,
  ARMOR_ITEMS,
  MOB_ITEMS,
  UTILITY_ITEMS,
  FARMING_ITEMS,
  INFERNO_ITEMS,
  BEYOND_ITEMS,
  BREWING_ITEMS,
  DYE_ITEMS,
  TRANSPORT_ITEMS,
  OUTDOOR_ITEMS,
  BOSS_ITEMS,
  CITY_ITEMS,
  OCEAN_ITEMS,
  SEA_LIFE_ITEMS,
  ILLAGER_ITEMS,
  TREASURE_ITEMS,
  MANSION_ITEMS,
  CAVE_ITEMS,
  SCULK_ITEMS,
  GOAT_ITEMS,
  MOUNTAIN_ITEMS,
  ARCHAEOLOGY_ITEMS,
  FROG_ITEMS,
  SNIFFER_ITEMS,
  TRIAL_ITEMS,
  TRIM_ITEMS,
  DECOR_ITEMS,
  FROST_ITEMS,
  MUSHROOM_ITEMS,
  COCOA_ITEMS,
  ARMADILLO_ITEMS,
  LEAD_ITEMS,
  SHIELD_ITEMS,
  RANGED_ITEMS,
  CURE_ITEMS,
  SOUND_ITEMS,
  BOOK_ITEMS,
  POTION_ITEMS,
  TIPPED_ITEMS,
  NAMETAG_ITEMS,
];

/** Блоки-топливо сверх общего правила (угольный блок — 800 с). */
const BLOCK_FUEL: Record<string, number> = {
  coal_block: 800,
  dried_kelp_block: 200,
};

/** Секунды горения блока-предмета в печи (как в Minecraft: дерево 15, шерсть 5). */
function blockFuel(b: BlockDef): number {
  if (BLOCK_FUEL[b.name]) return BLOCK_FUEL[b.name]!;
  if (b.name.endsWith("_wool")) return 5;
  if (b.flammable && b.tool === "axe") return 15;
  return 0;
}

export const ITEMS: Record<string, ItemDef> = {};

for (const b of BLOCKS)
  if (!b.noItem)
    ITEMS[b.name] = item({
      name: b.name,
      kind: "block",
      blockId: b.id,
      fuel: blockFuel(b),
    });

for (const part of PARTS)
  for (const it of part) {
    if (ITEMS[it.name])
      throw new Error(`item ${it.name} зарегистрирован дважды`);
    ITEMS[it.name] = it;
  }

// красная пыль ставится проводом (сам предмет — материал из руды, описан в items/materials)
if (ITEMS.redstone && B.redstone_wire !== undefined)
  ITEMS.redstone.blockId = B.redstone_wire;
// панцирный сундук носит вещи в tag — такие стаки не складываются
if (ITEMS.shell_chest) ITEMS.shell_chest.maxStack = 1;

/**
 * Генерация иконок для HUD/инвентаря из тех же текстур атласа.
 * Вызывается один раз из main.ts после создания атласа.
 */
/** Формы, у которых иконка плоская (тайл), а не изометрический кубик. */
const FLAT_ICON: ReadonlySet<string> = new Set([
  "cross",
  "torch",
  "ladder",
  "door",
  "trapdoor",
  "pane",
  "crop",
  "fire",
  "portal",
  "lantern",
  "lever",
  "button",
  "hopper",
  "rail",
  "rod",
  "candle",
]);

export function buildIcons(atlas: TextureAtlas): void {
  for (const it of Object.values(ITEMS)) {
    if (it.kind === "block") {
      const b = BLOCKS[it.blockId!]!;
      const tex = b.tex!;
      const side = tex.side ?? tex.top!;
      it.icon = FLAT_ICON.has(b.shape)
        ? atlas.flatIcon(tex.icon ?? side)
        : atlas.blockIcon(tex.top ?? side, side);
    } else {
      it.icon = atlas.flatIcon(it.tile!);
    }
    it.iconURL = it.icon.toDataURL();
  }
}
