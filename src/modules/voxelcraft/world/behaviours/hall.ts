// Колокол звонит по ПКМ; картина по ПКМ меняет сюжет на следующий по кругу (registry/blocks/hall).
import { events } from "../../core/EventBus";
import { B } from "../../registry/Blocks";
import { PAINTINGS } from "../../registry/blocks/hall";
import { behave } from "../blockBehaviour";

behave("bell", {
  use: (c) => {
    events.emit("bellRing", { x: c.x, y: c.y, z: c.z });
    return true;
  },
});

PAINTINGS.forEach((name, i) => {
  const next = PAINTINGS[(i + 1) % PAINTINGS.length]!;
  behave(name, {
    use: (c) => {
      c.world.setBlock(c.x, c.y, c.z, B[next]!, c.meta);
      events.emit("paintingTurn", { x: c.x, y: c.y, z: c.z, item: next });
      return true;
    },
  });
});
