// Нюхач: раз в 2–4 минуты (первый раз — через 1–3) принюхивается и, если стоит на траве, земле, мху или
// грязи, 4 с роет — выкапывает семена факелоцвета или стручок кувшинки (событие mobDrop). Детёныши не
// роют.
import { events } from "../core/EventBus";
import { BLOCKS } from "../registry/Blocks";
import type { Mob } from "./Mob";
import type { MobCtx } from "./MobBrain";

export const SNIFF_DIG = 4;
const DIGGABLE = new Set(["grass", "dirt", "moss_block", "mud", "farmland"]);

/** Рытьё; true — нюхач роет (обычный мозг пропускается). */
export function sniffTick(m: Mob, c: MobCtx, dt: number): boolean {
  if (m.baby) return false;
  if (m.sniffCd === 0) m.sniffCd = 60 + Math.random() * 120;
  if (m.digT > 0) {
    m.digT -= dt;
    m.speed = 0;
    m.state = "idle";
    if (m.digT <= 0) {
      const seed = Math.random() < 0.5 ? "torchflower_seeds" : "pitcher_pod";
      events.emit("snifferDig", { entity: m, item: seed });
      events.emit("mobDrop", {
        x: m.pos.x,
        y: m.pos.y + 0.5,
        z: m.pos.z,
        item: seed,
      });
    }
    return true;
  }
  m.sniffCd -= dt;
  if (m.sniffCd > 0 || !m.onGround) return false;
  m.sniffCd = 120 + Math.random() * 120;
  const below =
    BLOCKS[
      c.world.getBlock(
        Math.floor(m.pos.x),
        Math.floor(m.pos.y - 0.5),
        Math.floor(m.pos.z),
      )
    ]?.name ?? "";
  if (!DIGGABLE.has(below)) return false;
  m.digT = SNIFF_DIG;
  events.emit("snifferSniff", { entity: m });
  return true;
}
