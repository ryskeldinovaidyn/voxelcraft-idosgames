// Универсальный моб: риг собирается из parts-описания реестра (BoxGeometry), физика — по коробкам
// блоков (общая с игроком), решения — entities/MobBrain.ts, анимации процедурные.
// Добавление моба = запись в registry/mobs/*.ts, этот код не меняется.
import * as THREE from "three";
import { rules } from "../systems/Difficulty";
import { DYE_COLORS } from "../registry/blocks/colors";
import type { ItemStack as Stack } from "../types";
import { events } from "../core/EventBus";
import { BLOCKS, B } from "../registry/Blocks";
import { moveBody } from "../physics/Collision";
import type { ChunkManager } from "../world/ChunkManager";
import type { EffectId, MobDef } from "../types";
import { think, type MobCtx } from "./MobBrain";

const PX = 1 / 16; // части описаны в пикселях: 16 px = 1 блок
/** Детёныш вырастает за 20 минут, как в Minecraft. */
export const GROW_TIME = 1200;
/** Для страйдера лава — полный куб (physics/Collision, extraSolid). */
const isLava = (id: number): boolean => id === B.lava;

/** follow — ручной идёт за хозяином (MobBrain.petThink). */
export type MobState =
  "idle" | "wander" | "flee" | "chase" | "tempt" | "love" | "follow";

interface AnimPart {
  g: THREE.Group;
  base: THREE.Euler;
}

/**
 * Сколько секунд зомби ломится в дверь, прежде чем она рухнет. Счётчик копится, пока моб
 * упирается в дверь, и МЕДЛЕННО стекает, когда он отскочил: иначе каждый отскок сбрасывал бы
 * долбёжку в ноль и дверь стояла бы вечно (проверено на живом зомби).
 */
const DOOR_TIME = 3;

