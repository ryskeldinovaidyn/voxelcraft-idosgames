// Породы дерева (сейв v3), как в Minecraft: у каждой — доски, бревно, листва, саженец и строительные
// формы (ступени, плита, забор, калитка, дверь, люк). Дуб, ель, берёза и тёмные доски были раньше
// (blocks/legacy, blocks/building) — их блоки не повторяются, дописывается только недостающее.
// Одна таблица WOOD_SPECIES кормит блоки, тайлы (gfx/painters/wood.ts), рецепты (recipes/wood.ts),
// теги (tags.ts) и рост саженцев (world/behaviours/saplings.ts).
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { all, block, pillar } from "./define";

export interface WoodSpecies {
  /** Порода: oak, spruce… — префикс имён форм (spruce_stairs). */
  id: string;
  planks: string;
  log: string;
  leaves: string;
  sapling: string;
  /** Что уже есть в реестре — не создаётся заново (planks — у дуба и тёмного дуба). */
  has: { planks?: boolean; log?: boolean; leaves?: boolean; forms?: boolean };
  /** Цвета тайлов: доски и их швы, кора, срез бревна, листва. */
  colors: {
    planks: string;
    seam: string;
    bark: string;
    core: string;
    leaf: string;
  };
  /** Прилагательное породы: м., ж., ср. род, мн. число; родительный падеж для саженца. */
  adj: [string, string, string, string];
  of: string;
  /** Шанс саженца из листвы (у джунглей меньше, как в Minecraft). */
  saplingChance: number;
  /**
   * Волна, в которой порода добавлена позже (1 — вишня, 2 — мангр): блоки волны — отдельной частью реестра
   * (lateWoodBlocks), тайлы — отдельным списком атласа (LATE_TILES), обе — в конце на момент добавления:
   * id и тайлы только дописываются. Рецепты, теги, саженцы и лодки — как у всех.
   */
  late?: number;
}

export const WOOD_SPECIES: WoodSpecies[] = [
  {
    id: "oak",
    planks: "planks",
    log: "oak_log",
    leaves: "leaves",
    sapling: "oak_sapling",
    has: { planks: true, log: true, leaves: true, forms: true },
    colors: {
      planks: "#a4824c",
      seam: "#6e5631",
      bark: "#6b5030",
      core: "#b8945f",
      leaf: "#3e7a25",
    },
    adj: ["Дубовый", "Дубовая", "Дубовое", "Дубовые"],
    of: "дуба",
    saplingChance: 0.05,
  },
  {
    id: "spruce",
    planks: "spruce_planks",
    log: "spruce_log",
    leaves: "spruce_leaves",
    sapling: "spruce_sapling",
    has: { log: true, leaves: true },
    colors: {
      planks: "#735433",
      seam: "#4e3a22",
      bark: "#4a3520",
      core: "#8a6a42",
      leaf: "#2d5a3a",
    },
    adj: ["Еловый", "Еловая", "Еловое", "Еловые"],
    of: "ели",
    saplingChance: 0.05,
  },
  {
    id: "birch",
    planks: "birch_planks",
    log: "birch_log",
    leaves: "birch_leaves",
    sapling: "birch_sapling",
    has: { log: true, leaves: true },
    colors: {
      planks: "#c5b47b",
      seam: "#978755",
      bark: "#d7d2c4",
      core: "#c9b27a",
      leaf: "#5c8f3a",
    },
    adj: ["Берёзовый", "Берёзовая", "Берёзовое", "Берёзовые"],
    of: "берёзы",
    saplingChance: 0.05,
  },
  {
    id: "jungle",
    planks: "jungle_planks",
    log: "jungle_log",
    leaves: "jungle_leaves",
    sapling: "jungle_sapling",
    has: {},
    colors: {
      planks: "#a0724a",
      seam: "#6e4c2f",
      bark: "#574417",
      core: "#a8784e",
      leaf: "#3b8a1e",
    },
    adj: ["Тропический", "Тропическая", "Тропическое", "Тропические"],
    of: "тропического дерева",
    saplingChance: 0.025,
  },
  {
    id: "acacia",
    planks: "acacia_planks",
    log: "acacia_log",
    leaves: "acacia_leaves",
    sapling: "acacia_sapling",
    has: {},
    colors: {
      planks: "#ad5d32",
      seam: "#7a4021",
      bark: "#676157",
      core: "#b06a3c",
      leaf: "#5a8a2a",
    },
    adj: ["Акациевый", "Акациевая", "Акациевое", "Акациевые"],
    of: "акации",
    saplingChance: 0.05,
  },
  {
    id: "dark_oak",
    planks: "dark_planks",
    log: "dark_oak_log",
    leaves: "dark_oak_leaves",
    sapling: "dark_oak_sapling",
    has: { planks: true },
    colors: {
      planks: "#5a3d22",
      seam: "#3a2714",
      bark: "#3c2a17",
      core: "#4f3218",
      leaf: "#2c5a1a",
    },
    adj: ["Темнодубовый", "Темнодубовая", "Темнодубовое", "Темнодубовые"],
    of: "тёмного дуба",
    saplingChance: 0.05,
  },
  {
    id: "cherry",
    planks: "cherry_planks",
    log: "cherry_log",
    leaves: "cherry_leaves",
    sapling: "cherry_sapling",
    has: {},
    late: 1,
    colors: {
      planks: "#e6b8b0",
      seam: "#b08078",
      bark: "#3a2230",
      core: "#d8a8a0",
      leaf: "#f0a8c8",
    },
    adj: ["Вишнёвый", "Вишнёвая", "Вишнёвое", "Вишнёвые"],
    of: "вишни",
    saplingChance: 0.05,
  },
  {
    id: "mangrove",
    planks: "mangrove_planks",
    log: "mangrove_log",
    leaves: "mangrove_leaves",
    sapling: "mangrove_propagule",
    has: {},
    late: 2,
    colors: {
      planks: "#7a3a32",
      seam: "#4e2420",
      bark: "#4a3a2a",
      core: "#7a3a32",
      leaf: "#5a8a2a",
    },
    adj: ["Мангровый", "Мангровая", "Мангровое", "Мангровые"],
    of: "мангра",
    saplingChance: 0.05,
  },
];

