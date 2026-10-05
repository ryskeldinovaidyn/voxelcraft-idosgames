// Глубинник и древний глубинник (страж и древний страж Minecraft). Плавают в толще; видя игрока в
// 16 блоках, замирают и 3 секунды заряжают луч (Mob.beamTo — его рисует Mob), затем бьют: 6 урона,
// древний — 8, броня не спасает. Шипы колют того, кто бьёт рукой, пока луч не заряжается
// (EntityManager.hurt). Древний раз в минуту насылает Усталость III на 5 минут на всех в 50 блоках.
// На суше — бьются на месте, как рыба.
import * as THREE from "three";
import { events } from "../core/EventBus";
import { BLOCKS, B } from "../registry/Blocks";
import { raycastBlocks } from "../world/Raycast";
import type { Mob } from "./Mob";
import type { MobCtx } from "./MobBrain";

/** Сколько заряжается луч, сек. */
export const BEAM_TIME = 3;
const FATIGUE_EVERY = 60;

const wet = (id: number): boolean =>
  id === B.water || !!BLOCKS[id]?.waterlogged;

function sees(c: MobCtx, a: THREE.Vector3, b: THREE.Vector3): boolean {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  return len < 0.01 || !raycastBlocks(c.world, a, d.divideScalar(len), len);
}

/** Бродить в толще воды: курс меняется время от времени, у поверхности — вниз, у дна — вверх. */
function drift(m: Mob, c: MobCtx, dt: number): void {
  m.stateTime -= dt;
  if (m.stateTime <= 0) {
    m.targetYaw = Math.random() * Math.PI * 2;
    m.stateTime = 2 + Math.random() * 3;
    m.speed = Math.random() < 0.3 ? 0 : m.def.walkSpeed;
  }
  const x = Math.floor(m.pos.x),
    z = Math.floor(m.pos.z);
  const head = c.world.getBlock(x, Math.floor(m.pos.y + m.height + 0.3), z);
  const floor = c.world.getBlock(x, Math.floor(m.pos.y - 0.5), z);
  m.climbWish = !wet(head)
    ? -1
    : BLOCKS[floor]?.solid
      ? 0.8
      : Math.sin(m.stateTime * 1.7 + m.id) * 0.4;
  if (m.speed > 0) {
    // упёрся в стену храма или в берег — разворот
    const r = m.width / 2 + 0.6;
    const ax = Math.floor(m.pos.x - Math.sin(m.yaw) * r),
      az = Math.floor(m.pos.z - Math.cos(m.yaw) * r);
    if (!wet(c.world.getBlock(ax, Math.floor(m.pos.y + 0.3), az))) {
      m.targetYaw = m.yaw + Math.PI * (0.5 + Math.random());
      m.speed = 0;
    }
  }
}

export function deepThink(m: Mob, c: MobCtx, dt: number): void {
  const p = c.player;
  const elder = m.def.guardian === "elder";
  const hunting = !p.dead && p.mode !== "creative";

  if (elder) {
    m.fatigueT -= dt;
    if (m.fatigueT <= 0) {
      m.fatigueT = FATIGUE_EVERY;
      if (
        hunting &&
        m.pos.distanceTo(p.pos) < 50 &&
        (p.effects.get("mining_fatigue")?.time ?? 0) < 60
      ) {
        p.addEffect("mining_fatigue", 300, 3);
        events.emit("elderCurse", { entity: m });
      }
    }
  }

  if (!m.inWater) {
    // на суше: бьётся на месте
    m.speed = 0;
    m.beamT = 0;
    m.beamTo = null;
    if (m.onGround && Math.random() < dt * 2) m.vel.y = 4;
    return;
  }

  const eye = new THREE.Vector3(m.pos.x, m.pos.y + m.height / 2, m.pos.z);
  const target = new THREE.Vector3(p.pos.x, p.pos.y + 1, p.pos.z);
  if (
    hunting &&
    eye.distanceTo(target) < (m.def.follow ?? 16) &&
    sees(c, eye, target)
  ) {
    // замер и заряжает луч, не сводя глаз
    m.speed = 0;
    m.climbWish = Math.max(-1, Math.min(1, (target.y - eye.y) * 0.5));
    m.targetYaw = m.yaw = Math.atan2(
      -(p.pos.x - m.pos.x),
      -(p.pos.z - m.pos.z),
    );
    m.beamTo = target;
    m.beamT += dt;
    if (m.beamT >= BEAM_TIME) {
      p.damage(elder ? 8 : 6, "beam");
      m.beamT = 0;
      events.emit("beamHit", { entity: m });
    }
    return;
  }
  m.beamT = 0;
  m.beamTo = null;
  drift(m, c, dt);
}
