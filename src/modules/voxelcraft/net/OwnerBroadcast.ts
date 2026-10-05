// Обязанности ВЛАДЕЛЬЦА измерения (net/sim): каждые два тика сверить свои сущности с тем, что уже
// разослано, и отправить разницу — появились (снимок), сдвинулись (поза), исчезли. Блочные сущности
// (сундуки, печи) — раз в полсекунды, по изменению состояния.
import type { EntityManager, NetEntitySnap } from "../entities/EntityManager";
import type { BlockEntities, BlockEntity } from "../world/BlockEntities";
import type { EntPose } from "./protocol";

/** Сдвиг меньше этого (квадрат, блоки²) позу не шлёт: стоящий моб не тратит трафик. */
const MOVE_EPS2 = 0.0004;

interface Sent {
  x: number;
  y: number;
  z: number;
  yaw: number;
  flags: number;
  extra: number;
  /** Отпечаток «вида» (снимок без позы): сменился — снимок заново (остригли, окрасили, назвали). */
  look: string;
}

export interface EntityDiff {
  spawns: [number, NetEntitySnap][];
  poses: EntPose[];
  removes: number[];
}

/** Отпечаток вида: снимок без координат, скорости и здоровья (они меняются постоянно). */
function lookOf(s: NetEntitySnap): string {
  const { pos: _p, ...rest } = s as NetEntitySnap & {
    vel?: unknown;
    hp?: unknown;
    age?: unknown;
  };
  const r = rest as Record<string, unknown>;
  delete r.vel;
  delete r.hp;
  delete r.pickupDelay;
  delete r.fuse;
  return JSON.stringify(r);
}

export class OwnerBroadcast {
  private readonly sent = new Map<number, Sent>();
  private readonly beSent = new Map<string, string>();

  /** Забыть разосланное: следующий diff отдаст ВСЁ заново (новый игрок, смена владельца). */
  reset(): void {
    this.sent.clear();
    this.beSent.clear();
  }

  diffEntities(em: EntityManager): EntityDiff {
    const out: EntityDiff = { spawns: [], poses: [], removes: [] };
    const alive = new Set<number>();
    for (const e of em.entities.values()) {
      if (e.dead) continue;
      const snap = em.netSnapshot(e);
      if (!snap) continue;
      alive.add(e.id);
      const pose = em.netPose(e);
      const look = lookOf(snap);
      const prev = this.sent.get(e.id);
      if (!prev || prev.look !== look) {
        out.spawns.push([e.id, snap]);
        this.sent.set(e.id, {
          x: e.pos.x,
          y: e.pos.y,
          z: e.pos.z,
          ...pose,
          look,
        });
        continue;
      }
      const moved =
        (prev.x - e.pos.x) ** 2 +
          (prev.y - e.pos.y) ** 2 +
          (prev.z - e.pos.z) ** 2 >
        MOVE_EPS2;
      if (
        moved ||
        Math.abs(prev.yaw - pose.yaw) > 0.02 ||
        prev.flags !== pose.flags ||
        prev.extra !== pose.extra
      ) {
        out.poses.push({
          id: e.id,
          x: e.pos.x,
          y: e.pos.y,
          z: e.pos.z,
          ...pose,
        });
        prev.x = e.pos.x;
        prev.y = e.pos.y;
        prev.z = e.pos.z;
        prev.yaw = pose.yaw;
        prev.flags = pose.flags;
        prev.extra = pose.extra;
      }
    }
    for (const id of [...this.sent.keys()])
      if (!alive.has(id)) {
        this.sent.delete(id);
        out.removes.push(id);
      }
    return out;
  }

  /** Все сущности как снимки — полный снимок для вошедшего в измерение. */
  fullEntities(em: EntityManager): [number, NetEntitySnap][] {
    const out: [number, NetEntitySnap][] = [];
    for (const e of em.entities.values()) {
      if (e.dead) continue;
      const s = em.netSnapshot(e);
      if (s) out.push([e.id, s]);
    }
    return out;
  }

  /** Изменившиеся блочные сущности (и исчезнувшие — как null). */
  diffBlockEntities(
    be: BlockEntities,
  ): { key: string; be: BlockEntity | null }[] {
    const out: { key: string; be: BlockEntity | null }[] = [];
    const seen = new Set<string>();
    for (const b of be.map.values()) {
      const k = b.x + "," + b.y + "," + b.z;
      seen.add(k);
      const j = JSON.stringify(b.state);
      if (this.beSent.get(k) === j) continue;
      this.beSent.set(k, j);
      out.push({
        key: k,
        be: {
          type: b.type,
          x: b.x,
          y: b.y,
          z: b.z,
          state: JSON.parse(j) as BlockEntity["state"],
        },
      });
    }
    for (const k of [...this.beSent.keys()])
      if (!seen.has(k)) {
        this.beSent.delete(k);
        out.push({ key: k, be: null });
      }
    return out;
  }

  /** Принять состояние как уже разосланное (реплика прислала — не отражать обратно ей же лишний раз). */
  markBe(b: BlockEntity | null, key: string): void {
    if (b) this.beSent.set(key, JSON.stringify(b.state));
    else this.beSent.delete(key);
  }
}
