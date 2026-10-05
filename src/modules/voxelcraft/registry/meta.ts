// Мета блока (8 бит) — состояние формы. Раскладка по формам:
//   сторона (facing) — биты 0..1: 0 север (-z), 1 восток (+x), 2 юг (+z), 3 запад (-x)
//   TOP  (0x4) — верхняя половина: перевёрнутые ступени, люк сверху, верх двери, изголовье
//                кровати, подвесной фонарь, око в рамке портала
//   OPEN (0x8) — открыто: дверь, люк, калитка
//   плита — биты 0..1: 0 низ, 1 верх, 2 двойная
//   факел — 0 на полу, 1..4 на стене: стена со стороны facing = meta-1
//   ось столба (бревно) и портала — 0 y, 1 x, 2 z
//   LIT (0x4) у кубов со «включённым» видом (горящая печь)
//   посевы — возраст в битах 0..2; снежный слой — слоёв-1 в битах 0..2
//   вода — см. packWater в Blocks.ts
//   поршень и его головка — направление по 6 сторонам (DIR6) в битах 0..2; EXTENDED (0x8) — поршень
//                выдвинут, у головки — липкая
export const TOP = 0x4;
export const EXTENDED = 0x8;

/** Шесть направлений: 0 вниз, 1 вверх, 2 север (-z), 3 юг (+z), 4 запад (-x), 5 восток (+x). */
export const DIR6: readonly (readonly [number, number, number])[] = [
  [0, -1, 0],
  [0, 1, 0],
  [0, 0, -1],
  [0, 0, 1],
  [-1, 0, 0],
  [1, 0, 0],
];

/** Сторона 0..3 (FACING_DIRS) → направление DIR6. */
export const dir6OfFacing = (facing: number): number =>
  [2, 5, 3, 4][facing & 3]!;
export const OPEN = 0x8;
export const LIT = 0x4;

export const SLAB_BOTTOM = 0;
export const SLAB_TOP = 1;
export const SLAB_DOUBLE = 2;

export const facingOf = (meta: number): number => meta & 3;
export const opposite = (facing: number): number => (facing + 2) & 3;

/** [dx, dz] стороны: 0 север (-z), 1 восток (+x), 2 юг (+z), 3 запад (-x). */
export const FACING_DIRS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** Сторона по горизонтальному вектору (главная ось). */
export function facingOfVector(dx: number, dz: number): number {
  if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? 1 : 3;
  return dz > 0 ? 2 : 0;
}

/** Куда смотрит игрок с этим yaw (взгляд = (-sin yaw, -cos yaw)). */
export function facingFromYaw(yaw: number): number {
  return facingOfVector(-Math.sin(yaw), -Math.cos(yaw));
}
