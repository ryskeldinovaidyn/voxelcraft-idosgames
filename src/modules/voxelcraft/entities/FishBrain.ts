// Иглобрюх, как в Minecraft: игрок ближе 2.5 блока — раздувается (Mob.peek, Mob рисует его шаром),
// раздутый колет вплотную: 1 урон и Отравление. Отошёл — медленно сдувается. Плавает обычный мозг.
import { events } from "../core/EventBus";
import type { Mob } from "./Mob";
import type { MobCtx } from "./MobBrain";

const PUFF_RANGE = 2.5;

export function puffTick(m: Mob, c: MobCtx, dt: number): void {
  const p = c.player;
  const hunting = !p.dead && p.mode !== "creative";
  const d = m.pos.distanceTo(p.pos);
  m.peek = Math.max(
    0,
    Math.min(
      1,
      m.peek + (hunting && m.inWater && d < PUFF_RANGE ? 3 : -0.6) * dt,
    ),
  );
  if (!hunting || m.peek < 0.8 || m.attackCd > 0 || d > 1.3) return;
  m.attackCd = 1;
  p.damage(1, "attack");
  if (!p.dead) p.addEffect("poison", 7);
  events.emit("mobAttack", { entity: m });
}
