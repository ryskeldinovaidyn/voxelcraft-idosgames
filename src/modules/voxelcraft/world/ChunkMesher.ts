// Мешер чанка: одна пересборка = три геометрии (твёрдая, растительность и формы, вода).
// Рендерятся только грани, видимые наружу: сосед-непрозрачный блок гасит грань,
// в том числе через границу чанков (незагруженный сосед считается непрозрачным —
// фронтир прячет туман, при загрузке соседа чанк пере-дертится).
// Блоки-не-кубы (ступени, факел, дверь…) — коробки своей формы (ShapeMesher) в cutout-проходе.
import * as THREE from "three";
import { CONFIG } from "../config";
import { BLOCKS, B, waterLevel } from "../registry/Blocks";
import { CENTERED_UV, faceTile, visualBoxes } from "../registry/shapes";
import { CHUNK_SIZE, idx, type Chunk } from "./Chunk";
import { FACES, GeoBuilder, type UVRect } from "./GeoBuilder";
import { meshBoxes } from "./ShapeMesher";
import type { TextureAtlas } from "../gfx/TextureAtlas";
import type { ChunkManager } from "./ChunkManager";
import type { BlockDef } from "../types";

/** Тайл посева по стадии роста (мета 0..7): у пшеницы 8 картинок, у остальных 4. */
function cropTile(def: BlockDef, meta: number): string {
  const age = meta & 7;
  return `${def.tex!.side!}_${def.name === "wheat" ? age : age >> 1}`;
}

const { SX, SY, SZ } = CHUNK_SIZE;

/**
 * Вершинное AO: у каждого угла грани — три соседа в слое перед гранью (две стороны и диагональ).
 * Выводится из той же таблицы FACES: касательные оси — все, кроме оси нормали, а знак смещения по
 * оси — сторона, на которой лежит угол (координата 0 → -1, 1 → +1).
 */
const FACE_AO = FACES.map((f) => {
  const axis = f.dir.findIndex((d) => d !== 0);
  const [u, v] = [0, 1, 2].filter((a) => a !== axis) as [number, number];
  return f.corners.map((c): [number[], number[], number[]] => {
    const su = c[u] === 1 ? 1 : -1;
    const sv = c[v] === 1 ? 1 : -1;
    const at = (du: number, dv: number): number[] =>
      f.dir.map((d, a) => d + (a === u ? du : a === v ? dv : 0));
    return [at(su, 0), at(0, sv), at(su, sv)];
  });
});

/** Яркость угла по числу затеняющих соседей: 0 — угол зажат с двух сторон, 3 — открыт. */
const AO_CURVE = [0.45, 0.63, 0.81, 1];

export class ChunkMesher {
  atlas: TextureAtlas;
  world: ChunkManager;
  _uvCache: Map<string, UVRect>;

  constructor(atlas: TextureAtlas, world: ChunkManager) {
    this.atlas = atlas;
    this.world = world; // ChunkManager: кросс-чанковые чтения на границах
    this._uvCache = new Map(); // tileName -> uvRect
  }

  _uv(tileName: string): UVRect {
    let r = this._uvCache.get(tileName);
    if (!r) {
      r = this.atlas.uv(tileName);
      this._uvCache.set(tileName, r);
    }
    return r;
  }

