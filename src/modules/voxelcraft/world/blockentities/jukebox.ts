// Проигрыватель: хранит одну пластинку. Сломали с пластинкой — она выпадает (contents).
// ⚠ Играет и замолкает он по СОСТОЯНИЮ, а не по ПКМ: пластинку может вынуть воронка снизу, и тогда
// музыку тоже надо остановить. Поэтому событие «заиграло/замолкло» шлёт тик, одно место на все
// способы вставить и вынуть.
import { events } from "../../core/EventBus";
import { discOf } from "../../systems/Disc";
import type { ItemStack } from "../../types";
import { registerBlockEntity } from "../BlockEntities";

export type JukeboxState = {
  items: (ItemStack | null)[];
  /** Что звучит сейчас — с этим тик сверяет содержимое. */
  playing?: string | null;
};

registerBlockEntity("jukebox", {
  create: (): JukeboxState => ({ items: [null], playing: null }),
  contents: (st) => (st as JukeboxState).items,
  tick: ({ be }) => {
    const s = be.state as JukeboxState;
    const now = s.items[0]?.item ?? null;
    if (now === (s.playing ?? null)) return;
    s.playing = now;
    const d = discOf(now);
    if (d)
      events.emit("discPlay", {
        x: be.x,
        y: be.y,
        z: be.z,
        item: d.name,
        mood: d.mood,
        seed: d.seed,
      });
    else events.emit("discEject", { x: be.x, y: be.y, z: be.z });
  },
});
