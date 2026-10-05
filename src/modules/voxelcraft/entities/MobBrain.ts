// Поведение мобов — один «мозг» на всех, параметризованный описанием (registry/mobs): мирные бродят,
// убегают от удара, идут за едой в руке игрока и размножаются; враждебные преследуют и бьют,
// стреляют (скелет), подрываются (Шипун); паук на свету нейтрален, Тенеход злится на взгляд и
// телепортируется, нежить горит на солнце. Мозг задаёт мобу желаемые направление и скорость, а
// физику и анимацию делает сам Mob.
import * as THREE from "three";
import { rules } from "../systems/Difficulty";
import { events } from "../core/EventBus";
import { BLOCKS, B } from "../registry/Blocks";
import { raycastBlocks } from "../world/Raycast";
import { isHive } from "../world/Hive";
import type { ChunkManager } from "../world/ChunkManager";
import type { Player } from "../player/Player";
import type { Mob } from "./Mob";
import { dragonThink } from "./DragonBrain";
import { ashLordThink } from "./AshLordBrain";
import { shellThink } from "./ShellBrain";
import { deepThink } from "./DeepBrain";
import { puffTick } from "./FishBrain";
import { conjurerThink } from "./IllagerBrain";
import { wardenThink } from "./WardenBrain";
import { goatTick } from "./GoatBrain";
import { tongueTick } from "./FrogBrain";
import { sniffTick } from "./SnifferBrain";
import { snowGolemTick } from "./SnowGolemBrain";
import { allayThink } from "./AllayBrain";

export interface MobCtx {
  world: ChunkManager;
  player: Player;
  isDay: boolean;
  /** На сколько уровней ночь гасит небесный свет (0 днём, 11 ночью). */
  skyDarken: number;
  /** Идёт дождь — нежить на солнце не горит. */
  raining?: boolean;
  /** Что в руке у игрока — приманка мирных. */
  heldItem: string | null;
  shoot(
    from: THREE.Vector3,
    to: THREE.Vector3,
    speed: number,
    damage: number,
    shooter: Mob,
    kind?:
      | "arrow"
      | "fireball"
      | "small_fireball"
      | "potion"
      | "skull"
      | "bullet"
      | "wind_charge"
      | "snowball"
      | "spit",
  ): void;
  /** Призвать моба (ворожей — бесят). */
  summon?(type: string, x: number, y: number, z: number): Mob | null;
  /** Клыки из земли линией от from к to (ворожей). */
  fangs?(from: THREE.Vector3, to: THREE.Vector3, owner: Mob): void;
  /** Сломать блок с дропом (Пепельный владыка); false — пусто или неломаемый. */
  breakBlock?(x: number, y: number, z: number): boolean;
  explode(x: number, y: number, z: number, power: number): void;
  findMate(mob: Mob): Mob | null;
  breed(a: Mob, b: Mob): void;
  /** Живые Кристаллы Предела (лечат дракона). */
  crystals(): Mob[];
  /** Живой моб по id (цель ручного волка). */
  mob?(id: number): Mob | null;
  /** Житель, убитый зомби, встаёт зомби-жителем (systems/Zombify). */
  convert?(villager: Mob): Mob | null;
  /** Первый живой моб в радиусе r, подходящий под условие (кошка рядом с Шипуном). */
  near?(pos: THREE.Vector3, r: number, pred: (m: Mob) => boolean): Mob | null;
  /** Ближайший выпавший предмет этого вида в радиусе r, который уже можно подобрать (дух-помощник). */
  nearDrop?(
    pos: THREE.Vector3,
    r: number,
    item: string,
  ): { id: number; pos: THREE.Vector3 } | null;
  /** Забрать из выпавшего стака до max штук. @returns сколько забрано */
  takeDrop?(id: number, max: number): number;
  /** Выронить стак (дух отдаёт собранное). */
  giveDrop?(x: number, y: number, z: number, item: string, count: number): void;
}

/** Лететь к точке: повернуться, скорость, высота. @returns расстояние до неё */
function flyTo(m: Mob, x: number, y: number, z: number): number {
  face(m, x, z);
  const hd = Math.hypot(x - m.pos.x, z - m.pos.z);
  m.speed = hd > 0.3 ? m.def.walkSpeed : 0;
  hover(m, y);
  return Math.hypot(hd, y - m.pos.y);
}

