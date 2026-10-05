// Внешние острова Предела (дальше OUTER_START от центра) и города Предела на них, как в Minecraft:
// лиловая башня в 3–4 этажа с лестницей внутри, панцирниками, светящимися стержнями и сундуками
// наверху; рядом в воздухе — корабль с Крыльями Предела в сундуке и головой дракона на носу.
// План города — чистая функция сида и региона (как деревня, worldgen/features/village): записи
// блоков по чанкам, жители-панцирники (селит Game) и сундуки с добычей (lootAt).
import { hashString, mulberry32 } from "../../core/Noise";
import { B } from "../../registry/Blocks";
import { ITEMS } from "../../registry/Items";
import { FACING_DIRS } from "../../registry/meta";
import type { ItemStack } from "../../types";
import type { Resident } from "../features/village";

/** Внешние острова начинаются дальше этого радиуса (в Minecraft — 1000; для браузера ближе). */
export const OUTER_START = 700;
/** Сторона региона, в котором бывает не больше одного города (кратна 16). */
export const CITY_REGION = 160;
const MARGIN = 32;
const CITY_CHANCE = 0.5;
/** Полуширина башни. */
const HALF = 4;

export type LootKind = "city" | "ship";

export interface City {
  id: string;
  x: number;
  y: number;
  z: number;
  ops: Map<string, number[]>;
  residents: Resident[];
  /** Сундуки: "x,y,z" → вид добычи. */
  chests: Map<string, LootKind>;
  /** Габариты [x0, y0, z0, x1, y1, z1] включительно — structureAt. */
  box: [number, number, number, number, number, number];
}

/** Что городу нужно от генератора. */
export interface OuterTerrain {
  surfaceAt(x: number, z: number): number | null;
}

class Builder {
  readonly ops = new Map<string, number[]>();
  readonly box: [number, number, number, number, number, number] = [
    Infinity,
    Infinity,
    Infinity,
    -Infinity,
    -Infinity,
    -Infinity,
  ];
  set(x: number, y: number, z: number, id: number | undefined, meta = 0): void {
    if (id === undefined || y < 1) return;
    const k = (x >> 4) + "," + (z >> 4);
    let a = this.ops.get(k);
    if (!a) this.ops.set(k, (a = []));
    a.push(x, y, z, id, meta);
    const b = this.box;
    b[0] = Math.min(b[0], x);
    b[1] = Math.min(b[1], y);
    b[2] = Math.min(b[2], z);
    b[3] = Math.max(b[3], x);
    b[4] = Math.max(b[4], y);
    b[5] = Math.max(b[5], z);
  }
}

export const inBox = (
  b: City["box"],
  x: number,
  y: number,
  z: number,
): boolean =>
  x >= b[0] && x <= b[3] && y >= b[1] && y <= b[4] && z >= b[2] && z <= b[5];

