// Общие детали мешинга: таблица граней куба и сборщик буферной геометрии.
import * as THREE from "three";

export interface UVRect {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

// Таблица граней куба: направление, 4 угла (позиция + UV), базовая яркость.
// Порядок индексов: i, i+1, i+2, i+2, i+1, i+3 (CCW снаружи). Порядок граней совпадает с
// FACE_DIRS в registry/shapes.ts: -x, +x, -y, +y, -z, +z.
// Яркость граней мягче классической: направление теперь даёт настоящий свет (солнце + небосвод),
// запечённый шейд лишь подчёркивает объём, а не делает бока серыми.
export const FACES = [
  {
    dir: [-1, 0, 0],
    shade: 0.86,
    corners: [
      [0, 1, 0, 0, 1],
      [0, 0, 0, 0, 0],
      [0, 1, 1, 1, 1],
      [0, 0, 1, 1, 0],
    ],
  },
  {
    dir: [1, 0, 0],
    shade: 0.86,
    corners: [
      [1, 1, 1, 0, 1],
      [1, 0, 1, 0, 0],
      [1, 1, 0, 1, 1],
      [1, 0, 0, 1, 0],
    ],
  },
  {
    dir: [0, -1, 0],
    shade: 0.62,
    corners: [
      [1, 0, 1, 1, 0],
      [0, 0, 1, 0, 0],
      [1, 0, 0, 1, 1],
      [0, 0, 0, 0, 1],
    ],
  },
  {
    dir: [0, 1, 0],
    shade: 1.0,
    corners: [
      [0, 1, 1, 1, 1],
      [1, 1, 1, 0, 1],
      [0, 1, 0, 1, 0],
      [1, 1, 0, 0, 0],
    ],
  },
  {
    dir: [0, 0, -1],
    shade: 0.76,
    corners: [
      [1, 0, 0, 0, 0],
      [0, 0, 0, 1, 0],
      [1, 1, 0, 0, 1],
      [0, 1, 0, 1, 1],
    ],
  },
  {
    dir: [0, 0, 1],
    shade: 0.76,
    corners: [
      [0, 0, 1, 0, 0],
      [1, 0, 1, 1, 0],
      [0, 1, 1, 0, 1],
      [1, 1, 1, 1, 1],
    ],
  },
];

/**
 * Квад режется по диагонали 1–2 или 0–3 (обход периметра 0-1-3-2). С AO диагональ ведём через
 * «выбивающийся» угол — иначе затемнение одного угла ложится треугольником с резкой гранью.
 */
export function aoFlip(ao: readonly number[]): boolean {
  const d03 = Math.abs(ao[0]! - ao[3]!);
  const d12 = Math.abs(ao[1]! - ao[2]!);
  return d03 !== d12 ? d03 > d12 : ao[0]! + ao[3]! > ao[1]! + ao[2]!;
}

export class GeoBuilder {
  pos: number[] = [];
  norm: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  /** Свет вершины для шейдера (gfx/LightMaterial): 1 - небо/15, блоки/15. */
  lit: number[] = [];
  index: number[] = [];

  get empty(): boolean {
    return this.index.length === 0;
  }

  quad(
    corners: number[][],
    ox: number,
    oy: number,
    oz: number,
    nx: number,
    ny: number,
    nz: number,
    uvRect: UVRect | null,
    shade: number,
    ao?: readonly number[], // яркость 4 углов (вершинное AO); нет — грань без затенения
    // Свет: число — (небо << 4) | блоки на всю грань; массив — [небо, блоки] по 4 углам (мягкий
    // свет), уровни 0..15. Нет — открытое небо.
    light: number | readonly number[] = 0xf0,
  ): void {
    const base = this.pos.length / 3;
    let i = 0;
    for (const [cx, cy, cz, cu, cv] of corners) {
      this.pos.push(ox + cx!, oy + cy!, oz + cz!);
      this.norm.push(nx, ny, nz);
      this.uv.push(
        uvRect ? uvRect.u0 + (uvRect.u1 - uvRect.u0) * cu! : cu!,
        uvRect ? uvRect.v0 + (uvRect.v1 - uvRect.v0) * cv! : cv!,
      );
      const s = ao ? shade * ao[i]! : shade;
      this.col.push(s, s, s);
      const sky = typeof light === "number" ? light >> 4 : light[i * 2]!;
      const blk = typeof light === "number" ? light & 15 : light[i * 2 + 1]!;
      this.lit.push(1 - sky / 15, blk / 15);
      i++;
    }
    if (ao && aoFlip(ao))
      this.index.push(base, base + 1, base + 3, base, base + 3, base + 2);
    else
      this.index.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.norm, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute("lightLevel", new THREE.Float32BufferAttribute(this.lit, 2));
    g.setIndex(this.index);
    return g;
  }
}
