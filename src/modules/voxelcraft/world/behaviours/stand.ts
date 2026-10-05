// Стойка для брони, путевой камень и якорь возрождения.
//   стойка — экран с четырьмя слотами брони (ui/InventoryUI);
//   путевой камень — ПКМ компасом по нему привязывает стрелку компаса к этому месту (main);
//   якорь — светокамнем заряжается (мета 0..4), иначе просит измерение решить, что делать (main):
//     в Пекле это точка возрождения, в верхнем мире — взрыв, как в Minecraft.
import { events } from "../../core/EventBus";
import { B } from "../../registry/Blocks";
import { behave } from "../blockBehaviour";
import { useItem } from "../itemUse";
import "../blockentities/armorStand";

/** Сколько зарядов держит якорь. */
export const ANCHOR_MAX = 4;
/** Заряды якоря в мете. */
export const anchorCharges = (meta: number): number => meta & 7;

behave("armor_stand", {
  use: (c) => {
    events.emit("ui:openArmorStand", { x: c.x, y: c.y, z: c.z });
    return true;
  },
});

behave("respawn_anchor", {
  use: (c) => {
    const charges = anchorCharges(c.meta);
    if (c.held === "glowstone" && charges < ANCHOR_MAX) {
      c.consume?.();
      c.world.setBlock(c.x, c.y, c.z, c.id, charges + 1);
      events.emit("anchorCharged", {
        x: c.x,
        y: c.y,
        z: c.z,
        charges: charges + 1,
      });
      return true;
    }
    events.emit("anchorUse", { x: c.x, y: c.y, z: c.z, charges });
    return true;
  },
});

// компас по путевому камню: стрелка будет показывать на него, пока камень цел
useItem("compass", (c) => {
  if (c.world.getBlock(c.x, c.y, c.z) !== B.lodestone) return false;
  events.emit("lodestoneBind", { x: c.x, y: c.y, z: c.z });
  return true;
});
