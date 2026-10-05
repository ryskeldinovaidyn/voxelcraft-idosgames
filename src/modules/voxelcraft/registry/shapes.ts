// Коробки форм блоков — ОДНА таблица на меш, коллизию и выделение, чтобы они не разъезжались.
// Коробка — [x0, y0, z0, x1, y1, z1] в долях блока (0..1; коллизия забора выше — до 1.5).
// Формы со стороной описаны для facing=0 (север) и поворачиваются rotateBox().
import type { BlockDef } from "../types";
import { BLOCKS } from "./Blocks";
import { DIR6, EXTENDED, FACING_DIRS, LIT, OPEN, TOP, facingOf } from "./meta";

export type Box = [number, number, number, number, number, number];

/** Соседи клетки — для форм, которые соединяются (забор, панель, стена). */
export interface ShapeCtx {
  neighbor(dx: number, dy: number, dz: number): number;
}

const FULL: Box = [0, 0, 0, 1, 1, 1];
const px = (n: number): number => n / 16;

/** Порядок граней как в FACES мешера: -x, +x, -y, +y, -z, +z. */
export const FACE_DIRS: readonly (readonly [number, number, number])[] = [
  [-1, 0, 0],
  [1, 0, 0],
  [0, -1, 0],
  [0, 1, 0],
  [0, 0, -1],
  [0, 0, 1],
];

/** Формы, у которых UV считаются от центра коробки (тонкие предметы: факел, фонарь). */
export const CENTERED_UV: ReadonlySet<string> = new Set([
  "torch",
  "lantern",
  "rod",
  "candle",
  "pod",
]);

/** Поворот коробки, описанной для севера, на facing по часовой стрелке (вид сверху). */
/** Коробка вдоль направления DIR6: a0..a1 — от задней грани к передней, c0..c1 — поперёк. */
export function alongDir(
  d: number,
  a0: number,
  a1: number,
  c0: number,
  c1: number,
): Box {
  const [dx, dy, dz] = DIR6[d]!;
  const span = (v: number): [number, number] =>
    v > 0 ? [a0, a1] : v < 0 ? [1 - a1, 1 - a0] : [c0, c1];
  const [x0, x1] = span(dx),
    [y0, y1] = span(dy),
    [z0, z1] = span(dz);
  return [x0, y0, z0, x1, y1, z1];
}

export function rotateBox(b: Box, facing: number): Box {
  let [x0, , z0, x1, , z1] = b;
  for (let i = 0; i < (facing & 3); i++) {
    // (x, z) → (1 - z, x)
    const nx0 = 1 - z1,
      nx1 = 1 - z0;
    z0 = x0;
    z1 = x1;
    x0 = nx0;
    x1 = nx1;
  }
  return [x0, b[1], z0, x1, b[4], z1];
}

/** Соединяется ли форма с соседом (забор с забором, панель со стеклом, всё — с полным блоком). */
function connects(def: BlockDef, nId: number): boolean {
  const n = BLOCKS[nId];
  if (!n || nId === 0) return false;
  if (n.shape === "cube" && n.opaque) return true;
  switch (def.shape) {
    case "fence":
      return n.shape === "fence" || n.shape === "fence_gate";
    case "pane":
      return n.shape === "pane" || n.name === "glass";
    case "wall":
      return n.shape === "wall" || n.shape === "fence_gate";
    default:
      return false;
  }
}

/** Стороны, к которым тянутся рукава (забор/панель/стена). */
function arms(def: BlockDef, ctx: ShapeCtx): number[] {
  const out: number[] = [];
  for (let f = 0; f < 4; f++) {
    const [dx, dz] = FACING_DIRS[f]!;
    if (connects(def, ctx.neighbor(dx, 0, dz))) out.push(f);
  }
  return out;
}

