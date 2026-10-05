// Строители построек рецепта мира. Каждый пишет блоки через StampTarget в «штамп» — разреженную
// карту поверх рельефа, которую SpecGenerator накладывает на чанки при их генерации. Постройка
// поэтому может пересекать границы чанков, а генерация чанков остаётся независимой.
//
// Постройки стоят на рельефе: groundAt() — высота земли (без других построек). Под полом —
// фундамент до земли, над полом — расчистка (деревья и бугры не прорастают сквозь дом).
import { B, packWater } from "../registry/Blocks";
import { LEGACY_SY } from "../world/Chunk";
import type {
  StructureSize,
  TreeType,
  WorldPalette,
  WorldStructure,
} from "./WorldSpec";
import { plantTree } from "./trees";
import type { RasterModel } from "./voxelModel";

/** Постройки рецепта — в прежней высоте мира: их штампы часть вывода SpecGenerator. */
const SY = LEGACY_SY;

export interface StampTarget {
  /** y верхнего блока земли в мировых координатах (рельеф рецепта, без построек). */
  groundAt(wx: number, wz: number): number;
  /** Блок поверхности рельефа в этой точке — чтобы перекрыть срезанный под постройку бугор. */
  surfaceAt(wx: number, wz: number): number;
  readonly waterLevel: number;
  /** Порода деревьев в этой точке (зона рецепта). */
  treeTypeAt(wx: number, wz: number): TreeType;
  /** Жёсткая запись: перекрывает рельеф и более ранние постройки. */
  put(wx: number, wy: number, wz: number, id: number, meta?: number): void;
  /** Мягкая (листва): только туда, где в итоге окажется воздух. */
  putSoft(wx: number, wy: number, wz: number, id: number): void;
}

export interface ResolvedPalette {
  wall: number;
  roof: number;
  floor: number;
  path: number;
  accent: number;
}

export function resolvePalette(p: WorldPalette): ResolvedPalette {
  const id = (name: string, def: string): number => B[name] ?? B[def]!;
  return {
    wall: id(p.wall, "planks"),
    roof: id(p.roof, "dark_planks"),
    floor: id(p.floor, "planks"),
    path: id(p.path, "dirt_path"),
    accent: id(p.accent, "stone_bricks"),
  };
}

const SIZE_INDEX: Record<StructureSize, 0 | 1 | 2> = {
  small: 0,
  medium: 1,
  large: 2,
};
const bySize = <T>(size: StructureSize, values: readonly [T, T, T]): T =>
  values[SIZE_INDEX[size]];

/** Сторона двери по повороту: 0 → -z, 90 → +x, 180 → +z, 270 → -x. */
function doorDir(rotation: number): [number, number] {
  switch (rotation) {
    case 90:
      return [1, 0];
    case 180:
      return [0, 1];
    case 270:
      return [-1, 0];
    default:
      return [0, -1];
  }
}

/** Поворот, при котором дверь смотрит в сторону (dx, dz). */
function rotationFacing(dx: number, dz: number): 0 | 90 | 180 | 270 {
  if (Math.abs(dz) >= Math.abs(dx)) return dz < 0 ? 0 : 180;
  return dx > 0 ? 90 : 270;
}

class Builder {
  constructor(
    readonly t: StampTarget,
    readonly pal: ResolvedPalette,
    readonly rng: () => number,
  ) {}

  put(x: number, y: number, z: number, id: number, meta = 0): void {
    if (y < 1 || y >= SY) return;
    this.t.put(x, y, z, id, meta);
  }

