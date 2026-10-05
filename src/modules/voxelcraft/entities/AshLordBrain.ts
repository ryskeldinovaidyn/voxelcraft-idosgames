// Пепельный владыка — иссушитель Minecraft. Призванный сначала 10 секунд набирает силу: неуязвим,
// здоровье растёт от трети до полного, затем взрыв силы 7. Дальше летает над игроком, лечится на 1
// в секунду и стреляет черепами из трёх голов: средняя — в игрока, боковые — в живых не-нежить рядом
// (иначе тоже в игрока). Раненый ломает блоки вокруг себя. На половине здоровья обрастает бронёй:
// стрелы отскакивают (Mob.shielded), летает ниже — до него достаёт меч.
import * as THREE from "three";
import { events } from "../core/EventBus";
import type { Mob } from "./Mob";
import type { MobCtx } from "./MobBrain";

export type AshLordPhase = "charge" | "fight";

export interface AshLordState {
  phase: AshLordPhase;
  /** Секунд в фазе. */
  t: number;
  /** Перезарядка каждой головы: средней, левой, правой. */
  heads: [number, number, number];
  /** Угол облёта вокруг игрока. */
  angle: number;
  /** Пауза до следующего разрушения блоков после удара. */
  breakT: number;
}

/** Сколько длится набор силы. */
export const CHARGE_TIME = 10;
/** Взрыв в конце набора силы. */
export const CHARGE_BLAST = 7;

/** Нежить: её владыка не трогает, как иссушитель в Minecraft. */
const UNDEAD: ReadonlySet<string> = new Set([
  "zombie",
  "skeleton",
  "ash_skeleton",
  "drowned",
  "phantom",
  "hogman_dead",
  "ash_lord",
]);

export function ashLordState(m: Mob): AshLordState {
  m.bossState ??= {
    phase: "fight",
    t: 0,
    heads: [1, 1.7, 2.4],
    angle: Math.random() * Math.PI * 2,
    breakT: 0,
  } satisfies AshLordState;
  return m.bossState as AshLordState;
}

/** Только что призванный: неуязвим и набирает силу (у загруженного из сейва — сразу бой). */
export function startCharge(m: Mob): void {
  const s = ashLordState(m);
  s.phase = "charge";
  s.t = 0;
  m.hp = m.def.hp / 3;
  m.invulnerable = true;
}

/** Где голова i (0 — средняя, 1 — левая, 2 — правая) в мире. */
function headPos(m: Mob, i: number): THREE.Vector3 {
  const side = i === 0 ? 0 : i === 1 ? -0.62 : 0.62;
  const y = m.pos.y + (i === 0 ? 2.55 : 2.35);
  // правая сторона тела при взгляде вдоль yaw: (cos yaw, 0, -sin yaw)
  return new THREE.Vector3(
    m.pos.x + Math.cos(m.yaw) * side,
    y,
    m.pos.z - Math.sin(m.yaw) * side,
  );
}

/** Разбить блоки в коробке вокруг тела (кроме неломаемых). */
function smash(m: Mob, c: MobCtx): void {
  const x0 = Math.floor(m.pos.x) - 1,
    z0 = Math.floor(m.pos.z) - 1,
    y0 = Math.floor(m.pos.y);
  let any = false;
  for (let x = x0; x <= x0 + 2; x++)
    for (let y = y0; y <= y0 + 3; y++)
      for (let z = z0; z <= z0 + 2; z++)
        if (c.breakBlock?.(x, y, z)) any = true;
  if (any) events.emit("ashLordSmash", { entity: m });
}

export function ashLordThink(m: Mob, c: MobCtx, dt: number): void {
  const s = ashLordState(m);
  const p = c.player;
  s.t += dt;

  if (s.phase === "charge") {
    m.speed = 0;
    m.moveYaw = null;
    m.climbWish = 0.4; // медленно поднимается над алтарём
    m.hp = Math.min(
      m.def.hp,
      m.def.hp / 3 + (m.def.hp * 2 * s.t) / (3 * CHARGE_TIME),
    );
    if (s.t >= CHARGE_TIME) {
      c.explode(m.pos.x, m.pos.y + 1.5, m.pos.z, CHARGE_BLAST); // ещё неуязвим — себя не ранит
      m.invulnerable = false;
      m.hp = m.def.hp;
      s.phase = "fight";
      s.t = 0;
      events.emit("ashLordAwake", { entity: m });
    }
    return;
  }

  m.hp = Math.min(m.def.hp, m.hp + dt); // лечится на 1 в секунду
  s.breakT = Math.max(0, s.breakT - dt);
  if (m.justHurt && s.breakT <= 0) {
    s.breakT = 1;
    smash(m, c);
  }
  m.justHurt = false;

  const playerOk = !p.dead && p.mode !== "creative";
  const low = m.shielded();
  // облёт вокруг игрока на 8 блоках, выше его головы (в броне — ниже, чтобы достал меч)
  s.angle += dt * 0.35;
  const r = low ? 4 : 8;
  const tx = playerOk ? p.pos.x + Math.cos(s.angle) * r : m.pos.x;
  const tz = playerOk ? p.pos.z + Math.sin(s.angle) * r : m.pos.z;
  // без цели держит высоту (иначе «4 блока над собой» уводило бы его в небо)
  const ty = playerOk ? p.pos.y + (low ? 1.5 : 4) : m.pos.y;
  const hd = Math.hypot(tx - m.pos.x, tz - m.pos.z);
  // смотрит на игрока, а летит к точке облёта
  if (playerOk)
    m.targetYaw = Math.atan2(-(p.pos.x - m.pos.x), -(p.pos.z - m.pos.z));
  m.speed = hd > 1 ? (m.def.chaseSpeed ?? m.def.walkSpeed) : 0;
  m.moveYaw = hd > 1 ? Math.atan2(-(tx - m.pos.x), -(tz - m.pos.z)) : null;
  m.climbWish = Math.max(-3, Math.min(3, (ty - m.pos.y) * 1.5));

  // черепа: у каждой головы своя перезарядка
  const ranged = m.def.ranged;
  if (!ranged) return;
  for (let i = 0; i < 3; i++) {
    s.heads[i] = Math.max(0, s.heads[i]! - dt);
    if (s.heads[i]! > 0) continue;
    const from = headPos(m, i);
    let aim: THREE.Vector3 | null = null;
    if (i > 0) {
      const prey =
        c.near?.(
          m.pos,
          20,
          (o) => !UNDEAD.has(o.def.name) && !o.def.stationary && !o.def.boss,
        ) ?? null;
      if (prey)
        aim = new THREE.Vector3(
          prey.pos.x,
          prey.pos.y + prey.height / 2,
          prey.pos.z,
        );
    }
    if (!aim && playerOk && from.distanceTo(p.pos) < ranged.range)
      aim = new THREE.Vector3(p.pos.x, p.pos.y + 1.2, p.pos.z);
    if (!aim) continue;
    c.shoot(from, aim, ranged.speed, ranged.damage, m, "skull");
    s.heads[i] = ranged.cooldown + Math.random() * 1.5;
    m.swing = 0.3;
  }
}
