// Брошенное Око Предела: пролетает до 12 блоков в сторону цитадели по дуге, зависает и падает
// предметом (в 20% случаев разбивается) — как в Minecraft. Решение о дропе — EntityManager.
import * as THREE from "three";

const FLIGHT = 2; // секунд полёта
const HOVER = 0.8; // секунд зависания в конце
const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
const mat = new THREE.MeshBasicMaterial({ color: 0x3ae0a0 });

export class RimEye {
  id: number;
  kind = "rimeye" as const;
  pos: THREE.Vector3;
  prevPos: THREE.Vector3;
  dead = false;
  mesh: THREE.Mesh;
  private readonly from: THREE.Vector3;
  private readonly to: THREE.Vector3;
  private t = 0;

  constructor(
    id: number,
    from: THREE.Vector3,
    target: { x: number; z: number },
  ) {
    this.id = id;
    this.from = from.clone();
    const dir = new THREE.Vector3(target.x - from.x, 0, target.z - from.z);
    const d = dir.length();
    if (d > 1e-6) dir.divideScalar(d);
    // далеко — вперёд на 12 и вверх; близко — к самой цели и вниз (Око указывает, где копать)
    this.to = from.clone().addScaledVector(dir, Math.min(12, d));
    this.to.y += d > 12 ? 2 : -1.5;
    this.pos = from.clone();
    this.prevPos = from.clone();
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(this.pos);
  }

  /** @returns true — полёт окончен (сущность мертва, EntityManager решает: дроп или осколки) */
  tick(dt: number): boolean {
    this.prevPos.copy(this.pos);
    this.t += dt;
    const k = Math.min(1, this.t / FLIGHT);
    this.pos.lerpVectors(this.from, this.to, k);
    this.pos.y += Math.sin(k * Math.PI) * 1.2;
    if (this.t < FLIGHT + HOVER) return false;
    this.dead = true;
    return true;
  }

  updateVisual(alpha: number, time: number) {
    this.mesh.position.copy(this.prevPos.clone().lerp(this.pos, alpha));
    this.mesh.rotation.y = time * 3;
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.mesh); // геометрия и материал общие
  }
}
