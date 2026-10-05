// Деревня (слой особенностей верхнего мира gen2): колодец в центре, четыре дороги, дома 5×5 с дверью
// к дороге, окнами, кроватью, факелом и рабочим местом профессии, огороды с водой и посевами.
// Как в Minecraft — на равнинах, в саванне, тайге и пустыне (там — песчаник). План деревни — чистая
// функция сида и координат: список записей блоков, разложенный по чанкам, накладывается поверх
// остальной генерации. Жителей и голема генератор не создаёт — их селит Game, когда игрок впервые
// подходит к деревне (список заселённых — в сейве).
import { B, packWater } from "../../registry/Blocks";
import {
  FACING_DIRS,
  TOP,
  facingOfVector,
  opposite,
} from "../../registry/meta";
import { CHUNK_SIZE, type Chunk } from "../../world/Chunk";

const { SX, SZ } = CHUNK_SIZE;

/** Сторона региона, в котором бывает не больше одной деревни (кратна 16: чанк — в одном регионе). */
export const VILLAGE_REGION = 320;
/** Центр деревни не ближе к краю региона — вся деревня внутри него. */
const MARGIN = 48;
/** Доля регионов с деревней. */
const CHANCE = 0.55;
const ROAD = 26;

export type VillageBiome = "plains" | "savanna" | "taiga" | "desert";

export interface Resident {
  type: string;
  x: number;
  y: number;
  z: number;
  /** Капитан мародёров со знаменем (застава). */
  captain?: boolean;
}

export interface Village {
  id: string;
  x: number;
  y: number;
  z: number;
  /** Записи блоков по чанкам: ключ "cx,cz" → [x, y, z, id, meta, …] (мировые координаты). */
  ops: Map<string, number[]>;
  residents: Resident[];
}

/** Что деревне нужно от генератора. */
export interface VillageTerrain {
  heightAt(x: number, z: number): number;
  biomeAt(x: number, z: number, h: number): string;
  readonly waterLevel: number;
}

/** Профессия дома → рабочее место (блоки без блочных сущностей: генератор их не создаёт). */
const WORKSTATION: Record<string, string> = {
  farmer: "hay_block",
  librarian: "bookshelf",
  armorer: "anvil",
  toolsmith: "smithing_table",
  cleric: "glowstone",
  butcher: "crafting_table",
  cartographer: "cartography_table",
};
const JOBS = Object.keys(WORKSTATION);

class Builder {
  readonly ops = new Map<string, number[]>();
  set(x: number, y: number, z: number, id: number | undefined, meta = 0): void {
    if (id === undefined || y < 1) return;
    const k = (x >> 4) + "," + (z >> 4);
    let a = this.ops.get(k);
    if (!a) this.ops.set(k, (a = []));
    a.push(x, y, z, id, meta);
  }
}

