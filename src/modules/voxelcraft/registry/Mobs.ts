// Реестр мобов — полностью данными. Новый моб = новая запись в registry/mobs/*.ts: риг собирается
// из parts в entities/Mob.ts, поведение параметризуется полями описания (entities/MobBrain.ts).
//
// parts: размеры/позиции в пикселях (1 блок = 16 px), pivot — точка вращения для процедурной
// анимации; anim: 'legL'|'legR' (шаг), 'armL'|'armR', 'head' (покачивание), 'wingL'|'wingR'.
import type { MobDef } from "../types";
import { PASSIVE_MOBS } from "./mobs/passive";
import { HOSTILE_MOBS } from "./mobs/hostile";
import { INFERNO_MOBS } from "./mobs/inferno";
import { BEYOND_MOBS } from "./mobs/beyond";
import { VILLAGER_MOBS } from "./mobs/villager";
import { TAME_MOBS } from "./mobs/tame";
import { WILDLIFE_MOBS } from "./mobs/wildlife";
import { NIGHT_MOBS } from "./mobs/night";
import { BOSS_MOBS } from "./mobs/boss";
import { CITY_MOBS } from "./mobs/city";
import { OCEAN_MOBS } from "./mobs/ocean";
import { SEA_LIFE_MOBS } from "./mobs/sealife";
import { ILLAGER_MOBS } from "./mobs/illager";
import { CAVE_MOBS } from "./mobs/caves";
import { SCULK_MOBS } from "./mobs/sculk";
import { GOAT_MOBS } from "./mobs/goat";
import { FROG_MOBS } from "./mobs/frog";
import { SNIFFER_MOBS } from "./mobs/sniffer";
import { TRIAL_MOBS_DEFS } from "./mobs/trial";
import { FROST_MOBS } from "./mobs/frost";
import { MUSHROOM_MOBS } from "./mobs/mushroom";
import { JUNGLE_MOBS } from "./mobs/jungle";
import { CRIMSON_MOBS } from "./mobs/crimson";
import { HOOFED_MOBS } from "./mobs/hoofed";
import { ARMADILLO_MOBS } from "./mobs/armadillo";
import { ALLAY_MOBS } from "./mobs/allay";
import { TRADER_MOBS } from "./mobs/trader";
import { ZOMBIE_VILLAGER_MOBS } from "./mobs/zombievillager";

export const MOBS: Record<string, MobDef> = {
  ...PASSIVE_MOBS,
  ...TAME_MOBS,
  ...WILDLIFE_MOBS,
  ...NIGHT_MOBS,
  ...VILLAGER_MOBS,
  ...HOSTILE_MOBS,
  ...INFERNO_MOBS,
  ...BEYOND_MOBS,
  ...BOSS_MOBS,
  ...CITY_MOBS,
  ...OCEAN_MOBS,
  ...SEA_LIFE_MOBS,
  ...ILLAGER_MOBS,
  ...CAVE_MOBS,
  ...SCULK_MOBS,
  ...GOAT_MOBS,
  ...FROG_MOBS,
  ...SNIFFER_MOBS,
  ...TRIAL_MOBS_DEFS,
  ...FROST_MOBS,
  ...MUSHROOM_MOBS,
  ...JUNGLE_MOBS,
  ...CRIMSON_MOBS,
  ...HOOFED_MOBS,
  ...ARMADILLO_MOBS,
  ...ALLAY_MOBS,
  ...TRADER_MOBS,
  ...ZOMBIE_VILLAGER_MOBS,
};
