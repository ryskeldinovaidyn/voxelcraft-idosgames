// Лягушачья икра на случайных тиках зреет (стадии в мете) и выводит головастиков — событие
// frogspawnHatch (их пускает в воду EntityManager). Пузырёк воды по земле — грязь, пузырёк пустеет.
import { events } from "../../core/EventBus";
import { B } from "../../registry/Blocks";
import { behave } from "../blockBehaviour";
import { useItem } from "../itemUse";

const HATCH_STAGES = 2;

behave("frogspawn", {
  randomTick: (c) => {
    if (c.rng() > 0.3) return;
    if (c.meta < HATCH_STAGES) {
      c.world.setBlock(c.x, c.y, c.z, c.id, c.meta + 1);
      return;
    }
    c.world.setBlock(c.x, c.y, c.z, B.air!);
    events.emit("frogspawnHatch", { x: c.x, y: c.y, z: c.z });
  },
});

useItem("potion_water", (c) => {
  if (c.id !== B.dirt) return false;
  c.world.setBlock(c.x, c.y, c.z, B.mud!);
  c.give?.("glass_bottle");
  events.emit("bucketEmpty", { item: "potion_water" });
  return true;
});
