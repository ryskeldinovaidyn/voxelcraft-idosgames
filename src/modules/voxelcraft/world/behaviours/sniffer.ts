// Древние ростки на случайных тиках растут, как посевы (свет ≥ 9, на мокрой пашне быстрее), и, дозрев,
// становятся цветком (ANCIENT_CROPS; костная мука перескакивает стадии — цветок на следующем тике).
// Яйцо нюхача трескается (стадии в мете) и выпускает детёныша — событие snifferHatch (EntityManager);
// на мху — вдвое быстрее.
import { events } from "../../core/EventBus";
import { B } from "../../registry/Blocks";
import { ANCIENT_CROPS } from "../../registry/blocks/sniffer";
import { behave } from "../blockBehaviour";

for (const [name, [max, grown]] of Object.entries(ANCIENT_CROPS))
  behave(name, {
    randomTick: (c) => {
      if (c.meta >= max) {
        c.world.setBlock(c.x, c.y, c.z, B[grown]!);
        return;
      }
      const l = c.world.getLight(c.x, c.y, c.z);
      if (Math.max(l >> 4, l & 15) < 9) return;
      const wet =
        c.world.getBlock(c.x, c.y - 1, c.z) === B.farmland &&
        c.world.getMeta(c.x, c.y - 1, c.z) > 0;
      if (c.rng() >= (wet ? 1 / 3 : 1 / 7)) return;
      if (c.meta + 1 >= max) c.world.setBlock(c.x, c.y, c.z, B[grown]!);
      else c.world.setBlock(c.x, c.y, c.z, c.id, c.meta + 1);
    },
  });

behave("sniffer_egg", {
  randomTick: (c) => {
    const moss = c.world.getBlock(c.x, c.y - 1, c.z) === B.moss_block;
    if (c.rng() > (moss ? 0.5 : 0.25)) return;
    if (c.meta < 2) {
      c.world.setBlock(c.x, c.y, c.z, c.id, c.meta + 1);
      return;
    }
    c.world.setBlock(c.x, c.y, c.z, B.air!);
    events.emit("snifferHatch", { x: c.x, y: c.y, z: c.z });
  },
});