/** Город региона (rx, rz) или null: не выпало, близко к центру, нет острова под башней. */
export function planCity(
  t: OuterTerrain,
  seed: number,
  rx: number,
  rz: number,
): City | null {
  const rng = mulberry32(hashString(`beyond-city:${seed}:${rx},${rz}`));
  if (rng() > CITY_CHANCE) return null;
  const span = CITY_REGION - 2 * MARGIN;
  const cx = rx * CITY_REGION + MARGIN + Math.floor(rng() * span);
  const cz = rz * CITY_REGION + MARGIN + Math.floor(rng() * span);
  if (Math.hypot(cx, cz) < OUTER_START + 40) return null;
  const top = t.surfaceAt(cx, cz);
  if (top === null) return null;
  for (const [dx, dz] of [
    [-HALF, -HALF],
    [HALF, -HALF],
    [-HALF, HALF],
    [HALF, HALF],
  ] as const)
    if (t.surfaceAt(cx + dx, cz + dz) === null) return null;

  const b = new Builder();
  const chests = new Map<string, LootKind>();
  const residents: Resident[] = [];
  // фундамент: от поверхности каждой колонны до пола башни
  for (let dx = -HALF; dx <= HALF; dx++)
    for (let dz = -HALF; dz <= HALF; dz++) {
      const s = t.surfaceAt(cx + dx, cz + dz) ?? top - 6;
      for (let y = Math.min(s, top) + 1; y <= top; y++)
        b.set(cx + dx, y, cz + dz, B.beyond_bricks);
    }

  const floors = 3 + Math.floor(rng() * 2);
  let y = top + 1;
  for (let f = 0; f < floors; f++) {
    for (let dx = -HALF; dx <= HALF; dx++)
      for (let dz = -HALF; dz <= HALF; dz++) {
        const edge = Math.abs(dx) === HALF || Math.abs(dz) === HALF;
        const corner = Math.abs(dx) === HALF && Math.abs(dz) === HALF;
        b.set(cx + dx, y, cz + dz, B.beyond_bricks); // пол (он же потолок нижнего этажа)
        for (let yy = y + 1; yy <= y + 4; yy++)
          b.set(
            cx + dx,
            yy,
            cz + dz,
            corner ? B.lilac_pillar : edge ? B.lilac_block : B.air,
          );
      }
    // окна в серединах трёх стен (у четвёртой, +z, — лестница), внизу — дверной проём
    for (const [wx, wz] of [
      [0, -HALF],
      [HALF, 0],
      [-HALF, 0],
    ] as const)
      for (let yy = y + 2; yy <= y + 3; yy++)
        b.set(cx + wx, yy, cz + wz, B.air);
    if (f === 0) b.set(cx, y + 1, cz - HALF, B.air);
    // лестница у стены +z, сквозь пол следующего этажа (мета 2 — стена в сторону +z)
    for (let yy = y + 1; yy <= y + 5; yy++)
      b.set(cx, yy, cz + HALF - 1, B.ladder, 2);
    // стержни под потолком по углам — свет
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const)
      b.set(cx + sx * (HALF - 1), y + 4, cz + sz * (HALF - 1), B.beyond_rod);
    // панцирники: один-два на этаж
    const spots: [number, number][] = [
      [-2, -2],
      [2, -2],
      [-2, 2],
      [2, 2],
      [0, 0],
    ];
    for (let i = 1 + Math.floor(rng() * 2); i > 0; i--) {
      const [sx, sz] = spots.splice(Math.floor(rng() * spots.length), 1)[0]!;
      residents.push({
        type: "shellkeeper",
        x: cx + sx + 0.5,
        y: y + 1,
        z: cz + sz + 0.5,
      });
    }
    // на верхнем этаже — два сундука лицом к середине
    if (f === floors - 1)
      for (const [sx, facing] of [
        [-2, 1],
        [2, 3],
      ] as const) {
        b.set(cx + sx, y + 1, cz, B.chest, facing);
        chests.set(`${cx + sx},${y + 1},${cz}`, "city");
      }
    y += 5;
  }
  // крыша с выходом по лестнице и стержнями по углам
  for (let dx = -HALF; dx <= HALF; dx++)
    for (let dz = -HALF; dz <= HALF; dz++)
      if (dx === 0 && dz === HALF - 1) b.set(cx, y, cz + dz, B.ladder, 2);
      else b.set(cx + dx, y, cz + dz, B.lilac_block);
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const)
    b.set(cx + sx * HALF, y + 1, cz + sz * HALF, B.beyond_rod);

  ship(b, rng, cx, top, cz, chests, residents);
  return {
    id: `city:${rx},${rz}`,
    x: cx,
    y: top,
    z: cz,
    ops: b.ops,
    residents,
    chests,
    box: b.box,
  };
}

/** Корабль над островом рядом с башней: палуба, мачта с парусом, сундук на корме, голова на носу. */
function ship(
  b: Builder,
  rng: () => number,
  cx: number,
  top: number,
  cz: number,
  chests: Map<string, LootKind>,
  residents: Resident[],
): void {
  const dir = rng() < 0.5 ? 1 : -1;
  const sx = cx + dir * 22,
    sy = top + 12;
  const at = (a: number): number => sx + dir * a;
  for (let a = -6; a <= 6; a++)
    for (let c = -2; c <= 2; c++) {
      const x = at(a),
        z = cz + c;
      const edge = Math.abs(a) === 6 || Math.abs(c) === 2;
      if (Math.abs(a) <= 4 && Math.abs(c) <= 1) b.set(x, sy, z, B.lilac_block); // киль
      b.set(x, sy + 1, z, edge ? B.lilac_block : B.beyond_bricks); // трюм
      b.set(x, sy + 2, z, B.lilac_block); // палуба
      b.set(x, sy + 3, z, edge ? B.lilac_block : B.air); // борт
    }
  for (let y = sy + 3; y <= sy + 10; y++) b.set(at(0), y, cz, B.lilac_pillar); // мачта
  for (let y = sy + 5; y <= sy + 9; y++)
    for (const c of [-2, -1, 1, 2]) b.set(at(0), y, cz + c, B.white_wool);
  // нос: голова дракона смотрит вперёд; корма: сундук с Крыльями и стержни
  const bow = dir > 0 ? 1 : 3;
  b.set(at(7), sy + 2, cz, B.dragon_head, bow);
  b.set(at(-4), sy + 3, cz, B.chest, bow);
  chests.set(`${at(-4)},${sy + 3},${cz}`, "ship");
  for (const c of [-2, 2]) b.set(at(-6), sy + 4, cz + c, B.beyond_rod);
  for (const c of [-1, 1])
    residents.push({
      type: "shellkeeper",
      x: at(3) + 0.5,
      y: sy + 3,
      z: cz + c + 0.5,
    });
}

