// Меш одного предмета для показа в мире: мини-куб для блоков и плоская иконка для остального.
// ⚠ Похожий код есть внутри entities/ItemDrop (там он про выпавшие предметы со своей физикой и
// своим кэшем); общий модуль сделан отдельно, чтобы не трогать работающую физику дропа.
import * as THREE from "three";
import { BLOCKS } from "../registry/Blocks";
import { ITEMS } from "../registry/Items";
import type { TextureAtlas } from "./TextureAtlas";

/** Сторона мини-куба и иконки, в блоках. */
export const ITEM_MESH_SIZE = 0.4;

const cache = new Map<string, THREE.BufferGeometry | THREE.Material>();

/** Мини-куб блока с UV граней из атласа (порядок граней BoxGeometry: +x,-x,+y,-y,+z,-z). */
function cubeGeometry(atlas: TextureAtlas, name: string): THREE.BoxGeometry {
  const def = BLOCKS[ITEMS[name]!.blockId!]!;
  const g = new THREE.BoxGeometry(
    ITEM_MESH_SIZE,
    ITEM_MESH_SIZE,
    ITEM_MESH_SIZE,
  );
  const uvAttr = g.getAttribute("uv");
  const tex = def.tex!;
  const tiles = [
    tex.side!,
    tex.side!,
    tex.top!,
    tex.bottom!,
    tex.side!,
    tex.side!,
  ];
  for (let f = 0; f < 6; f++) {
    const r = atlas.uv(tiles[f]!);
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uvAttr.setXY(
        i,
        r.u0 + uvAttr.getX(i) * (r.u1 - r.u0),
        r.v0 + uvAttr.getY(i) * (r.v1 - r.v0),
      );
    }
  }
  uvAttr.needsUpdate = true;
  return g;
}

/** Плоская иконка предмета (двусторонняя, с прозрачностью). */
function flatMaterial(atlas: TextureAtlas, name: string): THREE.Material {
  const def = ITEMS[name]!;
  const tex = new THREE.CanvasTexture(def.icon ?? atlas.tileCanvas(def.tile!));
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshLambertMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.1,
    side: THREE.DoubleSide,
  });
}

/** Меш предмета; null — такого предмета нет в реестре. */
export function itemMesh(atlas: TextureAtlas, name: string): THREE.Mesh | null {
  const def = ITEMS[name];
  if (!def) return null;
  const key = "show:" + name;
  const cube = def.blockId !== null && BLOCKS[def.blockId]?.shape === "cube";
  let geo = cache.get(key) as THREE.BufferGeometry | undefined;
  if (!geo) {
    geo = cube
      ? cubeGeometry(atlas, name)
      : new THREE.PlaneGeometry(ITEM_MESH_SIZE * 1.4, ITEM_MESH_SIZE * 1.4);
    cache.set(key, geo);
  }
  if (cube) return new THREE.Mesh(geo, atlas.opaqueMat);
  let mat = cache.get(key + ":mat") as THREE.Material | undefined;
  if (!mat) {
    mat = flatMaterial(atlas, name);
    cache.set(key + ":mat", mat);
  }
  return new THREE.Mesh(geo, mat);
}