/** Деревня региона (rx, rz) или null: не выпало, не тот биом, вода, мало места. */
export function planVillage(
  t: VillageTerrain,
  seed: number,
  rx: number,
  rz: number,
  rng: () => number,
): Village | null {
  if (rng() > CHANCE) return null;
  const span = VILLAGE_REGION - 2 * MARGIN;
  const cx = rx * VILLAGE_REGION + MARGIN + Math.floor(rng() * span);
  const cz = rz * VILLAGE_REGION + MARGIN + Math.floor(rng() * span);
  const cy = t.heightAt(cx, cz);
  const biome = t.biomeAt(cx, cz, cy);
  if (
    biome !== "plains" &&
    biome !== "savanna" &&
    biome !== "taiga" &&
    biome !== "desert"
  )
    return null;
  if (cy <= t.waterLevel + 1) return null;
  const desert = biome === "desert";
  const wall = desert ? B.sandstone : B.planks;
  const corner = desert ? B.sandstone : B.oak_log;
  const floor = desert ? B.sandstone : B.cobblestone;
  const b = new Builder();
  const ground = (x: number, z: number) => t.heightAt(x, z);
  const dry = (y: number) => y > t.waterLevel;

  // колодец: кольцо булыжника, вода в середине, столбы и крыша-плита
  for (let dx = -2; dx <= 2; dx++)
    for (let dz = -2; dz <= 2; dz++)
      for (let y = cy + 1; y <= cy + 5; y++) b.set(cx + dx, y, cz + dz, B.air);
  const water = packWater(8, true);
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++) {
      const mid = dx === 0 && dz === 0;
      b.set(cx + dx, cy - 2, cz + dz, B.cobblestone);
      b.set(
        cx + dx,
        cy - 1,
        cz + dz,
        mid ? B.water : B.cobblestone,
        mid ? water : 0,
      );
      b.set(
        cx + dx,
        cy,
        cz + dz,
        mid ? B.water : B.cobblestone,
        mid ? water : 0,
      );
      if (!mid) b.set(cx + dx, cy + 1, cz + dz, B.cobblestone);
      if (Math.abs(dx) === 1 && Math.abs(dz) === 1)
        for (let y = cy + 2; y <= cy + 3; y++)
          b.set(cx + dx, y, cz + dz, B.oak_fence);
      b.set(cx + dx, cy + 4, cz + dz, B.cobblestone_slab);
    }

  // дороги от колодца
  for (let r = 0; r < 4; r++) {
    const [rdx, rdz] = FACING_DIRS[r]!;
    for (let s = 2; s <= ROAD; s++)
      for (let w = -1; w <= 1; w++) {
        const x = cx + rdx * s - rdz * w,
          z = cz + rdz * s + rdx * w;
        const y = ground(x, z);
        if (!dry(y)) continue;
        b.set(x, y, z, B.dirt_path);
        b.set(x, y + 1, z, B.air);
        b.set(x, y + 2, z, B.air);
      }
    // фонарь у конца дороги: столб стены с факелом
    const lx = cx + rdx * (ROAD - 2) - rdz * 2,
      lz = cz + rdz * (ROAD - 2) + rdx * 2;
    const ly = ground(lx, lz);
    if (dry(ly)) {
      b.set(lx, ly + 1, lz, B.cobblestone_wall);
      b.set(lx, ly + 2, lz, B.torch, 0);
    }
  }

  // участки: у каждой дороги по два с каждой стороны; дома смотрят дверью на дорогу
  const slots: { x: number; z: number; d: number; along: number }[] = [];
  for (let r = 0; r < 4; r++)
    for (const tAlong of [13, 22])
      for (const side of [-1, 1]) {
        const [rdx, rdz] = FACING_DIRS[r]!;
        const sx = -rdz * side,
          sz = rdx * side;
        slots.push({
          x: cx + rdx * tAlong + sx * 6,
          z: cz + rdz * tAlong + sz * 6,
          d: facingOfVector(-sx, -sz),
          along: r,
        });
      }
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [slots[i], slots[j]] = [slots[j]!, slots[i]!];
  }

  const residents: Resident[] = [];
  let farms = 0;
  const wantFarms = 1 + Math.floor(rng() * 2);
  const wantHouses = 4 + Math.floor(rng() * 4);
  for (const s of slots) {
    if (residents.length >= wantHouses && farms >= wantFarms) break;
    const hs: number[] = [];
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++) hs.push(ground(s.x + dx, s.z + dz));
    const lo = Math.min(...hs),
      hi = Math.max(...hs);
    if (!dry(lo) || hi - lo > 4) continue;
    const F = ground(s.x, s.z);
    if (farms < wantFarms && (residents.length >= 2 || rng() < 0.3)) {
      farm(b, s.x, s.z, F, s.along, rng);
      farms++;
      continue;
    }
    if (residents.length >= wantHouses) continue;
    const job =
      JOBS[residents.length === 0 ? 0 : Math.floor(rng() * JOBS.length)]!;
    residents.push(
      house(b, s.x, s.z, F, s.d, job, { wall, corner, floor, desert }, ground),
    );
  }
  if (residents.length < 3) return null;
  residents.push({ type: "iron_golem", x: cx + 3.5, y: cy + 1, z: cz + 0.5 });
  // бродячая кошка у колодца (в Minecraft кошки живут в деревнях)
  residents.push({ type: "cat", x: cx - 2.5, y: cy + 1, z: cz + 0.5 });
  return { id: `${rx},${rz}`, x: cx, y: cy, z: cz, ops: b.ops, residents };
}

interface Style {
  wall: number | undefined;
  corner: number | undefined;
  floor: number | undefined;
  desert: boolean;
}

