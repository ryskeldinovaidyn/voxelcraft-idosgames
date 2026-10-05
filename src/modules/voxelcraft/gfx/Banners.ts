// Узоры знамён в мире: перед каждым знаменем со слоями — плоскость с рисунком узора (основной цвет
// рисует сам блок из атласа). Устроено как надписи табличек (gfx/SignText): каждый кадр сверяем
// плоскости с блочными сущностями.
import * as THREE from "three";
import { FACING_DIRS, facingOf } from "../registry/meta";
import { encodeLayers } from "../systems/Banner";
import type { BlockEntities } from "../world/BlockEntities";
import type { ChunkManager } from "../world/ChunkManager";
import type { BannerState } from "../world/blockentities/banner";
import { bannerCanvas } from "./BannerArt";

const geo = new THREE.PlaneGeometry(0.98, 0.98);

export class Banners {
  /** Ключ клетки → плоскость и показанные слои (сменились — рисуем заново). */
  private readonly shown = new Map<string, { mesh: THREE.Mesh; tag: string }>();

  constructor(private readonly scene: THREE.Scene) {}

  update(bes: BlockEntities, world: ChunkManager): void {
    const seen = new Set<string>();
    for (const [k, be] of bes.map) {
      if (be.type !== "banner") continue;
      const layers = (be.state as BannerState).layers;
      if (!layers.length) continue;
      const tag = encodeLayers(layers);
      let cur = this.shown.get(k);
      if (cur && cur.tag !== tag) {
        this.drop(k, cur.mesh);
        cur = undefined;
      }
      if (!cur) {
        const tex = new THREE.CanvasTexture(bannerCanvas(null, layers, 4));
        tex.magFilter = tex.minFilter = THREE.NearestFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        const mesh = new THREE.Mesh(
          geo,
          new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            depthWrite: false,
          }),
        );
        this.scene.add(mesh);
        cur = { mesh, tag };
        this.shown.set(k, cur);
      }
      seen.add(k);
      // узор — вплотную перед полотном, лицом от стены
      const [dx, dz] = FACING_DIRS[facingOf(world.getMeta(be.x, be.y, be.z))]!;
      cur.mesh.position.set(
        be.x + 0.5 - dx * 0.08,
        be.y + 0.5,
        be.z + 0.5 - dz * 0.08,
      );
      cur.mesh.rotation.y = Math.atan2(-dx, -dz);
    }
    for (const [k, cur] of this.shown) if (!seen.has(k)) this.drop(k, cur.mesh);
  }

  private drop(k: string, mesh: THREE.Mesh): void {
    this.scene.remove(mesh);
    (mesh.material as THREE.MeshBasicMaterial).map?.dispose();
    (mesh.material as THREE.Material).dispose();
    this.shown.delete(k);
  }
}
