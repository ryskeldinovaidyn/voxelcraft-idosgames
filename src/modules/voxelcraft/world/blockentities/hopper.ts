// Воронка, как в Minecraft: 5 слотов, раз в 0.4 с отдаёт один предмет туда, куда смотрит носик
// (мета 0 — вниз, 1..4 — вбок, facing = мета-1), и забирает один сверху — из контейнера или из
// лежащего на ней дропа. Запитанная красным камнем — стоит. Логика контейнеров — world/Containers.ts.
import { BLOCKS } from "../../registry/Blocks";
import { FACING_DIRS } from "../../registry/meta";
import type { ItemStack } from "../../types";
import { registerBlockEntity } from "../BlockEntities";
import { extractOne, insertOne } from "../Containers";
import { isPowered } from "../Redstone";

export const HOPPER_SIZE = 5;
/** Пауза между переносами, сек (8 тиков Minecraft). */
export const HOPPER_COOLDOWN = 0.4;

export type HopperState = { items: (ItemStack | null)[]; cd: number };

/** Куда смотрит носик воронки с этой метой. */
export function hopperOut(meta: number): [number, number, number] {
  if ((meta & 7) === 0) return [0, -1, 0];
  const [dx, dz] = FACING_DIRS[((meta & 7) - 1) & 3]!;
  return [dx, 0, dz];
}

registerBlockEntity("hopper", {
  create: (): HopperState => ({
    items: new Array<ItemStack | null>(HOPPER_SIZE).fill(null),
    cd: 0,
  }),
  contents: (st) => (st as HopperState).items,
  tick: ({ world, be, dt, at, sink }) => {
    const s = be.state as HopperState;
    s.cd -= dt;
    if (s.cd > 0) return;
    s.cd = HOPPER_COOLDOWN;
    if (isPowered(world, be.x, be.y, be.z)) return;
    // отдать
    const [dx, dy, dz] = hopperOut(world.getMeta(be.x, be.y, be.z));
    // куда отдать: блок-контейнер или вагонетка с грузом в той клетке
    const target =
      at?.(be.x + dx, be.y + dy, be.z + dz) ??
      sink?.cartItems?.(be.x + dx, be.y + dy, be.z + dz) ??
      undefined;
    if (target)
      for (let i = 0; i < s.items.length; i++) {
        const st = s.items[i];
        if (!st || !insertOne(target, st, dy < 0 ? "top" : "side")) continue;
        st.count -= 1;
        if (st.count <= 0) s.items[i] = null;
        break;
      }
    // забрать сверху: из контейнера или лежащий дроп
    const into = (one: ItemStack) => insertOne(be, one, "top");
    // сверху: контейнер или вагонетка с грузом на рельсе над воронкой
    const above =
      at?.(be.x, be.y + 1, be.z) ??
      sink?.cartItems?.(be.x, be.y + 1, be.z) ??
      undefined;
    if (above) extractOne(above, into);
    else if (!BLOCKS[world.getBlock(be.x, be.y + 1, be.z)]?.solid)
      sink?.takeDrop?.(
        be.x,
        be.y + 0.5,
        be.z,
        be.x + 1,
        be.y + 2,
        be.z + 1,
        into,
      );
  },
});