/** Имена форм породы (у дуба — oak_*: они в blocks/building). */
export const woodForm = (s: WoodSpecies, form: string): string =>
  `${s.id}_${form}`;
export const WOOD_FORMS = [
  "stairs",
  "slab",
  "fence",
  "fence_gate",
  "door",
  "trapdoor",
] as const;

const WOOD = {
  hardness: 2,
  resistance: 3,
  tool: "axe",
  flammable: true,
} as const;
const hex = (c: string): number => parseInt(c.slice(1), 16);

function speciesBlocks(s: WoodSpecies): BlockDef[] {
  const out: BlockDef[] = [];
  const map = hex(s.colors.planks);
  const t = (k: string) => `${s.id}_${k}`;
  if (!s.has.planks)
    out.push(
      block({ name: s.planks, ...WOOD, tex: all(s.planks), mapColor: map }),
    );
  if (!s.has.log)
    out.push(
      block({
        name: s.log,
        hardness: 2,
        tool: "axe",
        flammable: true,
        axis: true,
        tex: pillar(t("log_top"), t("log_side")),
        mapColor: hex(s.colors.bark),
      }),
    );
  if (!s.has.leaves)
    out.push(
      block({
        name: s.leaves,
        opaque: false,
        filter: 1,
        hardness: 0.2,
        flammable: true,
        drops: [
          { item: s.sapling, n: 1, chance: s.saplingChance },
          { item: "stick", n: 1, chance: 0.02 },
        ],
        tex: all(s.leaves),
        mapColor: hex(s.colors.leaf),
      }),
    );
  out.push(
    block({
      name: s.sapling,
      shape: "cross",
      solid: false,
      opaque: false,
      hardness: 0,
      tex: all(s.sapling),
      mapColor: hex(s.colors.leaf),
    }),
  );
  if (!s.has.forms) {
    const P = { ...WOOD, tex: all(s.planks), mapColor: map };
    out.push(
      block({ name: woodForm(s, "stairs"), shape: "stairs", ...P }),
      block({ name: woodForm(s, "slab"), shape: "slab", ...P }),
      block({ name: woodForm(s, "fence"), shape: "fence", ...P }),
      block({ name: woodForm(s, "fence_gate"), shape: "fence_gate", ...P }),
      block({
        name: woodForm(s, "door"),
        shape: "door",
        ...WOOD,
        hardness: 3,
        mapColor: map,
        tex: {
          side: t("door_bottom"),
          upper: t("door_top"),
          icon: t("door_item"),
        },
      }),
      block({
        name: woodForm(s, "trapdoor"),
        shape: "trapdoor",
        ...WOOD,
        hardness: 3,
        mapColor: map,
        tex: all(t("trapdoor")),
      }),
    );
  }
  return out;
}

export const WOOD_BLOCKS: BlockDef[] = WOOD_SPECIES.filter(
  (s) => !s.late,
).flatMap(speciesBlocks);
/** Блоки поздних пород волны wave — отдельная часть реестра (registry/Blocks.ts). */
export const lateWoodBlocks = (wave: number): BlockDef[] =>
  WOOD_SPECIES.filter((s) => s.late === wave).flatMap(speciesBlocks);
/** Волна 1 — вишня. */
export const LATE_WOOD_BLOCKS: BlockDef[] = lateWoodBlocks(1);

// названия: «Еловые доски», «Саженец ели», «Еловая дверь»…
for (const s of WOOD_SPECIES) {
  const [m, f, n, pl] = s.adj;
  const names: Record<string, string> = { [s.sapling]: `Саженец ${s.of}` };
  if (!s.has.planks) names[s.planks] = `${pl} доски`;
  if (!s.has.log) names[s.log] = `${n} бревно`;
  if (!s.has.leaves) names[s.leaves] = `${f} листва`;
  if (!s.has.forms)
    Object.assign(names, {
      [woodForm(s, "stairs")]: `${pl} ступени`,
      [woodForm(s, "slab")]: `${f} плита`,
      [woodForm(s, "fence")]: `${m} забор`,
      [woodForm(s, "fence_gate")]: `${f} калитка`,
      [woodForm(s, "door")]: `${f} дверь`,
      [woodForm(s, "trapdoor")]: `${m} люк`,
    });
  addNames(names);
}
