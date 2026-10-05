// Снеговик, как в Minecraft: собирается из двух блоков снега и тыквы сверху (EntityManager.buildSnowGolem),
// кидает снежки во враждебных мобов в 10 блоках (раз в секунду), где проходит — оставляет снежный слой,
// в жаре (пустыня, саванна, джунгли, Пекло) и в воде тает — 1 урона в секунду.
import * as THREE from "three";
import { BLOCKS, B } from "../registry/Blocks";
import type { Mob } from "./Mob";
import type { MobCtx } from "./MobBrain";

const HOT = new Set([
  "desert",
  "savanna",
  "jungle",
  "warm_ocean",
  "mangrove_swamp",
]);
const RANGE = 10;

/** Стоит ли тыква в (x, y, z) на двух блоках снега — фигура снеговика. */
export function isSnowGolem(
  get: (x: number, y: number, z: number) => number,
  x: number,
  y: number,
  z: number,
): boolean {
  return (
    get(x, y, z) === B.pumpkin &&
    get(x, y - 1, z) === B.snow &&
    get(x, y - 2, z) === B.snow
  );
}

/** Тает, оставляет след, обстреливает врага. @returns true — бросает (обычный мозг ждёт) */
export function snowGolemTick(m: Mob, c: MobCtx, dt: number): boolean {
  const w = c.world;
  const x = Math.floor(m.pos.x),
    y = Math.floor(m.pos.y),
    z = Math.floor(m.pos.z);
  const hot =
    w.dimension === "inferno" || HOT.has(w.generator.biomeOf?.(x, z) ?? "");
  if (hot || m.inWater) {
    m.snowT += dt;
    if (m.snowT >= 1) {
      m.snowT = 0;
      m.damage(1);
    }
  } else {
    m.snowT = 0;
    const below = BLOCKS[w.getBlock(x, y - 1, z)];
    if (
      w.getBlock(x, y, z) === B.air &&
      below?.solid &&
      below.opaque &&
      B.snow_layer !== undefined
    )
      w.setBlock(x, y, z, B.snow_layer, 0);
  }

  const foe =
    c.near?.(
      m.pos,
      RANGE,
      (o) => !o.dead && o.def.category === "hostile" && !o.def.boss,
    ) ?? null;
  if (!foe) return false;
  m.state = "chase";
  m.targetYaw = Math.atan2(-(foe.pos.x - m.pos.x), -(foe.pos.z - m.pos.z));
  m.speed = 0;
  if (m.shootCd <= 0) {
    const eye = new THREE.Vector3(m.pos.x, m.pos.y + m.height * 0.85, m.pos.z);
    c.shoot(
      eye,
      new THREE.Vector3(foe.pos.x, foe.pos.y + foe.height * 0.6, foe.pos.z),
      20,
      0,
      m,
      "snowball",
    );
    m.shootCd = 1;
    m.swing = 0.3;
  }
  return true;
}
