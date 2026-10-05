// Иконки рыбалки, приборов и лодок (registry/items/outdoor.ts).
import { WOOD_SPECIES, type WoodSpecies } from "../../registry/blocks/wood";
import { PAINTERS, TILE, shade, type Painter } from "../paint";

export const OUTDOOR_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  OUTDOOR_TILES.push(name);
};

add("fishing_rod", (px) => {
  for (let i = 1; i < 14; i++) px(i, 14 - i, i < 3 ? "#4a3218" : "#8a6a3a"); // удилище
  for (let y = 2; y < 13; y++) px(14, y, "#d8d8d8"); // леска
  px(14, 13, "#8a8a8a");
});

const fish =
  (body: string, belly: string): Painter =>
  (px, rng) => {
    for (let y = 5; y < 11; y++)
      for (let x = 3; x < 12; x++) {
        const d = Math.hypot((x - 7.5) / 4.5, (y - 8) / 3);
        if (d < 1) px(x, y, shade(y > 8 ? belly : body, (rng() - 0.5) * 0.12));
      }
    for (let y = 5; y < 11; y++)
      for (let x = 12; x < 15; x++)
        if (Math.abs(y - 8) <= x - 11) px(x, y, body); // хвост
    px(5, 7, "#101010");
  };
add("cod", fish("#b09a6a", "#e0d4b4"));
add("salmon", fish("#b05040", "#e0a080"));
add("cooked_cod", fish("#c8a060", "#e8d0a0"));
add("cooked_salmon", fish("#a0602a", "#d8a060"));

add("compass", (px) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 7) px(x, y, d > 5.8 ? "#6a6a70" : "#d8d8d0");
    }
  for (let k = 0; k < 4; k++) {
    px(7, 3 + k, "#d02020");
    px(8, 3 + k, "#d02020");
    px(7, 8 + k, "#404048");
    px(8, 8 + k, "#404048");
  }
});

add("clock", (px) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 7) px(x, y, d > 5.8 ? "#c8a030" : y < 8 ? "#6ab0e8" : "#1a2a5a");
    }
  for (let y = 4; y < 7; y++) for (let x = 6; x < 10; x++) px(x, y, "#f8d840"); // солнце
  for (let y = 9; y < 12; y++) for (let x = 6; x < 10; x++) px(x, y, "#e8ecf8"); // луна
});

// карта: лист бумаги; заполненная — с зеленью, водой и дорожкой
const sheet = (px: Parameters<Painter>[0], rng: () => number) => {
  for (let y = 1; y < 15; y++)
    for (let x = 1; x < 15; x++)
      px(
        x,
        y,
        x === 1 || y === 1 || x === 14 || y === 14
          ? "#a08a60"
          : shade("#e8dcb8", (rng() - 0.5) * 0.08),
      );
};
add("map", (px, rng) => {
  sheet(px, rng);
  for (let k = 0; k < 4; k++) px(7, 5 + k * 2, "#b0a080");
});
add("filled_map", (px, rng) => {
  sheet(px, rng);
  for (let y = 3; y < 13; y++)
    for (let x = 3; x < 13; x++) {
      const n = Math.sin(x * 0.9) + Math.cos(y * 0.7);
      px(
        x,
        y,
        n > 0.9
          ? "#3a6ab0"
          : n > -0.6
            ? shade("#6a9a3a", (rng() - 0.5) * 0.2)
            : "#c8b070",
      );
    }
  px(8, 8, "#ffffff");
});

const blob =
  (c: string, w: number, h: number): Painter =>
  (px, rng) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++)
        if (Math.hypot((x - 7.5) / w, (y - 8) / h) < 1)
          px(x, y, shade(c, (rng() - 0.5) * 0.2 - (y - 8) * 0.02));
  };
