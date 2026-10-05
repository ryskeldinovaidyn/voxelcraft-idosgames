// Стрела: снаряд с гравитацией. Втыкается в блоки; стрела игрока бьёт мобов, стрела моба — игрока.
// Воткнутую стрелу игрока можно подобрать, как в Minecraft.
import * as THREE from "three";
import { events } from "../core/EventBus";
import { raycastBlocks } from "../world/Raycast";
import { rayBox } from "../physics/rayBox";
import type { ChunkManager } from "../world/ChunkManager";
import type { Player } from "../player/Player";
import type { Inventory } from "../systems/Inventory";
import type { Mob } from "./Mob";
import { isArrow } from "../systems/TippedArrow";
import type { EffectId, ItemStack } from "../types";

const GRAVITY = 20; // блоков/с², как у стрелы в Minecraft (0.05 блока/тик²)
const LIFETIME = 60;
const geo = new THREE.BoxGeometry(0.06, 0.06, 0.55);
const mat = new THREE.MeshLambertMaterial({ color: 0x8a6a3a });
const tridentMat = new THREE.MeshLambertMaterial({ color: 0x2aa8a0 });

export class Arrow {
  id: number;
  kind = "arrow" as const;
  pos: THREE.Vector3;
  prevPos: THREE.Vector3;
  vel: THREE.Vector3;
  damage: number;
  fromPlayer: boolean;
  shooterId: number;
  stuck = false;
  /** Эффект на попавшего игрока (стрела зимогора — Замедление). */
  effect: { id: EffectId; seconds: number } | null = null;
  /** Что подбирается с воткнутого снаряда: стрела или брошенный трезубец (с износом). */
  pick: ItemStack = { item: "arrow", count: 1 };
  /** Трезубец уже ударил моба — падает, больше никого не бьёт. */
  spent = false;

  /** Сделать снарядом-трезубцем: длиннее, бирюзовый, подбирается как этот стак и живёт 10 минут. */
  asTrident(stack: ItemStack): void {
    this.pick = stack;
    this.mesh.material = tridentMat;
    this.mesh.scale.set(1.6, 1.6, 1.8);
  }
  age = 0;
  dead = false;
  mesh: THREE.Mesh;

  constructor(
    id: number,
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    damage: number,
    fromPlayer: boolean,
    shooterId: number,
  ) {
    this.id = id;
    this.pos = pos.clone();
    this.prevPos = pos.clone();
    this.vel = vel.clone();
    this.damage = damage;
    this.fromPlayer = fromPlayer;
    this.shooterId = shooterId;
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.position.copy(this.pos);
  }

  tick(
    dt: number,
    world: ChunkManager,
    player: Player,
    mobs: Iterable<Mob>,
    inventory: Inventory,
  ) {
    this.age += dt;
    // брошенный трезубец не пропадает так быстро, как стрела
    if (this.age > (isArrow(this.pick.item) ? LIFETIME : 600)) {
      this.dead = true;
      return;
    }
    this.prevPos.copy(this.pos);
    if (this.stuck) {
      // подобрать свою стрелу
      if (
        this.fromPlayer &&
        this.age > 0.5 &&
        player.pos.distanceTo(this.pos) < 1.6 &&
        inventory.addStack({ ...this.pick }) === 0
      ) {
        events.emit("itemPickup", { item: this.pick.item, count: 1 });
        this.dead = true;
      }
      return;
    }
    this.vel.y -= GRAVITY * dt;
    const step = this.vel.clone().multiplyScalar(dt);
    const len = step.length();
    if (len < 1e-6) return;
    const dir = step.divideScalar(len);
    const hit = raycastBlocks(world, this.pos, dir, len);
    const travel = hit ? hit.dist : len;

    // по существам — на отрезке до блока
    const speed = this.vel.length();
    if (!this.fromPlayer) {
      const half = 0.3;
      const t = rayBox(
        this.pos,
        dir,
        travel,
        { x: player.pos.x - half, y: player.pos.y, z: player.pos.z - half },
        {
          x: player.pos.x + half,
          y: player.pos.y + 1.8,
          z: player.pos.z + half,
        },
      );
      if (t !== null && !player.dead) {
        // стрела в щит спереди — ни урона, ни эффекта
        if (!player.shieldBlocks(this.pos, this.damage)) {
          player.damage(this.damage, "projectile");
          player.knock(dir.x, dir.z, 4);
          if (this.effect && !player.dead && player.mode !== "creative")
            player.addEffect(this.effect.id, this.effect.seconds);
        }
        this.dead = true;
        return;
      }
    } else if (!this.spent) {
      for (const m of mobs) {
        if (m.dead || m.id === this.shooterId) continue;
        const w = m.width / 2;
        const t = rayBox(
          this.pos,
          dir,
          travel,
          { x: m.pos.x - w, y: m.pos.y, z: m.pos.z - w },
          { x: m.pos.x + w, y: m.pos.y + m.height, z: m.pos.z + w },
        );
        if (t === null) continue;
        if (m.shielded()) {
          // броня Пепельного владыки: стрела отскакивает без урона
          this.dead = true;
          return;
        }
        // урон стрелы игрока растёт со скоростью (натяжением лука)
        m.hurt(
          Math.max(1, Math.round(this.damage * Math.min(1, speed / 60))),
          this.pos,
          true,
        );
        // отравленная стрела вешает свой эффект и на моба (systems/TippedArrow)
        if (this.effect && !m.dead)
          m.applyEffect(this.effect.id, this.effect.seconds);
        if (!isArrow(this.pick.item)) {
          // трезубец отскакивает от моба и падает — его можно подобрать
          this.spent = true;
          this.pos.addScaledVector(dir, Math.max(0, t - 0.3));
          this.vel.set(-dir.x * 2, 2, -dir.z * 2);
          return;
        }
        this.dead = true;
        return;
      }
    }

    this.pos.addScaledVector(dir, travel);
    if (hit) {
      this.stuck = true;
      this.pos.addScaledVector(dir, -0.05);
      this.vel.set(0, 0, 0);
      // точка попадания нужна мишени: сила сигнала — по близости к центру грани
      events.emit("arrowHit", {
        x: hit.x,
        y: hit.y,
        z: hit.z,
        hx: this.pos.x,
        hy: this.pos.y,
        hz: this.pos.z,
      });
    }
  }

  updateVisual(alpha: number) {
    const p = this.prevPos.clone().lerp(this.pos, alpha);
    this.mesh.position.copy(p);
    if (!this.stuck && this.vel.lengthSq() > 1e-4)
      this.mesh.lookAt(p.clone().add(this.vel)); // +z коробки — вдоль полёта
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.mesh); // геометрия и материал общие
  }
}
