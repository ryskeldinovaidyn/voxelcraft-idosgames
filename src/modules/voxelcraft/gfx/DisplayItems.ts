// Предметы на подставках: над каждой занятой подставкой висит и медленно крутится её предмет.
// Устроено как лучи маяков (gfx/BeaconBeams): каждый кадр сверяем меши с блочными сущностями.
import * as THREE from "three";
import { itemMesh } from "./ItemMesh";
import { FACING_DIRS, facingOf } from "../registry/meta";
import type { TextureAtlas } from "./TextureAtlas";
import type { BlockEntities } from "../world/BlockEntities";
import type { ChunkManager } from "../world/ChunkManager";
import type { DisplayState } from "../world/blockentities/display";

export class DisplayItems {
  /** Ключ клетки → меш и какой предмет на нём показан (сменили предмет — меш пересоздаётся). */
  private readonly shown = new Map<
    string,
    { mesh: THREE.Mesh; item: string }
  >();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly atlas: TextureAtlas,
  ) {}

  update(bes: BlockEntities, world: ChunkManager): void {
    const seen = new Set<string>();
    for (const [k, be] of bes.map) {
      if (be.type !== "display") continue;
      const it = (be.state as DisplayState).items[0];
      if (!it) continue;
      let cur = this.shown.get(k);
      if (cur && cur.item !== it.item) {
        this.scene.remove(cur.mesh);
        this.shown.delete(k);
        cur = undefined;
      }
      if (!cur) {
        const mesh = itemMesh(this.atlas, it.item);
        if (!mesh) continue;
        mesh.castShadow = true;
        this.scene.add(mesh);
        cur = { mesh, item: it.item };
        this.shown.set(k, cur);
      }
      seen.add(k);
      // рамка висит на стене: предмет — перед ней, с той стороны, куда рамка смотрит
      const [dx, dz] = FACING_DIRS[facingOf(world.getMeta(be.x, be.y, be.z))]!;
      cur.mesh.position.set(
        be.x + 0.5 - dx * 0.4,
        be.y + 0.5,
        be.z + 0.5 - dz * 0.4,
      );
      // предмет стоит в своём повороте (ПКМ по рамке крутит его на восьмую)
      const rot = ((be.state as DisplayState).rot ?? 0) / 8;
      cur.mesh.rotation.y = Math.atan2(-dx, -dz) + rot * Math.PI * 2;
    }
    for (const [k, cur] of this.shown)
      if (!seen.has(k)) {
        this.scene.remove(cur.mesh);
        this.shown.delete(k);
      }
  }
}
