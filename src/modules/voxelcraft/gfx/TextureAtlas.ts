// Процедурный texture atlas: все текстуры рисуются на canvas 512×512 (32×32 тайла
// по 16px), никаких внешних файлов. NearestFilter + отключённые мипмапы + полутексельный
// inset UV — честный пиксель-арт без bleeding. Сид PRNG тайла — его имя, а не место в атласе:
// поэтому рост сетки не перерисовывает старые тайлы.
import * as THREE from "three";
import { mulberry32, hashString } from "../core/Noise";
import { patchLightMaterial } from "./LightMaterial";
import {
  P,
  PAINTERS,
  TILE,
  noisy,
  oreBlobs,
  shade,
  type Painter,
  type PxFn,
  type RngFn,
} from "./paint";
import { MATERIAL_TILES } from "./painters/materials";
import { FUNCTIONAL_TILES } from "./painters/functional";
import { MOBDROP_TILES } from "./painters/mobdrops";
import { UTILITY_TILES } from "./painters/utility";
import { FARMING_TILES } from "./painters/farming";
import { INFERNO_TILES } from "./painters/inferno";
import { BEYOND_TILES } from "./painters/beyond";
import { BREWING_TILES } from "./painters/brewing";
import { REDSTONE_TILES } from "./painters/redstone";
import { LATE_TILES, LATE_WOOD_TILES, WOOD_TILES } from "./painters/wood";
import { COLOR_TILES } from "./painters/colors";
import { OUTDOOR_TILES } from "./painters/outdoor";
import { BOSS_TILES } from "./painters/boss";
import { CITY_TILES } from "./painters/city";
import { OCEAN_TILES } from "./painters/ocean";
import { CAMP_TILES } from "./painters/camp";
import { SEA_LIFE_TILES } from "./painters/sealife";
import { ILLAGER_TILES } from "./painters/illager";
import { TREASURE_TILES } from "./painters/treasure";
import { MANSION_TILES } from "./painters/mansion";
import { CAVE_TILES } from "./painters/caves";
import { SCULK_TILES } from "./painters/sculk";
import { DRIPSTONE_TILES } from "./painters/dripstone";
import { MOUNTAIN_TILES } from "./painters/mountain";
import { ARCHAEOLOGY_TILES } from "./painters/archaeology";
import { MANGROVE_TILES } from "./painters/mangrove";
import { SNIFFER_TILES } from "./painters/sniffer";
import { TRIAL_TILES } from "./painters/trial";
import { COPPER_TILES } from "./painters/copper";
import { DECOR_TILES } from "./painters/decor";
import { FROST_TILES } from "./painters/frost";
import { MUSHROOM_TILES } from "./painters/mushroom";
import { JUNGLE_TILES } from "./painters/jungle";
import { CRIMSON_TILES } from "./painters/crimson";
import { BASALT_TILES } from "./painters/basalt";
import { COCOA_TILES } from "./painters/cocoa";
import { CRAFTED_TILES } from "./painters/crafted";
import { SOUL_CAMP_TILES } from "./painters/soulcamp";
import { ARMADILLO_TILES } from "./painters/armadillo";
import { LEAD_TILES } from "./painters/lead";
import { SHIELD_TILES } from "./painters/shield";
import { RANGED_TILES } from "./painters/ranged";
import { WORKSTATION_TILES } from "./painters/workstations";
import { STONECUTTER_TILES } from "./painters/stonecutter";
import { JOB_TILES } from "./painters/jobblocks";
import { CURE_TILES } from "./painters/cure";
import { SOUND_TILES } from "./painters/sound";
import { HALL_TILES } from "./painters/hall";
import { DISPLAY_TILES } from "./painters/display";
import { SIGN_TILES } from "./painters/sign";
import { BANNER_TILES } from "./painters/banner";
import { BOOK_TILES } from "./painters/book";
import { EXTRA_TILES } from "./painters/extras";
import { STAND_TILES } from "./painters/stand";
import { POTION_TILES } from "./painters/potions";
import { TIPPED_TILES } from "./painters/tipped";
import { NAMETAG_TILES } from "./painters/nametag";

const GRID = 32; // тайлов в ряду (до 1024 тайлов)
const SIZE = TILE * GRID;

// ---- painter-функции: (px, rng) → рисуют один тайл 16×16 ---------------------
// px(x, y, cssColor) закрашивает один пиксель тайла.