  /** Пересобирает и подменяет меши чанка. Старые геометрии всегда dispose(). */
  rebuild(chunk: Chunk, scene: THREE.Scene, waterOnly = false): void {
    const wx0 = chunk.cx * SX,
      wz0 = chunk.cz * SZ;
    const solid = waterOnly ? null : new GeoBuilder();
    const foliage = waterOnly ? null : new GeoBuilder();
    const water = new GeoBuilder();

    // Чтение блока с фолбэком в мир на границах. -1 = чанк не загружен.
    const blockAt = (x: number, y: number, z: number): number => {
      if (y < 0) return B.bedrock!; // ниже мира — «непрозрачно»
      if (y >= SY) return B.air!;
      if (x >= 0 && x < SX && z >= 0 && z < SZ)
        return chunk.blocks[idx(x, y, z)]!;
      return this.world.getBlockOrUnloaded(wx0 + x, y, wz0 + z);
    };
    const metaAt = (x: number, y: number, z: number): number => {
      if (x >= 0 && x < SX && z >= 0 && z < SZ && y >= 0 && y < SY)
        return chunk.meta[idx(x, y, z)]!;
      return this.world.getMeta(wx0 + x, y, wz0 + z);
    };
    const opaqueAt = (x: number, y: number, z: number): boolean => {
      const id = blockAt(x, y, z);
      return id === -1 || (BLOCKS[id]?.opaque ?? false);
    };
    // Для AO затеняют только загруженные непрозрачные блоки: незагруженный сосед (-1) дал бы тёмную
    // кайму по краю фронтира, которую уже никто не перестроит.
    const occludes = (x: number, y: number, z: number): number => {
      const id = blockAt(x, y, z);
      return id !== -1 && BLOCKS[id]?.opaque ? 1 : 0;
    };
    const useAO = CONFIG.graphics.ao;
    const ao = [1, 1, 1, 1];
    // свет клетки: (небо << 4) | блоки; вне чанка и вне высоты мира — через ChunkManager
    const lightAt = (x: number, y: number, z: number): number =>
      x >= 0 && x < SX && z >= 0 && z < SZ && y >= 0 && y < SY
        ? chunk.light[idx(x, y, z)]!
        : this.world.getLight(wx0 + x, y, wz0 + z);
    const lit = [0, 0, 0, 0, 0, 0, 0, 0]; // [небо, блоки] × 4 угла

    // пустое небо над верхним непустым слоем не обходим: с высотой 128 это половина чанка
    const yTop = Math.min(SY - 1, chunk.top);
    for (let y = 0; y <= yTop; y++) {
      for (let z = 0; z < SZ; z++) {
        for (let x = 0; x < SX; x++) {
          const id = chunk.blocks[idx(x, y, z)]!;
          if (id === B.air) continue;
          const def = BLOCKS[id]!;

          // растение в воде (waterlogged): клетка рисуется водой, поверх — крестик растения (ниже)
          if (def.waterlogged && B.water !== undefined)
            this._liquidCell(
              water,
              chunk,
              x,
              y,
              z,
              wx0,
              wz0,
              blockAt,
              metaAt,
              chunk.light[idx(x, y, z)]!,
              B.water,
              null,
            );

          if (def.liquid) {
            // вода — свой прозрачный проход с бегущей текстурой; лава — непрозрачная, в общем меше
            if (id === B.water)
              this._liquidCell(
                water,
                chunk,
                x,
                y,
                z,
                wx0,
                wz0,
                blockAt,
                metaAt,
                chunk.light[idx(x, y, z)]!,
                id,
                null,
              );
            else if (!waterOnly)
              this._liquidCell(
                solid!,
                chunk,
                x,
                y,
                z,
                wx0,
                wz0,
                blockAt,
                metaAt,
                chunk.light[idx(x, y, z)]!,
                id,
                this._uv(def.tex!.side!),
              );
            continue;
          }
          if (waterOnly) continue;
          const meta = chunk.meta[idx(x, y, z)]!;
          const own = chunk.light[idx(x, y, z)]!; // свет своей (прозрачной) клетки

          if (def.shape === "crop") {
            // посев: «решётка» из четырёх плоскостей, картинка по стадии роста
            const uv = this._uv(cropTile(def, meta));
            const b = foliage!;
            const q = (c: number[][]): void =>
              b.quad(c, x, y, z, 0, 1, 0, uv, 1.0, undefined, own);
            for (const k of [0.25, 0.75]) {
              q([
                [0, 1, k, 0, 1],
                [0, 0, k, 0, 0],
                [1, 1, k, 1, 1],
                [1, 0, k, 1, 0],
              ]);
              q([
                [k, 1, 0, 0, 1],
                [k, 0, 0, 0, 0],
                [k, 1, 1, 1, 1],
                [k, 0, 1, 1, 0],
              ]);
            }
            continue;
          }

          if (def.cross || def.shape === "fire") {
            // растение: два скрещённых квада по диагоналям
            const uv = this._uv(def.tex!.side!);
            const b = foliage!;
            const q = (c: number[][]): void =>
              b.quad(c, x, y, z, 0, 1, 0, uv, 1.0, undefined, own);
            q([
              [0.15, 1, 0.15, 0, 1],
              [0.15, 0, 0.15, 0, 0],
              [0.85, 1, 0.85, 1, 1],
              [0.85, 0, 0.85, 1, 0],
            ]);
            q([
              [0.85, 1, 0.15, 0, 1],
              [0.85, 0, 0.15, 0, 0],
              [0.15, 1, 0.85, 1, 1],
              [0.15, 0, 0.85, 1, 0],
            ]);
            continue;
          }

          if (def.shape !== "cube") {
            const cx = x,
              cy = y,
              cz = z;
            const ctx = {
              neighbor: (dx: number, dy: number, dz: number) =>
                blockAt(cx + dx, cy + dy, cz + dz),
            };
            meshBoxes(
              foliage!,
              visualBoxes(def, meta, ctx),
              x,
              y,
              z,
              (fi) => this._uv(faceTile(def, meta, fi)),
              opaqueAt,
              CENTERED_UV.has(def.shape),
              own,
            );
            continue;
          }

          const target = def.opaque ? solid! : foliage!; // листва — в cutout-проход
          for (let fi = 0; fi < FACES.length; fi++) {
            const f = FACES[fi]!;
            const nx = x + f.dir[0]!,
              ny = y + f.dir[1]!,
              nz = z + f.dir[2]!;
            if (opaqueAt(nx, ny, nz)) continue;
            if (!def.opaque && blockAt(nx, ny, nz) === id) continue; // листва к листве
            const fl = lightAt(nx, ny, nz); // клетка перед гранью
            if (useAO) {
              const table = FACE_AO[fi]!;
              for (let c = 0; c < 4; c++) {
                const [s1, s2, sc] = table[c]!;
                const a = occludes(x + s1[0]!, y + s1[1]!, z + s1[2]!);
                const b = occludes(x + s2[0]!, y + s2[1]!, z + s2[2]!);
                const k = occludes(x + sc[0]!, y + sc[1]!, z + sc[2]!);
                ao[c] = AO_CURVE[a && b ? 0 : 3 - a - b - k]!;
                // мягкий свет угла: среднее по клетке грани и её прозрачным соседям у этого угла
                let sky = fl >> 4,
                  blk = fl & 15,
                  n = 1;
                if (!a) {
                  const l = lightAt(x + s1[0]!, y + s1[1]!, z + s1[2]!);
                  sky += l >> 4;
                  blk += l & 15;
                  n++;
                }
                if (!b) {
                  const l = lightAt(x + s2[0]!, y + s2[1]!, z + s2[2]!);
                  sky += l >> 4;
                  blk += l & 15;
                  n++;
                }
                if (!k && !(a && b)) {
                  const l = lightAt(x + sc[0]!, y + sc[1]!, z + sc[2]!);
                  sky += l >> 4;
                  blk += l & 15;
                  n++;
                }
                lit[c * 2] = sky / n;
                lit[c * 2 + 1] = blk / n;
              }
            }
            target.quad(
              f.corners,
              x,
              y,
              z,
              f.dir[0]!,
              f.dir[1]!,
              f.dir[2]!,
              this._uv(faceTile(def, meta, fi)),
              f.shade,
              useAO ? ao : undefined,
              useAO ? lit : fl,
            );
          }
        }
      }
    }

    if (!waterOnly) {
      chunk.solidMesh = this._swap(
        chunk.solidMesh,
        solid!,
        this.atlas.opaqueMat,
        scene,
        wx0,
        wz0,
        0,
        true,
      );
      chunk.foliageMesh = this._swap(
        chunk.foliageMesh,
        foliage!,
        this.atlas.foliageMat,
        scene,
        wx0,
        wz0,
        0,
        true,
      );
      chunk.dirty = false;
    }
    chunk.waterMesh = this._swap(
      chunk.waterMesh,
      water,
      this.atlas.waterMat,
      scene,
      wx0,
      wz0,
      1,
      false, // вода тени принимает, но не отбрасывает
    );
    chunk.waterDirty = false;
  }

