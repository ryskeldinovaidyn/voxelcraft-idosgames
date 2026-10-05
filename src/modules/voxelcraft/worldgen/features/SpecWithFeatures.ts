// Мир из рецепта поколения 2+: генератор рецепта (SpecGenerator — его вывод не меняется, золотые
// тесты те же) плюс слой особенностей — Подземная цитадель под островом в 32 блоках от спавна.
// Без неё Оку Предела в таком мире некуда вести, и дракон недостижим.
import { hashString, mulberry32 } from "../../core/Noise";
import type { Chunk } from "../../world/Chunk";
import type { SpecGenerator } from "../SpecGenerator";
import type { WorldGenerator } from "../WorldGenerator";
import {
  carveCitadels,
  citadelAt,
  makeCitadel,
  nearestCitadel,
  type Citadel,
} from "./citadel";

/** y пола зала цитадели в мирах из рецепта (они высотой 64 — цитадель глубоко под островом). */
export const SPEC_CITADEL_Y = 12;

export class SpecWithFeatures implements WorldGenerator {
  readonly seed: number;
  readonly waterLevel: number;
  private readonly citadels: Citadel[];

  constructor(private readonly base: SpecGenerator) {
    this.seed = base.seed;
    this.waterLevel = base.waterLevel;
    const s = base.spawnHint();
    const rng = mulberry32(hashString(`spec-citadel:${base.seed}`));
    const a = rng() * Math.PI * 2;
    this.citadels = [
      makeCitadel(
        Math.round(s.x + Math.cos(a) * 32),
        Math.round(s.z + Math.sin(a) * 32),
        SPEC_CITADEL_Y,
        rng,
      ),
    ];
  }

  generate(chunk: Chunk): void {
    this.base.generate(chunk);
    carveCitadels(chunk, this.citadels);
  }

  spawnHint(): { x: number; z: number } {
    return this.base.spawnHint();
  }

  structureAt(x: number, y: number, z: number): string | null {
    return citadelAt(this.citadels, x, y, z) ? "citadel" : null;
  }

  locate(
    kind: string,
    x: number,
    z: number,
  ): { x: number; y: number; z: number } | null {
    if (kind !== "citadel") return null;
    const c = nearestCitadel(this.citadels, x, z);
    return c ? { x: c.x, y: c.y, z: c.z } : null;
  }
}
