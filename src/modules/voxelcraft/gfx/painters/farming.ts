// Тайлы фермерства: пашня (сухая и мокрая), стадии посевов, сено, семена и урожай.
import { PAINTERS, TILE, noisy, shade, type Painter } from "../paint";

export const FARMING_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  FARMING_TILES.push(name);
};

const furrows =
  (base: string, line: string): Painter =>
  (px, rng) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++)
        px(x, y, shade(y % 4 === 0 ? line : base, (rng() - 0.5) * 0.16));
  };
add("farmland", furrows("#6e4b2c", "#4b321c"));
add("farmland_wet", furrows("#4a3019", "#301e0e"));

/** Стадия посева: стебли высотой по доле роста k (0..1), у спелого — колос сверху или корнеплод снизу. */
function crop(
  k: number,
  leaf: string,
  ripe?: { color: string; at: "top" | "bottom" },
): Painter {
  return (px, rng) => {
    const h = Math.round(3 + k * 12);
    for (let col = 1; col < TILE - 1; col += 3) {
      const ch = Math.max(2, h - Math.floor(rng() * 3));
      for (let y = TILE - 1; y >= TILE - ch; y--)
        px(col, y, shade(leaf, (rng() - 0.5) * 0.2));
      px(col + 1, TILE - 1 - Math.floor(ch * 0.5), shade(leaf, 0.1)); // листок
      if (!ripe) continue;
      if (ripe.at === "top")
        for (let y = TILE - ch; y < Math.min(TILE, TILE - ch + 4); y++) {
          px(col, y, shade(ripe.color, (rng() - 0.5) * 0.15));
          px(col + 1, y, shade(ripe.color, -0.1));
        }
      else {
        px(col, TILE - 1, ripe.color);
        px(col + 1, TILE - 1, shade(ripe.color, -0.15));
        px(col, TILE - 2, shade(ripe.color, 0.1));
      }
    }
  };
}

// у пшеницы 8 картинок, у остальных посевов 4 (по две стадии на картинку) — см. ChunkMesher.cropTile
for (let s = 0; s < 8; s++)
  add(
    `wheat_${s}`,
    crop(
      s / 7,
      s === 7 ? "#b89a3a" : "#5c9a2c",
      s >= 5
        ? { color: s === 7 ? "#e0c050" : "#9ab84a", at: "top" }
        : undefined,
    ),
  );
for (let s = 0; s < 4; s++) {
  const k = (s / 3) * 0.6;
  const ripe = s === 3;
  add(
    `carrots_${s}`,
    crop(k, "#3f8f2a", ripe ? { color: "#f08a24", at: "bottom" } : undefined),
  );
  add(
    `potatoes_${s}`,
    crop(k, "#4f9a34", ripe ? { color: "#c9a45a", at: "bottom" } : undefined),
  );
  add(
    `beetroots_${s}`,
    crop(k, "#5a8a2a", ripe ? { color: "#9a1e3a", at: "bottom" } : undefined),
  );
}
// тайл блока без номера стадии (описание блока, проверки реестра) — это спелая стадия
for (const [name, last] of [
  ["wheat", "wheat_7"],
  ["carrots", "carrots_3"],
  ["potatoes", "potatoes_3"],
  ["beetroots", "beetroots_3"],
] as const)
  add(name, PAINTERS[last]!);

// ---- сноп сена ----
add("hay_side", (px, rng) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const band = y === 3 || y === 12;
      px(
        x,
        y,
        band
          ? shade("#7a4a1a", (rng() - 0.5) * 0.1)
          : shade(x % 3 === 0 ? "#b8962e" : "#d4b444", (rng() - 0.5) * 0.12),
      );
    }
});
add("hay_top", (px, rng) => {
  noisy(px, "#c8a83a", 0.14, rng);
  for (let i = 0; i < TILE; i++) {
    px(i, 0, "#8a6a20");
    px(i, TILE - 1, "#8a6a20");
    px(0, i, "#8a6a20");
    px(TILE - 1, i, "#8a6a20");
  }
});

