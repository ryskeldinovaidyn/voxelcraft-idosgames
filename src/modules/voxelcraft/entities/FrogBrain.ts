// Лягушка: раз в 2 с ловит языком в 4 блоках кого-то из своего меню (MobDef.tongue: жертва → что
// остаётся) — маленького слизня (слизь) или маленький магмовый куб (лягушачий свет своего цвета); иногда
// подпрыгивает. Съеденный пропадает без обычного дропа, остаток — событие mobDrop (его роняет Game).
import { events } from "../core/EventBus";
import type { Mob } from "./Mob";
import type { MobCtx } from "./MobBrain";

export const TONGUE_REACH = 4;
const TONGUE_CD = 2;

/** Прыжки и язык; true — лягушка сейчас ест (обычный мозг пропускается). */
export function tongueTick(m: Mob, c: MobCtx, dt: number): boolean {
  if (m.onGround && Math.random() < dt * 0.3) m.vel.y = 5;
  m.tongueCd -= dt;
  if (m.tongueCd > 0) return false;
  const menu = m.def.tongue!;
  const prey =
    c.near?.(m.pos, TONGUE_REACH, (o) => !o.dead && o.def.name in menu) ?? null;
  if (!prey) {
    m.tongueCd = 0.5;
    return false;
  }
  m.tongueCd = TONGUE_CD;
  m.targetYaw = Math.atan2(-(prey.pos.x - m.pos.x), -(prey.pos.z - m.pos.z));
  prey.dead = true; // hp > 0 — без обычного дропа: съеден
  events.emit("frogEat", { entity: m, prey });
  events.emit("mobDrop", {
    x: prey.pos.x,
    y: prey.pos.y + 0.3,
    z: prey.pos.z,
    item: menu[prey.def.name]!,
  });
  return true;
}
