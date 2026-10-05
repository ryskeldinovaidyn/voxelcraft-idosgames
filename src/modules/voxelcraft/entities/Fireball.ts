// Огненные шары Пекла: без гравитации, по прямой. Шар Плакальщика взрывается (сила 1) и оставляет
// огонь; малый шар Пламени поджигает блок, в который попал, или игрока (урон и 5 с горения).
import * as THREE from "three";
import { events } from "../core/EventBus";
import { BLOCKS, B } from "../registry/Blocks";
import { raycastBlocks } from "../world/Raycast";
import { rayBox } from "../physics/rayBox";
import type { ChunkManager } from "../world/ChunkManager";
import type { Player } from "../player/Player";
import type { Mob } from "./Mob";

// Зелье ведьмы (potion) — тоже здесь: летит дугой (гравитация, как у стрелы) и, разбившись, ранит
// «магией» игрока в 2.5 блоках. Череп Пепельного владыки (skull) — по прямой, попадает и в мобов,
// взрывается (сила 1, без огня), игроку — Тление на 10 с. Пуля панцирника (bullet) — медленная,
// сама доворачивает на игрока; попав — урон и Левитация на 10 с.
// Заряд ветра (wind_charge) — вихря или брошенный игроком: по прямой, порыв в точке попадания отбрасывает
// игрока и мобов в 2.5 блоках (windBurst), прямое попадание вихря — 1 урона. Бросок игрока самого
// бросившего не задевает (shooterId = PLAYER_SHOT), а порыв — да: так прыгают на заряде.
// Снежок (snowball) — игрока или снеговика: дугой; мобов отбрасывает без урона (Пламени — 3), игрока толкает.
export type FireballKind =
  | "fireball"
  | "small_fireball"
  | "potion"
  | "skull"
  | "bullet"
  | "wind_charge"
  | "snowball"
  | "pearl"
  | "spit";

/** shooterId снаряда, брошенного игроком. */
export const PLAYER_SHOT = -1;
export const WIND_RADIUS = 2.5;

/** Порыв заряда ветра: отбросить от точки игрока и мобов в WIND_RADIUS (ближе — сильнее, и вверх). */
export function windBurst(
  pos: THREE.Vector3,
  player: Player,
  mobs: readonly Mob[],
): void {
  const push = (c: THREE.Vector3, vel: THREE.Vector3) => {
    const d = c.distanceTo(pos);
    if (d >= WIND_RADIUS) return;
    const k = 1 - d / WIND_RADIUS;
    const dir = c.clone().sub(pos);
    if (dir.lengthSq() < 1e-4) dir.set(0, 1, 0);
    dir.normalize();
    vel.addScaledVector(dir, 10 * k);
    vel.y += 7 * k;
  };
  if (!player.dead)
    push(
      new THREE.Vector3(player.pos.x, player.pos.y + 0.9, player.pos.z),
      player.vel,
    );
  for (const m of mobs)
    if (!m.dead && !m.def.boss && !m.def.anchored)
      push(new THREE.Vector3(m.pos.x, m.pos.y + m.height / 2, m.pos.z), m.vel);
}

const LIFETIME = 10;
const GRAVITY = 20;
const SPLASH = 2.5;
/** Сколько длится Тление от черепа. */
export const SKULL_DECAY = 10;
const bigGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
const smallGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
const potionGeo = new THREE.BoxGeometry(0.25, 0.3, 0.25);
const skullGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
const mat = new THREE.MeshBasicMaterial({ color: 0xff8a1a });
const potionMat = new THREE.MeshBasicMaterial({ color: 0x8a2aa8 });
const skullMat = new THREE.MeshBasicMaterial({ color: 0x2a2a2e });
const bulletGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
const bulletMat = new THREE.MeshBasicMaterial({ color: 0xf8f0c8 });
const windGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
const windMat = new THREE.MeshBasicMaterial({ color: 0xc8e8f8 });
const snowGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
const snowMat = new THREE.MeshBasicMaterial({ color: 0xf4f8fc });
const pearlMat = new THREE.MeshBasicMaterial({ color: 0x2ad0b0 });
// плевок ламы: по прямой, 1 урона игроку, без взрыва
const spitGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
const spitMat = new THREE.MeshBasicMaterial({ color: 0xe8ecd8 });
/** Сколько длится Левитация от пули панцирника. */
export const BULLET_LEVITATION = 10;