/** Дом 5×5 с центром (hx, hz), пол на высоте F, дверь в сторону d; житель — в середине. */
function house(
  b: Builder,
  hx: number,
  hz: number,
  F: number,
  d: number,
  job: string,
  st: Style,
  ground: (x: number, z: number) => number,
): Resident {
  const [fx, fz] = FACING_DIRS[d]!;
  const sx = -fz,
    sz = fx;
  const at = (a: number, c: number): [number, number] => [
    hx + fx * a + sx * c,
    hz + fz * a + sz * c,
  ];
  // расчистка и фундамент
  for (let a = -3; a <= 3; a++)
    for (let c = -3; c <= 3; c++) {
      const [x, z] = at(a, c);
      for (let y = F + 1; y <= F + 7; y++) b.set(x, y, z, B.air);
      if (Math.abs(a) <= 2 && Math.abs(c) <= 2)
        for (let y = ground(x, z) + 1; y < F; y++)
          b.set(x, y, z, B.cobblestone);
    }
  for (let a = -2; a <= 2; a++)
    for (let c = -2; c <= 2; c++) {
      const [x, z] = at(a, c);
      b.set(x, F, z, st.floor);
      const edgeA = Math.abs(a) === 2,
        edgeC = Math.abs(c) === 2;
      if (!edgeA && !edgeC) continue;
      for (let y = F + 1; y <= F + 3; y++) {
        const isCorner = edgeA && edgeC;
        const windowCell =
          y === F + 2 && (a === 0 || c === 0) && !(a === 2 && c === 0);
        b.set(
          x,
          y,
          z,
          isCorner ? st.corner : windowCell ? B.glass_pane : st.wall,
        );
      }
    }
  // крыша: у деревянного дома — плиты с навесом, у пустынного — плоская из песчаника
  for (let a = -3; a <= 3; a++)
    for (let c = -3; c <= 3; c++) {
      const [x, z] = at(a, c);
      if (st.desert) {
        if (Math.abs(a) <= 2 && Math.abs(c) <= 2) b.set(x, F + 4, z, st.wall);
      } else b.set(x, F + 4, z, B.oak_slab);
    }
  // дверь к дороге и дорожка до неё
  const [dx0, dz0] = at(2, 0);
  b.set(dx0, F + 1, dz0, B.oak_door, d);
  b.set(dx0, F + 2, dz0, B.oak_door, d | TOP);
  for (let a = 3; a <= 5; a++) {
    const [x, z] = at(a, 0);
    const y = ground(x, z);
    b.set(x, y, z, B.dirt_path);
    b.set(x, y + 1, z, B.air);
  }
  // кровать у задней стены (изголовье к стене), рабочее место, факел
  const back = opposite(d);
  const [bfX, bfZ] = at(0, -1);
  const [bhX, bhZ] = at(-1, -1);
  b.set(bfX, F + 1, bfZ, B.red_bed, back);
  b.set(bhX, F + 1, bhZ, B.red_bed, back | TOP);
  const [wx, wz] = at(-1, 1);
  b.set(wx, F + 1, wz, B[WORKSTATION[job]!]);
  const [tx, tz] = at(-1, 0);
  b.set(tx, F + 2, tz, B.torch, back + 1);
  const [rx, rz] = at(0, 0);
  return { type: "villager_" + job, x: rx + 0.5, y: F + 1, z: rz + 0.5 };
}

/** Огород 9×5 вдоль дороги: вода по оси, пашня с посевами по сторонам, бревенчатая кайма. */
function farm(
  b: Builder,
  fx: number,
  fz: number,
  F: number,
  along: number,
  rng: () => number,
): void {
  const [rdx, rdz] = FACING_DIRS[along]!;
  const crops = [B.wheat, B.carrots, B.potatoes, B.beetroots].filter(
    (c) => c !== undefined,
  );
  const crop = crops[Math.floor(rng() * crops.length)];
  const water = packWater(8, true);
  for (let a = -5; a <= 5; a++)
    for (let c = -3; c <= 3; c++) {
      const x = fx + rdx * a - rdz * c,
        z = fz + rdz * a + rdx * c;
      b.set(x, F - 1, z, B.dirt);
      b.set(x, F + 1, z, B.air);
      b.set(x, F + 2, z, B.air);
      if (Math.abs(a) === 5 || Math.abs(c) === 3) b.set(x, F, z, B.oak_log);
      else if (c === 0) b.set(x, F, z, B.water, water);
      else {
        b.set(x, F, z, B.farmland, 7);
        b.set(x, F + 1, z, crop, Math.floor(rng() * 8));
      }
    }
}

/** Наложить записи деревень на чанк. */
export function carveVillages(
  chunk: Chunk,
  villages: readonly Village[],
): void {
  const k = chunk.cx + "," + chunk.cz;
  const wx0 = chunk.cx * SX,
    wz0 = chunk.cz * SZ;
  for (const v of villages) {
    const a = v.ops.get(k);
    if (!a) continue;
    for (let i = 0; i < a.length; i += 5)
      chunk.setRaw(
        a[i]! - wx0,
        a[i + 1]!,
        a[i + 2]! - wz0,
        a[i + 3]!,
        a[i + 4]!,
      );
  }
}