const painters: Record<string, Painter> = {
  grass_top(px, rng) {
    noisy(px, "#5fa63c", 0.1, rng);
  },
  dirt(px, rng) {
    noisy(px, "#79553a", 0.12, rng);
  },
  grass_side(px, rng) {
    noisy(px, "#79553a", 0.12, rng);
    for (let x = 0; x < TILE; x++) {
      const depth = 3 + ((rng() * 2) | 0); // рваная кромка дёрна
      for (let y = 0; y < depth; y++)
        px(x, y, shade("#5fa63c", (rng() - 0.5) * 0.2));
    }
  },
  stone(px, rng) {
    noisy(px, "#7d7d7d", 0.08, rng);
    for (let i = 0; i < 5; i++) {
      // светлые/тёмные пятна
      const x = (rng() * TILE) | 0,
        y = (rng() * TILE) | 0,
        c = shade("#7d7d7d", rng() < 0.5 ? -0.15 : 0.12);
      px(x, y, c);
      px((x + 1) & 15, y, c);
    }
  },
  cobblestone(px, rng) {
    noisy(px, "#828282", 0.1, rng);
    // «булыжники»: тёмная сетка неровных швов
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const cell = (x + (y & 4 ? 3 : 0)) % 6 === 0 || y % 6 === 0;
        if (cell && rng() < 0.8)
          px(x, y, shade("#4a4a4a", (rng() - 0.5) * 0.2));
      }
  },
  bedrock(px, rng) {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++)
        px(
          x,
          y,
          shade(rng() < 0.5 ? "#2b2b2b" : "#565656", (rng() - 0.5) * 0.3),
        );
  },
  sand(px, rng) {
    noisy(px, "#dcd3a0", 0.08, rng);
  },
  oak_log_side(px, rng) {
    for (let x = 0; x < TILE; x++) {
      const stripe = x % 4 === 3 ? -0.25 : (rng() - 0.5) * 0.15; // кора полосами
      for (let y = 0; y < TILE; y++)
        px(x, y, shade("#6b5030", stripe + (rng() - 0.5) * 0.08));
    }
  },
  oak_log_top(px, rng) {
    noisy(px, "#6b5030", 0.1, rng);
    for (let y = 2; y < 14; y++)
      for (let x = 2; x < 14; x++)
        px(x, y, shade("#b8945f", (rng() - 0.5) * 0.15));
    // годовые кольца
    for (const r of [2, 4]) {
      for (let a = 0; a < 64; a++) {
        const x = 8 + Math.round(Math.cos((a / 64) * Math.PI * 2) * r);
        const y = 8 + Math.round(Math.sin((a / 64) * Math.PI * 2) * r);
        px(x, y, "#8a6d42");
      }
    }
  },
  planks(px, rng) {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        let c = shade("#a4824c", (rng() - 0.5) * 0.12);
        if (y % 4 === 3) c = "#6e5631"; // горизонтальные швы досок
        if (
          (y < 4 && x === 11) ||
          (y >= 4 && y < 8 && x === 3) ||
          (y >= 8 && y < 12 && x === 13) ||
          (y >= 12 && x === 6)
        )
          c = "#6e5631"; // стыки
        px(x, y, c);
      }
  },
  leaves(px, rng) {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        if (rng() < 0.18) continue; // прозрачные «дырки» (alphaTest-вырезы)
        px(x, y, shade("#3e7a25", (rng() - 0.5) * 0.35));
      }
  },
  water(px, rng) {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        let c = shade("#3057d8", (rng() - 0.5) * 0.12);
        if ((x + y * 2) % 8 === 0 && rng() < 0.5) c = shade("#4a74ea", 0.1); // блики
        px(x, y, c);
      }
  },
  coal_ore(px, rng) {
    painters.stone!(px, rng);
    oreBlobs(px, rng, "#2e2e2e");
  },
  iron_ore(px, rng) {
    painters.stone!(px, rng);
    oreBlobs(px, rng, "#d8af93");
  },
  crafting_table_top(px, rng) {
    painters.planks!(px, rng);
    for (let i = 0; i < TILE; i++) {
      px(i, 0, "#59431f");
      px(i, 15, "#59431f");
      px(0, i, "#59431f");
      px(15, i, "#59431f");
    }
    for (let y = 3; y < 13; y++)
      for (let x = 3; x < 13; x++)
        if (x === 3 || x === 12 || y === 3 || y === 12) px(x, y, "#7d6134");
  },
  crafting_table_side(px, rng) {
    painters.planks!(px, rng);
    // «инструменты» на боковине: тёмные силуэты
    for (let y = 2; y < 7; y++)
      for (let x = 3; x < 6; x++) if (rng() < 0.8) px(x, y, "#4d3a1c");
    for (let y = 2; y < 7; y++)
      for (let x = 10; x < 13; x++) if (rng() < 0.8) px(x, y, "#57422a");
  },
};

// ---- тайлы блоков генератора миров ---------------------------------------------
// Отдельные функции, а не правка существующих painter'ов: у каждого тайла свой сид PRNG, и
// общий код менял бы порядок случайных чисел — старые тайлы перерисовались бы иначе.

/** Кора бревна вертикальными полосами. */
function logSidePainter(bark: string, stripe: string): Painter {
  return (px, rng) => {
    for (let x = 0; x < TILE; x++) {
      const dark = x % 4 === 3;
      for (let y = 0; y < TILE; y++)
        px(x, y, dark ? stripe : shade(bark, (rng() - 0.5) * 0.14));
    }
  };
}

/** Спил бревна: кора по краю, светлая древесина и годовые кольца. */
function logTopPainter(bark: string, wood: string, ring: string): Painter {
  return (px, rng) => {
    noisy(px, bark, 0.1, rng);
    for (let y = 2; y < 14; y++)
      for (let x = 2; x < 14; x++) px(x, y, shade(wood, (rng() - 0.5) * 0.14));
    for (const r of [2, 4]) {
      for (let a = 0; a < 64; a++) {
        const x = 8 + Math.round(Math.cos((a / 64) * Math.PI * 2) * r);
        const y = 8 + Math.round(Math.sin((a / 64) * Math.PI * 2) * r);
        px(x, y, ring);
      }
    }
  };
}

