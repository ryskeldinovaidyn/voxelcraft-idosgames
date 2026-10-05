// Вагонетка, как в Minecraft: едет по рельсам (world/Rails) — скорость вдоль отрезка между выходами
// клетки, на поворотах направление меняется без потери скорости, на подъёмах тянет гравитация.
// Разгонные рельсы под током разгоняют до 8 блоков/с, без тока — тормозят. В тупике встаёт, без
// рельсов падает. Игрок садится ПКМ (Player.riding), W толкает, Ctrl — выйти; удары ломают.
// Виды: с сундуком (27 слотов) и с воронкой (5 слотов, сама собирает — EntityManager) открываются ПКМ;
// с динамитом взводится запитанными активирующими рельсами и через 4 с взрывается.
import * as THREE from "three";
import { events } from "../core/EventBus";
import { BLOCKS, B } from "../registry/Blocks";
import { RAIL_POWERED, isRail, railPoints, railUnder } from "../world/Rails";
import type { ChunkManager } from "../world/ChunkManager";
import type { ItemStack } from "../types";

export const CART_MAX_SPEED = 8;
const GRAVITY = 20;
const POWER_ACCEL = 14;
/** Трение за секунду (с седоком — меньше). */
const FRICTION = 0.35;
const RIDER_FRICTION = 0.15;
/** Фитиль вагонетки с динамитом, сек. */
export const TNT_CART_FUSE = 4;

export type CartVariant = "plain" | "chest" | "hopper" | "tnt";
export const CART_VARIANTS: readonly CartVariant[] = [
  "plain",
  "chest",
  "hopper",
  "tnt",
];
const DROP: Record<CartVariant, string> = {
  plain: "minecart",
  chest: "chest_minecart",
  hopper: "hopper_minecart",
  tnt: "tnt_minecart",
};
const SLOTS: Record<CartVariant, number> = {
  plain: 0,
  chest: 27,
  hopper: 5,
  tnt: 0,
};

const mat = new THREE.MeshLambertMaterial({ color: 0x6e7278 });
const dark = new THREE.MeshLambertMaterial({ color: 0x3a3c40 });
const CARGO: Partial<Record<CartVariant, THREE.MeshLambertMaterial>> = {
  chest: new THREE.MeshLambertMaterial({ color: 0x9a6a2a }),
  hopper: new THREE.MeshLambertMaterial({ color: 0x4a4a4e }),
  tnt: new THREE.MeshLambertMaterial({ color: 0xc03020 }),
};
const band = new THREE.MeshLambertMaterial({ color: 0xe8e8e0 });

function cartMesh(variant: CartVariant): THREE.Group {
  const g = new THREE.Group();
  const box = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    m = mat,
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    g.add(mesh);
  };
  box(0.9, 0.08, 1.2, 0, 0.12, 0, dark); // дно
  box(0.9, 0.45, 0.06, 0, 0.36, 0.57);
  box(0.9, 0.45, 0.06, 0, 0.36, -0.57);
  box(0.06, 0.45, 1.2, 0.42, 0.36, 0);
  box(0.06, 0.45, 1.2, -0.42, 0.36, 0);
  for (const [x, z] of [
    [0.4, 0.4],
    [-0.4, 0.4],
    [0.4, -0.4],
    [-0.4, -0.4],
  ] as const)
    box(0.06, 0.16, 0.16, x, 0.08, z, dark); // колёса
  const cargo = CARGO[variant];
  if (cargo) {
    box(
      0.72,
      variant === "hopper" ? 0.4 : 0.6,
      0.72,
      0,
      variant === "hopper" ? 0.6 : 0.5,
      0,
      cargo,
    );
    if (variant === "tnt") box(0.74, 0.14, 0.74, 0, 0.5, 0, band);
  }
  return g;
}

export class Minecart {
  id: number;
  kind = "minecart" as const;
  readonly variant: CartVariant;
  /** Груз вагонетки с сундуком или воронкой. */
  items: (ItemStack | null)[];
  pos: THREE.Vector3;
  prevPos: THREE.Vector3;
  vel = new THREE.Vector3();
  /** Где нарисована (интерполяция) — за неё держится седок. */
  renderPos: THREE.Vector3;
  dead = false;
  /** В вагонетке сидит игрок. */
  rider = false;
  readonly seatY = 0.35;
  hp = 3;
  shake = 0;
  /** Динамит: секунд до взрыва (-1 — не взведён); boom — пора взрываться (EntityManager). */
  fuse = -1;
  boom = false;
  /** Стоит на запитанных активирующих рельсах. */
  onActivator = false;
  /** Вагонетка с воронкой: пауза между переносами. */
  hopCd = 0;
  private yaw = 0;
  mesh: THREE.Group;

  constructor(
    id: number,
    x: number,
    y: number,
    z: number,
    variant: CartVariant = "plain",
  ) {
    this.id = id;
    this.variant = variant;
    this.items = new Array<ItemStack | null>(SLOTS[variant]).fill(null);
    this.pos = new THREE.Vector3(x, y, z);
    this.prevPos = this.pos.clone();
    this.renderPos = this.pos.clone();
    this.mesh = cartMesh(variant);
    this.mesh.position.copy(this.pos);
  }

