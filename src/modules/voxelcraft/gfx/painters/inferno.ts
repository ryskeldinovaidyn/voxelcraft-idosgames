// Тайлы Пекла: адский камень, песок душ, светокамень, кварцевая руда, магма, адский кирпич, портал
// и предметы (светопыль, кварц, адский кирпич).
import { PAINTERS, TILE, noisy, oreBlobs, shade, type Painter } from "../paint";

export const INFERNO_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  INFERNO_TILES.push(name);
};

const each = (fn: (x: number, y: number) => void): void => {
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) fn(x, y);
};

add("infernal_stone", (px, rng) =>
  each((x, y) => {
    const v = rng();
    px(
      x,
      y,
      shade(
        v < 0.15 ? "#5a1e1e" : v < 0.3 ? "#8a3a34" : "#6e2a2a",
        (rng() - 0.5) * 0.15,
      ),
    );
  }),
);
add("soul_sand", (px, rng) => {
  noisy(px, "#4e3a2c", 0.18, rng);
  // «лица» в песке
  for (const [fx, fy] of [
    [3, 4],
    [10, 8],
    [5, 11],
  ] as const) {
    px(fx, fy, "#2a1e16");
    px(fx + 2, fy, "#2a1e16");
    px(fx + 1, fy + 2, "#2a1e16");
  }
});
add("glowstone", (px, rng) =>
  each((x, y) => {
    const v = rng();
    px(
      x,
      y,
      v < 0.3
        ? "#fff0a0"
        : v < 0.6
          ? "#e8c878"
          : v < 0.85
            ? "#b8904a"
            : "#8a6a3a",
    );
  }),
);
add("quartz_ore", (px, rng) => {
  PAINTERS.infernal_stone!(px, rng);
  oreBlobs(px, rng, "#ece4dc");
});
add("magma_block", (px, rng) =>
  each((x, y) => {
    const crack = (x * 7 + y * 3) % 11 === 0 || rng() < 0.08;
    px(x, y, shade(crack ? "#ffa020" : "#6a2a10", (rng() - 0.5) * 0.2));
  }),
);
add("inferno_bricks", (px, rng) =>
  each((x, y) => {
    const off = (y >> 2) % 2 ? 4 : 0;
    const mortar = y % 4 === 3 || (x + off) % 8 === 7;
    px(x, y, mortar ? "#160a0c" : shade("#3a1a20", (rng() - 0.5) * 0.18));
  }),
);
add("inferno_portal", (px, rng) =>
  each((x, y) => {
    const v = (Math.sin((x + y) * 0.9) + Math.cos((x - y) * 0.7) + 2) / 4;
    px(
      x,
      y,
      shade(
        v > 0.6 ? "#b060ff" : v > 0.35 ? "#7a2ae0" : "#4a1090",
        (rng() - 0.5) * 0.12,
      ),
    );
  }),
);

// ---- предметы ----
add("glowstone_dust", (px, rng) => {
  for (let i = 0; i < 24; i++) {
    const x = 3 + Math.floor(rng() * 10),
      y = 4 + Math.floor(rng() * 9);
    px(x, y, rng() < 0.5 ? "#ffe890" : "#d8b050");
  }
});
add("quartz", (px) => {
  for (let y = 3; y <= 12; y++) {
    const w = Math.min(y - 2, 13 - y, 3);
    for (let x = 8 - w; x <= 8 + w; x++)
      px(x, y, x < 8 ? "#f4f0ea" : "#d8d0c8");
  }
});
add("inferno_brick", (px, rng) => {
  for (let y = 6; y <= 11; y++)
    for (let x = 2; x <= 13; x++)
      px(x, y, shade(y === 6 ? "#5a2a30" : "#3a1a20", (rng() - 0.5) * 0.15));
});

// ---- добыча мобов Пекла ----
add("flame_rod", (px) => {
  for (let i = 0; i < 11; i++) {
    const x = 3 + i,
      y = 13 - i;
    px(x, y, "#f8d040");
    px(x + 1, y, "#e08a18");
  }
});
add("flame_powder", (px, rng) => {
  for (let i = 0; i < 26; i++) {
    const x = 3 + Math.floor(rng() * 10),
      y = 5 + Math.floor(rng() * 8);
    px(x, y, rng() < 0.5 ? "#ffb020" : "#e06a10");
  }
});
// ---- пеклит и кузнечный стол ----
add("ancient_debris_side", (px, rng) =>
  each((x, y) => {
    const ring = (x + y * 3) % 7 === 0 || rng() < 0.06;
    px(
      x,
      y,
      ring
        ? shade("#8a6a5a", (rng() - 0.5) * 0.2)
        : shade("#4a3028", (rng() - 0.5) * 0.18),
    );
  }),
);
add("ancient_debris_top", (px, rng) =>
  each((x, y) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    const ring = Math.abs(d - 5) < 0.7 || Math.abs(d - 2.5) < 0.6;
    px(
      x,
      y,
      ring
        ? shade("#8a6a5a", (rng() - 0.5) * 0.15)
        : shade("#4a3028", (rng() - 0.5) * 0.18),
    );
  }),
);
add("smithing_table_top", (px, rng) =>
  each((x, y) => {
    const edge = x === 0 || y === 0 || x === TILE - 1 || y === TILE - 1;
    px(x, y, edge ? "#1e1a22" : shade("#3a3440", (rng() - 0.5) * 0.12));
  }),
);
add("smithing_table_side", (px, rng) =>
  each((x, y) => {
    const metal = y < 5;
    px(
      x,
      y,
      metal
        ? shade("#3a3440", (rng() - 0.5) * 0.12)
        : shade("#7a5a3a", (rng() - 0.5) * 0.14),
    );
  }),
);

add("wailer_tear", (px) => {
  for (let y = 3; y <= 13; y++) {
    const w = y < 8 ? Math.floor((y - 3) / 2) : Math.min(3, 13 - y);
    for (let x = 8 - w; x <= 8 + w; x++)
      px(x, y, x < 8 ? "#e8f4ff" : "#b8d0e8");
  }
});
