// Ворожей (заклинатель Minecraft): держит дистанцию — ближе 6 блоков пятится, дальше 10 подходит.
// Раз в 5 с колдует: нет живых бесят — призывает трёх (живут 30–120 с), иначе пускает к игроку
// линию клыков из земли (entities/Fang: 6 урона магией). Без игрока рядом — идёт к цели набега.
import { events } from "../core/EventBus";
import type { Mob } from "./Mob";
import type { MobCtx } from "./MobBrain";

const CAST_EVERY = 5;

export function conjurerThink(m: Mob, c: MobCtx, dt: number): void {
  const p = c.player;
  const d = m.pos.distanceTo(p.pos);
  m.castT -= dt;
  m.minions = m.minions.filter((w) => !w.dead);
  if (p.dead || p.mode === "creative" || d > (m.def.follow ?? 16)) {
    const g = m.goal;
    if (g && Math.hypot(g.x - m.pos.x, g.z - m.pos.z) > 6) {
      m.targetYaw = Math.atan2(-(g.x - m.pos.x), -(g.z - m.pos.z));
      m.speed = m.def.walkSpeed;
    } else m.speed = 0;
    return;
  }
  m.targetYaw = Math.atan2(-(p.pos.x - m.pos.x), -(p.pos.z - m.pos.z));
  m.speed = d < 6 ? -m.def.fleeSpeed : d > 10 ? m.def.walkSpeed : 0;
  if (m.castT > 0) return;
  m.castT = CAST_EVERY;
  m.swing = 0.6;
  if (m.minions.length === 0 && c.summon) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const w = c.summon(
        "wisp",
        m.pos.x + Math.cos(a),
        m.pos.y + 1.2,
        m.pos.z + Math.sin(a),
      );
      if (w) m.minions.push(w);
    }
    events.emit("conjurerCast", { entity: m, spell: "wisps" });
  } else {
    c.fangs?.(m.pos, p.pos, m);
    events.emit("conjurerCast", { entity: m, spell: "fangs" });
  }
}
