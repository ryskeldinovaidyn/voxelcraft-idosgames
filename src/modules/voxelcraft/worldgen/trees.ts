// Деревья генератора миров. Одна реализация на два случая: дерево внутри чанка (генерация чанка,
// крона не выходит за его край) и дерево как часть постройки (роща — штамп, может пересекать
// чанки). Разница только в функции put.
import { B } from "../registry/Blocks";
import type { TreeType } from "./WorldSpec";

/**
 * Поставить блок дерева. soft = листва: ставится только в воздух (не затирает соседние стволы
 * и постройки), ствол — всегда.
 */
export type TreePut = (
  x: number,
  y: number,
  z: number,
  id: number,
  soft: boolean,
) => void;

/** Максимальная высота дерева над землёй — для проверки «влезет ли под потолок мира». */
export const TREE_MAX_HEIGHT = 11;

/** Радиус кроны — отступ от края чанка, чтобы дерево не выходило за него. */
export const TREE_MAX_RADIUS = 2;

/** Посадить дерево на блок земли (x, groundY, z). */
export function plantTree(
  type: TreeType,
  x: number,
  groundY: number,
  z: number,
  rng: () => number,
  put: TreePut,
): void {
  switch (type) {
    case "oak":
      return roundTree(
        B.oak_log!,
        B.leaves!,
        4 + ((rng() * 2) | 0),
        x,
        groundY,
        z,
        rng,
        put,
      );
    case "birch":
      return roundTree(
        B.birch_log!,
        B.birch_leaves!,
        5 + ((rng() * 2) | 0),
        x,
        groundY,
        z,
        rng,
        put,
      );
    case "spruce":
      return spruce(x, groundY, z, rng, put);
    case "palm":
      return palm(x, groundY, z, rng, put);
    case "dead":
      return dead(x, groundY, z, rng, put);
    case "none":
      return;
  }
}

/**
 * Дерево любой породы: породы рецепта мира (TreeType) — plantTree, остальные (тропическое, акация,
 * тёмный дуб — registry/blocks/wood) — здесь. Нужна генератору gen2 и саженцам.
 */
export function growTree(
  kind: string,
  x: number,
  groundY: number,
  z: number,
  rng: () => number,
  put: TreePut,
): void {
  switch (kind) {
    case "jungle":
      return roundTree(
        B.jungle_log!,
        B.jungle_leaves!,
        6 + ((rng() * 3) | 0),
        x,
        groundY,
        z,
        rng,
        put,
      );
    case "acacia":
      return acacia(x, groundY, z, rng, put);
    case "dark_oak":
      return darkOak(x, groundY, z, rng, put);
    case "cherry":
      return cherry(x, groundY, z, rng, put);
    case "mangrove":
      return mangrove(x, groundY, z, rng, put);
    case "oak":
    case "birch":
    case "spruce":
    case "palm":
    case "dead":
    case "none":
      return plantTree(kind, x, groundY, z, rng, put);
  }
}

/** Акация: ствол изгибается вбок и несёт плоскую крону. */
function acacia(
  x: number,
  h: number,
  z: number,
  rng: () => number,
  put: TreePut,
): void {
  const log = B.acacia_log!,
    leaves = B.acacia_leaves!;
  const trunk = 3 + ((rng() * 2) | 0);
  for (let y = 1; y <= trunk; y++) put(x, h + y, z, log, false);
  const dir = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ][(rng() * 4) | 0]!;
  let tx = x,
    tz = z,
    ty = h + trunk;
  for (let k = 0; k < 2; k++) {
    tx += dir[0]!;
    tz += dir[1]!;
    ty += 1;
    put(tx, ty, tz, log, false);
  }
  for (let dx = -2; dx <= 2; dx++)
    for (let dz = -2; dz <= 2; dz++) {
      if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
      put(tx + dx, ty + 1, tz + dz, leaves, true);
      if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1)
        put(tx + dx, ty + 2, tz + dz, leaves, true);
    }
}

/** Тёмный дуб: короткий толстый ствол (1×1 — упрощение 2×2 Minecraft) и широкая плоская крона. */
function darkOak(
  x: number,
  h: number,
  z: number,
  rng: () => number,
  put: TreePut,
): void {
  const log = B.dark_oak_log!,
    leaves = B.dark_oak_leaves!;
  const trunk = 4 + ((rng() * 2) | 0);
  for (let y = 1; y <= trunk; y++) put(x, h + y, z, log, false);
  for (let dy = trunk - 1; dy <= trunk + 1; dy++) {
    const r = dy === trunk + 1 ? 2 : 3;
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) {
        if (dx === 0 && dz === 0 && dy <= trunk) continue;
        if (Math.abs(dx) === r && Math.abs(dz) === r) continue;
        if ((Math.abs(dx) === r || Math.abs(dz) === r) && rng() < 0.3) continue;
        put(x + dx, h + dy + 1, z + dz, leaves, true);
      }
  }
}

