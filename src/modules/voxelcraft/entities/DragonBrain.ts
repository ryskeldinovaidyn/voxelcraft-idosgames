// Дракон Предела — машина фаз, как в Minecraft: кружит над колоннами, заходит сверху и плюётся
// огненными шарами, таранит игрока, садится на фонтан и дышит. Пока цел хоть один Кристалл
// Предела рядом, дракон лечится. Ломает на пути всё, кроме камня Предела, обсидиана и бедрока.
// Мозг задаёт курс (targetYaw, speed, climbWish), полёт сквозь блоки делает Mob (noClip).
import * as THREE from "three";
import { events } from "../core/EventBus";
import { BLOCKS, B } from "../registry/Blocks";
import { ISLAND_Y } from "../worldgen/beyond/BeyondGenerator";
import type { Mob } from "./Mob";
import type { MobCtx } from "./MobBrain";

export type DragonPhase = "circle" | "strafe" | "charge" | "perch" | "dying";

export interface DragonState {
  phase: DragonPhase;
  /** Секунд в текущей фазе. */
  t: number;
  /** Угол на круге облёта. */
  angle: number;
  shots: number;
  breathT: number;
}

const CIRCLE_R = 48;
const SPEED = 9;
/** Сколько длится смерть (подъём и мерцание) до победы. */
export const DYING_TIME = 4;

let immune: Set<number> | null = null;
/** Что дракон не ломает. */
function isImmune(id: number): boolean {
  immune ??= new Set(
    [
      B.beyond_stone,
      B.obsidian,
      B.bedrock,
      B.rim_frame,
      B.beyond_portal,
      B.dragon_egg,
    ].filter((v): v is number => v !== undefined),
  );
  return immune.has(id);
}

export function dragonState(m: Mob): DragonState {
  m.bossState ??= {
    phase: "circle",
    t: 0,
    angle: Math.atan2(m.pos.z, m.pos.x),
    shots: 0,
    breathT: 0,
  } satisfies DragonState;
  return m.bossState as DragonState;
}

function steer(m: Mob, x: number, y: number, z: number, speed = SPEED): void {
  m.targetYaw = Math.atan2(-(x - m.pos.x), -(z - m.pos.z));
  m.speed = speed;
  m.climbWish = Math.max(-6, Math.min(6, (y - m.pos.y) * 1.2));
}

/** Ломает блоки, в которые влетел (без дропа). */
function smash(m: Mob, c: MobCtx): void {
  const w = m.width / 2;
  for (let x = Math.floor(m.pos.x - w); x <= Math.floor(m.pos.x + w); x++)
    for (let y = Math.floor(m.pos.y); y <= Math.floor(m.pos.y + m.height); y++)
      for (let z = Math.floor(m.pos.z - w); z <= Math.floor(m.pos.z + w); z++) {
        const id = c.world.getBlock(x, y, z);
        if (id !== 0 && !isImmune(id) && !BLOCKS[id]?.liquid)
          c.world.setBlock(x, y, z, B.air!);
      }
}

/** Лечение от ближайшего Кристалла в 48 блоках: 2 здоровья в секунду. */
function heal(m: Mob, c: MobCtx, dt: number): void {
  let best: Mob | null = null;
  let bd = 48 * 48;
  for (const k of c.crystals()) {
    const d = k.pos.distanceToSquared(m.pos);
    if (d < bd) {
      bd = d;
      best = k;
    }
  }
  m.healFrom = best ? best.id : null;
  if (best) m.hp = Math.min(m.def.hp, m.hp + 2 * dt);
}

export function dragonThink(m: Mob, c: MobCtx, dt: number): void {
  // уже умер — ни шагу больше: иначе каждый лишний тик до удаления снова объявлял бы победу
  if (m.dead) return;
  const s = dragonState(m);
  const p = c.player;
  s.t += dt;

  if (m.hp <= 0 && s.phase !== "dying") {
    s.phase = "dying";
    s.t = 0;
    m.healFrom = null;
    events.emit("dragonDying", { entity: m });
  }
  if (s.phase === "dying") {
    m.speed = 0;
    m.climbWish = 1.5;
    m.flash = 0.3;
    if (s.t >= DYING_TIME) {
      m.dead = true;
      events.emit("dragonDefeated", { x: m.pos.x, y: m.pos.y, z: m.pos.z });
    }
    return;
  }

  heal(m, c, dt);
  smash(m, c);
  const playerOk = !p.dead && p.mode !== "creative";
  const next = (phase: DragonPhase) => {
    s.phase = phase;
    s.t = 0;
    s.shots = 0;
  };

  switch (s.phase) {
    case "circle": {
      s.angle += dt * (SPEED / CIRCLE_R);
      steer(
        m,
        Math.cos(s.angle) * CIRCLE_R,
        80 + Math.sin(s.angle * 2) * 8,
        Math.sin(s.angle) * CIRCLE_R,
      );
      if (s.t > 10) {
        const r = Math.random();
        next(
          !playerOk
            ? r < 0.3
              ? "perch"
              : "circle"
            : r < 0.45
              ? "strafe"
              : r < 0.8
                ? "charge"
                : "perch",
        );
      }
      break;
    }
    case "strafe": {
      // заходит сверху и плюётся шарами — три за заход
      steer(m, p.pos.x, p.pos.y + 20, p.pos.z);
      if (playerOk && s.shots < 3 && s.t > 1.5 + s.shots * 1.2) {
        const eye = new THREE.Vector3(
          m.pos.x,
          m.pos.y + m.height * 0.5,
          m.pos.z,
        );
        c.shoot(
          eye,
          new THREE.Vector3(p.pos.x, p.pos.y + 1, p.pos.z),
          14,
          6,
          m,
          "fireball",
        );
        s.shots++;
      }
      if (s.t > 6) next("circle");
      break;
    }
    case "charge": {
      steer(m, p.pos.x, p.pos.y + 1, p.pos.z, SPEED * 1.6);
      if (playerOk && m.pos.distanceTo(p.pos) < 4) {
        p.damage(10, "attack");
        const dir = p.pos.clone().sub(m.pos).setY(0);
        if (dir.lengthSq() > 1e-6) dir.normalize();
        p.knock(dir.x, dir.z, 14);
        p.vel.y = 9;
        events.emit("mobAttack", { entity: m });
        next("circle");
      }
      if (s.t > 8) next("circle");
      break;
    }
    case "perch": {
      // садится на фонтан и дышит на всех рядом — тут до головы можно дотянуться мечом
      const perch = new THREE.Vector3(0, ISLAND_Y + 5, 0);
      if (m.pos.distanceTo(perch) > 2.5)
        steer(m, perch.x, perch.y, perch.z, SPEED * 0.8);
      else {
        m.speed = 0;
        m.climbWish = (perch.y - m.pos.y) * 1.2;
        s.breathT -= dt;
        if (playerOk && s.breathT <= 0 && p.pos.distanceTo(perch) < 10) {
          s.breathT = 1;
          p.damage(3, "attack");
        }
      }
      if (s.t > 14) next("circle");
      break;
    }
  }
}