add("ink_sac", (px, rng) => {
  blob("#1a1a24", 5, 5.5)(px, rng);
  px(6, 6, "#4a4a5a");
});
add("rabbit_hide", (px, rng) => {
  for (let y = 3; y < 13; y++)
    for (let x = 3; x < 13; x++)
      if ((x + y) % 7) px(x, y, shade("#b08a5a", (rng() - 0.5) * 0.2));
});
add("raw_rabbit", blob("#e08a8a", 5, 4));
add("cooked_rabbit", blob("#a8683a", 5, 4));
add("phantom_membrane", (px, rng) => {
  for (let y = 3; y < 13; y++)
    for (let x = 2; x < 14; x++)
      if (Math.abs(x - 7.5) < 6 - Math.abs(y - 8) * 0.4)
        px(x, y, shade("#8a9ac0", (rng() - 0.5) * 0.15));
});

// гнездо и улей: соты, дерево; полный — капли мёда
const honeycombFace =
  (base: string, honey: boolean): Painter =>
  (px, rng) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const cell = (x + (Math.floor(y / 3) % 2) * 2) % 4 === 0 || y % 3 === 0;
        px(x, y, shade(cell ? "#8a6020" : base, (rng() - 0.5) * 0.12));
      }
    for (let y = 6; y < 11; y++)
      for (let x = 5; x < 11; x++) px(x, y, "#3a2410"); // леток
    if (honey)
      for (const [x, y] of [
        [3, 12],
        [11, 12],
        [7, 13],
        [4, 3],
        [12, 4],
      ] as const)
        px(x, y, "#ffb020");
  };
add("bee_nest_side", honeycombFace("#d8b050", false));
add("bee_nest_honey", honeycombFace("#d8b050", true));
add("bee_nest_top", (px, rng) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++)
      px(x, y, shade("#c89a40", (rng() - 0.5) * 0.15));
});
const hiveSide =
  (honey: boolean): Painter =>
  (px, rng) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++)
        px(
          x,
          y,
          y % 4 === 3 ? "#6e5631" : shade("#b8904c", (rng() - 0.5) * 0.12),
        );
    for (let y = 6; y < 10; y++)
      for (let x = 5; x < 11; x++) px(x, y, honey ? "#f0a020" : "#3a2410");
  };
add("beehive_side", hiveSide(false));
add("beehive_honey", hiveSide(true));
add("beehive_end", (px, rng) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++)
      px(
        x,
        y,
        x < 2 || y < 2 || x > 13 || y > 13
          ? "#6e5631"
          : shade("#c8a060", (rng() - 0.5) * 0.12),
      );
});
add("honeycomb", (px, rng) => {
  for (let y = 3; y < 13; y++)
    for (let x = 3; x < 13; x++)
      if ((x + y) % 3) px(x, y, shade("#f0a820", (rng() - 0.5) * 0.2));
});
add("honey_bottle", (px) => {
  for (let y = 5; y < 14; y++)
    for (let x = 4; x < 12; x++) px(x, y, y < 7 ? "#d8e8f0" : "#f0a020");
  for (let y = 2; y < 5; y++) for (let x = 6; x < 10; x++) px(x, y, "#c8d8e0");
});

add("saddle", (px, rng) => {
  for (let y = 5; y < 11; y++)
    for (let x = 2; x < 14; x++) {
      const d = Math.hypot((x - 7.5) / 6, (y - 8) / 3.2);
      if (d < 1)
        px(x, y, shade(y < 7 ? "#7a4a24" : "#5a3418", (rng() - 0.5) * 0.12));
    }
  for (let y = 10; y < 14; y++) px(4, y, "#3a2410"); // стремя
  px(4, 14, "#a0a0a8");
});

/** Лодка породы (иконка предмета). */
export const boat =
  (s: WoodSpecies) =>
  (px: (x: number, y: number, c: string) => void): void => {
    for (let x = 1; x < 15; x++) {
      const depth = x < 3 || x > 12 ? 1 : 3;
      for (let y = 7; y < 7 + depth + 2; y++)
        px(x, y, y === 7 ? s.colors.seam : s.colors.planks);
    }
    for (let x = 5; x < 11; x++) px(x, 6, s.colors.seam); // скамья
  };

// лодки поздних пород (вишня) рисует painters/wood — их тайлы в конце атласа
for (const s of WOOD_SPECIES) if (!s.late) add(`${s.id}_boat`, boat(s));
