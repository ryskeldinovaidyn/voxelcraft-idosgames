// Взведённая взрывчатка: падает, мигает и через фитиль (4 с) взрывается силой 4, как в Minecraft.
import * as THREE from "three";
import { BLOCKS, B } from "../registry/Blocks";
import { moveBody } from "../physics/Collision";
import type { ChunkManager } from "../world/ChunkManager";
import type { TextureAtlas } from "../gfx/TextureAtlas";

export const TNT_POWER = 4;

let tntGeo: THREE.BoxGeometry | null = null;
const flashGeo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
const flashMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
});

/** Куб с тайлами TNT из атласа (как мини-блок дропа, но в полный размер). */
function geometry(atlas: TextureAtlas): THREE.BoxGeometry {
  if (tntGeo) return tntGeo;
  const g = new THREE.BoxGeometry(0.98, 0.98, 0.98);
  const tex = BLOCKS[B.tnt!]!.tex!;
  const tiles = [
    tex.side!,
    tex.side!,
    tex.top!,
    tex.bottom!,
    tex.side!,
    tex.side!,
  ];
  const uv = g.getAttribute("uv");
  for (let f = 0; f < 6; f++) {
    const r = atlas.uv(tiles[f]!);
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(
        i,
        r.u0 + (r.u1 - r.u0) * uv.getX(i),
        r.v0 + (r.v1 - r.v0) * uv.getY(i),
      );
    }
  }
  // общий материал чанков ждёт вершинные цвета: белые — без затемнения
  g.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(
      new Float32Array(g.getAttribute("position").count * 3).fill(1),
      3,
    ),
  );
  return (tntGeo = g);
}

export class PrimedTnt {
  id: number;
  kind = "tnt" as const;
  pos: THREE.Vector3;
  prevPos: THREE.Vector3;
  vel: THREE.Vector3;
  fuse: number;
  dead = false;
  mesh: THREE.Group;
  private readonly flash: THREE.Mesh;

  constructor(
    id: number,
    atlas: TextureAtlas,
    x: number,
    y: number,
    z: number,
    fuse: number,
  ) {
    this.id = id;
    this.pos = new THREE.Vector3(x, y, z);
    this.prevPos = this.pos.clone();
    this.vel = new THREE.Vector3(
      (Math.random() - 0.5) * 0.4,
      4,
      (Math.random() - 0.5) * 0.4,
    );
    this.fuse = fuse;
    this.mesh = new THREE.Group();
    const body = new THREE.Mesh(geometry(atlas), atlas.opaqueMat);
    body.position.y = 0.49;
    body.castShadow = true;
    this.flash = new THREE.Mesh(flashGeo, flashMat);
    this.flash.position.y = 0.49;
    this.mesh.add(body, this.flash);
    this.mesh.position.copy(this.pos);
  }

  tick(
    dt: number,
    world: ChunkManager,
    explode: (x: number, y: number, z: number, power: number) => void,
  ) {
    this.prevPos.copy(this.pos);
    this.fuse -= dt;
    if (this.fuse <= 0) {
      this.dead = true;
      explode(this.pos.x, this.pos.y + 0.49, this.pos.z, TNT_POWER);
      return;
    }
    this.vel.y -= 20 * dt;
    const r = moveBody(
      world,
      { x: this.pos.x, y: this.pos.y, z: this.pos.z, hw: 0.49, h: 0.98 },
      this.vel.x * dt,
      this.vel.y * dt,
      this.vel.z * dt,
    );
    this.pos.x += r.dx;
    this.pos.y += r.dy;
    this.pos.z += r.dz;
    if (r.hitDown || r.hitUp) {
      this.vel.y = 0;
      this.vel.x *= 0.7;
      this.vel.z *= 0.7;
    }
    if (r.hitX) this.vel.x = 0;
    if (r.hitZ) this.vel.z = 0;
  }

  updateVisual(alpha: number, time: number) {
    this.mesh.position.copy(this.prevPos.clone().lerp(this.pos, alpha));
    this.flash.visible = Math.sin(time * (8 + (4 - this.fuse) * 4)) > 0;
    const swell = this.fuse < 0.5 ? 1 + (0.5 - this.fuse) * 0.3 : 1;
    this.mesh.scale.setScalar(swell);
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.mesh); // геометрия и материалы общие
  }
}
