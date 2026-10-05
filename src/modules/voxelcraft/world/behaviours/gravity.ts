// Падающие блоки (песок, гравий): без опоры снизу падают до первого препятствия, как в Minecraft.
// Падение — через запланированный тик, чтобы цепочка «сломал нижний — посыпались верхние»
// шла по одному блоку за тик, а не рекурсией.
import { BLOCKS } from "../../registry/Blocks";
import { behaveWhere, type TickCtx } from "../blockBehaviour";

const FALL_DELAY = 2; // тиков до падения

/** Можно ли упасть в клетку: пусто или заменяемое (трава, жидкость). */
function free(c: TickCtx, y: number): boolean {
  if (y < 0) return false;
  const b = c.world.getBlockOrUnloaded(c.x, y, c.z);
  return b === 0 || (b > 0 && (BLOCKS[b]?.replaceable ?? false));
}

behaveWhere((d) => d.gravity, {
  neighborChanged: (c) => {
    if (free(c, c.y - 1)) c.world.scheduleTick(c.x, c.y, c.z, FALL_DELAY);
  },
  scheduledTick: (c) => {
    if (!free(c, c.y - 1)) return;
    let y = c.y - 1;
    while (y > 0 && free(c, y - 1)) y--;
    c.world.setBlock(c.x, c.y, c.z, 0);
    c.world.setBlock(c.x, y, c.z, c.id, c.meta);
  },
});
