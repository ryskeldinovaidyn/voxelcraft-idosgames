// Отравленные стрелы: стрела с зельем на наконечнике вешает свой эффект на того, в кого попала.
// Берём только длящиеся эффекты, которые понимают и игрок, и моб (entities/Mob.applyEffect):
// яд и замедление. Мгновенные зелья (лечение, урон) на стрелы не идут — на них в Minecraft
// наконечник даёт разовый удар, а у нас снаряд эффект именно вешает.
import type { EffectId } from "../types";

export interface TippedArrow {
  /** Из какого зелья делается. */
  potion: string;
  effect: EffectId;
  /** Секунд на цели (в Minecraft у стрелы — восьмая часть от зелья). */
  seconds: number;
  name: string;
}

export const TIPPED_ARROWS: Record<string, TippedArrow> = {
  tipped_arrow_poison: {
    potion: "potion_poison",
    effect: "poison",
    seconds: 6,
    name: "Стрела яда",
  },
  tipped_arrow_slowness: {
    potion: "potion_slowness",
    effect: "slowness",
    seconds: 11,
    name: "Стрела замедления",
  },
};

/** Эффект стрелы этого вида; обычная стрела — null. */
export function tippedEffect(
  item: string,
): { id: EffectId; seconds: number } | null {
  const t = TIPPED_ARROWS[item];
  return t ? { id: t.effect, seconds: t.seconds } : null;
}

/** Стрела это или нет (обычная или отравленная) — этим выбирается снаряд для выстрела. */
export const isArrow = (item: string): boolean =>
  item === "arrow" || item in TIPPED_ARROWS;
