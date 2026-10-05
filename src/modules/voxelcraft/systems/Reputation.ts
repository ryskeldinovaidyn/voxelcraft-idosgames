// Репутация в деревне и спрос на товар, как в Minecraft (упрощённо, без сплетен между жителями).
//   Репутация — одно число на игрока: торговля её поднимает, удар по жителю роняет, вылеченный
//   зомби-житель поднимает сильно. Хорошая репутация делает плату дешевле, плохая — дороже.
//   Спрос — у каждой сделки свой: чем чаще её берут, тем дороже она становится, а утреннее
//   пополнение товара спрос сбрасывает.
// Чистые функции: их зовут экран торговли (ui/tradeView), игрок (репутация в сейве) и тесты.
import type { Trade } from "./Trading";

export const REP_MIN = -30;
export const REP_MAX = 30;

/** За что и насколько меняется репутация. */
export const REP_TRADE = 1;
export const REP_CURE = 5;
export const REP_HIT_VILLAGER = -2;
export const REP_KILL_VILLAGER = -7;

export const clampRep = (v: number): number =>
  Math.max(REP_MIN, Math.min(REP_MAX, Math.round(v)));

/**
 * Надбавка к плате за репутацию: один изумруд за каждые 10 очков (вверх — дешевле, вниз — дороже).
 * Отдельно от скидки Героя: та временная, эта — «вас тут знают».
 */
export const repAdjust = (rep: number): number => -Math.trunc(rep / 10) || 0;

/**
 * Надбавка за спрос: каждая покупка сверх первой прибавляет к плате, но не больше половины
 * лимита сделки (иначе один товар за вечер дорожал бы до небес).
 */
export function demandAdjust(uses: number, maxUses: number): number {
  return Math.min(Math.max(0, uses - 1), Math.ceil(maxUses / 2));
}

export interface PriceCtx {
  /** Уровень эффекта «Герой деревни» (0 — нет). */
  heroLevel?: number;
  /** Сколько раз эту сделку уже брали у этого жителя. */
  uses?: number;
  /** Репутация игрока в деревне. */
  rep?: number;
}

/**
 * Итоговая плата за сделку: база, минус скидка Героя, плюс спрос, плюс поправка на репутацию.
 * Меньше одного предмета плата не бывает — как в Minecraft.
 */
export function priceOf(t: Trade, c: PriceCtx = {}): Trade {
  const hero = c.heroLevel ?? 0;
  const k = hero > 0 ? 0.3 + 0.0625 * (hero - 1) : 0;
  const base = Math.floor(t.buy[1] * (1 - k));
  const price =
    base + demandAdjust(c.uses ?? 0, t.maxUses) + repAdjust(c.rep ?? 0);
  return { ...t, buy: [t.buy[0], Math.max(1, price)] };
}
