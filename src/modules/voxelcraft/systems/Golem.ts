// Железный голем, как в Minecraft: деревня зовёт его сама, когда жителям страшно (рядом враждебные —
// ночная осада, systems/Siege), и его можно собрать руками из четырёх железных блоков и тыквы.
// Здесь — чистые условие и фигура; спавн делает entities/EntityManager.
import { B } from "../registry/Blocks";

/** Сколько жителей должно быть рядом, чтобы деревня позвала голема. */
export const GOLEM_VILLAGERS = 3;
/** В каком радиусе считаются жители и уже живущий голем. */
export const GOLEM_RADIUS = 16;
/** Секунд между вызовами — иначе деревня наплодила бы армию за одну осаду. */
export const GOLEM_COOLDOWN = 300;

export interface GolemSituation {
  /** Жителей с профессией рядом. */
  villagers: number;
  /** Големов рядом. */
  golems: number;
  /** Рядом враждебные мобы — жителям страшно. */
  danger: boolean;
  /** Секунд до конца перезарядки (0 — готово). */
  cooldown: number;
}

/** Звать ли голема: страшно, жителей хватает, своего голема нет и перезарядка вышла. */
export const shouldSummonGolem = (s: GolemSituation): boolean =>
  s.cooldown <= 0 &&
  s.danger &&
  s.golems === 0 &&
  s.villagers >= GOLEM_VILLAGERS;

/**
 * Стоит ли тыква в (x, y, z) на фигуре голема: столб из двух железных блоков под ней и два «плеча»
 * по бокам верхнего — по оси X или по оси Z, как в Minecraft.
 */
export function isIronGolem(
  get: (x: number, y: number, z: number) => number,
  x: number,
  y: number,
  z: number,
): boolean {
  if (get(x, y, z) !== B.pumpkin) return false;
  const iron = (dx: number, dy: number, dz: number) =>
    get(x + dx, y + dy, z + dz) === B.iron_block;
  if (!iron(0, -1, 0) || !iron(0, -2, 0)) return false;
  return (
    (iron(-1, -1, 0) && iron(1, -1, 0)) || (iron(0, -1, -1) && iron(0, -1, 1))
  );
}