/** Коробки, которые видны (меш). */
export function visualBoxes(def: BlockDef, meta: number, ctx: ShapeCtx): Box[] {
  const f = facingOf(meta);
  switch (def.shape) {
    case "cube":
    case "liquid":
      return [FULL];
    case "slab": {
      const s = meta & 3;
      return [
        s === 2 ? FULL : s === 1 ? [0, 0.5, 0, 1, 1, 1] : [0, 0, 0, 1, 0.5, 1],
      ];
    }
    case "stairs": {
      const up = (meta & TOP) !== 0;
      const base: Box = up ? [0, 0.5, 0, 1, 1, 1] : [0, 0, 0, 1, 0.5, 1];
      const step: Box = up ? [0, 0, 0, 1, 0.5, 0.5] : [0, 0.5, 0, 1, 1, 0.5];
      return [base, rotateBox(step, f)];
    }
    case "rail": {
      // плоские — пластина; подъём — четыре ступеньки (коробки меша не бывают наклонными)
      const s = def.name === "rail" ? meta & 15 : meta & 7;
      if (s < 2 || s > 5) return [[0, 0, 0, 1, px(1), 1]];
      const out: Box[] = [];
      for (let i = 0; i < 4; i++) {
        const a = i / 4,
          b = (i + 1) / 4,
          y = i / 4;
        if (s === 2) out.push([a, y, 0, b, y + px(1), 1]);
        else if (s === 3) out.push([1 - b, y, 0, 1 - a, y + px(1), 1]);
        else if (s === 4) out.push([0, y, 1 - b, 1, y + px(1), 1 - a]);
        else out.push([0, y, a, 1, y + px(1), b]);
      }
      return out;
    }
    case "comparator": {
      // плита, два столбика у выхода и один сзади
      const f = meta & 3;
      return [
        [0, 0, 0, 1, px(2), 1],
        rotateBox([px(3), px(2), px(2), px(5), px(6), px(4)], f),
        rotateBox([px(11), px(2), px(2), px(13), px(6), px(4)], f),
        rotateBox([px(7), px(2), px(11), px(9), px(5), px(13)], f),
      ];
    }
    case "hopper": {
      // чаша сверху, воронка посередине, носик вниз (мета 0) или вбок (1..4: facing = мета-1)
      const m = meta & 7;
      return [
        [0, px(10), 0, 1, 1, 1],
        [px(4), px(4), px(4), px(12), px(10), px(12)],
        m === 0
          ? [px(6), 0, px(6), px(10), px(4), px(10)]
          : rotateBox([px(6), px(4), 0, px(10), px(8), px(4)], (m - 1) & 3),
      ];
    }
    case "piston":
      // выдвинутый — основание 12 px у задней грани
      return meta & EXTENDED ? [alongDir(meta & 7, 0, px(12), 0, 1)] : [FULL];
    case "piston_head":
      // плита у передней грани и шток через клетку назад, к основанию
      return [
        alongDir(meta & 7, px(12), 1, 0, 1),
        alongDir(meta & 7, 0, px(12), px(6), px(10)),
      ];
    case "repeater": {
      // плита и два столбика: передний (выход) у стороны facing, задний сдвигается задержкой
      const f = meta & 3;
      const d = (meta >> 2) & 3;
      return [
        [0, 0, 0, 1, px(2), 1],
        rotateBox([px(7), px(2), px(2), px(9), px(7), px(4)], f),
        rotateBox(
          [px(7), px(2), px(6 + 2 * d), px(9), px(7), px(8 + 2 * d)],
          f,
        ),
      ];
    }
    case "button": {
      // мета как у факела (0 — пол, 1..4 — стена) + 0x8 нажата: нажатая — вдвое тоньше
      const d = meta & 0x8 ? px(1) : px(2);
      const m = meta & 7;
      return m === 0
        ? [[px(5), 0, px(6), px(11), d, px(10)]]
        : [rotateBox([px(5), px(6), 0, px(11), px(10), d], (m - 1) & 3)];
    }
    case "lever": {
      // основание и рукоять; включённый — рукоять наклонена в другую сторону
      const on = (meta & 0x8) !== 0;
      const m = meta & 7;
      if (m === 0)
        return [
          [px(5), 0, px(4), px(11), px(3), px(12)],
          on
            ? [px(7), px(3), px(8), px(9), px(10), px(10)]
            : [px(7), px(3), px(6), px(9), px(10), px(8)],
        ];
      return [
        rotateBox([px(5), px(4), 0, px(11), px(12), px(3)], (m - 1) & 3),
        rotateBox(
          on
            ? [px(7), px(8), px(3), px(9), px(10), px(10)]
            : [px(7), px(6), px(3), px(9), px(8), px(10)],
          (m - 1) & 3,
        ),
      ];
    }
    case "torch":
      return meta === 0
        ? [[px(7), 0, px(7), px(9), px(10), px(9)]]
        : [rotateBox([px(7), px(3), 0, px(9), px(13), px(2)], (meta - 1) & 3)];
    case "door":
      return [
        rotateBox(
          meta & OPEN ? [0, 0, 0, px(3), 1, 1] : [0, 0, 0, 1, 1, px(3)],
          f,
        ),
      ];
    case "trapdoor":
      if (meta & OPEN) return [rotateBox([0, 0, 0, 1, 1, px(3)], f)];
      return [meta & TOP ? [0, px(13), 0, 1, 1, 1] : [0, 0, 0, 1, px(3), 1]];
    case "fence": {
      const out: Box[] = [[px(6), 0, px(6), px(10), 1, px(10)]];
      for (const a of arms(def, ctx))
        out.push(
          rotateBox([px(7), px(6), 0, px(9), px(9), px(6)], a),
          rotateBox([px(7), px(12), 0, px(9), px(15), px(6)], a),
        );
      return out;
    }
    case "fence_gate": {
      const parts: Box[] = [
        [0, px(5), px(7), px(2), 1, px(9)],
        [px(14), px(5), px(7), 1, 1, px(9)],
      ];
      if (!(meta & OPEN))
        parts.push(
          [px(2), px(6), px(7), px(14), px(9), px(9)],
          [px(2), px(12), px(7), px(14), px(15), px(9)],
        );
      return parts.map((b) => rotateBox(b, f));
    }
    case "pane": {
      const out: Box[] = [[px(7), 0, px(7), px(9), 1, px(9)]];
      const a = arms(def, ctx);
      for (const side of a.length ? a : [0, 1, 2, 3])
        out.push(rotateBox([px(7), 0, 0, px(9), 1, px(7)], side));
      return out;
    }
    case "wall": {
      const out: Box[] = [[px(4), 0, px(4), px(12), 1, px(12)]];
      for (const a of arms(def, ctx))
        out.push(rotateBox([px(5), 0, 0, px(11), px(14), px(4)], a));
      return out;
    }
    case "wall_mounted":
      // тонкое полотно на стене (картина, рамка, табличка); лазанье привязано к ladder — здесь его нет
      return [rotateBox([0, 0, 0, 1, 1, px(1)], f)];
    case "ladder":
      return [rotateBox([0, 0, 0, 1, 1, px(2)], f)];
    case "stand":
      // стойка для брони: основание, столб и перекладина-«плечи» (gfx/ArmorStand)
      return [
        [px(3), 0, px(3), px(13), px(1), px(13)],
        [px(7), px(1), px(7), px(9), px(14), px(9)],
        [px(2), px(11), px(7), px(14), px(12), px(9)],
      ];
    case "scaffold":
      // рама строительных лесов: верхняя площадка и четыре стойки по углам (systems/Scaffold)
      return [
        [0, px(14), 0, 1, 1, 1],
        [0, 0, 0, px(2), px(14), px(2)],
        [px(14), 0, 0, 1, px(14), px(2)],
        [0, 0, px(14), px(2), px(14), 1],
        [px(14), 0, px(14), 1, px(14), 1],
      ];
    case "carpet":
      return [[0, 0, 0, 1, px(1), 1]];
    case "bed":
      return [[0, 0, 0, 1, px(9), 1]];
    case "chest":
      return [[px(1), 0, px(1), px(15), px(14), px(15)]];
    case "frame":
      return meta & TOP
        ? [
            [0, 0, 0, 1, px(13), 1],
            [px(4), px(13), px(4), px(12), 1, px(12)],
          ]
        : [[0, 0, 0, 1, px(13), 1]];
    case "farmland":
      return [[0, 0, 0, 1, px(15), 1]];
    case "cactus":
      return [[px(1), 0, px(1), px(15), 1, px(15)]];
    case "snow_layer":
      return [[0, 0, 0, 1, ((meta & 7) + 1) / 8, 1]];
    case "lantern":
      return meta & TOP
        ? [[px(5), px(1), px(5), px(11), px(10), px(11)]]
        : [[px(5), 0, px(5), px(11), px(9), px(11)]];
    case "egg":
      return [[px(3), 0, px(3), px(13), 1, px(13)]];
    case "skull":
      return [[px(4), 0, px(4), px(12), px(8), px(12)]];
    case "rod":
      return [[px(7), 0, px(7), px(9), 1, px(9)]];
    case "candle":
      return [[px(7), 0, px(7), px(9), px(6), px(9)]];
    case "pod": {
      // стручок какао: растёт с возрастом (биты 2..3), висит на стволе со стороны facing
      const s = [4, 6, 8][Math.min(2, (meta >> 2) & 3)]!;
      const lo = (16 - s) / 2;
      return [
        rotateBox(
          [px(lo), px(11 - s), px(1), px(lo + s), px(12), px(1 + s)],
          f,
        ),
      ];
    }
    case "campfire":
      return [[0, 0, 0, 1, px(7), 1]];
    case "stalk": {
      // стебель эхоцвета и отростки к соседним стеблям
      const out: Box[] = [[px(4), 0, px(4), px(12), 1, px(12)]];
      for (let a = 0; a < 4; a++) {
        const [dx, dz] = FACING_DIRS[a]!;
        if (BLOCKS[ctx.neighbor(dx, 0, dz)]?.shape === "stalk")
          out.push(rotateBox([px(4), px(4), 0, px(12), px(12), px(4)], a));
      }
      return out;
    }
    case "end_portal":
      return [[0, px(12), 0, 1, px(13), 1]]; // тонкая плоскость на 3/4 высоты, как в Minecraft
    case "portal":
      return [
        (meta & 3) === 2
          ? [px(6), 0, 0, px(10), 1, 1]
          : [0, 0, px(6), 1, 1, px(10)],
      ];
    default:
      return []; // cross / crop / fire рисуются плоскостями
  }
}

