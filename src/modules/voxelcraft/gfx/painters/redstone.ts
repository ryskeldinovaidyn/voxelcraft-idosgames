// Тайлы красного камня: провод (выключен/заряжен), красный факел (горит/погас), лампа (выкл/вкл),
// рычаг. Кнопка и нажимная плита — из тайла камня.
import { PAINTERS, TILE, shade, type Painter } from "../paint";

export const REDSTONE_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  REDSTONE_TILES.push(name);
};

/** Провод: крест из пыли с пятном в центре. */
const dust =
  (c: string): Painter =>
  (px, rng) => {
    for (let i = 0; i < TILE; i++)
      for (const k of [7, 8]) {
        px(i, k, shade(c, (rng() - 0.5) * 0.2));
        px(k, i, shade(c, (rng() - 0.5) * 0.2));
      }
    for (let y = 5; y < 11; y++)
      for (let x = 5; x < 11; x++) px(x, y, shade(c, (rng() - 0.5) * 0.2));
  };
add("redstone_dust_off", dust("#6a0c0c"));
add("redstone_dust_on", dust("#ff2a2a"));

/** Факел: палочка и голова (как тайл обычного факела — UV по центру коробки). */
const torch =
  (head: string): Painter =>
  (px) => {
    for (let y = 6; y < TILE; y++) {
      px(7, y, "#6a4a2a");
      px(8, y, "#8a6a3a");
    }
    for (let y = 3; y < 6; y++) {
      px(7, y, head);
      px(8, y, shade(head, 0.15));
    }
  };
add("redstone_torch", torch("#ff3030"));
add("redstone_torch_off", torch("#5a1414"));

/** Лампа: рамка и решётка; включённая — тёплое свечение. */
const lamp =
  (frame: string, glass: string): Painter =>
  (px, rng) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const edge =
          x === 0 ||
          y === 0 ||
          x === TILE - 1 ||
          y === TILE - 1 ||
          x % 5 === 0 ||
          y % 5 === 0;
        px(x, y, edge ? frame : shade(glass, (rng() - 0.5) * 0.15));
      }
  };
add("redstone_lamp", lamp("#3a2a1a", "#7a5a3a"));
add("redstone_lamp_on", lamp("#8a6a3a", "#fff0a0"));

/** Повторитель сверху: камень с дорожкой пыли вдоль. */
const repeaterTop =
  (dust: string): Painter =>
  (px, rng) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++)
        px(x, y, shade("#a0a0a0", (rng() - 0.5) * 0.12));
    for (let y = 1; y < TILE - 1; y++) {
      px(7, y, dust);
      px(8, y, shade(dust, -0.1));
    }
  };
add("repeater", repeaterTop("#6a0c0c"));
add("repeater_on", repeaterTop("#ff2a2a"));

// поршень: бок — доски сверху и булыжник; лицо — доски (липкое — слизь); тыл — камень с железом
add("piston_side", (px, rng) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++)
      px(
        x,
        y,
        y < 4
          ? shade("#b08a50", (rng() - 0.5) * 0.15)
          : shade("#7a7a7a", (rng() - 0.5) * 0.25),
      );
});
const pistonFace =
  (c: string): Painter =>
  (px, rng) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const edge = x === 0 || y === 0 || x === TILE - 1 || y === TILE - 1;
        px(x, y, edge ? "#6a5030" : shade(c, (rng() - 0.5) * 0.15));
      }
  };
add("piston_top", pistonFace("#b08a50"));
add("piston_top_sticky", pistonFace("#6ab04a"));
add("piston_bottom", (px, rng) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const mid = x > 5 && x < 10 && y > 5 && y < 10;
      px(x, y, mid ? "#c8c8c8" : shade("#6a6a6a", (rng() - 0.5) * 0.25));
    }
});
add("slime_ball", (px, rng) => {
  for (let y = 4; y < 12; y++)
    for (let x = 4; x < 12; x++)
      if ((x - 7.5) ** 2 + (y - 7.5) ** 2 < 14)
        px(x, y, shade("#6ad04a", (rng() - 0.5) * 0.2 - (y - 4) * 0.03));
  px(6, 6, "#c8ffb0");
});

// воронка: тёмный металл с ободом; сверху — чаша с отверстием
const metal = (
  px: Parameters<Painter>[0],
  rng: () => number,
  c = "#4a4a4e",
) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) px(x, y, shade(c, (rng() - 0.5) * 0.14));
};
add("hopper_side", (px, rng) => {
  metal(px, rng);
  for (let x = 0; x < TILE; x++) {
    px(x, 0, "#6a6a70");
    px(x, 5, "#2a2a2e");
  }
});
add("hopper_top", (px, rng) => {
  metal(px, rng);
  for (let y = 2; y < 14; y++)
    for (let x = 2; x < 14; x++)
      px(x, y, shade("#2a2a2e", (rng() - 0.5) * 0.1));
  for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) px(x, y, "#151517");
});
add("hopper_item", (px) => {
  for (let y = 2; y < 6; y++) for (let x = 1; x < 15; x++) px(x, y, "#5a5a60");
  for (let y = 6; y < 11; y++)
    for (let x = 3 + (y - 6); x < 13 - (y - 6); x++) px(x, y, "#4a4a4e");
  for (let y = 11; y < 15; y++) for (let x = 7; x < 9; x++) px(x, y, "#3a3a3e");
});
// раздатчик и выбрасыватель: булыжник, на лице — «рот» и прорезь
const cobble = (px: Parameters<Painter>[0], rng: () => number) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const seam = (x * 7 + y * 3) % 11 === 0 || (x + y * 5) % 13 === 0;
      px(x, y, shade(seam ? "#5a5a5a" : "#7e7e7e", (rng() - 0.5) * 0.2));
    }
};
add("machine_side", (px, rng) => cobble(px, rng));
add("dispenser_front", (px, rng) => {
  cobble(px, rng);
  for (let y = 4; y < 12; y++)
    for (let x = 4; x < 12; x++)
      if (Math.hypot(x - 7.5, y - 7.5) < 4) px(x, y, "#1c1c1c");
  for (let x = 5; x < 11; x++) px(x, 11, "#3a3a3a");
});
add("dropper_front", (px, rng) => {
  cobble(px, rng);
  for (let y = 5; y < 11; y++)
    for (let x = 5; x < 11; x++)
      px(x, y, y === 5 || y === 10 ? "#3a3a3a" : "#1c1c1c");
});