/** Листва с прозрачными «дырками» (alphaTest-вырезы). */
function leavesPainter(color: string, holes: number): Painter {
  return (px, rng) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        if (rng() < holes) continue;
        px(x, y, shade(color, (rng() - 0.5) * 0.35));
      }
  };
}

/** Шерсть: ровный цвет с лёгким «плетением». */
function woolPainter(color: string): Painter {
  return (px, rng) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const weave = (x + y) % 4 === 0 ? -0.07 : 0;
        px(x, y, shade(color, weave + (rng() - 0.5) * 0.08));
      }
  };
}

Object.assign(painters, {
  snow(px: PxFn, rng: RngFn) {
    noisy(px, "#eef3f8", 0.04, rng);
    for (let i = 0; i < 6; i++)
      px((rng() * TILE) | 0, (rng() * TILE) | 0, "#ffffff");
  },
  ice(px: PxFn, rng: RngFn) {
    noisy(px, "#9cc7f0", 0.05, rng);
    // светлые трещины-блики по диагонали
    for (let i = 0; i < 3; i++) {
      let x = (rng() * TILE) | 0,
        y = (rng() * TILE) | 0;
      for (let k = 0; k < 6; k++) {
        px(x & 15, y & 15, "#d6ecff");
        x += 1;
        y += rng() < 0.5 ? 1 : 0;
      }
    }
  },
  gravel(px: PxFn, rng: RngFn) {
    const tones = ["#857f7a", "#6e6863", "#9d9690", "#5b5550"];
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++)
        px(
          x,
          y,
          shade(tones[(rng() * tones.length) | 0]!, (rng() - 0.5) * 0.1),
        );
  },
  clay(px: PxFn, rng: RngFn) {
    noisy(px, "#9ea4b0", 0.06, rng);
  },
  sandstone_top(px: PxFn, rng: RngFn) {
    noisy(px, "#d9c98f", 0.05, rng);
  },
  sandstone_side(px: PxFn, rng: RngFn) {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const base = y < 3 ? "#e3d49c" : y >= 12 ? "#c4b27a" : "#d9c98f";
        px(x, y, y === 3 ? "#b9a66f" : shade(base, (rng() - 0.5) * 0.08));
      }
  },
  red_sand(px: PxFn, rng: RngFn) {
    noisy(px, "#c2703a", 0.08, rng);
  },
  terracotta(px: PxFn, rng: RngFn) {
    noisy(px, "#a05a3c", 0.05, rng);
  },
  stone_bricks(px: PxFn, rng: RngFn) {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const joint = y % 8 === 7 || x === (y < 8 ? 7 : 15);
        px(x, y, joint ? "#555555" : shade("#7a7a7a", (rng() - 0.5) * 0.14));
      }
  },
  mossy_cobblestone(px: PxFn, rng: RngFn) {
    painters.cobblestone!(px, rng);
    for (let i = 0; i < 7; i++) {
      const cx = (rng() * TILE) | 0,
        cy = (rng() * TILE) | 0;
      for (let d = 0; d < 4; d++)
        px(
          (cx + ((rng() * 3) | 0) - 1) & 15,
          (cy + ((rng() * 3) | 0) - 1) & 15,
          shade("#5a7a3a", (rng() - 0.5) * 0.2),
        );
    }
  },
  bricks(px: PxFn, rng: RngFn) {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const row = y >> 2;
        const offset = row % 2 ? 4 : 0;
        const mortar = y % 4 === 3 || (x + offset) % 8 === 7;
        px(x, y, mortar ? "#c9bfb3" : shade("#9a4a3a", (rng() - 0.5) * 0.16));
      }
  },
  glass(px: PxFn, _rng: RngFn) {
    for (let i = 0; i < TILE; i++) {
      px(i, 0, "#dff2f7");
      px(i, 15, "#dff2f7");
      px(0, i, "#dff2f7");
      px(15, i, "#dff2f7");
    }
    for (let x = 3; x < 9; x++) px(x, x - 1, "#f4fbfd"); // блик
    for (let x = 4; x < 8; x++) px(x + 1, x - 1, "#f4fbfd");
  },
  spruce_log_side: logSidePainter("#4a3520", "#33241a"),
  spruce_log_top: logTopPainter("#4a3520", "#8a6a42", "#6e5232"),
  spruce_leaves: leavesPainter("#2d5a3a", 0.14),
  birch_log_side(px: PxFn, rng: RngFn) {
    noisy(px, "#d7d2c4", 0.05, rng);
    for (let i = 0; i < 9; i++) {
      const x = (rng() * 14) | 0,
        y = (rng() * TILE) | 0;
      px(x, y, "#3a3a3a");
      px(x + 1, y, "#3a3a3a");
    }
  },
  birch_log_top: logTopPainter("#d7d2c4", "#c9b27a", "#a88f5a"),
  birch_leaves: leavesPainter("#5c8f3a", 0.18),
  dark_planks(px: PxFn, rng: RngFn) {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const seam =
          y % 4 === 3 ||
          (y < 4 && x === 5) ||
          (y >= 4 && y < 8 && x === 12) ||
          (y >= 8 && y < 12 && x === 2) ||
          (y >= 12 && x === 9);
        px(x, y, seam ? "#3a2714" : shade("#5a3d22", (rng() - 0.5) * 0.12));
      }
  },
  dirt_path_top(px: PxFn, rng: RngFn) {
    noisy(px, "#9a7a45", 0.1, rng);
  },
  white_wool: woolPainter("#e9ecec"),
  red_wool: woolPainter("#a12722"),
  orange_wool: woolPainter("#f07613"),
  yellow_wool: woolPainter("#f8c527"),
  green_wool: woolPainter("#5e7c16"),
  blue_wool: woolPainter("#35399d"),
  light_blue_wool: woolPainter("#3aafd9"),
  purple_wool: woolPainter("#7a2aa9"),
  pink_wool: woolPainter("#ed8dac"),
  brown_wool: woolPainter("#724728"),
  gray_wool: woolPainter("#3e4447"),
  black_wool: woolPainter("#1d1d21"),
} satisfies Record<string, Painter>);

