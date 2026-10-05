// ИИ-генерация мира поверх client.ai (@idosgames/core). Правила — по скиллу ai-generation-system:
//
//  - клиент называет только фичу ("voxel-world"): модель, системный промпт и цена — в конфиге тайтла;
//  - отказ (ok: false, "AI_CODE: сообщение") и провал генерации (Status: "failed") — разные вещи;
//  - у generate нет авто-ретрая транспорта: при обрыве связи повторяем САМИ и с тем же
//    relatedEntityID — сервер вернёт ту же генерацию и второй раз не спишет;
//  - асинхронную задачу опрашиваем сами, пока игрок ждёт; закрыл экран — задача дорабатывает на
//    сервере, её GenerationID сохраняется, и resume() дождётся результата в следующий раз.
// От @idosgames/core — только типы: сам клиент модулю отдаёт хост (ctx.client), runtime-код core
// модулю не нужен. Поэтому коды отказов ниже — литералами, зеркалом AIErrorCode из core.
import type {
  AIGenerationView,
  AIPublicFeature,
  AITextInput,
  IDosGamesClient,
  OperationResult,
} from "@idosgames/core";
import { CONFIG } from "../config";
import { parseWorldSpec, type WorldSize } from "../worldgen/WorldSpec";
import type {
  WorldAI,
  WorldAIFeature,
  WorldAIProgress,
  WorldAIRequest,
  WorldAIResult,
  WorldAIStatus,
} from "./types";
import { buildUserPrompt } from "./worldSpecPrompt";

type Failure = Extract<OperationResult<unknown>, { ok: false }>;

/** Коды отказов AI-модуля (AIErrorCode в @idosgames/core; сервер — InAppAIErrors). */
const AIErrorCode = {
  Disabled: "AI_DISABLED",
  FeatureNotFound: "AI_FEATURE_NOT_FOUND",
  FeatureDisabled: "AI_FEATURE_DISABLED",
  NotAvailableForPlayer: "AI_NOT_AVAILABLE_FOR_PLAYER",
  FeatureClosed: "AI_FEATURE_CLOSED",
  LimitReached: "AI_LIMIT_REACHED",
  Cooldown: "AI_COOLDOWN",
  BadInput: "AI_BAD_INPUT",
  PromptRejected: "AI_PROMPT_REJECTED",
  Unavailable: "AI_UNAVAILABLE",
  GenerationNotFound: "AI_GENERATION_NOT_FOUND",
} as const;

/** Код из отказа "AI_COOLDOWN: …" (как parseAIErrorCode в core); null — отказ без кода. */
function parseAIErrorCode(error: string | null | undefined): string | null {
  if (!error) return null;
  return /\b(AI_[A-Z_]+)\s*:/.exec(error)?.[1] ?? null;
}

/** Недождавшаяся задача: сохраняется до результата, переживает перезагрузку. */
interface PendingJob {
  id: string;
  size: WorldSize;
}

export interface WorldAIOptions {
  featureKey?: string;
  pollMs?: number;
  timeoutMs?: number;
  /** localStorage по умолчанию; null — не сохранять задачу между запусками. */
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}

const DEFAULT_TYPES = ["image/png", "image/jpeg", "image/webp"];

function defaultStorage(): WorldAIOptions["storage"] {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // хранилище запрещено (фрейм, настройки браузера)
  }
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });
}

function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
}

/** «10 GEM» из первой опции цены; null — бесплатно. */
export function priceLabel(
  options: AIPublicFeature["PriceOptions"],
): string | null {
  const first = options ? Object.values(options)[0] : undefined;
  if (!first) return null;
  if (first.Name) return first.Name;
  const parts = (first.Cost?.Standard?.Entries ?? [])
    .map((e) => `${e.Amount ?? ""} ${e.CurrencyID ?? e.ItemID ?? ""}`.trim())
    .filter(Boolean);
  return parts.length ? parts.join(" + ") : null;
}

function toFeature(f: AIPublicFeature): WorldAIFeature {
  return {
    allowImages: f.AllowImages === true,
    maxImageBytes: f.MaxInputImageBytes || null,
    imageTypes: f.AllowedImageTypes?.length
      ? f.AllowedImageTypes
      : DEFAULT_TYPES,
    async: f.Async === true,
    priceLabel: priceLabel(f.PriceOptions),
    maxPromptChars: f.MaxPromptChars || null,
    // у фичи по умолчанию одна картинка; потолка платформы нет — сколько разрешил издатель
    maxImages: Math.max(1, f.MaxInputImages || 1),
  };
}

