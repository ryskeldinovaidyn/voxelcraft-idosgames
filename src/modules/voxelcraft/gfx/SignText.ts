// Надписи на табличках: перед каждой исписанной табличкой — плоскость с текстом. Устроено как
// предметы в рамках (gfx/DisplayItems): каждый кадр сверяем плоскости с блочными сущностями.
import * as THREE from "three";
import { FACING_DIRS, facingOf } from "../registry/meta";
import { SIGN_LINES } from "../systems/SignText";
import type { BlockEntities } from "../world/BlockEntities";
import type { ChunkManager } from "../world/ChunkManager";
import type { SignState } from "../world/blockentities/sign";

const W = 128;
const H = 80;
const geo = new THREE.PlaneGeometry(0.8, 0.5);

/** Текстура с текстом таблички (тёмные буквы на прозрачном). */
function textTexture(lines: readonly string[]): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, W, H);
  g.fillStyle = "#2a1c0e";
  g.font = "16px monospace";
  g.textAlign = "center";
  g.textBaseline = "middle";
  const step = H / SIGN_LINES;
  lines.slice(0, SIGN_LINES).forEach((l, i) => {
    g.fillText(l, W / 2, step * (i + 0.5), W - 6);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class SignText {
  /** Ключ клетки → плоскость и показанный текст (текст сменился — рисуем заново). */
  private readonly shown = new Map<
    string,
    { mesh: THREE.Mesh; text: string }
  >();

  constructor(private readonly scene: THREE.Scene) {}

  update(bes: BlockEntities, world: ChunkManager): void {
    const seen = new Set<string>();
    for (const [k, be] of bes.map) {
      if (be.type !== "sign") continue;
      const lines = (be.state as SignState).lines;
      if (!lines.length) continue;
      const text = lines.join("\n");
      let cur = this.shown.get(k);
      if (cur && cur.text !== text) {
        this.drop(k, cur.mesh);
        cur = undefined;
      }
      if (!cur) {
        const mat = new THREE.MeshBasicMaterial({
          map: textTexture(lines),
          transparent: true,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(geo, mat);
        this.scene.add(mesh);
        cur = { mesh, text };
        this.shown.set(k, cur);
      }
      seen.add(k);
      // надпись — перед доской, лицом от стены
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
