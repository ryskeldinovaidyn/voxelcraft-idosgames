// Меш блоков-не-кубов: каждая коробка формы — до 6 граней с UV, обрезанными по коробке (как в
// Minecraft: у плиты на боку видна нижняя половина текстуры). Грань на краю клетки гасится
// непрозрачным соседом, внутренние грани рисуются всегда.
import type { Box } from "../registry/shapes";
import { FACES, type GeoBuilder, type UVRect } from "./GeoBuilder";

/** UV угла грани fi по его позиции — те же оси и направления, что в таблице FACES. */
function faceUV(fi: number, x: number, y: number, z: number): [number, number] {
  switch (fi) {
    case 0:
      return [z, y];
    case 1:
      return [1 - z, y];
    case 2:
      return [x, 1 - z];
    case 3:
      return [1 - x, z];
    case 4:
      return [1 - x, y];
    default:
      return [x, y];
  }
}

/**
 * @param centered — UV от центра коробки, а не от её места в клетке (факел на стене: иначе боковые
 *   грани показали бы прозрачный край тайла)
 */
export function meshBoxes(
  b: GeoBuilder,
  boxes: readonly Box[],
  x: number,
  y: number,
  z: number,
  tileUV: (fi: number) => UVRect,
  opaqueAt: (x: number, y: number, z: number) => boolean,
  centered = false,
  /** Свет клетки (небо << 4 | блоки) — на все грани формы. */
  light = 0xf0,
): void {
  for (const box of boxes) {
    const lo = [box[0], box[1], box[2]],
      hi = [box[3], box[4], box[5]];
    // координата для UV: своя или «от центра» (x, z) и «от низа» (y)
    const uvc = (axis: number, v: number): number =>
      !centered
        ? v
        : axis === 1
          ? v - lo[1]!
          : 0.5 - (hi[axis]! - lo[axis]!) / 2 + (v - lo[axis]!);
    for (let fi = 0; fi < 6; fi++) {
      const f = FACES[fi]!;
      const axis = f.dir.findIndex((d) => d !== 0);
      const onEdge = f.dir[axis]! < 0 ? lo[axis]! <= 0 : hi[axis]! >= 1;
      if (onEdge && opaqueAt(x + f.dir[0]!, y + f.dir[1]!, z + f.dir[2]!))
        continue;
      const corners = f.corners.map((c) => {
        const p = [
          c[0] ? hi[0]! : lo[0]!,
          c[1] ? hi[1]! : lo[1]!,
          c[2] ? hi[2]! : lo[2]!,
        ];
        const [u, v] = faceUV(fi, uvc(0, p[0]!), uvc(1, p[1]!), uvc(2, p[2]!));
        return [p[0]!, p[1]!, p[2]!, u, v];
      });
      b.quad(
        corners,
        x,
        y,
        z,
        f.dir[0]!,
        f.dir[1]!,
        f.dir[2]!,
        tileUV(fi),
        f.shade,
        undefined,
        light,
      );
    }
  }
}