/** Добыча городов: [предмет, от, до, вес]. */
export const CITY_LOOT: readonly (readonly [string, number, number, number])[] =
  [
    ["iron_ingot", 4, 8, 10],
    ["gold_ingot", 2, 7, 15],
    ["diamond", 2, 7, 5],
    ["emerald", 2, 6, 2],
    ["saddle", 1, 1, 3],
    ["iron_sword", 1, 1, 3],
    ["iron_pickaxe", 1, 1, 3],
    ["iron_chestplate", 1, 1, 3],
    ["diamond_sword", 1, 1, 3],
    ["diamond_pickaxe", 1, 1, 3],
    ["diamond_chestplate", 1, 1, 3],
    ["diamond_helmet", 1, 1, 3],
    ["spire_armor_trim_smithing_template", 1, 1, 2],
  ];

/** 27 слотов сундука города; у корабля в середине — Крылья Предела. Чистая функция места. */
export function cityLoot(
  kind: LootKind,
  seed: number,
  x: number,
  y: number,
  z: number,
): (ItemStack | null)[] {
  const rng = mulberry32(hashString(`beyond-loot:${seed}:${x},${y},${z}`));
  const slots = new Array<ItemStack | null>(27).fill(null);
  const pool = CITY_LOOT.filter(([n]) => ITEMS[n]);
  const total = pool.reduce((s, e) => s + e[3], 0);
  for (let i = 4 + Math.floor(rng() * 5); i > 0 && pool.length; i--) {
    let r = rng() * total;
    let e = pool[0]!;
    for (const p of pool) {
      r -= p[3];
      if (r <= 0) {
        e = p;
        break;
      }
    }
    let slot = Math.floor(rng() * 27);
    while (slots[slot]) slot = (slot + 1) % 27;
    slots[slot] = {
      item: e[0],
      count: e[1] + Math.floor(rng() * (e[2] - e[1] + 1)),
    };
  }
  if (kind === "ship" && ITEMS.wings) slots[13] = { item: "wings", count: 1 };
  return slots;
}

/** Доля колонн внешних островов, на которых растёт эхоцвет. */
export const ECHO_CHANCE = 0.006;

/** Дешёвый детерминированный шум колонны 0..1. */
export function echoRoll(seed: number, x: number, z: number): number {
  let h =
    (Math.imul(x, 374761393) +
      Math.imul(z, 668265263) +
      Math.imul(seed, 1274126177)) |
    0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Куст эхоцвета из колонны (x, z) над верхом top: [x, y, z, id]. Ветка вбок — у высоких. */
export function plantEcho(
  seed: number,
  x: number,
  top: number,
  z: number,
): [number, number, number, number][] {
  const r = echoRoll(seed + 1, x, z);
  const h = 2 + Math.floor(r * 4);
  const out: [number, number, number, number][] = [];
  for (let i = 1; i <= h; i++) out.push([x, top + i, z, B.echo_plant!]);
  out.push([x, top + h + 1, z, B.echo_flower!]);
  if (h >= 3) {
    const [dx, dz] = FACING_DIRS[Math.floor(r * 1000) & 3]!;
    out.push(
      [x + dx, top + 2, z + dz, B.echo_plant!],
      [x + dx, top + 3, z + dz, B.echo_plant!],
      [x + dx, top + 4, z + dz, B.echo_flower!],
    );
  }
  return out;
}
