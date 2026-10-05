// Погода, как в Minecraft: ясно → дождь (иногда гроза) → ясно по таймерам. Дождь сереет небо и гасит
// небесный свет для спавна на 3 уровня, гроза — на 8 (монстры выходят и днём). Капли падают только
// над открытыми небу столбами — под крышей и в пещере сухо. Дождь гасит огонь и мочит пашню
// (поведения читают ChunkManager.raining), нежить под ним не горит. В грозу бьют молнии: вспышка,
// зигзаг, 5 урона рядом (Game) и огонь в точке удара. Только в измерениях с небом — это решает Game.
import * as THREE from "three";
import { CONFIG } from "../config";
import { events } from "../core/EventBus";
import { BLOCKS, B } from "../registry/Blocks";
import type { ChunkManager } from "../world/ChunkManager";

export type WeatherKind = "clear" | "rain" | "thunder";
export const WEATHER_KINDS: readonly WeatherKind[] = [
  "clear",
  "rain",
  "thunder",
];

/** Длительности, секунд: ясно, дождь; доля дождей-гроз. */
const CLEAR_SEC: [number, number] = [600, 1800];
const RAIN_SEC: [number, number] = [180, 480];
const THUNDER_CHANCE = 0.3;
/** Пауза между молниями в грозу, секунд; радиус ударов вокруг игрока. */
const STRIKE_SEC: [number, number] = [4, 14];
const STRIKE_R = 40;

const DROPS = 900;
const AREA = 16;
const TOP = 14;
const FALL = 20;

/** Пол для капли: верх первого твёрдого блока или жидкости под `top`; null — столб не под небом. */
function floorOf(
  w: ChunkManager,
  x: number,
  z: number,
  top: number,
): number | null {
  const xi = Math.floor(x),
    zi = Math.floor(z);
  for (let y = Math.floor(top); y > top - 48 && y >= 0; y--) {
    const id = w.getBlockOrUnloaded(xi, y, zi);
    if (id === -1) return null;
    const d = BLOCKS[id];
    if (id !== 0 && d && (d.solid || d.liquid))
      return w.getLight(xi, y + 1, zi) >> 4 >= 15 ? y + 1 : null;
  }
  return null;
}

