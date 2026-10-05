// Ткацкий станок: ПКМ открывает экран «знамя + краситель + узор» (systems/Banner).
// Здесь же подключается блочная сущность знамени.
import { events } from "../../core/EventBus";
import { behave } from "../blockBehaviour";
import "../blockentities/banner";

behave("loom", {
  use: () => {
    events.emit("ui:openLoom");
    return true;
  },
});
