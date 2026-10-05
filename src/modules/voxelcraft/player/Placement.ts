// Постановка блока по правилам Minecraft: какая клетка, какая мета (сторона, половина, ось) и
// сколько клеток (дверь и кровать — две). Чистая функция мира и попадания луча — её зовёт тиковая
// половина Interaction и тесты.
import { BLOCKS, B } from "../registry/Blocks";
import { HANGING } from "../registry/blocks/caves";
import {
  FACING_DIRS,
  SLAB_DOUBLE,
  TOP,
  dir6OfFacing,
  facingFromYaw,
  facingOfVector,
  opposite,
} from "../registry/meta";
import type { ChunkManager } from "../world/ChunkManager";
import { scaffoldDistanceAt } from "../world/Scaffolding";
import { scaffoldHolds } from "../systems/Scaffold";
import { railShapeFor } from "../world/Rails";
import type { RaycastHit } from "../world/Raycast";

export interface PlacedCell {
  x: number;
  y: number;
  z: number;
  id: number;
  meta: number;
}

/** Можно ли поставить в клетку: пусто или заменяемое (трава, жидкость, снежный слой). */
export function canReplace(
  world: ChunkManager,
  x: number,
  y: number,
  z: number,
): boolean {
  const id = world.getBlock(x, y, z);
  return id === 0 || (BLOCKS[id]?.replaceable ?? false);
}

/**
 * План постановки блока `blockId` по попаданию луча; null — поставить нельзя.
 * @param yaw — поворот игрока (сторона ступеней, двери, лицевая сторона печи)
 * @param pitch — наклон взгляда (поршень, поставленный при взгляде круто вниз, смотрит вверх)
 */
