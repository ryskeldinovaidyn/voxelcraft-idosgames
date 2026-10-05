// Наблюдатель, как в Minecraft: смотрит лицом на клетку (мета — DIR6) и, когда там что-то меняется
// (блок или его состояние), даёт импульс 2 тика с тыла (бит OBSERVER_ON; выход — world/Redstone).
// Помнит, что видел, в состоянии блочной сущности: соседские обновления не говорят, какая клетка
// изменилась, а наблюдателю важна только одна.
import { DIR6 } from "../../registry/meta";
import { registerBlockEntity } from "../BlockEntities";
import { OBSERVER_ON } from "../Redstone";

/** Длина импульса, сек (2 тика). */
export const OBSERVER_PULSE = 0.1;

export type ObserverState = { seen: number; pulse: number };

registerBlockEntity("observer", {
  create: (): ObserverState => ({ seen: -1, pulse: 0 }),
  tick: ({ world: w, be, dt }) => {
    const s = be.state as ObserverState;
    const meta = w.getMeta(be.x, be.y, be.z);
    const id = w.getBlock(be.x, be.y, be.z);
    const [dx, dy, dz] = DIR6[meta & 7]!;
    const fx = be.x + dx,
      fy = be.y + dy,
      fz = be.z + dz;
    const cur = w.getBlockOrUnloaded(fx, fy, fz) * 256 + w.getMeta(fx, fy, fz);
    if (s.seen >= 0 && cur !== s.seen && !(meta & OBSERVER_ON)) {
      s.pulse = OBSERVER_PULSE;
      w.setBlock(be.x, be.y, be.z, id, meta | OBSERVER_ON);
    } else if (s.pulse > 0 && (s.pulse -= dt) <= 0) {
      w.setBlock(be.x, be.y, be.z, id, meta & ~OBSERVER_ON);
    }
    s.seen = cur;
  },
});
