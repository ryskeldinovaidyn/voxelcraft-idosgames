// Костёр по ПКМ, как в Minecraft: сырую еду — на свободное место жариться (и на потухший — лежит,
// пока не зажгут), лопатой — погасить, огнивом — зажечь снова. Одинаково для костра и костра душ.
import { events } from "../../core/EventBus";
import { BLOCKS, B } from "../../registry/Blocks";
import { ITEMS } from "../../registry/Items";
import { smeltResult } from "../../registry/recipes/smelting";
import { behave, type UseCtx } from "../blockBehaviour";
import { campfireAdd } from "../blockentities/campfire";

/** Горящий костёр → его потухший вариант. */
export const CAMPFIRE_OUT: Readonly<Record<string, string>> = {
  campfire: "campfire_out",
  soul_campfire: "soul_campfire_out",
};

/** Горит ли в клетке костёр (любой). */
export const isLitCampfire = (id: number): boolean =>
  id === B.campfire || id === B.soul_campfire;

/** Жарится ли на костре: плавится в еду (сырое мясо, рыба, картофель). */
export function cookable(item: string): boolean {
  const r = smeltResult(item);
  return !!r && (ITEMS[r.result]?.food ?? 0) > 0;
}

function addFood(c: UseCtx): boolean {
  if (!c.held || !cookable(c.held)) return false;
  const be = c.world.containerAt?.(c.x, c.y, c.z);
  if (!be || !campfireAdd(be, c.held)) return false;
  c.consume?.();
  events.emit("campfireCook", { x: c.x, y: c.y, z: c.z, item: c.held });
  return true;
}

/** Над костром вода — гореть не может (как в Minecraft). */
const drowned = (c: UseCtx): boolean => {
  const above = c.world.getBlock(c.x, c.y + 1, c.z);
  return above === B.water || !!BLOCKS[above]?.waterlogged;
};

for (const [lit, out] of Object.entries(CAMPFIRE_OUT)) {
  behave(lit, {
    neighborChanged: (c) => {
      if (!drowned(c)) return;
      c.world.setBlock(c.x, c.y, c.z, B[out]!);
      events.emit("campfireOut", { x: c.x, y: c.y, z: c.z });
    },
    use: (c) => {
      if (c.held && ITEMS[c.held]?.toolType === "shovel") {
        c.world.setBlock(c.x, c.y, c.z, B[out]!);
        c.wear?.();
        events.emit("campfireOut", { x: c.x, y: c.y, z: c.z });
        return true;
      }
      return addFood(c);
    },
  });

  behave(out, {
    use: (c) => {
      if (c.held === "flint_and_steel" && !drowned(c)) {
        c.world.setBlock(c.x, c.y, c.z, B[lit]!);
        c.wear?.();
        events.emit("fireLit", { x: c.x, y: c.y, z: c.z });
        return true;
      }
      return addFood(c);
    },
  });
}