/** Ближайший цветок в кубе радиуса r вокруг точки (по высоте ±3). */
function findFlower(
  w: ChunkManager,
  p: THREE.Vector3,
  r: number,
): [number, number, number] | null {
  const cx = Math.floor(p.x),
    cy = Math.floor(p.y),
    cz = Math.floor(p.z);
  let best: [number, number, number] | null = null,
    bd = Infinity;
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) {
        const id = w.getBlock(cx + dx, cy + dy, cz + dz);
        if (id !== B.flower_yellow && id !== B.flower_red) continue;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bd) {
          bd = d;
          best = [cx + dx, cy + dy, cz + dz];
        }
      }
  return best;
}

/**
 * Пчела, как в Minecraft: ищет цветок, 2 с собирает пыльцу и летит в свой улей (с пыльцой, ночью и в
 * дождь), влетает — улей её прячет (событие beeEnter, блочная сущность hive). Без улья бродит.
 */
function beeThink(m: Mob, c: MobCtx, dt: number): void {
  if (m.home && !isHive(c.world.getBlock(m.home[0], m.home[1], m.home[2])))
    m.home = null; // улей сломали
  if (m.home && (m.pollen || !c.isDay || c.raining)) {
    const [hx, hy, hz] = m.home;
    if (flyTo(m, hx + 0.5, hy + 0.5, hz + 0.5) < 1.3) {
      events.emit("beeEnter", { x: hx, y: hy, z: hz, pollen: m.pollen });
      m.dead = true; // hp > 0 — без дропа: пчела теперь в улье
    }
    return;
  }
  m.beeT -= dt;
  if (!m.beeTarget && m.beeT <= 0) {
    m.beeTarget = findFlower(c.world, m.pos, 8);
    m.beeT = 4;
  }
  const t = m.beeTarget;
  if (t) {
    const id = c.world.getBlock(t[0], t[1], t[2]);
    if (id !== B.flower_yellow && id !== B.flower_red) m.beeTarget = null;
    else if (flyTo(m, t[0] + 0.5, t[1] + 0.6, t[2] + 0.5) < 0.9) {
      m.speed = 0;
      m.beeWork += dt;
      if (m.beeWork > 2) {
        m.pollen = true;
        m.beeTarget = null;
        m.beeWork = 0;
      }
    }
    return;
  }
  wander(m, dt);
  hover(m, groundBelow(c.world, m) + 1.5);
}

/**
 * Ручное животное: сидит — стоит; у волка есть цель — бежит и кусает; иначе идёт за игроком, а
 * дальше 12 блоков — телепортируется к нему (как в Minecraft).
 */
function petThink(m: Mob, c: MobCtx, dt: number, hd: number): void {
  const d = m.def,
    p = c.player;
  if (m.sitting) {
    m.speed = 0;
    m.state = "idle";
    return;
  }
  // попугай: рядом с хозяином — на свободное плечо (занятое мёртвым или пропавшим — свободно)
  if (
    d.shoulderPet &&
    !p.dead &&
    !p._sneaking &&
    m.shoulderCd <= 0 &&
    hd < 1.5 &&
    Math.abs(p.pos.y + 1 - m.pos.y) < 2
  ) {
    const slot = p.shoulders.findIndex((id) => id === null || !c.mob?.(id));
    if (slot === 0 || slot === 1) {
      p.shoulders[slot] = m.id;
      m.onShoulder = slot;
      events.emit("parrotShoulder", { entity: m });
      return;
    }
  }
  if (d.guards && m.targetId !== null) {
    const t = c.mob?.(m.targetId) ?? null;
    if (!t || t.tamed || t.pos.distanceTo(m.pos) > 24) m.targetId = null;
    else {
      m.state = "chase";
      face(m, t.pos.x, t.pos.z);
      m.speed = d.chaseSpeed ?? d.walkSpeed * 1.5;
      const th = Math.hypot(t.pos.x - m.pos.x, t.pos.z - m.pos.z);
      if (
        d.attack &&
        m.attackCd <= 0 &&
        th < d.attack.reach + (m.width + t.width) / 2 &&
        Math.abs(t.pos.y - m.pos.y) < 2
      ) {
        m.attackCd = d.attack.cooldown;
        m.swing = 0.3;
        t.hurt(d.attack.damage, m.pos, false);
        events.emit("mobAttackMob", { entity: m, target: t });
      }
      avoidEdges(m, c);
      return;
    }
  }
  if (p.dead) return wander(m, dt);
  if (hd > 12) {
    // отстал — к хозяину: свободная клетка с полом рядом с ним
    for (let k = 0; k < 8; k++) {
      const x = Math.floor(p.pos.x + (Math.random() - 0.5) * 4),
        z = Math.floor(p.pos.z + (Math.random() - 0.5) * 4),
        y = Math.floor(p.pos.y);
      if (!BLOCKS[c.world.getBlock(x, y - 1, z)]?.solid) continue;
      if (
        c.world.getBlock(x, y, z) !== 0 ||
        c.world.getBlock(x, y + 1, z) !== 0
      )
        continue;
      m.pos.set(x + 0.5, y, z + 0.5);
      m.prevPos.copy(m.pos);
      m.vel.set(0, 0, 0);
      events.emit("mobTeleport", { entity: m });
      return;
    }
  }
  if (hd > 3) {
    m.state = "follow";
    face(m, p.pos.x, p.pos.z);
    m.speed = d.chaseSpeed ?? d.walkSpeed * 1.5;
    avoidEdges(m, c);
    return;
  }
  m.state = "idle";
  m.speed = 0;
}