// компаратор сверху: камень с тремя «лампочками» и дорожкой
const comparatorTop =
  (lit: string): Painter =>
  (px, rng) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++)
        px(x, y, shade("#a4a4a4", (rng() - 0.5) * 0.12));
    for (let y = 3; y < 13; y++) px(8, y, shade(lit, -0.15));
    for (const [cx, cy] of [
      [4, 3],
      [12, 3],
      [8, 12],
    ] as const)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) px(cx + dx, cy + dy, lit);
  };
add("comparator", comparatorTop("#6a0c0c"));
add("comparator_on", comparatorTop("#ff3030"));
// наблюдатель: лицо с «глазами»-прорезями, тыл с точкой выхода, бока со стрелкой
add("observer_side", (px, rng) => {
  cobble(px, rng);
  for (let y = 3; y < 13; y++) px(7, y, "#3a3a3a");
  for (const d of [1, 2]) {
    px(7 - d, 3 + d, "#3a3a3a");
    px(7 + d, 3 + d, "#3a3a3a");
  }
});
add("observer_front", (px, rng) => {
  cobble(px, rng);
  for (let y = 4; y < 12; y++)
    for (let x = 2; x < 14; x++)
      if (y === 7 || y === 8 || x === 7 || x === 8) px(x, y, "#1c1c1c");
});
const observerBack =
  (dot: string): Painter =>
  (px, rng) => {
    cobble(px, rng);
    for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) px(x, y, dot);
  };
add("observer_back", observerBack("#4a1010"));
add("observer_back_on", observerBack("#ff2a2a"));

// рельсы: шпалы и две полосы. Север–юг — полосы вдоль v тайла, запад–восток — вдоль u, повороты
// (6 юг–восток, 7 юг–запад, 8 север–запад, 9 север–восток) — дуги вокруг угла между выходами
export type RailLook = { bar: string; mid?: string };
export const railPainter =
  (look: RailLook, kind: "ns" | "ew" | number): Painter =>
  (px, rng) => {
    const tie = (x: number, y: number) =>
      px(x, y, shade("#6a4a2a", (rng() - 0.5) * 0.15));
    if (typeof kind === "number") {
      const [cx, cy] = (
        { 6: [16, 16], 7: [0, 16], 8: [0, 0], 9: [16, 0] } as Record<
          number,
          [number, number]
        >
      )[kind]!;
      for (let y = 0; y < TILE; y++)
        for (let x = 0; x < TILE; x++) {
          const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
          if (
            r > 2 &&
            r < 14 &&
            Math.round(Math.atan2(y + 0.5 - cy, x + 0.5 - cx) * 6) % 2 === 0
          )
            tie(x, y);
          if (Math.abs(r - 4.5) < 0.8 || Math.abs(r - 11.5) < 0.8)
            px(x, y, look.bar);
          else if (look.mid && Math.abs(r - 8) < 0.6) px(x, y, look.mid);
        }
      return;
    }
    for (let a = 0; a < TILE; a++)
      for (let b = 0; b < TILE; b++) {
        const [x, y] = kind === "ns" ? [b, a] : [a, b];
        if (a % 4 === 1 || a % 4 === 2) if (b > 1 && b < 14) tie(x, y);
        if (b === 3 || b === 4 || b === 11 || b === 12) px(x, y, look.bar);
        else if (look.mid && (b === 7 || b === 8) && a % 4 !== 0)
          px(x, y, look.mid);
      }
  };
const RAIL_LOOKS: Record<string, RailLook> = {
  rail: { bar: "#a8a8b0" },
  powered_rail: { bar: "#d8b030", mid: "#5a1010" },
  powered_rail_on: { bar: "#e8c040", mid: "#ff3030" },
  detector_rail: { bar: "#a8a8b0", mid: "#6a6a6a" },
  detector_rail_on: { bar: "#a8a8b0", mid: "#ff3030" },
};
for (const [name, look] of Object.entries(RAIL_LOOKS)) {
  add(name, railPainter(look, "ns"));
  add(`${name}_ew`, railPainter(look, "ew"));
}
for (const s of [6, 7, 8, 9])
  add(`rail_c${s}`, railPainter(RAIL_LOOKS.rail!, s));
add("minecart", (px) => {
  for (let y = 5; y < 12; y++)
    for (let x = 2; x < 14; x++) px(x, y, y === 5 ? "#8a8e94" : "#5e6268");
  for (let x = 3; x < 13; x++) px(x, 6, "#3a3c40");
  for (const cx of [4, 11])
    for (let y = 12; y < 14; y++)
      for (let x = cx - 1; x <= cx; x++) px(x, y, "#2a2a2a");
});

add("lever", (px) => {
  for (let x = 4; x < 12; x++)
    for (let y = 11; y < 15; y++) px(x, y, "#7a7a7a"); // основание
  for (let t = 0; t < 8; t++) {
    px(6 + Math.floor(t / 2), 11 - t, "#8a6a3a"); // рукоять
    px(7 + Math.floor(t / 2), 11 - t, "#6a4a2a");
  }
});