  /**
   * Клетка жидкости. uv = null — вода: мировые UV на repeat-текстуре (анимируется сдвигом);
   * иначе — тайл атласа (лава) с UV внутри клетки.
   */
  _liquidCell(
    b: GeoBuilder,
    chunk: Chunk,
    x: number,
    y: number,
    z: number,
    wx0: number,
    wz0: number,
    blockAt: (x: number, y: number, z: number) => number,
    metaAt: (x: number, y: number, z: number) => number,
    light: number, // свет клетки жидкости — на все её грани
    id: number,
    uv: UVRect | null,
  ): void {
    // та же жидкость (и растение в воде) — грань между ними не нужна
    const isWater = (n: number): boolean =>
      n === id || (id === B.water && !!BLOCKS[n]?.waterlogged);
    // высота поверхности клетки: полная, если сверху тоже вода; у растения в воде — источник
    // (его мета — не уровень воды)
    const heightOf = (cx: number, cz: number): number => {
      if (isWater(blockAt(cx, y + 1, cz))) return 1;
      const level = BLOCKS[blockAt(cx, y, cz)]?.waterlogged
        ? 8
        : waterLevel(metaAt(cx, y, cz));
      return 0.125 + (level / 8) * 0.75;
    };
    const above = blockAt(x, y + 1, z);
    const h = heightOf(x, z);
    // Высота УГЛА — средняя по клеткам этой жидкости, что в нём сходятся (как в Minecraft): у двух
    // соседей общий край на одной высоте, поверхность — плавный скат. С плоской плиткой на клетку
    // соседи разной высоты давали ступеньку, а боковой грани между водой и водой нет — в щель
    // было видно насквозь («разрывы» текущей воды и водопадов). Столб с водой сверху тянет угол
    // до полной высоты.
    const cornerH = (ox: number, oz: number): number => {
      let sum = 0,
        n = 0;
      for (const dx of [ox - 1, ox])
        for (const dz of [oz - 1, oz]) {
          const cx = x + dx,
            cz = z + dz;
          if (!isWater(blockAt(cx, y, cz))) continue;
          const ch = heightOf(cx, cz);
          if (ch >= 1) return 1;
          sum += ch;
          n++;
        }
      return n ? sum / n : h;
    };
    const top = [
      [cornerH(0, 0), cornerH(0, 1)],
      [cornerH(1, 0), cornerH(1, 1)],
    ] as const;
    const hAt = (cx: number, cz: number): number => top[cx]![cz]!;
    // вода — мировые UV (repeat-текстура тайлится сама); тайл атласа — UV в пределах клетки
    const wx = uv ? 0 : wx0 + x,
      wz = uv ? 0 : wz0 + z,
      vy = uv ? 0 : y;

    // верх: виден, если сверху не вода
    if (!isWater(above)) {
      b.quad(
        [
          [0, 1, 0, 1],
          [1, 1, 1, 1],
          [0, 0, 0, 0],
          [1, 0, 1, 0],
        ].map(([cx, cz, u, v]) => [cx!, hAt(cx!, cz!), cz!, wx + u!, wz + v!]),
        x,
        y,
        z,
        0,
        1,
        0,
        uv,
        1.0,
        undefined,
        light,
      );
    }
    // низ
    if (
      blockAt(x, y - 1, z) !== -1 &&
      !BLOCKS[blockAt(x, y - 1, z)]?.opaque &&
      !isWater(blockAt(x, y - 1, z))
    ) {
      b.quad(
        [
          [1, 0, 1, wx + 1, wz + 1],
          [0, 0, 1, wx, wz + 1],
          [1, 0, 0, wx + 1, wz],
          [0, 0, 0, wx, wz],
        ],
        x,
        y,
        z,
        0,
        -1,
        0,
        uv,
        0.6,
        undefined,
        light,
      );
    }
    // бока: против воздуха/прозрачного, но не против воды и не против непрозрачного
    const sides = [
      {
        d: [-1, 0, 0],
        c: [
          [0, 1, 0],
          [0, 0, 0],
          [0, 1, 1],
          [0, 0, 1],
        ],
      },
      {
        d: [1, 0, 0],
        c: [
          [1, 1, 1],
          [1, 0, 1],
          [1, 1, 0],
          [1, 0, 0],
        ],
      },
      {
        d: [0, 0, -1],
        c: [
          [1, 1, 0],
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 0],
        ],
      },
      {
        d: [0, 0, 1],
        c: [
          [0, 1, 1],
          [0, 0, 1],
          [1, 1, 1],
          [1, 0, 1],
        ],
      },
    ];
    for (const s of sides) {
      const nid = blockAt(x + s.d[0]!, y, z + s.d[2]!);
      if (nid === -1 || isWater(nid) || BLOCKS[nid]?.opaque) continue;
      const corners = s.c.map(([cx, cy, cz]) => {
        const uAxis = s.d[0] !== 0 ? wz + cz! : wx + cx!; // горизонтальная UV-ось
        const ch = cy === 1 ? hAt(cx!, cz!) : 0;
        return [cx!, ch, cz!, uAxis, vy + ch];
      });
      b.quad(corners, x, y, z, s.d[0]!, 0, s.d[2]!, uv, 0.8, undefined, light);
    }
  }

  /** Подмена меша: dispose старой геометрии, пустые геометрии не создают меш. */
  _swap(
    oldMesh: THREE.Mesh | null,
    builder: GeoBuilder,
    material: THREE.Material,
    scene: THREE.Scene,
    wx0: number,
    wz0: number,
    renderOrder: number,
    castShadow: boolean,
  ): THREE.Mesh | null {
    if (oldMesh) {
      scene.remove(oldMesh);
      oldMesh.geometry.dispose();
    }
    if (builder.empty) return null;
    const mesh = new THREE.Mesh(builder.build(), material);
    mesh.position.set(wx0, 0, wz0);
    mesh.renderOrder = renderOrder;
    mesh.castShadow = castShadow && CONFIG.graphics.shadows;
    mesh.receiveShadow = CONFIG.graphics.shadows;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    scene.add(mesh);
    return mesh;
  }
}