  box(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    id: number,
  ): void {
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) this.put(x, y, z, id);
  }

  /** Воздух над площадкой: убрать деревья, бугры и склон, в который врезается постройка. */
  clear(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    fromY: number,
    toY: number,
  ): void {
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) {
        const g = this.t.groundAt(x, z);
        const top = Math.max(toY, g + 1);
        for (let y = fromY; y <= Math.min(top, SY - 1); y++)
          this.put(x, y, z, B.air!);
        // Срезали бугор — на новой поверхности та же порода, что вокруг, а не голая земля из-под дёрна.
        if (g >= fromY && fromY > 1)
          this.put(x, fromY - 1, z, this.t.surfaceAt(x, z));
      }
  }

  /** Пол на floorY и фундамент от земли до пола — постройка не висит над склоном. */
  foundation(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    floorY: number,
    floorId: number,
  ): void {
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) {
        const g = this.t.groundAt(x, z);
        for (let y = Math.min(g + 1, floorY); y < floorY; y++)
          this.put(x, y, z, this.pal.accent);
        this.put(x, floorY, z, floorId);
      }
  }

  /** Отрезок по земле: колбэк на каждой колонне полосы шириной width. */
  line(
    ax: number,
    az: number,
    bx: number,
    bz: number,
    width: number,
    fn: (x: number, z: number, step: number, offset: number) => void,
  ): void {
    const dx = bx - ax,
      dz = bz - az;
    const steps = Math.max(1, Math.round(Math.max(Math.abs(dx), Math.abs(dz))));
    // поперечное смещение — по второстепенной оси отрезка
    const alongX = Math.abs(dx) >= Math.abs(dz);
    const lo = -Math.floor((width - 1) / 2),
      hi = lo + width - 1;
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(ax + (dx * i) / steps),
        z = Math.round(az + (dz * i) / steps);
      for (let o = lo; o <= hi; o++)
        fn(alongX ? x : x + o, alongX ? z + o : z, i, o);
    }
  }
}

// ---- постройки ------------------------------------------------------------------

function house(
  b: Builder,
  cx: number,
  cz: number,
  size: StructureSize,
  rot: number,
  wall: number,
  roof: number,
): void {
  const [w0, d0] = bySize(size, [
    [7, 6],
    [9, 7],
    [11, 9],
  ] as const);
  const [w, d] = rot % 180 ? [d0, w0] : [w0, d0];
  const x0 = cx - (w >> 1),
    z0 = cz - (d >> 1),
    x1 = x0 + w - 1,
    z1 = z0 + d - 1;
  const floorY = Math.max(b.t.groundAt(cx, cz), b.t.waterLevel);
  const wallH = bySize(size, [3, 4, 4] as const);
  const roofLayers = Math.ceil(Math.min(w, d) / 2) + 1;

  b.clear(
    x0 - 1,
    z0 - 1,
    x1 + 1,
    z1 + 1,
    floorY + 1,
    floorY + wallH + roofLayers + 1,
  );
  b.foundation(x0, z0, x1, z1, floorY, b.pal.floor);

  // стены: брёвна по углам, окна через блок на уровне глаз
  for (let y = floorY + 1; y <= floorY + wallH; y++)
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) {
        const edgeX = x === x0 || x === x1,
          edgeZ = z === z0 || z === z1;
        if (!edgeX && !edgeZ) continue;
        const corner = edgeX && edgeZ;
        const along = edgeZ ? x - x0 : z - z0;
        const window = !corner && y === floorY + 2 && along % 3 === 1;
        b.put(x, y, z, corner ? B.oak_log! : window ? B.glass! : wall);
      }

  // дверь посередине стены со стороны поворота
  const [ddx, ddz] = doorDir(rot);
  const doorX = ddx === 0 ? cx : ddx > 0 ? x1 : x0;
  const doorZ = ddz === 0 ? cz : ddz > 0 ? z1 : z0;
  b.put(doorX, floorY + 1, doorZ, B.air!);
  b.put(doorX, floorY + 2, doorZ, B.air!);

  // ступенчатая крыша с выносом в блок
  for (let k = 0; k < roofLayers; k++) {
    const xs = x0 - 1 + k,
      xe = x1 + 1 - k,
      zs = z0 - 1 + k,
      ze = z1 + 1 - k;
    if (xs > xe || zs > ze) break;
    b.box(xs, floorY + wallH + 1 + k, zs, xe, floorY + wallH + 1 + k, ze, roof);
  }
  // верстак в дальнем углу
  b.put(
    ddx > 0 ? x0 + 1 : x1 - 1,
    floorY + 1,
    ddz > 0 ? z0 + 1 : z1 - 1,
    B.crafting_table!,
  );
}

