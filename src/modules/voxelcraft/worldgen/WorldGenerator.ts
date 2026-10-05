// Контракт генератора мира. ChunkManager знает только его: заполнить чанк, подсказать точку спавна
// и уровень моря. Реализации — шум по сиду (TerrainGenerator — классический мир и сейвы v1/v2;
// OverworldGenerator — поколение 2, новые миры) и рецепт мира (SpecGenerator).
import type { Chunk } from "../world/Chunk";
import type { ItemStack, WorldSource } from "../types";
import { TerrainGenerator } from "../world/TerrainGenerator";
import { SpecGenerator } from "./SpecGenerator";
import { OverworldGenerator } from "./overworld/OverworldGenerator";
import { SpecWithFeatures } from "./features/SpecWithFeatures";

export interface WorldGenerator {
  readonly seed: number;
  /** Уровень моря (y): спавн ищет сушу выше него. */
  readonly waterLevel: number;
  /** Заполнить данные чанка через chunk.setRaw и выставить chunk.generated = true. */
  generate(chunk: Chunk): void;
  /** Откуда начинать поиск суши для спавна (мировые x, z). */
  spawnHint(): { x: number; z: number };
  /** Постройка в точке (адская крепость) — по ней спавнятся её жители; null — нет. */
  structureAt?(x: number, y: number, z: number): string | null;
  /** Ближайшая постройка вида kind к (x, z) — команда /locate. */
  locate?(
    kind: string,
    x: number,
    z: number,
  ): { x: number; y: number; z: number } | null;
  /** Деревни с центром ближе r к (x, z): кого и где поселить, когда игрок подошёл впервые. */
  villagesNear?(
    x: number,
    z: number,
    r: number,
  ): {
    id: string;
    x: number;
    y: number;
    z: number;
    residents: {
      type: string;
      x: number;
      y: number;
      z: number;
      captain?: boolean;
    }[];
  }[];
  /** Биом колонны (спавн по биомам — MobSpawn.biomes); нет метода — у мира нет биомов. */
  biomeOf?(x: number, z: number): string;
  /** Добыча сундука постройки в клетке (27 слотов) или null — отдаётся при первом открытии. */
  lootAt?(x: number, y: number, z: number): (ItemStack | null)[] | null;
  /** Спавнеры испытаний построек ближе r к (x, z) — Game заводит им блочные сущности. */
  trialSpawnersNear?(
    x: number,
    z: number,
    r: number,
  ): [number, number, number][];
}

/** Поколение генератора для новых миров по сиду. Нет поля `gen` в источнике — поколение 1. */
export const CURRENT_GEN = 2;

export function createGenerator(source: WorldSource): WorldGenerator {
  if (source.kind === "spec") {
    const g = new SpecGenerator(source.spec);
    // gen 2+: слой особенностей (цитадель); прежние миры из рецепта — без него, их вывод зафиксирован
    return (source.gen ?? 1) >= 2 ? new SpecWithFeatures(g) : g;
  }
  return (source.gen ?? 1) >= 2
    ? new OverworldGenerator(source.seed)
    : new TerrainGenerator(source.seed);
}
