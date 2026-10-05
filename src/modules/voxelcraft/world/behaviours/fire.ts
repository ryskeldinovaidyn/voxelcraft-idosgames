// Огонь и кровать. Огонь по случайным тикам стареет, перекидывается на горючих соседей (дерево,
// листва, шерсть сгорают — на их месте огонь), поджигает TNT, без топлива гаснет — как в Minecraft.
// ПКМ по кровати — точку возрождения и сон решает Game (ему нужны время суток и мобы).
import { events } from "../../core/EventBus";
import { BLOCKS, B } from "../../registry/Blocks";
import { behave } from "../blockBehaviour";
import { tryLightPortal } from "../Portal";

const AROUND = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
] as const;

behave("fire", {
  randomTick: (c) => {
    // дождь гасит огонь под открытым небом
    if (
      c.world.raining &&
      c.world.getLight(c.x, c.y, c.z) >> 4 >= 15 &&
      c.rng() < 0.6
    ) {
      c.world.setBlock(c.x, c.y, c.z, B.air!);
      return;
    }
    const age = c.meta & 15;
    let fuel = false;
    for (const [dx, dy, dz] of AROUND) {
      const x = c.x + dx,
        y = c.y + dy,
        z = c.z + dz;
      const nb = c.world.getBlock(x, y, z);
      if (!BLOCKS[nb]?.flammable) continue;
      fuel = true;
      if (c.rng() > 0.25) continue;
      if (nb === B.tnt) {
        c.world.setBlock(x, y, z, B.air!);
        events.emit("tntPrime", { x, y, z, fuse: 4 });
      } else c.world.setBlock(x, y, z, B.fire!, 0); // сгорело — теперь горит здесь
    }
    // вечный огонь — на адском камне (Пекло)
    const forever =
      B.infernal_stone !== undefined &&
      c.world.getBlock(c.x, c.y - 1, c.z) === B.infernal_stone;
    if (forever) return;
    if ((!fuel && age >= 3) || age >= 15)
      c.world.setBlock(c.x, c.y, c.z, B.air!);
    else
      c.world.setBlock(
        c.x,
        c.y,
        c.z,
        B.fire!,
        Math.min(15, age + 1 + (c.rng() < 0.5 ? 1 : 0)),
      );
  },
  // огонь внутри обсидиановой рамки — от огнива, команды или растёкшийся — зажигает портал в Пекло
  neighborChanged: (c) => {
    if (tryLightPortal(c.world, c.x, c.y, c.z))
      events.emit("portalLit", { x: c.x, y: c.y, z: c.z });
  },
});

// огонь душ не распространяется и горит вечно — но только на песке и почве душ, иначе гаснет
behave("soul_fire", {
  randomTick: (c) => {
    const below = c.world.getBlock(c.x, c.y - 1, c.z);
    if (below !== B.soul_sand && below !== B.soul_soil)
      c.world.setBlock(c.x, c.y, c.z, B.air!);
  },
});

behave("red_bed", {
  use: (c) => {
    events.emit("ui:useBed", { x: c.x, y: c.y, z: c.z });
    return true;
  },
});
