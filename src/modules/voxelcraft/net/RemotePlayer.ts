// Другой игрок сетевой игры — у ВЛАДЕЛЬЦА измерения. Мобы, стрелы, взрывы и подбор работают с ним
// как с обычным Player (EntityManager.others), но состояние игрока — у самого игрока (вариант А):
// урон, отброс, эффекты и опыт не применяются здесь, а уходят ему по сети; подобранный предмет
// «выдаётся» ему, а не кладётся в чужой инвентарь.
import * as THREE from "three";
import { Player } from "../player/Player";
import type { ChunkManager } from "../world/ChunkManager";
import type { Inventory } from "../systems/Inventory";
import type { EffectId, ItemStack } from "../types";
import { POSE_CREATIVE, POSE_DEAD, POSE_SNEAK, type Pose } from "./protocol";

/** Куда уходит то, что с удалённым игроком случилось у владельца измерения. */
export interface RemoteSink {
  hit(
    slot: number,
    amount: number,
    cause: string,
    knock?: [number, number, number],
    effect?: { id: string; seconds: number; level: number },
  ): void;
  give(slot: number, stack: ItemStack | null, xp?: number): void;
}

export class RemotePlayer extends Player {
  readonly slot: number;
  readonly userId: string;
  /** Предмет в руке (PlayerMeta) — для мобов, которые идут за едой в руке. */
  held: string | null = null;
  /** Скорость из последней позы: всё, что к ней добавили за тик (толчки), уходит игроку. */
  private readonly velBase = new THREE.Vector3();

  constructor(
    world: ChunkManager,
    slot: number,
    userId: string,
    private readonly sink: RemoteSink,
  ) {
    super(world);
    this.slot = slot;
    this.userId = userId;
  }

  applyPose(p: Pose): void {
    this.pos.set(p.x, p.y, p.z);
    this.yaw = p.yaw;
    this.pitch = p.pitch;
    this.dead = (p.flags & POSE_DEAD) !== 0;
    this._sneaking = (p.flags & POSE_SNEAK) !== 0;
    this.mode = p.flags & POSE_CREATIVE ? "creative" : "survival";
    this.health = p.health;
    this.vel.set(0, 0, 0);
    this.velBase.set(0, 0, 0);
  }

  /** Урон — игроку: он сам решит про щит, броню, тотем и смерть. */
  override damage(amount: number, cause: string): void {
    if (this.dead || this.mode === "creative" || amount <= 0) return;
    this.sink.hit(this.slot, amount, cause);
  }

  override knock(dx: number, dz: number, strength: number): void {
    const len = Math.hypot(dx, dz) || 1;
    this.vel.x += (dx / len) * strength;
    this.vel.z += (dz / len) * strength;
    this.vel.y = Math.max(this.vel.y, 4);
  }

  override addEffect(id: EffectId, seconds: number, level = 1): void {
    this.sink.hit(this.slot, 0, "effect", undefined, { id, seconds, level });
  }

  override addXp(amount: number): void {
    if (amount > 0) this.sink.give(this.slot, null, amount);
  }

  /** Щит решает сам игрок (у него инвентарь): здесь не блокирует ничего. */
  override shieldBlocks(): boolean {
    return false;
  }

  /**
   * Толчок, накопленный за тик (knock, взрыв добавили к vel): отдать игроку и обнулить. Зовёт
   * NetGame после тика сущностей.
   */
  takeImpulse(): [number, number, number] | null {
    const dx = this.vel.x - this.velBase.x,
      dy = this.vel.y - this.velBase.y,
      dz = this.vel.z - this.velBase.z;
    this.vel.copy(this.velBase);
    if (dx * dx + dy * dy + dz * dz < 0.01) return null;
    return [dx, dy, dz];
  }
}

/**
 * Инвентарь удалённого игрока у владельца измерения: подобранное уходит игроку. Считается, что
 * место есть — если нет, игрок сам выбросит лишнее у себя (его инвентарь авторитетен).
 */
export function remoteInventory(p: RemotePlayer, sink: RemoteSink): Inventory {
  const inv = {
    add(item: string, count: number): number {
      sink.give(p.slot, { item, count });
      return 0;
    },
    addStack(s: ItemStack): number {
      sink.give(p.slot, { ...s });
      return 0;
    },
    heldItem(): ItemStack | null {
      return p.held ? { item: p.held, count: 1 } : null;
    },
    slots: [] as (ItemStack | null)[],
    armor: [] as (ItemStack | null)[],
  };
  return inv as unknown as Inventory;
}

// ============================================================ аватар

const SKIN = 0xc69c7c,
  SHIRT = 0x3a8fd6,
  PANTS = 0x2c3e6b,
  HAIR = 0x4a2f1b;

function box(w: number, h: number, d: number, color: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  m.castShadow = true;
  return m;
}