/** Коробки коллизии. Нетвёрдый блок — ни одной; забор и стена — выше блока (1.5). */
export function collisionBoxes(
  def: BlockDef,
  meta: number,
  ctx: ShapeCtx,
): Box[] {
  if (!def.solid) return [];
  switch (def.shape) {
    case "cube":
      return [FULL];
    case "fence": {
      const out: Box[] = [[px(6), 0, px(6), px(10), 1.5, px(10)]];
      for (const a of arms(def, ctx))
        out.push(rotateBox([px(6), 0, 0, px(10), 1.5, px(6)], a));
      return out;
    }
    case "wall": {
      const out: Box[] = [[px(4), 0, px(4), px(12), 1.5, px(12)]];
      for (const a of arms(def, ctx))
        out.push(rotateBox([px(5), 0, 0, px(11), 1.5, px(4)], a));
      return out;
    }
    case "fence_gate":
      return meta & OPEN
        ? []
        : [rotateBox([0, 0, px(6), 1, 1.5, px(10)], facingOf(meta))];
    case "cactus":
      return [[px(1), 0, px(1), px(15), px(15), px(15)]];
    case "snow_layer": {
      const layers = meta & 7;
      return layers === 0 ? [] : [[0, 0, 0, 1, layers / 8, 1]];
    }
    default:
      return visualBoxes(def, meta, ctx);
  }
}