// ---- пиксель-арт по строковым шаблонам (растения, предметы, инструменты) — P из ./paint -----

painters.tallgrass = P(
  [
    "................",
    "................",
    "....g......g....",
    "..g.g...g..g.g..",
    "..g.g..gg..g.g..",
    "..gg.g.g.g.gg...",
    "...g.g.g.g.g....",
    "...g.gg.gg.g....",
    "....gg.g.gg.....",
    "....g.gg.g......",
    ".....g.g.g......",
    ".....gggg.......",
    "......gg........",
    "......gg........",
    "................",
    "................",
  ],
  { g: "#4c8a2f" },
);

painters.flower_yellow = P(
  [
    "................",
    "................",
    "......yy........",
    ".....yYYy.......",
    ".....yYYy.......",
    "......yy........",
    ".......s........",
    ".......s........",
    "......ss........",
    ".......s........",
    ".......s........",
    "....g..s..g.....",
    ".....g.s.g......",
    "......gsg.......",
    "................",
    "................",
  ],
  { y: "#e8c11c", Y: "#fbe87a", s: "#3e7a25", g: "#4c8a2f" },
);

painters.flower_red = P(
  [
    "................",
    "................",
    "......rr........",
    ".....rRRr.......",
    ".....rRRr.......",
    "......rr........",
    ".......s........",
    ".......s........",
    ".......s........",
    "......ss........",
    ".......s........",
    "....g..s..g.....",
    ".....g.s.g......",
    "......gsg.......",
    "................",
    "................",
  ],
  { r: "#c22f2f", R: "#e86a5f", s: "#3e7a25", g: "#4c8a2f" },
);

painters.stick = P(
  [
    "................",
    "................",
    "............w...",
    "...........ww...",
    "..........ww....",
    ".........ww.....",
    "........ww......",
    ".......ww.......",
    "......ww........",
    ".....ww.........",
    "....ww..........",
    "...ww...........",
    "...w............",
    "................",
    "................",
    "................",
  ],
  { w: "#8a6a3a" },
);

painters.feather = P(
  [
    "................",
    "...........ff...",
    "..........ffff..",
    ".........fffff..",
    "........ffffff..",
    ".......ffffff...",
    "......ffffff....",
    ".....ffffff.....",
    "....ffffff......",
    "....fffff.......",
    "...ffff.........",
    "...fff..........",
    "..qf............",
    "..q.............",
    ".q..............",
    "................",
  ],
  { f: "#f2f2f2", q: "#b9b9b9" },
);

painters.raw_chicken = P(
  [
    "................",
    "................",
    "......pppp......",
    "....pppppppp....",
    "...pPPpppppp....",
    "...pPppppppppb..",
    "...ppppppppp.b..",
    "....pppppppbb...",
    ".....pppppb.....",
    "......bbbb......",
    ".....b....b.....",
    "....bb....bb....",
    "................",
    "................",
    "................",
    "................",
  ],
  { p: "#e8a2a2", P: "#f6caca", b: "#e3ddc4" },
);

painters.coal_item = P(
  [
    "................",
    "................",
    "................",
    ".....cccc.......",
    "....cccccc......",
    "...ccCccccc.....",
    "...cCccccccc....",
    "...ccccCccccc...",
    "....ccccccccc...",
    "....cccCccccc...",
    ".....ccccccc....",
    "......ccccc.....",
    ".......ccc......",
    "................",
    "................",
    "................",
  ],
  { c: "#2c2c2c", C: "#4d4d4d" },
);

painters.apple = P(
  [
    "................",
    ".......g........",
    ".......s........",
    ".....rrsr.......",
    "....rRRrrr......",
    "...rRRrrrrr.....",
    "...rRrrrrrr.....",
    "...rrrrrrrr.....",
    "...rrrrrrrr.....",
    "...rrrrrrrr.....",
    "....rrrrrr......",
    "....rrrrrr......",
    ".....rrrr.......",
    "................",
    "................",
    "................",
  ],
  { r: "#c22f2f", R: "#e8635a", s: "#6e4a24", g: "#4c8a2f" },
);

painters.cooked_chicken = P(
  [
    "................",
    "................",
    "......pppp......",
    "....pppppppp....",
    "...pPPppppbp....",
    "...pPpppppppb...",
    "...ppppppppp.b..",
    "....pppppppbb...",
    ".....pppppb.....",
    "......bbbb......",
    ".....b....b.....",
    "....bb....bb....",
    "................",
    "................",
    "................",
    "................",
  ],
  { p: "#c8843e", P: "#e0a35a", b: "#8a5a2a" },
);

