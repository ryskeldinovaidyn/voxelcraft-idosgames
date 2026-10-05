// Подводный храм (океанский монумент Minecraft, ужатый до 23×23): в глубоком океане, целиком под
// водой. Стены из кирпичей морского камня с фонарями, крыша-пирамида из тёмного морского камня,
// колонны, вход с юга, в середине — ядро из тёмного камня с восемью золотыми блоками, по углам
// потолка — мокрые губки. Жители — три древних глубинника (селит Game, как жителей деревни),
// обычные глубинники появляются в храме сами (spawn.structure = "sea_temple").
// План — чистая функция сида и региона, накладывается тем же carveVillages.
import { hashString, mulberry32 } from "../../core/Noise";
import { B, packWater } from "../../registry/Blocks";
import type { Resident, Village } from "./village";

export const TEMPLE_REGION = 384;
const MARGIN = 48;
const CHANCE = 0.8;
const HALF = 11;
/** Высота стен над полом. */
const HEIGHT = 12;

export interface Temple extends Village {
  box: [number, number, number, number, number, number];
}

export interface TempleTerrain {
  heightAt(x: number, z: number): number;
  biomeAt(x: number, z: number, h: number): string;
  readonly waterLevel: number;
}

/** Дешёвый детерминированный шум колонны 0..1 (морская трава). */
export function seaRoll(seed: number, x: number, z: number): number {
  let h =
    (Math.imul(x, 668265263) +
      Math.imul(z, 374761393) +
      Math.imul(seed, 2246822519)) |
    0;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

export const inTemple = (t: Temple, x: number, y: number, z: number): boolean =>
  x >= t.box[0] &&
  x <= t.box[3] &&
  y >= t.box[1] &&
  y <= t.box[4] &&
  z >= t.box[2] &&
  z <= t.box[5];

/** Храм региона (rx, rz) или null: не выпало, не глубокий океан под всем храмом. */
export function planTemple(
  t: TempleTerrain,
  seed: number,
  rx: number,
  rz: number,
): Temple | null {
  const rng = mulberry32(hashString(`ow-temple:${seed}:${rx},${rz}`));
  if (rng() > CHANCE) return null;
  const span = TEMPLE_REGION - 2 * MARGIN;
  const cx = rx * TEMPLE_REGION + MARGIN + Math.floor(rng() * span);
  const cz = rz * TEMPLE_REGION + MARGIN + Math.floor(rng() * span);
  const sea = t.waterLevel;
  let floor = Infinity;
  for (const [dx, dz] of [
    [0, 0],
    [-HALF, -HALF],
    [HALF, -HALF],
    [-HALF, HALF],
    [HALF, HALF],
  ] as const) {
    const h = t.heightAt(cx + dx, cz + dz);
    if (h > sea - 20 || t.biomeAt(cx + dx, cz + dz, h) !== "ocean") return null;
    floor = Math.min(floor, h);
  }
  const base = floor + 1;
  if (base + HEIGHT + 5 > sea) return null; // целиком под водой

  const ops = new Map<string, number[]>();
  const box: Temple["box"] = [
    cx - HALF,
    Infinity,
    cz - HALF,
    cx + HALF,
    -Infinity,
    cz + HALF,
  ];
  const set = (
    x: number,
    y: number,
    z: number,
    id: number | undefined,
    meta = 0,
  ): void => {
    if (id === undefined || y < 1) return;
    const k = (x >> 4) + "," + (z >> 4);
    let a = ops.get(k);
    if (!a) ops.set(k, (a = []));
    a.push(x, y, z, id, meta);
    box[1] = Math.min(box[1], y);
    box[4] = Math.max(box[4], y);
  };
  const water = packWater(8, true);

  for (let dx = -HALF; dx <= HALF; dx++)
    for (let dz = -HALF; dz <= HALF; dz++) {
      const x = cx + dx,
        z = cz + dz;
      // фундамент до дна, пол
      for (let y = t.heightAt(x, z) + 1; y < base; y++)
        set(x, y, z, B.sea_stone);
      set(x, base, z, B.sea_bricks);
      const edge = Math.abs(dx) === HALF || Math.abs(dz) === HALF;
      for (let y = base + 1; y <= base + HEIGHT; y++) {
        const lantern = edge && y === base + 6 && (dx + dz) % 4 === 0;
        if (edge) set(x, y, z, lantern ? B.sea_lantern : B.sea_bricks);
        else set(x, y, z, B.water, water); // внутри — вода
      }
      set(x, base + HEIGHT + 1, z, B.dark_sea_stone); // крыша
    }
  // пирамида над крышей
  for (let k = 1; k <= 3; k++) {
    const h = HALF - 3 * k;
    for (let dx = -h; dx <= h; dx++)
      for (let dz = -h; dz <= h; dz++)
        set(
          cx + dx,
          base + HEIGHT + 1 + k,
          cz + dz,
          k === 3 && !dx && !dz ? B.sea_lantern : B.dark_sea_stone,
        );
  }
  // вход с юга
  for (let dx = -1; dx <= 1; dx++)
    for (let y = base + 1; y <= base + 4; y++)
      set(cx + dx, y, cz - HALF, B.water, water);
  // колонны
  for (const [px, pz] of [
    [-5, -5],
    [5, -5],
    [-5, 5],
    [5, 5],
  ] as const)
    for (let y = base + 1; y <= base + HEIGHT; y++)
      set(cx + px, y, cz + pz, B.sea_stone);
  // ядро: тёмный камень, внутри 8 золотых блоков
  for (let dx = -2; dx <= 2; dx++)
    for (let dz = -2; dz <= 2; dz++)
      for (let y = base + 1; y <= base + 5; y++) {
        const gold =
          dx >= 0 &&
          dx <= 1 &&
          dz >= 0 &&
          dz <= 1 &&
          y >= base + 2 &&
          y <= base + 3;
        set(cx + dx, y, cz + dz, gold ? B.gold_block : B.dark_sea_stone);
      }
  // фонари на потолке, мокрые губки по углам
  for (const [lx, lz] of [
    [5, 0],
    [-5, 0],
    [0, 5],
    [0, -5],
  ] as const)
    set(cx + lx, base + HEIGHT, cz + lz, B.sea_lantern);
  for (const [sx, sz] of [
    [-8, -8],
    [8, -8],
    [-8, 8],
    [8, 8],
  ] as const) {
    set(cx + sx, base + HEIGHT, cz + sz, B.wet_sponge);
    set(cx + sx + Math.sign(sx) * -1, base + HEIGHT, cz + sz, B.wet_sponge);
  }
  const residents: Resident[] = [
    { type: "elder_deepling", x: cx + 0.5, y: base + 8, z: cz + 0.5 },
    { type: "elder_deepling", x: cx - 7.5, y: base + 4, z: cz + 0.5 },
    { type: "elder_deepling", x: cx + 8.5, y: base + 4, z: cz + 0.5 },
  ];
  return {
    id: `temple:${rx},${rz}`,
    x: cx,
    y: base,
    z: cz,
    ops,
    residents,
    box,
  };
}
