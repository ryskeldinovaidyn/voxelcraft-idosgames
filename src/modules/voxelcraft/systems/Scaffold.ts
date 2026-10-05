// Строительные леса, как в Minecraft: держатся не «на чём-то», а на расстоянии до опоры. Клетка над
// твёрдым блоком — расстояние 0, лес под ней передаёт своё расстояние вверх без прибавки (башня
// любой высоты стоит), вбок расстояние растёт на 1 и дальше семи лес осыпается. Расстояние живёт в
// мете блока; читает его world/Support, пересчитывает world/behaviours/extras.
// Здесь — чистая арифметика: её зовут поведение, постановка (player/Placement) и тесты.

/** Дальше этого расстояния от опоры лес не держится. */
export const MAX_SCAFFOLD_DIST = 7;
/** Нет опоры вовсе. */
export const NO_SUPPORT = MAX_SCAFFOLD_DIST + 1;

/**
 * Расстояние до опоры для клетки леса.
 * @param belowSolid    под ней твёрдый блок (не лес) — сама опора
 * @param belowScaffold расстояние леса под ней, или null, если там не лес
 * @param sides         расстояния лесов с четырёх сторон (не лес — не передавать)
 */
export function scaffoldDistance(
  belowSolid: boolean,
  belowScaffold: number | null,
  sides: readonly number[],
): number {
  if (belowSolid) return 0;
  if (belowScaffold !== null && belowScaffold < NO_SUPPORT)
    return belowScaffold; // вертикаль расстояние не увеличивает
  let best = NO_SUPPORT;
  for (const d of sides) if (d + 1 < best) best = d + 1;
  return Math.min(best, NO_SUPPORT);
}

/** Держится ли лес на таком расстоянии. */
export const scaffoldHolds = (dist: number): boolean =>
  dist <= MAX_SCAFFOLD_DIST;
