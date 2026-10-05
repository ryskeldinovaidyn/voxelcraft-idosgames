// Свеча: ПКМ огнивом — зажечь (свет 12), ПКМ пустой рукой по горящей — погасить.
import { events } from "../../core/EventBus";
import { B } from "../../registry/Blocks";
import { behave } from "../blockBehaviour";

behave("candle", {
  use: (c) => {
    if (c.held !== "flint_and_steel") return false;
    c.world.setBlock(c.x, c.y, c.z, B.candle_lit!);
    c.wear?.();
    events.emit("candleLit", { x: c.x, y: c.y, z: c.z });
    return true;
  },
});

behave("candle_lit", {
  use: (c) => {
    if (c.held) return false;
    c.world.setBlock(c.x, c.y, c.z, B.candle!);
    events.emit("candleOut", { x: c.x, y: c.y, z: c.z });
    return true;
  },
});
