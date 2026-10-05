// Поплавок удочки, как в Minecraft: летит с гравитацией, в воде держится поверхности и ждёт
// поклёвку 5–30 с (в дождь быстрее), поклёвка — поплавок ныряет на 1 с: успел подсечь (ПКМ) —
// улов (systems/Fishing). Упал на землю — лежит. Сменили предмет в руке или ушли дальше 32 блоков —
// поплавок исчезает. Леска — линия от кончика удочки (EntityManager.updateVisuals).
import * as THREE from "three";
import { events } from "../core/EventBus";
import { BLOCKS, B } from "../registry/Blocks";
import type { ChunkManager } from "../world/ChunkManager";

export const BITE_TIME = 1;
const WAIT: [number, number] = [5, 30];

const white = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });
const red = new THREE.MeshLambertMaterial({ color: 0xd02020 });
const lineMat = new THREE.LineBasicMaterial({ color: 0x202020 });

export class FishingHook {
  id: number;
  kind = "hook" as const;
  pos: THREE.Vector3;
  prevPos: THREE.Vector3;
  vel: THREE.Vector3;
  dead = false;
  state: "flying" | "water" | "ground" = "flying";
  /** Секунд до поклёвки; сколько ещё длится поклёвка. */
  wait = 0;
  bite = 0;
  private t = 0;
  mesh: THREE.Group;
  line: THREE.Line;

  constructor(
    id: number,
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    private readonly rng: () => number = Math.random,
  ) {
    this.id = id;
    this.pos = pos.clone();
    this.prevPos = pos.clone();
    this.vel = vel.clone();
    this.mesh = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.14), red);
    top.position.y = 0.06;
    const bottom = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.08, 0.14),
      white,
    );
    this.mesh.add(top, bottom);
    this.line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([pos, pos]),
      lineMat,
    );
    this.line.frustumCulled = false;
  }

  private newWait(): number {
    return WAIT[0] + this.rng() * (WAIT[1] - WAIT[0]);
  }

  tick(
    dt: number,
    world: ChunkManager,
    owner: THREE.Vector3,
    raining: boolean,
    holding: boolean,
  ): void {
    this.prevPos.copy(this.pos);
    this.t += dt;
    if (!holding || owner.distanceTo(this.pos) > 32) {
      this.dead = true;
      return;
    }
    const cell = (x: number, y: number, z: number) =>
      world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
    if (this.state === "flying") {
      this.vel.y -= 20 * dt;
      this.vel.multiplyScalar(Math.max(0, 1 - 0.4 * dt));
      const n = this.pos.clone().addScaledVector(this.vel, dt);
      const id = cell(n.x, n.y, n.z);
      if (id === B.water) {
        this.pos.copy(n);
        this.vel.set(0, 0, 0);
        this.state = "water";
        this.wait = this.newWait();
        events.emit("fishSplash", { x: n.x, y: n.y, z: n.z });
      } else if (BLOCKS[id]?.solid || n.y < -64) {
        this.vel.set(0, 0, 0);
        this.state = "ground";
      } else this.pos.copy(n);
      return;
    }
    if (this.state !== "water") return;
    // держаться поверхности своего столба воды
    const x = this.pos.x,
      z = this.pos.z;
    let y = Math.floor(this.pos.y);
    if (cell(x, y, z) !== B.water) {
      if (cell(x, y - 1, z) !== B.water) {
        this.state = "flying"; // вода ушла из-под поплавка
        return;
      }
      y -= 1;
    }
    for (let k = 0; k < 8 && cell(x, y + 1, z) === B.water; k++) y++;
    const surface = y + 0.85;
    if (this.bite > 0) {
      this.bite -= dt;
      this.pos.y = surface - 0.25; // клюёт — поплавок под водой
      if (this.bite <= 0) this.wait = this.newWait();
      return;
    }
    this.pos.y = surface + Math.sin(this.t * 3) * 0.03;
    this.wait -= dt * (raining ? 1.3 : 1);
    if (this.wait <= 0) {
      this.bite = BITE_TIME;
      this.pos.y = surface - 0.25; // клюнуло — поплавок сразу ныряет
      events.emit("fishBite", { x, y: surface, z });
    }
  }

  /** Поплавок и леска от кончика удочки `tip`. */
  updateVisual(alpha: number, tip: THREE.Vector3): void {
    const p = this.prevPos.clone().lerp(this.pos, alpha);
    this.mesh.position.copy(p);
    const a = this.line.geometry.attributes.position as THREE.BufferAttribute;
    a.setXYZ(0, tip.x, tip.y, tip.z);
    a.setXYZ(1, p.x, p.y + 0.1, p.z);
    a.needsUpdate = true;
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh, this.line);
    this.line.geometry.dispose();
    this.mesh.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
    });
  }
}