const TOOL_PALETTE = { w: "#a4824c", h: "#6e5631", s: "#8a6a3a" };
painters.wooden_pickaxe = P(
  [
    "................",
    "....wwwwwww.....",
    "...ww.....ww....",
    "..ww.......ww...",
    "..w.........w...",
    "..w....s....w...",
    ".......s........",
    "......ss........",
    "......s.........",
    ".....ss.........",
    ".....s..........",
    "....ss..........",
    "....s...........",
    "...ss...........",
    "...s............",
    "................",
  ],
  TOOL_PALETTE,
);
painters.wooden_axe = P(
  [
    "................",
    ".....wwww.......",
    "....wwwwww......",
    "....ww..ww......",
    "....ww.ss.......",
    "....wwss........",
    "......s.........",
    ".....ss.........",
    ".....s..........",
    "....ss..........",
    "....s...........",
    "...ss...........",
    "...s............",
    "..ss............",
    "................",
    "................",
  ],
  TOOL_PALETTE,
);
painters.wooden_sword = P(
  [
    "................",
    "...........ww...",
    "..........www...",
    ".........www....",
    "........www.....",
    ".......www......",
    "......www.......",
    ".....www........",
    "..h.www.........",
    "...hwww.........",
    "...shh..........",
    "..ss.hh.........",
    "..ss..hh........",
    ".ss.............",
    "................",
    "................",
  ],
  TOOL_PALETTE,
);

// ---- блоки с формами (сейв v3): факел, лестница, дверь, люк -----------------------

// Факел: пламя и древко в колонках 7–8 (коробка факела вырезает ровно их), древко — строки 8–15.
painters.torch = P(
  [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    ".......FF.......",
    ".......ff.......",
    ".......ss.......",
    ".......ss.......",
    ".......ss.......",
    ".......ss.......",
    ".......ss.......",
    ".......ss.......",
    ".......ss.......",
    ".......ss.......",
  ],
  { F: "#ffe36a", f: "#f0a030", s: "#6b4a24" },
);

painters.ladder = (px, rng) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      if (x === 2 || x === 13) px(x, y, shade("#7a5a30", (rng() - 0.5) * 0.12));
      else if (y % 4 === 2 && x > 2 && x < 13)
        px(x, y, shade("#9a7442", (rng() - 0.5) * 0.12));
    }
};

/** Дверь: вертикальные доски в рамке; у верхней половины — окно (прозрачные пиксели). */
function doorPainter(window: boolean): Painter {
  return (px, rng) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const frame = x === 0 || x === 15 || (window ? y === 0 : y === 15);
        const seam = x === 5 || x === 10;
        if (window && !frame && y >= 3 && y <= 8 && x >= 2 && x <= 13 && !seam)
          continue;
        px(
          x,
          y,
          frame || seam ? "#6e5631" : shade("#a4824c", (rng() - 0.5) * 0.12),
        );
      }
  };
}
painters.oak_door_bottom = doorPainter(false);
painters.oak_door_top = doorPainter(true);
painters.oak_door_item = (px, rng) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 4; x < 12; x++) {
      const frame = x === 4 || x === 11 || y === 0 || y === 15;
      const mullion = x === 7 || x === 8;
      if (!frame && !mullion && y >= 2 && y <= 6) continue; // окно
      px(
        x,
        y,
        frame || mullion ? "#6e5631" : shade("#a4824c", (rng() - 0.5) * 0.12),
      );
    }
};
painters.oak_trapdoor = (px, rng) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const hx = x === 3 || x === 4 || x === 11 || x === 12;
      const hy = y === 3 || y === 4 || y === 11 || y === 12;
      if (hx && hy) continue; // окошки
      const frame =
        x === 0 || x === 15 || y === 0 || y === 15 || x === 7 || x === 8;
      px(x, y, frame ? "#6e5631" : shade("#a4824c", (rng() - 0.5) * 0.12));
    }
};

// ---- природные (сейв v3): лава, обсидиан ------------------------------------------

painters.lava = (px, rng) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const hot = rng() < 0.14;
      px(x, y, hot ? "#ffe27a" : shade("#e8661c", (rng() - 0.5) * 0.35));
    }
};
painters.obsidian = (px, rng) => {
  noisy(px, "#1a1024", 0.14, rng);
  for (let i = 0; i < 7; i++)
    px(
      (rng() * TILE) | 0,
      (rng() * TILE) | 0,
      shade("#4b2a6e", (rng() - 0.5) * 0.3),
    );
};

// ---- стадии трещин (последние 10 тайлов атласа) ------------------------------