function tower(
  b: Builder,
  cx: number,
  cz: number,
  r: number,
  height: number,
  wall: number,
): void {
  const g = Math.max(b.t.groundAt(cx, cz), b.t.waterLevel);
  const top = Math.min(SY - 3, g + height);
  const inDisc = (dx: number, dz: number, rr: number) =>
    dx * dx + dz * dz <= (rr + 0.5) * (rr + 0.5);

  b.clear(cx - r - 1, cz - r - 1, cx + r + 1, cz + r + 1, g + 1, top + 2);
  for (let dz = -r; dz <= r; dz++)
    for (let dx = -r; dx <= r; dx++) {
      if (!inDisc(dx, dz, r)) continue;
      const x = cx + dx,
        z = cz + dz;
      const ring = !inDisc(dx, dz, r - 1);
      const gc = b.t.groundAt(x, z);
      for (let y = Math.min(gc + 1, g); y <= g; y++) b.put(x, y, z, wall);
      for (let y = g + 1; y <= top; y++) {
        if (ring) {
          const window = (y - g) % 5 === 3 && (dx === 0 || dz === 0);
          b.put(x, y, z, window ? B.glass! : wall);
        } else if ((y - g) % 5 === 0) b.put(x, y, z, b.pal.floor);
      }
      if (ring && (dx + dz) % 2 === 0) b.put(x, top + 1, z, wall); // зубцы
      if (!ring) b.put(x, top, z, b.pal.floor);
    }
  // вход
  b.put(cx, g + 1, cz - r, B.air!);
  b.put(cx, g + 2, cz - r, B.air!);
}

function castle(
  b: Builder,
  cx: number,
  cz: number,
  size: StructureSize,
  rot: number,
  wall: number,
): void {
  const L = bySize(size, [21, 29, 37] as const);
  const half = L >> 1;
  const wallH = bySize(size, [5, 6, 7] as const);
  const g = Math.max(b.t.groundAt(cx, cz), b.t.waterLevel);
  const x0 = cx - half,
    x1 = cx + half,
    z0 = cz - half,
    z1 = cz + half;

  b.clear(x0, z0, x1, z1, g + 1, g + wallH + 10); // двор без деревьев
  // стены по периметру идут по рельефу
  for (let z = z0; z <= z1; z++)
    for (let x = x0; x <= x1; x++) {
      if (x !== x0 && x !== x1 && z !== z0 && z !== z1) continue;
      const gb = b.t.groundAt(x, z);
      const topY = Math.max(g + wallH, gb + 2);
      for (let y = gb + 1; y <= topY; y++) b.put(x, y, z, wall);
      if ((x + z) % 2 === 0) b.put(x, topY + 1, z, wall);
    }
  // ворота со стороны поворота
  const [ddx, ddz] = doorDir(rot);
  for (let o = -1; o <= 1; o++) {
    const gx = ddx === 0 ? cx + o : ddx > 0 ? x1 : x0;
    const gz = ddz === 0 ? cz + o : ddz > 0 ? z1 : z0;
    const gb = b.t.groundAt(gx, gz);
    for (let y = gb + 1; y <= gb + 4; y++) b.put(gx, y, gz, B.air!);
  }
  // угловые башни
  for (const [tx, tz] of [
    [x0, z0],
    [x1, z0],
    [x0, z1],
    [x1, z1],
  ] as const)
    tower(b, tx, tz, 3, wallH + 5, wall);
  // донжон
  const k = bySize(size, [3, 4, 5] as const);
  b.foundation(cx - k, cz - k, cx + k, cz + k, g, b.pal.floor);
  const keepTop = g + wallH + 4;
  for (let y = g + 1; y <= keepTop; y++)
    for (let z = cz - k; z <= cz + k; z++)
      for (let x = cx - k; x <= cx + k; x++) {
        const edge =
          x === cx - k || x === cx + k || z === cz - k || z === cz + k;
        if (!edge) continue;
        const window = (y - g) % 4 === 2 && (x === cx || z === cz);
        b.put(x, y, z, window ? B.glass! : wall);
      }
  b.box(cx - k, keepTop + 1, cz - k, cx + k, keepTop + 1, cz + k, b.pal.floor);
  for (let z = cz - k; z <= cz + k; z++)
    for (let x = cx - k; x <= cx + k; x++)
      if (
        (x === cx - k || x === cx + k || z === cz - k || z === cz + k) &&
        (x + z) % 2 === 0
      )
        b.put(x, keepTop + 2, z, wall);
  // вход в донжон — к воротам
  const kx = ddx === 0 ? cx : cx + ddx * k,
    kz = ddz === 0 ? cz : cz + ddz * k;
  b.put(kx, g + 1, kz, B.air!);
  b.put(kx, g + 2, kz, B.air!);
}

