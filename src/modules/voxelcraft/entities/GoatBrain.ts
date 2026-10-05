// Коза, как в Minecraft: изредка высоко прыгает; раз в 30–120 с присматривается к игроку в 4–16 блоках,
// пригибает голову (1 с) и таранит: удар 2 и сильный отброс. Промахнувшись в камень, бревно, руду или
// лёд, теряет рог — он выпадает (событие mobDrop; рогов два). Детёныши не таранят.
import { events } from "../core/EventBus";
import { BLOCKS } from "../registry/Blocks";
import type { Mob } from "./Mob";
import type { MobCtx } from "./MobBrain";

export const RAM_WINDUP = 1;
export const RAM_DASH = 1.5;
const RAM_SPEED = 7;
export const RAM_DAMAGE = 2;
/** Во что упёршись коза теряет рог (по имени блока). */
const HORN_BLOCKS = /stone|deepslate|_log$|_ore$|ice|obsidian|copper/;

/** До следующего тарана: у кричащей козы — 5–30 с, у обычной — 30–120 с. */
export const nextRam = (m: Mob): number =>
  m.screaming ? 5 + Math.random() * 25 : 30 + Math.random() * 90;

/** Прыжки и таран; true — коза занята тараном (обычный мозг пропускается). */
export function goatTick(m: Mob, c: MobCtx, dt: number): boolean {
  if (m.baby) return false;
  const p = c.player;
  const target = !p.dead && p.mode !== "creative";
  if (m.ramCd === 0) m.ramCd = nextRam(m);

  if (m.dashT > 0) {
    m.dashT -= dt;
    m.speed = RAM_SPEED;
    m.state = "chase";
    const hd = Math.hypot(p.pos.x - m.pos.x, p.pos.z - m.pos.z);
    if (target && hd < m.width / 2 + 0.8 && Math.abs(p.pos.y - m.pos.y) < 1.5) {
      p.damage(RAM_DAMAGE, "attack");
      const k = 1 / Math.max(0.1, hd);
      p.vel.x += (p.pos.x - m.pos.x) * k * 9;
      p.vel.z += (p.pos.z - m.pos.z) * k * 9;
      p.vel.y += 4;
      events.emit("goatRam", { entity: m });
      m.dashT = 0;
    } else if (m.hitWall) {
      const r = m.width / 2 + 0.5;
      const name =
        BLOCKS[
          c.world.getBlock(
            Math.floor(m.pos.x - Math.sin(m.yaw) * r),
            Math.floor(m.pos.y + 0.5),
            Math.floor(m.pos.z - Math.cos(m.yaw) * r),
          )
        ]?.name ?? "";
      if (m.horns > 0 && HORN_BLOCKS.test(name)) {
        m.horns--;
        events.emit("mobDrop", {
          x: m.pos.x,
          y: m.pos.y + 1,
          z: m.pos.z,
          item: "goat_horn",
        });
      }
      events.emit("goatRam", { entity: m });
      m.dashT = 0;
    }
    if (m.dashT <= 0) {
      m.speed = 0;
      m.ramCd = nextRam(m);
    }
    return true;
  }
  if (m.ramT > 0) {
    m.ramT -= dt;
    m.speed = 0;
    m.state = "idle";
    m.targetYaw = Math.atan2(-(p.pos.x - m.pos.x), -(p.pos.z - m.pos.z));
    if (m.ramT <= 0) m.dashT = RAM_DASH;
    return true;
  }
  if (m.screaming && Math.random() < dt * 0.05)
    events.emit("goatScream", { entity: m });
  // высокий прыжок
  if (m.onGround && Math.random() < dt * 0.04) m.vel.y = 9;
  m.ramCd -= dt;
  if (m.ramCd <= 0) {
    const d = Math.hypot(p.pos.x - m.pos.x, p.pos.z - m.pos.z);
    if (target && d >= 4 && d <= 16) {
      m.ramT = RAM_WINDUP;
      events.emit("goatWindup", { entity: m });
      return true;
    }
    m.ramCd = 5; // игрока рядом нет — присмотреться позже
  }
  return false;
}
