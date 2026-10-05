// Генератор террейна: высотная карта на симплекс-fbm, слои пород, руды,
// озёра, деревья и растения. Полностью детерминирован сидом:
// один и тот же сид → бит-в-бит одинаковый мир (важно для сейва и этапа 2,
// где клиент генерирует мир по сиду и накатывает диф).
import { CONFIG } from "../config";
import { Simplex2, mulberry32, hashString } from "../core/Noise";
import { B, packWater } from "../registry/Blocks";
import { CHUNK_SIZE, LEGACY_SY, type Chunk } from "./Chunk";
import type { WorldGenerator } from "../worldgen/WorldGenerator";

const { SX, SZ } = CHUNK_SIZE;
/** Высота этого генератора — всегда прежняя: его вывод зафиксирован сейвами v1/v2. */
const SY = LEGACY_SY;

/** Рудные жилы: случайный «пьяный» шаг из точки, 4-8 блоков, только по камню. Общие с SpecGenerator. */
export function generateOres(chunk: Chunk, rng: () => number): void {
  const vein = (id: number, count: number, maxY: number): void => {
    for (let v = 0; v < count; v++) {
      let x = (rng() * SX) | 0,
        y = (3 + rng() * (maxY - 3)) | 0,
        z = (rng() * SZ) | 0;
      const len = (4 + rng() * 5) | 0;
      for (let i = 0; i < len; i++) {
        if (
          x >= 0 &&
          x < SX &&
          y >= 2 &&
          y < SY &&
          z >= 0 &&
          z < SZ &&
          chunk.get(x, y, z) === B.stone
        )
          chunk.setRaw(x, y, z, id);
        x += ((rng() * 3) | 0) - 1;
        y += ((rng() * 3) | 0) - 1;
        z += ((rng() * 3) | 0) - 1;
      }
    }
  };
  vein(B.coal_ore!, 7, 40);
  vein(B.iron_ore!, 5, 28);
}

/** Классический мир по сиду. Его вывод зафиксирован тестом: на нём стоят все сейвы v1. */
export class TerrainGenerator implements WorldGenerator {
  seed: number;
  height: Simplex2;
  detail: Simplex2;
  readonly waterLevel = CONFIG.world.waterLevel;

  constructor(seed: number) {
    this.seed = seed;
    this.height = new Simplex2(hashString("height:" + seed));
    this.detail = new Simplex2(hashString("detail:" + seed));
  }

  /** Высота поверхности в мировых координатах. */
  surfaceHeight(wx: number, wz: number): number {
    const w = CONFIG.world;
    const h =
      this.height.fbm(wx * 0.008, wz * 0.008, 4) * w.hillAmp +
      this.detail.noise(wx * 0.05, wz * 0.05) * 2;
    return Math.max(2, Math.min(SY - 8, Math.round(w.baseHeight + h)));
  }

  /** Заполняет данные чанка. Деревья сажаются с отступом от края (крона радиуса 2
   *  не пересекает границу чанка — генерация чанков остаётся независимой). */
  generate(chunk: Chunk): void {
    const water = CONFIG.world.waterLevel;
    const rng = mulberry32(
      hashString(`chunk:${this.seed}:${chunk.cx},${chunk.cz}`),
    );
    const heights = new Int16Array(SX * SZ);

    for (let z = 0; z < SZ; z++) {
      for (let x = 0; x < SX; x++) {
        const wx = chunk.cx * SX + x,
          wz = chunk.cz * SZ + z;
        const h = this.surfaceHeight(wx, wz);
        heights[x + z * SX] = h;
        const beach = h <= water + 1; // у воды — песок вместо дёрна

        for (let y = 0; y <= h; y++) {
          let id: number;
          if (y === 0) id = B.bedrock!;
          else if (y === 1 && rng() < 0.5)
            id = B.bedrock!; // рваный второй слой
          else if (y >= h - (beach ? 2 : 0) && beach) id = B.sand!;
          else if (y === h) id = B.grass!;
          else if (y >= h - 3) id = B.dirt!;
          else id = B.stone!;
          chunk.setRaw(x, y, z, id);
        }
        // озёра: всё, что ниже уровня моря — source-вода
        for (let y = h + 1; y <= water; y++)
          chunk.setRaw(x, y, z, B.water!, packWater(8, true));
      }
    }

    this._ores(chunk, rng);
    this._trees(chunk, rng, heights, water);
    this._plants(chunk, rng, heights, water);
    chunk.generated = true;
  }

  /** Спавн классического мира ищется от (8, 8) — как всегда. */
  spawnHint(): { x: number; z: number } {
    return { x: 8, z: 8 };
  }

  _ores(chunk: Chunk, rng: () => number): void {
    generateOres(chunk, rng);
  }

  _trees(
    chunk: Chunk,
    rng: () => number,
    heights: Int16Array,
    _water: number,
  ): void {
    const attempts = 3;
    for (let t = 0; t < attempts; t++) {
      // отступ 2 от края — крона не выходит за чанк
      const x = 2 + ((rng() * (SX - 4)) | 0),
        z = 2 + ((rng() * (SZ - 4)) | 0);
      const h = heights[x + z * SX]!;
      if (rng() > 0.6) continue;
      if (chunk.get(x, h, z) !== B.grass || h + 8 >= SY) continue;
      const trunk = 4 + ((rng() * 2) | 0);
      for (let y = 1; y <= trunk; y++) chunk.setRaw(x, h + y, z, B.oak_log!);
      // крона: два слоя 5×5 + два слоя 3×3 сверху, углы прореживаются
      for (let dy = trunk - 1; dy <= trunk + 2; dy++) {
        const r = dy >= trunk + 1 ? 1 : 2;
        for (let dx = -r; dx <= r; dx++)
          for (let dz = -r; dz <= r; dz++) {
            if (dx === 0 && dz === 0 && dy <= trunk) continue;
            if (Math.abs(dx) === r && Math.abs(dz) === r && rng() < 0.5)
              continue;
            const y = h + dy + 1;
            if (y < SY && chunk.get(x + dx, y, z + dz) === B.air)
              chunk.setRaw(x + dx, y, z + dz, B.leaves!);
          }
      }
    }
  }

  _plants(
    chunk: Chunk,
    rng: () => number,
    heights: Int16Array,
    water: number,
  ): void {
    for (let z = 0; z < SZ; z++)
      for (let x = 0; x < SX; x++) {
        const h = heights[x + z * SX]!;
        if (h <= water || h + 1 >= SY) continue;
        if (chunk.get(x, h, z) !== B.grass || chunk.get(x, h + 1, z) !== B.air)
          continue;
        const r = rng();
        if (r < 0.08) chunk.setRaw(x, h + 1, z, B.tallgrass!);
        else if (r < 0.095)
          chunk.setRaw(
            x,
            h + 1,
            z,
            rng() < 0.5 ? B.flower_yellow! : B.flower_red!,
          );
      }
  }
}