function road(
  b: Builder,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  width: number,
): void {
  b.line(ax, az, bx, bz, width, (x, z) => {
    const g = b.t.groundAt(x, z);
    if (g < b.t.waterLevel) {
      // дорога через воду становится настилом
      b.put(x, b.t.waterLevel, z, b.pal.floor);
      for (let y = b.t.waterLevel + 1; y <= b.t.waterLevel + 3; y++)
        b.put(x, y, z, B.air!);
      return;
    }
    b.put(x, g, z, b.pal.path);
    for (let y = g + 1; y <= g + 4; y++) b.put(x, y, z, B.air!);
  });
}

function bridge(
  b: Builder,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): void {
  const deckY = Math.max(
    b.t.waterLevel + 2,
    Math.min(b.t.groundAt(ax, az), b.t.groundAt(bx, bz)) + 1,
  );
  b.line(ax, az, bx, bz, 5, (x, z, step, o) => {
    for (let y = deckY + 1; y <= deckY + 4; y++) b.put(x, y, z, B.air!);
    if (Math.abs(o) <= 1) {
      b.put(x, deckY, z, b.pal.floor);
      // опоры каждые 6 шагов
      if (o !== 0 && step % 6 === 0)
        for (let y = b.t.groundAt(x, z) + 1; y < deckY; y++)
          b.put(x, y, z, B.oak_log!);
    } else {
      b.put(x, deckY, z, b.pal.floor);
      b.put(x, deckY + 1, z, step % 4 === 0 ? B.oak_log! : B.dark_planks!); // перила
    }
  });
}

function wallLine(
  b: Builder,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  size: StructureSize,
  wall: number,
): void {
  const thick = bySize(size, [1, 2, 2] as const);
  const height = bySize(size, [3, 4, 6] as const);
  b.line(ax, az, bx, bz, thick, (x, z, step) => {
    const g = b.t.groundAt(x, z);
    for (let y = g + 1; y <= g + height; y++) b.put(x, y, z, wall);
    if (step % 2 === 0) b.put(x, g + height + 1, z, wall);
  });
}