export class Mob {
  id: number;
  kind = "mob" as const;
  def: MobDef;
  hp: number;
  pos: THREE.Vector3;
  prevPos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  targetYaw: number;
  onGround = false;
  dead = false;
  state: MobState = "idle";
  stateTime: number;
  /** Желаемая скорость этого тика (мозг); отрицательная — пятиться. */
  speed = 0;
  /**
   * Эффекты на мобе: id → сколько ещё секунд. Понимает два — яд (1 урона раз в 2 с, но не
   * добивает) и замедление (вдвое медленнее). Их вешают отравленные стрелы (systems/TippedArrow).
   */
  effects = new Map<EffectId, number>();
  /** Имя с бирки: висит над мобом и держит его в мире (не исчезает вдали от игрока). */
  customName: string | null = null;
  private nameSprite: THREE.Sprite | null = null;
  private _poisonT = 0;
  /** Желаемая вертикальная скорость летуна (мозг). */
  climbWish = 0;
  /** Куда идти, если не туда, куда смотрит (владыка летит по кругу, глядя на игрока); null — по yaw. */
  moveYaw: number | null = null;
  /** Пауза до следующего прыжка (слизень). */
  hopT = 0;
  /** Часы пике фантома: из каждых 6 с — 2 с вниз на цель. */
  swoopT = 0;
  /** Пчела: свой улей, есть ли пыльца, цветок-цель, таймеры поиска и сбора. */
  home: [number, number, number] | null = null;
  pollen = false;
  beeTarget: [number, number, number] | null = null;
  beeT = 0;
  beeWork = 0;
  /** Ударил игрок моба со стайной злостью — EntityManager разбудит стаю на тике. */
  angerCall = false;
  /** Дракон: состояние мозга босса (entities/DragonBrain). Не сохраняется — после загрузки кружит. */
  bossState: unknown = null;
  /** Кристалл, что сейчас лечит дракона (id): луч и урон дракону от взрыва этого кристалла. */
  healFrom: number | null = null;
  /** Не получает урона (Пепельный владыка набирает силу). */
  invulnerable = false;
  /** Панцирник: насколько открыта крышка (0 — закрыт, 1 — открыт); иглобрюх — насколько раздут. */
  peek = 0;
  /** Рыба: сколько секунд на суше. */
  dryT = 0;
  /** Страж (entities/WardenBrain): злость, место последней вибрации, заряд и остывание звукового удара. */
  anger = 0;
  suspect: [number, number, number] | null = null;
  boomT = 0;
  boomCd = 0;
  /** Страж: сколько ещё вылезает из земли; сколько простаивает без тревог; до следующей Тьмы. */
  emergeT = 0;
  idleT = 0;
  darkT = 0;
  /** Коза (entities/GoatBrain): до следующего тарана, пригибается, разгон, сколько рогов осталось. */
  ramCd = 0;
  ramT = 0;
  dashT = 0;
  horns = 2;
  /** Кричащая коза (2%, как в Minecraft): таранит в разы чаще и кричит. */
  screaming = Math.random() < 0.02;
  /** Лягушка (entities/FrogBrain): до следующего броска языком. */
  tongueCd = 0;
  /** Нюхач (entities/SnifferBrain): до следующего принюхивания; сколько ещё роет. */
  sniffCd = 0;
  digT = 0;
  /** Моб волны спавнера испытаний: координаты спавнера (Game засчитывает убитого; вдали не исчезает). */
  trialFrom: [number, number, number] | null = null;
  /** Капитан мародёров: знамя на спине, за его смерть — Дурное знамение. */
  captain = false;
  /** Участник набега: идёт к goal (центру деревни) и не исчезает вдали. */
  raider = false;
  /** Секунд подсветки от колокола (systems: EntityManager.markRaiders). */
  glowT = 0;
  goal: THREE.Vector3 | null = null;
  /** World Pulse: индивидуальная цель участника миграции; штатный мозг и физика ведут к ней. */
  migrationId: string | null = null;
  migrationTarget: [number, number] | null = null;
  migrationDetourT = 0;
  migrationDetourSide = 1;
  /** Ворожей: до следующего заклинания и призванные бесята. */
  castT = 2;
  minions: Mob[] = [];
  /** Бесёнок: сколько ещё жить (сек). */
  lifeT = Infinity;
  private readonly bannerParts: THREE.Object3D[] = [];
  /** Глубинник: сколько заряжается луч (сек), куда он смотрит (null — не заряжает), до следующей Усталости. */
  beamT = 0;
  beamTo: THREE.Vector3 | null = null;
  fatigueT = 3;
  private beamLine: THREE.Line | null = null;
  inWater = false;
  inLava = false;
  hitWall = false;
  baby: boolean;
  growT = 0;
  /** Секунд «любви» после кормления (ищет пару). */
  loveT = 0;
  breedCd = 0;
  fuse = 0;
  attackCd = 0;
  shootCd = 0;
  burnT = 0;
  burning = false;
  /** Снеговик: накопитель секунд в жаре или воде (урон 1 за секунду). */
  snowT = 0;
  /** Попугай на плече игрока: 0 — левое, 1 — правое, null — нет; shoulderCd — пауза после спрыгивания. */
  onShoulder: 0 | 1 | null = null;
  shoulderCd = 0;
  /** Овца: цвет шерсти (id красителя), null — белая; woolShown — какой цвет уже нарисован. */
  woolColor: string | null = null;
  private woolShown: string | null = null;
  /** Броненосец: секунд до разворота (0 — не свёрнут); до следующего сброшенного щитка. */
  rolledT = 0;
  scuteT = 300 + Math.random() * 300;
  /** Волк: запас брони из щитков (0 — без брони). */
  wolfArmor = 0;
  /** Дух-помощник: что велено собирать (образец) и сколько уже собрано. */
  carry: { item: string; count: number } | null = null;
  bag = 0;
  /** Вьюк (осёл, мул, лама): слоты сундука; пусто — не навьючен. */
  items: (Stack | null)[] = [];
  /** На поводке у игрока; leashTo — куда тянется верёвка (рука игрока), задаёт мозг. */
  leashed = false;
  leashTo: THREE.Vector3 | null = null;
  /** Поводок привязан к забору в этой клетке (null — держит игрок). */
  leashPost: [number, number, number] | null = null;
  /** Караван лам: за кем идёт (id моба), не сохраняется. */
  followId: number | null = null;
  /** Поводок держит другой моб (ламы странствующего торговца), не сохраняется. */
  leashMobId: number | null = null;
  /** Сетевая игра: поводок держит игрок с этим слотом (null — свой игрок, одиночная игра). */
  leashSlot: number | null = null;
  /** Секунд до ухода (MobDef.leavesAfter); Infinity — не уходит. */
  leaveT = Infinity;
  /** С ним торгуют (открыт экран торговли) — стоит и смотрит на игрока. */
  trading = false;
  /** Невидим (странствующий торговец ночью — зелье невидимости). */
  invisible = false;
  private leashLine: THREE.Line | null = null;
  private readonly packParts: THREE.Object3D[] = [];
  private readonly armorParts: THREE.Object3D[] = [];
  private readonly outParts: THREE.Object3D[] = [];
  aggro = false;
  justHurt = false;
  /** Недавно бил игрок — за смерть дадут опыт. */
  hitByPlayerT = 0;
  /** Шипун взорвался сам — дропа нет, как в Minecraft. */
  exploded = false;
  sheared = false;
  /** Житель: сколько раз совершена каждая сделка (по индексу в списке профессии) до пополнения. */
  uses: number[] = [];
  /** Житель: занятый рабочий блок (systems/Jobs), null — безработный. */
  jobSite: [number, number, number] | null = null;
  /** Житель уже торговал — профессию не теряет, даже если рабочий блок сломали. */
  traded = false;
  /** Житель: опыт профессии (systems/Trading, levelOf) — открывает следующие сделки. */
  villagerXp = 0;
  /** Зомби-житель: секунд до выздоровления (0 — не лечится) и кем он был (systems/Zombify). */
  curing = 0;
  curedType: string | null = null;
  /** Секунд до следующего пополнения товара за работой у своего блока (не сохраняется). */
  workT = 0;
  /** Ручной (волк, кошка, лошадь), сидит по команде, осёдлан (лошадь). */
  tamed = false;
  sitting = false;
  saddled = false;
  /** Ручной волк: кого атакует (id моба). */
  targetId: number | null = null;
  /** На лошади сидит игрок (Player.riding): мозг молчит, ведёт седок. */
  rider = false;
  private readonly riderWish = { x: 0, z: 0, t: 0 };
  /** Где нарисован (интерполяция) — за это держится седок. */
  readonly renderPos = new THREE.Vector3();
  private readonly tameParts: THREE.Object3D[] = [];
  private readonly saddleParts: THREE.Object3D[] = [];
  /** Замах руки (атака, выстрел). */
  swing = 0;
  animTime = 0;
  flash = 0;
  private lavaT = 0;
  group: THREE.Group;
  mesh: THREE.Object3D;
  private readonly anims = new Map<string, AnimPart[]>();
  private readonly mats: {
    m: THREE.MeshLambertMaterial | THREE.MeshBasicMaterial;
    base: THREE.Color;
    glow: boolean;
  }[] = [];
  private readonly wool: THREE.Object3D[] = [];

