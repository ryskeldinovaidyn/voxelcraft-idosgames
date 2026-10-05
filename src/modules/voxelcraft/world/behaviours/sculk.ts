// Скалк: горящий сенсор гаснет сам (systems/Sculk гасит его через 1.5 с, а случайный тик — страховка
// для сенсора, оставшегося гореть в сейве).
import { B } from "../../registry/Blocks";
import { behave } from "../blockBehaviour";

behave("sculk_sensor_on", {
  randomTick: (t) => t.world.setBlock(t.x, t.y, t.z, B.sculk_sensor!),
});
