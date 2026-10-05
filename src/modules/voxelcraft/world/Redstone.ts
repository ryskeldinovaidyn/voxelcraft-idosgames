// Красный камень, как в Minecraft (упрощённо): источники — рычаг, кнопка, нажимная плита, красный
// факел, блок красной пыли — питают соседей; провод несёт сигнал 15 и теряет 1 за блок; твёрдый
// блок с включённым рычагом или кнопкой на нём (или с горящим факелом под ним) «сильно заряжен» и
// питает своих соседей. Потребители — лампа, двери и люки, TNT; красный факел — инвертор.
// Поведения блоков — world/behaviours/redstone.ts.
import { BLOCKS, B } from "../registry/Blocks";
import { DIR6, FACING_DIRS } from "../registry/meta";
import { fillLevel } from "./Containers";
import type { ChunkManager } from "./ChunkManager";

/** Бит «включено» у рычага и кнопки. */
export const ON = 0x8;

const N6 = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
] as const;

let readers: Set<number> | null = null;

/**
 * Блок читает сигнал (провод, факел, лампа, TNT, двери и люки). Таких будят и через клетку от
 * изменения: рычаг на камне питает факел по ту сторону камня (systems/BlockUpdates).
 */
export function readsSignal(id: number): boolean {
  if (!readers) {
    readers = new Set<number>();
    for (const n of [
      "redstone_wire",
      "redstone_torch",
      "redstone_torch_off",
      "redstone_lamp",
      "redstone_lamp_on",
      "repeater",
      "repeater_on",
      "piston",
      "sticky_piston",
      "powered_rail",
      "activator_rail",
      "tnt",
      "note_block",
    ])
      if (B[n] !== undefined) readers.add(B[n]!);
    for (const d of BLOCKS)
      if (d.shape === "door" || d.shape === "trapdoor") readers.add(d.id);
  }
  return readers.has(id);
}

/** Клетка, к которой прикреплён рычаг/кнопка/факел (мета: 0 — пол, 1..4 — стена). */
export function attachedTo(
  x: number,
  y: number,
  z: number,
  meta: number,
): [number, number, number] {
  const m = meta & 7;
  if (m === 0) return [x, y - 1, z];
  const [dx, dz] = FACING_DIRS[(m - 1) & 3]!;
  return [x + dx, y, z + dz];
}

/** Сигнал, который блок в (x,y,z) отдаёт соседу (tx,ty,tz) сам, без провода. */
function directPower(
  w: ChunkManager,
  x: number,
  y: number,
  z: number,
  tx: number,
  ty: number,
  tz: number,
): number {
  const id = w.getBlock(x, y, z);
  if (id === 0) return 0;
  const meta = w.getMeta(x, y, z);
  if (id === B.redstone_block) return 15;
  if (id === B.sculk_sensor_on) return 15; // сенсор скалка, пока горит после вибрации
  if ((id === B.lever || id === B.stone_button) && meta & ON) return 15;
  if (id === B.stone_pressure_plate && meta > 0) return 15;
  if (id === B.target && meta > 0) return meta & 15; // мишень: сила по близости попадания к центру
  if (id === B.detector_rail && meta & 0x8) return 15; // на нажимных рельсах вагонетка
  if (id === B.repeater_on) {
    // повторитель питает только клетку перед собой
    const [dx, dz] = FACING_DIRS[meta & 3]!;
    return x + dx === tx && y === ty && z + dz === tz ? 15 : 0;
  }
  if (id === B.comparator) {
    // компаратор — своей силой, только вперёд
    const [dx, dz] = FACING_DIRS[meta & 3]!;
    return x + dx === tx && y === ty && z + dz === tz ? comparatorOut(meta) : 0;
  }
  if (id === B.observer && meta & OBSERVER_ON) {
    // наблюдатель — импульс с тыла (напротив лица)
    const [dx, dy, dz] = DIR6[meta & 7]!;
    return x - dx === tx && y - dy === ty && z - dz === tz ? 15 : 0;
  }
  if (id === B.redstone_torch) {
    const [ax, ay, az] = attachedTo(x, y, z, meta);
    return ax === tx && ay === ty && az === tz ? 0 : 15; // свой блок факел не питает
  }
  return 0;
}

