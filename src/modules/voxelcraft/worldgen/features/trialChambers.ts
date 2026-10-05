// Испытательные камеры (слой особенностей gen2): под землёй (пол y 22) — зал 13×13 и четыре комнаты 9×9
// на коридорах. Стены — туфовые кирпичи, потолок — полированный туф, пол — шашечками из меди и резной
// меди, в потолке светокамень. В каждой комнате спавнер испытаний своего вида (мета — TRIAL_MOBS), в зале —
// спавнер вихрей; хранилища — по углам зала и комнат. План — чистая функция сида.
import { hashString, mulberry32 } from "../../core/Noise";
import { B } from "../../registry/Blocks";
import { COPPER_STAGES } from "../../registry/blocks/copper";
import type { TempleTerrain } from "./temple";
import type { Village } from "./village";

export const TRIAL_REGION = 640;
const MARGIN = 64;
const CHANCE = 0.6;
export const TRIAL_FLOOR = 22;
const ARM = 16;

export interface TrialChamber extends Village {
  box: [number, number, number, number, number, number];
  spawners: [number, number, number][];
  vaults: Set<string>;
}

export const inTrialChamber = (
  t: TrialChamber,
  x: number,
  y: number,
  z: number,
): boolean =>
  x >= t.box[0] &&
  x <= t.box[3] &&
  y >= t.box[1] &&
  y <= t.box[4] &&
  z >= t.box[2] &&
  z <= t.box[5];

export function planTrialChamber(
  t: TempleTerrain,
  seed: number,
  rx: number,
  rz: number,
): TrialChamber | null {
  const rng = mulberry32(hashString(`ow-trial:${seed}:${rx},${rz}`));
  if (rng() > CHANCE) return null;
  const span = TRIAL_REGION - 2 * MARGIN;
  const cx = rx * TRIAL_REGION + MARGIN + Math.floor(rng() * span);
  const cz = rz * TRIAL_REGION + MARGIN + Math.floor(rng() * span);
  const y0 = TRIAL_FLOOR;
  for (const [dx, dz] of [
    [0, 0],
    [ARM, 0],
    [-ARM, 0],
    [0, ARM],
    [0, -ARM],
  ] as const)
    if (t.heightAt(cx + dx, cz + dz) < y0 + 18) return null;

  // полость: зал, коридоры, комнаты — множество клеток воздуха
  const air = new Set<string>();
  const k3 = (x: number, y: number, z: number) => `${x},${y},${z}`;
  const room = (ox: number, oz: number, r: number, h: number) => {
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++)
        for (let y = 1; y <= h; y++) air.add(k3(ox + dx, y0 + y, oz + dz));
  };
  room(cx, cz, 6, 6);
  const rooms: [number, number][] = [
    [cx + ARM, cz],
    [cx - ARM, cz],
    [cx, cz + ARM],
    [cx, cz - ARM],
  ];
  for (const [ox, oz] of rooms) {
    room(ox, oz, 4, 5);
    // коридор 3×3 от зала до комнаты
    const sx = Math.sign(ox - cx),
      sz = Math.sign(oz - cz);
    for (let d = 6; d <= ARM - 4; d++)
      for (let w = -1; w <= 1; w++)
        for (let y = 1; y <= 3; y++)
          air.add(
            k3(cx + sx * d + (sz ? w : 0), y0 + y, cz + sz * d + (sx ? w : 0)),
          );
  }

  const ops = new Map<string, number[]>();
  const box: TrialChamber["box"] = [
    cx - ARM - 6,
    y0,
    cz - ARM - 6,
    cx + ARM + 6,
    y0 + 8,
    cz + ARM + 6,
  ];
  const set = (
    x: number,
    y: number,
    z: number,
    id: number | undefined,
    meta = 0,
  ): void => {
    if (id === undefined) return;
    const k = (x >> 4) + "," + (z >> 4);
    let a = ops.get(k);
    if (!a) ops.set(k, (a = []));
    a.push(x, y, z, id, meta);
  };
  // оболочка: соседи полости, которые не полость — пол, потолок или стена
  const shell = new Set<string>();
  for (const c of air) {
    const [x, y, z] = c.split(",").map(Number) as [number, number, number];
    set(x, y, z, B.air);
    for (const [dx, dy, dz] of [
      [0, -1, 0],
      [0, 1, 0],
      [1, 0, 0],
      [-1, 0, 0],
      [0, 0, 1],
      [0, 0, -1],
    ] as const) {
      const n = k3(x + dx, y + dy, z + dz);
      if (air.has(n) || shell.has(n)) continue;
      shell.add(n);
      const X = x + dx,
        Y = y + dy,
        Z = z + dz;
      // пол — шашечками из меди и резной меди разной степени окисления, как в Minecraft
      const stage = rng() < 0.5 ? 0 : rng() < 0.6 ? 1 : 2;
      const floor = B[COPPER_STAGES[(X + Z) & 1]![stage]!];
      set(X, Y, Z, dy < 0 ? floor : dy > 0 ? B.polished_tuff : B.tuff_bricks);
    }
  }
  // свет в потолке, спавнеры и хранилища
  const spawners: [number, number, number][] = [];
  const vaults = new Set<string>();
  const vault = (x: number, z: number) => {
    set(x, y0 + 1, z, B.vault);
    vaults.add(k3(x, y0 + 1, z));
  };
  set(cx, y0 + 7, cz, B.glowstone);
  set(cx, y0 + 1, cz, B.trial_spawner, 3); // вихри
  spawners.push([cx, y0 + 1, cz]);
  vault(cx + 5, cz + 5);
  vault(cx - 5, cz - 5);
  rooms.forEach(([ox, oz], i) => {
    set(ox, y0 + 6, oz, B.glowstone);
    const kind = Math.floor(rng() * 3); // зомби, скелеты или пауки
    set(ox, y0 + 1, oz, B.trial_spawner, kind);
    spawners.push([ox, y0 + 1, oz]);
    if (i % 2 === 0) vault(ox + 3, oz - 3);
  });
  return {
    id: `trial:${rx},${rz}`,
    x: cx,
    y: y0 + 1,
    z: cz,
    ops,
    residents: [],
    box,
    spawners,
    vaults,
  };
}
