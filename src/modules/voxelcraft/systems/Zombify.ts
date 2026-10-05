// Зомби-жители, как в Minecraft: зомби, убивший жителя, оставляет вместо него зомби-жителя, и тот
// помнит профессию. Лечение золотым яблоком возвращает того же мастера — с опытом и рабочим блоком
// (Mob.curedType, Mob.curing; превращение — entities/EntityManager). Чистые функции.
import { MOBS } from "../registry/Mobs";

/** Во что превращается убитый житель. */
export const ZOMBIE_VILLAGER = "zombie_villager";

/** Сколько секунд идёт лечение (в Minecraft — минуты; для браузерной игры короче). */
export const CURE_SECONDS = 20;

/** Чем лечат. */
export const CURE_ITEM = "golden_apple";

/** Житель ли это (безработный или мастер). */
export const isVillager = (type: string): boolean =>
  type === "villager" || (type.startsWith("villager_") && !!MOBS[type]?.trades);

/**
 * Кого вернёт лечение: запомненную профессию, а если её нет или такого моба не стало —
 * обычного безработного жителя.
 */
export const curedTypeOf = (stored: string | null | undefined): string =>
  stored && isVillager(stored) ? stored : "villager";