export class Weather {
  kind: WeatherKind = "clear";
  /** Секунд до смены погоды. */
  left: number;
  /** Сила дождя и грозы 0..1 — плавно следуют за kind. */
  rain = 0;
  thunder = 0;
  /** Вспышка молнии 0..1 (гаснет за четверть секунды). */
  flash = 0;
  private _strikeT: number;
  private _patterT = 0;
  readonly drops: THREE.LineSegments;
  private readonly _pos: Float32Array;
  private readonly _floor = new Float32Array(DROPS);
  private readonly _wait = new Float32Array(DROPS);
  private _bolt: THREE.Line | null = null;
  private _boltT = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly rng: () => number = Math.random,
  ) {
    this.left = this._len(CLEAR_SEC);
    this._strikeT = this._len(STRIKE_SEC);
    this._pos = new Float32Array(DROPS * 6).fill(-1e4);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this._pos, 3));
    this.drops = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({
        color: 0xa8bcd8,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    this.drops.frustumCulled = false;
    this.drops.visible = false;
    scene.add(this.drops);
  }

  private _len([a, b]: [number, number]): number {
    return a + this.rng() * (b - a);
  }

  get raining(): boolean {
    return this.kind !== "clear";
  }

  /** На сколько уровней погода гасит небесный свет для спавна мобов. */
  get darken(): number {
    return 3 * this.rain + 5 * this.thunder;
  }

  /** Поставить погоду (команда, сон): на `seconds` или на обычную длительность. */
  set(kind: WeatherKind, seconds?: number): void {
    this.kind = kind;
    this.left = seconds ?? this._len(kind === "clear" ? CLEAR_SEC : RAIN_SEC);
  }

  /**
   * Тик: таймер погоды, плавная сила, молнии. `world` — мир с небом (null в Пекле и Пределе: там
   * погоды нет, таймер всё равно идёт, как в Minecraft).
   */
  tick(dt: number, world: ChunkManager | null, px: number, pz: number): void {
    this.left -= dt;
    if (this.left <= 0) {
      if (this.kind === "clear")
        this.set(this.rng() < THUNDER_CHANCE ? "thunder" : "rain");
      else this.set("clear");
    }
    const step = (v: number, to: number) =>
      v + Math.sign(to - v) * Math.min(Math.abs(to - v), dt / 5);
    this.rain = step(this.rain, this.raining ? 1 : 0);
    this.thunder = step(this.thunder, this.kind === "thunder" ? 1 : 0);
    if (!world) return;
    if (this.rain > 0.3) {
      this._patterT -= dt;
      if (this._patterT <= 0) {
        this._patterT = 0.3;
        events.emit("rainPatter", { level: this.rain });
      }
    }
    if (this.thunder > 0.9) {
      this._strikeT -= dt;
      if (this._strikeT <= 0) {
        this._strikeT = this._len(STRIKE_SEC);
        this.strike(
          world,
          Math.floor(px + (this.rng() * 2 - 1) * STRIKE_R),
          Math.floor(pz + (this.rng() * 2 - 1) * STRIKE_R),
        );
      }
    }
  }

  /** Молния в столб (x, z): в верхний блок, огонь на твёрдом верху. false — чанк не загружен. */
  strike(world: ChunkManager, x: number, z: number): boolean {
    for (let y = CONFIG.chunk.sy - 1; y > 0; y--) {
      const id = world.getBlockOrUnloaded(x, y, z);
      if (id === -1) return false;
      if (id === 0) continue;
      const top = y + 1;
      if (BLOCKS[id]?.solid && world.getBlock(x, top, z) === 0)
        world.setBlock(x, top, z, B.fire!, 0);
      this._makeBolt(x + 0.5, top, z + 0.5);
      this.flash = 1;
      events.emit("lightning", { x: x + 0.5, y: top, z: z + 0.5 });
      return true;
    }
    return false;
  }

  private _makeBolt(x: number, y: number, z: number): void {
    this._clearBolt();
    const pts: THREE.Vector3[] = [];
    let bx = x,
      bz = z;
    for (let h = 70; h >= 0; h -= 5) {
      pts.push(new THREE.Vector3(bx, y + h, bz));
      bx = x + (this.rng() - 0.5) * 3;
      bz = z + (this.rng() - 0.5) * 3;
    }
    pts[pts.length - 1]!.set(x, y, z);
    this._bolt = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0xf0f4ff, fog: false }),
    );
    this._bolt.frustumCulled = false;
    this.scene.add(this._bolt);
    this._boltT = 0.3;
  }

  private _clearBolt(): void {
    if (!this._bolt) return;
    this.scene.remove(this._bolt);
    this._bolt.geometry.dispose();
    (this._bolt.material as THREE.Material).dispose();
    this._bolt = null;
  }

  /** Кадр: капли вокруг глаз игрока, вспышка и зигзаг молнии. `world` null — без неба. */
  frame(dt: number, eye: THREE.Vector3, world: ChunkManager | null): void {
    this.flash = Math.max(0, this.flash - dt * 4);
    if (this._bolt && (this._boltT -= dt) <= 0) this._clearBolt();
    const on = !!world && this.rain > 0.02;
    this.drops.visible = on;
    if (!on) return;
    (this.drops.material as THREE.LineBasicMaterial).opacity = 0.5 * this.rain;
    const p = this._pos;
    const active = Math.floor(DROPS * this.rain);
    for (let i = 0; i < DROPS; i++) {
      const o = i * 6;
      if (i >= active) {
        p[o + 1] = p[o + 4] = -1e4;
        continue;
      }
      let y = p[o + 1]! - FALL * dt;
      const off =
        Math.abs(p[o]! - eye.x) > AREA || Math.abs(p[o + 2]! - eye.z) > AREA;
      if (y < this._floor[i]! || off) {
        if ((this._wait[i]! -= dt) > 0 && !off) {
          p[o + 1] = p[o + 4] = -1e4;
          continue;
        }
        const x = eye.x + (this.rng() * 2 - 1) * AREA,
          z = eye.z + (this.rng() * 2 - 1) * AREA;
        const top = eye.y + TOP;
        const floor = floorOf(world, x, z, top);
        if (floor === null) {
          // столб под крышей: капля ждёт полсекунды и пробует другое место
          this._wait[i] = 0.5;
          this._floor[i] = 1e4;
          p[o + 1] = p[o + 4] = -1e4;
          continue;
        }
        this._floor[i] = floor;
        y = top - this.rng() * (top - floor);
        p[o] = p[o + 3] = x;
        p[o + 2] = p[o + 5] = z;
      }
      p[o + 1] = y;
      p[o + 4] = y + 0.7;
      p[o + 3] = p[o]! + 0.06;
    }
    this.drops.geometry.attributes.position!.needsUpdate = true;
  }

  serialize(): { kind: WeatherKind; left: number } {
    return { kind: this.kind, left: this.left };
  }

  deserialize(d: { kind?: string; left?: number } | undefined): void {
    const k = d?.kind as WeatherKind | undefined;
    if (k && WEATHER_KINDS.includes(k)) {
      this.set(
        k,
        typeof d?.left === "number" && d.left > 0 ? d.left : undefined,
      );
      this.rain = this.raining ? 1 : 0;
      this.thunder = k === "thunder" ? 1 : 0;
    }
  }

  dispose(): void {
    this._clearBolt();
    this.scene.remove(this.drops);
    this.drops.geometry.dispose();
    (this.drops.material as THREE.Material).dispose();
  }
}
