// Клыки ворожея: через delay секунд выскакивают из земли, щёлкают один раз — 6 урона магией тому,
// кто над ними (игроку и мобам, кроме разбойников), и через 0.7 с прячутся. В сейв не пишутся.
import * as THREE from "three";
import { events } from "../core/EventBus";
import type { ChunkManager } from "../world/ChunkManager";
import type { Player } from "../player/Player";
import type { Mob } from "./Mob";

const jawGeo = new THREE.BoxGeometry(0.5, 0.6, 0.2);
const jawMat = new THREE.MeshLambertMaterial({ color: 0x9a9a78 });
/** Урон щелчка. */
export const FANG_DAMAGE = 6;
const LIFE = 0.7;

export class Fang {
  id: number;
  kind = "fang" as const;
  pos: THREE.Vector3;
  readonly delay: number;
  readonly ownerId: number;
  age = 0;
  dead = false;
  snapped = false;
  mesh: THREE.Group;
  private readonly jaws: THREE.Mesh[];

  constructor(
    id: number,
    x: number,
    y: number,
    z: number,
    delay: number,
    ownerId: number,
  ) {
    this.id = id;
    this.pos = new THREE.Vector3(x, y, z);
    this.delay = delay;
    this.ownerId = ownerId;
    this.mesh = new THREE.Group();
    this.jaws = [
      new THREE.Mesh(jawGeo, jawMat),
      new THREE.Mesh(jawGeo, jawMat),
    ];
    this.jaws[0]!.position.z = -0.15;
    this.jaws[1]!.position.z = 0.15;
    this.mesh.add(...this.jaws);
    this.mesh.position.copy(this.pos);
    this.mesh.visible = false;
  }

  tick(
    dt: number,
    _world: ChunkManager,
    player: Player,
    mobs: readonly Mob[] = [],
    _inv?: unknown,
  ): void {
    this.age += dt;
    if (this.age < this.delay) return;
    if (!this.snapped) {
      this.snapped = true;
      events.emit("fangSnap", { x: this.pos.x, y: this.pos.y, z: this.pos.z });
      const over = (p: THREE.Vector3) =>
        Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 0.9 &&
        Math.abs(p.y - this.pos.y) < 1.5;
      if (!player.dead && over(player.pos)) player.damage(FANG_DAMAGE, "magic");
      for (const m of mobs)
        if (!m.dead && m.id !== this.ownerId && !m.def.illager && over(m.pos))
          m.hurt(FANG_DAMAGE, this.pos, false);
    }
    if (this.age > this.delay + LIFE) this.dead = true;
  }

  updateVisual(_alpha: number, _time?: number): void {
    const t = this.age - this.delay;
    this.mesh.visible = t >= 0;
    if (t < 0) return;
    // выскакивают, смыкаются и уходят обратно
    const up =
      t < 0.15 ? t / 0.15 : t > LIFE - 0.2 ? Math.max(0, (LIFE - t) / 0.2) : 1;
    const bite = Math.min(1, t / 0.3);
    this.jaws[0]!.position.set(0, up * 0.3 - 0.3, -0.15 + bite * 0.08);
    this.jaws[1]!.position.set(0, up * 0.3 - 0.3, 0.15 - bite * 0.08);
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh); // геометрия и материал общие
  }
}
