import type {
  CapturedContent,
  ContentTypeHandler,
  DownloadedContent,
  LocalContentItem,
} from "@idosgames/module-sdk";
import type { Game } from "./main";
import type { SaveData } from "./types";
import { WorldStore, newWorldId } from "./systems/WorldStore";
import { SpecGenerator } from "./worldgen/SpecGenerator";
import { drawPreview } from "./worldgen/preview";

// VoxelCraft в Мастерской: тип контента "voxelcraft.world".
//
// Мастерская общая для всех игр и про миры ничего не знает — она берёт отсюда три вещи: какие миры
// есть у игрока («Мои миры»), как один из них превратить в файлы для публикации и как открыть
// скачанный. Файл публикации — это СЕЙВ (рецепт или сид + дифы блоков), тот же, что пишет автосейв:
// второго формата у мира нет.
//
// ⚠ Тип обязан быть заведён в конфиге тайтла (Workshop.ContentTypes["voxelcraft.world"]) с ролью
// "main" формата application/json — иначе сервер откажет в публикации.

export const VOXEL_WORLD_CONTENT_TYPE = "voxelcraft.world";

/** Сторона превью в пикселях. Превью — миникарта рецепта: у мира по сиду её нет. */
const THUMB_SIDE = 256;

/**
 * Обработчик типа. Игра создаётся при монтировании сцены и может ещё не существовать (игрок открыл
 * Мастерскую раньше игры) — поэтому доступ к ней через геттер, а хранилище при необходимости
 * открывается своё.
 */
export function createVoxelWorldContentType(
  getGame: () => Game | null,
): ContentTypeHandler {
  const withStore = async <T>(
    work: (store: WorldStore) => Promise<T>,
  ): Promise<T> => {
    const live = getGame()?.store;
    if (live) return work(live);
    const own = await WorldStore.open();
    if (!own)
      throw new Error(
        "Этот браузер не даёт хранить миры (приватный режим или запрет хранилища).",
      );
    try {
      return await work(own);
    } finally {
      own.close();
    }
  };

  return {
    type: VOXEL_WORLD_CONTENT_TYPE,
    label: "Миры VoxelCraft",
    icon: "🧊",
    modeId: "voxelcraft",

    async listLocal(): Promise<LocalContentItem[]> {
      // Текущий мир сохраняем перед показом списка — иначе опубликовался бы сейв полуминутной давности.
      await getGame()?.persist();
      return withStore(async (store) =>
        (await store.list()).map((w) => ({
          id: w.id,
          name: w.name,
          updatedAt: w.updatedAt,
          subtitle: w.kind === "spec" ? "мир по рецепту" : "мир по сиду",
        })),
      );
    },

    async capture(localId: string): Promise<CapturedContent> {
      const game = getGame();
      if (game?.worldId === localId) await game.persist();

      const stored = await withStore((store) => store.get(localId));
      if (!stored) throw new Error("Мир не найден в «Моих мирах».");

      return {
        files: [
          {
            role: "main",
            contentType: "application/json",
            data: JSON.stringify(stored.save),
          },
        ],
        thumbnail: await thumbnailOf(stored.save),
        suggestedTitle: stored.name,
        metadata: worldMetadata(stored.save),
      };
    },

    async open(content: DownloadedContent): Promise<void> {
      const main =
        content.files.find((f) => f.role === "main") ?? content.files[0];
      if (!main) throw new Error("В публикации нет файла мира.");

      const save = parseSave(main.data);
      const name = content.title?.trim() || "Мир из Мастерской";

      const game = getGame();
      if (game) {
        if (!game.openSharedWorld(save, name))
          throw new Error(
            "Этот мир не открывается: сейв повреждён или от несовместимой версии.",
          );
        return;
      }

      // Игры ещё нет — кладём мир в «Мои миры» новой записью. Запущенная игра продолжает самый
      // свежий мир сама (см. Game: «продолжить последний мир»), то есть откроет именно этот.
      await withStore((store) =>
        store.put({ id: newWorldId(), name, updatedAt: Date.now(), save }),
      );
    },
  };
}

/** Сейв из байтов публикации. Проверка — только формы: остальное проверит SaveSystem.apply. */
function parseSave(data: ArrayBuffer): SaveData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(data));
  } catch {
    throw new Error("Файл мира — не JSON.");
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as { version?: unknown }).version !== "number" ||
    typeof (parsed as { chunks?: unknown }).chunks !== "object"
  )
    throw new Error("Это не сейв VoxelCraft.");
  return parsed as SaveData;
}

/** Метаданные для фильтров каталога: вид мира и имя рецепта. Ключи — латиница без точек (путь в базе). */
function worldMetadata(save: SaveData): Record<string, string> {
  const source = save.world;
  // У рецепта сид необязателен (по умолчанию — хеш имени): без проверки в каталог ушло бы "undefined".
  if (source?.kind === "spec")
    return source.spec.seed === undefined || source.spec.seed === null
      ? { kind: "spec" }
      : { kind: "spec", seed: String(source.spec.seed) };
  return { kind: "noise", seed: String(save.seed) };
}

/** Превью — миникарта рецепта в webp. У мира по сиду превью нет: рисовать нечего без генерации. */
async function thumbnailOf(
  save: SaveData,
): Promise<CapturedContent["thumbnail"]> {
  const source = save.world;
  if (source?.kind !== "spec" || typeof document === "undefined")
    return undefined;
  try {
    const canvas = document.createElement("canvas");
    drawPreview(canvas, new SpecGenerator(source.spec), THUMB_SIDE);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.85),
    );
    if (!blob) return undefined;
    // Браузер без webp-кодека молча отдаёт png — объявляем то, что получилось на самом деле.
    const type = blob.type === "image/png" ? "image/png" : "image/webp";
    return { contentType: type, data: blob };
  } catch {
    return undefined; // превью — украшение: без него мир всё равно публикуется
  }
}