/** Твёрдый блок сильно заряжен: на нём включённый рычаг/кнопка или под ним горит красный факел. */
function strongly(w: ChunkManager, x: number, y: number, z: number): boolean {
  if (!BLOCKS[w.getBlock(x, y, z)]?.solid) return false;
  for (const [dx, dy, dz] of N6) {
    const nx = x + dx,
      ny = y + dy,
      nz = z + dz;
    const id = w.getBlock(nx, ny, nz);
    if (
      (id === B.lever || id === B.stone_button) &&
      w.getMeta(nx, ny, nz) & ON
    ) {
      const [ax, ay, az] = attachedTo(nx, ny, nz, w.getMeta(nx, ny, nz));
      if (ax === x && ay === y && az === z) return true;
    }
    if (id === B.redstone_torch && dy === -1) return true; // факел снизу
    if (id === B.repeater_on || id === B.comparator) {
      // включённый повторитель или компаратор, смотрящий в этот блок
      const m = w.getMeta(nx, ny, nz);
      const [fx, fz] = FACING_DIRS[m & 3]!;
      if (
        (id === B.repeater_on || comparatorOut(m) > 0) &&
        nx + fx === x &&
        ny === y &&
        nz + fz === z
      )
        return true;
    }
    if (id === B.observer) {
      const m = w.getMeta(nx, ny, nz);
      const [fx, fy, fz] = DIR6[m & 7]!;
      if (m & OBSERVER_ON && nx - fx === x && ny - fy === y && nz - fz === z)
        return true;
    }
  }
  return false;
}

/** Компаратор: режим «вычитание» (иначе сравнение) и сила выхода в битах 3..6 меты. */
export const COMPARATOR_SUB = 0x4;
export const comparatorOut = (meta: number): number => (meta >> 3) & 15;
/** Наблюдатель: бит импульса (мета — направление лица DIR6). */
export const OBSERVER_ON = 0x8;

/** Сила сигнала 0..15, которую клетка s отдаёт в t: источник, провод, заряженный блок. */
function signalInto(
  w: ChunkManager,
  sx: number,
  sy: number,
  sz: number,
  tx: number,
  ty: number,
  tz: number,
): number {
  const d = directPower(w, sx, sy, sz, tx, ty, tz);
  if (d > 0) return d;
  const id = w.getBlock(sx, sy, sz);
  if (id === B.redstone_wire) return w.getMeta(sx, sy, sz);
  return BLOCKS[id]?.solid && isPowered(w, sx, sy, sz) ? 15 : 0;
}

/**
 * Тик компаратора (onTick — каждый симтик: заполненность сундука не будит соседей). Вход сзади —
 * сигнал или заполненность контейнера, сбоку — боковой сигнал. Сравнение: вход, если он не меньше
 * бокового, иначе 0; вычитание: вход − боковой.
 */
export function comparatorTick(
  w: ChunkManager,
  x: number,
  y: number,
  z: number,
  meta: number,
): void {
  const [dx, dz] = FACING_DIRS[meta & 3]!;
  const bx = x - dx,
    bz = z - dz;
  const box = w.containerAt?.(bx, y, bz);
  const input = box ? fillLevel(box) : signalInto(w, bx, y, bz, x, y, z);
  const side = Math.max(
    signalInto(w, x - dz, y, z + dx, x, y, z),
    signalInto(w, x + dz, y, z - dx, x, y, z),
  );
  const out =
    meta & COMPARATOR_SUB
      ? Math.max(0, input - side)
      : input >= side
        ? input
        : 0;
  if (out !== comparatorOut(meta))
    w.setBlock(x, y, z, B.comparator!, (meta & 7) | (out << 3));
}