function ruins(b: Builder, cx: number, cz: number, size: StructureSize): void {
  const side = bySize(size, [9, 13, 17] as const);
  const half = side >> 1;
  const maxH = bySize(size, [3, 4, 6] as const);
  const stone = () => (b.rng() < 0.4 ? B.mossy_cobblestone! : B.cobblestone!);
  for (let z = cz - half; z <= cz + half; z++)
    for (let x = cx - half; x <= cx + half; x++) {
      const edge =
        x === cx - half ||
        x === cx + half ||
        z === cz - half ||
        z === cz + half;
      const pillar = (x - cx) % 4 === 0 && (z - cz) % 4 === 0;
      const g = b.t.groundAt(x, z);
      if (edge || pillar) {
        if (b.rng() < 0.25) continue; // обвалившийся кусок
        const h = 1 + ((b.rng() * maxH) | 0);
        for (let y = g + 1; y <= g + h; y++) b.put(x, y, z, stone());
      } else if (b.rng() < 0.05)
        b.put(x, g + 1, z, stone()); // обломки
      else b.put(x, g, z, b.rng() < 0.5 ? B.gravel! : stone()); // старый пол
    }
}

function pond(b: Builder, cx: number, cz: number, size: StructureSize): void {
  const R = bySize(size, [3, 5, 8] as const);
  const stretch = 0.75 + b.rng() * 0.5;
  const rx = R * stretch,
    rz = R / stretch;
  // уровень воды — по самой низкой точке берега, иначе вода «висела» бы над склоном
  let surface = b.t.groundAt(cx, cz);
  for (let a = 0; a < 16; a++) {
    const ang = (a / 16) * Math.PI * 2;
    surface = Math.min(
      surface,
      b.t.groundAt(
        Math.round(cx + Math.cos(ang) * (rx + 1)),
        Math.round(cz + Math.sin(ang) * (rz + 1)),
      ),
    );
  }
  const maxDepth = bySize(size, [2, 3, 4] as const);
  for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const d = Math.hypot((x - cx) / rx, (z - cz) / rz);
      if (d > 1) continue;
      const depth = 1 + Math.round((1 - d) * (maxDepth - 1));
      const floorY = surface - depth;
      const g = b.t.groundAt(x, z);
      b.put(x, floorY, z, d > 0.7 ? B.sand! : B.clay!);
      for (let y = floorY + 1; y <= surface; y++)
        b.put(x, y, z, B.water!, packWater(8, true));
      for (let y = surface + 1; y <= Math.max(g, surface) + 6; y++)
        b.put(x, y, z, B.air!);
    }
}

function rock(b: Builder, cx: number, cz: number, size: StructureSize): void {
  const R = bySize(size, [2, 3, 5] as const);
  const g = b.t.groundAt(cx, cz);
  for (let dy = -1; dy <= R; dy++)
    for (let dz = -R; dz <= R; dz++)
      for (let dx = -R; dx <= R; dx++) {
        const d = Math.hypot(dx / R, dy / (R * 0.8), dz / R);
        if (d > 1 - b.rng() * 0.15) continue;
        const r = b.rng();
        b.put(
          cx + dx,
          g + dy,
          cz + dz,
          r < 0.55
            ? B.stone!
            : r < 0.85
              ? B.cobblestone!
              : B.mossy_cobblestone!,
        );
      }
}

function treeCluster(
  b: Builder,
  cx: number,
  cz: number,
  size: StructureSize,
): void {
  const n = bySize(size, [5, 9, 15] as const);
  const radius = bySize(size, [5, 8, 12] as const);
  for (let i = 0; i < n; i++) {
    const ang = b.rng() * Math.PI * 2,
      r = Math.sqrt(b.rng()) * radius;
    const x = Math.round(cx + Math.cos(ang) * r),
      z = Math.round(cz + Math.sin(ang) * r);
    const g = b.t.groundAt(x, z);
    if (g <= b.t.waterLevel || g + 12 >= SY) continue;
    const zoneType = b.t.treeTypeAt(x, z);
    const type: TreeType = zoneType === "none" ? "oak" : zoneType;
    plantTree(type, x, g, z, b.rng, (tx, ty, tz, id, soft) => {
      if (ty < 1 || ty >= SY) return;
      if (soft) b.t.putSoft(tx, ty, tz, id);
      else b.t.put(tx, ty, tz, id);
    });
  }
}

