// Сбор мёда, как в Minecraft: с полного улья (мёд 5) ножницы снимают 3 соты, пузырёк — бутылочку
// мёда; уровень мёда обнуляется, пчёлы рядом злятся (событие hiveHarvest — EntityManager).
import { events } from "../core/EventBus";
import { B } from "../registry/Blocks";
import { HONEY_FULL } from "../registry/blocks/bees";
import type { ChunkManager } from "./ChunkManager";

export const isHive = (id: number): boolean =>
  id === B.bee_nest || id === B.beehive;

/** Под ульем (до 5 блоков вниз) горит костёр — дым успокаивает пчёл при сборе, как в Minecraft. */
export function smokedHive(
  w: ChunkManager,
  x: number,
  y: number,
  z: number,
): boolean {
  for (let dy = 1; dy <= 5; dy++) {
    const b = w.getBlock(x, y - dy, z);
    if (b === B.campfire || b === B.soul_campfire) return true; // дымит и костёр душ
  }
  return false;
}

/** Уровень мёда в клетке (0..5). */
export const honeyLevel = (
  w: ChunkManager,
  x: number,
  y: number,
  z: number,
): number => w.getMeta(x, y, z) & 7;

/** Добавить мёда (пчела вернулась с пыльцой), не больше полного. */
export function addHoney(
  w: ChunkManager,
  x: number,
  y: number,
  z: number,
): void {
  const id = w.getBlock(x, y, z);
  if (!isHive(id)) return;
  const m = w.getMeta(x, y, z);
  if ((m & 7) < HONEY_FULL) w.setBlock(x, y, z, id, (m & ~7) | ((m & 7) + 1));
}

/** Собрать мёд инструментом; null — улей не полон. Что выдать — решает вызывающий. */
export function harvestHive(
  w: ChunkManager,
  x: number,
  y: number,
  z: number,
  tool: "shears" | "glass_bottle",
): { item: string; count: number } | null {
  const id = w.getBlock(x, y, z);
  if (!isHive(id) || honeyLevel(w, x, y, z) < HONEY_FULL) return null;
  w.setBlock(x, y, z, id, w.getMeta(x, y, z) & ~7);
  events.emit("hiveHarvest", { x, y, z });
  return tool === "shears"
    ? { item: "honeycomb", count: 3 }
    : { item: "honey_bottle", count: 1 };
}
