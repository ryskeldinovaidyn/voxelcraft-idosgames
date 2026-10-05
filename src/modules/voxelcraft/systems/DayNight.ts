// Цикл суток: CONFIG.dayNight.dayLength дня + nightLength ночи. Плавно лерпаются цвет неба, туман,
// свет солнца/луны и небосвода; солнце и луна — спрайты на орбите камеры.
//
// Освещение в казуальном стиле: тёплое солнце с мягкими тенями (PCF + radius) и полусферический
// свет вместо плоского ambient — теневые стороны берут цвет неба сверху и тёплый отражённый от
// земли снизу, а не проваливаются в серое.
import * as THREE from "three";
import { CONFIG } from "../config";
import { LIGHT_AMBIENT } from "../gfx/LightMaterial";
import { DIMENSIONS, type DimensionId } from "../world/Dimensions";

/** Ключевая точка цикла; t в [0..1), 0 = рассвет. Цвета — sRGB hex. */
interface LightKey {
  t: number;
  sky: number; // цвет неба (clear color)
  fog: number;
  sun: number; // направленный свет: днём солнце, ночью луна
  sunI: number;
  hemiSky: number; // небосвод — подсветка сверху
  hemiGround: number; // отражённый от земли тёплый свет снизу
  hemiI: number;
}

// Интенсивности подобраны под Lambert three r155+ (освещённость делится на π): сумма на верхней
// грани в полдень ≈ π — альбедо текстуры выходит в полную яркость. Солнце заметно сильнее
// небосвода, иначе тень гасит лишь малую долю света и почти не видна; небосвод же не даёт ей
// провалиться в черноту — тень остаётся мягкой и цветной.
const DAWN = {
  sky: 0xffb27a,
  fog: 0xffc9a0,
  sun: 0xffc27f,
  sunI: 1.6,
  hemiSky: 0xffd6c0,
  hemiGround: 0xa08060,
  hemiI: 1.3,
};
const DAY = {
  sky: 0x5ab8f5,
  fog: 0x9fd4f7,
  sun: 0xfff0d6,
  sunI: 2.6,
  hemiSky: 0xd2ecff,
  hemiGround: 0xc9b38a,
  hemiI: 1.4,
};
const SUNSET = {
  sky: 0xff8f5a,
  fog: 0xffac80,
  sun: 0xff9c5c,
  sunI: 1.5,
  hemiSky: 0xffc6a8,
  hemiGround: 0x8a6050,
  hemiI: 1.2,
};
const NIGHT = {
  sky: 0x13204f,
  fog: 0x1a2757,
  sun: 0x9db4ff,
  sunI: 1.0,
  hemiSky: 0x4a62a8,
  hemiGround: 0x2a2f45,
  hemiI: 1.2,
};
const KEYS: LightKey[] = [
  { t: 0.0, ...DAWN },
  { t: 0.1, ...DAY },
  { t: 0.4, ...DAY },
  { t: 0.5, ...SUNSET },
  { t: 0.6, ...NIGHT },
  { t: 0.9, ...NIGHT },
  { t: 1.0, ...DAWN },
];

const G = CONFIG.graphics;
/** Цвет пелены, когда голова в снегу-порохе. */
const POWDER_FOG = 0xdfe9f3;
const NO_WEATHER = { rain: 0, thunder: 0, flash: 0 };
const UP = new THREE.Vector3(0, 1, 0);
const ORIGIN = new THREE.Vector3();

function makeDiscSprite(color: string, glow: string): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 6, 32, 32, 30);
  g.addColorStop(0, color);
  g.addColorStop(0.5, color);
  g.addColorStop(1, glow);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    fog: false,
    depthWrite: false,
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(14, 14, 1);
  return s;
}