function crackPainter(stage: number): Painter {
  return (px, rng) => {
    // от центра расходятся stage+1 ломаных трещин; глубже стадия — гуще
    const cracks = 2 + stage;
    for (let c = 0; c < cracks; c++) {
      let x = 7 + rng() * 2,
        y = 7 + rng() * 2;
      const ang = rng() * Math.PI * 2;
      let dx = Math.cos(ang),
        dy = Math.sin(ang);
      const len = 3 + stage * 1.2;
      for (let i = 0; i < len; i++) {
        px(Math.round(x) & 15, Math.round(y) & 15, "rgba(20,15,10,0.85)");
        x += dx;
        y += dy;
        dx += (rng() - 0.5) * 0.8;
        dy += (rng() - 0.5) * 0.8; // излом
        const n = Math.hypot(dx, dy) || 1;
        dx /= n;
        dy /= n;
      }
    }
    // на поздних стадиях — крошка по всему тайлу
    for (let i = 0; i < stage * 4; i++)
      px((rng() * TILE) | 0, (rng() * TILE) | 0, "rgba(20,15,10,0.7)");
  };
}
for (let s = 0; s < 10; s++) painters["crack" + s] = crackPainter(s);

// исходные тайлы — в общий реестр (части из gfx/painters/* уже там: их импорт выполнился раньше)
Object.assign(PAINTERS, painters);

// ---- сборка атласа ------------------------------------------------------------

// Порядок = индекс тайла. Новые тайлы — только в конец (хвост атласа занят трещинами).
export const TILE_ORDER = [
  "grass_top",
  "grass_side",
  "dirt",
  "stone",
  "cobblestone",
  "bedrock",
  "sand",
  "oak_log_side",
  "oak_log_top",
  "planks",
  "leaves",
  "water",
  "coal_ore",
  "iron_ore",
  "crafting_table_top",
  "crafting_table_side",
  "tallgrass",
  "flower_yellow",
  "flower_red",
  "stick",
  "feather",
  "raw_chicken",
  "coal_item",
  "apple",
  "cooked_chicken",
  "wooden_pickaxe",
  "wooden_axe",
  "wooden_sword",
  // блоки генератора миров (дописываются в конец — индексы старых тайлов не сдвигаются)
  "snow",
  "ice",
  "gravel",
  "clay",
  "sandstone_top",
  "sandstone_side",
  "red_sand",
  "terracotta",
  "stone_bricks",
  "mossy_cobblestone",
  "bricks",
  "glass",
  "spruce_log_side",
  "spruce_log_top",
  "spruce_leaves",
  "birch_log_side",
  "birch_log_top",
  "birch_leaves",
  "dark_planks",
  "dirt_path_top",
  "white_wool",
  "red_wool",
  "orange_wool",
  "yellow_wool",
  "green_wool",
  "blue_wool",
  "light_blue_wool",
  "purple_wool",
  "pink_wool",
  "brown_wool",
  "gray_wool",
  "black_wool",
  // блоки с формами (сейв v3)
  "torch",
  "ladder",
  "oak_door_bottom",
  "oak_door_top",
  "oak_door_item",
  "oak_trapdoor",
  // природные (сейв v3)
  "lava",
  "obsidian",
  // выживание: руды, блоки хранения, материалы, инструменты, броня (gfx/painters/materials.ts)
  ...MATERIAL_TILES,
  // печь, сундук (gfx/painters/functional.ts)
  ...FUNCTIONAL_TILES,
  // добыча с мобов и оружие (gfx/painters/mobdrops.ts)
  ...MOBDROP_TILES,
  // вёдра, огниво, огонь (gfx/painters/utility.ts)
  ...UTILITY_TILES,
  // пашня, посевы по стадиям, сено, урожай (gfx/painters/farming.ts)
  ...FARMING_TILES,
  // Пекло: камень, песок душ, светокамень, кварц, магма, кирпич, портал (gfx/painters/inferno.ts)
  ...INFERNO_TILES,
  // рамка и портал Предела, камень Предела, яйцо, Око (gfx/painters/beyond.ts)
  ...BEYOND_TILES,
  // варочная стойка, нарост, пузырьки и зелья (gfx/painters/brewing.ts)
  ...BREWING_TILES,
  // красный камень: провод, факел, лампа, рычаг (gfx/painters/redstone.ts)
  ...REDSTONE_TILES,
  // породы дерева: доски, брёвна, листва, саженцы, двери, люки (gfx/painters/wood.ts)
  ...WOOD_TILES,
  // 16 цветов: новая шерсть и красители (gfx/painters/colors.ts)
  ...COLOR_TILES,
  // рыбалка, компас, часы, лодки (gfx/painters/outdoor.ts)
  ...OUTDOOR_TILES,
  // Пепельный череп, маяк, звезда Пекла (gfx/painters/boss.ts)
  ...BOSS_TILES,
  // внешние острова и города Предела (gfx/painters/city.ts)
  ...CITY_TILES,
  // океан: морская трава, морской камень, губки, черепахи (gfx/painters/ocean.ts)
  ...OCEAN_TILES,
  // активирующие рельсы, костёр, вагонетки с грузом (gfx/painters/camp.ts)
  ...CAMP_TILES,
  // кораллы, ламинария, рыбы (gfx/painters/sealife.ts)
  ...SEA_LIFE_TILES,
  // тотем жизни (gfx/painters/illager.ts)
  ...ILLAGER_TILES,
  // вёдра с рыбой, клад, проводник (gfx/painters/treasure.ts)
  ...TREASURE_TILES,
  // стол картографа и карты-исследователи (gfx/painters/mansion.ts)
  ...MANSION_TILES,
  // аметист, мох, лозы, подзорная труба (gfx/painters/caves.ts)
  ...CAVE_TILES,
  // скалк, сланец древнего города, осколок эха (gfx/painters/sculk.ts)
  ...SCULK_TILES,
  // капельник, котёл, козий рог (gfx/painters/dripstone.ts)
  ...DRIPSTONE_TILES,
  // вишня: доски, бревно, листва, саженец, дверь, люк, лодка (gfx/painters/wood.ts, поздние породы)
  ...LATE_WOOD_TILES,
  // снег-порох, лепестки (gfx/painters/mountain.ts)
  ...MOUNTAIN_TILES,
  // подозрительный песок и гравий, горшок, кисть, черепки (gfx/painters/archaeology.ts)
  ...ARCHAEOLOGY_TILES,
  // мангр — вторая волна поздних пород (gfx/painters/wood.ts)
  ...LATE_TILES[2]!,
  // грязь, корни, икра, лягушачий свет, магмовый крем (gfx/painters/mangrove.ts)
  ...MANGROVE_TILES,
  // нюхач и древние растения (gfx/painters/sniffer.ts)
  ...SNIFFER_TILES,
  // испытательные камеры, булава (gfx/painters/trial.ts)
  ...TRIAL_TILES,
  // окисление меди, медная лампа и решётка, шаблоны отделки (gfx/painters/copper.ts)
  ...COPPER_TILES,
  // фонари, цепь, свеча, мешок (gfx/painters/decor.ts)
  ...DECOR_TILES,
  // снежок (gfx/painters/frost.ts)
  ...FROST_TILES,
  // грибные поля (gfx/painters/mushroom.ts)
  ...MUSHROOM_TILES,
  // бамбук (gfx/painters/jungle.ts)
  ...JUNGLE_TILES,
  // биомы Пекла (gfx/painters/crimson.ts)
  ...CRIMSON_TILES,
  // базальт, чернокамень, кости, огонь душ (gfx/painters/basalt.ts)
  ...BASALT_TILES,
  // какао, печенье, факел душ (gfx/painters/cocoa.ts)
  ...COCOA_TILES,
  // цветное стекло, полированный базальт и чернокамень (gfx/painters/crafted.ts)
  ...CRAFTED_TILES,
  // костёр душ (gfx/painters/soulcamp.ts)
  ...SOUL_CAMP_TILES,
  // щиток броненосца, броня для волка (gfx/painters/armadillo.ts)
  ...ARMADILLO_TILES,
  // поводок (gfx/painters/lead.ts)
  ...LEAD_TILES,
  // щит (gfx/painters/shield.ts)
  ...SHIELD_TILES,
  // арбалет, трезубец (gfx/painters/ranged.ts)
  ...RANGED_TILES,
  // рабочие блоки жителей (gfx/painters/workstations.ts)
  ...WORKSTATION_TILES,
  // камнерез (gfx/painters/stonecutter.ts)
  ...STONECUTTER_TILES,
  // точило, ткацкий станок, кафедра, стол фехтовальщика (gfx/painters/jobblocks.ts)
  ...JOB_TILES,
  // золотое яблоко (gfx/painters/cure.ts)
  ...CURE_TILES,
  // проигрыватель, нотный блок, пластинки (gfx/painters/sound.ts)
  ...SOUND_TILES,
  // колокол и картины (gfx/painters/hall.ts)
  ...HALL_TILES,
  // подставка (gfx/painters/display.ts)
  ...DISPLAY_TILES,
  // табличка (gfx/painters/sign.ts)
  ...SIGN_TILES,
  // знамёна 16 цветов (gfx/painters/banner.ts)
  ...BANNER_TILES,
  // книги (gfx/painters/book.ts)
  ...BOOK_TILES,
  // сундук Предела, леса, мишень (gfx/painters/extras.ts)
  ...EXTRA_TILES,
  // стойка для брони, путевой камень, якорь (gfx/painters/stand.ts)
  ...STAND_TILES,
  // остальные зелья (gfx/painters/potions.ts)
  ...POTION_TILES,
  // отравленные стрелы (gfx/painters/tipped.ts)
  ...TIPPED_TILES,
  // бирка с именем (gfx/painters/nametag.ts)
  ...NAMETAG_TILES,
];
/** Индекс тайла crack0: трещины — последние 10 тайлов, TILE_ORDER растёт им навстречу. */
const CRACK_BASE = GRID * GRID - 10;
/** Сколько тайлов помещается в TILE_ORDER. */
export const TILE_CAPACITY = CRACK_BASE;

