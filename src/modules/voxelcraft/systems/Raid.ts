// Набег на деревню, как в Minecraft: игрок с Дурным знамением входит в деревню — знамение сгорает и
// начинается набег. Пять волн разбойников (состав — WAVES) приходят с края деревни и идут к центру;
// волна кончается, когда её разбойники мертвы, следующая — через паузу. Все волны отбиты — победа
// (эффект «Герой деревни»: скидки у жителей); все жители деревни мертвы или прошло 40 минут —
// поражение. Здесь — чистая машина состояний, спавн и эффекты делает Game (_tickRaid).

export const RAID_WAVES = 5;
/** Пауза перед волной, сек. */
export const WAVE_PAUSE = 12;
/** Сколько длится набег до поражения, сек (40 минут, как в Minecraft). */
export const RAID_TIME_LIMIT = 2400;

/** Состав волн 1..5 — по таблице Minecraft для нормальной сложности (округлённо). */
export const WAVES: Record<string, readonly number[]> = {
  marauder: [4, 3, 3, 4, 4],
  axeman: [0, 2, 0, 1, 4],
  crusher: [0, 0, 1, 0, 1],
  witch: [0, 0, 0, 3, 0],
  conjurer: [0, 0, 0, 0, 1],
};

export type RaidEnd = "won" | "lost";

export class Raid {
  /** Номер текущей (последней начатой) волны; 0 — ещё не началась. */
  wave = 0;
  state: "waiting" | "fighting" = "waiting";
  /** Секунд до следующей волны (в ожидании). */
  t = 8;
  age = 0;
  /** Живые разбойники текущей волны (id мобов) и их общее здоровье при появлении — полоса HUD. */
  readonly raiders: number[] = [];
  hpTotal = 0;

  constructor(
    readonly center: { x: number; y: number; z: number },
    /** Уровень Дурного знамения — уровень Героя деревни после победы. */
    readonly level: number,
  ) {}

  /** Кто приходит в волне n (1..5). */
  static waveMobs(n: number): string[] {
    const out: string[] = [];
    for (const [type, counts] of Object.entries(WAVES))
      for (let i = counts[n - 1] ?? 0; i > 0; i--) out.push(type);
    return out;
  }

  add(id: number, hp: number): void {
    this.raiders.push(id);
    this.hpTotal += hp;
  }

  /**
   * Шаг набега: alive(id) — жив ли разбойник, villagers — сколько жителей деревни живы.
   * spawn — кого выпустить в новой волне; end — чем кончился набег.
   */
  tick(
    dt: number,
    alive: (id: number) => boolean,
    villagers: number,
  ): { spawn?: string[]; end?: RaidEnd } {
    this.age += dt;
    if ((villagers === 0 && this.wave > 0) || this.age > RAID_TIME_LIMIT)
      return { end: "lost" };
    for (let i = this.raiders.length - 1; i >= 0; i--)
      if (!alive(this.raiders[i]!)) this.raiders.splice(i, 1);
    if (this.state === "waiting") {
      this.t -= dt;
      if (this.t > 0) return {};
      this.wave++;
      this.state = "fighting";
      this.hpTotal = 0;
      return { spawn: Raid.waveMobs(this.wave) };
    }
    if (this.raiders.length) return {};
    if (this.wave >= RAID_WAVES) return { end: "won" };
    this.state = "waiting";
    this.t = WAVE_PAUSE;
    return {};
  }
}
