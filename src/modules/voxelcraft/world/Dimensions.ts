// Измерения мира: верхний мир, Пекло (inferno) и Предел (beyond). У каждого свой генератор по
// тому же источнику мира (сид или рецепт), свои дифы в сейве и свои правила. Названия в
// интерфейсе — registry/names.ts.
import type { WorldSource } from "../types";
import {
  createGenerator,
  type WorldGenerator,
} from "../worldgen/WorldGenerator";
import { InfernoGenerator } from "../worldgen/inferno/InfernoGenerator";
import { BeyondGenerator } from "../worldgen/beyond/BeyondGenerator";

export type DimensionId = "overworld" | "inferno" | "beyond";
export const DIMENSION_IDS: readonly DimensionId[] = [
  "overworld",
  "inferno",
  "beyond",
];

export interface DimensionDef {
  id: DimensionId;
  /** Есть небо: небесный свет и смена дня и ночи. В Пекле и Пределе темно без источников. */
  hasSky: boolean;
  /** Сколько блоков верхнего мира в одном блоке этого измерения (Пекло 8, как в Minecraft). */
  scale: number;
  /** Цвет неба/тумана без цикла суток. */
  sky: number;
  fog: number;
  /** Вода из ведра испаряется (Пекло). */
  waterEvaporates: boolean;
  /** Кровать взрывается при попытке уснуть (Пекло, Предел). */
  bedsExplode: boolean;
  /**
   * Фоновый свет измерения без неба: цвет рассеянного света и его нижний уровень в шейдере
   * (gfx/LightMaterial). Без него Предел — чёрный: там нет ни неба, ни лавы.
   */
  ambient: { color: number; level: number };
}

export const DIMENSIONS: Record<DimensionId, DimensionDef> = {
  overworld: {
    id: "overworld",
    hasSky: true,
    scale: 1,
    sky: 0x5ab8f5,
    fog: 0x9fd4f7,
    waterEvaporates: false,
    bedsExplode: false,
    ambient: { color: 0xffffff, level: 0.03 }, // не используется: есть небо
  },
  inferno: {
    id: "inferno",
    hasSky: false,
    scale: 8,
    sky: 0x2a0806,
    fog: 0x3a0e08,
    waterEvaporates: true,
    bedsExplode: true,
    ambient: { color: 0xc08070, level: 0.35 },
  },
  beyond: {
    id: "beyond",
    hasSky: false,
    scale: 1,
    sky: 0x0e0a16,
    fog: 0x16101f,
    waterEvaporates: false,
    bedsExplode: true,
    ambient: { color: 0xb8b0d0, level: 0.55 },
  },
};

type GeneratorFactory = (source: WorldSource) => WorldGenerator;

const FACTORIES: Partial<Record<DimensionId, GeneratorFactory>> = {
  overworld: createGenerator,
  // у каждого мира своё Пекло — от сида мира (у мира из рецепта — от сида рецепта)
  inferno: (s) =>
    new InfernoGenerator(s.kind === "spec" ? s.spec.seed : s.seed),
  beyond: (s) => new BeyondGenerator(s.kind === "spec" ? s.spec.seed : s.seed),
};

/** Подключить генератор измерения (Пекло и Предел регистрируют свои). */
export function registerDimensionGenerator(
  id: DimensionId,
  factory: GeneratorFactory,
): void {
  FACTORIES[id] = factory;
}

/** Генератор измерения для этого мира. */
export function dimensionGenerator(
  id: DimensionId,
  source: WorldSource,
): WorldGenerator {
  const f = FACTORIES[id];
  if (!f) throw new Error("измерение ещё не подключено: " + id);
  return f(source);
}

export function isDimensionId(v: unknown): v is DimensionId {
  return (
    typeof v === "string" && (DIMENSION_IDS as readonly string[]).includes(v)
  );
}
