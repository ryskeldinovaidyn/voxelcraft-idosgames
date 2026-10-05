// Кисть: ПКМ держать по подозрительному песку или гравию — взмах раз в 0.5 с (player/Interaction), каждый
// взмах — стадия расчистки в мете блока. На четвёртом блок становится обычным песком или гравием, а
// находка из WorldGenerator.lootAt выпадает (событие brushLoot — Game роняет предмет). Кисть
// изнашивается на 1 за расчищенный блок.
import { events } from "../../core/EventBus";
import { BLOCKS, B } from "../../registry/Blocks";
import { BRUSH_STAGES, SUSPICIOUS } from "../../registry/blocks/archaeology";
import { useItem } from "../itemUse";

useItem("brush", (c) => {
  const plain = SUSPICIOUS[BLOCKS[c.id]?.name ?? ""];
  if (!plain) return false;
  const stage = c.meta + 1;
  events.emit("brushStroke", { x: c.x, y: c.y, z: c.z, stage });
  if (stage < BRUSH_STAGES) {
    c.world.setBlock(c.x, c.y, c.z, c.id, stage);
    return true;
  }
  const loot =
    c.world.generator.lootAt?.(c.x, c.y, c.z)?.find((s) => !!s) ?? null;
  c.world.setBlock(c.x, c.y, c.z, B[plain]!);
  c.wear(1);
  if (loot)
    events.emit("brushLoot", {
      x: c.x,
      y: c.y,
      z: c.z,
      item: loot.item,
      count: loot.count,
    });
  return true;
});
