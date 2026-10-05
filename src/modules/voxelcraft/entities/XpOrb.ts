// Сфера опыта: выпадает из мобов (убитых игроком), летит к игроку в радиусе ~7 блоков.
import * as THREE from "three";
import { events } from "../core/EventBus";
import type { ChunkManager } from "../world/ChunkManager";
import type { Player } from "../player/Player";

const MAGNET = 7.25;
const LIFETIME = 300;
const geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
const mat = new THREE.MeshBasicMaterial({ color: 0xc8ff3a });

export class XpOrb {
  id: number;
  kind = "xp" as const;
  value: number;
  pos: THREE.Vector3;
  prevPos: THREE.Vector3;
  vel: THREE.Vector3;
  age = 0;
  dead = false;
  mesh: THREE.Mesh;

  constructor(id: number, x: number, y: number, z: number, value: number) {
    this.id = id;
    this.value = value;
    this.pos = new THREE.Vector3(x, y, z);
    this.prevPos = this.pos.clone();
    this.vel = new THREE.Vector3(
      (Math.random() - 0.5) * 3,
      3 + Math.random() * 2,
      (Math.random() - 0.5) * 3,
    );
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(this.pos);
  }

  tick(dt: number, world: ChunkManager, player: Player) {
    this.prevPos.copy(this.pos);
    this.age += dt;
    if (this.age > LIFETIME) {
      this.dead = true;
      return;
    }
    const to = new THREE.Vector3(
      player.pos.x,
      player.pos.y + 0.9,
      player.pos.z,
    ).sub(this.pos);
    const dist = to.length();
    if (!player.dead && this.age > 0.4) {
      if (dist < 0.9) {
        player.addXp(this.value);
        events.emit("xpPickup", { amount: this.value });
        this.dead = true;
        return;
      }
      if (dist < MAGNET) {
        to.normalize().multiplyScalar(10 * (1 - dist / MAGNET) + 2);
        this.vel.lerp(to, 0.25);
        this.pos.addScaledVector(this.vel, dt);
        return;
      }
    }
    this.vel.y -= 16 * dt;
    const nx = this.pos.x + this.vel.x * dt,
      ny = this.pos.y + this.vel.y * dt,
      nz = this.pos.z + this.vel.z * dt;
    if (
      this.vel.y < 0 &&
      world.isSolid(Math.floor(nx), Math.floor(ny - 0.08), Math.floor(nz))
    ) {
      this.pos.y = Math.floor(ny - 0.08) + 1.08;
      this.vel.set(this.vel.x * 0.5, 0, this.vel.z * 0.5);
    } else {
      this.pos.set(nx, ny, nz);
    }
  }

  updateVisual(alpha: number, time: number) {
    const p = this.prevPos.clone().lerp(this.pos, alpha);
    this.mesh.position.set(p.x, p.y + Math.sin(time * 4 + this.id) * 0.05, p.z);
    this.mesh.rotation.y = time * 2;
    this.mesh.scale.setScalar(
      0.8 + Math.min(1.2, this.value / 10) + Math.sin(time * 6) * 0.1,
    );
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.mesh);
  }

  serialize() {
    return { kind: "xp", pos: this.pos.toArray(), value: this.value };
  }
}
