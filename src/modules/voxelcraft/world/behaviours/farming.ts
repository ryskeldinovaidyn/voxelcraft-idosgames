// Фермерство как в Minecraft: мотыга вспахивает землю, пашня намокает от воды в 4 блоках и сохнет
// без неё, посевы растут по случайным тикам при свете ≥ 9 (на мокрой пашне быстрее), костная
// мука двигает рост на 2–5 стадий, а по траве рассыпает траву и цветы.
import { events } from "../../core/EventBus";
import { BLOCKS, B } from "../../registry/Blocks";
import { behave, behaveWhere, type TickCtx } from "../blockBehaviour";
import { useItem, useTool } from "../itemUse";
import { growSapling, isSapling } from "./saplings";
import { growHugeMushroom } from "../../worldgen/mushrooms";
import { growHugeFungus } from "../../worldgen/fungus";
import type { ChunkManager } from "../ChunkManager";

/** Последняя стадия посева (мета 0..7) — от неё зависит урожай (systems/Mining.dropsOf). */
export const CROP_MAX_AGE = 7;
/** Влажность мокрой пашни. */
const WET = 7;
/** Высший бамбук в блоках. */
export const BAMBOO_MAX = 12;

/** Вода в квадрате 9×9 на уровне пашни или на блок выше — как в Minecraft. */
function hydrated(w: ChunkManager, x: number, y: number, z: number): boolean {
  for (let dy = 0; dy <= 1; dy++)
    for (let dx = -4; dx <= 4; dx++)
      for (let dz = -4; dz <= 4; dz++)
        if (w.getBlock(x + dx, y + dy, z + dz) === B.water) return true;
  return false;
}

/** Посев: форма crop или древний росток (*_crop — крестик со своим ростом, world/behaviours/sniffer). */
const isCrop = (id: number): boolean =>
  BLOCKS[id]?.shape === "crop" || !!BLOCKS[id]?.name.endsWith("_crop");

behave("farmland", {
  randomTick: (c) => {
    const rainedOn =
      c.world.raining && c.world.getLight(c.x, c.y + 1, c.z) >> 4 >= 15;
    if (rainedOn || hydrated(c.world, c.x, c.y, c.z)) {
      if (c.meta !== WET) c.world.setBlock(c.x, c.y, c.z, c.id, WET);
      return;
    }
    if (c.meta > 0) c.world.setBlock(c.x, c.y, c.z, c.id, c.meta - 1);
    else if (!isCrop(c.world.getBlock(c.x, c.y + 1, c.z)))
      c.world.setBlock(c.x, c.y, c.z, B.dirt!); // сухая пустая пашня зарастает обратно в землю
  },
  // твёрдый блок сверху превращает пашню в землю
  neighborChanged: (c) => {
    if (BLOCKS[c.world.getBlock(c.x, c.y + 1, c.z)]?.solid)
      c.world.setBlock(c.x, c.y, c.z, B.dirt!);
  },
});

/** Росток → плод, который он ставит рядом. */
const STEM_FRUIT: Record<string, string> = {
  pumpkin_stem: "pumpkin",
  melon_stem: "melon",
};

/** Созревший росток: если рядом ещё нет его плода — поставить плод на свободную соседнюю землю. */
function growFruit(c: TickCtx): void {
  const fruit = B[STEM_FRUIT[BLOCKS[c.id]?.name ?? ""] ?? ""];
  if (fruit === undefined) return;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  if (
    dirs.some(([dx, dz]) => c.world.getBlock(c.x + dx, c.y, c.z + dz) === fruit)
  )
    return;
  if (c.rng() > 0.3) return;
  const [dx, dz] = dirs[Math.floor(c.rng() * 4)]!;
  const below = c.world.getBlock(c.x + dx, c.y - 1, c.z + dz);
  if (c.world.getBlock(c.x + dx, c.y, c.z + dz) !== B.air) return;
  if (below !== B.dirt && below !== B.grass && below !== B.farmland) return;
  c.world.setBlock(c.x + dx, c.y, c.z + dz, fruit);
}

/**
 * Тростник и кактус растут столбиком до 3, бамбук — до 12: каждый случайный тик — стадия, на 15-й — блок
 * сверху.
 */
function growColumn(c: TickCtx): void {
  // сначала — держится ли (как в Minecraft: тростник без воды рядом осыпается на своём тике)
  events.emit("blockRecheck", { x: c.x, y: c.y, z: c.z });
  if (c.world.getBlock(c.x, c.y, c.z) !== c.id) return;
  if (c.world.getBlock(c.x, c.y + 1, c.z) !== B.air) return;
  const max = c.id === B.bamboo ? BAMBOO_MAX : 3;
  let h = 1;
  while (h < max && c.world.getBlock(c.x, c.y - h, c.z) === c.id) h++;
  if (h >= max) return;
  if (c.meta < 15) {
    c.world.setBlock(c.x, c.y, c.z, c.id, c.meta + 1);
    return;
  }
  c.world.setBlock(c.x, c.y, c.z, c.id, 0);
  c.world.setBlock(c.x, c.y + 1, c.z, c.id, 0);
}
behave("sugar_cane", { randomTick: growColumn });
behave("cactus", { randomTick: growColumn });
behave("bamboo", { randomTick: growColumn });

/** Возраст стручка какао — биты 2..3 меты (биты 0..1 — сторона ствола). */
export const COCOA_MAX_AGE = 2;
const cocoaAge = (meta: number): number => (meta >> 2) & 3;
// какао зреет на случайном тике: 3 стадии, шанс 20% за тик
behave("cocoa", {
  randomTick: (c) => {
    if (cocoaAge(c.meta) < COCOA_MAX_AGE && c.rng() < 0.2)
      c.world.setBlock(c.x, c.y, c.z, c.id, c.meta + 4);
  },
});

