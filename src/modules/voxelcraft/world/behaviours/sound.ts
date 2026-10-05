// Проигрыватель и нотный блок по ПКМ, как в Minecraft: пластинку в руке — вставить и слушать
// (systems/Disc задаёт лад и сид мелодии, играет systems/Music), пустой рукой — вынуть и замолчать;
// нотный блок по ПКМ поднимает ноту на полутон и звучит (мета 0..24).
import { events } from "../../core/EventBus";
import { BLOCKS } from "../../registry/Blocks";
import { discOf } from "../../systems/Disc";
import { instrumentBelow } from "../../systems/NoteBlock";
import { isPowered } from "../Redstone";
import { behave, type UseCtx } from "../blockBehaviour";
import "../blockentities/jukebox";
import type { JukeboxState } from "../blockentities/jukebox";

/** Сколько полутонов у нотного блока (две октавы, как в Minecraft). */
export const NOTE_STEPS = 25;

behave("jukebox", {
  use: (c: UseCtx) => {
    const be = c.world.containerAt?.(c.x, c.y, c.z);
    if (!be) return false;
    const s = be.state as JukeboxState;
    const inside = s.items[0];
    // «Заиграло» и «замолкло» шлёт тик проигрывателя: так это работает и когда пластинку
    // вынимает воронка (world/blockentities/jukebox)
    if (inside) {
      s.items[0] = null;
      c.drop?.(inside.item, 1);
      return true;
    }
    const d = discOf(c.held);
    if (!d) return false;
    s.items[0] = { item: d.name, count: 1 };
    c.consume?.();
    return true;
  },
});

/** Бит «в прошлый раз на блок подавали сигнал» — чтобы нота звучала на фронте, а не каждый тик. */
const NOTE_POWERED = 0x20;
const noteOf = (meta: number): number => meta & 0x1f;

/** Сыграть ноту блока: тембр — по блоку под ним (systems/NoteBlock). */
function playNote(c: UseCtx): void {
  const below = BLOCKS[c.world.getBlock(c.x, c.y - 1, c.z)]?.name ?? null;
  events.emit("noteBlock", {
    x: c.x,
    y: c.y,
    z: c.z,
    pitch: noteOf(c.meta),
    instrument: instrumentBelow(below).id,
  });
}

behave("note_block", {
  use: (c: UseCtx) => {
    const pitch = (noteOf(c.meta) + 1) % NOTE_STEPS;
    const meta = (c.meta & NOTE_POWERED) | pitch;
    c.world.setBlock(c.x, c.y, c.z, c.id, meta);
    playNote({ ...c, meta });
    return true;
  },
  // красный сигнал: нота звучит на фронте (появился сигнал), как в Minecraft
  neighborChanged: (c) => {
    const powered = isPowered(c.world, c.x, c.y, c.z);
    const was = (c.meta & NOTE_POWERED) !== 0;
    if (powered === was) return;
    const meta = powered ? c.meta | NOTE_POWERED : c.meta & ~NOTE_POWERED;
    c.world.setBlock(c.x, c.y, c.z, c.id, meta);
    if (powered) playNote({ ...c, meta });
  },
});
