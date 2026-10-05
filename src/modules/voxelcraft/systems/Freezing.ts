// Замерзание в снегу-порохе, как в Minecraft: внутри копится холод, за 7 с игрок промерзает — дальше
// 1 урона раз в 2 с. Снаружи оттаивает вдвое быстрее, огонь отогревает сразу. Любая кожаная броня —
// не мёрзнешь (Game._tickFreeze; иней на экране — HUD.frost).
export const FREEZE_FULL = 7;
const HIT_EVERY = 2;

export class Freezing {
  /** Накопленный холод, с (0..FREEZE_FULL). */
  t = 0;
  private hitT = 0;

  /** Насколько промёрз (0..1) — сила инея на экране. */
  get level(): number {
    return this.t / FREEZE_FULL;
  }

  /**
   * Шаг: inside — в снегу-порохе, immune — кожаная броня или креатив, burning — горит.
   * @returns урон за шаг
   */
  tick(dt: number, inside: boolean, immune: boolean, burning: boolean): number {
    if (burning) this.t = 0;
    else if (inside && !immune) this.t = Math.min(FREEZE_FULL, this.t + dt);
    else this.t = Math.max(0, this.t - dt * 2);
    if (this.t < FREEZE_FULL) {
      this.hitT = 0;
      return 0;
    }
    this.hitT += dt;
    if (this.hitT < HIT_EVERY) return 0;
    this.hitT -= HIT_EVERY;
    return 1;
  }
}
