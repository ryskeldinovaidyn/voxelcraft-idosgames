// Скалк и вибрации, как в Minecraft (глубокая тьма). Вибрации — шаги игрока без приседа, сломанные и
// поставленные блоки, взрывы (Game). Сенсор скалка в 8 блоках от вибрации загорается на 1.5 с (сигнал
// красного камня 15); если вибрацию сделал игрок, крикуны в 8 блоках от сенсора кричат: Тьма на 12 с
// игроку в 40 блоках и уровень предупреждения (не чаще раза в 10 с). Четвёртое предупреждение от
// крикуна, умеющего звать (CAN_SUMMON — поставлен генератором), будит Стража рядом, если другого нет в
// 48 блоках. Уровень падает на 1 за 10 минут. Страж слышит вибрации в 16 блоках (entities/WardenBrain).
// Катализатор: существо, убитое игроком в 8 блоках от него, оставляет пятно скалка.
import { events } from "../core/EventBus";
import { BLOCKS, B } from "../registry/Blocks";
import { CAN_SUMMON } from "../registry/blocks/sculk";
import { wardenHear } from "../entities/WardenBrain";
import type { Mob } from "../entities/Mob";
import type { Player } from "../player/Player";
import type { ChunkManager } from "../world/ChunkManager";

export const SENSOR_RANGE = 8;
export const WARDEN_HEARING = 16;
export const SENSOR_ON_TIME = 1.5;
const SHRIEK_COOLDOWN = 5;
const WARNING_COOLDOWN = 10;
const WARNING_DECAY = 600;
/** На каком предупреждении крикун будит Стража. */
export const SUMMON_AT = 4;
const DARKNESS_RANGE = 40;
const WARDEN_NEAR = 48;

export interface SculkDeps {
  world(): ChunkManager;
  player(): Player;
  /** Живые Стражи измерения. */
  wardens(): Mob[];
  /** Поставить Стража (Game — с выходом из земли). */
  summon(x: number, y: number, z: number): Mob | null;
}

const key = (x: number, y: number, z: number): string => `${x},${y},${z}`;

let sculky: Set<number> | null = null;
const isSculk = (id: number): boolean =>
  (sculky ??= new Set(
    [
      "sculk",
      "sculk_vein",
      "sculk_catalyst",
      "sculk_sensor",
      "sculk_sensor_on",
      "sculk_shrieker",
    ].map((n) => B[n]!),
  )).has(id);

export class Sculk {
  /** Уровень предупреждения крикунов (0..4). */
  warning = 0;
  private t = 0;
  private warnAt = -Infinity;
  private decayT = 0;
  /** Горящие сенсоры → когда погаснут. */
  private readonly active = new Map<string, number>();
  private readonly shriekAt = new Map<string, number>();

  constructor(private readonly d: SculkDeps) {}

  tick(dt: number): void {
    this.t += dt;
    const w = this.d.world();
    for (const [k, until] of this.active) {
      if (until > this.t) continue;
      this.active.delete(k);
      const [x, y, z] = k.split(",").map(Number) as [number, number, number];
      if (w.getBlock(x, y, z) === B.sculk_sensor_on)
        w.setBlock(x, y, z, B.sculk_sensor!);
    }
    if (this.warning > 0 && (this.decayT += dt) >= WARNING_DECAY) {
      this.warning--;
      this.decayT = 0;
    }
  }

  /** Вибрация в точке: зажечь сенсоры рядом, от игрока — поднять крикунов; Стражи слышат. @returns сколько сенсоров */
  vibrate(px: number, py: number, pz: number, byPlayer: boolean): number {
    const w = this.d.world();
    const x = Math.floor(px),
      y = Math.floor(py),
      z = Math.floor(pz);
    let n = 0;
    this._around(x, y, z, (sx, sy, sz, id) => {
      if (id !== B.sculk_sensor) return;
      w.setBlock(sx, sy, sz, B.sculk_sensor_on!);
      this.active.set(key(sx, sy, sz), this.t + SENSOR_ON_TIME);
      n++;
      events.emit("sculkSensor", { x: sx, y: sy, z: sz });
      if (byPlayer)
        this._around(
          sx,
          sy,
          sz,
          (hx, hy, hz, hid) =>
            void (hid === B.sculk_shrieker && this.shriek(hx, hy, hz)),
        );
    });
    for (const m of this.d.wardens())
      if (
        Math.hypot(m.pos.x - px, m.pos.y - py, m.pos.z - pz) <= WARDEN_HEARING
      )
        wardenHear(m, px, py, pz, byPlayer);
    return n;
  }

