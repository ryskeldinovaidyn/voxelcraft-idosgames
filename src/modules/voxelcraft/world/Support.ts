// Опора блоков, как в Minecraft: факел держится за стену или пол, растение — за землю, дверь —
// за пол и свою вторую половину. Без опоры блок ломается (systems/BlockUpdates).
import { BLOCKS, B } from "../registry/Blocks";
import { scaffoldHolds } from "../systems/Scaffold";
import { scaffoldDistanceAt } from "./Scaffolding";
import { HANGING } from "../registry/blocks/caves";
import { DIR6, EXTENDED, FACING_DIRS, TOP, facingOf } from "../registry/meta";
import type { ChunkManager } from "./ChunkManager";

/**
 * Портал заливается клетка за клеткой, а опора проверяется сразу на каждой записи: без флага
 * первые клетки гасли бы, пока соседние ещё пусты. Ставит world/Portal.ts на время заливки.
 */
export const portalState = { filling: false };

/** Держится ли блок `id` с метой `meta` в клетке. Незагруженная опора считается на месте. */
export function isSupported(
  world: ChunkManager,
  x: number,
  y: number,
  z: number,
  id: number,
  meta: number,
): boolean {
  const def = BLOCKS[id];
  if (!def) return true;
  const at = (ax: number, ay: number, az: number): number =>
    world.getBlockOrUnloaded(ax, ay, az);
  const solid = (ax: number, ay: number, az: number): boolean => {
    const b = at(ax, ay, az);
    return b === -1 || (BLOCKS[b]?.solid ?? false);
  };
  const same = (ax: number, ay: number, az: number): boolean => {
    const b = at(ax, ay, az);
    return b === -1 || b === id;
  };
  // тростник: на тростнике или на траве/земле/песке, рядом с которыми вода (как в Minecraft)
  if (def.name === "sugar_cane") {
    const b = at(x, y - 1, z);
    if (b === -1 || b === id) return true;
    if (b !== B.grass && b !== B.dirt && b !== B.sand && b !== B.red_sand)
      return false;
    for (const [dx, dz] of FACING_DIRS) {
      const w = at(x + dx, y - 1, z + dz);
      if (w === -1 || w === B.water) return true;
    }
    return false;
  }
  // бамбук: на бамбуке или на траве, земле, песке, гравии — воды не нужно
  if (def.name === "bamboo") {
    const b = at(x, y - 1, z);
    return (
      b === -1 ||
      b === id ||
      b === B.grass ||
      b === B.dirt ||
      b === B.sand ||
      b === B.red_sand ||
      b === B.gravel
    );
  }
  // ламинария: на стебле ламинарии или на твёрдом дне
  if (def.name === "kelp" || def.name === "kelp_plant") {
    const b = at(x, y - 1, z);
    return (
      b === -1 ||
      b === B.kelp_plant ||
      b === B.kelp ||
      (!!BLOCKS[b]?.solid && !BLOCKS[b]?.liquid)
    );
  }
  // эхоцвет: стебель — на стебле или камне Предела, а над пустотой — вбок от соседнего стебля;
  // цветок — только на стебле или камне
  if (def.name === "echo_plant" || def.name === "echo_flower") {
    const b = at(x, y - 1, z);
    if (b === -1 || b === B.echo_plant || b === B.beyond_stone) return true;
    if (def.name === "echo_flower" || b !== 0) return false;
    return FACING_DIRS.some(
      ([dx, dz]) => at(x + dx, y, z + dz) === B.echo_plant,
    );
  }
  // древние ростки (факелоцвет, кувшинка) — только на пашне, как посевы
  if (def.name.endsWith("_crop")) {
    const b = at(x, y - 1, z);
    return b === -1 || b === B.farmland;
  }
  // лягушачья икра лежит на воде
  if (def.name === "frogspawn") {
    const b = at(x, y - 1, z);
    return b === -1 || b === B.water;
  }
  // сталагмит — на твёрдом полу или на сталагмите; сталактит держится сам: падает он по
  // behaviours/dripstone (с уроном тому, кто под ним), а не ломается здесь
  if (def.name === "pointed_dripstone") {
    const b = at(x, y - 1, z);
    return b === -1 || b === id || (!!BLOCKS[b]?.solid && !BLOCKS[b]?.liquid);
  }
  if (def.name === "pointed_dripstone_down") return true;
  // пещерные лозы и спороцвет висят: на твёрдом блоке сверху или на лозе
  if (HANGING.has(def.name)) {
    const b = at(x, y + 1, z);
    return (
      b === -1 ||
      b === B.cave_vines ||
      b === B.cave_vines_lit ||
      (!!BLOCKS[b]?.solid && !BLOCKS[b]?.liquid)
    );
  }
  // почки и друзы аметиста растут на любой грани и держатся за любой твёрдый сосед
  if (def.name.endsWith("_amethyst_bud") || def.name === "amethyst_cluster")
    return DIR6.some(([dx, dy, dz]) => solid(x + dx, y + dy, z + dz));
  switch (def.shape) {
    case "cross":
    case "carpet":
    case "repeater":
    case "comparator":
    case "rail":
    case "snow_layer":
      return solid(x, y - 1, z);
    case "crop": {
      // посев живёт только на пашне: пашня стала землёй — посев ломается
      const b = at(x, y - 1, z);
      return (
        b === -1 ||
        b === (def.name === "inferno_wart" ? B.soul_sand : B.farmland)
      );
    }
    case "torch": {
      if (meta === 0) return solid(x, y - 1, z);
      const [dx, dz] = FACING_DIRS[(meta - 1) & 3]!;
      return solid(x + dx, y, z + dz);
    }
    case "piston_head": {
      // головка держится на выдвинутом поршне того же направления позади
      const [dx, dy, dz] = DIR6[meta & 7]!;
      const b = at(x - dx, y - dy, z - dz);
      if (b === -1) return true;
      const bm = world.getMeta(x - dx, y - dy, z - dz);
      return (
        (b === B.piston || b === B.sticky_piston) &&
        (bm & 7) === (meta & 7) &&
        (bm & EXTENDED) !== 0
      );
    }
    case "lever":
    case "button": {
      // как факел, но с битом «включено» (0x8): 0 — на полу, 1..4 — на стене
      const m = meta & 7;
      if (m === 0) return solid(x, y - 1, z);
      const [dx, dz] = FACING_DIRS[(m - 1) & 3]!;
      return solid(x + dx, y, z + dz);
    }
    case "scaffold":
      // лес держится не «на чём-то», а на расстоянии до опоры (systems/Scaffold)
      return scaffoldHolds(scaffoldDistanceAt(world, x, y, z));
    case "wall_mounted":
    case "ladder": {
      const [dx, dz] = FACING_DIRS[facingOf(meta)]!;
      return solid(x + dx, y, z + dz);
    }
    case "door":
      return meta & TOP
        ? same(x, y - 1, z)
        : solid(x, y - 1, z) && same(x, y + 1, z);
    case "bed": {
      const [dx, dz] = FACING_DIRS[facingOf(meta)]!;
      const s = meta & TOP ? -1 : 1;
      return same(x + dx * s, y, z + dz * s);
    }
    case "lantern":
      return meta & TOP ? solid(x, y + 1, z) : solid(x, y - 1, z);
    case "candle":
      return solid(x, y - 1, z);
    case "pod": {
      // стручок какао держится только за ствол тропического дерева
      const [dx, dz] = FACING_DIRS[facingOf(meta)]!;
      const b = at(x + dx, y, z + dz);
      return b === -1 || b === B.jungle_log;
    }
    case "fire": {
      // огонь держится на твёрдом полу или рядом с горючим
      if (solid(x, y - 1, z)) return true;
      for (const [dx, dy, dz] of [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ] as const) {
        const b = at(x + dx, y + dy, z + dz);
        if (b === -1 || BLOCKS[b]?.flammable) return true;
      }
      return false;
    }
    case "portal": {
      // соседи в плоскости портала — портал или обсидиан рамки; иначе гаснет (каскадом, как в Minecraft)
      if (portalState.filling) return true;
      const alongX = (meta & 3) !== 2;
      for (const [dx, dy, dz] of alongX
        ? ([
            [1, 0, 0],
            [-1, 0, 0],
            [0, 1, 0],
            [0, -1, 0],
          ] as const)
        : ([
            [0, 0, 1],
            [0, 0, -1],
            [0, 1, 0],
            [0, -1, 0],
          ] as const)) {
        const b = at(x + dx, y + dy, z + dz);
        if (b !== -1 && b !== id && b !== B.obsidian) return false;
      }
      return true;
    }
    case "cactus": {
      // на песке или кактусе, и ни одного твёрдого блока вплотную сбоку (как в Minecraft)
      const b = at(x, y - 1, z);
      if (b !== -1 && b !== id && b !== B.sand && b !== B.red_sand)
        return false;
      for (const [dx, dz] of FACING_DIRS)
        if (at(x + dx, y, z + dz) !== -1 && solid(x + dx, y, z + dz))
          return false;
      return true;
    }
    default:
      return true;
  }
}
