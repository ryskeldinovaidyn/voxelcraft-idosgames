// Сохранение: экспорт/импорт мира в JSON-файл. Формат = полный снапшот
// этапа 2 (мультиплеер): источник мира (сид или рецепт) + дифы блоков + игрок + инвентарь +
// сущности + время. Мир восстанавливается повторной генерацией, поверх неё ложатся дифы.
//
// v1 — только сид (классический мир). v2 — плюс `world`. v3 — плюс палитра id→имя (дифы
// переносятся по именам), измерения (Пекло, Предел), блочные сущности и точка возрождения.
// Верхний мир всегда лежит в корне (`chunks`, `entities`) — его читают и Мастерская, и старый код.
// Импорт понимает все версии и, заодно, голый рецепт мира (файл «Скачать рецепт»).
import { CONFIG } from "../config";
import { difficulty, parseDifficulty, setDifficulty } from "./Difficulty";
import { BLOCKS, B } from "../registry/Blocks";
import {
  DIMENSION_IDS,
  isDimensionId,
  type DimensionId,
} from "../world/Dimensions";
import type { Game } from "../main";
import type {
  ChunkDiffMap,
  DimensionSave,
  SaveData,
  WorldSource,
} from "../types";
import { parseWorldSpec } from "../worldgen/WorldSpec";
import { portalsOf } from "../world/Portal";
import { deserializeMap, serializeMap } from "./Maps";

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Клетка Врат Предела из сейва: три числа или null. */
function gatewayOf(v: unknown): [number, number, number] | null {
  if (!Array.isArray(v) || v.length !== 3) return null;
  const [x, y, z] = v.map(Number) as [number, number, number];
  return [x, y, z].every(Number.isFinite) ? [x, y, z] : null;
}

/** Имя файла без запрещённых символов. */
export function safeFileName(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|]+/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 40) || "world"
  );
}

/** Скачать текст файлом. */
export function downloadText(
  fileName: string,
  text: string,
  type = "application/json",
) {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  // отзывать сразу нельзя: часть браузеров (Firefox, Safari) ещё не начала скачивание
  const url = a.href;
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Выбрать файл и прочитать его текстом. */
export function pickTextFile(accept: string, onText: (text: string) => void) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onText(String(reader.result));
    reader.readAsText(file);
  };
  input.click();
}

/**
 * Источник мира из сейва. Рецепт из файла — чужие данные: проходит ту же проверку, что и ответ
 * модели, иначе сломанный сейв ронял бы генератор.
 */
export function worldSourceOf(data: SaveData): WorldSource {
  const w: unknown = data.world;
  // поколение генератора сохраняется как есть: нет поля — поколение 1 (все сейвы до v3)
  const gen =
    isObj(w) && typeof w.gen === "number" && Number.isInteger(w.gen)
      ? { gen: w.gen }
      : {};
  if (isObj(w) && w.kind === "spec") {
    const parsed = parseWorldSpec(w.spec);
    if (!parsed.ok)
      throw new Error("рецепт мира в сейве повреждён: " + parsed.error);
    return { kind: "spec", spec: parsed.spec, ...gen };
  }
  if (isObj(w) && w.kind === "noise" && typeof w.seed === "number")
    return { kind: "noise", seed: w.seed, ...gen };
  return { kind: "noise", seed: data.seed };
}

/**
 * Перенос id блоков по палитре сейва: старый id → имя → нынешний id. null — переносить нечего
 * (палитры нет, как у v1/v2, или она совпадает с нынешним реестром). Блок, которого больше нет в
 * игре, становится воздухом.
 */
export function paletteRemap(
  palette: unknown,
): ((id: number) => number) | null {
  if (!Array.isArray(palette)) return null;
  const map = palette.map((n) =>
    typeof n === "string" ? (B[n] ?? B.air!) : B.air!,
  );
  if (map.every((v, i) => v === i)) return null;
  return (id) => map[id] ?? B.air!;
}

