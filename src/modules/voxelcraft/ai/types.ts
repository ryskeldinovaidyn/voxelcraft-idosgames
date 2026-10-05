// Контракт ИИ-генерации мира для экрана «Создать мир». UI знает только его: реализация поверх
// client.ai — в worldAi.ts, а standalone-запуск (без платформы) передаёт null — и кнопка ИИ
// просто не появляется, путь без ИИ работает как всегда.
import type { WorldSize, WorldSpec } from "../worldgen/WorldSpec";

export interface WorldAIFeature {
  /** Принимает ли фича картинку. Нет — картинка разбирается только локально. */
  allowImages: boolean;
  maxImageBytes: number | null;
  imageTypes: readonly string[];
  /** Асинхронная задача (опрос) — ответ может идти минуту-две. */
  async: boolean;
  /** «10 GEM» или null — бесплатно. */
  priceLabel: string | null;
  maxPromptChars: number | null;
  /** Сколько картинок фича принимает за раз (1..4). */
  maxImages: number;
}

export type WorldAIStatus =
  | { available: true; feature: WorldAIFeature }
  | { available: false; reason: string };

export interface WorldAIRequest {
  text: string;
  /** Картинки игрока (до 4): образцы объектов, в том числе один объект с разных сторон. */
  images: { dataUrl: string; contentType: string; bytes: number }[];
  size: WorldSize;
  /**
   * Как читать картинки: reference — ИИ сам решает по описанию (объект построить моделью, стиль,
   * место); topdown — первая картинка это карта мира сверху; mood — только настроение.
   */
  readMode: "reference" | "topdown" | "mood";
}

export type WorldAIFailure =
  /** Сервер отказал до генерации: ничего не списано. */
  | "refused"
  /** Генерация запускалась и упала: списанное возвращено, если refunded. */
  | "failed"
  /** Ответ модели — не рецепт. */
  | "invalid"
  /** Ответ оборван лимитом токенов (такой движок списывает, не возвращая). */
  | "truncated"
  /** Сеть: генерацию можно повторить тем же ключом без второго списания. */
  | "connection"
  /** Игрок закрыл экран: задача дорабатывает на сервере, результат можно дождаться позже. */
  | "cancelled";

export type WorldAIResult =
  | { ok: true; spec: WorldSpec; warnings: string[] }
  | { ok: false; kind: WorldAIFailure; message: string; refunded?: boolean };

export interface WorldAIProgress {
  (percent: number | null, note: string): void;
}

export interface WorldAI {
  status(): Promise<WorldAIStatus>;
  generate(
    req: WorldAIRequest,
    opts: { signal: AbortSignal; onProgress: WorldAIProgress },
  ): Promise<WorldAIResult>;
  /** Недождавшаяся задача с прошлого раза, если есть: дождаться её результата. */
  resume(opts: {
    signal: AbortSignal;
    onProgress: WorldAIProgress;
  }): Promise<WorldAIResult | null>;
}
