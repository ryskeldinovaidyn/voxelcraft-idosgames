// Поршни, как в Minecraft: запитанный поршень выдвигает головку и толкает перед собой до 12 блоков;
// нетвёрдое (факел, трава, вода) ломается, неподвижное (бедрок, обсидиан, порталы, блоки с
// содержимым — сундук, печь) не даёт выдвинуться. Липкий при втягивании тянет блок за головкой.
// Сущности поршень пока не двигает. Когда срабатывать — решает поведение (behaviours/redstone.ts).
import { CONFIG } from "../config";
import { events } from "../core/EventBus";
import { BLOCKS, B } from "../registry/Blocks";
import { DIR6, EXTENDED } from "../registry/meta";
import type { ChunkManager } from "./ChunkManager";

/** Сколько блоков поршень толкает за раз. */
export const PUSH_LIMIT = 12;

const IMMOVABLE = new Set([
  "bedrock",
  "obsidian",
  "inferno_portal",
  "beyond_portal",
  "rim_frame",
  "piston_head",
  "dragon_egg",
]);

export const isPiston = (id: number): boolean =>
  id === B.piston || id === B.sticky_piston;

/** Что поршень делает с клеткой: пусто, сдвинуть, сломать, упереться. */
function pushKind(
  w: ChunkManager,
  x: number,
  y: number,
  z: number,
): "air" | "move" | "break" | "stop" {
  if (y < 0 || y >= CONFIG.chunk.sy) return "stop";
  const id = w.getBlockOrUnloaded(x, y, z);
  if (id === -1) return "stop";
  if (id === 0) return "air";
  const d = BLOCKS[id]!;
  if (d.liquid || d.replaceable) return "break";
  if (d.hardness === Infinity || d.blockEntity || IMMOVABLE.has(d.name))
    return "stop";
  if (isPiston(id) && w.getMeta(x, y, z) & EXTENDED) return "stop";
  if (!d.solid || d.shape === "door" || d.shape === "bed") return "break";
  return "move";
}

/** Выдвинуть поршень; false — упёрся (больше 12 блоков или неподвижный блок). */
export function extendPiston(
  w: ChunkManager,
  x: number,
  y: number,
  z: number,
  id: number,
  meta: number,
): boolean {
  const d = meta & 7;
  const [dx, dy, dz] = DIR6[d]!;
  const line: [number, number, number, number, number][] = [];
  let cx = x + dx,
    cy = y + dy,
    cz = z + dz;
  for (;;) {
    const k = pushKind(w, cx, cy, cz);
    if (k === "stop") return false;
    if (k === "air") break;
    if (k === "break") {
      // жидкость просто вытесняется, остальное ломается с дропом (systems/BlockUpdates)
      if (BLOCKS[w.getBlock(cx, cy, cz)]!.liquid)
        w.setBlock(cx, cy, cz, B.air!);
      else events.emit("blockDestroy", { x: cx, y: cy, z: cz });
      break;
    }
    if (line.length === PUSH_LIMIT) return false;
    line.push([cx, cy, cz, w.getBlock(cx, cy, cz), w.getMeta(cx, cy, cz)]);
    cx += dx;
    cy += dy;
    cz += dz;
  }
  for (let i = line.length - 1; i >= 0; i--) {
    const [lx, ly, lz, lid, lm] = line[i]!;
    w.setBlock(lx + dx, ly + dy, lz + dz, lid, lm);
  }
  // сперва поршень, потом головка: головка держится только на выдвинутом поршне (world/Support)
  w.setBlock(x, y, z, id, meta | EXTENDED);
  w.setBlock(
    x + dx,
    y + dy,
    z + dz,
    B.piston_head!,
    d | (id === B.sticky_piston ? EXTENDED : 0),
  );
  events.emit("pistonMove", { x, y, z, out: true });
  return true;
}

/** Втянуть поршень; липкий тянет за собой блок, стоявший перед головкой. */
export function retractPiston(
  w: ChunkManager,
  x: number,
  y: number,
  z: number,
  id: number,
  meta: number,
): void {
  const [dx, dy, dz] = DIR6[meta & 7]!;
  const hx = x + dx,
    hy = y + dy,
    hz = z + dz;
  if (w.getBlock(hx, hy, hz) === B.piston_head) w.setBlock(hx, hy, hz, B.air!);
  w.setBlock(x, y, z, id, meta & ~EXTENDED);
  if (id === B.sticky_piston && w.getBlock(hx, hy, hz) === 0) {
    const fx = hx + dx,
      fy = hy + dy,
      fz = hz + dz;
    if (pushKind(w, fx, fy, fz) === "move") {
      const fid = w.getBlock(fx, fy, fz),
        fm = w.getMeta(fx, fy, fz);
      w.setBlock(fx, fy, fz, B.air!);
      w.setBlock(hx, hy, hz, fid, fm);
    }
  }
  events.emit("pistonMove", { x, y, z, out: false });
}