/** Коробки выделения (рамка прицела, луч). Плоским растениям — условная коробка. */
export function selectionBoxes(
  def: BlockDef,
  meta: number,
  ctx: ShapeCtx,
): Box[] {
  if (def.shape === "cross" || def.shape === "crop" || def.shape === "fire")
    return [[px(2), 0, px(2), px(14), px(13), px(14)]];
  // леса и стойка для брони выделяются целым кубом: иначе луч пролетает между стойками рамы и по
  // такому блоку нельзя ни попасть киркой, ни кликнуть (systems/Scaffold, gfx/ArmorStand)
  if (def.shape === "scaffold" || def.shape === "stand") return [FULL];
  if (def.shape === "liquid") return [FULL];
  return visualBoxes(def, meta, ctx);
}

/** Тайл грани fi (порядок FACE_DIRS) с учётом меты: ось бревна, лицевая сторона, половина двери. */
export function faceTile(def: BlockDef, meta: number, fi: number): string {
  const t = def.tex!;
  const dir = FACE_DIRS[fi]!;
  const side = t.side ?? t.top!;
  const top = t.top ?? side;
  const bottom = t.bottom ?? side;
  if (def.shape === "door") return meta & TOP ? (t.upper ?? side) : side;
  if (def.axis) {
    const ax = meta & 3; // 0 y, 1 x, 2 z
    const along = dir[ax === 1 ? 0 : ax === 2 ? 2 : 1] !== 0;
    return along ? top : side;
  }
  if (def.facing6) {
    // раздатчик: лицо — по направлению DIR6 из меты
    const [dx, dy, dz] = DIR6[meta & 7]!;
    if (dir[0] === dx && dir[1] === dy && dir[2] === dz) return t.front ?? side;
    // тыл со своей текстурой (выход наблюдателя; горит во время импульса — бит 0x8)
    if (t.upper && dir[0] === -dx && dir[1] === -dy && dir[2] === -dz)
      return meta & 0x8 && t.on ? t.on : t.upper;
    return dir[1] > 0 ? top : dir[1] < 0 ? bottom : side;
  }
  if (def.shape === "comparator" && dir[1] > 0 && (meta >> 3) & 15 && t.on)
    return t.on; // выход горит
  if (def.shape === "rail") {
    // тайл по форме: север–юг — как есть, запад–восток — «_ew», поворот — «_c6..9»; под током — on
    const plain = def.name === "rail";
    const s = plain ? meta & 15 : meta & 7;
    const base = !plain && meta & 0x8 && t.on ? t.on : top;
    if (s >= 6) return `${base}_c${s}`;
    return s === 1 || s === 2 || s === 3 ? `${base}_ew` : base;
  }
  if (def.shape === "piston" || def.shape === "piston_head") {
    // лицо — по направлению DIR6, тыл — bottom; у липкой головки лицо — on
    const [dx, dy, dz] = DIR6[meta & 7]!;
    if (dir[0] === dx && dir[1] === dy && dir[2] === dz)
      return def.shape === "piston_head" && meta & EXTENDED && t.on
        ? t.on
        : (t.front ?? side);
    if (dir[0] === -dx && dir[1] === -dy && dir[2] === -dz) return bottom;
    return side;
  }
  if (t.front && dir[1] === 0) {
    const [fx, fz] = FACING_DIRS[facingOf(meta)]!;
    if (dir[0] === fx && dir[2] === fz)
      return meta & LIT && t.on ? t.on : t.front;
  }
  if (def.shape === "frame" && meta & TOP && t.on && dir[1] > 0) return t.on;
  if (def.shape === "bed" && meta & TOP && t.upper && dir[1] > 0)
    return t.upper; // подушка
  if (def.shape === "farmland" && dir[1] > 0 && (meta & 7) === 7 && t.on)
    return t.on; // мокрая
  if (def.shape === "carpet" && meta > 0 && t.on) return t.on; // заряженный провод, нажатая плита
  if (def.blockEntity === "hive" && dir[1] === 0 && (meta & 7) >= 5 && t.on)
    return t.on; // полный улей
  return dir[1] > 0 ? top : dir[1] < 0 ? bottom : side;
}