/** Разбойник бежит к жителю (голему) и бьёт его своим ударом. */
function huntMob(m: Mob, prey: Mob, c?: MobCtx): void {
  const a = m.def.attack!;
  m.state = "chase";
  face(m, prey.pos.x, prey.pos.z);
  m.speed = m.def.chaseSpeed ?? m.def.walkSpeed * 1.5;
  const reach = a.reach + (m.width + prey.width) / 2;
  if (
    m.attackCd <= 0 &&
    Math.hypot(prey.pos.x - m.pos.x, prey.pos.z - m.pos.z) < reach &&
    Math.abs(prey.pos.y - m.pos.y) < 2
  ) {
    m.attackCd = a.cooldown;
    m.swing = 0.3;
    prey.hurt(a.damage, m.pos, false);
    events.emit("mobAttackMob", { entity: m, target: prey });
    // зомби не убивает жителя насмерть: тот встаёт зомби-жителем (systems/Zombify)
    // житель встаёт зомби-жителем по правилу сложности (systems/Difficulty)
    if (prey.hp <= 0 && m.def.turnsVillagers && Math.random() < rules().zombify)
      c?.convert?.(prey);
  }
}

/** Громила топчет листву и посевы перед собой. */
function trample(m: Mob, c: MobCtx): void {
  const r = m.width / 2 + 0.4;
  const fx = m.pos.x - Math.sin(m.yaw) * r,
    fz = m.pos.z - Math.cos(m.yaw) * r;
  for (let y = Math.floor(m.pos.y); y <= Math.floor(m.pos.y + m.height); y++)
    for (const [ox, oz] of [
      [0, 0],
      [0.8, 0],
      [-0.8, 0],
      [0, 0.8],
      [0, -0.8],
    ] as const) {
      const x = Math.floor(fx + ox),
        z = Math.floor(fz + oz);
      const b = BLOCKS[c.world.getBlock(x, y, z)];
      if (b && (b.name.endsWith("leaves") || b.shape === "crop"))
        c.breakBlock?.(x, y, z);
    }
}

/** Эффективный свет в точке (0..15): небо с поправкой на ночь или свет блоков. */
export function lightLevel(
  world: ChunkManager,
  x: number,
  y: number,
  z: number,
  skyDarken: number,
): number {
  const l = world.getLight(Math.floor(x), Math.floor(y), Math.floor(z));
  return Math.max((l >> 4) - skyDarken, l & 15);
}

/** Прямая видимость между точками (без блоков на пути). */
export function canSee(
  world: ChunkManager,
  a: THREE.Vector3,
  b: THREE.Vector3,
): boolean {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  if (len < 0.01) return true;
  d.divideScalar(len);
  return !raycastBlocks(world, a, d, len);
}

function face(m: Mob, x: number, z: number): void {
  m.targetYaw = Math.atan2(-(x - m.pos.x), -(z - m.pos.z));
}

