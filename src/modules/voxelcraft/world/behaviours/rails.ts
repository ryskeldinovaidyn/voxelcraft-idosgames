// Рельсы: форма подстраивается под соседей, разгонные рельсы берут ток от соседей (бит
// RAIL_POWERED), вагонетка ставится на рельс ПКМ. Нажимные рельсы включает Game (_tickPlates) —
// там видно сущности.
import { events } from "../../core/EventBus";
import { BLOCKS, B } from "../../registry/Blocks";
import { WOOD_SPECIES } from "../../registry/blocks/wood";
import { RAIL_POWERED, isRail, railShapeFor } from "../Rails";
import { isPowered } from "../Redstone";
import { behaveWhere } from "../blockBehaviour";
import { useItem } from "../itemUse";

behaveWhere((d) => d.shape === "rail", {
  neighborChanged: (c) => {
    const plain = c.id === B.rail;
    const shape = railShapeFor(c.world, c.x, c.y, c.z, plain);
    let meta = plain ? shape : (c.meta & RAIL_POWERED) | shape;
    if (c.id === B.powered_rail || c.id === B.activator_rail)
      meta = shape | (isPowered(c.world, c.x, c.y, c.z) ? RAIL_POWERED : 0);
    if (meta !== c.meta) c.world.setBlock(c.x, c.y, c.z, c.id, meta);
  },
});

// лодка: на воду (Interaction ищет воду лучом с жидкостью) или на верх блока
for (const s of WOOD_SPECIES)
  useItem(`${s.id}_boat`, (c) => {
    const onWater = c.id === B.water;
    if (!onWater && !BLOCKS[c.id]?.solid) return false;
    events.emit("spawnBoat", {
      x: c.x,
      y: onWater ? c.y + 0.7 : c.y + 1,
      z: c.z,
      wood: s.id,
    });
    c.consume();
    return true;
  });

// вагонетки — на рельс; вид (с сундуком, воронкой, динамитом) — по предмету
for (const [item, variant] of [
  ["minecart", "plain"],
  ["chest_minecart", "chest"],
  ["hopper_minecart", "hopper"],
  ["tnt_minecart", "tnt"],
] as const)
  useItem(item, (c) => {
    if (!isRail(c.id)) return false;
    events.emit("spawnMinecart", { x: c.x, y: c.y, z: c.z, variant });
    c.consume();
    return true;
  });
