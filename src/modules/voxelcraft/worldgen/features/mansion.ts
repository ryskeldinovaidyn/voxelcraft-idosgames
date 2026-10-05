// Особняк (лесной особняк Minecraft) в тёмном лесу: двухэтажный дом 31×25 из тёмного дуба на
// булыжном основании — брёвна-колонны через 6 блоков, окна-панели, крыша уступами. На каждом этаже
// коридор вдоль дома с ковровой дорожкой и по пять комнат с каждой стороны: библиотеки, спальни с
// коврами, кладовые с сундуками, залы. Лестница-ladder в западном конце коридора. Жители —
// секирники по комнатам и два ворожея наверху (селит Game, как жителей деревни; сами они больше не
// появляются). План — чистая функция сида.
import { hashString, mulberry32 } from "../../core/Noise";
import { B } from "../../registry/Blocks";
import { ITEMS } from "../../registry/Items";
import { WOOD_SPECIES } from "../../registry/blocks/wood";
import type { ItemStack } from "../../types";
import type { TempleTerrain } from "./temple";
import type { Resident, Village } from "./village";

/** Особняки редки: не больше одного на регион 640×640 и только в тёмном лесу. */
export const MANSION_REGION = 640;
const MARGIN = 64;
const CHANCE = 0.8;
/** Полуразмеры корпуса: 31 × 25. */
const HX = 15;
const HZ = 12;
const STOREY = 6;
const CARPETS = [
  "red",
  "blue",
  "gray",
  "brown",
  "green",
  "purple",
  "light_gray",
  "cyan",
];

export interface Mansion extends Village {
  box: [number, number, number, number, number, number];
  /** Сундуки: "x,y,z". */
  chests: Set<string>;
}

export const inMansion = (
  m: Mansion,
  x: number,
  y: number,
  z: number,
): boolean =>
  x >= m.box[0] &&
  x <= m.box[3] &&
  y >= m.box[1] &&
  y <= m.box[4] &&
  z >= m.box[2] &&
  z <= m.box[5];

export function planMansion(
  t: TempleTerrain,
  seed: number,
  rx: number,
  rz: number,
): Mansion | null {
  const rng = mulberry32(hashString(`ow-mansion:${seed}:${rx},${rz}`));
  if (rng() > CHANCE) return null;
  const span = MANSION_REGION - 2 * MARGIN;
  // тёмный лес занимает не весь регион — несколько попыток найти в нём место
  for (let i = 0; i < 16; i++) {
    const cx = rx * MANSION_REGION + MARGIN + Math.floor(rng() * span);
    const cz = rz * MANSION_REGION + MARGIN + Math.floor(rng() * span);
    const h = t.heightAt(cx, cz);
    if (t.biomeAt(cx, cz, h) === "dark_forest" && h > t.waterLevel + 1)
      return build(t, rng, rx, rz, cx, cz, h);
  }
  return null;
}