  /** Крикун кричит (сенсор рядом поймал игрока или игрок наступил на него). false — ещё не остыл. */
  shriek(x: number, y: number, z: number): boolean {
    const k = key(x, y, z);
    if ((this.shriekAt.get(k) ?? -Infinity) > this.t) return false;
    this.shriekAt.set(k, this.t + SHRIEK_COOLDOWN);
    const w = this.d.world(),
      p = this.d.player();
    events.emit("sculkShriek", { x, y, z });
    if (p.dead || p.mode === "creative") return true;
    if (
      Math.hypot(p.pos.x - x - 0.5, p.pos.y - y, p.pos.z - z - 0.5) <=
      DARKNESS_RANGE
    )
      p.addEffect("darkness", 12);
    if (
      !(w.getMeta(x, y, z) & CAN_SUMMON) ||
      this.t - this.warnAt < WARNING_COOLDOWN
    )
      return true;
    this.warnAt = this.t;
    this.decayT = 0;
    this.warning = Math.min(SUMMON_AT, this.warning + 1);
    events.emit("wardenWarning", { level: this.warning });
    if (
      this.warning >= SUMMON_AT &&
      !this.d
        .wardens()
        .some((m) => Math.hypot(m.pos.x - x, m.pos.z - z) < WARDEN_NEAR)
    )
      if (this._summonNear(x, y, z)) this.warning = 0;
    return true;
  }

  /**
   * Смерть существа (убитого игроком): если в 8 блоках катализатор — скалк расползается от места смерти
   * на столько блоков, сколько опыта (до 20), с прожилками и изредка сенсором или крикуном.
   */
  onDeath(
    px: number,
    py: number,
    pz: number,
    xp: number,
    rng: () => number = Math.random,
  ): number {
    const w = this.d.world();
    const x = Math.floor(px),
      y = Math.floor(py),
      z = Math.floor(pz);
    let near = false;
    this._around(
      x,
      y,
      z,
      (_x, _y, _z, id) => void (near ||= id === B.sculk_catalyst),
    );
    if (!near) return 0;
    const charge = Math.max(1, Math.min(20, Math.round(xp)));
    let n = 0;
    for (let i = 0; i < charge * 8 && n < charge; i++) {
      const X = x + Math.floor(rng() * 7) - 3,
        Y = y + Math.floor(rng() * 5) - 3,
        Z = z + Math.floor(rng() * 7) - 3;
      const id = w.getBlock(X, Y, Z),
        def = BLOCKS[id];
      if (
        !def?.solid ||
        !def.opaque ||
        isSculk(id) ||
        def.blockEntity ||
        !Number.isFinite(def.hardness) ||
        def.hardness >= 50
      )
        continue;
      if (w.getBlock(X, Y + 1, Z) !== 0) continue;
      w.setBlock(X, Y, Z, B.sculk!);
      n++;
      const r = rng();
      if (r < 0.02) w.setBlock(X, Y + 1, Z, B.sculk_sensor!);
      else if (r < 0.03)
        w.setBlock(X, Y + 1, Z, B.sculk_shrieker!, 0); // такой крикун Стража не зовёт
      else if (r < 0.2) w.setBlock(X, Y + 1, Z, B.sculk_vein!);
    }
    if (n) events.emit("sculkSpread", { x, y, z, n });
    return n;
  }

  /** Клетки шара радиуса SENSOR_RANGE вокруг (x, y, z). */
  private _around(
    x: number,
    y: number,
    z: number,
    fn: (x: number, y: number, z: number, id: number) => void,
  ): void {
    const w = this.d.world(),
      R = SENSOR_RANGE;
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++)
        for (let dz = -R; dz <= R; dz++)
          if (dx * dx + dy * dy + dz * dz <= R * R)
            fn(x + dx, y + dy, z + dz, w.getBlock(x + dx, y + dy, z + dz));
  }

  /** Страж вылезает рядом с крикуном: клетка с полом и тремя блоками воздуха над ним. */
  private _summonNear(x: number, y: number, z: number): Mob | null {
    const w = this.d.world();
    const free = (ax: number, ay: number, az: number): boolean => {
      const def = BLOCKS[w.getBlock(ax, ay, az)];
      return !def || (!def.solid && !def.liquid);
    };
    for (let r = 1; r <= 5; r++)
      for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          for (let dy = -3; dy <= 3; dy++) {
            const X = x + dx,
              Y = y + dy,
              Z = z + dz;
            if (
              !BLOCKS[w.getBlock(X, Y - 1, Z)]?.solid ||
              !free(X, Y, Z) ||
              !free(X, Y + 1, Z) ||
              !free(X, Y + 2, Z)
            )
              continue;
            const m = this.d.summon(X + 0.5, Y, Z + 0.5);
            if (m) events.emit("wardenSummoned", { x: X, y: Y, z: Z });
            return m;
          }
        }
    return null;
  }
}
