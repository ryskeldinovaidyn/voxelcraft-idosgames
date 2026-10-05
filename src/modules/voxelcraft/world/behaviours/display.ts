// Рамка по ПКМ: предмет из руки — в рамку, ПКМ по занятой — повернуть на восьмую (как в
// Minecraft), ПКМ приседая — забрать предмет. Поворот читает компаратор (world/Containers).
import { events } from "../../core/EventBus";
import { behave } from "../blockBehaviour";
import "../blockentities/display";
import { DISPLAY_TURNS, type DisplayState } from "../blockentities/display";

behave("display_stand", {
  use: (c) => {
    const be = c.world.containerAt?.(c.x, c.y, c.z);
    if (!be) return false;
    const s = be.state as DisplayState;
    const shown = s.items[0];
    if (shown) {
      // предмет в рамке: пустой рукой — повернуть, с предметом в руке — забрать
      if (!c.held) {
        s.rot = ((s.rot ?? 0) + 1) % DISPLAY_TURNS;
        events.emit("paintingTurn", { x: c.x, y: c.y, z: c.z, rot: s.rot });
        return true;
      }
      // с предметом в руке — обмен: старый выпадает, новый встаёт на его место
      s.items[0] = { item: c.held, count: 1 };
      s.rot = 0;
      c.consume?.();
      c.drop?.(shown.item, 1);
      events.emit("displayTake", { x: c.x, y: c.y, z: c.z, item: shown.item });
      return true;
    }
    if (!c.held) return false;
    s.items[0] = { item: c.held, count: 1 };
    c.consume?.();
    events.emit("displayPut", { x: c.x, y: c.y, z: c.z, item: c.held });
    return true;
  },
});
