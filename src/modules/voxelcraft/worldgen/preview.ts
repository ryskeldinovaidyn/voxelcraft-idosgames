// Миникарта мира по рецепту: вид сверху до входа в мир. Считается из тех же функций, что и
// генерация (высота, поверхность, постройки), поэтому показывает ровно тот мир, что построится.
import { BLOCKS, B } from "../registry/Blocks";
import { LEGACY_SY } from "../world/Chunk";
import type { SpecGenerator } from "./SpecGenerator";
import type { TreeType } from "./WorldSpec";

/** Миры по рецепту строятся в прежней высоте — по ней и затенение миникарты. */
const SY = LEGACY_SY;

const LEAF_OF: Record<TreeType, string> = {
  oak: "leaves",
  birch: "birch_leaves",
  spruce: "spruce_leaves",
  palm: "leaves",
  dead: "oak_log",
  none: "leaves",
};

const hash01 = (x: number, z: number): number =>
  (((Math.imul(x, 73856093) ^ Math.imul(z, 19349663)) >>> 0) % 1000) / 1000;

export interface PreviewPixels {
  w: number;
  h: number;
  data: Uint8ClampedArray<ArrayBuffer>;
}

/** RGBA-пиксели миникарты области рецепта; длинная сторона — maxSide. */
export function previewPixels(
  gen: SpecGenerator,
  maxSide: number,
): PreviewPixels {
  const scale = Math.max(gen.W, gen.D) / maxSide;
  const w = Math.max(1, Math.round(gen.W / scale)),
    h = Math.max(1, Math.round(gen.D / scale));
  const heights = new Int16Array(w * h);
  const wxOf = (px: number) =>
    Math.min(gen.W - 1, Math.floor((px + 0.5) * scale));
  const wzOf = (pz: number) =>
    Math.min(gen.D - 1, Math.floor((pz + 0.5) * scale));
  for (let pz = 0; pz < h; pz++)
    for (let px = 0; px < w; px++)
      heights[px + pz * w] = gen.heightAt(wxOf(px), wzOf(pz));

  const data = new Uint8ClampedArray(w * h * 4);
  const water = gen.waterLevel;
  const waterColor = BLOCKS[B.water!]!.mapColor;
  for (let pz = 0; pz < h; pz++)
    for (let px = 0; px < w; px++) {
      const i = px + pz * w;
      const wx = wxOf(px),
        wz = wzOf(pz);
      const hh = heights[i]!;
      const left = heights[Math.max(0, px - 1) + pz * w]!,
        up = heights[px + Math.max(0, pz - 1) * w]!;
      const slope =
        Math.max(Math.abs(hh - left), Math.abs(hh - up)) / Math.max(1, scale);
      const info = gen.columnInfo(wx, wz, hh, slope);
      const top = gen.stampTopAt(wx, wz);

      let color: number,
        y = hh,
        k = 1;
      // постройка выше земли — или срыла её верх (русло реки, пруд): видна постройка
      if (top && (top.y >= hh || top.dug <= hh)) {
        color = BLOCKS[top.id]!.mapColor;
        y = top.y;
      } else if (hh < water) {
        color = waterColor;
        k = Math.max(0.55, 1 - (water - hh) * 0.06); // глубже — темнее
      } else {
        color = BLOCKS[info.surface]!.mapColor;
        const trees = info.zone.trees;
        if (
          trees > 0 &&
          info.zone.treeType !== "none" &&
          hash01(wx, wz) < trees * 0.45
        )
          color = BLOCKS[B[LEAF_OF[info.zone.treeType]]!]!.mapColor;
      }
      if (!(hh < water && !top)) {
        // освещение с северо-запада + высота
        const shadeLight = Math.min(
          1.2,
          Math.max(0.72, 1 + (hh - (left + up) / 2) * 0.08),
        );
        k *= shadeLight * (0.8 + 0.3 * (y / SY));
      }
      data[i * 4] = ((color >> 16) & 255) * k;
      data[i * 4 + 1] = ((color >> 8) & 255) * k;
      data[i * 4 + 2] = (color & 255) * k;
      data[i * 4 + 3] = 255;
    }
  return { w, h, data };
}

/** Нарисовать миникарту в canvas (размер canvas подгоняется). */
export function drawPreview(
  canvas: HTMLCanvasElement,
  gen: SpecGenerator,
  maxSide = 256,
): void {
  const px = previewPixels(gen, maxSide);
  canvas.width = px.w;
  canvas.height = px.h;
  const ctx = canvas.getContext("2d")!; // 2d-контекст у canvas есть всегда
  ctx.putImageData(new ImageData(px.data, px.w, px.h), 0, 0);
  // точка спавна
  const s = gen.spawnHint();
  ctx.fillStyle = "#ff3b30";
  ctx.fillRect((s.x / gen.W) * px.w - 2, (s.z / gen.D) * px.h - 2, 4, 4);
}
