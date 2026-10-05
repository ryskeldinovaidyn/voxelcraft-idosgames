// Гнездо из генератора (бит HIVE_SEEDED): на первом случайном тике в нём заводятся три пчелы —
// генератор ставит только блок, пчёлы живут в блочной сущности (world/blockentities/hive.ts).
import { events } from "../../core/EventBus";
import { HIVE_SEEDED } from "../../registry/blocks/bees";
import { behave } from "../blockBehaviour";

behave("bee_nest", {
  randomTick: (c) => {
    if (!(c.meta & HIVE_SEEDED)) return;
    c.world.setBlock(c.x, c.y, c.z, c.id, c.meta & ~HIVE_SEEDED);
    events.emit("hiveSeed", { x: c.x, y: c.y, z: c.z });
  },
});
