// Звук: синтез через Web Audio, без файлов. Подписан на события шины —
// добавление нового звука = ещё одна подписка, игровая логика не знает об аудио.
import { events } from "../core/EventBus";
import { INSTRUMENTS, noteFrequency } from "./NoteBlock";

export class Audio {
  ctx: AudioContext | null;

  constructor() {
    this.ctx = null; // создаётся после первого user gesture (autoplay policy)

    events.on("blockBreak", () => this.noise(0.12, 900, 0.25));
    events.on("blockPlace", () => this.noise(0.06, 1600, 0.2));
    events.on("blockToggle", () => this.noise(0.09, 450, 0.2));
    events.on("explosion", () => {
      this.noise(0.6, 300, 0.5);
      this.blip(80, 0.5, "sawtooth", 0.25, 30);
    });
    events.on("mobAttack", () => this.noise(0.08, 400, 0.18));
    events.on("bowShoot", () => this.blip(420, 0.12, "triangle", 0.12, 180));
    events.on("arrowHit", () => this.noise(0.05, 1200, 0.1));
    events.on("xpPickup", () => this.blip(1200, 0.06, "sine", 0.08, 1800));
    events.on("levelUp", () => {
      this.blip(660, 0.15, "triangle", 0.12, 880);
      this.blip(990, 0.2, "triangle", 0.1, 1320);
    });
    events.on("mobFed", () => this.blip(520, 0.1, "sine", 0.1, 700));
    events.on("bucketFill", () => this.noise(0.15, 700, 0.15));
    events.on("bucketEmpty", () => this.noise(0.18, 600, 0.15));
    // пещеры и горы: козий рог, таран, звуковой удар Стража, крик крикуна, упавший сталактит
    events.on("goatHorn", () => this.blip(260, 1.4, "sawtooth", 0.14, 200));
    events.on("goatRam", () => this.noise(0.12, 300, 0.25));
    events.on("sonicBoom", () => this.blip(80, 0.7, "sawtooth", 0.3, 40));
    events.on("sculkShriek", () => this.blip(900, 0.9, "square", 0.06, 1600));
    events.on("dripstoneFall", () => this.noise(0.1, 1400, 0.2));
    events.on("goatScream", () => this.blip(1100, 0.5, "sawtooth", 0.08, 700));
    events.on("brushStroke", () => this.noise(0.15, 2200, 0.12));
    events.on("frogEat", () => this.blip(300, 0.12, "sine", 0.12, 900));
    events.on("snifferSniff", () => this.noise(0.4, 500, 0.15));
    events.on("snifferDig", () => this.noise(0.3, 250, 0.2));
    events.on("windBurst", () => this.noise(0.25, 1800, 0.2));
    events.on("maceSmash", () => this.blip(90, 0.35, "square", 0.25, 45));
    events.on("vaultOpen", () => this.blip(660, 0.3, "sine", 0.12, 990));
    events.on("trialReward", () => this.blip(520, 0.4, "triangle", 0.12, 1040));
    events.on("copperWax", () => this.noise(0.2, 3000, 0.1));
    events.on("copperScrape", () => this.noise(0.2, 1600, 0.15));
    events.on("bulbToggle", () => this.blip(740, 0.08, "square", 0.08, 740));
    events.on("armorTrimmed", () => this.blip(440, 0.3, "triangle", 0.12, 880));
    events.on("bundleInsert", () => this.noise(0.08, 900, 0.1));
    events.on("bundleRemove", () => this.noise(0.1, 700, 0.12));
    events.on("candleLit", () => this.noise(0.1, 2600, 0.08));
    events.on("snowballThrow", () => this.noise(0.06, 2000, 0.08));
    events.on("snowballHit", () => this.noise(0.08, 1200, 0.1));
    events.on("snowGolemBuilt", () => this.blip(520, 0.2, "sine", 0.1, 780));
    events.on("barter", () => this.blip(740, 0.15, "triangle", 0.1, 560));
    events.on("crossbowLoad", () => this.noise(0.12, 900, 0.18));
    events.on("crossbowShoot", () =>
      this.blip(520, 0.1, "triangle", 0.14, 200),
    );
    events.on("tridentThrow", () => this.noise(0.2, 1400, 0.16));
    events.on("shieldBlock", () => this.noise(0.08, 500, 0.22));
    events.on("brushLoot", () => this.blip(880, 0.15, "sine", 0.1, 1320));
    events.on("fireLit", () => this.noise(0.12, 2400, 0.15));
    events.on("tntFuse", () => this.noise(0.4, 3000, 0.12));
    events.on("itemThrow", () => this.noise(0.05, 1800, 0.08));
    events.on("playerDied", () => this.blip(220, 0.6, "sawtooth", 0.2, 60));
    events.on("till", () => this.noise(0.1, 500, 0.16));
    events.on("boneMeal", () => this.blip(900, 0.1, "sine", 0.08, 1400));
    events.on("leverClick", () => this.blip(1400, 0.05, "square", 0.08, 900));
    events.on("buttonClick", () => this.blip(1600, 0.04, "square", 0.07, 1100));
    events.on("pistonMove", () => this.noise(0.14, 700, 0.2));
    events.on("dispense", () => this.noise(0.08, 1300, 0.15));
    events.on("fishCast", () => this.noise(0.2, 1600, 0.1));
    // нотный блок: высота ноты — мета блока, тембр — блок под ним (systems/NoteBlock)
    events.on(
      "noteBlock",
      ({ pitch, instrument }: { pitch: number; instrument?: string }) => {
        const inst = INSTRUMENTS[instrument ?? "harp"] ?? INSTRUMENTS.harp!;
        const f = noteFrequency(pitch);
        if (inst.noise) this.noise(inst.seconds, f * 2, 0.16);
        else this.blip(f, inst.seconds, inst.wave, 0.12, f);
      },
    );
    events.on("discEject", () => this.noise(0.12, 800, 0.12));
    // колокол: долгий звон с обертоном; картина — шорох холста
    events.on("bellRing", () => {
      this.blip(880, 1.6, "sine", 0.16, 870);
      this.blip(1320, 1.2, "sine", 0.08, 1310);
    });
    events.on("paintingTurn", () => this.noise(0.1, 1500, 0.1));
    events.on("fishSplash", () => this.noise(0.25, 900, 0.12));
    events.on("fishBite", () => {
      this.noise(0.2, 700, 0.25);
      this.blip(400, 0.1, "sine", 0.1, 250);
    });
    events.on("fishCaught", () => this.blip(880, 0.12, "triangle", 0.12, 1320));
    events.on("mobTamed", () => {
      this.blip(660, 0.12, "sine", 0.12, 990);
      this.blip(990, 0.16, "sine", 0.1, 1320);
    });
    events.on("tameFail", () => this.noise(0.12, 600, 0.12));
    events.on("potionSplash", () => {
      this.noise(0.18, 2600, 0.18);
      this.blip(1200, 0.1, "sine", 0.06, 600);
    });
    events.on("mobSit", () => this.blip(520, 0.06, "sine", 0.08, 400));
    events.on("dispenseFail", () => this.blip(900, 0.05, "square", 0.06, 700));
    events.on("trade", () => {
      this.blip(700, 0.1, "triangle", 0.12, 1050);
      this.blip(1050, 0.12, "triangle", 0.1, 1400);
    });
    events.on("rainPatter", ({ level }: { level: number }) =>
      this.noise(0.35, 2200, 0.025 * level),
    );
    events.on("lightning", () => {
      this.noise(1.4, 260, 0.5);
      this.blip(55, 1.2, "sawtooth", 0.2, 30);
    });
    events.on("mobTeleport", () => this.blip(300, 0.25, "sine", 0.12, 1200));
    events.on("toolBreak", () => {
      this.noise(0.18, 2600, 0.25);
      this.blip(900, 0.15, "square", 0.1, 300);
    });
    events.on("itemPickup", () => this.blip(880, 0.08, "triangle", 0.15, 1320));
    events.on("playerHurt", () => this.blip(160, 0.2, "sawtooth", 0.2, 110));
    events.on("mobHurt", () => this.blip(520, 0.1, "square", 0.12, 380));
    events.on("playerStep", () => this.noise(0.045, 500, 0.06));
    events.on("craft", () => this.blip(660, 0.1, "triangle", 0.12, 990));
    events.on("armSwing", () => this.noise(0.04, 2400, 0.04));
    events.on("playerAte", () => {
      this.noise(0.09, 700, 0.14);
      this.blip(300, 0.12, "sine", 0.1, 420);
    });
  }

  /** Вызвать из обработчика клика (оверлей «Играть»). */
  unlock() {
    if (!this.ctx)
      this.ctx = new (
        window.AudioContext ||
        (window as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext!
      )();
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  /** Teardown: у браузера ограниченное число AudioContext — старый нужно закрыть. */
  dispose() {
    void this.ctx?.close();
    this.ctx = null;
  }

  /** Тональный писк с глиссандо. */
  blip(
    freq: number,
    dur: number,
    type: OscillatorType = "square",
    vol = 0.15,
    glideTo: number | null = null,
  ) {
    if (!this.ctx || this.ctx.state !== "running") return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** Шумовой щелчок через фильтр (ломание/шаги). */
  noise(dur: number, filterFreq: number, vol = 0.2) {
    if (!this.ctx || this.ctx.state !== "running") return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, (dur * this.ctx.sampleRate) | 0);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++)
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start(t);
  }
}
