// Загрузка картинки игрока в браузере: пиксели для разбора без ИИ + сжатая копия для ИИ.
import type { RGBAImage } from "./ImageAnalyzer";

export interface LoadedImage {
  /** Пиксели для ImageAnalyzer (длинная сторона ≤ analysisMax). */
  image: RGBAImage;
  /** Копия для ИИ: JPEG, длинная сторона ≤ aiMax — меньше байт, та же картинка для модели. */
  aiDataUrl: string;
  aiBytes: number;
  aiContentType: string;
  /** Маленькое превью для экрана. */
  thumbUrl: string;
}

function draw(bitmap: ImageBitmap, maxSide: number): HTMLCanvasElement {
  const k = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bitmap.width * k));
  c.height = Math.max(1, Math.round(bitmap.height * k));
  const ctx = c.getContext("2d")!; // 2d-контекст у свежего canvas есть всегда
  ctx.fillStyle = "#ffffff"; // прозрачный PNG → белый фон (JPEG альфу не хранит)
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bitmap, 0, 0, c.width, c.height);
  return c;
}

/** Байт в data-URL base64 (без префикса). */
function dataUrlBytes(url: string): number {
  const b64 = url.slice(url.indexOf(",") + 1);
  return Math.floor((b64.length * 3) / 4);
}

export async function loadImageFile(
  file: Blob,
  { analysisMax = 512, aiMax = 1568, thumbMax = 160 } = {},
): Promise<LoadedImage> {
  const bitmap = await createImageBitmap(file);
  try {
    const a = draw(bitmap, analysisMax);
    const data = a.getContext("2d")!.getImageData(0, 0, a.width, a.height).data;
    const ai = draw(bitmap, aiMax);
    const aiDataUrl = ai.toDataURL("image/jpeg", 0.85);
    return {
      image: { width: a.width, height: a.height, data },
      aiDataUrl,
      aiBytes: dataUrlBytes(aiDataUrl),
      aiContentType: "image/jpeg",
      thumbUrl: draw(bitmap, thumbMax).toDataURL("image/jpeg", 0.8),
    };
  } finally {
    bitmap.close();
  }
}
