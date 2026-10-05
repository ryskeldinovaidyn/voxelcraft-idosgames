// ПКМ по табличке открывает ввод текста (ui/SignEditor слушает ui:openSign).
import { events } from "../../core/EventBus";
import { behave } from "../blockBehaviour";
import "../blockentities/sign";

behave("sign", {
  use: (c) => {
    events.emit("ui:openSign", { x: c.x, y: c.y, z: c.z });
    return true;
  },
});
