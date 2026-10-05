// Проводник, как в Minecraft: вокруг него (куб 3×3×3) — вода, в оболочке куба 5×5×5 — рамка из
// морского камня (камень, кирпичи, тёмный камень, фонарь). От 16 блоков рамки проводник включается
// и раз в 2 с шлёт импульс conduitPulse с радиусом 16 × ⌊рамка/7⌋ — Game даёт силу моря игроку в воде.
import { events } from "../../core/EventBus";
import { BLOCKS, B } from "../../registry/Blocks";
import { registerBlockEntity } from "../BlockEntities";

type GetBlock = (x: number, y: number, z: number) => number;

export type ConduitState = { frames: number; active: boolean; t: number };

const PULSE_EVERY = 2;
/** Сколько блоков рамки нужно, чтобы проводник включился. */
export const CONDUIT_MIN_FRAME = 16;

let frame: Set<number> | null = null;

/** Блоков рамки в оболочке куба 5×5×5 вокруг проводника. */
export function conduitFrames(
  get: GetBlock,
  x: number,
  y: number,
  z: number,
): number {
  frame ??= new Set(
    ["sea_stone", "sea_bricks", "dark_sea_stone", "sea_lantern"]
      .map((n) => B[n])
      .filter((v): v is number => v !== undefined),
  );
  let n = 0;
  for (let dx = -2; dx <= 2; dx++)
    for (let dy = -2; dy <= 2; dy++)
      for (let dz = -2; dz <= 2; dz++)
        if (
          Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) === 2 &&
          frame.has(get(x + dx, y + dy, z + dz))
        )
          n++;
  return n;
}

/** Вокруг проводника (куб 3×3×3) — вода. */
export function conduitWet(
  get: GetBlock,
  x: number,
  y: number,
  z: number,
): boolean {
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dz = -1; dz <= 1; dz++) {
        if (!dx && !dy && !dz) continue;
        const id = get(x + dx, y + dy, z + dz);
        if (id !== B.water && !BLOCKS[id]?.waterlogged) return false;
      }
  return true;
}

registerBlockEntity("conduit", {
  create: (): ConduitState => ({ frames: 0, active: false, t: PULSE_EVERY }),
  tick: ({ world, be, dt }) => {
    const s = be.state as ConduitState;
    s.t += dt;
    if (s.t < PULSE_EVERY) return;
    s.t = 0;
    const get = (x: number, y: number, z: number) => world.getBlock(x, y, z);
    s.frames = conduitFrames(get, be.x, be.y, be.z);
    s.active =
      s.frames >= CONDUIT_MIN_FRAME && conduitWet(get, be.x, be.y, be.z);
    if (s.active)
      events.emit("conduitPulse", {
        x: be.x,
        y: be.y,
        z: be.z,
        range: Math.floor(s.frames / 7) * 16,
      });
  },
});