/** Безопасное сообщение из отказа "AI_CODE: сообщение". */
function messageOf(error: string): string {
  const m = /\bAI_[A-Z_]+\s*:\s*([\s\S]*)$/.exec(error);
  return (m?.[1] ?? error).trim();
}

/** Отказ сервера (ничего не сгенерировано и не списано) — в понятный игроку текст. */
function refusal(res: Failure): WorldAIResult {
  if (res.reason === "connection")
    return {
      ok: false,
      kind: "connection",
      message: "Нет связи с сервером. Попробуйте ещё раз.",
    };
  if (res.reason === "unauthorized")
    return {
      ok: false,
      kind: "refused",
      message: "Войдите в игру, чтобы строить миры с ИИ.",
    };
  if (res.reason === "throttled")
    return {
      ok: false,
      kind: "refused",
      message: "Генерация уже идёт — дождитесь её.",
    };
  const code = parseAIErrorCode(res.error);
  switch (code) {
    case AIErrorCode.LimitReached:
    case AIErrorCode.Cooldown:
      return {
        ok: false,
        kind: "refused",
        message: "Лимит ИИ-генераций на сейчас исчерпан. Загляните позже.",
      };
    case AIErrorCode.PromptRejected:
      return {
        ok: false,
        kind: "refused",
        message: "Описание не прошло проверку. Переформулируйте его.",
      };
    case AIErrorCode.BadInput:
      return { ok: false, kind: "refused", message: messageOf(res.error) };
    case AIErrorCode.FeatureClosed:
      return {
        ok: false,
        kind: "refused",
        message: "ИИ-генерация миров сейчас закрыта.",
      };
    case AIErrorCode.Unavailable:
    case AIErrorCode.Disabled:
    case AIErrorCode.FeatureNotFound:
    case AIErrorCode.FeatureDisabled:
    case AIErrorCode.NotAvailableForPlayer:
      return { ok: false, kind: "refused", message: "ИИ сейчас недоступен." };
    default:
      return {
        ok: false,
        kind: "refused",
        message: code
          ? messageOf(res.error)
          : "Не удалось запустить генерацию.",
      };
  }
}