function build(
  t: TempleTerrain,
  rng: () => number,
  rx: number,
  rz: number,
  cx: number,
  cz: number,
  h: number,
): Mansion {
  const wood = (id: string) =>
    WOOD_SPECIES.find((s) => s.id === id) ?? WOOD_SPECIES[0]!;
  const dark = wood("dark_oak"),
    birch = wood("birch");
  const log = B[dark.log],
    planks = B[dark.planks],
    light = B[birch.planks];
  const ops = new Map<string, number[]>();
  const box: Mansion["box"] = [
    cx - HX - 3,
    Infinity,
    cz - HZ - 3,
    cx + HX + 3,
    -Infinity,
    cz + HZ + 3,
  ];
  const set = (
    x: number,
    y: number,
    z: number,
    id: number | undefined,
    meta = 0,
  ): void => {
    if (id === undefined || y < 1) return;
    const k = (x >> 4) + "," + (z >> 4);
    let a = ops.get(k);
    if (!a) ops.set(k, (a = []));
    a.push(x, y, z, id, meta);
    box[1] = Math.min(box[1], y);
    box[4] = Math.max(box[4], y);
  };
  const y0 = h;
  const top = y0 + 2 * STOREY;

  // участок: булыжное основание под домом, газон вокруг, расчистка на высоту дома с крышей
  for (let dx = -HX - 3; dx <= HX + 3; dx++)
    for (let dz = -HZ - 3; dz <= HZ + 3; dz++) {
      const x = cx + dx,
        z = cz + dz;
      const inside = Math.abs(dx) <= HX && Math.abs(dz) <= HZ;
      for (let y = t.heightAt(x, z) + 1; y < h; y++)
        set(x, y, z, inside ? B.cobblestone : B.dirt);
      set(x, h, z, inside ? B.cobblestone : B.grass);
      for (let y = h + 1; y <= top + 6; y++) set(x, y, z, B.air);
    }

  const chests = new Set<string>();
  const residents: Resident[] = [];
  const lights: [number, number, number][] = [];
  /** Шаг 6 от угла: 0 — колонна или перегородка, 3 — середина комнаты. */
  const px = (dx: number) => (dx + HX) % 6;
  const pz = (dz: number) => (dz + HZ) % 6;
  const ladderX = cx - HX + 2;

  for (let s = 0; s < 2; s++) {
    const base = y0 + s * STOREY;
    for (let dx = -HX; dx <= HX; dx++)
      for (let dz = -HZ; dz <= HZ; dz++) {
        const x = cx + dx,
          z = cz + dz;
        const ex = Math.abs(dx) === HX,
          ez = Math.abs(dz) === HZ;
        set(x, base, z, s === 0 ? light : planks); // пол
        for (let k = 1; k < STOREY; k++) {
          const y = base + k;
          if (ex || ez) {
            const along = ez ? px(dx) : pz(dz);
            const post = along === 0;
            const window =
              !post && (k === 2 || k === 3) && along >= 2 && along <= 4;
            const door = s === 0 && dz === -HZ && Math.abs(dx) <= 1 && k <= 3;
            set(
              x,
              y,
              z,
              post ? log : door ? B.air : window ? B.glass_pane : planks,
            );
          } else if (Math.abs(dz) === 2 || (Math.abs(dz) > 2 && px(dx) === 0)) {
            // стены комнат: вдоль коридора и перегородки; дверные проёмы — посередине комнаты
            const doorway = Math.abs(dz) === 2 && px(dx) === 3 && k <= 2;
            set(
              x,
              y,
              z,
              doorway
                ? B.air
                : Math.abs(dz) === 2 && px(dx) === 0
                  ? log
                  : planks,
            );
          }
        }
      }

    // комнаты: по пять с каждой стороны коридора
    for (const side of [-1, 1])
      for (let r = 0; r < 5; r++) {
        const mx = cx - HX + 3 + r * 6; // середина комнаты по x
        const wall = cz + side * (HZ - 1); // ряд у наружной стены
        const mid = cz + side * 7;
        const kind = Math.floor(rng() * 4); // 0 библиотека, 1 спальня, 2 кладовая, 3 зал
        const carpet =
          B[`${CARPETS[Math.floor(rng() * CARPETS.length)]}_carpet`];
        if (kind === 1 || kind === 3)
          for (let dx = -2; dx <= 2; dx++)
            for (let d = 3; d <= HZ - 1; d++)
              set(mx + dx, base + 1, cz + side * d, carpet);
        if (kind === 0)
          for (let dx = -2; dx <= 2; dx++)
            for (let k = 1; k <= 3; k++)
              set(mx + dx, base + k, wall, B.bookshelf);
        if (kind === 2) {
          set(mx - 2, base + 1, wall, B.hay_block);
          set(mx + 2, base + 1, wall, B.pumpkin);
        }
        if (kind === 3) set(mx, base + 1, mid, B.crafting_table);
        if (kind === 2 || (kind === 1 && rng() < 0.5)) {
          set(mx, base + 1, wall, B.chest);
          chests.add(`${mx},${base + 1},${wall}`);
        }
        lights.push([mx, base + STOREY, mid]);
        if (rng() < 0.45)
          residents.push({
            type: "axeman",
            x: mx + 0.5,
            y: base + 1,
            z: mid + 0.5,
          });
      }

    // ковровая дорожка по коридору (кроме клетки лестницы), свет над ней через 6 блоков
    for (let dx = -HX + 1; dx <= HX - 1; dx++)
      for (let dz = -1; dz <= 1; dz++)
        if (!(cx + dx === ladderX && dz === 1))
          set(cx + dx, base + 1, cz + dz, B.red_carpet);
    for (let dx = -12; dx <= 12; dx += 6)
      lights.push([cx + dx, base + STOREY, cz]);
  }

  // лестница на второй этаж: у стены коридора (+z), сквозь перекрытие
  for (let y = y0 + 1; y <= y0 + STOREY; y++)
    set(ladderX, y, cz + 1, B.ladder, 2);

  // крыша уступами: нижний слой с навесом в блок, дальше каждый на 2 уже
  for (let k = 0; k <= 4; k++) {
    const ix = HX + 1 - 2 * k,
      iz = HZ + 1 - 2 * k;
    for (let dx = -ix; dx <= ix; dx++)
      for (let dz = -iz; dz <= iz; dz++)
        set(
          cx + dx,
          top + k,
          cz + dz,
          k === 0 && (Math.abs(dx) === ix || Math.abs(dz) === iz)
            ? log
            : planks,
        );
  }
  for (const [x, y, z] of lights) set(x, y, z, B.glowstone);

  // стража у входа и два ворожея наверху
  residents.push({ type: "axeman", x: cx + 0.5, y: y0 + 1, z: cz - HZ + 2.5 });
  residents.push({
    type: "conjurer",
    x: cx - 6 + 0.5,
    y: y0 + STOREY + 1,
    z: cz + 0.5,
  });
  residents.push({
    type: "conjurer",
    x: cx + 6 + 0.5,
    y: y0 + STOREY + 1,
    z: cz + 0.5,
  });
  return {
    id: `mansion:${rx},${rz}`,
    x: cx,
    y: y0 + 1,
    z: cz,
    ops,
    residents,
    box,
    chests,
  };
}

