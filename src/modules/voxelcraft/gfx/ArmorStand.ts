// Броня на стойках: перед каждой занятой стойкой висят её вещи — шлем выше, ботинки ниже.
// Устроено как предметы в рамках (gfx/DisplayItems): каждый кадр сверяем меши с блочными сущностями.
import * as THREE from "three";
import { itemMesh } from "./ItemMesh";
import type { TextureAtlas } from "./TextureAtlas";
import type { BlockEntities } from "../world/BlockEntities";
import type { ArmorStandState } from "../world/blockentities/armorStand";

/** Высота каждой части над низом клетки: шлем, нагрудник, поножи, ботинки. */
const HEIGHTS = [1.25, 0.9, 0.55, 0.2];

export class ArmorStand {
  /** Ключ «клетка:слот» → меш и что на нём показано. */
  private readonly shown = new Map<
    string,
    { mesh: THREE.Mesh; item: string }
  >();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly atlas: TextureAtlas,
  ) {}

  update(bes: BlockEntities): void {
    const seen = new Set<string>();
    for (const [k, be] of bes.map) {
      if (be.type !== "armor_stand") continue;
      const items = (be.state as ArmorStandState).items;
      for (let i = 0; i < HEIGHTS.length; i++) {
        const it = items[i];
        if (!it) continue;
        const key = `${k}:${i}`;
        let cur = this.shown.get(key);
        if (cur && cur.item !== it.item) {
          this.drop(key, cur.mesh);
          cur = undefined;
        }
        if (!cur) {
          const mesh = itemMesh(this.atlas, it.item);
          if (!mesh) continue;
          this.scene.add(mesh);
          cur = { mesh, item: it.item };
          this.shown.set(key, cur);
        }
        seen.add(key);
        cur.mesh.position.set(be.x + 0.5, be.y + HEIGHTS[i]!, be.z + 0.5);
      }
    }
    for (const [key, cur] of this.shown)
      if (!seen.has(key)) this.drop(key, cur.mesh);
  }

  private drop(key: string, mesh: THREE.Mesh): void {
    this.scene.remove(mesh);
    this.shown.delete(key);
  }
}