/** Дифы из чужого файла: только записи вида [индекс, id, мета] из целых чисел. */
function cleanDiffs(v: unknown): ChunkDiffMap {
  const out: ChunkDiffMap = {};
  if (!isObj(v)) return out;
  for (const [k, arr] of Object.entries(v)) {
    if (!Array.isArray(arr)) continue;
    out[k] = (arr as unknown[]).filter(
      (e): e is [number, number, number] =>
        Array.isArray(e) && e.length === 3 && e.every(Number.isInteger),
    );
  }
  return out;
}

/**
 * id вне нынешнего реестра — воздух (сейв без палитры из другой версии): BLOCKS[id]! роняли бы мешер
 * и физику. Только ПОСЛЕ remapDiffs — до него id сейва с палитрой указывают в его палитру, а не в реестр.
 */
function clampIds(diffs: ChunkDiffMap): ChunkDiffMap {
  const out: ChunkDiffMap = {};
  for (const [k, arr] of Object.entries(diffs))
    out[k] = arr.map(([i, id, meta]): [number, number, number] =>
      id >= 0 && id < BLOCKS.length ? [i, id, meta] : [i, B.air!, 0],
    );
  return out;
}

/** Дифы с перенесёнными id. */
export function remapDiffs(
  diffs: ChunkDiffMap,
  remap: ((id: number) => number) | null,
): ChunkDiffMap {
  if (!remap) return diffs;
  const out: ChunkDiffMap = {};
  for (const [k, arr] of Object.entries(diffs))
    out[k] = arr.map(([i, id, meta]): [number, number, number] => [
      i,
      remap(id),
      meta,
    ]);
  return out;
}

export class SaveSystem {
  game: Game;

  constructor(game: Game) {
    this.game = game;
  } // game — фасад из main.ts

  collect(): SaveData {
    const g = this.game;
    const here = g.dimension;
    const current: DimensionSave = {
      chunks: g.world.serializeDiffs(),
      entities: g.entities.serialize(),
      blockEntities: g.blockEntities.serialize(),
    };
    const dimOf = (d: DimensionId): DimensionSave | undefined =>
      d === here ? current : g.dims.get(d);
    const ow = dimOf("overworld") ?? { chunks: {} };
    const others: Partial<Record<DimensionId, DimensionSave>> = {};
    for (const d of DIMENSION_IDS)
      if (d !== "overworld") {
        const s = dimOf(d);
        if (s) others[d] = s;
      }
    return {
      version: CONFIG.saveVersion,
      seed: g.world.seed,
      world: g.world.source,
      time: g.dayNight.serialize(),
      weather: g.weather.serialize(),
      difficulty: difficulty(),
      player: { ...g.player.serialize(), inventory: g.inventory.serialize() },
      palette: BLOCKS.map((b) => b.name),
      chunks: ow.chunks,
      entities: ow.entities ?? [],
      blockEntities: ow.blockEntities ?? [],
      dimension: here,
      dimensions: others,
      portals: g.portals,
      beyond: g.beyondState,
      villages: [...g.villagesSettled],
      achievements: g.achievements.serialize(),
      maps: [...g.maps.values()].map(serializeMap),
      daysAwake: g.daysAwake,
      worldPulse: g.worldPulse.serialize(),
      onboarding: g.onboarding.serialize(),
      ...(g.netPlayers.size
        ? { players: Object.fromEntries(g.netPlayers) }
        : {}),
    };
  }

  exportFile() {
    const src = this.game.world.source;
    const name =
      src.kind === "spec" ? safeFileName(src.spec.name) : String(src.seed);
    downloadText(
      `voxelcraft-save-${name}.json`,
      JSON.stringify(this.collect()),
    );
  }

  /** Импорт из выбранного файла: сейв (v1/v2/v3) или голый рецепт мира. */
  importFile(onDone?: (err: unknown) => void) {
    pickTextFile(".json,application/json", (text) => {
      try {
        this.importText(text);
        onDone?.(null);
      } catch (e) {
        onDone?.(e);
      }
    });
  }