export class DayNight {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  cycleLength: number;
  time: number;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  skyColor: THREE.Color;
  sunSprite: THREE.Sprite;
  moonSprite: THREE.Sprite;
  _colA: THREE.Color;
  _colB: THREE.Color;
  private readonly _sunDir = new THREE.Vector3();
  private readonly _lightDir = new THREE.Vector3();
  private readonly _center = new THREE.Vector3();
  private readonly _basis = new THREE.Matrix4();
  private readonly _ax = new THREE.Vector3();
  private readonly _ay = new THREE.Vector3();

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.cycleLength = CONFIG.dayNight.dayLength + CONFIG.dayNight.nightLength;
    this.time = 0;
    this.resetToMorning(); // старт утром

    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.sun.castShadow = G.shadows;
    const sh = this.sun.shadow;
    sh.mapSize.set(G.shadowMapSize, G.shadowMapSize);
    sh.radius = G.shadowSoftness;
    sh.bias = -0.0004;
    sh.normalBias = 0.04;
    const R = G.shadowDistance;
    sh.camera.left = sh.camera.bottom = -R;
    sh.camera.right = sh.camera.top = R;
    sh.camera.near = 1;
    sh.camera.far = R * 6;
    sh.camera.updateProjectionMatrix();

    this.hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
    // target — в сцене, чтобы его матрица обновлялась вместе со сценой
    scene.add(this.sun, this.sun.target, this.hemi);
    scene.fog = new THREE.Fog(0xbfe3f5, 20, CONFIG.renderDistance * 16 - 8);
    this.skyColor = new THREE.Color();
    this.sunSprite = makeDiscSprite("#fff4c0", "rgba(255,235,150,0)");
    this.moonSprite = makeDiscSprite("#e8ecf5", "rgba(190,200,230,0)");
    this.moonSprite.scale.set(9, 9, 1);
    scene.add(this.sunSprite, this.moonSprite);
    this._colA = new THREE.Color();
    this._colB = new THREE.Color();
  }

  tick(dt: number) {
    this.time = (this.time + dt) % this.cycleLength;
  }

  /**
   * 0..1 фазы цикла (0 — рассвет, 0.5 — закат). Дневная половина фазы растягивается на dayLength
   * секунд, ночная — на nightLength. Раньше длины только суммировались, и день с ночью всегда
   * делили цикл поровну, какие бы значения ни стояли в конфиге.
   */
  get phase() {
    const { dayLength, nightLength } = CONFIG.dayNight;
    return this.time < dayLength
      ? (0.5 * this.time) / dayLength
      : 0.5 + (0.5 * (this.time - dayLength)) / nightLength;
  }

  /** Утро (фаза 0.15 — солнце уже поднялось): старт игры и новый мир. */
  resetToMorning() {
    this.time = CONFIG.dayNight.dayLength * 0.3;
  }

  /** Время суток мира из рецепта: рассвет, день, закат или ночь. */
  setTimeOfDay(t: "dawn" | "day" | "sunset" | "night") {
    const { dayLength, nightLength } = CONFIG.dayNight;
    // фазы: 0 — рассвет, 0.15 — утро, 0.47 — закат, 0.7 — глубокая ночь
    if (t === "dawn") this.time = dayLength * 0.06;
    else if (t === "sunset") this.time = dayLength * 0.94;
    else if (t === "night") this.time = dayLength + nightLength * 0.4;
    else this.resetToMorning();
  }

  get isDay() {
    return this.phase < 0.5;
  }

  /**
   * На сколько уровней время суток гасит небесный свет: днём 0, ночью 11, в сумерках плавно — как в
   * Minecraft. По нему спавнятся враждебные мобы (ночью под открытым небом свет 15-11 = 4 ≤ 7).
   */
  get skyDarken(): number {
    const t = this.phase; // 0 рассвет, 0.5 закат
    if (t < 0.05) return 11 * (1 - t / 0.05);
    if (t < 0.45) return 0;
    if (t < 0.55) return 11 * ((t - 0.45) / 0.1);
    if (t < 0.95) return 11;
    return 11 * (1 - (t - 0.95) / 0.05);
  }

  /** Кадровое обновление: интерполяция ключей + позиции светил вокруг игрока. */
  frame(
    playerPos: THREE.Vector3,
    medium: "air" | "water" | "lava" | "powder_snow" = "air",
    dimension: DimensionId = "overworld",
    nightVision = false,
    weather: { rain: number; thunder: number; flash: number } = NO_WEATHER,
  ) {
    const underwater = medium !== "air";
    const t = this.phase;
    let a = KEYS[0]!,
      b = KEYS[KEYS.length - 1]!;
    for (let i = 0; i < KEYS.length - 1; i++)
      if (t >= KEYS[i]!.t && t <= KEYS[i + 1]!.t) {
        a = KEYS[i]!;
        b = KEYS[i + 1]!;
        break;
      }
    const f = (t - a.t) / Math.max(1e-6, b.t - a.t);
    const lerpC = (target: THREE.Color, ca: number, cb: number) =>
      target.copy(this._colA.setHex(ca)).lerp(this._colB.setHex(cb), f);
    const lerpN = (na: number, nb: number) => na + (nb - na) * f;

    lerpC(this.skyColor, a.sky, b.sky);
    lerpC(this.sun.color, a.sun, b.sun);
    lerpC(this.hemi.color, a.hemiSky, b.hemiSky);
    lerpC(this.hemi.groundColor, a.hemiGround, b.hemiGround);
    this.hemi.intensity = lerpN(a.hemiI, b.hemiI);

    const fog = this.scene.fog as THREE.Fog;
    lerpC(fog.color, a.fog, b.fog);
    if (medium === "lava") {
      fog.color.setHex(0xc04a10);
      fog.near = 0.1;
      fog.far = 2.5;
    } else if (medium === "powder_snow") {
      // голова в снегу-порохе: белая пелена вплотную, как в Minecraft — а не вид сквозь землю
      fog.color.setHex(POWDER_FOG);
      fog.near = 0;
      fog.far = 1.5;
    } else if (underwater) {
      fog.color.setHex(0x1a4a8a);
      fog.near = 2;
      fog.far = 18;
    } else {
      // Туман только прячет край прогрузки: начинается далеко, иначе дымка смывает насыщенность.
      fog.far = CONFIG.renderDistance * 16 - 8;
      fog.near = fog.far * 0.55;
    }
    // дождь: небо и туман серые и темнее, дымка ближе; в грозу ещё темнее
    const { rain, thunder } = weather;
    if (rain > 0) {
      const gray = (c: THREE.Color) => {
        const l = 0.3 * c.r + 0.59 * c.g + 0.11 * c.b;
        c.lerp(this._colA.setRGB(l, l, l), 0.8 * rain).multiplyScalar(
          1 - 0.35 * rain - 0.3 * thunder,
        );
      };
      gray(this.skyColor);
      if (!underwater) {
        gray(fog.color);
        fog.near = fog.far * (0.55 - 0.4 * rain);
      }
    }
    this.renderer.setClearColor(
      medium === "lava"
        ? 0xc04a10
        : medium === "powder_snow"
          ? POWDER_FOG
          : underwater
            ? 0x1a4a8a
            : this.skyColor,
    );

    const dim = DIMENSIONS[dimension];
    // фоновый свет измерения без неба (Пекло, Предел) — из описания измерения
    LIGHT_AMBIENT.value = dim.hasSky ? 0.03 : dim.ambient.level;
    // Ночное зрение: темнота почти не темнит (пещеры и ночь видно)
    if (nightVision) LIGHT_AMBIENT.value = Math.max(LIGHT_AMBIENT.value, 0.85);
    if (!dim.hasSky) {
      // Пекло и Предел: своё постоянное небо и густой туман — без светил и суточного цикла
      this.skyColor.setHex(dim.sky);
      if (!underwater) {
        fog.color.setHex(dim.fog);
        fog.far = CONFIG.renderDistance * 16 * 0.75;
        fog.near = fog.far * 0.2;
        this.renderer.setClearColor(this.skyColor);
      }
      this.sun.intensity = 0;
      this.sun.shadow.intensity = 0;
      // рассеянный свет — свой цвет измерения (цвета тумана и неба почти чёрные: Предел был не виден)
      this.hemi.color.setHex(dim.ambient.color);
      this.hemi.groundColor.setHex(dim.ambient.color).multiplyScalar(0.55);
      this.hemi.intensity = 0.9;
      this.sunSprite.material.opacity = 0;
      this.moonSprite.material.opacity = 0;
      return;
    }

    // солнце: восход на востоке (+x) в t=0, зенит в t=0.25, закат в t=0.5, ночью — под горизонтом
    const elev = Math.sin(Math.PI * (0.5 - Math.abs(t - 0.25) * 2)); // 1 в полдень, <0 ночью
    const az = Math.cos((t - 0.25) * Math.PI * 2);
    const sunDir = this._sunDir.set(az, elev, 0.3).normalize();

    // Направленный свет всегда сверху: днём от солнца, ночью от луны (она напротив). У горизонта
    // он гаснет и только потом переключается — иначе на закате тени и освещённые грани
    // перескакивали бы на противоположную сторону.
    const lightDir = this._lightDir.copy(sunDir);
    if (lightDir.y < 0) lightDir.negate();
    const horizon = THREE.MathUtils.smoothstep(lightDir.y, 0.02, 0.3);
    this.sun.intensity = lerpN(a.sunI, b.sunI) * horizon;
    this.sun.shadow.intensity = G.shadowStrength * horizon;
    this._placeSun(playerPos, lightDir);

    this.sunSprite.position.copy(playerPos).addScaledVector(sunDir, 70);
    this.moonSprite.position.copy(playerPos).addScaledVector(sunDir, -70);
    this.sunSprite.material.opacity = Math.max(
      0,
      Math.min(1, sunDir.y * 4 + 0.4),
    );
    this.moonSprite.material.opacity = Math.max(
      0,
      Math.min(1, -sunDir.y * 4 + 0.4),
    );
    // за тучами солнца и луны не видно, тени бледнеют; молния на миг заливает всё светом
    if (rain > 0) {
      this.sun.intensity *= 1 - 0.75 * rain;
      this.sun.shadow.intensity *= 1 - 0.8 * rain;
      this.hemi.intensity *= 1 - 0.25 * rain - 0.2 * thunder;
      this.sunSprite.material.opacity *= 1 - rain;
      this.moonSprite.material.opacity *= 1 - rain;
    }
    if (weather.flash > 0) this.hemi.intensity += 3 * weather.flash;
  }

  /**
   * Эффект Тьмы (сила 0..1, main пульсирует ею): поверх кадра frame() туман подходит вплотную, небо,
   * туман и рассеянный свет гаснут. Ночное зрение Тьму не снимает — как в Minecraft.
   */
  darkness(k: number): void {
    if (k <= 0) return;
    const fog = this.scene.fog as THREE.Fog;
    // цвета линейные, на экране — через sRGB: гасить нужно почти до нуля, иначе выходит серая дымка
    const dim = 0.01 + 0.04 * (1 - k);
    fog.color.multiplyScalar(dim);
    fog.far = Math.min(fog.far, 40 - 30 * k);
    fog.near = Math.min(fog.near, 1);
    this.skyColor.multiplyScalar(dim);
    this.renderer.setClearColor(fog.color);
    LIGHT_AMBIENT.value = Math.min(LIGHT_AMBIENT.value, 0.03 * (1 - k));
    this.hemi.intensity *= 1 - 0.8 * k;
    this.sun.intensity *= 1 - 0.8 * k;
  }

  /**
   * Карта теней ездит за игроком. Её центр привязан к сетке текселей в пространстве света: без
   * этого при ходьбе край каждой тени пересчитывался бы со сдвигом на долю текселя и «кипел».
   */
  _placeSun(playerPos: THREE.Vector3, lightDir: THREE.Vector3) {
    const R = G.shadowDistance;
    const texel = (2 * R) / G.shadowMapSize;
    // тот же базис, что построит shadow-камера: z смотрит на свет, up — мировой
    this._basis.lookAt(lightDir, ORIGIN, UP);
    this._ax.setFromMatrixColumn(this._basis, 0);
    this._ay.setFromMatrixColumn(this._basis, 1);
    const c = this._center.copy(playerPos);
    const du = c.dot(this._ax);
    const dv = c.dot(this._ay);
    c.addScaledVector(this._ax, Math.round(du / texel) * texel - du);
    c.addScaledVector(this._ay, Math.round(dv / texel) * texel - dv);
    this.sun.position.copy(c).addScaledVector(lightDir, R * 3);
    this.sun.target.position.copy(c);
  }

  serialize() {
    return { time: this.time };
  }
  deserialize(d: { time?: number } | undefined) {
    // нет поля или не число (чужой файл) — время остаётся: NaN ломал небо, свет и спавн мобов
    const t = Number(d?.time);
    if (Number.isFinite(t) && t >= 0) this.time = t;
  }
}
