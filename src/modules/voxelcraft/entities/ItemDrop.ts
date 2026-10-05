// Дроп-предмет: мини-модель блока (или плоская иконка) с физикой —
// подброс, гравитация, отскок, трение, медленное вращение и «магнит» к игроку.
// Физика на тике (20 TPS), позиция для рендера интерполируется.
import * as THREE from "three";
import { CONFIG } from "../config";
import { events } from "../core/EventBus";
import { BLOCKS, B } from "../registry/Blocks";
import { ITEMS } from "../registry/Items";
import type { BlockDef } from "../types";
import type { TextureAtlas } from "../gfx/TextureAtlas";
import type { ChunkManager } from "../world/ChunkManager";
import type { Player } from "../player/Player";
import type { Inventory } from "../systems/Inventory";

const D = CONFIG.drops;
// Гетерогенный кэш: геометрия под ключом key, материал под key+':mat' (разные типы значений).
const geoCache = new Map<string, THREE.BufferGeometry | THREE.Material>();

function blockGeometry(
  atlas: TextureAtlas,
  blockDef: BlockDef,
): THREE.BoxGeometry {
  // мини-куб с UV граней из атласа (top/side/bottom)
  const g = new THREE.BoxGeometry(D.scale, D.scale, D.scale);
  const uvAttr = g.getAttribute("uv");
  // порядок граней BoxGeometry: +x,-x,+y,-y,+z,-z (по 4 вершины)
  // tex/грани заведомо заданы для размещаемых блоков, приходящих сюда — non-null asserts.
  const tex = blockDef.tex!;
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
        r.u0 + (r.u1 - r.u0) * uvAttr.getX(i),
        r.v0 + (r.v1 - r.v0) * uvAttr.getY(i),
      );
    }
  }
  // общий материал чанков — vertexColors:true; без белого атрибута цвета
  // вершины считаются чёрными и гасят текстуру
  g.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(
      new Float32Array(g.getAttribute("position").count * 3).fill(1),
      3,
    ),
  );
  return g;
}

export class ItemDrop {
  id: number;
  kind: "drop";
  item: string;
  count: number;
  pos: THREE.Vector3;
  prevPos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  dead: boolean;
  _pickupAnim: number;
  /** Износ инструмента/брони — переживает выбрасывание и подбор. */
  dmg?: number;
  /** Доп. данные стака (зачарования, вещи панцирного сундука) — тоже переживают выброс и подбор. */
  tag?: Record<string, unknown>;
  /** Сколько секунд после появления нельзя подобрать (выброшенное игроком — 2 с, как в Minecraft). */
  pickupDelay = 0.5;
  mesh: THREE.Mesh;

  constructor(
    id: number,
    atlas: TextureAtlas,
    x: number,
    y: number,
    z: number,
    itemName: string,
    count: number,
  ) {
    this.id = id;
    this.kind = "drop";
    this.item = itemName;
    this.count = count;
    this.pos = new THREE.Vector3(x, y, z);
    this.prevPos = this.pos.clone();
    this.vel = new THREE.Vector3(
      (Math.random() - 0.5) * 2.4,
      4 + Math.random() * 1.5,
      (Math.random() - 0.5) * 2.4,
    );
    this.age = 0;
    this.dead = false;
    this._pickupAnim = 0; // >0 — летит в игрока

    // предмет, которого нет в игре (сундук из чужого сейва), рисуем камнем: падать из-за него весь
    // кадр не должен
    const def = ITEMS[itemName] ?? ITEMS.stone!;
    // Значения кэша гетерогенны (геометрия/материал под разными ключами) — сужаем кастами при чтении.
    const key = "drop:" + itemName;
    let geo = geoCache.get(key) as THREE.BufferGeometry | undefined;
    if (def.blockId !== null && BLOCKS[def.blockId]!.shape === "cube") {
      if (!geo) {
        geo = blockGeometry(atlas, BLOCKS[def.blockId]!);
        geoCache.set(key, geo);
      }
      this.mesh = new THREE.Mesh(geo, atlas.opaqueMat);
    } else {
      // плоский предмет: квад с иконкой (или тайлом растения)
      let mat = geoCache.get(key + ":mat") as
        THREE.MeshLambertMaterial | undefined;
      if (!mat) {
        // не-блочные предметы (материалы/инструменты/крестовины) всегда имеют tile — non-null assert.
        const tex = new THREE.CanvasTexture(
          def.icon ?? atlas.tileCanvas(def.tile!),
        );
        tex.magFilter = tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        tex.colorSpace = THREE.SRGBColorSpace;
        mat = new THREE.MeshLambertMaterial({
          map: tex,
          transparent: true,
          alphaTest: 0.1,
          side: THREE.DoubleSide,
        });
        geoCache.set(key + ":mat", mat);
      }
      if (!geo) {
        geo = new THREE.PlaneGeometry(D.scale * 1.4, D.scale * 1.4);
        geoCache.set(key, geo);
      }
      this.mesh = new THREE.Mesh(geo, mat);
    }
    this.mesh.castShadow = true;
    this.mesh.position.copy(this.pos);
  }

