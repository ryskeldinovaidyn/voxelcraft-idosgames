// Стартовый мир модуля: рецепт WorldSpec или null — классический мир по сиду CONFIG.world.seed.
//
// Как сделать свой: в игре «Create world» → «Скачать рецепт» → вставить содержимое файла вместо
// null (объектом, не строкой). Или агент пишет рецепт сам — формат в скилле voxelcraft-worlds.
// Рецепт проходит parseWorldSpec, как любой другой: сломанное поле не уронит запуск.
//
// Игрок с сохранённым миром продолжит его («Мои миры»); стартовый мир — для первого запуска.
import { CONFIG } from "../config";
import type { WorldSource } from "../types";
import { CURRENT_GEN } from "../worldgen/WorldGenerator";
import { parseWorldSpec } from "../worldgen/WorldSpec";

export const START_WORLD: unknown = null;

export function startSource(): WorldSource {
  if (START_WORLD) {
    const r = parseWorldSpec(START_WORLD);
    if (r.ok) return { kind: "spec", spec: r.spec };
  }
  return { kind: "noise", seed: CONFIG.world.seed, gen: CURRENT_GEN };
}
