// Страж (Warden Minecraft). Слепой: находит по вибрациям (systems/Sculk.vibrate → wardenHear) и по
// запаху — игрок ближе 6 блоков понемногу злит его, даже стоя тихо; удар игрока — сразу в ярость.
// Злость ≥ 80 — погоня: удар на 30, а если до цели не дойти — звуковой удар сквозь стены (заряд 1.7 с,
// 10 урона и отброс) не чаще раза в 5 с. Каждые 6 с насылает Тьму на игрока в 20 блоках. Вылезает
// из земли 6.7 с (неуязвим), а без тревог 60 с — закапывается и уходит (без дропа).
import { events } from "../core/EventBus";
import type { Mob } from "./Mob";
import type { MobCtx } from "./MobBrain";

export const ANGER_CHASE = 80;
const ANGER_MAX = 150;
export const BOOM_RANGE = 15;
export const BOOM_CHARGE = 1.7;
export const BOOM_DAMAGE = 10;
const BOOM_COOLDOWN = 5;
export const EMERGE_TIME = 6.7;
export const DIG_AFTER = 60;
const DARK_EVERY = 6;
const DARK_RANGE = 20;
const SMELL = 6;

const faceTo = (m: Mob, x: number, z: number): void => {
  m.targetYaw = Math.atan2(-(x - m.pos.x), -(z - m.pos.z));
};

/** Страж услышал вибрацию: злится (от игрока — сильнее) и идёт проверить место. */
export function wardenHear(
  m: Mob,
  x: number,
  y: number,
  z: number,
  byPlayer: boolean,
): void {
  if (m.dead || m.emergeT > 0) return;
  m.anger = Math.min(ANGER_MAX, m.anger + (byPlayer ? 20 : 10));
  m.suspect = [x, y, z];
  m.idleT = 0;
}

export function wardenThink(m: Mob, c: MobCtx, dt: number): void {
  if (m.emergeT > 0) {
    m.emergeT -= dt;
    m.speed = 0;
    m.state = "idle";
    if (m.emergeT <= 0) m.invulnerable = false;
    return;
  }
  const p = c.player;
  const hunted = !p.dead && p.mode !== "creative";
  const dx = p.pos.x - m.pos.x,
    dz = p.pos.z - m.pos.z;
  const hd = Math.hypot(dx, dz),
    d = Math.hypot(dx, p.pos.y - m.pos.y, dz);
  m.anger = Math.max(0, m.anger - dt);
  m.boomCd = Math.max(0, m.boomCd - dt);
  if (m.hitByPlayerT > 0) m.anger = ANGER_MAX;
  if (hunted && d < SMELL) m.anger = Math.min(ANGER_MAX, m.anger + dt * 8);

  m.darkT -= dt;
  if (m.darkT <= 0) {
    m.darkT = DARK_EVERY;
    if (hunted && d <= DARK_RANGE) p.addEffect("darkness", 13);
  }

  // звуковой удар: стоит и заряжает, потом бьёт сквозь стены
  if (m.boomT > 0) {
    m.speed = 0;
    faceTo(m, p.pos.x, p.pos.z);
    m.boomT -= dt;
    if (m.boomT <= 0) {
      m.boomCd = BOOM_COOLDOWN;
      if (hunted && d <= BOOM_RANGE + 2) {
        p.damage(BOOM_DAMAGE, "sonic_boom");
        const k = 1 / Math.max(0.1, hd);
        p.vel.x += dx * k * 6;
        p.vel.z += dz * k * 6;
        p.vel.y += 2;
      }
      events.emit("sonicBoom", {
        x: m.pos.x,
        y: m.pos.y + 1.5,
        z: m.pos.z,
        tx: p.pos.x,
        ty: p.pos.y + 1,
        tz: p.pos.z,
      });
    }
    return;
  }

  if (hunted && m.anger >= ANGER_CHASE) {
    m.idleT = 0;
    m.state = "chase";
    faceTo(m, p.pos.x, p.pos.z);
    const a = m.def.attack!;
    const reach = a.reach + (m.width + 0.6) / 2;
    if (hd < reach && Math.abs(p.pos.y - m.pos.y) < 2.5) {
      m.speed = 0;
      if (m.attackCd <= 0) {
        m.attackCd = a.cooldown;
        m.swing = 0.3;
        p.damage(a.damage, "attack");
      }
    } else {
      m.speed = m.def.chaseSpeed ?? m.def.walkSpeed;
      if (d <= BOOM_RANGE && hd > reach + 2 && m.boomCd <= 0) {
        m.boomT = BOOM_CHARGE;
        events.emit("sonicCharge", { entity: m });
      }
    }
    return;
  }

  if (m.suspect) {
    const [sx, , sz] = m.suspect;
    if (Math.hypot(sx - m.pos.x, sz - m.pos.z) < 1.5) m.suspect = null;
    else {
      m.state = "follow";
      faceTo(m, sx, sz);
      m.speed = m.def.walkSpeed;
      return;
    }
  }
  m.state = "idle";
  m.speed = 0;
  m.idleT += dt;
  if (m.idleT > DIG_AFTER && m.anger <= 0) {
    events.emit("wardenDig", { entity: m });
    m.dead = true; // hp > 0 — без дропа: закопался
  }
}
