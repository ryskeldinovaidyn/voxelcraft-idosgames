// Рука от первого лица: блочная рука в стиле Minecraft, прикреплена к камере.
// Если в руке блок — вместо руки показывается мини-куб блока; плоские предметы —
// квад с иконкой. Замах — процедурная анимация по событию armSwing.
import * as THREE from "three";
import { CONFIG } from "../config";
import { events } from "../core/EventBus";
import { BLOCKS } from "../registry/Blocks";
import { ITEMS } from "../registry/Items";
import type { TextureAtlas } from "../gfx/TextureAtlas";
import type { Inventory } from "../systems/Inventory";

/**
 * Слой рендера руки. Рука рисуется ВТОРЫМ проходом поверх мира с очищенным depth (см. Game.frame):
 * в общем depth-буфере она висит в 0.7 м перед глазом и, стоя вплотную к блоку, целиком тонула
 * в нём — замах при добыче было просто не видно.
 */
export const ARM_LAYER = 1;

export class ArmView {
  camera: THREE.PerspectiveCamera;
  atlas: TextureAtlas;
  group: THREE.Group;
  armMesh: THREE.Mesh;
  itemMesh: THREE.Mesh | null;
  _heldKey: string | null;
  _swing: number;
  _matCache: Map<string, THREE.MeshBasicMaterial>;

  constructor(camera: THREE.PerspectiveCamera, atlas: TextureAtlas) {
    this.camera = camera;
    this.atlas = atlas;
    this.group = new THREE.Group();
    camera.add(this.group);
    this.group.position.set(0.42, -0.42, -0.7);

    // сама рука: «кожа» с рукавом
    const armMat = new THREE.MeshLambertMaterial({ color: 0xd8a06c });
    this.armMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, 0.5),
      armMat,
    );
    this.armMesh.rotation.set(0.35, -0.25, 0);
    this.armMesh.layers.set(ARM_LAYER);
    this.group.add(this.armMesh);

    this.itemMesh = null; // мини-блок/иконка в руке
    this._heldKey = null;
    this._swing = 0; // 0..1 — фаза замаха
    // Материал плоского предмета — один на предмет: пересоздавать его на каждую смену слота
    // значило бы копить неосвобождённые материалы.
    this._matCache = new Map();

    events.on("armSwing", () => {
      this._swing = 1;
    });
  }

  /** Пересоздать меш предмета при смене активного слота. */
  _syncHeld(inventory: Inventory): void {
    const held = inventory.heldItem();
    const key = held ? held.item : null;
    // Меш зависит только от того, КАКОЙ предмет в руке: смена количества (подбор, постановка
    // блока) пересборки не требует.
    if (key === this._heldKey) return;
    this._heldKey = key;

    if (this.itemMesh) {
      this.group.remove(this.itemMesh);
      this.itemMesh.geometry.dispose();
      this.itemMesh = null;
    }
    // неизвестный предмет (из сундука чужого сейва) — просто пустая рука, а не падение кадра
    const item = key ? ITEMS[key] : undefined;
    this.armMesh.visible = !item;
    if (!key || !item) return;

    if (item.blockId !== null && BLOCKS[item.blockId]!.shape === "cube") {
      const def = BLOCKS[item.blockId]!;
      const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
      const uvAttr = geo.getAttribute("uv");
      const tiles = [
        def.tex!.side!,
        def.tex!.side!,
        def.tex!.top!,
        def.tex!.bottom!,
        def.tex!.side!,
        def.tex!.side!,
      ];
      for (let f = 0; f < 6; f++) {
        const r = this.atlas.uv(tiles[f]!);
        for (let v = 0; v < 4; v++) {
          const i = f * 4 + v;
          uvAttr.setXY(
            i,
            r.u0 + (r.u1 - r.u0) * uvAttr.getX(i),
            r.v0 + (r.v1 - r.v0) * uvAttr.getY(i),
          );
        }
      }
      // белые вершинные цвета: общий материал чанков ждёт color-атрибут (vertexColors)
      geo.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(
          new Float32Array(geo.getAttribute("position").count * 3).fill(1),
          3,
        ),
      );
      this.itemMesh = new THREE.Mesh(geo, this.atlas.opaqueMat);
      this.itemMesh.position.set(0, -0.02, -0.1);
      this.itemMesh.rotation.set(0.1, Math.PI / 5, 0);
    } else {
      let mat = this._matCache.get(key);
      if (!mat) {
        const tex = new THREE.CanvasTexture(item.icon);
        tex.magFilter = tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        tex.colorSpace = THREE.SRGBColorSpace;
        mat = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          alphaTest: 0.1,
          side: THREE.DoubleSide,
        });
        this._matCache.set(key, mat);
      }
      this.itemMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), mat);
      this.itemMesh.position.set(0, 0, -0.1);
      this.itemMesh.rotation.set(-0.15, Math.PI / 6, 0.5);
    }
    this.itemMesh.layers.set(ARM_LAYER);
    this.group.add(this.itemMesh);
  }

  frame(
    dt: number,
    inventory: Inventory,
    walking: boolean,
    time: number,
  ): void {
    this._syncHeld(inventory);

    // замах: быстрый удар вперёд-вниз с возвратом
    if (this._swing > 0)
      this._swing = Math.max(0, this._swing - dt / CONFIG.player.swingTime);
    const s = this._swing;
    const swingAng = Math.sin(s * Math.PI) * 1.1;

    // лёгкое покачивание при ходьбе
    const bobX = walking ? Math.sin(time * 7) * 0.015 : 0;
    const bobY = walking ? Math.abs(Math.cos(time * 7)) * 0.02 : 0;

    this.group.position.set(
      0.42 + bobX,
      -0.42 + bobY - swingAng * 0.25,
      -0.7 - swingAng * 0.1,
    );
    this.group.rotation.set(-swingAng * 0.9, swingAng * 0.35, 0);
  }
}