  constructor(
    id: number,
    def: MobDef,
    x: number,
    y: number,
    z: number,
    baby = false,
  ) {
    this.id = id;
    this.def = def;
    this.hp = def.hp;
    this.baby = baby;
    this.pos = new THREE.Vector3(x, y, z);
    this.prevPos = this.pos.clone();
    this.vel = new THREE.Vector3();
    this.yaw = Math.random() * Math.PI * 2;
    this.targetYaw = this.yaw;
    this.stateTime = 1 + Math.random() * 2;

    // риг: каждая часть — Group в точке pivot, бокс смещён относительно pivot
    this.group = new THREE.Group();
    for (const p of def.parts) {
      const color = new THREE.Color(p.color);
      const mat = p.glow
        ? new THREE.MeshBasicMaterial({ color })
        : new THREE.MeshLambertMaterial({ color });
      this.mats.push({ m: mat, base: color.clone(), glow: !!p.glow });
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(p.size[0] * PX, p.size[1] * PX, p.size[2] * PX),
        mat,
      );
      mesh.castShadow = mesh.receiveShadow = true;
      const pivot = new THREE.Group();
      const pv = p.pivot ?? p.pos;
      pivot.position.set(pv[0] * PX, pv[1] * PX, pv[2] * PX);
      mesh.position.set(
        (p.pos[0] - pv[0]) * PX,
        (p.pos[1] - pv[1]) * PX,
        (p.pos[2] - pv[2]) * PX,
      );
      if (p.pose) pivot.rotation.set(p.pose[0], p.pose[1], p.pose[2]);
      pivot.add(mesh);
      this.group.add(pivot);
      if (p.anim) {
        const list = this.anims.get(p.anim) ?? [];
        list.push({ g: pivot, base: pivot.rotation.clone() });
        this.anims.set(p.anim, list);
      }
      if (p.name.startsWith("wool")) this.wool.push(pivot);
      if (p.name.startsWith("tame")) this.tameParts.push(pivot);
      if (p.name.startsWith("saddle")) this.saddleParts.push(pivot);
      if (p.name.startsWith("armor")) this.armorParts.push(pivot);
      if (p.name.startsWith("out")) this.outParts.push(pivot);
      if (p.name.startsWith("pack")) this.packParts.push(pivot);
      if (p.name.startsWith("banner")) this.bannerParts.push(pivot);
    }
    if (def.lifespan)
      this.lifeT =
        def.lifespan[0] + Math.random() * (def.lifespan[1] - def.lifespan[0]);
    if (def.leavesAfter)
      this.leaveT =
        def.leavesAfter[0] +
        Math.random() * (def.leavesAfter[1] - def.leavesAfter[0]);
    // овцы в Minecraft изредка бывают чёрные, серые, светло-серые, коричневые и совсем редко розовые
    if (def.dyeable) {
      const r = Math.random();
      this.woolColor =
        r < 0.05
          ? "black"
          : r < 0.1
            ? "gray"
            : r < 0.15
              ? "light_gray"
              : r < 0.18
                ? "brown"
                : r < 0.1816
                  ? "pink"
                  : null;
    }
    this.mesh = this.group; // единообразие с ItemDrop
  }

  /** Что даёт стрижка: шерсть своего цвета (овца), иначе shearDrop. */
  woolItem(): string {
    return this.woolColor
      ? `${this.woolColor}_wool`
      : (this.def.shearDrop?.item ?? "white_wool");
  }

  /** Высота седока над мобом (лошадь). */
  get seatY(): number {
    return this.def.rideable?.seat ?? 1;
  }

  /** Седок жмёт «вперёд»: куда вести лошадь (держится 0.15 с, седок повторяет каждый кадр). */
  push(dx: number, dz: number, _dt: number): void {
    this.riderWish.x = dx;
    this.riderWish.z = dz;
    this.riderWish.t = 0.15;
  }

  get width(): number {
    return this.def.box.w * (this.baby ? 0.5 : 1);
  }
  get height(): number {
    return this.def.box.h * (this.baby ? 0.5 : 1);
  }

  tick(dt: number, c: MobCtx) {
    this.prevPos.copy(this.pos);
    const dec = (v: number) => Math.max(0, v - dt);
    this.flash = dec(this.flash);
    this.attackCd = dec(this.attackCd);
    this.shootCd = dec(this.shootCd);
    this.loveT = dec(this.loveT);
    this.breedCd = dec(this.breedCd);
    this.hitByPlayerT = dec(this.hitByPlayerT);
    this.swing = dec(this.swing);
    // попугай на плече: едет с игроком (мозг и физика молчат); игрок присел или умер — слетает
    if (this.onShoulder !== null) {
      const p = c.player;
      if (p.dead || p._sneaking || p.shoulders[this.onShoulder] !== this.id) {
        if (p.shoulders[this.onShoulder] === this.id)
          p.shoulders[this.onShoulder] = null;
        this.onShoulder = null;
        this.shoulderCd = 3; // не запрыгивать сразу обратно
      } else {
        const side = this.onShoulder === 1 ? 1 : -1;
        this.pos.set(
          p.pos.x + Math.cos(p.yaw) * 0.4 * side,
          p.pos.y + 1.45,
          p.pos.z - Math.sin(p.yaw) * 0.4 * side,
        );
        this.vel.set(0, 0, 0);
        this.yaw = this.targetYaw = p.yaw;
        this.speed = 0;
        this.animTime += dt;
        return;
      }
    }
    this._tickEffects(dt);
    this.glowT = Math.max(0, this.glowT - dt);
    this.shoulderCd = dec(this.shoulderCd);
    this.rolledT = dec(this.rolledT);
    // странствующий торговец и его ламы: срок вышел — уходят (исчезают без дропа)
    if (this.leaveT !== Infinity) {
      this.leaveT -= dt;
      if (this.leaveT <= 0 && !this.dead) {
        this.dead = true; // hp > 0 — без дропа
        events.emit("mobLeft", { entity: this });
      }
    }
    // броненосец сам сбрасывает щиток раз в 5–10 минут
    if (this.def.rollsUp && !this.baby) {
      this.scuteT -= dt;
      if (this.scuteT <= 0) {
        this.scuteT = 300 + Math.random() * 300;
        events.emit("mobDrop", {
          x: this.pos.x,
          y: this.pos.y + 0.3,
          z: this.pos.z,
          item: "armadillo_scute",
        });
      }
    }
    // бесёнок: срок вышел — теряет по 1 здоровью в секунду
    if (this.def.lifespan) {
      this.lifeT -= dt;
      if (
        this.lifeT <= 0 &&
        Math.floor(this.lifeT) !== Math.floor(this.lifeT + dt)
      )
        this.damage(1);
    }
    if (this.baby) {
      this.growT += dt;
      if (this.growT >= GROW_TIME) {
        this.baby = false;
        if (this.def.growDrop) events.emit("mobGrew", { entity: this }); // черепашонок — щиток
      }
    }
    // головастик: вырастает в другой вид (лягушку по биому — EntityManager, событие mobMature)
    // житель Пекла вне Пекла превращается (свинорыл → мёртвый свинорыл, хоглин → зоглин)
    if (
      this.def.growsInto &&
      !this.dead &&
      !(this.def.zombifies && c.world.dimension === "inferno")
    ) {
      this.growT += dt;
      if (this.growT >= (this.def.growTime ?? GROW_TIME)) {
        this.growT = -Infinity;
        events.emit("mobMature", { entity: this });
      }
    }
    // Кристалл Предела: ни мозга, ни физики — висит над колонной
    if (this.def.stationary) {
      this.animTime += dt;
      return;
    }
    // панцирник сидит на блоке: мозг решает, открыться ли и стрелять; ни шагов, ни гравитации
    if (this.def.anchored) {
      think(this, c, dt);
      this.animTime += dt;
      return;
    }

    const world = c.world;
    const feet = world.getBlock(
      Math.floor(this.pos.x),
      Math.floor(this.pos.y + 0.2),
      Math.floor(this.pos.z),
    );
    this.inWater = feet === B.water || !!BLOCKS[feet]?.waterlogged;
    this.inLava = feet === B.lava;
    // рыба на суше: 5 с — и по 1 урону в секунду; бьётся, подпрыгивая
    if (this.def.needsWater) {
      if (this.inWater) this.dryT = 0;
      else {
        this.dryT += dt;
        // рыба задыхается через 5 с и бьётся на месте; аксолотль ходит по суше dryTime секунд
        const limit = this.def.dryTime ?? 5;
        if (
          this.dryT > limit &&
          Math.floor(this.dryT) !== Math.floor(this.dryT - dt)
        )
          this.damage(1);
        if (!this.def.dryTime && this.onGround && Math.random() < dt * 3)
          this.vel.y = 3;
      }
    }

    if (this.rider) {
      // под седоком: направление и галоп — от игрока; ступеньки перепрыгивает сам (hitWall ниже)
      const w = this.riderWish;
      w.t -= dt;
      if (w.t > 0 && (w.x || w.z)) {
        this.targetYaw = this.yaw = Math.atan2(-w.x, -w.z);
        this.speed = this.def.rideable?.speed ?? this.def.walkSpeed;
      } else this.speed = 0;
    } else think(this, c, dt);

    // плавный поворот к целевому направлению
    let dy = this.targetYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * Math.min(1, 6 * dt);

    const moveYaw = this.moveYaw ?? this.yaw;
    const slow = this.effects.has("slowness") ? 0.5 : 1;
    const wishX = -Math.sin(moveYaw) * this.speed * slow;
    const wishZ = -Math.cos(moveYaw) * this.speed * slow;
    const accel = Math.min(1, 10 * dt);
    this.vel.x += (wishX - this.vel.x) * accel;
    this.vel.z += (wishZ - this.vel.z) * accel;
    if (this.def.hops) {
      // прыжками: на земле стоит и выжидает, в воздухе летит туда, куда смотрит
      if (this.onGround) {
        this.vel.x = 0;
        this.vel.z = 0;
        this.hopT -= dt;
        if (this.speed !== 0 && this.hopT <= 0) {
          this.vel.y = 7;
          this.hopT = 0.5 + Math.random() * 1.5;
        }
      } else {
        this.vel.x = wishX * 1.5;
        this.vel.z = wishZ * 1.5;
      }
    }
    // летун и пловец в воде: без гравитации, высоту задаёт мозг (climbWish)
    if (this.def.flies || (this.def.swims && this.inWater))
      this.vel.y += (this.climbWish - this.vel.y) * accel;
    else {
      this.vel.y -= 22 * dt;
      if (this.inWater || this.inLava) this.vel.y = Math.max(this.vel.y, 1.5); // всплывает
    }

    if (this.def.noClip)
      this.pos.addScaledVector(this.vel, dt); // дракон: сквозь блоки
    else this._move(dt, world);
    // пустота под миром (край острова Предела): падал бы вечно — ручной волк или названная бирка
    // не исчезают по дальности и висели бы в списке сущностей навсегда. Пустота убивает, как в Minecraft
    if (this.pos.y < -64 && !this.def.boss && !this.dead) {
      this.hp = 0;
      this.dead = true;
    }

    // зомби осады ломает дверь, в которую упёрся (как в Minecraft на высокой сложности)
    // ⚠ у обычного враждебного моба aggro остаётся false: злость — это поле для НЕЙТРАЛЬНЫХ
    // (свинорыл, голем), а зомби враждебен по категории. Дверь ломает и тот, и другой.
    if (
      this.def.breaksDoors &&
      rules().doorBreaking && // только на высокой сложности (systems/Difficulty)
      (this.aggro || this.def.category === "hostile") &&
      this.speed !== 0
    )
      this._breakDoor(dt, world);
    else this.doorT = Math.max(0, this.doorT - dt); // короткий отскок не сбрасывает долбёжку

    // упёрся в стену на ходу — подпрыгнуть (на 1 блок); паук лезет по стене
    if (this.speed !== 0 && this.hitWall && !this.def.hops) {
      if (this.def.climbs) this.vel.y = 3;
      else if (this.onGround) this.vel.y = 7;
    }

    // лава и огонь жгут: 4 и 1 урона каждые полсекунды
    if (
      (this.inLava ||
        feet === B.fire ||
        feet === B.soul_fire ||
        feet === B.campfire ||
        feet === B.soul_campfire) &&
      !this.def.fireImmune
    ) {
      this.lavaT -= dt;
      if (this.lavaT <= 0) {
        this.lavaT = 0.5;
        this.damage(this.inLava ? 4 : 1);
      }
    }

    this.animTime +=
      dt * (this.speed !== 0 ? Math.hypot(this.vel.x, this.vel.z) * 3 : 0);
  }

  /** Шаг с коллизиями по коробкам форм — тот же код, что у игрока (physics/Collision). */
  _move(dt: number, world: ChunkManager) {
    const r = moveBody(
      world,
      {
        x: this.pos.x,
        y: this.pos.y,
        z: this.pos.z,
        hw: this.width / 2,
        h: this.height,
      },
      this.vel.x * dt,
      this.vel.y * dt,
      this.vel.z * dt,
      // страйдер стоит на лаве, как на полу
      {
        step: this.onGround ? 0.6 : 0,
        onGround: this.onGround,
        ...(this.def.walksOnLava ? { extraSolid: isLava } : {}),
      },
    );
    this.pos.x += r.dx;
    this.pos.y += r.dy;
    this.pos.z += r.dz;
    if (r.hitDown) {
      this.onGround = true;
      this.vel.y = 0;
    } else {
      this.onGround = false;
      if (r.hitUp) this.vel.y = 0;
    }
    if (r.hitX) this.vel.x = 0;
    if (r.hitZ) this.vel.z = 0;
    this.hitWall = r.hitX || r.hitZ;
  }

  /** Стрелы отскакивают: Пепельный владыка на половине здоровья, закрытый панцирник. */
  shielded(): boolean {
    return (
      (this.def.boss === "ash_lord" && this.hp <= this.def.hp / 2) ||
      (!!this.def.shell && this.peek < 0.3)
    );
  }

  /** Урон без отброса (солнце, лава, падение). */
  damage(amount: number) {
    if (this.dead || this.invulnerable) return;
    this.hp -= amount;
    this.flash = 0.4;
    events.emit("mobHurt", { entity: this, amount });
    if (this.hp <= 0) {
      if (this.def.boss === "dragon")
        this.hp = 0; // дракон умирает сам — после анимации (DragonBrain)
      else this.dead = true;
    }
  }

  /** Удар: урон, отброс от атакующего, вспышка; мирный убегает, остальные злятся. */
  /** Дать имя с бирки: табличка над головой. Пустое имя — снять. */
  setName(name: string | null): void {
    const clean = (name ?? "").trim().slice(0, 24);
    this.customName = clean || null;
    if (this.nameSprite) {
      this.group.remove(this.nameSprite);
      this.nameSprite.material.map?.dispose();
      this.nameSprite.material.dispose();
      this.nameSprite = null;
    }
    if (!this.customName) return;
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 64;
    const g = c.getContext("2d")!;
    g.font = "bold 34px monospace";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "rgba(0,0,0,0.45)";
    g.fillRect(0, 12, 256, 40);
    g.fillStyle = "#ffffff";
    g.fillText(this.customName, 128, 32, 248);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        depthTest: false,
        transparent: true,
      }),
    );
    s.scale.set(1.6, 0.4, 1);
    s.position.set(0, this.height + 0.45, 0);
    this.group.add(s);
    this.nameSprite = s;
  }

  /** Повесить эффект (дольше уже висящего — продлить). */
  applyEffect(id: EffectId, seconds: number): void {
    this.effects.set(id, Math.max(this.effects.get(id) ?? 0, seconds));
  }

  /** Сроки эффектов и урон от яда — зовётся из tick. */
  private _tickEffects(dt: number): void {
    if (!this.effects.size) return;
    for (const [id, t] of this.effects)
      if (t - dt <= 0) this.effects.delete(id);
      else this.effects.set(id, t - dt);
    if (!this.effects.has("poison")) {
      this._poisonT = 0;
      return;
    }
    this._poisonT += dt;
    if (this._poisonT >= 2) {
      this._poisonT = 0;
      if (this.hp > 1) this.damage(1); // яд не добивает, как в Minecraft
    }
  }

  /** Секунд, что моб уже ломится в дверь перед собой. */
  private doorT = 0;

  /** Долбить дверь перед собой: через DOOR_TIME секунд она ломается совсем. */
  private _breakDoor(dt: number, world: ChunkManager): void {
    const ahead = new THREE.Vector3(
      -Math.sin(this.yaw),
      0,
      -Math.cos(this.yaw),
    );
    const x = Math.floor(this.pos.x + ahead.x * 0.7),
      z = Math.floor(this.pos.z + ahead.z * 0.7),
      y = Math.floor(this.pos.y);
    const id = world.getBlock(x, y, z);
    if (BLOCKS[id]?.shape !== "door") {
      this.doorT = Math.max(0, this.doorT - dt);
      return;
    }
    this.doorT += dt;
    if (this.doorT < DOOR_TIME) return;
    this.doorT = 0;
    // дверь из двух половин: сносим обе, обломков не остаётся
    world.setBlock(x, y, z, B.air!);
    if (BLOCKS[world.getBlock(x, y + 1, z)]?.shape === "door")
      world.setBlock(x, y + 1, z, B.air!);
    if (BLOCKS[world.getBlock(x, y - 1, z)]?.shape === "door")
      world.setBlock(x, y - 1, z, B.air!);
    events.emit("doorBroken", { x, y, z });
  }

  hurt(damage: number, fromPos: THREE.Vector3, byPlayer = true) {
    if (this.dead || this.invulnerable) return;
    this.justHurt = true;
    // броня волка берёт урон на себя, пока не износится
    if (this.wolfArmor > 0) {
      const a = Math.min(this.wolfArmor, damage);
      this.wolfArmor -= a;
      damage -= a;
      if (this.wolfArmor <= 0) events.emit("wolfArmorBroke", { entity: this });
    }
    // броненосец: свёрнутый держит удар (−3), любой удар сворачивает на 6 с
    if (this.def.rollsUp) {
      if (this.rolledT > 0) damage = Math.max(0, damage - 3);
      this.rolledT = 6;
    }
    if (byPlayer) {
      this.hitByPlayerT = 5;
      events.emit("playerHitMob", { entity: this }); // ручные волки бросаются на обидчика
    }
    const away = this.pos.clone().sub(fromPos).setY(0);
    if (away.lengthSq() < 1e-6)
      away.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    away.normalize();
    if (!this.def.boss) this.vel.add(away.clone().multiplyScalar(6)).setY(5); // дракона не отбросить
    if (this.def.category === "passive") {
      this.state = "flee";
      // Ход моба — (-sin yaw, -cos yaw), и этот yaw даёт ход вдоль `away`, т.е. прочь от атакующего.
      this.targetYaw = Math.atan2(-away.x, -away.z);
      this.stateTime = 3;
    } else if (!this.tamed) this.aggro = true; // ручной на хозяина не злится
    if (byPlayer && this.def.groupAnger) this.angerCall = true;
    this.damage(damage);
  }

  updateVisual(alpha: number, time: number, bright = 1) {
    const p = this.prevPos.clone().lerp(this.pos, alpha);
    this.group.position.copy(p);
    this.renderPos.copy(p);
    this._drawBeam(p);
    this._drawLeash();
    this.group.visible = !this.invisible;
    this.group.rotation.y = this.yaw;
    // Шипун раздувается перед взрывом
    // иглобрюх раздувается шаром
    const swell = this.def.explode
      ? 1 + (this.fuse / this.def.explode.fuse) * 0.18
      : this.def.puffs
        ? 1 + this.peek * 0.9
        : 1;
    this.group.scale.setScalar((this.baby ? 0.5 : 1) * swell);

    // анимации: шаг ногами, руки в такт (или замах), покачивание головы, крылья при падении
    const walk = Math.sin(this.animTime * 6) * 0.7;
    const swingArm =
      this.swing > 0 ? Math.sin((this.swing / 0.3) * Math.PI) * 1.2 : 0;
    const set = (name: string, fn: (a: AnimPart) => void) =>
      this.anims.get(name)?.forEach(fn);
    set("legL", (a) => (a.g.rotation.x = a.base.x + walk));
    set("legR", (a) => (a.g.rotation.x = a.base.x - walk));
    set("armL", (a) => (a.g.rotation.x = a.base.x - walk * 0.5 - swingArm));
    set("armR", (a) => (a.g.rotation.x = a.base.x + walk * 0.5 - swingArm));
    set(
      "head",
      (a) => (a.g.rotation.x = a.base.x + Math.sin(time * 1.7) * 0.08),
    );
    set("lid", (a) => (a.g.rotation.x = a.base.x + this.peek * 0.9));
    const falling = !this.onGround && this.vel.y < -1;
    // курица хлопает, только падая; летуны машут всегда (дракон — медленно и широко)
    const wing = this.def.boss
      ? Math.sin(time * 3) * 0.6
      : falling || this.def.flies
        ? Math.sin(time * 30) * 0.9
        : 0.05;
    set("wingL", (a) => (a.g.rotation.z = wing));
    set("wingR", (a) => (a.g.rotation.z = -wing));
    for (const w of this.wool) w.visible = !this.sheared;
    // окрашенная овца: шерсти — свой материал цвета красителя (общие материалы не трогаем)
    if (this.woolShown !== this.woolColor) {
      this.woolShown = this.woolColor;
      const hex = DYE_COLORS.find(
        (d) => d.id === (this.woolColor ?? "white"),
      )?.hex;
      if (hex)
        for (const w of this.wool)
          w.traverse((o) => {
            if (!(o instanceof THREE.Mesh)) return;
            const mat = (o.material as THREE.MeshLambertMaterial).clone();
            mat.color.set(hex);
            o.material = mat;
          });
    }
    for (const t of this.tameParts) t.visible = this.tamed;
    for (const s of this.saddleParts) s.visible = this.saddled;
    for (const a of this.armorParts) a.visible = this.wolfArmor > 0;
    for (const o of this.outParts) o.visible = this.rolledT <= 0; // свёрнутый броненосец — один панцирь
    for (const k of this.packParts) k.visible = this.items.length > 0;
    for (const b of this.bannerParts) b.visible = this.captain;

    // свет места (пещера темнее), вспышка урона, горение на солнце, мигание фитиля
    const fuseBlink =
      this.fuse > 0 && Math.sin(time * (8 + this.fuse * 12)) > 0;
    // владыка: набирая силу, мерцает синим; в броне — синеватый отлив
    const emissive =
      this.flash > 0
        ? 0xff3333
        : this.burning && Math.sin(time * 20) > 0
          ? 0xff7a1a
          : fuseBlink
            ? 0xffffff
            : this.invulnerable
              ? Math.sin(time * 10) > 0
                ? 0x3050ff
                : 0x000000
              : this.shielded()
                ? 0x1a2a60
                : 0x000000;
    for (const { m, base, glow } of this.mats) {
      if (glow) continue;
      m.color.copy(base).multiplyScalar(this.glowT > 0 ? 2.4 : bright);
      const lm = m as THREE.MeshLambertMaterial;
      if (lm.emissive.getHex() !== emissive) lm.emissive.setHex(emissive);
    }
  }

  /** Луч глубинника: линия от глаза к цели, от лилового к жёлтому по мере зарядки. */
  /** Верёвка поводка — дочерняя линия группы (уходит вместе с мобом): от шеи до руки игрока. */
  private _drawLeash(): void {
    const to = this.leashTo; // к держателю поводка или к ламе впереди в караване (задаёт мозг)
    if (!to) {
      if (this.leashLine) this.leashLine.visible = false;
      return;
    }
    if (!this.leashLine) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]);
      this.leashLine = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({ color: 0x8a6a3a }),
      );
      this.group.add(this.leashLine);
    }
    this.leashLine.visible = true;
    this.group.updateMatrixWorld();
    const s = this.group.scale.x || 1;
    const local = this.group.worldToLocal(to.clone());
    const a = this.leashLine.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    a.setXYZ(0, 0, (this.height * 0.8) / s, 0);
    a.setXYZ(1, local.x, local.y, local.z);
    a.needsUpdate = true;
  }

  private _drawBeam(p: THREE.Vector3): void {
    const to = this.beamTo;
    if (!to || !this.group.parent) {
      if (this.beamLine) this.beamLine.visible = false;
      return;
    }
    if (!this.beamLine) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]);
      this.beamLine = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({ color: 0x9a60ff }),
      );
      this.group.parent.add(this.beamLine);
    }
    const a = this.beamLine.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    a.setXYZ(0, p.x, p.y + this.height / 2, p.z);
    a.setXYZ(1, to.x, to.y, to.z);
    a.needsUpdate = true;
    const k = Math.min(1, this.beamT / 3);
    (this.beamLine.material as THREE.LineBasicMaterial).color.setRGB(
      0.6 + 0.4 * k,
      0.4 + 0.5 * k,
      1 - 0.8 * k,
    );
    this.beamLine.visible = true;
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group);
    if (this.beamLine) {
      scene.remove(this.beamLine);
      this.beamLine.geometry.dispose();
      (this.beamLine.material as THREE.Material).dispose();
    }
    // traverse даёт Object3D; узкий каст к Mesh для доступа к geometry (проверка isMesh — рантайм).
    this.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
    });
    for (const { m } of this.mats) m.dispose();
  }

  serialize() {
    return {
      kind: "mob",
      type: this.def.name,
      pos: this.pos.toArray(),
      hp: this.hp,
      baby: this.baby,
      sheared: this.sheared,
      ...(this.uses.length ? { uses: [...this.uses] } : {}),
      ...(this.jobSite ? { jobSite: [...this.jobSite] } : {}),
      ...(this.traded ? { traded: true } : {}),
      ...(this.villagerXp > 0 ? { villagerXp: this.villagerXp } : {}),
      ...(this.curedType ? { curedType: this.curedType } : {}),
      ...(this.curing > 0 ? { curing: Math.round(this.curing) } : {}),
      ...(this.tamed ? { tamed: true } : {}),
      ...(this.customName ? { customName: this.customName } : {}),
      ...(this.sitting ? { sitting: true } : {}),
      ...(this.saddled ? { saddled: true } : {}),
      ...(this.woolColor ? { woolColor: this.woolColor } : {}),
      ...(this.wolfArmor > 0 ? { wolfArmor: this.wolfArmor } : {}),
      ...(this.carry ? { carry: this.carry.item, bag: this.bag } : {}),
      ...(this.items.length
        ? { items: this.items.map((s) => (s ? { ...s } : null)) }
        : {}),
      ...(this.leashed ? { leashed: true } : {}),
      ...(this.leashPost ? { leashPost: [...this.leashPost] } : {}),
      ...(this.leashSlot !== null ? { leashSlot: this.leashSlot } : {}),
      ...(this.leaveT !== Infinity ? { leaveT: Math.round(this.leaveT) } : {}),
      ...(this.migrationId && this.migrationTarget ? { migrationId: this.migrationId, migrationTarget: this.migrationTarget } : {}),
      ...(this.home ? { home: [...this.home] } : {}),
      ...(this.pollen ? { pollen: true } : {}),
      ...(this.captain ? { captain: true } : {}),
    };
  }
}
