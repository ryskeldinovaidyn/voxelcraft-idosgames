// Лучи светящих маяков: столб до верха мира над каждым активным маяком загруженного измерения.
import * as THREE from "three";
import { CHUNK_SIZE } from "../world/Chunk";
import type { BlockEntities } from "../world/BlockEntities";

const geo = new THREE.BoxGeometry(0.3, 1, 0.3);
const mat = new THREE.MeshBasicMaterial({
  color: 0xc8fff8,
  transparent: true,
  opacity: 0.5,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

export class BeaconBeams {
  private readonly meshes = new Map<string, THREE.Mesh>();

  constructor(private readonly scene: THREE.Scene) {}

  /** Синхронизировать лучи с маяками (у каждого своё поле state.active). */
  update(bes: BlockEntities, time: number): void {
    const top = CHUNK_SIZE.SY;
    const seen = new Set<string>();
    for (const [k, be] of bes.map) {
      if (be.type !== "beacon" || !(be.state as { active?: boolean }).active)
        continue;
      seen.add(k);
      let m = this.meshes.get(k);
      if (!m) {
        m = new THREE.Mesh(geo, mat);
        this.scene.add(m);
        this.meshes.set(k, m);
      }
      const h = Math.max(1, top - be.y - 1);
      m.scale.set(1, h, 1);
      m.position.set(be.x + 0.5, be.y + 1 + h / 2, be.z + 0.5);
      m.rotation.y = time * 0.8;
    }
    for (const [k, m] of this.meshes)
      if (!seen.has(k)) {
        this.scene.remove(m);
        this.meshes.delete(k);
      }
  }
}