  importText(text: string) {
    const data: unknown = JSON.parse(text);
    if (!isObj(data)) throw new Error("не похоже на сейв VoxelCraft");
    if (
      isObj(data.chunks) &&
      (typeof data.seed === "number" || isObj(data.world))
    ) {
      const save = data as unknown as SaveData;
      void this.game.persist(); // снимок текущего мира берётся синхронно, до замены
      this.apply(save);
      const src = this.game.world.source;
      this.game.adoptNewWorld(
        src.kind === "spec" ? src.spec.name : "Мир " + src.seed,
      );
      return;
    }
    // не сейв — может быть, рецепт мира
    if ("terrain" in data || "zones" in data || "structures" in data) {
      const parsed = parseWorldSpec(data);
      if (!parsed.ok) throw new Error(parsed.error);
      this.game.newWorld({ kind: "spec", spec: parsed.spec });
      return;
    }
    throw new Error("не похоже на сейв VoxelCraft");
  }

  apply(data: SaveData) {
    const g = this.game;
    // всё, что может бросить, проверяем ДО замены мира: иначе мир уже пересоздан, а игрок и
    // инвентарь — от прошлого, и вызывающий (ловящий исключение) считает, что «мир остался прежним»
    const raw: unknown = data;
    const rawPlayer: unknown = isObj(raw) ? raw.player : undefined;
    if (!isObj(rawPlayer) || !Array.isArray(rawPlayer.pos))
      throw new Error("в сейве нет игрока");
    const remap = paletteRemap(data.palette);
    const src = worldSourceOf(data);
    const all: Partial<Record<DimensionId, DimensionSave>> = {
      ...(isObj(data.dimensions) ? data.dimensions : {}),
      overworld: {
        chunks: data.chunks,
        entities: data.entities,
        blockEntities: data.blockEntities,
      },
    };
    const here: DimensionId = isDimensionId(data.dimension)
      ? data.dimension
      : "overworld";

    // измерения собираем в стороне и только потом заменяем: раньше dims чистились до разбора, и
    // сломанный сейв, упав на кривом чанке, стирал Пекло и Предел ТЕКУЩЕГО мира
    let current: DimensionSave = { chunks: {} };
    const others = new Map<DimensionId, DimensionSave>();
    for (const d of DIMENSION_IDS) {
      const s = all[d];
      if (!isObj(s)) continue;
      const fixed: DimensionSave = {
        ...s,
        chunks: clampIds(remapDiffs(cleanDiffs(s.chunks), remap)),
      };
      if (d === here) current = fixed;
      else others.set(d, fixed);
    }
    g.dims.clear();
    for (const [d, s] of others) g.dims.set(d, s);

    g.rebuildWorld(src, here); // новый ChunkManager с этим источником и измерением
    g.world.loadDiffs(current.chunks);
    g.player.deserialize(data.player);
    g.inventory.deserialize(data.player.inventory);
    g.dayNight.deserialize(data.time);
    g.weather.deserialize(data.weather);
    // сложность мира: нет поля в старом сейве — обычная (systems/Difficulty)
    setDifficulty(parseDifficulty(data.difficulty) ?? "normal");
    g.entities.deserialize(
      current.entities as Parameters<Game["entities"]["deserialize"]>[0],
    );
    g.worldPulse.load(data.worldPulse);
    g.blockEntities.deserialize(current.blockEntities);
    g.portals = portalsOf(data.portals);
    g.maps = new Map();
    for (const d of Array.isArray(data.maps) ? data.maps : []) {
      const m = deserializeMap(d);
      if (m) g.maps.set(m.id, m);
    }
    g.nextMapId = Math.max(0, ...g.maps.keys()) + 1;
    g.daysAwake =
      typeof data.daysAwake === "number" && data.daysAwake >= 0
        ? data.daysAwake
        : 0;
    g.villagesSettled = new Set(
      Array.isArray(data.villages)
        ? data.villages.filter((s): s is string => typeof s === "string")
        : [],
    );
    g.achievements.load(data.achievements);
    g.onboarding.load(data.onboarding, !data.onboarding);
    g.netPlayers = new Map(
      isObj(data.players) ? Object.entries(data.players) : [],
    );
    const b = isObj(data.beyond) ? data.beyond : {};
    g.beyondState = {
      initialized: b.initialized === true,
      dragonKilled: b.dragonKilled === true,
      creditsShown: b.creditsShown === true,
      gateway: gatewayOf(b.gateway),
    };
  }
}
