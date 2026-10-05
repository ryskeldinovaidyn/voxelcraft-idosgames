// Маяк: раз в 4 с пересчитывает пирамиду и небо, светящий шлёт импульс (событие beaconPulse) —
// Game накладывает силы на игрока в зоне (world/Beacon.ts).
import { events } from "../../core/EventBus";
import { CHUNK_SIZE } from "../Chunk";
import { registerBlockEntity } from "../BlockEntities";
import {
  pyramidLevels,
  skyOpen,
  type BeaconPulse,
  type BeaconState,
} from "../Beacon";

const PULSE_EVERY = 4;

registerBlockEntity("beacon", {
  create: (): BeaconState => ({
    levels: 0,
    active: false,
    primary: null,
    secondary: null,
    t: PULSE_EVERY,
  }),
  tick: ({ world, be, dt }) => {
    const s = be.state as unknown as BeaconState;
    s.t += dt;
    if (s.t < PULSE_EVERY) return;
    s.t = 0;
    const get = (x: number, y: number, z: number) => world.getBlock(x, y, z);
    s.levels = pyramidLevels(get, be.x, be.y, be.z);
    s.active = s.levels > 0 && skyOpen(get, be.x, be.y, be.z, CHUNK_SIZE.SY);
    if (s.active && s.primary)
      events.emit("beaconPulse", {
        x: be.x,
        y: be.y,
        z: be.z,
        levels: s.levels,
        primary: s.primary,
        secondary: s.secondary,
      } satisfies BeaconPulse);
  },
});