behaveWhere((d) => d.shape === "crop", {
  randomTick: (c) => {
    if (c.meta >= CROP_MAX_AGE) {
      growFruit(c);
      return;
    }
    // адский нарост растёт при любом свете, но медленно (как в Minecraft)
    if (c.id === B.inferno_wart) {
      if (c.rng() < 0.1) c.world.setBlock(c.x, c.y, c.z, c.id, c.meta + 1);
      return;
    }
    const l = c.world.getLight(c.x, c.y, c.z);
    if (Math.max(l >> 4, l & 15) < 9) return;
    const wet =
      c.world.getBlock(c.x, c.y - 1, c.z) === B.farmland &&
      c.world.getMeta(c.x, c.y - 1, c.z) > 0;
    if (c.rng() < (wet ? 1 / 3 : 1 / 7))
      c.world.setBlock(c.x, c.y, c.z, c.id, c.meta + 1);
  },
});

// мотыга: трава или земля с пустотой сверху → пашня (сухая; намокнет на случайном тике)
useTool("hoe", (c) => {
  if ((c.id !== B.grass && c.id !== B.dirt) || c.ny === -1) return false;
  if (c.world.getBlock(c.x, c.y + 1, c.z) !== B.air) return false;
  c.world.setBlock(c.x, c.y, c.z, B.farmland!, 0);
  c.wear(1);
  events.emit("till", { x: c.x, y: c.y, z: c.z });
  return true;
});

useItem("bone_meal", (c) => {
  if (isCrop(c.id)) {
    if (c.meta >= CROP_MAX_AGE) return false;
    const age = Math.min(CROP_MAX_AGE, c.meta + 2 + Math.floor(c.rng() * 4));
    c.world.setBlock(c.x, c.y, c.z, c.id, age);
  } else if (isSapling(c.id)) {
    // саженец: с шансом 45% сразу дерево (как в Minecraft), мука тратится в любом случае
    if (c.rng() < 0.45) growSapling(c.world, c.x, c.y, c.z, c.rng);
  } else if (c.id === B.grass) {
    for (let i = 0; i < 12; i++) {
      const x = c.x + Math.floor(c.rng() * 7) - 3,
        z = c.z + Math.floor(c.rng() * 7) - 3;
      if (
        c.world.getBlock(x, c.y, z) !== B.grass ||
        c.world.getBlock(x, c.y + 1, z) !== B.air
      )
        continue;
      const r = c.rng();
      c.world.setBlock(
        x,
        c.y + 1,
        z,
        r < 0.8 ? B.tallgrass! : r < 0.9 ? B.flower_yellow! : B.flower_red!,
      );
    }
  } else if (c.id === B.moss_block) {
    // мох расползается по камню и земле вокруг и зарастает коврами, азалиями и травой
    const spreads = new Set(
      [
        B.stone,
        B.deepslate,
        B.dirt,
        B.grass,
        B.granite,
        B.diorite,
        B.andesite,
      ].filter((v) => v !== undefined),
    );
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++)
        for (let dy = -1; dy <= 1; dy++) {
          const x = c.x + dx,
            y = c.y + dy,
            z = c.z + dz;
          const id = c.world.getBlock(x, y, z);
          if (
            (id !== B.moss_block && !spreads.has(id)) ||
            c.world.getBlock(x, y + 1, z) !== B.air
          )
            continue;
          if (id !== B.moss_block && c.rng() > 0.6) continue;
          c.world.setBlock(x, y, z, B.moss_block!);
          const r = c.rng();
          const top =
            r < 0.25
              ? B.moss_carpet
              : r < 0.3
                ? B.azalea
                : r < 0.33
                  ? B.flowering_azalea
                  : r < 0.45
                    ? B.tallgrass
                    : undefined;
          if (top !== undefined) c.world.setBlock(x, y + 1, z, top);
        }
  } else if (c.id === B.cocoa) {
    // какао: мука — на стадию вперёд
    if (cocoaAge(c.meta) >= COCOA_MAX_AGE) return false;
    c.world.setBlock(c.x, c.y, c.z, c.id, c.meta + 4);
  } else if (c.id === B.crimson_fungus || c.id === B.warped_fungus) {
    // гриб Пекла на своём нилии: с шансом 40% — огромный
    const warped = c.id === B.warped_fungus;
    if (
      c.world.getBlock(c.x, c.y - 1, c.z) !==
      (warped ? B.warped_nylium : B.crimson_nylium)
    )
      return false;
    if (c.rng() < 0.4) {
      const w = c.world;
      growHugeFungus(
        (x, y, z, id, soft) => {
          if (!soft || w.getBlock(x, y, z) === B.air) w.setBlock(x, y, z, id);
        },
        c.x,
        c.y,
        c.z,
        warped,
        c.rng,
      );
    }
  } else if (c.id === B.brown_mushroom || c.id === B.red_mushroom) {
    // гриб: с шансом 40% вырастает огромный (как в Minecraft), мука тратится в любом случае
    if (c.rng() < 0.4) {
      const w = c.world;
      growHugeMushroom(
        (x, y, z, id, soft) => {
          if (!soft || w.getBlock(x, y, z) === B.air) w.setBlock(x, y, z, id);
        },
        c.x,
        c.y,
        c.z,
        c.id === B.red_mushroom,
        c.rng,
      );
    }
  } else if (c.id === B.cave_vines) {
    c.world.setBlock(c.x, c.y, c.z, B.cave_vines_lit!); // лоза с ягодами
  } else return false;
  c.consume();
  events.emit("boneMeal", { x: c.x, y: c.y, z: c.z });
  return true;
});
