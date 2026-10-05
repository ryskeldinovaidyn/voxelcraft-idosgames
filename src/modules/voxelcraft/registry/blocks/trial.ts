// Испытательные камеры (Minecraft 1.21): туф и медь — стены и полы камер; спавнер испытаний (подойдёшь —
// выпускает волну мобов, победишь — награда и ключ испытаний; systems/TrialSpawner) и хранилище (ключом
// испытаний открывается один раз и выдаёт добычу; world/behaviours/trial).
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { all, block } from "./define";

/** Бит меты хранилища: уже открыто. */
export const VAULT_OPEN = 1;
/** Кого выпускает спавнер испытаний: мета блока → вид (генератор ставит мету по комнате). */
export const TRIAL_MOBS = ["zombie", "skeleton", "spider", "breeze"] as const;

const TUFF = {
  hardness: 1.5,
  resistance: 6,
  tool: "pickaxe" as const,
  harvest: 1,
  mapColor: 0x6a6a60,
};
const COPPER = {
  hardness: 3,
  resistance: 6,
  tool: "pickaxe" as const,
  harvest: 2,
  mapColor: 0xc06a4a,
};
const HEAVY = {
  opaque: false,
  hardness: 50,
  resistance: 50,
  tool: "pickaxe" as const,
  drops: [],
};

export const TRIAL_BLOCKS: BlockDef[] = [
  block({ name: "tuff", ...TUFF, tex: all("tuff") }),
  block({ name: "polished_tuff", ...TUFF, tex: all("polished_tuff") }),
  block({ name: "tuff_bricks", ...TUFF, tex: all("tuff_bricks") }),
  // медный блок уже есть среди блоков хранения (registry/blocks/ores)
  block({ name: "cut_copper", ...COPPER, tex: all("cut_copper") }),
  block({
    name: "trial_spawner",
    ...HEAVY,
    light: 4,
    blockEntity: "trial_spawner",
    tex: {
      top: "trial_spawner_top",
      side: "trial_spawner_side",
      bottom: "trial_spawner_top",
    },
    mapColor: 0x3a3a3e,
  }),
  block({
    name: "vault",
    ...HEAVY,
    light: 6,
    tex: { top: "vault_top", side: "vault_side", bottom: "vault_top" },
    mapColor: 0x3a3a3e,
  }),
];

addNames({
  tuff: "Туф",
  polished_tuff: "Полированный туф",
  tuff_bricks: "Туфовые кирпичи",
  copper_block: "Медный блок",
  cut_copper: "Резная медь",
  trial_spawner: "Спавнер испытаний",
  vault: "Хранилище",
  trial_chambers: "Испытательные камеры",
});
