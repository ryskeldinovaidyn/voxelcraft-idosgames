// Компостер, как в Minecraft: ПКМ растительным предметом — с шансом по предмету уровень +1 (мета 0..7);
// на 7 — через случайный тик «созревает» (8); ПКМ по созревшему — костная мука, компостер пуст.
import { events } from "../../core/EventBus";
import { behave } from "../blockBehaviour";

export const COMPOST_READY = 8;

const CHANCE: Record<string, number> = {
  wheat_seeds: 0.3,
  melon_seeds: 0.3,
  pumpkin_seeds: 0.3,
  beetroot_seeds: 0.3,
  tallgrass: 0.3,
  kelp: 0.3,
  dried_kelp: 0.3,
  sugar_cane: 0.5,
  cactus: 0.5,
  melon_slice: 0.5,
  bamboo: 0.5,
  wheat: 0.65,
  cocoa_beans: 0.65,
  carrot: 0.65,
  potato: 0.65,
  beetroot: 0.65,
  apple: 0.65,
  pumpkin: 0.65,
  melon: 0.65,
  brown_mushroom: 0.65,
  red_mushroom: 0.65,
  flower_red: 0.65,
  flower_yellow: 0.65,
  bread: 0.85,
  baked_potato: 0.85,
  cookie: 0.85,
  hay_block: 0.85,
  pumpkin_pie: 1,
};

/** Шанс, что предмет поднимет уровень компостера; 0 — не компостируется. */
export function compostChance(item: string): number {
  if (item in CHANCE) return CHANCE[item]!;
  if (
    item.endsWith("_leaves") ||
    item === "leaves" ||
    item.endsWith("_sapling")
  )
    return 0.3;
  return 0;
}

behave("composter", {
  use: (c) => {
    if (c.meta >= COMPOST_READY) {
      c.world.setBlock(c.x, c.y, c.z, c.id, 0);
      c.drop?.("bone_meal", 1);
      events.emit("composterEmpty", { x: c.x, y: c.y, z: c.z });
      return true;
    }
    if (!c.held || c.meta >= 7) return false;
    const p = compostChance(c.held);
    if (p <= 0) return false;
    c.consume?.();
    if (Math.random() < p) c.world.setBlock(c.x, c.y, c.z, c.id, c.meta + 1);
    events.emit("composterFill", { x: c.x, y: c.y, z: c.z });
    return true;
  },
  randomTick: (c) => {
    if (c.meta === 7) c.world.setBlock(c.x, c.y, c.z, c.id, COMPOST_READY);
  },
});