function pyramid(
  b: Builder,
  cx: number,
  cz: number,
  size: StructureSize,
  rot: number,
  stone: number,
): void {
  const side = bySize(size, [11, 17, 25] as const);
  const half = side >> 1;
  const g = b.t.groundAt(cx, cz);
  b.clear(cx - half, cz - half, cx + half, cz + half, g + 1, g + half + 2);
  b.foundation(cx - half, cz - half, cx + half, cz + half, g, stone);
  for (let k = 0; k <= half; k++) {
    const y = g + 1 + k;
    if (y >= SY) break;
    b.box(
      cx - half + k,
      y,
      cz - half + k,
      cx + half - k,
      y,
      cz + half - k,
      stone,
    );
  }
  // вход и камера внутри
  const [ddx, ddz] = doorDir(rot);
  for (let s = 0; s <= half; s++) {
    const x = cx + ddx * (half - s),
      z = cz + ddz * (half - s);
    b.put(x, g + 1, z, B.air!);
    b.put(x, g + 2, z, B.air!);
  }
  b.box(cx - 1, g + 1, cz - 1, cx + 1, g + 3, cz + 1, B.air!);
}

function well(b: Builder, cx: number, cz: number): void {
  const g = b.t.groundAt(cx, cz);
  b.clear(cx - 2, cz - 2, cx + 2, cz + 2, g + 1, g + 5);
  for (let dz = -2; dz <= 2; dz++)
    for (let dx = -2; dx <= 2; dx++) {
      const x = cx + dx,
        z = cz + dz;
      const inner = Math.abs(dx) <= 1 && Math.abs(dz) <= 1;
      if (inner) {
        b.put(x, g - 2, z, B.cobblestone!);
        b.put(x, g - 1, z, B.water!, packWater(8, true));
        b.put(x, g, z, B.water!, packWater(8, true));
      } else {
        b.put(x, g, z, B.cobblestone!);
        b.put(x, g + 1, z, B.cobblestone!);
      }
      if (Math.abs(dx) === 2 && Math.abs(dz) === 2) {
        b.put(x, g + 2, z, B.oak_log!);
        b.put(x, g + 3, z, B.oak_log!);
      }
      b.put(x, g + 4, z, b.pal.roof);
    }
}

function farm(
  b: Builder,
  cx: number,
  cz: number,
  size: StructureSize,
  rot: number,
): void {
  const [w0, d0] = bySize(size, [
    [7, 7],
    [9, 9],
    [13, 9],
  ] as const);
  const [w, d] = rot % 180 ? [d0, w0] : [w0, d0];
  const x0 = cx - (w >> 1),
    z0 = cz - (d >> 1),
    x1 = x0 + w - 1,
    z1 = z0 + d - 1;
  const g = Math.max(b.t.groundAt(cx, cz), b.t.waterLevel + 1);
  b.clear(x0, z0, x1, z1, g + 1, g + 4);
  const [ddx, ddz] = doorDir(rot);
  for (let z = z0; z <= z1; z++)
    for (let x = x0; x <= x1; x++) {
      const gc = b.t.groundAt(x, z);
      for (let y = Math.min(gc + 1, g); y < g; y++) b.put(x, y, z, B.dirt!);
      const edge = x === x0 || x === x1 || z === z0 || z === z1;
      if (edge) {
        b.put(x, g, z, B.dirt!);
        const gate =
          (ddx === 0 && x === cx && z === (ddz > 0 ? z1 : z0)) ||
          (ddz === 0 && z === cz && x === (ddx > 0 ? x1 : x0));
        if (!gate) b.put(x, g + 1, z, B.oak_log!);
        continue;
      }
      const row = (rot % 180 ? x - x0 : z - z0) % 4;
      if (row === 2) b.put(x, g, z, B.water!, packWater(8, true));
      else {
        b.put(x, g, z, B.dirt!);
        b.put(x, g + 1, z, B.tallgrass!); // «посевы»
      }
    }
}

