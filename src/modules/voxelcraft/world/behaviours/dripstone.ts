// Капельник и котёл, как в Minecraft.
// Сталактит без опоры сверху падает (через запланированный тик — цепочка сыплется по кусочку): событие
// dripstoneFall — Game ранит того, кто под ним (2 за блок, до 40), и роняет острый капельник.
// Кончик сталактита на случайном тике: если над блоком, к которому он прикреплён, вода — капает в котёл
// в 11 блоках под ним (уровень +1), лава — наполняет пустой котёл лавой. Из капельникового блока под
// водой сталактит растёт вниз (до 7), а под ним на полу — сталагмит.
// Котёл по ПКМ: ведро воды — полный, ведро лавы — с лавой, ведро по полному (или по лаве) — забрать,
// пузырёк — зачерпнуть (уровень −1), пузырёк воды — долить.
import { events } from "../../core/EventBus";
import { BLOCKS, B } from "../../registry/Blocks";
import { behave, type TickCtx, type UseCtx } from "../blockBehaviour";

const FALL_DELAY = 2;
/** Сколько блоков пролетает капля до котла. */
export const DRIP_REACH = 11;
const GROW_CHANCE = 0.05;
const WATER_DRIP = 0.17;
const LAVA_DRIP = 0.05;
const MAX_LENGTH = 7;

/** Урон упавшего сталактита: 2 за блок падения, от 2 до 40 (как в Minecraft). */
export const dripstoneFallDamage = (blocks: number): number =>
  Math.min(40, Math.max(2, Math.round(blocks * 2)));

const isDown = (id: number): boolean => id === B.pointed_dripstone_down;

/** Держится ли сталактит: сверху твёрдый куб или сталактит (незагруженное — держит). */
function anchored(c: TickCtx, x: number, y: number, z: number): boolean {
  const up = c.world.getBlockOrUnloaded(x, y + 1, z);
  if (up === -1 || isDown(up)) return true;
  const d = BLOCKS[up];
  return !!d?.solid && !d.liquid && d.shape === "cube";
}

/** Кончик капает в котёл и растёт. */
function drip(c: TickCtx): void {
  const w = c.world;
  if (isDown(w.getBlock(c.x, c.y - 1, c.z))) return; // капает только кончик
  let top = c.y;
  while (isDown(w.getBlock(c.x, top + 1, c.z))) top++;
  const root = w.getBlock(c.x, top + 1, c.z);
  const fluid = w.getBlock(c.x, top + 2, c.z);
  if (fluid !== B.water && fluid !== B.lava) return;
  for (let y = c.y - 1; y >= c.y - DRIP_REACH; y--) {
    const id = w.getBlock(c.x, y, c.z);
    if (id === 0) continue;
    if (
      fluid === B.water &&
      (id === B.cauldron ||
        (id === B.water_cauldron && w.getMeta(c.x, y, c.z) < 3))
    ) {
      if (c.rng() < WATER_DRIP) {
        w.setBlock(
          c.x,
          y,
          c.z,
          B.water_cauldron!,
          id === B.cauldron ? 1 : w.getMeta(c.x, y, c.z) + 1,
        );
        events.emit("cauldronDrip", { x: c.x, y, z: c.z });
      }
    } else if (fluid === B.lava && id === B.cauldron && c.rng() < LAVA_DRIP) {
      w.setBlock(c.x, y, c.z, B.lava_cauldron!);
      events.emit("cauldronDrip", { x: c.x, y, z: c.z });
    }
    break;
  }
  if (
    fluid !== B.water ||
    root !== B.dripstone_block ||
    c.rng() > GROW_CHANCE ||
    top - c.y + 1 >= MAX_LENGTH
  )
    return;
  if (w.getBlock(c.x, c.y - 1, c.z) === 0 && c.rng() < 0.5) {
    w.setBlock(c.x, c.y - 1, c.z, B.pointed_dripstone_down!);
    return;
  }
  // иначе — сталагмит на полу под кончиком
  for (let y = c.y - 2; y >= c.y - DRIP_REACH; y--) {
    const id = w.getBlock(c.x, y, c.z);
    if (id === 0) continue;
    const d = BLOCKS[id];
    if (
      w.getBlock(c.x, y + 1, c.z) === 0 &&
      (id === B.pointed_dripstone || (!!d?.solid && d.shape === "cube"))
    )
      w.setBlock(c.x, y + 1, c.z, B.pointed_dripstone!);
    break;
  }
}

behave("pointed_dripstone_down", {
  neighborChanged: (c) => {
    if (!anchored(c, c.x, c.y, c.z))
      c.world.scheduleTick(c.x, c.y, c.z, FALL_DELAY);
  },
  scheduledTick: (c) => {
    if (anchored(c, c.x, c.y, c.z)) return;
    let y = c.y - 1;
    while (y > 0) {
      const b = c.world.getBlockOrUnloaded(c.x, y, c.z);
      if (b !== 0 && !(b > 0 && (BLOCKS[b]?.replaceable ?? false))) break;
      y--;
    }
    c.world.setBlock(c.x, c.y, c.z, 0);
    events.emit("dripstoneFall", { x: c.x, y: c.y, z: c.z, landY: y + 1 });
  },
  randomTick: drip,
});

/** Поставить котлу состояние, отдать предмет в руку взамен одного из стака. */
function pour(
  c: UseCtx,
  id: number,
  meta: number,
  give: string,
  ev: "bucketFill" | "bucketEmpty",
): boolean {
  c.world.setBlock(c.x, c.y, c.z, id, meta);
  c.give?.(give);
  events.emit(ev, { item: give });
  return true;
}

for (const name of ["cauldron", "water_cauldron", "lava_cauldron"])
  behave(name, {
    use: (c) => {
      const lvl = c.id === B.water_cauldron ? c.meta : 0;
      switch (c.held) {
        case "water_bucket":
          return c.id === B.lava_cauldron
            ? false
            : pour(c, B.water_cauldron!, 3, "bucket", "bucketEmpty");
        case "lava_bucket":
          return c.id === B.cauldron
            ? pour(c, B.lava_cauldron!, 0, "bucket", "bucketEmpty")
            : false;
        case "bucket":
          if (c.id === B.lava_cauldron)
            return pour(c, B.cauldron!, 0, "lava_bucket", "bucketFill");
          if (c.id === B.water_cauldron && lvl >= 3)
            return pour(c, B.cauldron!, 0, "water_bucket", "bucketFill");
          return false;
        case "glass_bottle":
          if (c.id !== B.water_cauldron) return false;
          return lvl > 1
            ? pour(c, B.water_cauldron!, lvl - 1, "potion_water", "bucketFill")
            : pour(c, B.cauldron!, 0, "potion_water", "bucketFill");
        case "potion_water":
          if (c.id === B.lava_cauldron || lvl >= 3) return false;
          return pour(
            c,
            B.water_cauldron!,
            lvl + 1,
            "glass_bottle",
            "bucketEmpty",
          );
        default:
          return false;
      }
    },
  });