  /** Что выпадает, когда ломают. */
  get dropItem(): string {
    return DROP[this.variant];
  }

  /** Седок жмёт «вперёд»: толчок в сторону взгляда. */
  push(dx: number, dz: number, dt: number): void {
    this.vel.x += dx * 5 * dt;
    this.vel.z += dz * 5 * dt;
  }

  /** Удар: true — сломана. */
  hit(): boolean {
    this.hp -= 1;
    this.shake = 0.3;
    if (this.hp <= 0) this.dead = true;
    return this.dead;
  }

  tick(dt: number, world: ChunkManager): void {
    this.prevPos.copy(this.pos);
    this.shake = Math.max(0, this.shake - dt);
    if (this.fuse >= 0) {
      this.fuse -= dt;
      if (this.fuse <= 0) this.boom = true;
    }
    const r = railUnder(world, this.pos.x, this.pos.y, this.pos.z);
    this.onActivator =
      !!r && r.id === B.activator_rail && (r.meta & RAIL_POWERED) !== 0;
    if (this.variant === "tnt" && this.onActivator && this.fuse < 0) {
      this.fuse = TNT_CART_FUSE;
      events.emit("tntFuse", { x: this.pos.x, y: this.pos.y, z: this.pos.z });
    }
    if (!r) return this._offRail(dt, world);

    const [a, b] = railPoints(r.shape, r.x, r.y, r.z);
    const A = new THREE.Vector3(...a);
    const d = new THREE.Vector3(...b).sub(A);
    const len = d.length();
    d.divideScalar(len);

    // скорость вдоль пути: знак — куда ехали, величина сохраняется (поворот её не съедает)
    const dot = this.vel.dot(d);
    let v = Math.abs(dot) < 1e-6 ? 0 : Math.sign(dot) * this.vel.length();
    v -= GRAVITY * d.y * dt;
    if (r.id === B.powered_rail) {
      if (r.meta & RAIL_POWERED) {
        if (v !== 0) v += Math.sign(v) * POWER_ACCEL * dt;
      } else v *= Math.max(0, 1 - 8 * dt);
    }
    v *= Math.max(0, 1 - (this.rider ? RIDER_FRICTION : FRICTION) * dt);
    if (Math.abs(v) < 0.03 && d.y === 0) v = 0;
    v = Math.max(-CART_MAX_SPEED, Math.min(CART_MAX_SPEED, v));

    let t = Math.max(0, Math.min(len, this.pos.clone().sub(A).dot(d))) + v * dt;
    if (t < 0 || t > len) {
      // за край клетки: есть ли рельс дальше? нет — тупик, встаём внутри своей клетки
      const ex = t > len ? b : a;
      const s = t > len ? 0.05 : -0.05;
      if (
        !railUnder(world, ex[0] + d.x * s, ex[1] + d.y * s, ex[2] + d.z * s)
      ) {
        t = Math.max(0.02, Math.min(len - 0.02, t));
        v = 0;
      }
    }
    this.pos.copy(A).addScaledVector(d, t);
    this.vel.copy(d).multiplyScalar(v);
    if (Math.abs(d.x) + Math.abs(d.z) > 0.1) this.yaw = Math.atan2(d.x, d.z);
  }

  /** Без рельсов: падает до опоры, по земле тормозит. */
  private _offRail(dt: number, world: ChunkManager): void {
    this.vel.y -= GRAVITY * dt;
    const k = Math.max(0, 1 - 3 * dt);
    this.vel.x *= k;
    this.vel.z *= k;
    const x = this.pos.x + this.vel.x * dt,
      z = this.pos.z + this.vel.z * dt;
    const ny = this.pos.y + this.vel.y * dt;
    const below = world.getBlock(Math.floor(x), Math.floor(ny), Math.floor(z));
    if (this.vel.y < 0 && isRail(below)) {
      this.pos.set(x, Math.floor(ny), z);
      this.vel.y = 0;
    } else if (this.vel.y < 0 && BLOCKS[below]?.solid) {
      this.pos.set(x, Math.floor(ny) + 1, z);
      this.vel.y = 0;
    } else this.pos.set(x, ny, z);
    if (this.pos.y < -64) this.dead = true;
  }

  updateVisual(alpha: number): void {
    this.renderPos.copy(this.prevPos).lerp(this.pos, alpha);
    this.mesh.position.copy(this.renderPos);
    this.mesh.rotation.set(
      0,
      this.yaw,
      this.shake > 0 ? Math.sin(this.shake * 40) * 0.12 : 0,
    );
    // взведённый динамит пульсирует
    this.mesh.scale.setScalar(
      this.fuse >= 0 ? 1 + Math.max(0, Math.sin(this.fuse * 12)) * 0.06 : 1,
    );
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    this.mesh.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
    });
  }

  serialize() {
    return {
      kind: "minecart",
      pos: this.pos.toArray(),
      vel: this.vel.toArray(),
      ...(this.variant !== "plain" ? { variant: this.variant } : {}),
      ...(this.items.length
        ? { items: this.items.map((s) => (s ? { ...s } : null)) }
        : {}),
    };
  }
}