/** Добыча сундука особняка: [предмет, от, до, вес] — по таблице лесного особняка Minecraft. */
export const LOOT: readonly (readonly [string, number, number, number])[] = [
  ["bread", 1, 1, 20],
  ["wheat", 1, 4, 20],
  ["bucket", 1, 1, 10],
  ["redstone", 1, 4, 15],
  ["coal", 1, 4, 15],
  ["pumpkin_seeds", 2, 4, 10],
  ["beetroot_seeds", 2, 4, 10],
  ["iron_ingot", 1, 4, 10],
  ["gold_ingot", 1, 4, 5],
  ["name_tag", 1, 1, 20],
  ["saddle", 1, 1, 20],
  ["golden_apple", 1, 1, 15],
  ["lead", 1, 1, 20],
  ["diamond_hoe", 1, 1, 5],
  ["chainmail_chestplate", 1, 1, 5],
  ["diamond_chestplate", 1, 1, 2],
  ["book", 1, 3, 10],
  ["string", 1, 8, 10],
  ["bone", 1, 8, 10],
  ["rotten_flesh", 1, 8, 10],
  ["vex_armor_trim_smithing_template", 1, 1, 4],
];

export function mansionLoot(
  seed: number,
  x: number,
  y: number,
  z: number,
): (ItemStack | null)[] {
  const rng = mulberry32(hashString(`mansion-loot:${seed}:${x},${y},${z}`));
  const pool = LOOT.filter(([n]) => ITEMS[n]);
  const total = pool.reduce((s, e) => s + e[3], 0);
  const slots = new Array<ItemStack | null>(27).fill(null);
  for (let i = 5 + Math.floor(rng() * 4); i > 0 && pool.length; i--) {
    let r = rng() * total;
    let e = pool[0]!;
    for (const p of pool) {
      r -= p[3];
      if (r <= 0) {
        e = p;
        break;
      }
    }
    let slot = Math.floor(rng() * 27);
    while (slots[slot]) slot = (slot + 1) % 27;
    slots[slot] = {
      item: e[0],
      count: e[1] + Math.floor(rng() * (e[2] - e[1] + 1)),
    };
  }
  return slots;
}