function turnAround(m: Mob): void {
  m.targetYaw = m.yaw + Math.PI * (0.5 + Math.random());
  m.speed = 0;
}

/** Летун держит высоту: к targetY с ограниченной вертикальной скоростью. */
function hover(m: Mob, targetY: number, max = 2): void {
  m.climbWish = Math.max(-max, Math.min(max, (targetY - m.pos.y) * 1.5));
}

/** Пловец в воде: бродит в толще, не всплывает выше воды и не выходит на берег (спрут, дельфин). */
function swim(m: Mob, c: MobCtx, dt: number): void {
  wander(m, dt);
  const x = Math.floor(m.pos.x),
    z = Math.floor(m.pos.z);
  const head = c.world.getBlock(x, Math.floor(m.pos.y + m.height + 0.2), z);
  const floor = c.world.getBlock(x, Math.floor(m.pos.y - 0.3), z);
  m.climbWish =
    head !== B.water
      ? -1
      : BLOCKS[floor]?.solid
        ? 0.8
        : Math.sin(m.stateTime * 1.3 + m.id) * 0.6;
  if (m.speed > 0) {
    const r = m.width / 2 + 0.6;
    const ax = Math.floor(m.pos.x - Math.sin(m.yaw) * r),
      az = Math.floor(m.pos.z - Math.cos(m.yaw) * r);
    if (c.world.getBlock(ax, Math.floor(m.pos.y + 0.3), az) !== B.water)
      turnAround(m);
  }
}

/** Высота пола под мобом (первый твёрдый блок ниже, в пределах 24). */
function groundBelow(world: ChunkManager, m: Mob): number {
  const x = Math.floor(m.pos.x),
    z = Math.floor(m.pos.z);
  for (let y = Math.floor(m.pos.y); y > Math.floor(m.pos.y) - 24 && y > 0; y--)
    if (BLOCKS[world.getBlock(x, y - 1, z)]?.solid) return y;
  return m.pos.y - 4;
}

/** Не шагать в лаву и с обрыва выше 3 блоков. */
function avoidEdges(m: Mob, c: MobCtx): void {
  if (m.def.flies || m.speed <= 0 || !m.onGround) return;
  const ax = Math.floor(m.pos.x - Math.sin(m.yaw) * 0.9),
    az = Math.floor(m.pos.z - Math.cos(m.yaw) * 0.9),
    fy = Math.floor(m.pos.y);
  const at = (y: number) => c.world.getBlock(ax, y, az);
  if (at(fy) === B.lava || at(fy - 1) === B.lava) return turnAround(m);
  let drop = 0;
  for (let y = fy - 1; y >= fy - 4; y--) {
    const b = at(y);
    if (b !== 0 && (BLOCKS[b]!.solid || BLOCKS[b]!.liquid)) break;
    drop++;
  }
  if (drop >= 4) {
    if (m.state === "chase") m.speed = 0;
    else turnAround(m);
  }
}

function wander(m: Mob, dt: number): void {
  if (m.state !== "idle" && m.state !== "wander") {
    m.state = "idle";
    m.stateTime = 1 + Math.random() * 2;
  }
  m.stateTime -= dt;
  if (m.stateTime <= 0) {
    if (m.state === "wander") {
      m.state = "idle";
      m.stateTime = 1 + Math.random() * 3;
    } else {
      m.state = "wander";
      m.targetYaw = Math.random() * Math.PI * 2;
      m.stateTime = 1.5 + Math.random() * 2.5;
    }
  }
  m.speed = m.state === "wander" ? m.def.walkSpeed : 0;
}

/** Тенеход: прыгнуть в случайную точку рядом, где есть пол и место на рост. */
function teleportAway(m: Mob, c: MobCtx): void {
  for (let tries = 0; tries < 16; tries++) {
    const x = Math.floor(m.pos.x + (Math.random() - 0.5) * 32),
      z = Math.floor(m.pos.z + (Math.random() - 0.5) * 32);
    for (let y = Math.floor(m.pos.y) + 8; y > Math.floor(m.pos.y) - 8; y--) {
      const below = c.world.getBlock(x, y - 1, z);
      if (!BLOCKS[below]?.solid) continue;
      if ([0, 1, 2].every((dy) => c.world.getBlock(x, y + dy, z) === 0)) {
        m.pos.set(x + 0.5, y, z + 0.5);
        m.prevPos.copy(m.pos);
        m.vel.set(0, 0, 0);
        events.emit("mobTeleport", { entity: m });
        return;
      }
    }
  }
}