/** Есть ли у тайла функция рисования (проверка реестров в тестах). */
export function hasPainter(name: string): boolean {
  return name in PAINTERS;
}

export class TextureAtlas {
  canvas: HTMLCanvasElement;
  tiles: Record<string, number>;
  texture: THREE.CanvasTexture;
  waterTexture: THREE.CanvasTexture;
  opaqueMat: THREE.MeshLambertMaterial;
  foliageMat: THREE.MeshLambertMaterial;
  waterMat: THREE.MeshLambertMaterial;
  _iconCache: Map<string, HTMLCanvasElement>;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.canvas.height = SIZE;
    const ctx = this.canvas.getContext("2d")!; // код всегда рассчитывает на валидный 2d-контекст
    this.tiles = {}; // имя → индекс

    const paint = (name: string, index: number) => {
      const tx = (index % GRID) * TILE,
        ty = ((index / GRID) | 0) * TILE;
      const rng = mulberry32(hashString("tile:" + name));
      const px: PxFn = (x, y, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(tx + x, ty + y, 1, 1);
      };
      PAINTERS[name]!(px, rng);
    };

    TILE_ORDER.forEach((name, i) => {
      this.tiles[name] = i;
      paint(name, i);
    });
    for (let s = 0; s < 10; s++) {
      this.tiles["crack" + s] = CRACK_BASE + s;
      paint("crack" + s, CRACK_BASE + s);
    }

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.colorSpace = THREE.SRGBColorSpace;

