// Дух-помощник (Allay), как в Minecraft: ПКМ предметом — «вот что собирать» (player/Interaction), и он
// летит к таким же выпавшим предметам в 16 блоках, забирает их (до 64) и несёт игроку — роняет рядом.
// Без поручения парит на месте, с поручением и пустой сумкой держится возле игрока.
import { events } from "../core/EventBus";
import type { Mob } from "./Mob";
import type { MobCtx } from "./MobBrain";

/** Сколько дух уносит за раз. */
export const ALLAY_BAG = 64;
const RANGE = 16;

/** Лететь к точке: курс, скорость, высота. @returns расстояние до неё */
function fly(m: Mob, x: number, y: number, z: number): number {
  const hd = Math.hypot(x - m.pos.x, z - m.pos.z);
  m.targetYaw = Math.atan2(-(x - m.pos.x), -(z - m.pos.z));
  m.speed = hd > 0.4 ? m.def.walkSpeed : 0;
  m.climbWish = Math.max(-2, Math.min(2, (y - m.pos.y) * 1.5));
  return Math.hypot(hd, y - m.pos.y);
}

export function allayThink(m: Mob, c: MobCtx): void {
  const p = c.player;
  m.state = "wander";
  if (!m.carry) {
    // без поручения — парит, чуть покачиваясь
    m.speed = 0;
    m.climbWish = Math.sin(m.animTime * 1.5) * 0.3;
    return;
  }
  const item = m.carry.item;
  const drop =
    m.bag < ALLAY_BAG ? (c.nearDrop?.(m.pos, RANGE, item) ?? null) : null;
  if (drop) {
    if (fly(m, drop.pos.x, drop.pos.y + 0.4, drop.pos.z) < 1.2) {
      const n = c.takeDrop?.(drop.id, ALLAY_BAG - m.bag) ?? 0;
      if (n > 0) {
        m.bag += n;
        events.emit("allayCollect", { entity: m, item, n });
      }
    }
    return;
  }
  if (p.dead) {
    m.speed = 0;
    return;
  }
  const d = fly(m, p.pos.x, p.pos.y + 1.6, p.pos.z);
  if (m.bag > 0 && d < 2.2) {
    c.giveDrop?.(p.pos.x, p.pos.y + 1, p.pos.z, item, m.bag);
    events.emit("allayDeliver", { entity: m, item, n: m.bag });
    m.bag = 0;
  } else if (m.bag === 0 && d < 3) m.speed = 0; // сумка пуста — держится рядом
}
