// Панцирник (шалкер Minecraft): сидит на блоке. Видит игрока в 16 блоках — приоткрывается и раз в
// 1–5.5 с пускает самонаводящуюся пулю (Fireball, вид bullet: урон и Левитация 10 с). Закрытый —
// стрелы отскакивают (Mob.shielded). Раненый ниже половины здоровья с шансом перескакивает на
// другой пол рядом, как в Minecraft.
import * as THREE from "three";
import { events } from "../core/EventBus";
import { BLOCKS } from "../registry/Blocks";
import { raycastBlocks } from "../world/Raycast";
import type { Mob } from "./Mob";
import type { MobCtx } from "./MobBrain";

/** Прямая видимость (без блоков на пути). */
function sees(c: MobCtx, a: THREE.Vector3, b: THREE.Vector3): boolean {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  return len < 0.01 || !raycastBlocks(c.world, a, d.divideScalar(len), len);
}

/** Перескок: свободная клетка с полом в 8 блоках. */
function hop(m: Mob, c: MobCtx): void {
  for (let i = 0; i < 16; i++) {
    const x = Math.floor(m.pos.x + (Math.random() - 0.5) * 16),
      z = Math.floor(m.pos.z + (Math.random() - 0.5) * 16),
      y = Math.floor(m.pos.y + (Math.random() - 0.5) * 8);
    if (
      !BLOCKS[c.world.getBlock(x, y - 1, z)]?.solid ||
      c.world.getBlock(x, y, z) !== 0
    )
      continue;
    m.pos.set(x + 0.5, y, z + 0.5);
    m.prevPos.copy(m.pos);
    m.peek = 0;
    events.emit("mobTeleport", { entity: m });
    return;
  }
}

export function shellThink(m: Mob, c: MobCtx, dt: number): void {
  const p = c.player;
  const r = m.def.ranged;
  const eye = new THREE.Vector3(m.pos.x, m.pos.y + 0.5, m.pos.z);
  const target = new THREE.Vector3(p.pos.x, p.pos.y + 1, p.pos.z);
  const see =
    !p.dead &&
    p.mode !== "creative" &&
    eye.distanceTo(target) < (r?.range ?? 16) &&
    sees(c, eye, target);
  m.peek = Math.max(0, Math.min(1, m.peek + (see ? 2 : -1.5) * dt));
  if (see)
    m.targetYaw = m.yaw = Math.atan2(
      -(p.pos.x - m.pos.x),
      -(p.pos.z - m.pos.z),
    );
  if (m.justHurt) {
    m.justHurt = false;
    if (m.hp < m.def.hp / 2 && Math.random() < 0.5) return hop(m, c);
  }
  if (!r || !see || m.peek < 0.6 || m.shootCd > 0) return;
  c.shoot(
    eye.clone().setY(eye.y + 0.3),
    target,
    r.speed,
    r.damage,
    m,
    "bullet",
  );
  m.shootCd = 1 + Math.random() * 4.5;
  m.swing = 0.3;
}