    // Отдельная маленькая текстура воды: у водного материала свой repeat-тайл,
    // чтобы анимировать offset, не сдвигая UV всего атласа.
    const wc = document.createElement("canvas");
    wc.width = wc.height = TILE;
    const wctx = wc.getContext("2d")!; // тот же расчёт на валидный 2d-контекст
    const wrng = mulberry32(hashString("tile:water-solo"));
    painters.water!((x, y, c) => {
      wctx.fillStyle = c;
      wctx.fillRect(x, y, 1, 1);
    }, wrng);
    this.waterTexture = new THREE.CanvasTexture(wc);
    this.waterTexture.magFilter = this.waterTexture.minFilter =
      THREE.NearestFilter;
    this.waterTexture.generateMipmaps = false;
    this.waterTexture.wrapS = this.waterTexture.wrapT = THREE.RepeatWrapping;
    this.waterTexture.colorSpace = THREE.SRGBColorSpace;

    // Материалы чанков — общие на весь мир (3 draw-call-группы).
    this.opaqueMat = new THREE.MeshLambertMaterial({
      map: this.texture,
      vertexColors: true,
    });
    this.foliageMat = new THREE.MeshLambertMaterial({
      map: this.texture,
      vertexColors: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
    this.waterMat = new THREE.MeshLambertMaterial({
      map: this.waterTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    // свет клеток (небо/факелы) из атрибута мешера
    for (const m of [this.opaqueMat, this.foliageMat, this.waterMat])
      patchLightMaterial(m);

    this._iconCache = new Map();
  }

  /** UV-прямоугольник тайла с полутексельным inset. Индекс или имя. */
  uv(tile: string | number): {
    u0: number;
    u1: number;
    v0: number;
    v1: number;
  } {
    const i = typeof tile === "string" ? this.tiles[tile]! : tile;
    const col = i % GRID,
      row = (i / GRID) | 0;
    const inset = 0.5 / SIZE;
    return {
      u0: col / GRID + inset,
      u1: (col + 1) / GRID - inset,
      // canvas рисует сверху вниз, UV в three — снизу вверх
      v0: 1 - (row + 1) / GRID + inset,
      v1: 1 - row / GRID - inset,
    };
  }

  /** Канвас-фрагмент тайла (для иконок). */
  tileCanvas(name: string, shadeAmt = 0): HTMLCanvasElement {
    const i = this.tiles[name]!;
    const c = document.createElement("canvas");
    c.width = c.height = TILE;
    const ctx = c.getContext("2d")!; // расчёт на валидный 2d-контекст
    ctx.drawImage(
      this.canvas,
      (i % GRID) * TILE,
      ((i / GRID) | 0) * TILE,
      TILE,
      TILE,
      0,
      0,
      TILE,
      TILE,
    );
    if (shadeAmt !== 0) {
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = `rgba(0,0,0,${shadeAmt})`;
      ctx.fillRect(0, 0, TILE, TILE);
    }
    return c;
  }

  /** Изометрическая иконка блока (48×48) из его top/side тайлов. */
  blockIcon(topName: string, sideName: string): HTMLCanvasElement {
    const key = "b:" + topName + "/" + sideName;
    if (this._iconCache.has(key)) return this._iconCache.get(key)!; // has() гарантирует наличие
    const c = document.createElement("canvas");
    c.width = c.height = 48;
    const ctx = c.getContext("2d")!; // расчёт на валидный 2d-контекст
    ctx.imageSmoothingEnabled = false;
    const top = this.tileCanvas(topName, 0);
    const left = this.tileCanvas(sideName, 0.25);
    const right = this.tileCanvas(sideName, 0.42);
    const k = 21 / TILE; // размер грани
    // верхняя грань (ромб), затем левая и правая
    ctx.setTransform(k, k * 0.5, -k, k * 0.5, 24, 3);
    ctx.drawImage(top, 0, 0);
    ctx.setTransform(k, k * 0.5, 0, k, 24 - k * TILE, 3 + k * TILE * 0.5);
    ctx.drawImage(left, 0, 0);
    ctx.setTransform(k, -k * 0.5, 0, k, 24, 3 + k * TILE);
    ctx.drawImage(right, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this._iconCache.set(key, c);
    return c;
  }

  /** Плоская иконка предмета (его тайл, 48×48, nearest). */
  flatIcon(tileName: string): HTMLCanvasElement {
    const key = "f:" + tileName;
    if (this._iconCache.has(key)) return this._iconCache.get(key)!; // has() гарантирует наличие
    const c = document.createElement("canvas");
    c.width = c.height = 48;
    const ctx = c.getContext("2d")!; // расчёт на валидный 2d-контекст
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.tileCanvas(tileName), 0, 0, 48, 48);
    this._iconCache.set(key, c);
    return c;
  }
}
