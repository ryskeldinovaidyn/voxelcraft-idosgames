// Пещеры: растущий аметист на случайном тике (20%) отращивает на случайной грани почку или
// доращивает её до следующей стадии; пещерная лоза растёт вниз (до 8 блоков), новая часть с шансом
// 11% — с ягодами; ПКМ по лозе с ягодами — ягоды выпадают, лоза остаётся.
import { B } from "../../registry/Blocks";
import { AMETHYST_BUDS } from "../../registry/blocks/caves";
import { behave } from "../blockBehaviour";

const FACES: readonly (readonly [number, number, number])[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

const VINE_MAX = 8;
const isVine = (id: number): boolean =>
  id === B.cave_vines || id === B.cave_vines_lit;

behave("budding_amethyst", {
  randomTick: (t) => {
    if (t.rng() > 0.2) return;
    const [dx, dy, dz] = FACES[Math.floor(t.rng() * 6)]!;
    const x = t.x + dx,
      y = t.y + dy,
      z = t.z + dz;
    const id = t.world.getBlock(x, y, z);
    const buds = AMETHYST_BUDS.map((n) => B[n]!);
    if (id === B.air || id === B.water) t.world.setBlock(x, y, z, buds[0]!);
    else {
      const i = buds.indexOf(id);
      if (i >= 0 && i < buds.length - 1)
        t.world.setBlock(x, y, z, buds[i + 1]!);
    }
  },
});

for (const name of ["cave_vines", "cave_vines_lit"])
  behave(name, {
    randomTick: (t) => {
      if (t.rng() > 0.1 || t.world.getBlock(t.x, t.y - 1, t.z) !== B.air)
        return;
      let len = 1;
      while (len < VINE_MAX && isVine(t.world.getBlock(t.x, t.y + len, t.z)))
        len++;
      if (len >= VINE_MAX) return;
      t.world.setBlock(
        t.x,
        t.y - 1,
        t.z,
        t.rng() < 0.11 ? B.cave_vines_lit! : B.cave_vines!,
      );
    },
  });

behave("cave_vines_lit", {
  use: (c) => {
    c.world.setBlock(c.x, c.y, c.z, B.cave_vines!);
    c.drop?.("glow_berries", 1);
    return true;
  },
});