function chase(
  m: Mob,
  c: MobCtx,
  dt: number,
  dx: number,
  dz: number,
  hd: number,
  dist: number,
  eye: THREE.Vector3,
  target: THREE.Vector3,
): void {
  const d = m.def,
    p = c.player;
  const speed = d.chaseSpeed ?? d.walkSpeed * 1.5;
  m.state = "chase";
  face(m, p.pos.x, p.pos.z);
  // утопленник в воде гонится и по высоте
  if (d.swims && m.inWater)
    m.climbWish = Math.max(-2, Math.min(2, (p.pos.y - m.pos.y) * 1.5));

  if (d.explode) {
    const e = d.explode;
    // Шипун боится кошек: рядом кошка — уходит от неё, фитиль гаснет
    const cat = c.near?.(m.pos, 6, (o) => !!o.def.scaresBombers) ?? null;
    if (cat) {
      m.state = "chase";
      m.targetYaw = Math.atan2(cat.pos.x - m.pos.x, cat.pos.z - m.pos.z);
      m.speed = d.fleeSpeed;
      m.fuse = 0;
      avoidEdges(m, c);
      return;
    }
    if (dist < e.radius) {
      m.speed = 0;
      m.fuse += dt;
      if (m.fuse >= e.fuse) {
        m.exploded = true;
        m.dead = true;
        c.explode(m.pos.x, m.pos.y + 0.5, m.pos.z, e.power);
      }
      return;
    }
    m.fuse = Math.max(0, m.fuse - dt);
    m.speed = speed;
    avoidEdges(m, c);
    return;
  }

  if (d.ranged) {
    const r = d.ranged;
    const sees = canSee(c.world, eye, target);
    m.speed =
      !sees || hd > r.range * 0.7
        ? speed
        : hd < r.range * 0.35
          ? -speed * 0.6
          : 0;
    if (sees && dist < r.range && m.shootCd <= 0) {
      // залп (Пламень — три шара): первый точно в цель, остальные с разбросом
      for (let i = 0; i < (r.volley ?? 1); i++) {
        const aim = i
          ? target
              .clone()
              .add(
                new THREE.Vector3(
                  (Math.random() - 0.5) * 1.5,
                  (Math.random() - 0.5) * 1,
                  (Math.random() - 0.5) * 1.5,
                ),
              )
          : target;
        c.shoot(eye, aim, r.speed, r.damage, m, r.projectile ?? "arrow");
      }
      m.shootCd = r.cooldown;
      m.swing = 0.3;
    }
    avoidEdges(m, c);
    return;
  }

  m.speed = speed;
  avoidEdges(m, c);
  if (
    d.attack &&
    m.attackCd <= 0 &&
    hd < d.attack.reach + m.width / 2 &&
    Math.abs(p.pos.y - m.pos.y) < 2
  ) {
    m.attackCd = d.attack.cooldown;
    m.swing = 0.3;
    // щит спереди принимает удар целиком — ни урона, ни эффекта
    // урон мобов зависит от сложности (systems/Difficulty): на мирной они не бьют вовсе
    const hit = Math.round(d.attack.damage * rules().mobDamage);
    if (hit > 0 && !p.shieldBlocks(m.pos, hit)) {
      p.damage(hit, "attack");
      if (d.attack.effect && !p.dead)
        p.addEffect(d.attack.effect.id, d.attack.effect.seconds);
    }
    p.knock(dx / hd, dz / hd, d.attack.knock ?? 6);
    events.emit("mobAttack", { entity: m });
    if (d.diesOnAttack) m.dead = true; // пчела, ужалив, погибает
  }
}

