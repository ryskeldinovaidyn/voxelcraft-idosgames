// Растеризатор моделей объектов: фигуры (коробка, цилиндр, конус, эллипсоид, линия) → блоки.
//
// Зачем фигуры, а не сетка блоков от ИИ: языковая модель хорошо мыслит конструкцией — «фюзеляж —
// цилиндр 30 блоков, крылья — плоские коробки, симметрично», — а перечислить тысячи блоков по
// одному она не может ни по точности, ни по длине ответа. Фигуры дают пропорции и объём за сотню
// строк; мелочи дописываются одиночными блоками (voxels).
import { B } from "../registry/Blocks";
import type { ModelPart, VoxelModel } from "./WorldSpec";

export interface RasterModel {
  w: number;
  h: number;
  d: number;
  /** id блока по индексу x + z*w + y*w*d; 0 — пусто. */
  cells: Uint8Array;
}

const AXIS: Record<"x" | "y" | "z", 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

export function rasterizeModel(m: VoxelModel): RasterModel {
  const [w, h, d] = m.size;
  const cells = new Uint8Array(w * h * d);

  const write = (x: number, y: number, z: number, id: number) => {
    if (x < 0 || y < 0 || z < 0 || x >= w || y >= h || z >= d) return;
    cells[x + z * w + y * w * d] = id;
  };
  const put = (
    x: number,
    y: number,
    z: number,
    id: number,
    part: ModelPart,
  ) => {
    write(x, y, z, id);
    if (part.mirror === "x") write(w - 1 - x, y, z, id);
    else if (part.mirror === "z") write(x, y, d - 1 - z, id);
  };

  for (const part of m.parts) {
    const id = B[part.block] ?? B.air!;
    switch (part.shape) {
      case "box":
        box(part, id, put);
        break;
      case "cylinder":
      case "cone":
        tube(part, id, put);
        break;
      case "sphere":
        sphere(part, id, put);
        break;
      case "line":
        line(part, id, put);
        break;
    }
  }
  for (const [x, y, z, name] of m.voxels) write(x, y, z, B[name] ?? B.air!);
  return { w, h, d, cells };
}

type Put = (
  x: number,
  y: number,
  z: number,
  id: number,
  part: ModelPart,
) => void;

function box(p: ModelPart, id: number, put: Put): void {
  const [ax, ay, az] = p.from!,
    [bx, by, bz] = p.to!;
  const x0 = Math.round(Math.min(ax, bx)),
    x1 = Math.round(Math.max(ax, bx));
  const y0 = Math.round(Math.min(ay, by)),
    y1 = Math.round(Math.max(ay, by));
  const z0 = Math.round(Math.min(az, bz)),
    z1 = Math.round(Math.max(az, bz));
  for (let y = y0; y <= y1; y++)
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) {
        if (
          p.hollow &&
          x > x0 &&
          x < x1 &&
          y > y0 &&
          y < y1 &&
          z > z0 &&
          z < z1
        )
          continue;
        put(x, y, z, id, p);
      }
}

/** Цилиндр и конус: круглые сечения вдоль оси, радиус плавно меняется от radius к radius2. */
function tube(p: ModelPart, id: number, put: Put): void {
  const a = AXIS[p.axis ?? "x"];
  const [u, v] = ([0, 1, 2] as const).filter((i) => i !== a) as [
    0 | 1 | 2,
    0 | 1 | 2,
  ];
  const c = p.center!;
  const len = p.length ?? 1;
  const n = Math.max(1, Math.abs(len));
  const dir = len < 0 ? -1 : 1;
  const r0 = p.radius ?? 1;
  const r1 = p.shape === "cone" ? (p.radius2 ?? 0) : r0;
  const start = Math.round(c[a]);
  for (let t = 0; t < n; t++) {
    const r = r0 + (r1 - r0) * (n > 1 ? t / (n - 1) : 0);
    const lim = Math.max(r, 0.5) + 0.45; // тонкая фигура не пропадает совсем
    const cu = c[u],
      cv = c[v];
    for (let pu = Math.floor(cu - lim); pu <= Math.ceil(cu + lim); pu++)
      for (let pv = Math.floor(cv - lim); pv <= Math.ceil(cv + lim); pv++) {
        const dist = Math.hypot(pu - cu, pv - cv);
        if (dist > lim) continue;
        if (p.hollow && dist < lim - 1.2) continue;
        const q: [number, number, number] = [0, 0, 0];
        q[a] = start + dir * t;
        q[u] = pu;
        q[v] = pv;
        put(q[0], q[1], q[2], id, p);
      }
  }
}

function sphere(p: ModelPart, id: number, put: Put): void {
  const [cx, cy, cz] = p.center!;
  const [rx, ry, rz] = p.radii!.map((r) => r + 0.45) as [
    number,
    number,
    number,
  ];
  const inside = (x: number, y: number, z: number, k: number) =>
    ((x - cx) / (rx - k)) ** 2 +
      ((y - cy) / (ry - k)) ** 2 +
      ((z - cz) / (rz - k)) ** 2 <=
    1;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (!inside(x, y, z, 0)) continue;
        if (p.hollow && Math.min(rx, ry, rz) > 1.5 && inside(x, y, z, 1))
          continue;
        put(x, y, z, id, p);
      }
}

/** Отрезок: антенны, стойки, тросы; с radius — утолщённый. */
function line(p: ModelPart, id: number, put: Put): void {
  const [ax, ay, az] = p.from!,
    [bx, by, bz] = p.to!;
  const steps = Math.max(
    1,
    Math.ceil(
      Math.max(Math.abs(bx - ax), Math.abs(by - ay), Math.abs(bz - az)),
    ),
  );
  const r = p.radius ?? 0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = ax + (bx - ax) * t,
      y = ay + (by - ay) * t,
      z = az + (bz - az) * t;
    if (r < 0.5) {
      put(Math.round(x), Math.round(y), Math.round(z), id, p);
      continue;
    }
    const R = Math.ceil(r);
    for (let dy = -R; dy <= R; dy++)
      for (let dz = -R; dz <= R; dz++)
        for (let dx = -R; dx <= R; dx++)
          if (Math.hypot(dx, dy, dz) <= r + 0.45)
            put(
              Math.round(x) + dx,
              Math.round(y) + dy,
              Math.round(z) + dz,
              id,
              p,
            );
  }
}
