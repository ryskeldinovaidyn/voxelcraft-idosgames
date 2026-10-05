// Улей и гнездо: внутри до трёх пчёл, каждая через несколько секунд вылетает (в дождь сидит дома).
// Пчела, вернувшаяся с пыльцой, добавляет уровень мёда (world/Hive). Выпускает пчелу EntityManager
// (sink.spawnBee), влетает она сама (MobBrain.beeThink → событие beeEnter).
import { registerBlockEntity } from "../BlockEntities";
import { addHoney } from "../Hive";

export const HIVE_CAPACITY = 3;

export type HiveState = { inside: { t: number; pollen: boolean }[] };

registerBlockEntity("hive", {
  create: (): HiveState => ({ inside: [] }),
  tick: ({ world, be, dt, sink }) => {
    const s = be.state as HiveState;
    for (let i = s.inside.length - 1; i >= 0; i--) {
      const b = s.inside[i]!;
      b.t -= dt;
      if (b.t > 0 || world.raining) continue;
      if (!sink?.spawnBee?.(be.x, be.y, be.z)) {
        b.t = 5; // выйти некуда — позже
        continue;
      }
      if (b.pollen) addHoney(world, be.x, be.y, be.z);
      s.inside.splice(i, 1);
    }
  },
  on: {
    // пчела влетела; с пыльцой — мёд добавится, когда она снова вылетит
    beeEnter: (be, p) => {
      const s = be.state as HiveState;
      if (s.inside.length < HIVE_CAPACITY)
        s.inside.push({ t: 6 + Math.random() * 6, pollen: !!p.pollen });
    },
    // гнездо из генератора: завести трёх пчёл
    hiveSeed: (be) => {
      const s = be.state as HiveState;
      while (s.inside.length < HIVE_CAPACITY)
        s.inside.push({ t: 1 + Math.random() * 4, pollen: false });
    },
  },
});
