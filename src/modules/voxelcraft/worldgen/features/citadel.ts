// Подземная цитадель (слой особенностей): зал портала 11×11 — 12 рамок портала Предела вокруг
// лавового бассейна 3×3 (в каждой Око с шансом 10%, как в Minecraft) — и четыре коридора по 24 блока
// из каменного кирпича. Общая для верхнего мира gen2 (OverworldGenerator) и миров из рецепта
// (features/SpecWithFeatures). Чистые функции координат — чанки сходятся без швов.
import { B, packWater } from "../../registry/Blocks";
import { TOP } from "../../registry/meta";
import { FRAME_RING } from "../../world/BeyondPortal";
import { CHUNK_SIZE, type Chunk } from "../../world/Chunk";

const { SX, SZ } = CHUNK_SIZE;

/** Коробка части цитадели: оболочка — каменный кирпич, внутри — пусто. */
export interface CitadelBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

export interface Citadel {
  x: number;
  z: number;
  /** y пола зала портала (рамки стоят на нём). */
  y: number;
  parts: CitadelBox[];
  /** В каких из 12 рамок Око уже стоит. */
  eyes: boolean[];
}

/** Цитадель с центром зала в (x, y, z); rng тратится только на Око в рамках (12 вызовов). */
export function makeCitadel(
  x: number,
  z: number,
  y: number,
  rng: () => number,
): Citadel {
  const y0 = y - 1;
  const box = (
    x0: number,
    x1: number,
    z0: number,
    z1: number,
    h: number,
  ): CitadelBox => ({
    x0,
    x1,
    z0,
    z1,
    y0,
    y1: y0 + h,
  });
  return {
    x,
    z,
    y,
    parts: [
      box(x - 5, x + 5, z - 5, z + 5, 8), // зал портала
      box(x + 5, x + 29, z - 2, z + 2, 5),
      box(x - 29, x - 5, z - 2, z + 2, 5),
      box(x - 2, x + 2, z + 5, z + 29, 5),
      box(x - 2, x + 2, z - 29, z - 5, 5),
    ],
    eyes: Array.from({ length: 12 }, () => rng() < 0.1),
  };
}

/** Каждый 20-й кирпич оболочки — заражённый (чешуйница), по хешу координат: чанки сходятся. */
function infested(x: number, y: number, z: number): boolean {
  return (((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0) % 20 === 0;
}

/** Цитадели в чанке: оболочки, пустота, лавовый бассейн и кольцо из 12 рамок портала. */
export function carveCitadels(
  chunk: Chunk,
  citadels: readonly Citadel[],
): void {
  const wx0 = chunk.cx * SX,
    wz0 = chunk.cz * SZ;
  const inChunk = (x: number, z: number) =>
    x >= wx0 && x < wx0 + SX && z >= wz0 && z < wz0 + SZ;
  for (const c of citadels) {
    const parts = c.parts.filter(
      (b) => b.x1 >= wx0 && b.x0 < wx0 + SX && b.z1 >= wz0 && b.z0 < wz0 + SZ,
    );
    if (!parts.length) continue;
    const each = (
      b: CitadelBox,
      pad: number,
      fn: (x: number, z: number) => void,
    ) => {
      for (
        let x = Math.max(b.x0 + pad, wx0);
        x <= Math.min(b.x1 - pad, wx0 + SX - 1);
        x++
      )
        for (
          let z = Math.max(b.z0 + pad, wz0);
          z <= Math.min(b.z1 - pad, wz0 + SZ - 1);
          z++
        )
          fn(x, z);
    };
    for (const b of parts)
      each(b, 0, (x, z) => {
        const edge = x === b.x0 || x === b.x1 || z === b.z0 || z === b.z1;
        for (let y = b.y0; y <= b.y1; y++)
          if (edge || y === b.y0 || y === b.y1)
            chunk.setRaw(
              x - wx0,
              y,
              z - wz0,
              infested(x, y, z) ? B.infested_stone_bricks! : B.stone_bricks!,
            );
      });
    for (const b of parts)
      each(b, 1, (x, z) => {
        for (let y = b.y0 + 1; y < b.y1; y++)
          chunk.setRaw(x - wx0, y, z - wz0, B.air!);
      });
    // лавовый бассейн 3×3 под порталом и рамки вокруг
    const lava = packWater(8, true);
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++)
        if (inChunk(c.x + dx, c.z + dz))
          chunk.setRaw(c.x + dx - wx0, c.y - 1, c.z + dz - wz0, B.lava!, lava);
    FRAME_RING.forEach(([dx, dz], i) => {
      if (inChunk(c.x + dx, c.z + dz))
        chunk.setRaw(
          c.x + dx - wx0,
          c.y,
          c.z + dz - wz0,
          B.rim_frame!,
          c.eyes[i] ? TOP : 0,
        );
    });
  }
}

export function citadelAt(
  citadels: readonly Citadel[],
  x: number,
  y: number,
  z: number,
): boolean {
  return citadels.some((c) =>
    c.parts.some(
      (b) =>
        x >= b.x0 &&
        x <= b.x1 &&
        y >= b.y0 &&
        y <= b.y1 &&
        z >= b.z0 &&
        z <= b.z1,
    ),
  );
}

export function nearestCitadel(
  citadels: readonly Citadel[],
  x: number,
  z: number,
): Citadel | null {
  let best: Citadel | null = null;
  let bestD = Infinity;
  for (const c of citadels) {
    const d = (c.x - x) ** 2 + (c.z - z) ** 2;
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}