// ---- предметы ----
const SEED_DOTS: readonly (readonly [number, number])[] = [
  [3, 4],
  [9, 3],
  [6, 7],
  [11, 8],
  [4, 11],
  [8, 12],
  [12, 12],
];
const seeds =
  (c: string, dark: string): Painter =>
  (px) => {
    for (const [x, y] of SEED_DOTS) {
      px(x, y, c);
      px(x + 1, y, dark);
      px(x, y + 1, dark);
    }
  };
add("wheat_seeds", seeds("#7aa840", "#4f7a2a"));
add("beetroot_seeds", seeds("#c8a878", "#8a6f48"));

add("wheat_item", (px) => {
  for (let i = 0; i < 5; i++) {
    const x = 4 + i * 2;
    for (let y = 2; y < 15; y++) px(x, y, y < 7 ? "#e2c25a" : "#b89a3a");
    px(x + 1, 3 + (i % 2), "#caa84a");
  }
  for (let x = 3; x < 14; x++) px(x, 10, "#7a5a2a"); // перевязь
});

add("carrot", (px) => {
  for (let t = 0; t <= 8; t++) {
    const x = 3 + t,
      y = 13 - t;
    const w = t < 3 ? 1 : t < 6 ? 2 : 3;
    for (let a = 0; a < w; a++)
      for (let b = 0; b < w; b++)
        px(x + a - (w >> 1), y + b - (w >> 1), a === 0 ? "#f59a34" : "#d8661a");
  }
  for (const [x, y] of [
    [12, 3],
    [13, 2],
    [14, 1],
    [12, 1],
    [13, 4],
    [14, 4],
    [11, 2],
  ] as const)
    px(x, y, "#3f9a2a");
});

/** Овальный плод с пятнышками (картофель, свёкла, хлеб, мука). */
const blob =
  (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    c: string,
    spot: string,
  ): Painter =>
  (px, rng) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d > 1) continue;
        px(
          x,
          y,
          d > 0.7
            ? shade(c, -0.22)
            : rng() < 0.08
              ? spot
              : shade(c, (rng() - 0.5) * 0.1),
        );
      }
  };
add("potato", blob(7.5, 8.5, 5.5, 4.5, "#c9a45a", "#8a6a30"));
add("baked_potato", blob(7.5, 8.5, 5.5, 4.5, "#d89a3a", "#f2d27a"));
add("beetroot", (px, rng) => {
  blob(7.5, 9.5, 4.5, 4.5, "#9a1e3a", "#6a0e22")(px, rng);
  for (let y = 1; y < 5; y++) {
    px(7, y, "#3f8a2a");
    px(9, y + 1, "#3f8a2a");
  }
});
add("bread", (px, rng) => {
  blob(7.5, 8.5, 7, 3.5, "#b06e2c", "#c8843a")(px, rng);
  for (const x of [4, 7, 10]) {
    px(x, 6, "#e8b060");
    px(x + 1, 7, "#e8b060");
  }
});
add("bone_meal", blob(7.5, 10, 5, 3.5, "#f0f0e8", "#c8c8c0"));

// ---- тростник, кактус, тыква, арбуз, книжная полка ----
add("sugar_cane", (px, rng) => {
  for (const col of [3, 7, 11]) {
    for (let y = 0; y < TILE; y++) {
      const joint = y % 5 === 0;
      px(col, y, joint ? "#5a8a30" : shade("#8ac060", (rng() - 0.5) * 0.15));
      px(
        col + 1,
        y,
        joint ? "#4a7a28" : shade("#6aa048", (rng() - 0.5) * 0.15),
      );
    }
    px(col + 2, 4 + (col % 3), "#7ab050"); // листок
  }
});
const cactusSide: Painter = (px, rng) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 1; x < TILE - 1; x++) {
      const rib = x % 4 === 1;
      const spine = rib && y % 4 === 2;
      px(
        x,
        y,
        spine
          ? "#e8e0a0"
          : shade(rib ? "#2f7a24" : "#3a8a2a", (rng() - 0.5) * 0.12),
      );
    }
};
add("cactus_side", cactusSide);
add("cactus_top", (px, rng) => {
  for (let y = 1; y < TILE - 1; y++)
    for (let x = 1; x < TILE - 1; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      px(x, y, shade(d < 3 ? "#5aa040" : "#3a8a2a", (rng() - 0.5) * 0.12));
    }
});
const ribbed =
  (base: string, rib: string, top: boolean): Painter =>
  (px, rng) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const line = top ? Math.hypot(x - 7.5, y - 7.5) % 5 < 1 : x % 5 === 0;
        px(x, y, shade(line ? rib : base, (rng() - 0.5) * 0.1));
      }
  };
