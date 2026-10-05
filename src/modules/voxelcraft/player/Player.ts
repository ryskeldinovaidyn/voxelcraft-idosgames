// Игрок: AABB-физика с поосевым разрешением коллизий, плавание, полёт (креатив),
// здоровье и урон от падения. Физика игрока считается на КАДРЕ (20 Гц для камеры
// ощущается плохо); в этапе 2 этот же код становится client-side prediction,
// а у хоста он и есть авторитативная симуляция.
import * as THREE from "three";
import { rules } from "../systems/Difficulty";
import { clampRep } from "../systems/Reputation";
import type { DrinkDef, EffectId } from "../types";

const EFFECT_IDS: readonly EffectId[] = [
  "strength",
  "regeneration",
  "night_vision",
  "speed",
  "fire_resistance",
  "haste",
  "resistance",
  "jump_boost",
  "decay",
  "levitation",
  "water_breathing",
  "mining_fatigue",
  "poison",
  "bad_omen",
  "hero",
  "darkness",
  "slowness",
  "hunger",
];

/** Запас воздуха под водой, сек (300 тиков Minecraft). */
export const MAX_AIR = 15;
/** Для коллизий в кожаных ботинках: снег-порох — полный куб. */
const isPowderSnow = (id: number): boolean => id === B.powder_snow;
/** Подъём в снегу-порохе с зажатым прыжком, блоков/с: без кожаных ботинок и в них. */
const POWDER_CLIMB = 1.5;
const POWDER_CLIMB_BOOTS = 2.5;
/**
 * Подскок на выходе из снега-пороха: ноги покинули клетку, а тело ещё на 0.2 ниже кромки — без него
 * упор в край не срабатывает (коробка пересекает тело) и игрок сползает обратно. ~0.5 блока.
 */
const POWDER_HOP = 5;
import { CONFIG } from "../config";
import { events } from "../core/EventBus";
import { BLOCKS, B } from "../registry/Blocks";
import { ITEMS } from "../registry/Items";
import { moveBody } from "../physics/Collision";
import { findSafeSpot, isStandable } from "../world/safeSpot";
import type { ChunkManager } from "../world/ChunkManager";
import type { Input } from "./Input";
import type { Rideable } from "../entities/Rideable";
import { GLIDE_TICK, glideTick } from "./Glide";

const P = CONFIG.player;

type PlayerMode = "survival" | "creative";

/** Причины урона, которые гасит броня. */
const ARMORED_CAUSES: ReadonlySet<string> = new Set([
  "attack",
  "projectile",
  "explosion",
  "lava",
  "fire",
]);

/** Урон после брони — формула Minecraft (очки защиты и твёрдость). */
export function armorReduce(
  damage: number,
  points: number,
  toughness: number,
): number {
  const eff = Math.min(
    20,
    Math.max(points / 5, points - damage / (2 + toughness / 4)),
  );
  return damage * (1 - eff / 25);
}

/** Форма persist-блоба игрока (см. serialize/deserialize). */
interface PlayerSaveData {
  pos: number[];
  yaw: number;
  pitch: number;
  health: number;
  food?: number;
  saturation?: number;
  mode: PlayerMode;
  flying: boolean;
  /** v3: точка возрождения (кровать). Нет — там, где загрузились. */
  spawn?: number[];
  /** v3: кровать, у которой возрождаться (нет — у точки мира). */
  bedPos?: number[] | null;
  /** Якорь возрождения и путевой камень компаса (нет полей — их и не было). */
  anchorPos?: number[] | null;
  villageRep?: number;
  anchorDim?: string | null;
  lodestone?: { x: number; z: number; dim: string } | null;
  /** v3: действующие эффекты зелий. */
  effects?: { id: string; level: number; time: number }[];
  /** v3: зерно вариантов стола зачарований. */
  enchSeed?: number;
  /** v3: опыт — уровень, доля до следующего, всего набрано. */
  xpLevel?: number;
  xpProgress?: number;
  xpTotal?: number;
}

export class Player {
  world: ChunkManager;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  pitch: number;
  onGround: boolean;
  inWater: boolean;
  headInWater: boolean;
  mode: PlayerMode;
  flying: boolean;
  health: number;
  food: number;
  saturation: number;
  exhaustion: number;
  dead: boolean;
  spawnPoint: THREE.Vector3;
  _fallDist: number;
  _stepDist: number;
  _regenTimer: number;
  _starveTimer: number;
  _sprinting = false;
  /** Присел (Ctrl): медленнее, глаз ниже, с края не сходит. */
  _sneaking = false;
  /** Кто сидит на плечах (id мобов: левое, правое) — попугаи (entities/Mob). */
  shoulders: [number | null, number | null] = [null, null];
  /** Касается лестницы (ladder) — можно лезть. */
  onLadder = false;
  /** Последний шаг упёрся в стену — «вперёд» у лестницы значит «вверх». */
  _hitWall = false;
  /** В лаве (урон, медленно), голова в лаве (оранжевый туман). */
  inLava = false;
  headInLava = false;
  /** До следующего удара лавой, сек (первый — сразу при касании). */
  _lavaT = 0;
  /** До следующего удара пустоты, сек. */
  _voidT = 0;
  /** Эффекты зелий: уровень и сколько ещё секунд. */
  effects = new Map<EffectId, { level: number; time: number }>();
  _effectRegenT = 0;
  _decayT = 0;
  _poisonT = 0;
  _cactusT = 0;
  _campT = 0;
  /** Тотем жизни в руке: потратить и спастись (подключает Game из инвентаря). */
  tryTotem: (() => boolean) | null = null;
  /** Воздух под водой, сек; кончился — 2 урона в секунду (утопление). */
  air = MAX_AIR;
  _drownT = 0;
  /** Летит на Крыльях Предела (player/Glide). */
  gliding = false;
  /** Надеты ли годные крылья и износ за секунду полёта — подключает Game из инвентаря. */
  canGlide: (() => boolean) | null = null;
  onGlideWear: (() => void) | null = null;
  _jumpHeld = false;
  _glideAcc = 0;
  _wearT = 0;
  /** Сколько ещё тянет ракета, сек. */
  _boostT = 0;
  /** Зерно вариантов стола зачарований — меняется после каждого зачарования (как в Minecraft). */
  enchSeed = (Math.random() * 0xffffffff) >>> 0;

