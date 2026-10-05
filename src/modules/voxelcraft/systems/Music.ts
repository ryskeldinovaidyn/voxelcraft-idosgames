// Музыка, как в Minecraft: время от времени (раз в несколько минут) звучит спокойная пьеса и снова
// тишина. Без файлов — пьеса сочиняется из сида (composePiece, чистая функция) и играется синтезом
// Web Audio. У каждого измерения свой лад: верхний мир — мажорная пентатоника, Пекло — низкий
// фригийский с гулом, Предел — целотонный, редкими высокими нотами. Смена измерения — пьеса затихает.
import { mulberry32 } from "../core/Noise";
import type { Audio } from "./Audio";

export type Mood = "overworld" | "inferno" | "beyond";

export interface Note {
  /** Начало, сек от старта пьесы. */
  t: number;
  freq: number;
  dur: number;
  /** Громкость 0..1 (общая громкость — у Music). */
  vol: number;
  wave: OscillatorType;
}

interface Style {
  root: number;
  /** Ступени лада в полутонах от тоники. */
  steps: readonly number[];
  wave: OscillatorType;
  /** Длина доли, сек. */
  beat: number;
  /** Сколько октав вверх гуляет мелодия. */
  range: number;
  /** Гул тоники октавой ниже под всей пьесой. */
  drone: boolean;
}

const STYLES: Record<Mood, Style> = {
  overworld: {
    root: 261.63,
    steps: [0, 2, 4, 7, 9],
    wave: "triangle",
    beat: 0.55,
    range: 2,
    drone: false,
  },
  inferno: {
    root: 110,
    steps: [0, 1, 3, 5, 7, 8, 10],
    wave: "sawtooth",
    beat: 0.8,
    range: 1,
    drone: true,
  },
  beyond: {
    root: 196,
    steps: [0, 2, 4, 6, 8, 10],
    wave: "sine",
    beat: 1.1,
    range: 2,
    drone: true,
  },
};

/** Пьеса: фразы по 4–8 нот, блуждающие по ступеням лада, паузы между ними, иногда бас. */
export function composePiece(mood: Mood, seed: number, length = 60): Note[] {
  const s = STYLES[mood];
  const rng = mulberry32(seed);
  const n = s.steps.length;
  const freqOf = (deg: number): number => {
    const oct = Math.floor(deg / n);
    return s.root * 2 ** (oct + s.steps[((deg % n) + n) % n]! / 12);
  };
  const notes: Note[] = [];
  let deg = Math.floor(rng() * n),
    t = 1.5;
  while (t < length) {
    const phrase = 4 + Math.floor(rng() * 5);
    for (let i = 0; i < phrase && t < length; i++) {
      deg = Math.max(0, Math.min(n * s.range, deg + Math.floor(rng() * 5) - 2));
      const dur = s.beat * (rng() < 0.25 ? 2 : 1);
      notes.push({
        t,
        freq: freqOf(deg),
        dur: dur * 1.8,
        vol: 0.5 + rng() * 0.3,
        wave: s.wave,
      });
      if (rng() < 0.3)
        notes.push({
          t,
          freq: freqOf(0) / 2,
          dur: dur * 3,
          vol: 0.3,
          wave: "sine",
        });
      t += dur;
    }
    t += s.beat * (2 + Math.floor(rng() * 4));
  }
  if (s.drone)
    notes.push({
      t: 0,
      freq: s.root / 2,
      dur: length,
      vol: 0.22,
      wave: "sine",
    });
  return notes;
}

const VOLUME = 0.06;

export class Music {
  enabled = true;
  /** Секунд тишины до следующей пьесы. */
  private wait = 30 + Math.random() * 40;
  private playing: { until: number; mood: Mood; master: GainNode } | null =
    null;

  constructor(private readonly audio: Audio) {}

  get status(): "off" | "playing" | "waiting" {
    return !this.enabled ? "off" : this.playing ? "playing" : "waiting";
  }

  /** Кадр игры: считать тишину, начать пьесу, заглушить при смене измерения. */
  tick(dt: number, mood: Mood): void {
    const ctx = this.audio.ctx;
    if (!ctx || ctx.state !== "running" || !this.enabled) return;
    if (this.playing) {
      if (this.playing.mood !== mood) this.stop();
      else if (ctx.currentTime >= this.playing.until) {
        this.playing = null;
        this.wait = 180 + Math.random() * 240; // как в Minecraft: минуты тишины между пьесами
      }
      return;
    }
    this.wait -= dt;
    if (this.wait <= 0) this.play(mood);
  }

  /** Сыграть новую пьесу сейчас. */
  play(mood: Mood, seed = (Math.random() * 0xffffffff) >>> 0): void {
    const ctx = this.audio.ctx;
    if (!ctx || ctx.state !== "running") return;
    const t0 = ctx.currentTime + 0.1;
    const master = ctx.createGain();
    master.gain.value = VOLUME;
    master.connect(ctx.destination);
    // простое эхо — «зал» для одиноких нот
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.35;
    const fb = ctx.createGain();
    fb.gain.value = 0.35;
    delay.connect(fb).connect(delay);
    delay.connect(master);
    // сид задан у пластинки (systems/Disc) — её мелодия всегда одна и та же
    const notes = composePiece(mood, seed);
    let end = 0;
    for (const n of notes) {
      const osc = ctx.createOscillator();
      osc.type = n.wave;
      osc.frequency.value = n.freq;
      const env = ctx.createGain();
      const s = t0 + n.t;
      env.gain.setValueAtTime(0.0001, s);
      env.gain.exponentialRampToValueAtTime(n.vol, s + 0.03);
      env.gain.exponentialRampToValueAtTime(0.0001, s + n.dur);
      let out: AudioNode = env;
      if (n.wave === "sawtooth") {
        const lp = ctx.createBiquadFilter(); // пильный — мягче, как гул Пекла
        lp.type = "lowpass";
        lp.frequency.value = 700;
        env.connect(lp);
        out = lp;
      }
      osc.connect(env);
      out.connect(master);
      out.connect(delay);
      osc.start(s);
      osc.stop(s + n.dur + 0.05);
      end = Math.max(end, n.t + n.dur);
    }
    this.playing = { until: t0 + end + 2, mood, master };
  }

  /** Плавно заглушить текущую пьесу (смена измерения, /music off). */
  stop(): void {
    const ctx = this.audio.ctx;
    const p = this.playing;
    this.playing = null;
    this.wait = 60 + Math.random() * 60;
    if (!ctx || !p) return;
    p.master.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
  }

  /** /music next: следующая пьеса — прямо сейчас. */
  next(): void {
    this.stop();
    this.wait = 0;
  }
}