add("pumpkin_side", ribbed("#e08a1a", "#b8650e", false));
add("pumpkin_top", (px, rng) => {
  ribbed("#d88018", "#b8650e", true)(px, rng);
  for (let y = 6; y < 10; y++) for (let x = 7; x < 9; x++) px(x, y, "#6a5a20"); // хвостик
});
add("melon_side", ribbed("#7aa83a", "#4a7a20", false));
add("melon_top", ribbed("#6a9a30", "#4a7a20", true));
for (let s = 0; s < 4; s++)
  add(
    `pumpkin_stem_${s}`,
    crop((s / 3) * 0.7, s === 3 ? "#a0a040" : "#6aa040"),
  );
for (let s = 0; s < 4; s++)
  add(`melon_stem_${s}`, crop((s / 3) * 0.7, s === 3 ? "#a0a040" : "#6aa040"));
add("pumpkin_stem", PAINTERS.pumpkin_stem_3!);
add("melon_stem", PAINTERS.melon_stem_3!);
add("bookshelf", (px, rng) => {
  const COLORS = ["#8a2a2a", "#2a4a8a", "#2a7a3a", "#8a7a2a", "#5a2a7a"];
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const shelf =
        y === 0 || y === 7 || y === 8 || y === 15 || x === 0 || x === 15;
      if (shelf) px(x, y, shade("#8a6a3a", (rng() - 0.5) * 0.1));
      else
        px(
          x,
          y,
          shade(
            COLORS[(x + (y > 7 ? 2 : 0)) % COLORS.length]!,
            (x % 3 === 0 ? -0.3 : 0) + (rng() - 0.5) * 0.08,
          ),
        );
    }
});

// ---- предметы ----
add("sugar", (px, rng) => {
  for (let i = 0; i < 30; i++) {
    const x = 4 + Math.floor(rng() * 8),
      y = 6 + Math.floor(rng() * 7);
    px(x, y, rng() < 0.5 ? "#ffffff" : "#e0e0e8");
  }
});
add("paper", (px) => {
  for (let y = 3; y < 13; y++)
    for (let x = 3; x < 13; x++)
      px(x, y, (x + y) % 7 === 0 ? "#d8d8cc" : "#f4f4ea");
});
add("book", (px) => {
  for (let y = 3; y < 13; y++)
    for (let x = 4; x < 12; x++)
      px(
        x,
        y,
        x === 4 ? "#5a3018" : y === 3 || y === 12 ? "#f0ecd8" : "#8a4a20",
      );
});
add("melon_slice", (px) => {
  for (let y = 4; y < 13; y++)
    for (let x = 3; x < 13; x++) {
      if (y < 4 + (12 - x) * 0.8) continue;
      px(
        x,
        y,
        y >= 11 ? "#4a7a20" : (x * 3 + y) % 5 === 0 ? "#2a1a10" : "#e0503a",
      );
    }
});
add("pumpkin_seeds", seeds("#f0e0b0", "#c8b080"));
add("melon_seeds", seeds("#3a2a1a", "#1a1008"));
add("glistering_melon", (px) => {
  PAINTERS.melon_slice!(px, () => 0);
  for (const [x, y] of [
    [6, 8],
    [9, 10],
    [11, 7],
    [4, 11],
  ] as const)
    px(x, y, "#fff080");
});
