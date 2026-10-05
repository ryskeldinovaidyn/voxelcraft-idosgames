// Ночная осада деревни, как в Minecraft: с наступлением ночи к заселённой деревне выходит отряд
// зомби и идёт к жителям. Это единственное место, где зомби-жители (systems/Zombify) появляются сами,
// без команд. Здесь — только чистые броски и геометрия; спавн делает Game (_tickSiege).
import { rules } from "./Difficulty";

/** Шанс осады за ночь у деревни рядом с игроком. */
export const SIEGE_CHANCE = 0.25;
/** Сколько зомби приходит: от и до. */
export const SIEGE_ZOMBIES: readonly [number, number] = [4, 8];
/**
 * На каком расстоянии от центра деревни они выходят. Ближе, чем волна набега (28–34): у зомби нет
 * цели-центра, они идут на жителей, которых замечают (MobBrain, радиус охоты), — издалека отряд
 * разбредался бы и до деревни не доходил.
 */
export const SIEGE_RADIUS: readonly [number, number] = [14, 20];

/** Быть ли осаде этой ночью: базовый шанс умножается на множитель сложности (мирная — никогда). */
export const siegeTonight = (rng: () => number = Math.random): boolean =>
  rng() < SIEGE_CHANCE * rules().siege;

/** Сколько зомби выйдет. */
export function siegeCount(rng: () => number = Math.random): number {
  const [lo, hi] = SIEGE_ZOMBIES;
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/**
 * Где встанет очередной зомби: кольцо вокруг центра деревни. Отряд выходит с одной стороны
 * (общий угол `angle`), как волна набега, — разброс ±0.4 радиана.
 */
export function siegeSpot(
  cx: number,
  cz: number,
  angle: number,
  rng: () => number = Math.random,
): { x: number; z: number } {
  const [lo, hi] = SIEGE_RADIUS;
  const d = lo + rng() * (hi - lo);
  const a = angle + (rng() - 0.5) * 0.8;
  return {
    x: Math.floor(cx + Math.cos(a) * d),
    z: Math.floor(cz + Math.sin(a) * d),
  };
}
