// Лодка, как в Minecraft: держится на поверхности воды, плывёт туда, куда седок смотрит и жмёт
// «вперёд»; вода её тормозит мягко, суша — сильно. Порода дерева — цвет корпуса и что выпадает.
// Три удара ломают. Коллизии с блоками — те же, что у мобов (physics/Collision).
import * as THREE from "three";
import { B } from "../registry/Blocks";
import { WOOD_SPECIES } from "../registry/blocks/wood";
import { moveBody } from "../physics/Collision";
import type { ChunkManager } from "../world/ChunkManager";

export const BOAT_MAX_SPEED = 6;
const GRAVITY = 20;

function hull(planks: string, seam: string): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: planks });
  const d = new THREE.MeshLambertMaterial({ color: seam });
  const box = (
    w: number,
    h: number,
    l: number,
    x: number,
    y: number,
    z: number,
    mat = m,
  ) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat);
    b.position.set(x, y, z);
    b.castShadow = true;
    g.add(b);
  };
  box(1.2, 0.1, 1.8, 0, 0.05, 0, d); // дно
  box(0.1, 0.35, 1.8, 0.55, 0.25, 0);
  box(0.1, 0.35, 1.8, -0.55, 0.25, 0);
  box(1.2, 0.35, 0.1, 0, 0.25, 0.85);
  box(1.2, 0.35, 0.1, 0, 0.25, -0.85);
  box(1.0, 0.06, 0.25, 0, 0.3, 0.2, d); // скамья
  return g;
}

export class Boat {
  id: number;
  kind = "boat" as const;
  pos: THREE.Vector3;
  prevPos: THREE.Vector3;
  vel = new THREE.Vector3();
  renderPos: THREE.Vector3;
  dead = false;
  rider = false;
  readonly seatY = 0.15;
  /** Порода (registry/blocks/wood) и что выпадает, когда ломают. */
  readonly wood: string;
  readonly dropItem: string;
  hp = 3;
  shake = 0;
  onGround = false;
  inWater = false;
  private yaw = 0;
  mesh: THREE.Group;

  constructor(id: number, x: number, y: number, z: number, wood: string) {
    this.id = id;
    this.wood = WOOD_SPECIES.some((s) => s.id === wood) ? wood : "oak";
    this.dropItem = `${this.wood}_boat`;
    this.pos = new THREE.Vector3(x, y, z);
    this.prevPos = this.pos.clone();
    this.renderPos = this.pos.clone();
    const s = WOOD_SPECIES.find((w) => w.id === this.wood)!;
    this.mesh = hull(s.colors.planks, s.colors.seam);
    this.mesh.position.copy(this.pos);
  }

  push(dx: number, dz: number, dt: number): void {
    const k = this.inWater ? 7 : 1.5;
    this.vel.x += dx * k * dt;
    this.vel.z += dz * k * dt;
  }

  hit(): boolean {
    this.hp -= 1;
    this.shake = 0.3;
    if (this.hp <= 0) this.dead = true;
    return this.dead;
  }

  /** Верх воды в столбе под лодкой или null — лодка не на воде. */
  private waterTop(world: ChunkManager): number | null {
    const x = Math.floor(this.pos.x),
      z = Math.floor(this.pos.z);
    let y = Math.floor(this.pos.y + 0.3);
    if (world.getBlock(x, y, z) !== B.water) {
      if (world.getBlock(x, y - 1, z) !== B.water) return null;
      y -= 1;
    }
    for (let k = 0; k < 8 && world.getBlock(x, y + 1, z) === B.water; k++) y++;
    return y + 0.9;
  }

  tick(dt: number, world: ChunkManager): void {
    this.prevPos.copy(this.pos);
    this.shake = Math.max(0, this.shake - dt);
    const top = this.waterTop(world);
    this.inWater = top !== null;
    if (top !== null) {
      // плавучесть: пружина к поверхности (днище чуть ниже воды) с гашением
      const target = top - 0.2;
      this.vel.y += ((target - this.pos.y) * 30 - this.vel.y * 6) * dt;
      const k = Math.max(0, 1 - 0.9 * dt);
      this.vel.x *= k;
      this.vel.z *= k;
    } else {
      this.vel.y -= GRAVITY * dt;
      const k = Math.max(0, 1 - (this.onGround ? 8 : 0.5) * dt);
      this.vel.x *= k;
      this.vel.z *= k;
    }
    const h = Math.hypot(this.vel.x, this.vel.z);
    if (h > BOAT_MAX_SPEED) {
      this.vel.x *= BOAT_MAX_SPEED / h;
      this.vel.z *= BOAT_MAX_SPEED / h;
    }
    const r = moveBody(
      world,
      { x: this.pos.x, y: this.pos.y, z: this.pos.z, hw: 0.6, h: 0.5 },
      this.vel.x * dt,
      this.vel.y * dt,
      this.vel.z * dt,
      { step: this.inWater ? 0 : 0.5, onGround: this.onGround },
    );
    this.pos.x += r.dx;
    this.pos.y += r.dy;
    this.pos.z += r.dz;
    this.onGround = r.hitDown;
    if (r.hitDown || r.hitUp) this.vel.y = 0;
    if (r.hitX) this.vel.x = 0;
    if (r.hitZ) this.vel.z = 0;
    if (h > 0.3) this.yaw = Math.atan2(this.vel.x, this.vel.z);
    if (this.pos.y < -64) this.dead = true;
  }

  updateVisual(alpha: number): void {
    this.renderPos.copy(this.prevPos).lerp(this.pos, alpha);
    this.mesh.position.copy(this.renderPos);
    this.mesh.rotation.set(
      0,
      this.yaw,
      this.shake > 0 ? Math.sin(this.shake * 40) * 0.12 : 0,
    );
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    this.mesh.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    });
  }

  serialize() {
    return { kind: "boat", pos: this.pos.toArray(), wood: this.wood };
  }
}