/**
 * Вишня: невысокий ствол с развилкой — две ветви в противоположные стороны, у каждой розовая шапка
 * кроны радиусом 2 (крона шире обычной — генератор не сажает вишню у края чанка).
 */
function cherry(
  x: number,
  h: number,
  z: number,
  rng: () => number,
  put: TreePut,
): void {
  const log = B.cherry_log!,
    leaves = B.cherry_leaves!;
  const trunk = 3 + ((rng() * 2) | 0);
  for (let y = 1; y <= trunk; y++) put(x, h + y, z, log, false);
  const dirs = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ] as const;
  const a = (rng() * 4) | 0;
  for (const [dx, dz] of [dirs[a]!, dirs[(a + 2) % 4]!]) {
    const bx = x + dx,
      bz = z + dz,
      by = h + trunk + 1;
    put(bx, by, bz, log, false);
    for (let dy = 0; dy <= 2; dy++) {
      const r = dy === 2 ? 1 : 2;
      for (let ox = -r; ox <= r; ox++)
        for (let oz = -r; oz <= r; oz++) {
          if (dy === 0 && ox === 0 && oz === 0) continue;
          if (
            Math.abs(ox) === r &&
            Math.abs(oz) === r &&
            (r === 2 || rng() < 0.5)
          )
            continue;
          put(bx + ox, by + dy, bz + oz, leaves, true);
        }
    }
  }
}

/** Мангр: ствол на корнях-ходулях (2–3 блока над дном, ноги расходятся на 2 в стороны), крона как у дуба. */
function mangrove(
  x: number,
  h: number,
  z: number,
  rng: () => number,
  put: TreePut,
): void {
  const roots = B.mangrove_roots!;
  const lift = 2 + ((rng() * 2) | 0);
  for (let y = 1; y <= lift; y++) put(x, h + y, z, roots, false);
  for (const [dx, dz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    put(x + dx * 2, h + 1, z + dz * 2, roots, false);
    put(x + dx, h + 2, z + dz, roots, false);
  }
  roundTree(
    B.mangrove_log!,
    B.mangrove_leaves!,
    3 + ((rng() * 2) | 0),
    x,
    h + lift,
    z,
    rng,
    put,
  );
}

/** Лиственное дерево: ствол + два слоя 5×5 и два слоя 3×3, углы прореживаются. */
function roundTree(
  log: number,
  leaves: number,
  trunk: number,
  x: number,
  h: number,
  z: number,
  rng: () => number,
  put: TreePut,
): void {
  for (let y = 1; y <= trunk; y++) put(x, h + y, z, log, false);
  for (let dy = trunk - 1; dy <= trunk + 2; dy++) {
    const r = dy >= trunk + 1 ? 1 : 2;
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) {
        if (dx === 0 && dz === 0 && dy <= trunk) continue;
        if (Math.abs(dx) === r && Math.abs(dz) === r && rng() < 0.5) continue;
        put(x + dx, h + dy + 1, z + dz, leaves, true);
      }
  }
}

/** Ель: высокий ствол и конус хвои кольцами 2-1-2-1-…-0. */
function spruce(
  x: number,
  h: number,
  z: number,
  rng: () => number,
  put: TreePut,
): void {
  const trunk = 6 + ((rng() * 3) | 0);
  for (let y = 1; y <= trunk; y++) put(x, h + y, z, B.spruce_log!, false);
  const top = h + trunk + 1;
  put(x, top, z, B.spruce_leaves!, true);
  let r = 1;
  for (let y = top - 1; y >= h + 3; y--) {
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) {
        if (dx === 0 && dz === 0) continue;
        if (Math.abs(dx) === r && Math.abs(dz) === r && r > 1) continue;
        put(x + dx, y, z + dz, B.spruce_leaves!, true);
      }
    r = r === 1 ? 2 : 1;
  }
}

/** Пальма: тонкий ствол и крест из «листьев-вай» наверху. */
function palm(
  x: number,
  h: number,
  z: number,
  rng: () => number,
  put: TreePut,
): void {
  const trunk = 5 + ((rng() * 3) | 0);
  for (let y = 1; y <= trunk; y++) put(x, h + y, z, B.oak_log!, false);
  const top = h + trunk + 1;
  put(x, top, z, B.leaves!, true);
  for (const [dx, dz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    put(x + dx, top, z + dz, B.leaves!, true);
    put(x + dx * 2, top - 1, z + dz * 2, B.leaves!, true);
  }
}

/** Сухое дерево: голый ствол с обломком ветки. */
function dead(
  x: number,
  h: number,
  z: number,
  rng: () => number,
  put: TreePut,
): void {
  const trunk = 2 + ((rng() * 3) | 0);
  for (let y = 1; y <= trunk; y++) put(x, h + y, z, B.oak_log!, false);
  if (rng() < 0.6)
    put(x + (rng() < 0.5 ? 1 : -1), h + trunk, z, B.oak_log!, false);
}