/** Табличка с именем над головой: канвас-текстура на спрайте. */
function nameplate(text: string): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 48;
  const g = c.getContext("2d");
  if (g) {
    g.fillStyle = "rgba(0,0,0,0.45)";
    g.fillRect(0, 0, 256, 48);
    g.font = "bold 28px sans-serif";
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text.slice(0, 18), 128, 25);
  }
  const tex = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }),
  );
  s.scale.set(1.6, 0.3, 1);
  s.position.y = 2.15;
  s.renderOrder = 10;
  return s;
}

/**
 * Модель другого игрока в духе Minecraft: голова, тело, руки, ноги из кубов. Ходьба — качание ног
 * по пройденному пути, замах — правой рукой, присед — наклон, смерть — лёжа.
 */
export class Avatar {
  readonly group = new THREE.Group();
  private readonly head: THREE.Group;
  private readonly armL: THREE.Group;
  private readonly armR: THREE.Group;
  private readonly legL: THREE.Group;
  private readonly legR: THREE.Group;
  private readonly body: THREE.Group;
  private walk = 0;
  private swing = 0;
  private readonly from = new THREE.Vector3();
  private readonly to = new THREE.Vector3();
  private yawFrom = 0;
  private yawTo = 0;
  private pitch = 0;
  private t = 1;
  private flags = 0;
  private label: THREE.Sprite;

  constructor(name: string) {
    const limb = (color: number, x: number, y: number): THREE.Group => {
      const g = new THREE.Group();
      const m = box(0.25, 0.75, 0.25, color);
      m.position.y = -0.375;
      g.add(m);
      g.position.set(x, y, 0);
      return g;
    };
    this.body = new THREE.Group();
    const torso = box(0.5, 0.75, 0.25, SHIRT);
    torso.position.y = 1.125;
    this.body.add(torso);
    this.head = new THREE.Group();
    const skull = box(0.5, 0.5, 0.5, SKIN);
    skull.position.y = 0.25;
    const hair = box(0.52, 0.14, 0.52, HAIR);
    hair.position.y = 0.46;
    this.head.add(skull, hair);
    this.head.position.y = 1.5;
    this.armL = limb(SHIRT, -0.375, 1.5);
    this.armR = limb(SHIRT, 0.375, 1.5);
    this.legL = limb(PANTS, -0.125, 0.75);
    this.legR = limb(PANTS, 0.125, 0.75);
    this.body.add(this.head, this.armL, this.armR, this.legL, this.legR);
    this.label = nameplate(name);
    this.group.add(this.body, this.label);
  }

  setName(name: string): void {
    this.group.remove(this.label);
    this.label.material.map?.dispose();
    this.label.material.dispose();
    this.label = nameplate(name);
    this.group.add(this.label);
  }

  /** Новая поза из сети: от текущего положения к новому за ~один интервал поз. */
  target(p: Pose): void {
    this.from.copy(this.group.position);
    this.to.set(p.x, p.y, p.z);
    this.yawFrom = this.group.rotation.y;
    this.yawTo = p.yaw;
    this.pitch = p.pitch;
    this.flags = p.flags;
    if (p.flags & 32) this.swing = 0.3;
    // первая поза или телепорт — без плавания через полкарты
    if (this.t >= 1 && this.from.distanceToSquared(this.to) > 64)
      this.from.copy(this.to);
    this.t = 0;
  }

  frame(dt: number): void {
    this.t = Math.min(1, this.t + dt / 0.06);
    const prev = this.group.position.clone();
    this.group.position.lerpVectors(this.from, this.to, this.t);
    let dy = this.yawTo - this.yawFrom;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.group.rotation.y = this.yawFrom + dy * this.t;
    this.head.rotation.x = this.pitch;
    const moved = Math.hypot(
      this.group.position.x - prev.x,
      this.group.position.z - prev.z,
    );
    this.walk += moved * 4;
    const a = Math.sin(this.walk) * Math.min(1, moved * 20) * 0.8;
    this.legL.rotation.x = a;
    this.legR.rotation.x = -a;
    this.armL.rotation.x = -a * 0.6;
    this.swing = Math.max(0, this.swing - dt);
    this.armR.rotation.x =
      a * 0.6 -
      (this.swing > 0 ? Math.sin((this.swing / 0.3) * Math.PI) * 1.4 : 0);
    const sneak = (this.flags & POSE_SNEAK) !== 0;
    this.body.rotation.x = sneak ? 0.35 : 0;
    this.body.position.y = sneak ? -0.2 : 0;
    const dead = (this.flags & POSE_DEAD) !== 0;
    this.body.rotation.z = dead ? Math.PI / 2 : 0;
    this.label.visible = !dead;
  }

  dispose(scene: THREE.Object3D): void {
    scene.remove(this.group);
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.label.material.map?.dispose();
    this.label.material.dispose();
  }
}