/** Вход повторителя — только клетка позади него: источник, заряженный провод, заряженный блок. */
export function repeaterInput(
  w: ChunkManager,
  x: number,
  y: number,
  z: number,
  meta: number,
): boolean {
  const [dx, dz] = FACING_DIRS[meta & 3]!;
  const bx = x - dx,
    bz = z - dz;
  if (directPower(w, bx, y, bz, x, y, z) > 0) return true;
  const back = w.getBlock(bx, y, bz);
  if (back === B.redstone_wire) return w.getMeta(bx, y, bz) > 0;
  return !!BLOCKS[back]?.solid && isPowered(w, bx, y, bz);
}

/** Получает ли клетка сигнал: источник рядом, заряженный провод сбоку/сверху, сильно заряженный блок. */
export function isPowered(
  w: ChunkManager,
  x: number,
  y: number,
  z: number,
  except?: readonly [number, number, number],
): boolean {
  for (const [dx, dy, dz] of N6) {
    if (except && dx === except[0] && dy === except[1] && dz === except[2])
      continue; // лицо поршня
    const nx = x + dx,
      ny = y + dy,
      nz = z + dz;
    if (directPower(w, nx, ny, nz, x, y, z) > 0) return true;
    // провод питает блок, на котором лежит, и соседей сбоку — но не блок над собой
    if (
      w.getBlock(nx, ny, nz) === B.redstone_wire &&
      w.getMeta(nx, ny, nz) > 0 &&
      dy !== -1
    )
      return true;
    if (strongly(w, nx, ny, nz)) return true;
  }
  return false;
}

/** Соседи провода по сети: четыре стороны на своём уровне и ступеньки на блок выше и ниже. */
function wireLinks(
  x: number,
  y: number,
  z: number,
): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const [dx, dz] of FACING_DIRS)
    for (const dy of [0, 1, -1]) out.push([x + dx, y + dy, z + dz]);
  return out;
}

/**
 * Пересчитать сеть проводов, в которую входит (x,y,z) или её соседи: 15 у провода рядом с источником
 * (или сильно заряженным блоком), дальше −1 за блок. Мета провода — его сила.
 */
export function updateWires(
  w: ChunkManager,
  x: number,
  y: number,
  z: number,
): void {
  const key = (ax: number, ay: number, az: number) => ax + "," + ay + "," + az;
  const net = new Map<string, [number, number, number]>();
  const stack: [number, number, number][] = [];
  const add = (ax: number, ay: number, az: number) => {
    if (net.size > 2048 || w.getBlock(ax, ay, az) !== B.redstone_wire) return;
    const k = key(ax, ay, az);
    if (net.has(k)) return;
    net.set(k, [ax, ay, az]);
    stack.push([ax, ay, az]);
  };
  add(x, y, z);
  for (const [dx, dy, dz] of N6) add(x + dx, y + dy, z + dz);
  while (stack.length) {
    const [cx, cy, cz] = stack.pop()!;
    for (const [nx, ny, nz] of wireLinks(cx, cy, cz)) add(nx, ny, nz);
  }

  const power = new Map<string, number>();
  const queue: [number, number, number, number][] = [];
  // затравка: сила самого сильного источника рядом (компаратор даёт свою, остальные — 15)
  for (const [k, [cx, cy, cz]] of net) {
    let p = 0;
    for (const [dx, dy, dz] of N6) {
      const nx = cx + dx,
        ny = cy + dy,
        nz = cz + dz;
      p = Math.max(
        p,
        directPower(w, nx, ny, nz, cx, cy, cz),
        strongly(w, nx, ny, nz) ? 15 : 0,
      );
      if (p === 15) break;
    }
    if (p > 0) {
      power.set(k, p);
      queue.push([cx, cy, cz, p]);
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const [cx, cy, cz, p] = queue[i]!;
    if (p <= 1) continue;
    for (const [nx, ny, nz] of wireLinks(cx, cy, cz)) {
      const k = key(nx, ny, nz);
      if (!net.has(k) || (power.get(k) ?? 0) >= p - 1) continue;
      power.set(k, p - 1);
      queue.push([nx, ny, nz, p - 1]);
    }
  }
  for (const [k, [cx, cy, cz]] of net) {
    const p = power.get(k) ?? 0;
    if (w.getMeta(cx, cy, cz) !== p)
      w.setBlock(cx, cy, cz, B.redstone_wire!, p);
  }
}
