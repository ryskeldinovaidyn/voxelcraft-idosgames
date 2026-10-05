// Реестр блоков — data-driven. Описания живут в registry/blocks/*.ts по темам; этот файл собирает
// их в один массив и раздаёт id. Добавить блок = добавить запись в часть (+ painter тайла в
// TextureAtlas, если нужна новая текстура).
//
// Поля (подробно — BlockDef в types.ts):
//   solid/opaque/shape — коллизия, непрозрачность, форма коробок
//   hardness/tool/harvest — время ломания по шкале Minecraft и уровень добычи
//   drops    — что выпадает: [{item, n}] | null = сам блок | [] = ничего
//   tex      — тайлы атласа {top, side, bottom, front?, upper?, on?}
//   mapColor — репрезентативный цвет: подбор блока по пикселю картинки и миникарта
//   light/filter — свечение и сколько света гасит
//
// ⚠ id — часть формата сейва. Первые 46 (blocks/legacy.ts) закреплены навсегда: сейвы v1/v2 хранят
// id без палитры. Новые части ТОЛЬКО дописываются в конец PARTS; у сейва v3 есть палитра id→имя,
// поэтому его дифы переживают и смену порядка, но старые сейвы — нет.

import type { BlockDef } from "../types";
import { LEGACY_BLOCKS } from "./blocks/legacy";
import { BUILDING_BLOCKS } from "./blocks/building";
import { NATURAL_BLOCKS } from "./blocks/natural";
import { ORE_BLOCKS } from "./blocks/ores";
import { FUNCTIONAL_BLOCKS } from "./blocks/functional";
import { FARMING_BLOCKS } from "./blocks/farming";
import { INFERNO_BLOCKS } from "./blocks/inferno";
import { BEYOND_BLOCKS } from "./blocks/beyond";
import { BREWING_BLOCKS } from "./blocks/brewing";
import { ENCHANTING_BLOCKS } from "./blocks/enchanting";
import { REDSTONE_BLOCKS } from "./blocks/redstone";
import { LATE_WOOD_BLOCKS, WOOD_BLOCKS } from "./blocks/wood";
import { COLOR_BLOCKS } from "./blocks/colors";
import { MACHINE_BLOCKS } from "./blocks/machines";
import { INFESTED_BLOCKS } from "./blocks/infested";
import { BEE_BLOCKS } from "./blocks/bees";
import { BOSS_BLOCKS } from "./blocks/boss";
import { CITY_BLOCKS } from "./blocks/city";
import { OCEAN_BLOCKS } from "./blocks/ocean";
import { CAMP_BLOCKS } from "./blocks/camp";
import { SEA_LIFE_BLOCKS } from "./blocks/sealife";
import { TREASURE_BLOCKS } from "./blocks/treasure";
import { MANSION_BLOCKS } from "./blocks/mansion";
import { CAVE_BLOCKS } from "./blocks/caves";
import { SCULK_BLOCKS } from "./blocks/sculk";
import { DRIPSTONE_BLOCKS } from "./blocks/dripstone";
import { MOUNTAIN_BLOCKS } from "./blocks/mountain";
import { ARCHAEOLOGY_BLOCKS } from "./blocks/archaeology";
import { MANGROVE_BLOCKS } from "./blocks/mangrove";
import { SNIFFER_BLOCKS } from "./blocks/sniffer";
import { TRIAL_BLOCKS } from "./blocks/trial";
import { COPPER_BLOCKS } from "./blocks/copper";
import { DECOR_BLOCKS } from "./blocks/decor";
import { FROST_BLOCKS } from "./blocks/frost";
import { MUSHROOM_BLOCKS } from "./blocks/mushroom";
import { JUNGLE_BLOCKS } from "./blocks/jungle";
import { CRIMSON_BLOCKS } from "./blocks/crimson";
import { BASALT_BLOCKS } from "./blocks/basalt";
import { COCOA_BLOCKS } from "./blocks/cocoa";
import { CRAFTED_BLOCKS } from "./blocks/crafted";
import { SOUL_CAMP_BLOCKS } from "./blocks/soulcamp";
import { WORKSTATION_BLOCKS } from "./blocks/workstations";
import { STONECUTTER_BLOCKS } from "./blocks/stonecutter";
import { JOB_BLOCKS } from "./blocks/jobblocks";
import { SOUND_BLOCKS } from "./blocks/sound";
import { HALL_BLOCKS } from "./blocks/hall";
import { DISPLAY_BLOCKS } from "./blocks/display";
import { SIGN_BLOCKS } from "./blocks/sign";
import { BANNER_BLOCKS } from "./blocks/banner";
import { EXTRA_BLOCKS } from "./blocks/extras";
import { STAND_BLOCKS } from "./blocks/stand";

