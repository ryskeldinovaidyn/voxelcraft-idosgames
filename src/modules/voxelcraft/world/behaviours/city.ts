// Цветок эхоцвета растёт, как хорус в Minecraft: на случайном тике вытягивает стебель вверх (до 5
// стеблей) и сам поднимается на верхушку. Опору стеблей и цветка проверяет world/Support.ts.
import { B } from "../../registry/Blocks";
import { behave } from "../blockBehaviour";

const MAX_HEIGHT = 5;

behave("echo_flower", {
  randomTick: (c) => {
    if (c.rng() > 0.3 || c.world.getBlock(c.x, c.y + 1, c.z) !== B.air) return;
    let h = 0;
    while (
      h < MAX_HEIGHT &&
      c.world.getBlock(c.x, c.y - 1 - h, c.z) === B.echo_plant
    )
      h++;
    if (h >= MAX_HEIGHT) return;
    c.world.setBlock(c.x, c.y, c.z, B.echo_plant!);
    c.world.setBlock(c.x, c.y + 1, c.z, B.echo_flower!);
  },
});