/** Решение на тик: куда смотреть, с какой скоростью идти, кого атаковать. */
export function think(m: Mob, c: MobCtx, dt: number): void {
  if (m.migrationTarget && m.hitByPlayerT <= 0 && !m.tamed) {
    const [x, z] = m.migrationTarget;
    m.state = "wander";
    face(m, x, z);
    const directYaw = m.targetYaw;
    if (m.migrationDetourT > 0) {
      m.migrationDetourT = Math.max(0, m.migrationDetourT - dt);
      m.targetYaw = directYaw + m.migrationDetourSide * 0.9;
    }
    m.speed = m.def.walkSpeed * (0.82 + (m.id % 5) * 0.04);
    avoidEdges(m, c);
    if (m.speed === 0 && m.onGround) {
      if (m.migrationDetourT > 0) m.migrationDetourSide *= -1;
      else m.migrationDetourSide = m.id % 2 ? 1 : -1;
      m.migrationDetourT = 1.5 + (m.id % 3) * 0.4;
    }
    return;
  }
  if (m.def.boss === "dragon") {
    dragonThink(m, c, dt);
    return;
  }
  if (m.def.boss === "ash_lord") {
    ashLordThink(m, c, dt);
    return;
  }
  if (m.def.shell) {
    shellThink(m, c, dt);
    return;
  }
  if (m.def.guardian) {
    deepThink(m, c, dt);
    return;
  }
  if (m.def.warden) {
    wardenThink(m, c, dt);
    return;
  }
  if (m.def.rams && goatTick(m, c, dt)) return; // коза таранит — обычный мозг ждёт
  if (m.def.tongue && tongueTick(m, c, dt)) return; // лягушка ест
  if (m.def.sniffs && sniffTick(m, c, dt)) return; // нюхач роет
  if (m.def.throwsSnow && snowGolemTick(m, c, dt)) return; // снеговик обстреливает врага
  if (m.def.puffs) puffTick(m, c, dt); // раздуться и уколоть; плавает дальше обычный мозг
  if (m.def.conjurer) {
    conjurerThink(m, c, dt);
    return;
  }
  if (m.def.tramples && m.speed !== 0) trample(m, c);
  // аксолотль в воде охотится на рыб и подводных врагов
  // аксолотль охотится в воде (8 блоков), зомби — на суше и дальше (huntsLand), как разбойники
  if (m.def.hunts && m.def.attack && (m.inWater || m.def.huntsLand)) {
    const prey =
      c.near?.(
        m.pos,
        m.def.huntsLand ? 24 : 8,
        (o) => !o.dead && m.def.hunts!.includes(o.def.name),
      ) ?? null;
    if (prey) {
      huntMob(m, prey, c);
      return;
    }
    // жителей не видно, но есть цель (осада: центр деревни) — идти к ней
    const g = m.goal;
    if (g && m.def.huntsLand && Math.hypot(g.x - m.pos.x, g.z - m.pos.z) > 6) {
      m.state = "chase";
      face(m, g.x, g.z);
      m.speed = m.def.walkSpeed * 1.4;
      avoidEdges(m, c);
      return;
    }
  }
  const d = m.def,
    p = c.player;
  const eye = new THREE.Vector3(
    m.pos.x,
    m.pos.y + m.height * (d.eye ?? 0.85),
    m.pos.z,
  );
  const target = new THREE.Vector3(p.pos.x, p.pos.y + 1.2, p.pos.z);
  const dx = p.pos.x - m.pos.x,
    dz = p.pos.z - m.pos.z;
  const hd = Math.hypot(dx, dz) || 1e-6;
  const dist = eye.distanceTo(target);
  const playerOk = !p.dead && p.mode !== "creative";

  // солнце жжёт нежить: днём, под открытым небом, не в воде
  m.burning =
    !!d.burnsInSun &&
    c.isDay &&
    !c.raining &&
    !m.inWater &&
    c.world.getLight(Math.floor(eye.x), Math.floor(eye.y), Math.floor(eye.z)) >>
      4 >=
      15;
  if (m.burning) {
    m.burnT += dt;
    if (m.burnT >= 1) {
      m.burnT = 0;
      m.damage(1);
    }
  } else m.burnT = 0;

  // Тенеход: после удара или в воде — телепорт
  if (d.teleports && (m.justHurt || m.inWater)) teleportAway(m, c);
  m.justHurt = false;

  // странствующий торговец ночью пьёт зелье невидимости, утром — молоко
  if (d.nightInvisible && m.invisible === c.isDay) {
    m.invisible = !c.isDay;
    events.emit("mobDrink", {
      entity: m,
      item: m.invisible ? "potion_invisibility" : "milk_bucket",
    });
  }
  // с ним торгуют — стоит и смотрит на игрока, как житель в Minecraft
  if (m.trading) {
    m.speed = 0;
    m.state = "idle";
    face(m, p.pos.x, p.pos.z);
    return;
  }
  // на поводке — у игрока или у забора: дальше 12 блоков (или забор сломали) — рвётся, поводок падает;
  // дальше 4 — идёт к держателю
  m.leashTo = null;
  if (m.leashed) {
    const post = m.leashPost;
    const postOk =
      !post ||
      BLOCKS[c.world.getBlock(post[0], post[1], post[2])]?.shape === "fence";
    // держатель — забор, другой моб (торговец) или игрок
    const holder =
      !post && m.leashMobId !== null ? (c.mob?.(m.leashMobId) ?? null) : null;
    const lost = !post && m.leashMobId !== null && !holder;
    const hx = post ? post[0] + 0.5 : holder ? holder.pos.x : p.pos.x,
      hy = post
        ? post[1] + 0.9
        : holder
          ? holder.pos.y + holder.height * 0.6
          : p.pos.y + 1.1,
      hz = post ? post[2] + 0.5 : holder ? holder.pos.z : p.pos.z;
    if (
      lost ||
      !postOk ||
      (!post && !holder && p.dead) ||
      Math.hypot(hx - m.pos.x, hy - m.pos.y, hz - m.pos.z) > 12
    ) {
      m.leashed = false;
      m.leashPost = null;
      m.leashMobId = null;
      events.emit("mobDrop", {
        x: m.pos.x,
        y: m.pos.y + 0.5,
        z: m.pos.z,
        item: "lead",
      });
      events.emit("leashBroke", { entity: m });
    } else {
      m.leashTo = new THREE.Vector3(hx, hy, hz);
      if (Math.hypot(hx - m.pos.x, hz - m.pos.z) > 4) {
        m.state = "tempt";
        face(m, hx, hz);
        m.speed = d.walkSpeed * 1.6;
        avoidEdges(m, c);
        return;
      }
    }
  }
  // караван лам: не на поводке — за ламой на поводке или за хвостом каравана (до 10 в цепочке)
  if (d.caravan && !m.leashed) {
    /** Цепочка от o до ламы на поводке — без m и не длиннее 10. */
    const chainOk = (o: Mob): boolean => {
      let cur: Mob | null = o;
      for (let k = 0; k < 10 && cur; k++) {
        if (cur === m || cur.dead) return false;
        if (cur.leashed) return true;
        cur = cur.followId !== null ? (c.mob?.(cur.followId) ?? null) : null;
      }
      return false;
    };
    let lead = m.followId !== null ? (c.mob?.(m.followId) ?? null) : null;
    if (lead && (lead.pos.distanceTo(m.pos) > 10 || !chainOk(lead)))
      lead = null;
    if (!lead)
      lead =
        c.near?.(
          m.pos,
          8,
          (o) =>
            o !== m &&
            o.def === m.def &&
            (o.leashed || o.followId !== null) &&
            !c.near?.(o.pos, 16, (x) => x !== m && x.followId === o.id) &&
            chainOk(o),
        ) ?? null;
    m.followId = lead?.id ?? null;
    if (lead) {
      m.leashTo = new THREE.Vector3(
        lead.pos.x,
        lead.pos.y + lead.height * 0.8,
        lead.pos.z,
      );
      if (lead.pos.distanceTo(m.pos) > 2.2) {
        m.state = "tempt";
        face(m, lead.pos.x, lead.pos.z);
        m.speed = d.walkSpeed * 1.6;
        avoidEdges(m, c);
      } else m.speed = 0;
      return;
    }
  }
  if (m.tamed) return petThink(m, c, dt, hd);
  if (d.bee && !m.aggro) return beeThink(m, c, dt);
  if (d.collector) return allayThink(m, c);

  // враждебность
  let hostile = d.category === "hostile" || m.aggro;
  // свинорыл не трогает игрока в золотой броне (пока его не ударят)
  if (d.goldPeace && !m.aggro && p.goldArmor?.()) hostile = false;
  if (
    d.neutralInLight &&
    !m.aggro &&
    lightLevel(c.world, m.pos.x, m.pos.y + 0.5, m.pos.z, c.skyDarken) >= 12
  )
    hostile = false;
  if (d.provokedByLook && !m.aggro && playerOk && dist < 32) {
    const look = p.lookDir();
    const to = new THREE.Vector3().subVectors(eye, p.eyePos).normalize();
    if (look.dot(to) > 0.985 && canSee(c.world, p.eyePos, eye)) {
      m.aggro = hostile = true;
      events.emit("mobProvoked", { entity: m });
    }
  }

  const chasing = hostile && playerOk && dist < (d.follow ?? 16);
  // летун (Плакальщик, Пламень): над целью в погоне, над полом — в покое
  if (d.flies) {
    // фантом: из каждых 6 с — 2 с пике на цель, остальное — набирает высоту
    let h = d.flies.height;
    if (d.swoops && chasing) {
      m.swoopT += dt;
      if (m.swoopT % 6 < 2) h = 0.6;
    }
    hover(
      m,
      chasing ? p.pos.y + h : groundBelow(c.world, m) + d.flies.height,
      d.swoops ? 6 : 2,
    );
  }

  if (chasing) {
    chase(m, c, dt, dx, dz, hd, dist, eye, target);
    return;
  }
  // разбойники: без игрока рядом — на жителей деревни и её голема; в набеге — к центру деревни
  if (d.illager && hostile) {
    const prey = d.attack
      ? (c.near?.(
          m.pos,
          24,
          (o) => !!o.def.trades || o.def.name === "iron_golem",
        ) ?? null)
      : null;
    if (prey) {
      huntMob(m, prey);
      avoidEdges(m, c);
      return;
    }
    const g = m.goal;
    if (g && Math.hypot(g.x - m.pos.x, g.z - m.pos.z) > 6) {
      m.state = "chase";
      face(m, g.x, g.z);
      m.speed = d.walkSpeed * 1.4;
      avoidEdges(m, c);
      return;
    }
  }
  m.fuse = Math.max(0, m.fuse - dt);

  // броненосец: игрок бежит рядом — сворачивается; свёрнутый замирает (удар сворачивает — Mob.hurt)
  if (d.rollsUp) {
    if (playerOk && dist < 5 && p._sprinting)
      m.rolledT = Math.max(m.rolledT, 3);
    if (m.rolledT > 0) {
      m.speed = 0;
      m.state = "idle";
      return;
    }
  }

  // пугливый (оцелот): игрок ближе 7 блоков без приманки в руке — убегает от него
  if (
    d.shy &&
    playerOk &&
    dist < 7 &&
    m.state !== "flee" &&
    !(c.heldItem && d.temptItems?.includes(c.heldItem))
  ) {
    m.state = "flee";
    m.targetYaw = Math.atan2(dx, dz);
    m.stateTime = 2;
  }

  if (m.state === "flee") {
    m.stateTime -= dt;
    if (m.stateTime > 0) {
      m.speed = d.fleeSpeed;
      avoidEdges(m, c);
      return;
    }
    m.state = "idle";
  }

  // любовь: найти пару и подойти к ней
  if (m.loveT > 0) {
    const mate = c.findMate(m);
    if (mate) {
      m.state = "love";
      face(m, mate.pos.x, mate.pos.z);
      m.speed = m.pos.distanceTo(mate.pos) > 1.2 ? d.walkSpeed : 0;
      if (m.pos.distanceTo(mate.pos) < 1.4) c.breed(m, mate);
      return;
    }
  }

  // приманка: идти за едой в руке игрока
  if (
    d.temptItems &&
    c.heldItem &&
    d.temptItems.includes(c.heldItem) &&
    dist < 10 &&
    !p.dead
  ) {
    m.state = "tempt";
    face(m, p.pos.x, p.pos.z);
    m.speed = hd > 2.2 ? d.walkSpeed * 1.2 : 0;
    return;
  }

  // пловцы: в воде — толща, на суше мирный пловец беспомощно лежит
  if (d.swims && m.inWater) return swim(m, c, dt);
  if (d.swims && d.category === "passive") {
    m.speed = 0;
    return;
  }
  wander(m, dt);
  avoidEdges(m, c);
}
