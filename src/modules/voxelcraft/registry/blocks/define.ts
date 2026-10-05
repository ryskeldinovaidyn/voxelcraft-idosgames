// Конструктор описания блока: значения по умолчанию — полный непрозрачный куб. id раздаёт реестр
// (registry/Blocks.ts) по порядку частей; явный id в описании — только проверка, что он не съехал.
import type { BlockDef, BlockTex } from "../../types";

/** Описание блока: всё, кроме имени, необязательно. */
export type BlockInput = Partial<BlockDef> & { name: string };

export function block(def: BlockInput): BlockDef {
  const shape =
    def.shape ?? (def.cross ? "cross" : def.liquid ? "liquid" : "cube");
  const opaque = def.opaque ?? shape === "cube";
  const hardness = def.hardness ?? 1;
  return {
    id: -1,
    solid: true,
    tool: null,
    drops: null,
    onTick: null,
    tex: null,
    mapColor: 0x808080,
    light: 0,
    axis: false,
    harvest: 0,
    gravity: false,
    flammable: false,
    replaceable: false,
    blockEntity: null,
    noItem: false,
    item: null,
    ...def,
    shape,
    cross: shape === "cross",
    liquid: shape === "liquid",
    opaque,
    hardness,
    filter: def.filter ?? (opaque ? 15 : 0),
    // как в Minecraft: у большинства блоков стойкость к взрыву порядка твёрдости
    resistance:
      def.resistance ?? (Number.isFinite(hardness) ? hardness : 3_600_000),
  };
}

/** Одинаковый тайл на всех гранях. */
export const all = (tile: string): BlockTex => ({
  top: tile,
  side: tile,
  bottom: tile,
});

/** Бревно/колонна: торцы сверху и снизу, кора по бокам. */
export const pillar = (top: string, side: string): BlockTex => ({
  top,
  side,
  bottom: top,
});