export function planPlacement(
  world: ChunkManager,
  blockId: number,
  hit: Pick<RaycastHit, "x" | "y" | "z" | "id" | "nx" | "ny" | "nz" | "hy">,
  yaw: number,
  pitch = 0,
): PlacedCell[] | null {
  const def = BLOCKS[blockId]!;
  const hitDef = BLOCKS[hit.id]!;
  // клик по заменяемому блоку (трава) ставит прямо в него, как по верху блока под ним
  const inPlace = hitDef.replaceable && !hitDef.liquid;
  const x = hit.x + (inPlace ? 0 : hit.nx),
    y = hit.y + (inPlace ? 0 : hit.ny),
    z = hit.z + (inPlace ? 0 : hit.nz);
  const ny = inPlace ? 1 : hit.ny;
  const fracY = hit.hy - Math.floor(hit.hy);
  const upperHalf = ny === -1 || (ny === 0 && fracY > 0.5);
  const look = facingFromYaw(yaw);
  const solidAt = (ax: number, ay: number, az: number): boolean =>
    BLOCKS[world.getBlock(ax, ay, az)]?.solid ?? false;
  const one = (meta: number): PlacedCell[] => [{ x, y, z, id: blockId, meta }];
  // блоки «в воде» (морская трава, кораллы, огурцы, проводник) — только в воду: клетка остаётся водой
  if (def.waterlogged && world.getBlock(x, y, z) !== B.water) return null;
  // свеча — только на пол (форма lantern умеет и висеть — фонарь)
  if (def.name === "candle")
    return solidAt(x, y - 1, z) && canReplace(world, x, y, z) ? one(0) : null;
  // древние ростки — только на пашню
  if (def.name.endsWith("_crop"))
    return world.getBlock(x, y - 1, z) === B.farmland &&
      canReplace(world, x, y, z)
      ? one(0)
      : null;
  // острый капельник: по потолку — сталактит, по полу — сталагмит (за блок или за такой же капельник)
  if (def.name === "pointed_dripstone") {
    const down = ny === -1;
    const id = down ? B.pointed_dripstone_down! : blockId;
    const ay = down ? y + 1 : y - 1;
    const a = world.getBlock(x, ay, z);
    const ok = a === id || (solidAt(x, ay, z) && !BLOCKS[a]?.liquid);
    return ok && canReplace(world, x, y, z) ? [{ x, y, z, id, meta: 0 }] : null;
  }

  if (def.shape === "slab") {
    // плита на плиту того же вида — двойная
    if (!inPlace && hit.id === blockId) {
      const s = world.getMeta(hit.x, hit.y, hit.z) & 3;
      if ((s === 0 && hit.ny === 1) || (s === 1 && hit.ny === -1))
        return [
          { x: hit.x, y: hit.y, z: hit.z, id: blockId, meta: SLAB_DOUBLE },
        ];
    }
    if (world.getBlock(x, y, z) === blockId) {
      const s = world.getMeta(x, y, z) & 3;
      return s === SLAB_DOUBLE
        ? null
        : [{ x, y, z, id: blockId, meta: SLAB_DOUBLE }];
    }
  }
  if (!canReplace(world, x, y, z)) return null;

  switch (def.shape) {
    case "slab":
      return one(upperHalf ? 1 : 0);
    case "stairs":
      return one(look | (upperHalf ? TOP : 0));
    case "lever":
    case "button":
    case "torch":
      if (ny === 1) return solidAt(x, y - 1, z) ? one(0) : null;
      if (ny === 0) return one(facingOfVector(-hit.nx, -hit.nz) + 1);
      return null;
    case "wall_mounted":
    case "ladder":
      return ny === 0 ? one(facingOfVector(-hit.nx, -hit.nz)) : null;
    case "scaffold": {
      // мета леса — расстояние до опоры; дальше семи ставить некуда (systems/Scaffold)
      const dist = scaffoldDistanceAt(world, x, y, z);
      return scaffoldHolds(dist) ? one(dist) : null;
    }
    case "pod":
      // стручок какао — только на бок ствола тропического дерева, лицом к нему
      return ny === 0 && world.getBlock(hit.x, hit.y, hit.z) === B.jungle_log
        ? one(facingOfVector(-hit.nx, -hit.nz))
        : null;
    case "door":
      if (!solidAt(x, y - 1, z) || !canReplace(world, x, y + 1, z)) return null;
      return [
        { x, y, z, id: blockId, meta: look },
        { x, y: y + 1, z, id: blockId, meta: look | TOP },
      ];
    case "bed": {
      const [dx, dz] = FACING_DIRS[look]!;
      if (
        !canReplace(world, x + dx, y, z + dz) ||
        !solidAt(x, y - 1, z) ||
        !solidAt(x + dx, y - 1, z + dz)
      )
        return null;
      return [
        { x, y, z, id: blockId, meta: look },
        { x: x + dx, y, z: z + dz, id: blockId, meta: look | TOP },
      ];
    }
    case "trapdoor":
      // клик по стене — петли у стены; по полу/потолку — по взгляду
      return one(
        (ny === 0 ? facingOfVector(-hit.nx, -hit.nz) : look) |
          (upperHalf ? TOP : 0),
      );
    case "fence_gate":
      return one(look);
    case "chest":
      return one(opposite(look));
    case "lantern":
      return one(ny === -1 ? TOP : 0);
    case "crop":
      // посевы — на пашню, адский нарост — на песок душ
      return world.getBlock(x, y - 1, z) ===
        (def.name === "inferno_wart" ? B.soul_sand : B.farmland)
        ? one(0)
        : null;
    case "cross":
    case "carpet":
      // пещерная лоза (светящимися ягодами) и спороцвет — под потолок или под лозу
      if (HANGING.has(def.name)) {
        const up = world.getBlock(x, y + 1, z);
        return solidAt(x, y + 1, z) ||
          up === B.cave_vines ||
          up === B.cave_vines_lit
          ? one(0)
          : null;
      }
      // морская трава — только в воду (клетка остаётся водой — waterlogged)
      if (def.waterlogged)
        return world.getBlock(x, y, z) === B.water && solidAt(x, y - 1, z)
          ? one(0)
          : null;
      return solidAt(x, y - 1, z) ? one(0) : null;
    case "piston":
      // лицом к игроку; при крутом взгляде вниз — лицом вверх, вверх — лицом вниз
      if (pitch < -0.8) return one(1);
      if (pitch > 0.8) return one(0);
      return one(dir6OfFacing(opposite(look)));
    case "rail":
      // форма — по соседним рельсам (повороты — только у обычных)
      return solidAt(x, y - 1, z)
        ? one(railShapeFor(world, x, y, z, def.name === "rail"))
        : null;
    case "repeater":
    case "comparator":
      return solidAt(x, y - 1, z) ? one(look) : null; // сигнал уходит туда, куда смотрит игрок
    case "hopper":
      // клик по боку блока — носик в этот блок, иначе вниз
      return one(ny === 0 ? facingOfVector(-hit.nx, -hit.nz) + 1 : 0);
    case "cube":
      if (def.facing6)
        return one(
          pitch < -0.8 ? 1 : pitch > 0.8 ? 0 : dir6OfFacing(opposite(look)),
        );
      if (def.axis) return one(hit.nx !== 0 ? 1 : hit.nz !== 0 ? 2 : 0);
      if (def.tex?.front) return one(opposite(look)); // лицом к игроку (печь, тыква)
      return one(0);
    default:
      return one(0);
  }
}