  /** Касается ли тело кактуса (коробка игрока, раздутая на 0.1 по бокам). */
  _touchesCactus(): boolean {
    if (B.cactus === undefined || typeof this.world?.getBlock !== "function")
      return false;
    const r = 0.3 + 0.1;
    for (
      let x = Math.floor(this.pos.x - r);
      x <= Math.floor(this.pos.x + r);
      x++
    )
      for (
        let y = Math.floor(this.pos.y);
        y <= Math.floor(this.pos.y + 1.7);
        y++
      )
        for (
          let z = Math.floor(this.pos.z - r);
          z <= Math.floor(this.pos.z + r);
          z++
        )
          if (this.world.getBlock(x, y, z) === B.cactus) return true;
    return false;
  }
  /** Стоит в огне; сколько ещё гореть (сек) и до следующего урона от горения. */
  inFire = false;
  fireT = 0;
  _burnT = 0;
  /** Кровать — точка возрождения (мировые координаты клетки). */
  bedPos: [number, number, number] | null = null;
  /** Якорь возрождения (Пекло): клетка и измерение — возрождение там, а не у кровати. */
  anchorPos: [number, number, number] | null = null;
  anchorDim: string | null = null;
  /** Репутация в деревне: торговля поднимает, удар по жителю роняет (systems/Reputation). */
  villageRep = 0;
  /** Путевой камень, к которому привязан компас (клетка и измерение). */
  lodestone: { x: number; z: number; dim: string } | null = null;
  /** Последняя причина урона (экран смерти). */
  lastCause = "";
  /** Опыт: уровень, доля до следующего уровня (0..1), всего набрано. */
  xpLevel = 0;
  xpProgress = 0;
  xpTotal = 0;
  private _xpFrac = 0;

  /** Опыта до следующего уровня — формула Minecraft. */
  static xpToNext(level: number): number {
    return level >= 31
      ? 9 * level - 158
      : level >= 16
        ? 5 * level - 38
        : 2 * level + 7;
  }

  /** Добавить опыт (дробный копится: печь даёт по 0.1–1 за предмет). */
  addXp(amount: number): void {
    this._xpFrac += amount;
    const n = Math.floor(this._xpFrac);
    this._xpFrac -= n;
    if (n <= 0) return;
    this.xpTotal += n;
    this.xpProgress += n / Player.xpToNext(this.xpLevel);
    while (this.xpProgress >= 1) {
      this.xpProgress = (this.xpProgress - 1) * Player.xpToNext(this.xpLevel);
      this.xpLevel++;
      this.xpProgress /= Player.xpToNext(this.xpLevel);
      events.emit("levelUp", { level: this.xpLevel });
    }
    events.emit("xpChanged");
  }

  /** Отбросить игрока от удара (моб, стрела, взрыв). */
  knock(dx: number, dz: number, strength: number): void {
    const len = Math.hypot(dx, dz) || 1;
    this.vel.x += (dx / len) * strength;
    this.vel.z += (dz / len) * strength;
    this.vel.y = Math.max(this.vel.y, 4);
    this.onGround = false;
  }
  _respawnT?: ReturnType<typeof setTimeout>;

  constructor(world: ChunkManager) {
    this.world = world;
    this.pos = new THREE.Vector3(8.5, 40, 8.5); // ноги; уточняется при спавне
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.inWater = false;
    this.headInWater = false;
    this.mode = "survival"; // 'survival' | 'creative'
    this.flying = false;
    this.health = P.maxHealth;
    // голод: еда [0..maxFood], сатурация [0..food] (буфер, тратится первой),
    // истощение [0..exhaustionPerFood] — накопитель, при переполнении съедает очко
    this.food = P.maxFood;
    this.saturation = 5;
    this.exhaustion = 0;
    this.dead = false;
    this._fallDist = 0;
    this._stepDist = 0;
    this._regenTimer = 0;
    this._starveTimer = 0;
    this.spawnPoint = new THREE.Vector3();

    events.on("input:doubleSpace", () => {
      if (this.mode === "creative") this.flying = !this.flying;
    });
  }

  spawn(): void {
    // Ищем сушу по спирали от подсказки генератора (классический мир — (8,8)): не спавнимся в
    // океане на произвольном сиде. Сначала трава; мир из рецепта может быть пустыней или снегом —
    // тогда вторым проходом годится любая сухая твёрдая поверхность. Над ней — место на рост:
    // верх колонки по surfaceY лежит ПОД снегом-порохом (он не твёрдый), и без проверки игрок
    // появлялся на дне его ямы.
    const hint = this.world.generator.spawnHint();
    const water = this.world.waterLevel;
    let sx = hint.x,
      sz = hint.z;
    outer: for (const needGrass of [true, false]) {
      for (let r = 0; r <= 6; r++) {
        for (let dx = -r; dx <= r; dx += Math.max(1, r)) {
          for (let dz = -r; dz <= r; dz += Math.max(1, r)) {
            const x = hint.x + dx * 8,
              z = hint.z + dz * 8;
            const y = this.world.surfaceY(x, z);
            const top = this.world.getBlock(x, y, z);
            if (
              y > water &&
              (needGrass ? top === B.grass : BLOCKS[top]?.opaque) &&
              isStandable(this.world, x, y + 1, z)
            ) {
              sx = x;
              sz = z;
              break outer;
            }
          }
        }
      }
    }
    let y = this.world.surfaceY(sx, sz);
    if (!isStandable(this.world, sx, y + 1, sz)) {
      const near = findSafeSpot(this.world, sx, sz, 16, water);
      if (near) {
        sx = near.x;
        sz = near.z;
        y = near.y - 1;
      }
    }
    this.pos.set(sx + 0.5, y + 1.01, sz + 0.5);
    this.spawnPoint.copy(this.pos);
    this.vel.set(0, 0, 0);
    this.health = P.maxHealth;
    this.food = P.maxFood;
    this.saturation = 5;
    this.exhaustion = 0;
    this.dead = false;
  }

