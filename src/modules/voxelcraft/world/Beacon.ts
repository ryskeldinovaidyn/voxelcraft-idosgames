// Маяк, как в Minecraft: под ним пирамида из блоков железа, золота, алмазов, изумрудов или пеклита
// (уровень n — полный квадрат (2n+1)² на n блоков ниже, до 4), над ним открытое небо. Раз в 4 с он
// даёт выбранные силы игрокам в радиусе 10 + 10·уровень на 9 + 2·уровень секунд. Основная сила —
// по уровню пирамиды; на 4-м уровне вторая: Регенерация или та же основная второго уровня.
// Выбор сил — экран маяка (ui/beaconView.ts) за слиток или камень; тикает блочная сущность beacon.
import { BLOCKS, B } from "../registry/Blocks";
import type { EffectId } from "../types";

type GetBlock = (x: number, y: number, z: number) => number;

export const BEACON_BASES = [
  "iron_block",
  "gold_block",
  "diamond_block",
  "emerald_block",
  "infernite_block",
];
/** Чем платят за выбор силы (любое одно). */
export const BEACON_PAYMENT = [
  "iron_ingot",
  "gold_ingot",
  "emerald",
  "diamond",
  "infernite_ingot",
];
/** Основные силы и уровень пирамиды, с которого они доступны. */
export const BEACON_POWERS: readonly { id: EffectId; tier: number }[] = [
  { id: "speed", tier: 1 },
  { id: "haste", tier: 1 },
  { id: "resistance", tier: 2 },
  { id: "jump_boost", tier: 2 },
  { id: "strength", tier: 3 },
];

// type, а не interface: состояние блочной сущности — Record<string, unknown> (уходит в сейв как есть)
export type BeaconState = {
  /** Уровень пирамиды 0..4 (пересчитывается раз в 4 с). */
  levels: number;
  /** Светит: есть пирамида и небо над маяком открыто — рисуется луч. */
  active: boolean;
  primary: EffectId | null;
  secondary: EffectId | null;
  /** Секунд с прошлого импульса. */
  t: number;
};

/** Импульс маяка (событие beaconPulse): где он и что даёт. */
export interface BeaconPulse {
  x: number;
  y: number;
  z: number;
  levels: number;
  primary: EffectId | null;
  secondary: EffectId | null;
}

let bases: Set<number> | null = null;

/** Уровень пирамиды под маяком в (x, y, z): 0..4. */
export function pyramidLevels(
  get: GetBlock,
  x: number,
  y: number,
  z: number,
): number {
  bases ??= new Set(
    BEACON_BASES.map((n) => B[n]).filter((v): v is number => v !== undefined),
  );
  let levels = 0;
  for (let n = 1; n <= 4; n++) {
    for (let dx = -n; dx <= n; dx++)
      for (let dz = -n; dz <= n; dz++)
        if (!bases.has(get(x + dx, y - n, z + dz))) return levels;
    levels = n;
  }
  return levels;
}

/** Небо над маяком не закрыто непрозрачными блоками (стекло пропускает луч). */
export function skyOpen(
  get: GetBlock,
  x: number,
  y: number,
  z: number,
  top: number,
): boolean {
  for (let yy = y + 1; yy < top; yy++)
    if (BLOCKS[get(x, yy, z)]?.opaque) return false;
  return true;
}

export const beaconRange = (levels: number): number => 10 + 10 * levels;

/** Игрок в зоне маяка: по горизонтали в радиусе, по высоте — от низа зоны и выше. */
export function inBeaconRange(
  p: BeaconPulse,
  x: number,
  y: number,
  z: number,
): boolean {
  const r = beaconRange(p.levels);
  return (
    Math.abs(x - (p.x + 0.5)) <= r &&
    Math.abs(z - (p.z + 0.5)) <= r &&
    y >= p.y - r
  );
}

/** Эффекты импульса: основная (второй уровень, если вторая сила та же), Регенерация как вторая. */
export function beaconEffects(
  p: BeaconPulse,
): { id: EffectId; level: number; seconds: number }[] {
  if (!p.levels || !p.primary) return [];
  const seconds = 9 + 2 * p.levels;
  const out = [
    {
      id: p.primary,
      level: p.levels >= 4 && p.secondary === p.primary ? 2 : 1,
      seconds,
    },
  ];
  if (p.levels >= 4 && p.secondary === "regeneration")
    out.push({ id: "regeneration", level: 1, seconds });
  return out;
}

/** Можно ли выбрать силу id как основную (slot 0) или вторую (slot 1) при этом уровне. */
export function canChoose(s: BeaconState, id: EffectId, slot: 0 | 1): boolean {
  if (slot === 0)
    return BEACON_POWERS.some((p) => p.id === id && p.tier <= s.levels);
  return (
    s.levels >= 4 &&
    s.primary !== null &&
    (id === "regeneration" || id === s.primary)
  );
}