/** Огонь в пустой клетке над твёрдым полом. */
function igniteAt(world: ChunkManager, x: number, y: number, z: number): void {
  if (
    world.getBlock(x, y, z) === B.air &&
    BLOCKS[world.getBlock(x, y - 1, z)]?.solid
  )
    world.setBlock(x, y, z, B.fire!, 0);
}

export class Fireball {
  id: number;
  kind = "fireball" as const;
  ballKind: FireballKind;
  pos: THREE.Vector3;
  prevPos: THREE.Vector3;
  vel: THREE.Vector3;
  damage: number;
  shooterId: number;
  age = 0;
  dead = false;
  mesh: THREE.Mesh;

  constructor(
    id: number,
    ballKind: FireballKind,
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    damage: number,
    shooterId: number,
  ) {
    this.id = id;
    this.ballKind = ballKind;
    this.pos = pos.clone();
    this.prevPos = pos.clone();
    this.vel = vel.clone();
    this.damage = damage;
    this.shooterId = shooterId;
    this.mesh = new THREE.Mesh(
      ballKind === "fireball"
        ? bigGeo
        : ballKind === "potion"
          ? potionGeo
          : ballKind === "skull"
            ? skullGeo
            : ballKind === "bullet"
              ? bulletGeo
              : ballKind === "wind_charge"
                ? windGeo
                : ballKind === "snowball" || ballKind === "pearl"
                  ? snowGeo
                  : ballKind === "spit"
                    ? spitGeo
                    : smallGeo,
      ballKind === "potion"
        ? potionMat
        : ballKind === "skull"
          ? skullMat
          : ballKind === "bullet"
            ? bulletMat
            : ballKind === "wind_charge"
              ? windMat
              : ballKind === "pearl"
                ? pearlMat
                : ballKind === "snowball"
                  ? snowMat
                  : ballKind === "spit"
                    ? spitMat
                    : mat,
    );
    this.mesh.position.copy(this.pos);
  }

  tick(
    dt: number,
    world: ChunkManager,
    player: Player,
    explode: (x: number, y: number, z: number, power: number) => void,
    mobs: readonly Mob[] = [],
  ) {
    this.age += dt;
    if (this.age > LIFETIME) {
      this.dead = true;
      return;
    }
    this.prevPos.copy(this.pos);
    if (
      this.ballKind === "potion" ||
      this.ballKind === "snowball" ||
      this.ballKind === "pearl"
    )
      this.vel.y -= GRAVITY * dt;
    if (this.ballKind === "bullet" && !player.dead) {
      // пуля доворачивает на игрока, не меняя скорости
      const to = new THREE.Vector3(
        player.pos.x,
        player.pos.y + 1,
        player.pos.z,
      ).sub(this.pos);
      if (to.lengthSq() > 1e-4)
        this.vel.lerp(
          to.normalize().multiplyScalar(this.vel.length()),
          Math.min(1, 3 * dt),
        );
    }
    const step = this.vel.clone().multiplyScalar(dt);
    const len = step.length();
    if (len < 1e-6) return;
    const dir = step.divideScalar(len);
    const hit = raycastBlocks(world, this.pos, dir, len);
    const travel = hit ? hit.dist : len;
    const half = 0.3;
    const t = rayBox(
      this.pos,
      dir,
      travel,
      { x: player.pos.x - half, y: player.pos.y, z: player.pos.z - half },
      { x: player.pos.x + half, y: player.pos.y + 1.8, z: player.pos.z + half },
    );
    if (t !== null && !player.dead && this.shooterId !== PLAYER_SHOT) {
      this.pos.addScaledVector(dir, t);
      // снаряд в щит спереди: рассыпается о щит без урона
      if (player.shieldBlocks(this.pos, this.damage)) {
        this.burst(world, explode, null, player, mobs);
        return;
      }
      if (this.ballKind === "small_fireball") {
        player.damage(this.damage, "fire");
        player.fireT = Math.max(player.fireT, 5);
      } else if (this.ballKind === "skull") {
        player.damage(this.damage, "skull");
        if (!player.dead && player.mode !== "creative")
          player.addEffect("decay", SKULL_DECAY);
      } else if (this.ballKind === "bullet") {
        player.damage(this.damage, "bullet");
        if (!player.dead && player.mode !== "creative")
          player.addEffect("levitation", BULLET_LEVITATION);
      } else if (this.ballKind === "wind_charge" && this.damage > 0)
        player.damage(this.damage, "wind");
      else if (this.ballKind === "snowball") player.knock(dir.x, dir.z, 2);
      else if (this.ballKind === "spit")
        player.damage(this.damage, "projectile");
      this.burst(world, explode, null, player, mobs);
      return;
    }
    // череп владыки бьёт и мобов (боковые головы охотятся на живность), заряд ветра — тоже
    if (
      this.ballKind === "skull" ||
      this.ballKind === "wind_charge" ||
      this.ballKind === "snowball"
    )
      for (const m of mobs) {
        if (m.dead || m.id === this.shooterId) continue;
        const w = m.width / 2;
        const tm = rayBox(
          this.pos,
          dir,
          travel,
          { x: m.pos.x - w, y: m.pos.y, z: m.pos.z - w },
          { x: m.pos.x + w, y: m.pos.y + m.height, z: m.pos.z + w },
        );
        if (tm === null) continue;
        this.pos.addScaledVector(dir, tm);
        if (this.ballKind === "snowball")
          m.hurt(
            m.def.name === "flamer" ? 3 : 0,
            this.pos,
            this.shooterId === PLAYER_SHOT,
          );
        else if (this.damage > 0) m.hurt(this.damage, this.pos, false);
        this.burst(world, explode, null, player, mobs);
        return;
      }
    this.pos.addScaledVector(dir, travel);
    if (hit) this.burst(world, explode, hit, player, mobs);
  }