  get eyePos(): THREE.Vector3 {
    return new THREE.Vector3(
      this.pos.x,
      this.pos.y + (this._sneaking ? P.sneakEye : P.eye),
      this.pos.z,
    );
  }

  lookDir(): THREE.Vector3 {
    return new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    );
  }

  toggleMode(): void {
    this.mode = this.mode === "survival" ? "creative" : "survival";
    if (this.mode === "survival") this.flying = false;
    this.exhaustion = 0; // накопленное в другом режиме не списываем разом
    events.emit("modeChanged", { mode: this.mode });
  }

  /**
   * Поворот взгляда в радианах. Отдельным методом, чтобы у поворота был ОДИН источник правды:
   * им пользуется и кадровое обновление по мыши, и агентский API (`agent.ts`) — иначе у агента
   * появилась бы своя копия правил поворота, которая разъехалась бы с настоящей.
   */
  look(dYaw: number, dPitch: number): void {
    this.yaw += dYaw;
    this.pitch = Math.max(
      -Math.PI / 2 + 0.01,
      Math.min(Math.PI / 2 - 0.01, this.pitch + dPitch),
    );
  }

  /** Кадровое обновление: взгляд, ускорения, интеграция, коллизии. */
  update(dt: number, input: Input): void {
    // дельту забираем и у мёртвого: иначе она копится и после респауна камеру дёргает
    const m = input.consumeMouse();
    if (this.dead) return;
    // взгляд
    this.look(-m.dx * 0.0024, -m.dy * 0.0024);

    // в вагонетке: едем с ней, «вперёд» толкает, присесть — выйти
    if (this.riding) {
      const cart = this.riding;
      if (cart.dead || (input.sneak && !input.uiOpen)) this.dismount();
      else {
        this.pos.set(
          cart.renderPos.x,
          cart.renderPos.y + cart.seatY,
          cart.renderPos.z,
        );
        this.vel.set(0, 0, 0);
        this.onGround = true;
        this._fallDist = 0;
        if (input.forward && !input.uiOpen)
          cart.push(-Math.sin(this.yaw), -Math.cos(this.yaw), dt);
        return;
      }
    }

    // среда
    const feet = this.world.getBlock(
      Math.floor(this.pos.x),
      Math.floor(this.pos.y + 0.2),
      Math.floor(this.pos.z),
    );
    const head = this.world.getBlock(
      Math.floor(this.pos.x),
      Math.floor(this.pos.y + P.eye),
      Math.floor(this.pos.z),
    );
    const wet = (id: number): boolean =>
      !!(BLOCKS[id]?.liquid || BLOCKS[id]?.waterlogged);
    this.inWater = wet(feet) || wet(head);
    this.headInWater = wet(head);
    this.inLava = feet === B.lava || head === B.lava;
    this.headInLava = head === B.lava;
    this.inFire =
      feet === B.fire ||
      head === B.fire ||
      feet === B.soul_fire ||
      head === B.soul_fire;
    this.onLadder = this._touchesLadder();
    this.inPowderSnow = feet === B.powder_snow || head === B.powder_snow;
    this.headInPowderSnow = head === B.powder_snow;
    // вылезли из снега-пороха вверх с зажатым прыжком — подскок через кромку
    if (
      this._wasInPowder &&
      !this.inPowderSnow &&
      input.jump &&
      !input.uiOpen &&
      this.vel.y > 0 &&
      !this.flying
    )
      this.vel.y = Math.max(this.vel.y, POWDER_HOP);
    this._wasInPowder = this.inPowderSnow;

    // желаемое горизонтальное движение в локальных осях камеры
    let ix = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let iz = (input.back ? 1 : 0) - (input.forward ? 1 : 0);
    if (input.uiOpen) {
      ix = 0;
      iz = 0;
    }
    const len = Math.hypot(ix, iz) || 1;
    ix /= len;
    iz /= len;
    // перевод ввода в мировые оси: forward = (-sin yaw, -cos yaw), right = (cos yaw, -sin yaw)
    const sin = Math.sin(this.yaw),
      cos = Math.cos(this.yaw);
    const wishX = ix * cos + iz * sin;
    const wishZ = iz * cos - ix * sin;

    // присесть — Ctrl (в полёте Ctrl — вниз); бег доступен, пока еды достаточно (как в Minecraft)
    this._sneaking = input.sneak && !this.flying && !input.uiOpen;
    const canSprint =
      input.run && input.forward && !this._sneaking && this.food > P.sprintFood;
    this._sprinting = canSprint && !this.flying && !this.inWater;
    const speed =
      this.speedFactor *
      (this.flying
        ? P.flySpeed
        : this.inWater
          ? P.swimSpeed * (this.inLava ? 0.5 : 1)
          : this._sneaking
            ? P.sneakSpeed
            : canSprint
              ? P.runSpeed
              : P.walkSpeed);

    // Крылья Предела: прыжок в воздухе раскрывает их; земля, вода, лестница, полёт, износ — складывают
    const jumpEdge = input.jump && !this._jumpHeld && !input.uiOpen;
    this._jumpHeld = input.jump;
    if (
      this.gliding &&
      (this.onGround ||
        this.inWater ||
        this.flying ||
        this.onLadder ||
        !this.canGlide?.())
    )
      this.gliding = false;
    else if (
      !this.gliding &&
      jumpEdge &&
      !this.onGround &&
      !this.inWater &&
      !this.flying &&
      this.vel.y < 1 &&
      this.canGlide?.()
    ) {
      this.gliding = true;
      this._glideAcc = 0;
      events.emit("glideStart");
    }

    if (this.gliding) {
      // физика Minecraft по тикам; ракета толкает вдоль взгляда
      this._fallDist = 0;
      this._glideAcc += dt;
      while (this._glideAcc >= GLIDE_TICK) {
        this._glideAcc -= GLIDE_TICK;
        glideTick(this.vel, this.pitch, this.yaw, this._boostT > 0);
        this._boostT = Math.max(0, this._boostT - GLIDE_TICK);
      }
      this._wearT += dt;
      if (this._wearT >= 1) {
        this._wearT -= 1;
        if (this.mode !== "creative") this.onGlideWear?.();
      }
    } else if (this.flying) {
      // полёт: прямое управление скоростью, вертикаль на Space/Ctrl
      this.vel.x = wishX * speed;
      this.vel.z = wishZ * speed;
      this.vel.y = (input.jump ? speed : 0) + (input.sneakOrDown ? -speed : 0);
      if (input.uiOpen) this.vel.y = 0;
    } else if (this.inPowderSnow) {
      // снег-порох: вязнем — медленно; зажав прыжок, карабкаемся вверх, как по лестнице (в кожаных
      // ботинках быстрее). Без подъёма яма в 2 блока была ловушкой: холод добивал игрока насмерть.
      this.vel.x = wishX * speed * 0.35;
      this.vel.z = wishZ * speed * 0.35;
      this.vel.y =
        input.jump && !input.uiOpen
          ? this.leatherBoots?.()
            ? POWDER_CLIMB_BOOTS
            : POWDER_CLIMB
          : Math.max(-1.2, this.vel.y - P.gravity * dt);
      this._fallDist = 0;
    } else if (this.inWater) {
      const accel = 24 * dt;
      this.vel.x += (wishX * speed - this.vel.x) * Math.min(1, accel);
      this.vel.z += (wishZ * speed - this.vel.z) * Math.min(1, accel);
      this.vel.y -= P.gravity * 0.3 * dt; // ослабленная гравитация
      if (input.jump && !input.uiOpen) this.vel.y = P.swimUp; // гребок вверх
      this.vel.y *= 1 - P.waterDrag * dt; // сопротивление воды
      this._fallDist = 0;
    } else {
      const accel = (this.onGround ? 18 : 4) * dt;
      this.vel.x += (wishX * speed - this.vel.x) * Math.min(1, accel);
      this.vel.z += (wishZ * speed - this.vel.z) * Math.min(1, accel);
      this.vel.y -= P.gravity * dt;
      // Левитация (пуля панцирника): тянет вверх ~1 блок/с за уровень, падения не копит
      const lev = this.effects.get("levitation");
      if (lev) {
        this.vel.y += (lev.level - this.vel.y) * Math.min(1, 5 * dt);
        this._fallDist = 0;
      }
      if (input.jump && this.onGround && !input.uiOpen) {
        this.vel.y = P.jumpSpeed + 1.6 * this.jumpBoost; // Прыгучесть — выше на ~полблока за уровень
        this.addExhaustion(this._sprinting ? P.exhaustJump * 4 : P.exhaustJump);
      }
      // лестница: вверх — прыжок или «вперёд» в стену, присев — висим, иначе медленно сползаем
      if (this.onLadder) {
        this._fallDist = 0;
        const climb =
          !input.uiOpen && (input.jump || (input.forward && this._hitWall));
        if (climb) this.vel.y = P.climbSpeed;
        else if (this._sneaking) this.vel.y = Math.max(this.vel.y, 0);
        else this.vel.y = Math.max(this.vel.y, -P.climbSpeed);
      }
    }

    // интеграция с сабстепами — защита от туннелирования на лагающем кадре
    const steps = Math.max(1, Math.ceil((this.vel.length() * dt) / 0.4));
    const sdt = dt / steps;
    for (let s = 0; s < steps; s++) this._moveStep(sdt);

    // шаги (звук) + истощение от ходьбы/бега
    if (this.onGround && !this.inWater) {
      const dist = Math.hypot(this.vel.x, this.vel.z) * dt;
      this._stepDist += dist;
      if (this.mode === "survival")
        this.addExhaustion(
          dist * (this._sprinting ? P.exhaustSprint : P.exhaustWalk),
        );
      if (this._stepDist > 2.2) {
        this._stepDist = 0;
        events.emit("playerStep");
      }
    }

    if (this.pos.y < -10) this._die(); // выпал из мира
  }

  /** Транспорт, в котором сидит игрок (вагонетка, лодка — entities/Rideable). */
  riding: Rideable | null = null;
  /** Игрок в снегу-порохе (вязнет; мёрзнет — systems/Freezing через Game). */
  inPowderSnow = false;
  /** Голова в снегу-порохе — белый туман вплотную (DayNight, среда "powder_snow"). */
  headInPowderSnow = false;
  /** Был ли в снегу-порохе прошлым кадром — для подскока на выходе (POWDER_HOP). */
  _wasInPowder = false;
  /** Хук Game: надеты ли кожаные ботинки — снег-порох держит, из него можно выпрыгнуть. */
  leatherBoots?: () => boolean;
  /** Надета ли хоть одна золотая вещь — свинорылы не нападают (задаёт Game). */
  goldArmor?: () => boolean;
  /** Прикрывается щитом (держит ПКМ со щитом — player/Interaction). */
  blocking = false;
  /** Щит принял удар: изнашивает щит в руке (задаёт Game). */
  onShieldBlock?: (amount: number) => void;

  /** Сесть в вагонетку или лодку. */
  mount(cart: Rideable): void {
    if (this.riding) this.dismount();
    this.riding = cart;
    cart.rider = true;
  }

  /** Выйти из вагонетки — встать над ней. */
  dismount(): void {
    const cart = this.riding;
    if (!cart) return;
    cart.rider = false;
    this.riding = null;
    this.pos.set(cart.pos.x, cart.pos.y + 1, cart.pos.z);
    this.vel.set(0, 0, 0);
  }

  /** Шаг интеграции: коллизии по коробкам форм (physics/Collision), шаг на ступень, край при приседании. */
  _moveStep(dt: number): void {
    const wasAirborne = !this.onGround && !this.flying && !this.inWater;
    const prevVy = this.vel.y;
    const hv0 = Math.hypot(this.vel.x, this.vel.z);
    const r = moveBody(
      this.world,
      {
        x: this.pos.x,
        y: this.pos.y,
        z: this.pos.z,
        hw: P.width / 2,
        h: P.height,
      },
      this.vel.x * dt,
      this.vel.y * dt,
      this.vel.z * dt,
      {
        step: this.onGround && !this.flying ? P.stepHeight : 0,
        sneak: this._sneaking,
        onGround: this.onGround,
        // в кожаных ботинках снег-порох держит (присев — проваливаешься, как в Minecraft)
        extraSolid:
          !this.inPowderSnow && !this._sneaking && this.leatherBoots?.()
            ? isPowderSnow
            : undefined,
      },
    );
    this.pos.x += r.dx;
    this.pos.y += r.dy;
    this.pos.z += r.dz;

    if (r.hitDown) {
      // на острый сталагмит больнее: урон вдвое и уже с 2 блоков (как в Minecraft)
      const fx = Math.floor(this.pos.x),
        fy = Math.floor(this.pos.y + 0.01),
        fz = Math.floor(this.pos.z);
      const spike =
        this.world.getBlock(fx, fy, fz) === B.pointed_dripstone ||
        this.world.getBlock(fx, fy - 1, fz) === B.pointed_dripstone;
      const safe = spike ? 2 : P.fallSafe + this.jumpBoost;
      if (wasAirborne && this._fallDist > safe && this.mode === "survival")
        this.damage(
          Math.round(this._fallDist - safe) * (spike ? 2 : 1),
          spike ? "stalagmite" : "fall",
        );
      this._fallDist = 0;
      this.onGround = true;
      this.vel.y = 0;
    } else {
      this.onGround = false;
      if (r.hitUp) this.vel.y = 0; // потолок
      // снижение в полёте — не падение: выключив полёт в воздухе, получили бы урон за весь спуск
      if (this.flying) this._fallDist = 0;
      else if (prevVy < 0) this._fallDist += -prevVy * dt;
    }
    if (r.hitX) this.vel.x = 0;
    if (r.hitZ) this.vel.z = 0;
    this._hitWall = r.hitX || r.hitZ;
    // на крыльях врезался в стену: урон по потерянной скорости, как в Minecraft (блоки за тик)
    if (this.gliding && this._hitWall && this.mode === "survival") {
      const dmg = ((hv0 - Math.hypot(this.vel.x, this.vel.z)) / 20) * 10 - 3;
      if (dmg > 0) this.damage(dmg, "wall");
    }
  }

  /** Касается ли тело лестницы (клетки, которые пересекает AABB, чуть расширенный вбок). */
  _touchesLadder(): boolean {
    const half = P.width / 2 + 0.05;
    for (let y = Math.floor(this.pos.y); y <= Math.floor(this.pos.y + 1); y++)
      for (
        let z = Math.floor(this.pos.z - half);
        z <= Math.floor(this.pos.z + half);
        z++
      )
        for (
          let x = Math.floor(this.pos.x - half);
          x <= Math.floor(this.pos.x + half);
          x++
        ) {
          // лезут по лестнице и по строительным лесам (systems/Scaffold)
          const sh = BLOCKS[this.world.getBlock(x, y, z)]?.shape;
          if (sh === "ladder" || sh === "scaffold") return true;
        }
    return false;
  }

  /** Надетая броня (подключает Game из инвентаря): очки защиты и твёрдость. */
  armorStats:
    (() => { points: number; toughness: number; protection?: number }) | null =
    null;
  /** Удар по броне — износ (подключает Game). */
  onArmorHit: ((damage: number) => void) | null = null;

  damage(amount: number, cause: string): void {
    if (this.mode === "creative" || this.dead || amount <= 0) return;
    // Огнестойкость: огонь и лава не ранят
    if (
      (cause === "fire" || cause === "lava") &&
      this.effects.has("fire_resistance")
    )
      return;
    this.lastCause = cause;
    // броня гасит удары, огонь, лаву и взрывы — формула Minecraft; падение и голод — нет
    if (ARMORED_CAUSES.has(cause) && this.armorStats) {
      const { points, toughness } = this.armorStats();
      if (points > 0) {
        this.onArmorHit?.(amount);
        amount = armorReduce(amount, points, toughness);
      }
    }
    // Защита: −4% за уровень по всей броне, не больше 80% (пустоту и голод не гасит)
    const prot = this.armorStats?.().protection ?? 0;
    if (prot > 0 && cause !== "void" && cause !== "starve")
      amount *= 1 - Math.min(20, prot) * 0.04;
    // Сопротивление (маяк): −20% за уровень (пустоту не гасит)
    const res = this.effects.get("resistance")?.level ?? 0;
    if (res > 0 && cause !== "void") amount *= Math.max(0, 1 - 0.2 * res);
    this.health = Math.max(0, this.health - amount);
    events.emit("playerHurt", { amount, health: this.health, cause });
    if (this.health <= 0) {
      // тотем жизни в руке: 1 здоровья, Регенерация II и Огнестойкость вместо смерти (пустоту не спасает)
      if (cause !== "void" && this.tryTotem?.()) {
        this.health = 1;
        this.clearEffects();
        this.addEffect("regeneration", 45, 2);
        this.addEffect("fire_resistance", 40);
        events.emit("totemUsed");
        return;
      }
      this._die();
    }
  }

  addExhaustion(n: number): void {
    // В креативе голода нет и tickHunger истощение не списывает — оно копилось бы и при возврате
    // в выживание съедало еду пачкой за один тик.
    if (this.mode === "creative") return;
    this.exhaustion += n;
  }

  /**
   * Тик опасностей среды (симуляция), как в Minecraft: лава — 4 урона каждые полсекунды и поджигает
   * на 15 с, огонь — поджигает на 8 с; горящий теряет 1 в секунду, вода тушит.
   */
  tickHazards(dt: number): void {
    if (this.dead) return;
    this._tickEffects(dt);
    // воздух: голова под водой тратит запас (Подводное дыхание — нет), кончился — тонем
    if (
      this.headInWater &&
      !this.headInLava &&
      this.mode === "survival" &&
      !this.effects.has("water_breathing")
    ) {
      this.air = Math.max(0, this.air - dt);
      if (this.air <= 0) {
        this._drownT -= dt;
        if (this._drownT <= 0) {
          this._drownT = 1;
          this.damage(2, "drown");
        }
      }
    } else {
      this.air = Math.min(MAX_AIR, this.air + dt * 5);
      this._drownT = 0;
    }
    // горящий костёр жжёт стоящего на нём: 1 урон в секунду (костёр душ — 2), но не поджигает
    this._campT = Math.max(0, this._campT - dt);
    const camp =
      B.campfire !== undefined && typeof this.world?.getBlock === "function"
        ? this.world.getBlock(
            Math.floor(this.pos.x),
            Math.floor(this.pos.y),
            Math.floor(this.pos.z),
          )
        : -1;
    const soulCamp = camp === B.soul_campfire;
    if (
      this._campT <= 0 &&
      (camp === B.campfire || soulCamp) &&
      !this.effects.has("fire_resistance")
    ) {
      this._campT = 1;
      this.damage(soulCamp ? 2 : 1, "fire");
    }
    // кактус колет: 1 урон каждые полсекунды, пока касаешься
    this._cactusT = Math.max(0, this._cactusT - dt);
    if (this._cactusT <= 0 && this._touchesCactus()) {
      this._cactusT = 0.5;
      this.damage(1, "cactus");
    }
    // пустота под Пределом (и под миром): 4 урона каждые полсекунды, даже в креативе — как в Minecraft
    if (this.pos.y < -48) {
      this._voidT -= dt;
      if (this._voidT <= 0) {
        this._voidT = 0.5;
        const was = this.mode;
        this.mode = "survival";
        this.damage(4, "void");
        this.mode = was;
      }
      return;
    }
    if (this.inLava) {
      this._lavaT -= dt;
      if (this._lavaT <= 0) {
        this._lavaT = 0.5;
        this.damage(4, "lava");
      }
      this.fireT = 15;
    } else {
      this._lavaT = 0;
      if (this.inFire) this.fireT = Math.max(this.fireT, 8);
      else if (this.inWater) this.fireT = 0;
    }
    if (this.fireT > 0 && this.mode !== "creative") {
      this.fireT = Math.max(0, this.fireT - dt);
      this._burnT -= dt;
      if (this._burnT <= 0) {
        this._burnT = 1;
        this.damage(1, "fire");
      }
    } else {
      this.fireT = 0;
      this._burnT = 0;
    }
  }

  /** Тик голода (симуляция, 20 TPS): истощение → еда, регенерация, голодание. */
  tickHunger(dt: number): void {
    if (this.mode === "creative" || this.dead) return;
    this.addExhaustion(P.exhaustIdle * dt); // медленная пассивная трата
    while (this.exhaustion >= P.exhaustionPerFood) {
      this.exhaustion -= P.exhaustionPerFood;
      if (this.saturation > 0)
        this.saturation = Math.max(0, this.saturation - 1);
      else this.food = Math.max(0, this.food - 1);
    }

    // сытость лечит; лечение «стоит» истощения
    if (this.food >= P.regenFoodThreshold && this.health < P.maxHealth) {
      this._regenTimer += dt;
      if (this._regenTimer >= P.regenInterval) {
        this._regenTimer = 0;
        this.health = Math.min(P.maxHealth, this.health + 1);
        this.addExhaustion(P.exhaustRegen);
        events.emit("playerHeal", { health: this.health });
      }
    } else this._regenTimer = 0;

    // голодание: до какого здоровья добивает — по сложности (systems/Difficulty);
    // на мирной голода нет вовсе, на высокой голод убивает
    const floor = rules().starveFloor;
    if (this.food <= 0 && floor !== null) {
      this._starveTimer += dt;
      if (this._starveTimer >= P.starveInterval) {
        this._starveTimer = 0;
        if (this.health > floor) this.damage(1, "starve");
      }
    } else this._starveTimer = 0;

    events.emit("foodChanged", { food: this.food });
  }

  /** Съесть предмет (если это еда и есть куда). @returns {boolean} успех */
  eat(itemName: string): boolean {
    const it = ITEMS[itemName];
    // плод эхоцвета едят и сытым — ради переноса
    if (!it?.food || (this.food >= P.maxFood && itemName !== "echo_fruit"))
      return false;
    this.food = Math.min(P.maxFood, this.food + it.food);
    this.saturation = Math.min(
      this.food,
      this.saturation + (it.saturation ?? it.food * 0.6),
    );
    for (const e of it.eatEffects ?? [])
      this.addEffect(e.id, e.seconds, e.level ?? 1);
    events.emit("playerAte", { item: itemName });
    if (itemName === "echo_fruit") this.echoHop();
    events.emit("foodChanged", { food: this.food });
    return true;
  }

  /** Множитель скорости ходьбы: +20% за уровень Скорости и −15% за уровень Замедления, как в Minecraft. */
  get speedFactor(): number {
    const slow = this.effects.get("slowness")?.level ?? 0;
    return (
      (1 + 0.2 * (this.effects.get("speed")?.level ?? 0)) *
      Math.max(0, 1 - 0.15 * slow) *
      (this.blocking ? 0.3 : 1) // прикрываясь щитом, идёшь медленно
    );
  }

  /**
   * Щит, как в Minecraft: прикрылся, а удар или снаряд пришёл спереди (из полусферы взгляда) — урона нет,
   * щит изнашивается. @returns true — принял щит (урон и эффекты удара не наносить)
   */
  shieldBlocks(from: { x: number; z: number }, amount: number): boolean {
    if (!this.blocking || this.dead || this.mode === "creative") return false;
    const look = this.lookDir();
    if (look.x * (from.x - this.pos.x) + look.z * (from.z - this.pos.z) <= 0)
      return false;
    this.onShieldBlock?.(amount);
    events.emit("shieldBlock", { amount });
    return true;
  }

  /** Ракета в полёте на крыльях: рывок на 1.2 с. false — не летим (ракета не тратится). */
  boost(): boolean {
    if (!this.gliding) return false;
    this._boostT = 1.2;
    return true;
  }

  /** Плод эхоцвета: прыжок в случайную точку до 8 блоков, где есть пол и место на рост. */
  echoHop(): boolean {
    for (let i = 0; i < 16; i++) {
      const x = Math.floor(this.pos.x + (Math.random() - 0.5) * 16),
        z = Math.floor(this.pos.z + (Math.random() - 0.5) * 16),
        y0 = Math.floor(this.pos.y + (Math.random() - 0.5) * 16);
      for (let y = Math.min(y0, 126); y > y0 - 16 && y > 1; y--) {
        if (!BLOCKS[this.world.getBlock(x, y - 1, z)]?.solid) continue;
        if (
          this.world.getBlock(x, y, z) !== 0 ||
          this.world.getBlock(x, y + 1, z) !== 0
        )
          break;
        this.pos.set(x + 0.5, y, z + 0.5);
        this.vel.set(0, 0, 0);
        this._fallDist = 0;
        events.emit("echoHop", { x, y, z });
        return true;
      }
    }
    return false;
  }

  /** Уровень Прыгучести: прыжок выше, безопасное падение длиннее на столько блоков. */
  get jumpBoost(): number {
    return this.effects.get("jump_boost")?.level ?? 0;
  }

  /** Наложить эффект: остаётся более сильный уровень и более долгий срок. */
  addEffect(id: EffectId, seconds: number, level = 1): void {
    const cur = this.effects.get(id);
    this.effects.set(id, {
      level: Math.max(level, cur?.level ?? 0),
      time: Math.max(seconds, cur?.time ?? 0),
    });
    events.emit("effectsChanged", { id });
  }

  clearEffects(): void {
    this.effects.clear();
    events.emit("effectsChanged", {});
  }

  /** Выпить: зелье накладывает эффект, молоко снимает все. */
  drink(d: DrinkDef): void {
    if (d.clearsEffects) this.clearEffects();
    if (d.heal) this.health = Math.min(P.maxHealth, this.health + d.heal);
    if (d.damage) this.damage(d.damage, "magic");
    if (d.food) this.food = Math.min(P.maxFood, this.food + d.food);
    if (d.effect) this.addEffect(d.effect, d.seconds ?? 60, d.level ?? 1);
    events.emit("playerDrank", { effect: d.effect ?? null });
  }

  /** Сроки эффектов; Регенерация лечит 1 здоровье за 2.5 с (вдвое чаще за уровень). */
  _tickEffects(dt: number): void {
    for (const [id, e] of this.effects) {
      e.time -= dt;
      if (e.time <= 0) {
        this.effects.delete(id);
        events.emit("effectsChanged", { id });
      }
    }
    // Тление: 1 урона раз в 2 с (вдвое чаще за уровень), убивает — в отличие от голода
    const decay = this.effects.get("decay");
    if (decay) {
      this._decayT += dt;
      if (this._decayT >= 2 / decay.level) {
        this._decayT = 0;
        this.damage(1, "decay");
      }
    } else this._decayT = 0;
    // Отравление: 1 урона раз в 1.25 с (вдвое чаще за уровень), но не убивает — оставляет 1 здоровья
    const poison = this.effects.get("poison");
    if (poison) {
      this._poisonT += dt;
      if (this._poisonT >= 1.25 / poison.level) {
        this._poisonT = 0;
        if (this.health > 1)
          this.damage(Math.min(1, this.health - 1), "poison");
      }
    } else this._poisonT = 0;
    // Голод (удар кадавра): истощение 0.1 в секунду за уровень — сытость тает быстрее
    const hunger = this.effects.get("hunger");
    if (hunger) this.addExhaustion(0.1 * hunger.level * dt);
    const regen = this.effects.get("regeneration");
    if (!regen) return;
    this._effectRegenT += dt;
    const every = 2.5 / 2 ** (regen.level - 1);
    if (this._effectRegenT >= every) {
      this._effectRegenT = 0;
      if (this.health < P.maxHealth)
        this.health = Math.min(P.maxHealth, this.health + 1);
    }
  }

  /** Смерть: экран «Вы погибли» и выпадение вещей решает Game (подписан на playerDied). */
  _die(): void {
    if (this.dead) return;
    this.dead = true;
    this.fireT = 0;
    this.air = MAX_AIR;
    this.vel.set(0, 0, 0);
    // из транспорта — вон: иначе после возрождения update() ставил игрока обратно к вагонетке/лодке/
    // лошади на месте смерти
    if (this.riding) {
      this.riding.rider = false;
      this.riding = null;
    }
    this.gliding = false;
    this._boostT = 0;
    // эффекты зелий смерть снимает, как в Minecraft (яд и тление не должны пережить возрождение)
    if (this.effects.size) this.clearEffects();
    events.emit("playerDied", { cause: this.lastCause });
  }

  /** Возродиться в точке (кровать или точка мира) с полным здоровьем и сытостью. */
  respawn(at: THREE.Vector3): void {
    clearTimeout(this._respawnT);
    this.pos.copy(at);
    this.vel.set(0, 0, 0);
    this.health = P.maxHealth;
    this.food = P.maxFood;
    this.saturation = 5;
    this.exhaustion = 0;
    this.fireT = 0;
    this._fallDist = 0;
    this.dead = false;
    events.emit("playerRespawn");
  }

  /**
   * Новый мир — новый игрок: всё, что принадлежит старому миру (кровать, якорь, путевой камень,
   * репутация деревни) и телу в нём (эффекты, горение, воздух, опыт, полёт на крыльях), не переносится.
   * Режим игры и взгляд остаются. Место и здоровье ставит следом spawn().
   */
  resetForNewWorld(): void {
    this.riding = null;
    this.gliding = false;
    this._boostT = 0;
    this.effects.clear();
    this.fireT = 0;
    this._burnT = 0;
    this.air = MAX_AIR;
    this._drownT = 0;
    this._fallDist = 0;
    this.bedPos = null;
    this.anchorPos = null;
    this.anchorDim = null;
    this.lodestone = null;
    this.villageRep = 0;
    this.xpLevel = this.xpProgress = this.xpTotal = 0;
    this._xpFrac = 0;
    this.inPowderSnow = this.headInPowderSnow = this._wasInPowder = false;
    events.emit("effectsChanged", {});
    events.emit("xpChanged");
  }

  /** Пересекается ли AABB игрока с блоком (запрет постановки «в себя»). */
  intersectsBlock(bx: number, by: number, bz: number): boolean {
    const half = P.width / 2;
    return (
      bx + 1 > this.pos.x - half &&
      bx < this.pos.x + half &&
      by + 1 > this.pos.y &&
      by < this.pos.y + P.height &&
      bz + 1 > this.pos.z - half &&
      bz < this.pos.z + half
    );
  }

  /** Teardown: отложенный респаун не должен сработать после уничтожения игры. */
  dispose(): void {
    clearTimeout(this._respawnT);
  }

  serialize() {
    return {
      pos: this.pos.toArray(),
      yaw: this.yaw,
      pitch: this.pitch,
      health: this.health,
      food: this.food,
      saturation: this.saturation,
      mode: this.mode,
      flying: this.flying,
      spawn: this.spawnPoint.toArray(),
      xpLevel: this.xpLevel,
      xpProgress: this.xpProgress,
      xpTotal: this.xpTotal,
      bedPos: this.bedPos,
      anchorPos: this.anchorPos,
      villageRep: this.villageRep,
      anchorDim: this.anchorDim,
      lodestone: this.lodestone,
      effects: [...this.effects].map(([id, e]) => ({
        id,
        level: e.level,
        time: e.time,
      })),
      enchSeed: this.enchSeed,
    };
  }
  deserialize(d: PlayerSaveData): void {
    // позиция из чужого файла: NaN в координатах — это чёрный экран и мир, который не грузится
    if (
      Array.isArray(d.pos) &&
      d.pos.length === 3 &&
      d.pos.every((n) => Number.isFinite(n))
    )
      this.pos.fromArray(d.pos);
    this.yaw = Number.isFinite(d.yaw) ? d.yaw : 0;
    this.pitch = Number.isFinite(d.pitch) ? d.pitch : 0;
    // состояние тела прошлого мира не переносится: горение, воздух, крылья, транспорт, падение
    this.riding = null;
    this.gliding = false;
    this._boostT = 0;
    this.fireT = 0;
    this._burnT = 0;
    this.air = MAX_AIR;
    this._drownT = 0;
    this._fallDist = 0;
    this.inPowderSnow = this.headInPowderSnow = this._wasInPowder = false;
    // сейв, записанный на экране смерти: здоровье 0 при dead=false убило бы первым же уроном
    this.health =
      Number.isFinite(d.health) && d.health > 0
        ? Math.min(P.maxHealth, d.health)
        : P.maxHealth;
    this.mode = d.mode === "creative" ? "creative" : "survival";
    this.flying = d.flying;
    this.food = d.food ?? P.maxFood;
    this.saturation = d.saturation ?? 5;
    this.exhaustion = 0;
    this.vel.set(0, 0, 0);
    if (Array.isArray(d.spawn) && d.spawn.length === 3)
      this.spawnPoint.fromArray(d.spawn);
    else this.spawnPoint.copy(this.pos);
    this.xpLevel = d.xpLevel ?? 0;
    this.xpProgress = d.xpProgress ?? 0;
    this.xpTotal = d.xpTotal ?? 0;
    const cell = (v: unknown): [number, number, number] | null =>
      Array.isArray(v) && v.length === 3 && v.every((n) => Number.isFinite(n))
        ? [Number(v[0]), Number(v[1]), Number(v[2])]
        : null;
    this.anchorPos = cell(d.anchorPos);
    this.villageRep = clampRep(Number(d.villageRep) || 0);
    this.anchorDim = typeof d.anchorDim === "string" ? d.anchorDim : null;
    this.lodestone =
      d.lodestone && typeof d.lodestone === "object"
        ? { ...d.lodestone }
        : null;
    this.bedPos =
      Array.isArray(d.bedPos) && d.bedPos.length === 3
        ? [d.bedPos[0]!, d.bedPos[1]!, d.bedPos[2]!]
        : null;
    this.dead = false;
    if (typeof d.enchSeed === "number") this.enchSeed = d.enchSeed;
    this.effects.clear();
    for (const e of Array.isArray(d.effects) ? d.effects : [])
      if (EFFECT_IDS.includes(e.id as EffectId) && e.time > 0)
        this.effects.set(e.id as EffectId, {
          level: e.level || 1,
          time: e.time,
        });
  }
}
