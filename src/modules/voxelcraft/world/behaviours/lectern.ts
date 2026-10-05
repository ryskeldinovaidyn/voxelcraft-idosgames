// Кафедра: ПКМ кладёт книгу из руки, открывает её на чтение или правку (ui/BookScreen).
// Саму передачу делает экран — у него есть инвентарь игрока со стаками и их tag.
import { events } from "../../core/EventBus";
import { behave } from "../blockBehaviour";
import "../blockentities/lectern";

behave("lectern", {
  use: (c) => {
    events.emit("ui:openLectern", { x: c.x, y: c.y, z: c.z });
    return true;
  },
});