function village(
  b: Builder,
  cx: number,
  cz: number,
  size: StructureSize,
  wall: number,
  roof: number,
): void {
  const n = bySize(size, [3, 5, 7] as const);
  const R = bySize(size, [11, 15, 19] as const);
  const spots: [number, number][] = [];
  const turn = b.rng() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const ang = turn + (i / n) * Math.PI * 2 + (b.rng() - 0.5) * 0.4;
    spots.push([
      Math.round(cx + Math.cos(ang) * R),
      Math.round(cz + Math.sin(ang) * R),
    ]);
  }
  // сначала тропы от колодца к домам, потом дома — дом перекрывает конец тропы
  for (const [hx, hz] of spots) road(b, cx, cz, hx, hz, 2);
  well(b, cx, cz);
  spots.forEach(([hx, hz], i) => {
    const small: StructureSize =
      i % 3 === 2 && size !== "small" ? "medium" : "small";
    house(b, hx, hz, small, rotationFacing(cx - hx, cz - hz), wall, roof);
  });
  if (size === "large") {
    const ang = turn + Math.PI / n;
    farm(
      b,
      Math.round(cx + Math.cos(ang) * (R + 6)),
      Math.round(cz + Math.sin(ang) * (R + 6)),
      "medium",
      0,
    );
  }
}

/**
 * Построить одну постройку. (cx, cz) и (ex, ez) — уже в мировых блоках.
 * rng — свой на каждую постройку: порядок построек не влияет на вид каждой.
 */
export function buildStructure(
  s: WorldStructure,
  cx: number,
  cz: number,
  ex: number,
  ez: number,
  pal: ResolvedPalette,
  target: StampTarget,
  rng: () => number,
  models: Readonly<Record<string, RasterModel>> = {},
  /** type "river": точки пути, уже в мировых блоках. */
  path: readonly [number, number][] = [],
): void {
  const b = new Builder(target, pal, rng);
  const wall = s.material ? (B[s.material] ?? pal.wall) : pal.wall;
  const roof = s.roof ? (B[s.roof] ?? pal.roof) : pal.roof;
  const stoneWall = s.material ? wall : pal.accent;
  switch (s.type) {
    case "house":
      return house(b, cx, cz, s.size, s.rotation, wall, roof);
    case "tower":
      return tower(
        b,
        cx,
        cz,
        bySize(s.size, [2, 3, 4] as const),
        bySize(s.size, [10, 14, 18] as const),
        stoneWall,
      );
    case "castle":
      return castle(b, cx, cz, s.size, s.rotation, stoneWall);
    case "village":
      return village(b, cx, cz, s.size, wall, roof);
    case "wall":
      return wallLine(b, cx, cz, ex, ez, s.size, stoneWall);
    case "road":
      return road(b, cx, cz, ex, ez, bySize(s.size, [2, 3, 4] as const));
    case "bridge":
      return bridge(b, cx, cz, ex, ez);
    case "ruins":
      return ruins(b, cx, cz, s.size);
    case "pond":
      return pond(b, cx, cz, s.size);
    case "rock":
      return rock(b, cx, cz, s.size);
    case "tree_cluster":
      return treeCluster(b, cx, cz, s.size);
    case "pyramid":
      return pyramid(
        b,
        cx,
        cz,
        s.size,
        s.rotation,
        s.material ? wall : B.sandstone!,
      );
    case "well":
      return well(b, cx, cz);
    case "farm":
      return farm(b, cx, cz, s.size, s.rotation);
    case "model": {
      const m = s.model ? models[s.model] : undefined;
      if (m) placeModel(b, cx, cz, s.rotation, s.elevation ?? 0, m);
      return;
    }
    case "river":
      return river(b, path, s.size);
  }
}

