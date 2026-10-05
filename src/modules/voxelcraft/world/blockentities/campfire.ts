// Костёр: 4 места для еды, каждая порция жарится 30 с и выпрыгивает готовой (как в Minecraft).
// Потухший костёр (campfire_out) держит еду, но не жарит. Кладут еду ПКМ — world/behaviours/camp.
import { events } from "../../core/EventBus";
import { B } from "../../registry/Blocks";
import { smeltResult } from "../../registry/recipes/smelting";
import type { ItemStack } from "../../types";
import { registerBlockEntity, type BlockEntity } from "../BlockEntities";

export const CAMPFIRE_SLOTS = 4;
/** Сколько жарится порция, сек. */
export const COOK_TIME = 30;

export type CampfireState = { items: (ItemStack | null)[]; t: number[] };

/** Положить порцию на свободное место; false — мест нет или это не костёр. */
export function campfireAdd(be: BlockEntity, item: string): boolean {
  if (be.type !== "campfire") return false;
  const s = be.state as CampfireState;
  const i = s.items.findIndex((x) => !x);
  if (i < 0) return false;
  s.items[i] = { item, count: 1 };
  s.t[i] = 0;
  return true;
}

registerBlockEntity("campfire", {
  create: (): CampfireState => ({
    items: new Array<ItemStack | null>(CAMPFIRE_SLOTS).fill(null),
    t: new Array<number>(CAMPFIRE_SLOTS).fill(0),
  }),
  contents: (st) => (st as CampfireState).items,
  tick: ({ world, be, dt, sink }) => {
    const here = world.getBlock(be.x, be.y, be.z);
    if (here !== B.campfire && here !== B.soul_campfire) return; // потух — не жарит
    const s = be.state as CampfireState;
    for (let i = 0; i < s.items.length; i++) {
      const it = s.items[i];
      if (!it) continue;
      s.t[i] = (s.t[i] ?? 0) + dt;
      if (s.t[i]! < COOK_TIME) continue;
      const r = smeltResult(it.item);
      s.items[i] = null;
      s.t[i] = 0;
      if (r) sink?.spawnDrop(be.x + 0.5, be.y + 1, be.z + 0.5, r.result, 1);
      events.emit("campfireDone", {
        x: be.x,
        y: be.y,
        z: be.z,
        item: r?.result ?? it.item,
      });
    }
  },
});