const PARTS: readonly (readonly BlockDef[])[] = [
  LEGACY_BLOCKS,
  BUILDING_BLOCKS,
  NATURAL_BLOCKS,
  ORE_BLOCKS,
  FUNCTIONAL_BLOCKS,
  FARMING_BLOCKS,
  INFERNO_BLOCKS,
  BEYOND_BLOCKS,
  BREWING_BLOCKS,
  ENCHANTING_BLOCKS,
  REDSTONE_BLOCKS,
  WOOD_BLOCKS,
  COLOR_BLOCKS,
  MACHINE_BLOCKS,
  INFESTED_BLOCKS,
  BEE_BLOCKS,
  BOSS_BLOCKS,
  CITY_BLOCKS,
  OCEAN_BLOCKS,
  CAMP_BLOCKS,
  SEA_LIFE_BLOCKS,
  TREASURE_BLOCKS,
  MANSION_BLOCKS,
  CAVE_BLOCKS,
  SCULK_BLOCKS,
  DRIPSTONE_BLOCKS,
  LATE_WOOD_BLOCKS,
  MOUNTAIN_BLOCKS,
  ARCHAEOLOGY_BLOCKS,
  MANGROVE_BLOCKS,
  SNIFFER_BLOCKS,
  TRIAL_BLOCKS,
  COPPER_BLOCKS,
  DECOR_BLOCKS,
  FROST_BLOCKS,
  MUSHROOM_BLOCKS,
  JUNGLE_BLOCKS,
  CRIMSON_BLOCKS,
  BASALT_BLOCKS,
  COCOA_BLOCKS,
  CRAFTED_BLOCKS,
  SOUL_CAMP_BLOCKS,
  WORKSTATION_BLOCKS,
  STONECUTTER_BLOCKS,
  JOB_BLOCKS,
  SOUND_BLOCKS,
  HALL_BLOCKS,
  DISPLAY_BLOCKS,
  SIGN_BLOCKS,
  BANNER_BLOCKS,
  EXTRA_BLOCKS,
  STAND_BLOCKS,
];

export const BLOCKS: BlockDef[] = [];
/** Быстрый доступ по имени: B.stone === 3. */
export const B: Record<string, number> = {};

for (const part of PARTS)
  for (const def of part) {
    const id = BLOCKS.length;
    if (def.id >= 0 && def.id !== id)
      throw new Error(`block ${def.name}: id ${def.id}, по порядку ${id}`);
    if (B[def.name] !== undefined)
      throw new Error(`block ${def.name} зарегистрирован дважды`);
    BLOCKS.push({ ...def, id });
    B[def.name] = id;
  }

/** Сколько блоков было до сейва v3 (их id закреплены). */
export const LEGACY_BLOCK_COUNT = LEGACY_BLOCKS.length;

/** Имена шерсти — отдельным списком: палитра картинок и подписи. */
export const WOOL_BLOCKS = BLOCKS.filter((b) => b.name.endsWith("_wool")).map(
  (b) => b.name,
);

/** Мета-флаг воды: бит 0x08 = source-блок, биты 0..2 = уровень-1 (0..7). */
export const WATER_SOURCE = 0x08;
export const waterLevel = (meta: number): number => (meta & 0x07) + 1;
export const packWater = (level: number, source: boolean): number =>
  ((level - 1) & 0x07) | (source ? WATER_SOURCE : 0);
export const isWaterSource = (meta: number): boolean =>
  (meta & WATER_SOURCE) !== 0;