/**
 * Река по ломаной от истока к устью. Уровень воды вдоль русла только опускается (вода не течёт в
 * гору): где земля выше — русло прорезается, у моря река вливается в него. Где берег ниже воды,
 * насыпается бережок — иначе вода висела бы в воздухе.
 */
function river(
  b: Builder,
  pts: readonly [number, number][],
  size: StructureSize,
): void {
  if (pts.length < 2) return;
  const R = bySize(size, [1.6, 2.6, 4] as const);
  const maxDepth = bySize(size, [2, 2, 3] as const);
  const samples: [number, number][] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i]!,
      [bx, bz] = pts[i + 1]!;
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az)));
    for (let k = 0; k < n; k++)
      samples.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  samples.push(pts[pts.length - 1]!);

  const sea = b.t.waterLevel;
  const wet = new Set<string>();
  let level = Infinity;
  const r = Math.ceil(R) + 1;
  for (const [sx, sz] of samples) {
    const cx = Math.round(sx),
      cz = Math.round(sz);
    level = Math.max(sea, Math.min(level, b.t.groundAt(cx, cz) - 1));
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++) {
        const d = Math.hypot(dx, dz);
        const x = cx + dx,
          z = cz + dz;
        const g = b.t.groundAt(x, z);
        if (d <= R) {
          const depth = 1 + Math.round((1 - d / R) * (maxDepth - 1));
          const bed = level - depth;
          b.put(x, bed, z, d < R * 0.5 ? B.gravel! : B.sand!);
          for (let y = bed + 1; y <= level; y++)
            b.put(x, y, z, B.water!, packWater(8, true));
          for (let y = level + 1; y <= Math.max(g, level) + 3; y++)
            b.put(x, y, z, B.air!);
          wet.add(x + "," + z);
        } else if (d <= R + 1.5 && g < level && !wet.has(x + "," + z)) {
          for (let y = g + 1; y < level; y++) b.put(x, y, z, B.dirt!);
          b.put(x, level, z, B.grass!);
        }
      }
  }
}

/**
 * Поставить модель объекта: центр модели — в (cx, cz), поворот вокруг вертикали, низ модели — на
 * земле под центром (+ elevation — самолёт в полёте). Площадка под моделью расчищается: деревья
 * и бугры не прорастают сквозь самолёт; на воде модель стоит на её поверхности.
 */
function placeModel(
  b: Builder,
  cx: number,
  cz: number,
  rot: number,
  elevation: number,
  m: RasterModel,
): void {
  const { w, h, d, cells } = m;
  const hx = (w - 1) / 2,
    hz = (d - 1) / 2;
  // У всех точек одинаковая дробная часть (0 или .5), поэтому округление — сдвиг без дыр и наложений.
  const toWorld = (lx: number, lz: number): [number, number] => {
    const x = lx - hx,
      z = lz - hz;
    const [rx, rz] =
      rot === 90
        ? [-z, x]
        : rot === 180
          ? [-x, -z]
          : rot === 270
            ? [z, -x]
            : [x, z];
    return [cx + Math.round(rx), cz + Math.round(rz)];
  };
  const base = Math.max(b.t.groundAt(cx, cz), b.t.waterLevel);
  const y0 = base + 1 + elevation;
  const [ax, az] = toWorld(0, 0),
    [bx, bz] = toWorld(w - 1, d - 1);
  b.clear(
    Math.min(ax, bx),
    Math.min(az, bz),
    Math.max(ax, bx),
    Math.max(az, bz),
    elevation ? y0 : base + 1,
    y0 + h,
  );
  for (let y = 0; y < h; y++)
    for (let z = 0; z < d; z++)
      for (let x = 0; x < w; x++) {
        const id = cells[x + z * w + y * w * d]!;
        if (!id) continue;
        const [wx, wz] = toWorld(x, z);
        b.put(wx, y0 + y, wz, id);
      }
}
