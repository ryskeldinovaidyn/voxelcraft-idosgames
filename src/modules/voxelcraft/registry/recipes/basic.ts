// Рецепты, что были до сейва v3: доски, палки, верстак, деревянные инструменты. Доски — тегом
// "#planks": как в Minecraft, годятся любые (и вперемешку).
import type { Recipe } from "../../types";
import { TRIM_BASE, templateOf } from "../items/trims";
import { TIPPED_ARROWS } from "../../systems/TippedArrow";

export const BASIC_RECIPES: Recipe[] = [
  { shapeless: ["oak_log"], result: { item: "planks", count: 4 } },
  { pattern: [["#planks"], ["#planks"]], result: { item: "stick", count: 4 } },
  {
    pattern: [
      ["#planks", "#planks"],
      ["#planks", "#planks"],
    ],
    result: { item: "crafting_table", count: 1 },
  },
  {
    pattern: [
      ["#planks", "#planks", "#planks"],
      [null, "stick", null],
      [null, "stick", null],
    ],
    result: { item: "wooden_pickaxe", count: 1 },
  },
  {
    pattern: [
      ["#planks", "#planks"],
      ["#planks", "stick"],
      [null, "stick"],
    ],
    result: { item: "wooden_axe", count: 1 },
  },
  {
    pattern: [["#planks"], ["#planks"], ["stick"]],
    result: { item: "wooden_sword", count: 1 },
  },
  // Первый меч можно собрать прямо в инвентаре 2×2. Старый рецепт на верстаке остаётся.
  { shapeless: ["#planks", "#planks", "stick"], result: { item: "wooden_sword", count: 1 } },

  // фермерство
  {
    pattern: [["wheat", "wheat", "wheat"]],
    result: { item: "bread", count: 1 },
  },
  {
    pattern: [
      ["wheat", "wheat", "wheat"],
      ["wheat", "wheat", "wheat"],
      ["wheat", "wheat", "wheat"],
    ],
    result: { item: "hay_block", count: 1 },
  },
  { shapeless: ["hay_block"], result: { item: "wheat", count: 9 } },
  { shapeless: ["bone"], result: { item: "bone_meal", count: 3 } },

  // Пекло
  {
    pattern: [
      ["glowstone_dust", "glowstone_dust"],
      ["glowstone_dust", "glowstone_dust"],
    ],
    result: { item: "glowstone", count: 1 },
  },
  {
    pattern: [
      ["inferno_brick", "inferno_brick"],
      ["inferno_brick", "inferno_brick"],
    ],
    result: { item: "inferno_bricks", count: 1 },
  },
  {
    pattern: [
      ["inferno_bricks", "inferno_brick", "inferno_bricks"],
      ["inferno_bricks", "inferno_brick", "inferno_bricks"],
    ],
    result: { item: "inferno_brick_fence", count: 6 },
  },
  {
    pattern: [
      ["inferno_bricks", null, null],
      ["inferno_bricks", "inferno_bricks", null],
      ["inferno_bricks", "inferno_bricks", "inferno_bricks"],
    ],
    result: { item: "inferno_brick_stairs", count: 4 },
  },
  { shapeless: ["flame_rod"], result: { item: "flame_powder", count: 2 } },
  {
    shapeless: ["rim_pearl", "flame_powder"],
    result: { item: "rim_eye", count: 1 },
  },

  // варка
  {
    pattern: [
      [null, "flame_rod", null],
      ["cobblestone", "cobblestone", "cobblestone"],
    ],
    result: { item: "brewing_stand", count: 1 },
  },
  {
    pattern: [
      ["glass", null, "glass"],
      [null, "glass", null],
    ],
    result: { item: "glass_bottle", count: 3 },
  },
  {
    pattern: [
      ["gold_nugget", "gold_nugget", "gold_nugget"],
      ["gold_nugget", "carrot", "gold_nugget"],
      ["gold_nugget", "gold_nugget", "gold_nugget"],
    ],
    result: { item: "golden_carrot", count: 1 },
  },

  // пеклит
  {
    shapeless: [
      "infernite_scrap",
      "infernite_scrap",
      "infernite_scrap",
      "infernite_scrap",
      "gold_ingot",
      "gold_ingot",
      "gold_ingot",
      "gold_ingot",
    ],
    result: { item: "infernite_ingot", count: 1 },
  },
  {
    pattern: [
      ["iron_ingot", "iron_ingot"],
      ["#planks", "#planks"],
      ["#planks", "#planks"],
    ],
    result: { item: "smithing_table", count: 1 },
  },

  // тростник, книги, тыква и арбуз
  { shapeless: ["sugar_cane"], result: { item: "sugar", count: 1 } },
  {
    pattern: [["sugar_cane", "sugar_cane", "sugar_cane"]],
    result: { item: "paper", count: 3 },
  },
  {
    shapeless: ["paper", "paper", "paper", "leather"],
    result: { item: "book", count: 1 },
  },
  {
    pattern: [
      ["#planks", "#planks", "#planks"],
      ["book", "book", "book"],
      ["#planks", "#planks", "#planks"],
    ],
    result: { item: "bookshelf", count: 1 },
  },
  {
    pattern: [
      ["melon_slice", "melon_slice", "melon_slice"],
      ["melon_slice", "melon_slice", "melon_slice"],
      ["melon_slice", "melon_slice", "melon_slice"],
    ],
    result: { item: "melon", count: 1 },
  },
  { shapeless: ["melon_slice"], result: { item: "melon_seeds", count: 1 } },
  { shapeless: ["pumpkin"], result: { item: "pumpkin_seeds", count: 4 } },
  {
    pattern: [
      ["gold_nugget", "gold_nugget", "gold_nugget"],
      ["gold_nugget", "melon_slice", "gold_nugget"],
      ["gold_nugget", "gold_nugget", "gold_nugget"],
    ],
    result: { item: "glistering_melon", count: 1 },
  },
  {
    pattern: [
      [null, "book", null],
      ["diamond", "obsidian", "diamond"],
      ["obsidian", "obsidian", "obsidian"],
    ],
    result: { item: "enchanting_table", count: 1 },
  },
  {
    pattern: [
      ["iron_block", "iron_block", "iron_block"],
      [null, "iron_ingot", null],
      ["iron_ingot", "iron_ingot", "iron_ingot"],
    ],
    result: { item: "anvil", count: 1 },
  },

  // красный камень
  {
    pattern: [["redstone"], ["stick"]],
    result: { item: "redstone_torch", count: 1 },
  },
  {
    pattern: [["stick"], ["cobblestone"]],
    result: { item: "lever", count: 1 },
  },
  { shapeless: ["stone"], result: { item: "stone_button", count: 1 } },
  {
    pattern: [["stone", "stone"]],
    result: { item: "stone_pressure_plate", count: 1 },
  },
  {
    pattern: [
      [null, "redstone", null],
      ["redstone", "glowstone", "redstone"],
      [null, "redstone", null],
    ],
    result: { item: "redstone_lamp", count: 1 },
  },
  {
    pattern: [
      ["redstone_torch", "redstone", "redstone_torch"],
      ["stone", "stone", "stone"],
    ],
    result: { item: "repeater", count: 1 },
  },
  {
    pattern: [
      ["#planks", "#planks", "#planks"],
      ["cobblestone", "iron_ingot", "cobblestone"],
      ["cobblestone", "redstone", "cobblestone"],
    ],
    result: { item: "piston", count: 1 },
  },
  {
    shapeless: ["slime_ball", "piston"],
    result: { item: "sticky_piston", count: 1 },
  },
  {
    pattern: [
      ["iron_ingot", null, "iron_ingot"],
      ["iron_ingot", "chest", "iron_ingot"],
      [null, "iron_ingot", null],
    ],
    result: { item: "hopper", count: 1 },
  },
  {
    pattern: [
      ["cobblestone", "cobblestone", "cobblestone"],
      ["cobblestone", null, "cobblestone"],
      ["cobblestone", "redstone", "cobblestone"],
    ],
    result: { item: "dropper", count: 1 },
  },
  {
    pattern: [
      ["cobblestone", "cobblestone", "cobblestone"],
      ["cobblestone", "bow", "cobblestone"],
      ["cobblestone", "redstone", "cobblestone"],
    ],
    result: { item: "dispenser", count: 1 },
  },
  {
    pattern: [
      [null, "redstone_torch", null],
      ["redstone_torch", "quartz", "redstone_torch"],
      ["stone", "stone", "stone"],
    ],
    result: { item: "comparator", count: 1 },
  },
  {
    pattern: [
      ["cobblestone", "cobblestone", "cobblestone"],
      ["redstone", "redstone", "quartz"],
      ["cobblestone", "cobblestone", "cobblestone"],
    ],
    result: { item: "observer", count: 1 },
  },
  // рельсы и вагонетка
  {
    pattern: [
      ["iron_ingot", null, "iron_ingot"],
      ["iron_ingot", "stick", "iron_ingot"],
      ["iron_ingot", null, "iron_ingot"],
    ],
    result: { item: "rail", count: 16 },
  },
  {
    pattern: [
      ["gold_ingot", null, "gold_ingot"],
      ["gold_ingot", "stick", "gold_ingot"],
      ["gold_ingot", "redstone", "gold_ingot"],
    ],
    result: { item: "powered_rail", count: 6 },
  },
  {
    pattern: [
      ["iron_ingot", null, "iron_ingot"],
      ["iron_ingot", "stone_pressure_plate", "iron_ingot"],
      ["iron_ingot", "redstone", "iron_ingot"],
    ],
    result: { item: "detector_rail", count: 6 },
  },
  {
    pattern: [
      ["iron_ingot", null, "iron_ingot"],
      ["iron_ingot", "iron_ingot", "iron_ingot"],
    ],
    result: { item: "minecart", count: 1 },
  },
  // вагонетки с грузом, активирующие рельсы, костёр
  {
    shapeless: ["minecart", "chest"],
    result: { item: "chest_minecart", count: 1 },
  },
  {
    shapeless: ["minecart", "hopper"],
    result: { item: "hopper_minecart", count: 1 },
  },
  {
    shapeless: ["minecart", "tnt"],
    result: { item: "tnt_minecart", count: 1 },
  },
  {
    pattern: [
      ["iron_ingot", "stick", "iron_ingot"],
      ["iron_ingot", "redstone_torch", "iron_ingot"],
      ["iron_ingot", "stick", "iron_ingot"],
    ],
    result: { item: "activator_rail", count: 6 },
  },
  {
    pattern: [
      [null, "stick", null],
      ["stick", "#coals", "stick"],
      ["#logs", "#logs", "#logs"],
    ],
    result: { item: "campfire", count: 1 },
  },
  // рыбалка и приборы
  {
    pattern: [
      [null, null, "stick"],
      [null, "stick", "string"],
      ["stick", null, "string"],
    ],
    result: { item: "fishing_rod", count: 1 },
  },
  {
    pattern: [
      [null, "iron_ingot", null],
      ["iron_ingot", "redstone", "iron_ingot"],
      [null, "iron_ingot", null],
    ],
    result: { item: "compass", count: 1 },
  },
  {
    pattern: [
      [null, "gold_ingot", null],
      ["gold_ingot", "redstone", "gold_ingot"],
      [null, "gold_ingot", null],
    ],
    result: { item: "clock", count: 1 },
  },
  {
    pattern: [
      ["paper", "paper", "paper"],
      ["paper", "compass", "paper"],
      ["paper", "paper", "paper"],
    ],
    result: { item: "map", count: 1 },
  },
  // улей: доски и соты
  {
    pattern: [
      ["#planks", "#planks", "#planks"],
      ["honeycomb", "honeycomb", "honeycomb"],
      ["#planks", "#planks", "#planks"],
    ],
    result: { item: "beehive", count: 1 },
  },
  // маяк: стекло, звезда Пекла, обсидиан
  {
    pattern: [
      ["glass", "glass", "glass"],
      ["glass", "inferno_star", "glass"],
      ["obsidian", "obsidian", "obsidian"],
    ],
    result: { item: "beacon", count: 1 },
  },
  // Предел: лиловые блоки из печёных плодов эхоцвета, кирпичи, стержень, панцирный сундук, ракета
  {
    pattern: [
      ["popped_echo_fruit", "popped_echo_fruit"],
      ["popped_echo_fruit", "popped_echo_fruit"],
    ],
    result: { item: "lilac_block", count: 4 },
  },
  {
    pattern: [["lilac_block"], ["lilac_block"]],
    result: { item: "lilac_pillar", count: 2 },
  },
  {
    pattern: [
      ["beyond_stone", "beyond_stone"],
      ["beyond_stone", "beyond_stone"],
    ],
    result: { item: "beyond_bricks", count: 4 },
  },
  {
    pattern: [["flame_rod"], ["popped_echo_fruit"]],
    result: { item: "beyond_rod", count: 4 },
  },
  {
    pattern: [["shell_plate"], ["chest"], ["shell_plate"]],
    result: { item: "shell_chest", count: 1 },
  },
  { shapeless: ["paper", "gunpowder"], result: { item: "rocket", count: 3 } },
  // океан: морской камень из осколков, фонарь из осколков и кристаллов, черепаший панцирь из щитков
  {
    pattern: [
      ["sea_shard", "sea_shard"],
      ["sea_shard", "sea_shard"],
    ],
    result: { item: "sea_stone", count: 1 },
  },
  {
    pattern: [
      ["sea_shard", "sea_shard", "sea_shard"],
      ["sea_shard", "sea_shard", "sea_shard"],
      ["sea_shard", "sea_shard", "sea_shard"],
    ],
    result: { item: "sea_bricks", count: 1 },
  },
  {
    pattern: [
      ["sea_shard", "sea_shard", "sea_shard"],
      ["sea_shard", "black_dye", "sea_shard"],
      ["sea_shard", "sea_shard", "sea_shard"],
    ],
    result: { item: "dark_sea_stone", count: 1 },
  },
  {
    pattern: [
      ["sea_shard", "sea_crystals", "sea_shard"],
      ["sea_crystals", "sea_crystals", "sea_crystals"],
      ["sea_shard", "sea_crystals", "sea_shard"],
    ],
    result: { item: "sea_lantern", count: 1 },
  },
  {
    pattern: [
      ["scute", "scute", "scute"],
      ["scute", null, "scute"],
    ],
    result: { item: "turtle_helmet", count: 1 },
  },
  // сушёная ламинария — в блок и обратно
  {
    pattern: [
      ["dried_kelp", "dried_kelp", "dried_kelp"],
      ["dried_kelp", "dried_kelp", "dried_kelp"],
      ["dried_kelp", "dried_kelp", "dried_kelp"],
    ],
    result: { item: "dried_kelp_block", count: 1 },
  },
  { shapeless: ["dried_kelp_block"], result: { item: "dried_kelp", count: 9 } },
  // мелочи для дома: фонарь (железо над факелом), фонарь душ (ещё песок душ снизу), цепь ×3, свеча, мешок
  {
    pattern: [["iron_ingot"], ["torch"]],
    result: { item: "lantern", count: 1 },
  },
  {
    pattern: [["iron_ingot"], ["torch"], ["soul_sand"]],
    result: { item: "soul_lantern", count: 1 },
  },
  {
    pattern: [["iron_ingot"], ["iron_ingot"], ["iron_ingot"]],
    result: { item: "chain", count: 3 },
  },
  {
    pattern: [["string"], ["honeycomb"]],
    result: { item: "candle", count: 1 },
  },
  { pattern: [["string"], ["leather"]], result: { item: "bundle", count: 1 } },
  // миска (доски галочкой → 4) и грибной суп
  {
    pattern: [
      ["#planks", null, "#planks"],
      [null, "#planks", null],
    ],
    result: { item: "bowl", count: 4 },
  },
  {
    shapeless: ["brown_mushroom", "red_mushroom", "bowl"],
    result: { item: "mushroom_stew", count: 1 },
  },
  // доски Пекла: из багрового и искажённого стеблей
  { shapeless: ["crimson_stem"], result: { item: "crimson_planks", count: 4 } },
  { shapeless: ["warped_stem"], result: { item: "warped_planks", count: 4 } },
  // печенье и факел душ (уголь над палкой над песком или почвой душ → 4)
  {
    pattern: [["wheat", "cocoa_beans", "wheat"]],
    result: { item: "cookie", count: 8 },
  },
  {
    pattern: [["#coals"], ["stick"], ["soul_sand"]],
    result: { item: "soul_torch", count: 4 },
  },
  {
    pattern: [["#coals"], ["stick"], ["soul_soil"]],
    result: { item: "soul_torch", count: 4 },
  },
  // табличка: шесть досок и палка (3 штуки)
  {
    pattern: [
      ["#planks", "#planks", "#planks"],
      ["#planks", "#planks", "#planks"],
      [null, "stick", null],
    ],
    result: { item: "sign", count: 3 },
  },
  // рамка для предметов: кожа в раме из палок
  {
    pattern: [
      ["stick", "stick", "stick"],
      ["stick", "leather", "stick"],
      ["stick", "stick", "stick"],
    ],
    result: { item: "display_stand", count: 1 },
  },
  // колокол (золото в железной обвязке на балке) и картина (шерсть в раме из палок)
  {
    pattern: [
      [null, "#planks", null],
      ["iron_ingot", "gold_ingot", "iron_ingot"],
      ["iron_ingot", "iron_ingot", "iron_ingot"],
    ],
    result: { item: "bell", count: 1 },
  },
  {
    pattern: [
      ["stick", "stick", "stick"],
      ["stick", "white_wool", "stick"],
      ["stick", "stick", "stick"],
    ],
    result: { item: "painting_sunset", count: 1 },
  },
  // звучащие блоки: проигрыватель (алмаз в досках) и нотный блок (красная пыль в досках)
  {
    pattern: [
      ["#planks", "#planks", "#planks"],
      ["#planks", "diamond", "#planks"],
      ["#planks", "#planks", "#planks"],
    ],
    result: { item: "jukebox", count: 1 },
  },
  {
    pattern: [
      ["#planks", "#planks", "#planks"],
      ["#planks", "redstone", "#planks"],
      ["#planks", "#planks", "#planks"],
    ],
    result: { item: "note_block", count: 1 },
  },
  // золотое яблоко: яблоко в кольце из восьми слитков золота (лечит зомби-жителя)
  {
    pattern: [
      ["gold_ingot", "gold_ingot", "gold_ingot"],
      ["gold_ingot", "apple", "gold_ingot"],
      ["gold_ingot", "gold_ingot", "gold_ingot"],
    ],
    result: { item: "golden_apple", count: 1 },
  },
  // станки жителей: точило, ткацкий станок, кафедра, стол фехтовальщика (systems/Jobs.ts)
  {
    pattern: [
      ["stick", "stone", "stick"],
      ["#planks", null, "#planks"],
    ],
    result: { item: "grindstone", count: 1 },
  },
  {
    pattern: [
      ["string", "string"],
      ["#planks", "#planks"],
    ],
    result: { item: "loom", count: 1 },
  },
  {
    pattern: [
      ["#planks", "#planks", "#planks"],
      [null, "bookshelf", null],
      [null, "#planks", null],
    ],
    result: { item: "lectern", count: 1 },
  },
  // книга с пером: книга, перо и чернила (пишут и подписывают на кафедре — systems/Book)
  {
    shapeless: ["book", "feather", "ink_sac"],
    result: { item: "writable_book", count: 1 },
  },
  // сундук Предела: обсидиан вокруг Ока Предела — общий склад игрока
  {
    pattern: [
      ["obsidian", "obsidian", "obsidian"],
      ["obsidian", "rim_eye", "obsidian"],
      ["obsidian", "obsidian", "obsidian"],
    ],
    result: { item: "ender_chest", count: 1 },
  },
  // строительные леса: шесть бамбуков и нить
  {
    pattern: [
      ["bamboo", "string", "bamboo"],
      ["bamboo", null, "bamboo"],
      ["bamboo", null, "bamboo"],
    ],
    result: { item: "scaffolding", count: 6 },
  },
  // отравленные стрелы: восемь стрел вокруг зелья — восемь стрел с этим эффектом
  ...Object.entries(TIPPED_ARROWS).map(([id, t]): Recipe => ({
    pattern: [
      ["arrow", "arrow", "arrow"],
      ["arrow", t.potion, "arrow"],
      ["arrow", "arrow", "arrow"],
    ],
    result: { item: id, count: 8 },
  })),
  // сброженный паучий глаз: портит зелья в противоположные (world/blockentities/brewing)
  {
    shapeless: ["spider_eye", "brown_mushroom", "sugar"],
    result: { item: "fermented_spider_eye", count: 1 },
  },
  // стойка для брони: шесть палок и каменная плита
  {
    pattern: [
      ["stick", "stick", "stick"],
      [null, "stick", null],
      ["stick", "stone_slab", "stick"],
    ],
    result: { item: "armor_stand", count: 1 },
  },
  // путевой камень: пеклитовый слиток в кольце каменных кирпичей
  {
    pattern: [
      ["stone_bricks", "stone_bricks", "stone_bricks"],
      ["stone_bricks", "infernite_ingot", "stone_bricks"],
      ["stone_bricks", "stone_bricks", "stone_bricks"],
    ],
    result: { item: "lodestone", count: 1 },
  },
  // якорь возрождения: светокамень между обсидианом
  {
    pattern: [
      ["obsidian", "obsidian", "obsidian"],
      ["glowstone", "glowstone", "glowstone"],
      ["obsidian", "obsidian", "obsidian"],
    ],
    result: { item: "respawn_anchor", count: 1 },
  },
  // мишень: сноп сена в кольце красной пыли
  {
    pattern: [
      [null, "redstone", null],
      ["redstone", "hay_block", "redstone"],
      [null, "redstone", null],
    ],
    result: { item: "target", count: 1 },
  },
  {
    pattern: [
      ["stick", "stick"],
      ["#planks", "#planks"],
    ],
    result: { item: "fletching_table", count: 1 },
  },
  // камнерез: железо над тремя камнями
  {
    pattern: [
      [null, "iron_ingot", null],
      ["stone", "stone", "stone"],
    ],
    result: { item: "stonecutter", count: 1 },
  },
  // рабочие блоки: бочка, коптильня, плавильная печь, компостер
  {
    pattern: [
      ["#planks", "oak_slab", "#planks"],
      ["#planks", null, "#planks"],
      ["#planks", "oak_slab", "#planks"],
    ],
    result: { item: "barrel", count: 1 },
  },
  {
    pattern: [
      [null, "#logs", null],
      ["#logs", "furnace", "#logs"],
      [null, "#logs", null],
    ],
    result: { item: "smoker", count: 1 },
  },
  {
    pattern: [
      ["iron_ingot", "iron_ingot", "iron_ingot"],
      ["iron_ingot", "furnace", "iron_ingot"],
      ["stone", "stone", "stone"],
    ],
    result: { item: "blast_furnace", count: 1 },
  },
  {
    pattern: [
      ["oak_slab", null, "oak_slab"],
      ["oak_slab", null, "oak_slab"],
      ["oak_slab", "oak_slab", "oak_slab"],
    ],
    result: { item: "composter", count: 1 },
  },
  // арбалет: палки, нить и железо (крючка-растяжки у нас нет — вместо него железо)
  {
    pattern: [
      ["stick", "iron_ingot", "stick"],
      ["string", "iron_ingot", "string"],
      [null, "stick", null],
    ],
    result: { item: "crossbow", count: 1 },
  },
  // щит: доски буквой Y с железом
  {
    pattern: [
      ["#planks", "iron_ingot", "#planks"],
      ["#planks", "#planks", "#planks"],
      [null, "#planks", null],
    ],
    result: { item: "shield", count: 1 },
  },
  // поводок: 4 нити и слизь → 2
  {
    pattern: [
      ["string", "string", null],
      ["string", "slime_ball", null],
      [null, null, "string"],
    ],
    result: { item: "lead", count: 2 },
  },
  // броня для волка: шесть щитков броненосца
  {
    pattern: [
      ["armadillo_scute", null, null],
      ["armadillo_scute", "armadillo_scute", "armadillo_scute"],
      ["armadillo_scute", null, "armadillo_scute"],
    ],
    result: { item: "wolf_armor", count: 1 },
  },
  // костёр душ: палки вокруг песка или почвы душ, брёвна снизу
  {
    pattern: [
      [null, "stick", null],
      ["stick", "soul_sand", "stick"],
      ["#logs", "#logs", "#logs"],
    ],
    result: { item: "soul_campfire", count: 1 },
  },
  {
    pattern: [
      [null, "stick", null],
      ["stick", "soul_soil", "stick"],
      ["#logs", "#logs", "#logs"],
    ],
    result: { item: "soul_campfire", count: 1 },
  },
  // полированный базальт и изделия из чернокамня
  {
    pattern: [
      ["basalt", "basalt"],
      ["basalt", "basalt"],
    ],
    result: { item: "polished_basalt", count: 4 },
  },
  {
    pattern: [
      ["blackstone", "blackstone"],
      ["blackstone", "blackstone"],
    ],
    result: { item: "polished_blackstone", count: 4 },
  },
  {
    pattern: [
      ["polished_blackstone", "polished_blackstone"],
      ["polished_blackstone", "polished_blackstone"],
    ],
    result: { item: "polished_blackstone_bricks", count: 4 },
  },
  {
    pattern: [
      ["blackstone", null, null],
      ["blackstone", "blackstone", null],
      ["blackstone", "blackstone", "blackstone"],
    ],
    result: { item: "blackstone_stairs", count: 4 },
  },
  {
    pattern: [["blackstone", "blackstone", "blackstone"]],
    result: { item: "blackstone_slab", count: 6 },
  },
  {
    pattern: [
      ["blackstone", "blackstone", "blackstone"],
      ["blackstone", "blackstone", "blackstone"],
    ],
    result: { item: "blackstone_wall", count: 6 },
  },
  // бамбук: 2 в столбик → палка
  { pattern: [["bamboo"], ["bamboo"]], result: { item: "stick", count: 1 } },
  // снег: 4 снежка → блок снега
  {
    pattern: [
      ["snowball", "snowball"],
      ["snowball", "snowball"],
    ],
    result: { item: "snow", count: 1 },
  },
  // отделка брони: шаблон размножается — 7 алмазов, шаблон и блок-основа узора → 2 шаблона
  ...Object.entries(TRIM_BASE).map(([p, base]): Recipe => ({
    pattern: [
      ["diamond", templateOf(p), "diamond"],
      ["diamond", base, "diamond"],
      ["diamond", "diamond", "diamond"],
    ],
    result: { item: templateOf(p), count: 2 },
  })),
  // медная лампа (медь вокруг огненного стержня, красная пыль снизу) ×4; медная решётка — 4 меди крестом ×4
  {
    pattern: [
      [null, "copper_block", null],
      ["copper_block", "flame_rod", "copper_block"],
      [null, "redstone", null],
    ],
    result: { item: "copper_bulb", count: 4 },
  },
  {
    pattern: [
      [null, "copper_block", null],
      ["copper_block", null, "copper_block"],
      [null, "copper_block", null],
    ],
    result: { item: "copper_grate", count: 4 },
  },
  // испытательные камеры: заряды ветра из стержня вихря, булава из тяжёлого ядра и стержня; туф и медь
  { shapeless: ["breeze_rod"], result: { item: "wind_charge", count: 4 } },
  {
    pattern: [["heavy_core"], ["breeze_rod"]],
    result: { item: "mace", count: 1 },
  },
  {
    pattern: [
      ["tuff", "tuff"],
      ["tuff", "tuff"],
    ],
    result: { item: "polished_tuff", count: 4 },
  },
  {
    pattern: [
      ["polished_tuff", "polished_tuff"],
      ["polished_tuff", "polished_tuff"],
    ],
    result: { item: "tuff_bricks", count: 4 },
  },
  {
    pattern: [
      ["copper_block", "copper_block"],
      ["copper_block", "copper_block"],
    ],
    result: { item: "cut_copper", count: 4 },
  },
  // древние цветы — красители: факелоцвет — оранжевый, кувшинное растение — бирюзовый ×2
  { shapeless: ["torchflower"], result: { item: "orange_dye", count: 1 } },
  { shapeless: ["pitcher_plant"], result: { item: "cyan_dye", count: 2 } },
  // грязь: утрамбованная (грязь + пшеница), грязевые кирпичи (4 утрамбованной → 4)
  { shapeless: ["mud", "wheat"], result: { item: "packed_mud", count: 1 } },
  {
    pattern: [
      ["packed_mud", "packed_mud"],
      ["packed_mud", "packed_mud"],
    ],
    result: { item: "mud_bricks", count: 4 },
  },
  // археология: кисть (перо, медь, палка); расписной горшок — из 4 любых черепков крестом
  {
    pattern: [["feather"], ["copper_ingot"], ["stick"]],
    result: { item: "brush", count: 1 },
  },
  {
    pattern: [
      [null, "#sherds", null],
      ["#sherds", null, "#sherds"],
      [null, "#sherds", null],
    ],
    result: { item: "decorated_pot", count: 1 },
  },
  // котёл из 7 железных слитков; капельниковый блок из 4 острых капельников
  {
    pattern: [
      ["iron_ingot", null, "iron_ingot"],
      ["iron_ingot", null, "iron_ingot"],
      ["iron_ingot", "iron_ingot", "iron_ingot"],
    ],
    result: { item: "cauldron", count: 1 },
  },
  {
    pattern: [
      ["pointed_dripstone", "pointed_dripstone"],
      ["pointed_dripstone", "pointed_dripstone"],
    ],
    result: { item: "dripstone_block", count: 1 },
  },
  // глубинный сланец: булыжный → полированный → кирпичи → плитка (по 4 → 4); компас возвращения
  {
    pattern: [
      ["cobbled_deepslate", "cobbled_deepslate"],
      ["cobbled_deepslate", "cobbled_deepslate"],
    ],
    result: { item: "polished_deepslate", count: 4 },
  },
  {
    pattern: [
      ["polished_deepslate", "polished_deepslate"],
      ["polished_deepslate", "polished_deepslate"],
    ],
    result: { item: "deepslate_bricks", count: 4 },
  },
  {
    pattern: [
      ["deepslate_bricks", "deepslate_bricks"],
      ["deepslate_bricks", "deepslate_bricks"],
    ],
    result: { item: "deepslate_tiles", count: 4 },
  },
  {
    pattern: [
      ["echo_shard", "echo_shard", "echo_shard"],
      ["echo_shard", "compass", "echo_shard"],
      ["echo_shard", "echo_shard", "echo_shard"],
    ],
    result: { item: "recovery_compass", count: 1 },
  },
  // аметист: блок из 4 осколков, тонированное стекло (стекло в 4 осколках → 2), подзорная труба
  {
    pattern: [
      ["amethyst_shard", "amethyst_shard"],
      ["amethyst_shard", "amethyst_shard"],
    ],
    result: { item: "amethyst_block", count: 1 },
  },
  {
    pattern: [
      [null, "amethyst_shard", null],
      ["amethyst_shard", "glass", "amethyst_shard"],
      [null, "amethyst_shard", null],
    ],
    result: { item: "tinted_glass", count: 2 },
  },
  {
    pattern: [["amethyst_shard"], ["copper_ingot"], ["copper_ingot"]],
    result: { item: "spyglass", count: 1 },
  },
  {
    pattern: [["moss_block", "moss_block"]],
    result: { item: "moss_carpet", count: 3 },
  },
  // стол картографа: 2 бумаги на 4 досках
  {
    pattern: [
      ["paper", "paper"],
      ["#planks", "#planks"],
      ["#planks", "#planks"],
    ],
    result: { item: "cartography_table", count: 1 },
  },
  // проводник: сердце моря в восьми раковинах наутилуса
  {
    pattern: [
      ["nautilus_shell", "nautilus_shell", "nautilus_shell"],
      ["nautilus_shell", "heart_of_the_sea", "nautilus_shell"],
      ["nautilus_shell", "nautilus_shell", "nautilus_shell"],
    ],
    result: { item: "conduit", count: 1 },
  },
  // 4 кроличьи шкурки → кожа
  {
    pattern: [
      ["rabbit_hide", "rabbit_hide"],
      ["rabbit_hide", "rabbit_hide"],
    ],
    result: { item: "leather", count: 1 },
  },
];
