// Медь: на случайном тике (2%) переходит в следующую стадию окисления, если не покрыта воском; соты — воск
// (бит WAXED), топор — снять воск, а без воска — одну стадию окисления. Медная лампа: каждый новый сигнал
// красного камня (фронт) переключает её — горит/не горит (T-триггер, как в Minecraft 1.21).
import { events } from "../../core/EventBus";
import { BLOCKS, B } from "../../registry/Blocks";
import { COPPER_STAGES, WAXED } from "../../registry/blocks/copper";
import { behave } from "../blockBehaviour";
import { useItem, useTool } from "../itemUse";
import { isPowered } from "../Redstone";

const OXIDIZE = 0.02;

/** Где блок в цепочках окисления: [цепочка, стадия] или null. */
function stageOf(id: number): [number, number] | null {
  const name = BLOCKS[id]?.name;
  for (let c = 0; c < COPPER_STAGES.length; c++) {
    const i = (COPPER_STAGES[c] as readonly string[]).indexOf(name ?? "");
    if (i >= 0) return [c, i];
  }
  return null;
}

for (const chain of COPPER_STAGES)
  for (let i = 0; i < chain.length - 1; i++) {
    const next = chain[i + 1]!;
    behave(chain[i]!, {
      randomTick: (c) => {
        if (c.meta & WAXED || c.rng() >= OXIDIZE) return;
        c.world.setBlock(c.x, c.y, c.z, B[next]!, c.meta);
      },
    });
  }

useItem("honeycomb", (c) => {
  if (!stageOf(c.id) || c.meta & WAXED) return false;
  c.world.setBlock(c.x, c.y, c.z, c.id, c.meta | WAXED);
  c.consume();
  events.emit("copperWax", { x: c.x, y: c.y, z: c.z });
  return true;
});

useTool("axe", (c) => {
  const st = stageOf(c.id);
  if (!st) return false;
  if (c.meta & WAXED) c.world.setBlock(c.x, c.y, c.z, c.id, c.meta & ~WAXED);
  else if (st[1] > 0)
    c.world.setBlock(
      c.x,
      c.y,
      c.z,
      B[COPPER_STAGES[st[0]]![st[1] - 1]!]!,
      c.meta,
    );
  else return false;
  c.wear(1);
  events.emit("copperScrape", { x: c.x, y: c.y, z: c.z });
  return true;
});

for (const name of ["copper_bulb", "copper_bulb_lit"])
  behave(name, {
    neighborChanged: (c) => {
      const powered = isPowered(c.world, c.x, c.y, c.z);
      if (powered === ((c.meta & 1) === 1)) return;
      const lit = c.id === B.copper_bulb_lit;
      const id = powered ? (lit ? B.copper_bulb! : B.copper_bulb_lit!) : c.id;
      c.world.setBlock(c.x, c.y, c.z, id, powered ? 1 : 0);
      if (powered)
        events.emit("bulbToggle", { x: c.x, y: c.y, z: c.z, lit: !lit });
    },
  });