  private burst(
    world: ChunkManager,
    explode: (x: number, y: number, z: number, power: number) => void,
    hit: {
      x: number;
      y: number;
      z: number;
      nx: number;
      ny: number;
      nz: number;
    } | null,
    player: Player,
    mobs: readonly Mob[] = [],
  ): void {
    this.dead = true;
    if (this.ballKind === "spit") return; // плевок просто исчезает
    if (this.ballKind === "pearl") {
      // жемчуг: игрок окажется там, где тот упал (main слушает pearlLand)
      events.emit("pearlLand", { x: this.pos.x, y: this.pos.y, z: this.pos.z });
      return;
    }
    if (this.ballKind === "snowball") {
      events.emit("snowballHit", {
        x: this.pos.x,
        y: this.pos.y,
        z: this.pos.z,
      });
      return;
    }
    if (this.ballKind === "wind_charge") {
      // порыв с шагом назад от точки удара — чтобы центр был перед гранью, а не в блоке
      const at = this.pos
        .clone()
        .addScaledVector(this.vel.clone().normalize(), -0.3);
      windBurst(at, player, mobs);
      events.emit("windBurst", { x: at.x, y: at.y, z: at.z });
      return;
    }
    if (this.ballKind === "potion") {
      const c = new THREE.Vector3(
        player.pos.x,
        player.pos.y + 0.9,
        player.pos.z,
      );
      if (!player.dead && c.distanceTo(this.pos) < SPLASH)
        player.damage(this.damage, "magic");
      events.emit("potionSplash", {
        x: this.pos.x,
        y: this.pos.y,
        z: this.pos.z,
      });
      return;
    }
    if (this.ballKind === "skull") {
      explode(this.pos.x, this.pos.y, this.pos.z, 1);
      return;
    }
    if (this.ballKind === "bullet") {
      events.emit("bulletHit", { x: this.pos.x, y: this.pos.y, z: this.pos.z });
      return;
    }
    if (this.ballKind === "fireball") {
      explode(this.pos.x, this.pos.y, this.pos.z, 1);
      const x = Math.floor(this.pos.x),
        y = Math.floor(this.pos.y),
        z = Math.floor(this.pos.z);
      for (const [dx, dz] of [
        [0, 0],
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const)
        igniteAt(world, x + dx, y, z + dz);
    } else if (hit)
      igniteAt(world, hit.x + hit.nx, hit.y + hit.ny, hit.z + hit.nz);
    events.emit("fireballHit", { x: this.pos.x, y: this.pos.y, z: this.pos.z });
  }

  updateVisual(alpha: number) {
    this.mesh.position.copy(this.prevPos.clone().lerp(this.pos, alpha));
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.mesh); // геометрия и материал общие
  }
}