  tick(dt: number, world: ChunkManager, player: Player, inventory: Inventory) {
    this.prevPos.copy(this.pos);
    this.age += dt;
    if (this.age > D.despawnTime) {
      this.dead = true;
      return;
    }
    // в лаве и в огне предметы сгорают
    const here = world.getBlock(
      Math.floor(this.pos.x),
      Math.floor(this.pos.y),
      Math.floor(this.pos.z),
    );
    // пеклит и древние обломки в лаве не горят, как в Minecraft
    const fireproof =
      this.item.startsWith("infernite") || this.item === "ancient_debris";
    if (
      (here === B.lava || here === B.fire || here === B.soul_fire) &&
      !fireproof
    ) {
      this.dead = true;
      return;
    }

    const toPlayer = new THREE.Vector3(
      player.pos.x,
      player.pos.y + 0.9,
      player.pos.z,
    ).sub(this.pos);
    const dist = toPlayer.length();

    // подбор
    const canTake = !player.dead && this.age > this.pickupDelay; // мёртвый не подбирает
    if (dist < D.pickupRadius && canTake) {
      const left =
        this.dmg || (this.tag && !this.tag.pulseFragmentId)
          ? inventory.addStack({
              item: this.item,
              count: this.count,
              ...(this.dmg ? { dmg: this.dmg } : {}),
              ...(this.tag && !this.tag.pulseFragmentId ? { tag: this.tag } : {}),
            })
          : inventory.add(this.item, this.count);
      if (left < this.count) {
        events.emit("itemPickup", {
          item: this.item,
          count: this.count - left,
          tag: this.tag,
        });
        if (left > 0) this.count = left;
        else {
          this.dead = true;
          return;
        }
      }
    }
    // магнит: тянет к игроку, физика отключается
    if (dist < D.magnetRadius && canTake) {
      toPlayer
        .normalize()
        .multiplyScalar(
          D.magnetPull * Math.max(0.3, 1 - dist / D.magnetRadius) + 2,
        );
      this.vel.lerp(toPlayer, 0.5);
      this.pos.addScaledVector(this.vel, dt);
      return;
    }

    // обычная физика: гравитация + точечная коллизия с вокселями
    this.vel.y -= D.gravity * dt;
    const nx = this.pos.x + this.vel.x * dt;
    const ny = this.pos.y + this.vel.y * dt;
    const nz = this.pos.z + this.vel.z * dt;

    if (
      this.vel.y < 0 &&
      world.isSolid(Math.floor(nx), Math.floor(ny - 0.12), Math.floor(nz))
    ) {
      // отскок от пола
      this.pos.y = Math.floor(ny - 0.12) + 1 + 0.12;
      this.vel.y = Math.abs(this.vel.y) > 1 ? -this.vel.y * D.bounce : 0;
      this.vel.x *= D.friction;
      this.vel.z *= D.friction;
    } else {
      this.pos.y = ny;
      // горизонтальные стенки — просто стоп
      if (
        !world.isSolid(
          Math.floor(nx),
          Math.floor(this.pos.y),
          Math.floor(this.pos.z),
        )
      )
        this.pos.x = nx;
      else this.vel.x = 0;
      if (
        !world.isSolid(
          Math.floor(this.pos.x),
          Math.floor(this.pos.y),
          Math.floor(nz),
        )
      )
        this.pos.z = nz;
      else this.vel.z = 0;
    }
  }

  updateVisual(alpha: number, time: number) {
    const p = this.prevPos.clone().lerp(this.pos, alpha);
    this.mesh.position.set(
      p.x,
      p.y + Math.sin(time * 2 + this.id) * 0.05 + 0.05,
      p.z,
    );
    this.mesh.rotation.y = time * 1.2 + this.id;
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.mesh); /* геометрии/материалы в кэше — общие */
  }

  serialize() {
    return {
      kind: "drop",
      item: this.item,
      count: this.count,
      pos: this.pos.toArray(),
      ...(this.dmg ? { dmg: this.dmg } : {}),
      ...(this.tag ? { tag: this.tag } : {}),
    };
  }
}
