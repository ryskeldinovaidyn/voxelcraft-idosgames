// Раздатчик и выбрасыватель, как в Minecraft: 9 слотов, срабатывают по фронту сигнала красного камня
// (сигнал появился), берут случайный непустой слот. Выбрасыватель выкидывает предмет вперёд или кладёт
// в контейнер перед собой. Раздатчик пускает стрелы, выливает и набирает воду и лаву, поджигает
// огнивом, взводит TNT, сыплет костную муку; остальное выкидывает. Смотрят в 6 сторон (мета — DIR6).
import { events } from "../../core/EventBus";
import { BLOCKS, B, packWater, isWaterSource } from "../../registry/Blocks";
import { ITEMS } from "../../registry/Items";
import { DIR6 } from "../../registry/meta";
import type { ItemStack } from "../../types";
import { registerBlockEntity, type BlockEntityCtx } from "../BlockEntities";
import { insertOne } from "../Containers";
import { isPowered } from "../Redstone";
import { itemUseFor } from "../itemUse";
import { isArrow } from "../../systems/TippedArrow";

export const DISPENSER_SIZE = 9;

export type DispenserState = { items: (ItemStack | null)[]; powered: boolean };

function fire(c: BlockEntityCtx): void {
  const { world: w, be } = c;
  const s = be.state as DispenserState;
  const filled = s.items.map((it, i) => (it ? i : -1)).filter((i) => i >= 0);
  if (!filled.length) {
    events.emit("dispenseFail", { x: be.x, y: be.y, z: be.z });
    return;
  }
  const i = filled[Math.floor(Math.random() * filled.length)]!;
  const st = s.items[i]!;
  const [dx, dy, dz] = DIR6[w.getMeta(be.x, be.y, be.z) & 7]!;
  const tx = be.x + dx,
    ty = be.y + dy,
    tz = be.z + dz;
  const takeOne = () => {
    st.count -= 1;
    if (st.count <= 0) s.items[i] = null;
  };
  const eject = () => {
    const one = { ...st, count: 1 };
    c.sink?.ejectItem?.(
      be.x + 0.5 + dx * 0.7,
      be.y + 0.4 + dy * 0.7,
      be.z + 0.5 + dz * 0.7,
      dx * 4,
      dy * 4 + 1.5,
      dz * 4,
      one,
    );
    takeOne();
  };
  events.emit("dispense", { x: be.x, y: be.y, z: be.z });
  const front = w.getBlock(tx, ty, tz);
  const frontDef = BLOCKS[front];
  const open = front === 0 || (!!frontDef?.replaceable && !frontDef.liquid);

  if (w.getBlock(be.x, be.y, be.z) === B.dropper) {
    const box = c.at?.(tx, ty, tz);
    if (box) {
      if (insertOne(box, st, dy < 0 ? "top" : "side")) takeOne();
      return;
    }
    return eject();
  }

  // отравленная стрела вылетает из раздатчика так же, как обычная, и несёт свой эффект
  if (isArrow(st.item)) {
    c.sink?.shootArrow?.(
      be.x + 0.5 + dx * 0.8,
      be.y + 0.5 + dy * 0.8,
      be.z + 0.5 + dz * 0.8,
      dx * 30,
      dy * 30 + 1,
      dz * 30,
      st.item,
    );
    return takeOne();
  }
  switch (st.item) {
    case "water_bucket":
    case "lava_bucket":
      if (!open) return;
      w.setBlock(
        tx,
        ty,
        tz,
        st.item === "water_bucket" ? B.water! : B.lava!,
        packWater(8, true),
      );
      s.items[i] = { item: "bucket", count: 1 };
      return;
    case "bucket": {
      if (
        (front !== B.water && front !== B.lava) ||
        !isWaterSource(w.getMeta(tx, ty, tz)) ||
        st.count !== 1
      )
        return eject();
      w.setBlock(tx, ty, tz, B.air!);
      s.items[i] = {
        item: front === B.water ? "water_bucket" : "lava_bucket",
        count: 1,
      };
      return;
    }
    case "flint_and_steel": {
      if (front === B.tnt) {
        w.setBlock(tx, ty, tz, B.air!);
        events.emit("tntPrime", { x: tx, y: ty, z: tz, fuse: 4 });
      } else if (open) w.setBlock(tx, ty, tz, B.fire!, 0);
      else return;
      st.dmg = (st.dmg ?? 0) + 1;
      if (st.dmg >= (ITEMS[st.item]?.durability ?? 64)) s.items[i] = null;
      return;
    }
    case "tnt":
      if (!open) return;
      events.emit("tntPrime", { x: tx, y: ty, z: tz, fuse: 4 });
      return takeOne();
    case "bone_meal":
      itemUseFor("bone_meal")?.({
        world: w,
        x: tx,
        y: ty,
        z: tz,
        id: front,
        meta: w.getMeta(tx, ty, tz),
        nx: -dx,
        ny: -dy,
        nz: -dz,
        item: "bone_meal",
        rng: Math.random,
        consume: takeOne,
        wear: () => {},
      });
      return;
    default:
      return eject();
  }
}

registerBlockEntity("dispenser", {
  create: (): DispenserState => ({
    items: new Array<ItemStack | null>(DISPENSER_SIZE).fill(null),
    powered: false,
  }),
  contents: (st) => (st as DispenserState).items,
  tick: (c) => {
    const s = c.be.state as DispenserState;
    const p = isPowered(c.world, c.be.x, c.be.y, c.be.z);
    if (p && !s.powered) fire(c);
    s.powered = p;
  },
});
