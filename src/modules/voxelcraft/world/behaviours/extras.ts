// Сундук Предела, строительные леса и мишень.
//   сундук — общий склад игрока: экран берёт слоты из инвентаря, а не из блочной сущности;
//   леса — пересчитывают расстояние до опоры, когда сосед изменился (systems/Scaffold);
//   мишень — стрела даёт красный сигнал тем сильнее, чем ближе попала к центру.
import { events } from "../../core/EventBus";
import { B } from "../../registry/Blocks";
import { scaffoldHolds } from "../../systems/Scaffold";
import { behave } from "../blockBehaviour";
import { scaffoldDistanceAt } from "../Scaffolding";
import type { ChunkManager } from "../ChunkManager";

behave("ender_chest", {
  use: () => {
    events.emit("ui:openEnder");
    return true;
  },
});

behave("scaffolding", {
  neighborChanged: (c) => {
    const dist = scaffoldDistanceAt(c.world, c.x, c.y, c.z);
    // без опоры блок снимет systems/BlockUpdates (world/Support), здесь — только новое расстояние
    if (scaffoldHolds(dist) && dist !== c.meta)
      c.world.setBlock(c.x, c.y, c.z, c.id, dist);
  },
});

/** Сколько тиков мишень держит сигнал после попадания (как в Minecraft). */
export const TARGET_TICKS = 8;

/**
 * Попадание стрелы в мишень: сила 15 в яблочко и 1 по краю — по расстоянию точки попадания от
 * центра грани. Сигнал живёт до запланированного тика, который гасит мету.
 */
export function hitTarget(
  world: ChunkManager,
  x: number,
  y: number,
  z: number,
  hx: number,
  hy: number,
  hz: number,
): boolean {
  if (world.getBlock(x, y, z) !== B.target) return false;
  // расстояние от центра клетки по двум самым «плоским» осям — грань, в которую вошла стрела
  const d = [hx - (x + 0.5), hy - (y + 0.5), hz - (z + 0.5)]
    .map(Math.abs)
    .sort((a, b) => a - b)
    .slice(0, 2);
  const r = Math.hypot(d[0]!, d[1]!) / Math.SQRT1_2 / 0.5; // 0 в центре, ~1 по углу
  const power = Math.max(1, Math.min(15, Math.round(15 * (1 - r))));
  world.setBlock(x, y, z, B.target!, power);
  world.scheduleTick(x, y, z, TARGET_TICKS);
  events.emit("targetHit", { x, y, z, power });
  return true;
}

behave("target", {
  scheduledTick: (c) => {
    if (c.meta > 0) c.world.setBlock(c.x, c.y, c.z, c.id, 0);
  },
});