export function createClientWorldAI(
  client: IDosGamesClient,
  opts: WorldAIOptions = {},
): WorldAI {
  const featureKey = opts.featureKey ?? CONFIG.ai.featureKey;
  const pollMs = opts.pollMs ?? CONFIG.ai.pollMs;
  const timeoutMs = opts.timeoutMs ?? CONFIG.ai.pollTimeoutMs;
  const storage = opts.storage === undefined ? defaultStorage() : opts.storage;
  const sleep = opts.sleep ?? abortableSleep;
  const pendingKey = `voxelcraft:ai-world:${client.titleID}`;
  let feature: WorldAIFeature | null = null;

  const savePending = (job: PendingJob) => {
    try {
      storage?.setItem(pendingKey, JSON.stringify(job));
    } catch {
      /* без хранилища задача просто не переживёт перезагрузку */
    }
  };
  const loadPending = (): PendingJob | null => {
    try {
      const raw = storage?.getItem(pendingKey);
      const job = raw ? (JSON.parse(raw) as Partial<PendingJob>) : null;
      return job && typeof job.id === "string" && job.size
        ? (job as PendingJob)
        : null;
    } catch {
      return null;
    }
  };
  const clearPending = () => {
    try {
      storage?.removeItem(pendingKey);
    } catch {
      /* нечего чистить */
    }
  };

  async function status(): Promise<WorldAIStatus> {
    const res = await client.ai.getDefinitions();
    if (!res.ok)
      return {
        available: false,
        reason:
          res.reason === "unauthorized"
            ? "войдите, чтобы строить с ИИ"
            : "ИИ сейчас недоступен",
      };
    if (res.data.Enabled === false)
      return { available: false, reason: "ИИ выключен в этой игре" };
    const f = res.data.Features?.[featureKey];
    if (!f || (f.Modality && f.Modality !== "Text"))
      return { available: false, reason: "ИИ-генерация миров не настроена" };
    feature = toFeature(f);
    return { available: true, feature };
  }

  /** Опрос асинхронной задачи, пока игрок ждёт. */
  async function waitFor(
    first: AIGenerationView,
    signal: AbortSignal,
    onProgress: WorldAIProgress,
  ): Promise<AIGenerationView | WorldAIResult> {
    const deadline = Date.now() + timeoutMs;
    let view = first;
    while (!client.ai.isTerminal(view.Status)) {
      if (signal.aborted) return { ok: false, kind: "cancelled", message: "" };
      if (Date.now() > deadline)
        return {
          ok: false,
          kind: "connection",
          message:
            "ИИ отвечает слишком долго. Откройте «Создать мир» позже — результат дождётся вас.",
        };
      onProgress(view.Progress ?? null, "ИИ строит мир…");
      await sleep(pollMs, signal);
      if (signal.aborted) return { ok: false, kind: "cancelled", message: "" };
      const next = await client.ai.getText(view.GenerationID);
      if (!next.ok) {
        if (next.reason === "throttled" || next.reason === "connection")
          continue;
        if (parseAIErrorCode(next.error) === AIErrorCode.GenerationNotFound)
          clearPending();
        return refusal(next);
      }
      view = next.data;
    }
    return view;
  }

  /** Довести генерацию до рецепта: дождаться, разобрать, зажать под запрошенный размер. */
  async function settle(
    first: AIGenerationView,
    size: WorldSize,
    signal: AbortSignal,
    onProgress: WorldAIProgress,
  ): Promise<WorldAIResult> {
    let view = first;
    if (!client.ai.isTerminal(view.Status)) {
      savePending({ id: view.GenerationID, size });
      const waited = await waitFor(view, signal, onProgress);
      if ("ok" in waited) return waited; // отменено / таймаут / отказ — задача остаётся сохранённой
      view = waited;
    }
    clearPending();
    if (view.Status !== "completed")
      return {
        ok: false,
        kind: "failed",
        message: view.Error?.Message || "ИИ не смог построить мир.",
        refunded: view.PlayerRefunded === true,
      };
    const parsed = parseWorldSpec(view.OutputText ?? "");
    if (!parsed.ok)
      return parsed.truncated
        ? {
            ok: false,
            kind: "truncated",
            message: "Ответ ИИ оборван — мир получился слишком длинным.",
          }
        : {
            ok: false,
            kind: "invalid",
            message: "ИИ ответил не рецептом мира.",
          };
    // размер выбирал игрок — модель его не меняет
    const sized = parseWorldSpec({ ...parsed.spec, size });
    return sized.ok
      ? { ok: true, spec: sized.spec, warnings: parsed.warnings }
      : { ok: false, kind: "invalid", message: "ИИ ответил не рецептом мира." };
  }

  async function generate(
    req: WorldAIRequest,
    {
      signal,
      onProgress,
    }: { signal: AbortSignal; onProgress: WorldAIProgress },
  ): Promise<WorldAIResult> {
    if (!feature) {
      const s = await status();
      if (!s.available)
        return { ok: false, kind: "refused", message: s.reason };
    }
    const f = feature!; // status() выставил её или вернул отказ выше
    const input: AITextInput = {
      Prompt: buildUserPrompt(req, f.maxPromptChars),
    };
    if (req.images.length && f.allowImages)
      input.Images = req.images
        .slice(0, f.maxImages)
        .map((im) => ({ Base64: im.dataUrl, ContentType: im.contentType }));

    // Один ключ на нажатие: повтор после обрыва связи — та же генерация, без второго списания.
    const key = newKey();
    onProgress(null, "Отправляю запрос ИИ…");
    let res = await client.ai.generateText(featureKey, input, {
      relatedEntityID: key,
    });
    if (!res.ok && res.reason === "connection" && !signal.aborted) {
      onProgress(null, "Связь прервалась, повторяю…");
      res = await client.ai.generateText(featureKey, input, {
        relatedEntityID: key,
      });
    }
    if (!res.ok) {
      const code = parseAIErrorCode(res.error);
      if (
        code === AIErrorCode.FeatureNotFound ||
        code === AIErrorCode.FeatureDisabled
      )
        feature = null;
      return refusal(res);
    }
    return settle(res.data, req.size, signal, onProgress);
  }

  async function resume({
    signal,
    onProgress,
  }: {
    signal: AbortSignal;
    onProgress: WorldAIProgress;
  }): Promise<WorldAIResult | null> {
    const job = loadPending();
    if (!job) return null;
    onProgress(null, "Дожидаюсь мира с прошлого раза…");
    const res = await client.ai.getText(job.id);
    if (!res.ok) {
      if (res.reason === "connection" || res.reason === "throttled")
        return null; // попробуем в другой раз
      clearPending(); // задачи больше нет (или она чужая) — не спрашивать о ней снова
      return null;
    }
    return settle(res.data, job.size, signal, onProgress);
  }

  return { status, generate, resume };
}
