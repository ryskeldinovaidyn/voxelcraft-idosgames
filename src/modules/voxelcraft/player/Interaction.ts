// Взаимодействие с миром. Разделено на две половины:
//   frame() — «клиентская»: raycast из камеры, рамка выделения, перевод
//             состояния ввода (зажатая ЛКМ, цель) в интенты;
//   tick()  — «серверная»: выгребает очередь интентов, валидирует
//             (дистанция, наличие предмета, кулдаун) и исполняет.
// В этапе 2 tick()-половина живёт только у хоста; frame()-половина у всех.
import * as THREE from "three";
import { CONFIG } from "../config";
import { events } from "../core/EventBus";
import { Intent, type IntentMsg, type IntentQueue } from "../core/Intents";
import { BLOCKS, B, isWaterSource, packWater } from "../registry/Blocks";
import { DIMENSIONS } from "../world/Dimensions";
import { itemUseFor } from "../world/itemUse";
import { isArrow, tippedEffect } from "../systems/TippedArrow";
import { enchantDrops, enchLevel } from "../systems/Enchant";
import { ITEMS } from "../registry/Items";
import { selectionBoxes } from "../registry/shapes";
import { raycastBlocks, type RaycastHit } from "../world/Raycast";
import { BEHAVIOURS } from "../world/behaviours/index";
import { breakSeconds, canHarvest, dropsOf } from "../systems/Mining";
import { fishLoot } from "../systems/Fishing";
import { harvestHive, isHive } from "../world/Hive";
import { planPlacement } from "./Placement";
import { FISH_BUCKETS } from "../registry/items/treasure";
import { maceSmash } from "../registry/items/trial";
import { bundleItems } from "../systems/Bundle";
import { barterRoll } from "../systems/Barter";
import { WOLF_ARMOR } from "../registry/items/armadillo";
import { CROSSBOW_CHARGE, TRIDENT_CHARGE } from "../registry/items/ranged";
import { CURE_ITEM, CURE_SECONDS } from "../systems/Zombify";

/** Кого доят ведром. */
const MILKABLE = new Set(["cow", "goat", "mooshroom"]);
import { PLAYER_SHOT } from "../entities/Fireball";
import type { ChunkManager } from "../world/ChunkManager";
import type { Player } from "./Player";
import type { Input } from "./Input";
import type { Inventory } from "../systems/Inventory";
import type { EntityManager } from "../entities/EntityManager";
import type { TextureAtlas } from "../gfx/TextureAtlas";
import type { Mob } from "../entities/Mob";
import type { ItemStack } from "../types";

/** Ближайшая сущность под прицелом. */
type EntityHit = ReturnType<EntityManager["raycast"]>;

/** Сила лука по времени натяжения — формула Minecraft (полная за 1 с). */
function bowPower(seconds: number): number {
  const f = seconds / 1;
  return Math.min(1, (f * f + 2 * f) / 3);
}
/** Состояние ломания блока (тиковая половина). */
interface BreakInfo {
  x: number;
  y: number;
  z: number;
  id: number;
  /** Доля прочности, сбитая до сих пор (0..1). */
  progress: number;
  /** Секунд ломания на старте — порог показа трещин. */
  total: number;
}
/** Накопленный урон по блоку: доля прочности (0..1) + таймер заживления. */
interface DamageInfo {
  id: number;
  progress: number;
  heal: number;
}

export class Interaction {
  world: ChunkManager;
  player: Player;
  inventory: Inventory;
  intents: IntentQueue;
  entities: EntityManager;
  target: RaycastHit | null;
  targetEntity: EntityHit;
  breaking: BreakInfo | null;
  _sentBreakKey: string | null;
  _placeCooldown: number;
  _attackCooldown: number;
  eating: { item: string; time: number } | null;
  _sentEat: string | null;
  damage: Map<string, DamageInfo>;
  highlight: THREE.LineSegments;
  crackMat: THREE.MeshBasicMaterial;
  crackMesh: THREE.Mesh;
  atlas: TextureAtlas;
  _crackStage: number;
  /** Кадровая половина: сколько ждать до следующего замаха, пока ЛКМ зажата по блоку/воздуху. */
  _swingTimer = 0;
  /** ПКМ по двери/люку срабатывает раз на нажатие — иначе удержание хлопало бы дверью. */
  _usedThisPress = false;
  /** Исполнитель команд консоли (подключает Game): интент Command — на тике, как весь ввод. */
  onCommand: ((text: string) => void) | null = null;
  /** Можно ли сменить режим (сетевая игра: только оператору); null — можно всегда. */
  mayToggleMode: (() => boolean) | null = null;
  /** Натяжение лука, сек (кадровая половина), и тянем ли его сейчас. */
  bowCharge = 0;
  _drawing = false;

  constructor(
    world: ChunkManager,
    player: Player,
    inventory: Inventory,
    intents: IntentQueue,
    scene: THREE.Scene,
    atlas: TextureAtlas,
    entities: EntityManager,
  ) {
    this.world = world;
    this.player = player;
    this.inventory = inventory;
    this.intents = intents;
    this.entities = entities;
    this.target = null; // текущий блок под прицелом (кадровая половина)
    this.targetEntity = null;

    // Состояние ломания (тиковая половина — авторитетно)
    this.breaking = null;
    this._sentBreakKey = null;
    this._placeCooldown = 0;
    this._attackCooldown = 0;
    this.eating = null; // {item, time} — процесс поедания (тиковая половина)
    this._sentEat = null; // защита от повторной отправки EatStart за удержание
    // Накопленный урон по блокам: "x,y,z" -> {id, progress, heal}.
    // Сохраняется при отпускании ЛКМ и медленно «заживает» в простое.
    this.damage = new Map();
    // блок сменился (сломан/заменён/затоплен) — забыть его урон
    events.on("blockChanged", ({ x, y, z }) =>
      this.damage.delete(x + "," + y + "," + z),
    );

    // рамка выделения блока (масштабируется под коробки формы)
    const boxGeo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(boxGeo),
      new THREE.LineBasicMaterial({
        color: 0x111111,
        transparent: true,
        opacity: 0.6,
      }),
    );
    this.highlight.visible = false;
    scene.add(this.highlight);

    // decal трещин: чуть увеличенный куб с прозрачной текстурой стадии
    this.crackMat = new THREE.MeshBasicMaterial({
      map: atlas.texture.clone(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    });
    this.crackMat.map!.magFilter = this.crackMat.map!.minFilter =
      THREE.NearestFilter;
    this.crackMat.map!.generateMipmaps = false;
    this.crackMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.004, 1.004, 1.004),
      this.crackMat,
    );
    this.crackMesh.visible = false;
    this.crackMesh.renderOrder = 2;
    scene.add(this.crackMesh);
    this.atlas = atlas;
    this._crackStage = -1;
  }

  // ---- кадровая половина ------------------------------------------------------

  frame(input: Input): void {
    const eye = this.player.eyePos;
    const dir = this.player.lookDir();
    const hit = raycastBlocks(this.world, eye, dir, CONFIG.player.reach);
    // сущность ближе блока?
    // сущности достаются сквозь траву, снежный слой, огонь (заменяемые блоки): иначе в лугу не
    // погладить волка и не ударить зомби. Вагонетка — своим лучом; моб перехватывает, если ближе
    const blockCap =
      hit && !BLOCKS[hit.id]?.replaceable ? hit.dist : CONFIG.player.reach;
    const cartHit = this.entities.raycastRide(eye, dir, blockCap);
    const entHit = this.entities.raycast(
      eye,
      dir,
      cartHit ? cartHit.t : blockCap,
    );
    const cart = entHit ? null : (cartHit?.cart ?? null);
    this.targetEntity = entHit;
    this.target = entHit || cart ? null : hit;
    this._placeHighlight();

    // ЛКМ: по сущности — атака (повторяется по кулдауну), по блоку — ломание (удержание)
    const canAct = !input.uiOpen && !this.player.dead;
    if (input.leftDown && canAct) {
      if (entHit || cart) {
        // Замах по сущности шлёт тиковая половина (_attack) — ровно на каждый состоявшийся удар.
        this.intents.push(Intent.Attack, { entityId: (entHit ?? cart)!.id });
        if (this._sentBreakKey) {
          this.intents.push(Intent.BreakStop);
          this._sentBreakKey = null;
        }
      } else {
        if (this.target) {
          const k = this.target.x + "," + this.target.y + "," + this.target.z;
          if (this._sentBreakKey !== k) {
            this.intents.push(Intent.BreakStart, {
              x: this.target.x,
              y: this.target.y,
              z: this.target.z,
            });
            this._sentBreakKey = k;
          }
        } else if (this._sentBreakKey) {
          this.intents.push(Intent.BreakStop);
          this._sentBreakKey = null;
        }
        // по блоку (и в воздух) рука машет непрерывно, пока ЛКМ зажата
        if (this._swingTimer <= 0) {
          events.emit("armSwing");
          this._swingTimer = CONFIG.player.swingTime;
        }
      }
    } else {
      if (this._sentBreakKey) {
        this.intents.push(Intent.BreakStop);
        this._sentBreakKey = null;
      }
      this._swingTimer = 0; // следующее нажатие — замах сразу
    }

    // ПКМ: приоритет — существо, которое можно покормить или остричь > блок с поведением (верстак,
    // дверь; присев — мимо него) > лук (натянуть) > еда > постановка
    const held = this.inventory.heldItem();
    const heldFood = held && (ITEMS[held.item]?.food ?? 0) > 0;
    const heldBow = held?.item === "bow";
    const heldCrossbow = held?.item === "crossbow";
    const crossbowLoaded = heldCrossbow && !!held?.tag?.loaded;
    const heldTrident = held?.item === "trident";
    const heldRod = held?.item === "fishing_rod";
    // ножницы и пузырёк по улью — собрать мёд (раньше ведра: пузырёк иначе искал бы воду)
    const hiveHarvest =
      !!this.target &&
      !!held &&
      isHive(this.target.id) &&
      (held.item === "shears" || held.item === "glass_bottle");
    const heldBoat = !!held?.item.endsWith("_boat");
    const t = this.target;
    // забор «используется», когда у игрока есть животные на поводке — ПКМ привяжет их к нему
    const usable =
      !!t &&
      (!!BEHAVIOURS.get(t.id)?.use ||
        (BLOCKS[t.id]?.shape === "fence" && this._leashedHere().length > 0)) &&
      !input.sneak;
    // предмет со своим действием по блоку (мотыга — вспахать, костная мука — удобрить)
    // (пузырёк воды — только по земле, иначе его пьют)
    const itemUse =
      !!t &&
      !!held &&
      !usable &&
      !!itemUseFor(held.item) &&
      (held.item !== "potion_water" || t.id === B.dirt);
    // семена, морковь, картофель по верху пашни — посадить, даже если голоден (как в Minecraft)
    const heldBlock = held ? ITEMS[held.item]?.blockId : null;
    const plantHere =
      !!t &&
      typeof heldBlock === "number" &&
      BLOCKS[heldBlock]?.shape === "crop" &&
      t.id === B.farmland &&
      t.ny === 1;
    // Око Предела: по рамке — вставить (itemUse), куда угодно ещё — бросить к цитадели
    const throwEye = held?.item === "rim_eye" && !(t && t.id === B.rim_frame);
    // житель: ПКМ с чем угодно в руке — торговля (присев — мимо)
    const tradable = !!entHit && !!entHit.def.trades && !input.sneak;
    // ручные и приручаемые: лошадь (сесть, седло), волк и кошка (приручить едой, сидеть/встать)
    const petAct =
      !!entHit &&
      !input.sneak &&
      (!!entHit.def.rideable ||
        (!!entHit.def.tameItems &&
          (entHit.tamed ||
            (!!held && entHit.def.tameItems.includes(held.item)))));
    const feedable =
      !!cart ||
      petAct ||
      (!!entHit &&
        (tradable ||
          !!entHit.def.collector ||
          entHit.leashed ||
          (!!held &&
            held.item === "lead" &&
            entHit.def.category !== "hostile") ||
          (!!entHit.def.chestSlots &&
            ((input.sneak && entHit.items.length > 0) ||
              held?.item === "chest")) ||
          (!!held &&
            (held.item === "name_tag" ||
              held.item === "shears" ||
              (held.item === "bucket" && MILKABLE.has(entHit.def.name)) ||
              (held.item === "bowl" && entHit.def.name === "mooshroom") ||
              (held.item === "gold_ingot" && !!entHit.def.barters) ||
              (held.item === "cookie" && entHit.def.name === "parrot") ||
              (held.item.endsWith("_dye") && !!entHit.def.dyeable) ||
              (held.item === "brush" && !!entHit.def.rollsUp) ||
              (held.item === CURE_ITEM && !!entHit.def.curable) ||
              (held.item === "water_bucket" && !!entHit.def.needsWater) ||
              !!entHit.def.temptItems?.includes(held.item)))));
    const heldDrink = !!held && !!ITEMS[held.item]?.drink;
    const bucketMode =
      held?.item === "bucket" || held?.item === "glass_bottle"
        ? "fill"
        : held?.item === "water_bucket" ||
            held?.item === "lava_bucket" ||
            held?.item === "powder_snow_bucket" ||
            (!!held && held.item in FISH_BUCKETS)
          ? "empty"
          : null;
    let eatingNow = false;
    let drawing = false;
    let blocking = false;
    if (input.rightDown && canAct && feedable) {
      if (!this._usedThisPress) {
        this.intents.push(Intent.InteractEntity, {
          entityId: (cart ?? entHit)!.id,
        });
        events.emit("armSwing");
        this._usedThisPress = true;
      }
    } else if (input.rightDown && canAct) {
      if (usable) {
        if (!this._usedThisPress && this._placeCooldown <= 0) {
          this.intents.push(Intent.UseBlock, { x: t.x, y: t.y, z: t.z });
          events.emit("armSwing");
          this._usedThisPress = true;
          this._placeCooldown = 0.25;
        }
      } else if (throwEye) {
        if (!this._usedThisPress) {
          this.intents.push(Intent.ThrowEye, {});
          events.emit("armSwing");
          this._usedThisPress = true;
        }
      } else if (hiveHarvest) {
        if (!this._usedThisPress) {
          const h = this.target!;
          this.intents.push(Intent.UseItem, {
            x: h.x,
            y: h.y,
            z: h.z,
            nx: h.nx,
            ny: h.ny,
            nz: h.nz,
          });
          events.emit("armSwing");
          this._usedThisPress = true;
        }
      } else if (heldRod) {
        // удочка: забросить или подсечь (Interaction._fish)
        if (!this._usedThisPress) {
          this.intents.push(Intent.Fish, {});
          events.emit("armSwing");
          this._usedThisPress = true;
        }
      } else if (held?.item === "map") {
        // пустая карта — завести карту этого участка (Game.createMap)
        if (!this._usedThisPress) {
          this.intents.push(Intent.UseHeld, {});
          events.emit("armSwing");
          this._usedThisPress = true;
        }
      } else if (held?.item === "rocket") {
        // ракета: в полёте на крыльях — рывок вдоль взгляда, на земле — фейерверк с той клетки,
        // куда смотрим (нет цели — из-под ног), интент UseHeld
        if (!this._usedThisPress) {
          const h = this.target;
          this.intents.push(
            Intent.UseHeld,
            h ? { x: h.x + h.nx, y: h.y + h.ny, z: h.z + h.nz } : {},
          );
          this._usedThisPress = true;
        }
      } else if (held?.item === "bundle") {
        // мешок в мире: ПКМ — высыпать всё (интент UseHeld)
        if (!this._usedThisPress) {
          this.intents.push(Intent.UseHeld, {});
          this._usedThisPress = true;
        }
      } else if (held?.item === "snowball" || held?.item === "rim_pearl") {
        // снежок: бросок (интент UseHeld), не чаще раза в 0.25 с
        if (!this._usedThisPress && this._placeCooldown <= 0) {
          this.intents.push(Intent.UseHeld, {});
          events.emit("armSwing");
          this._usedThisPress = true;
          this._placeCooldown = 0.25;
        }
      } else if (held?.item === "wind_charge") {
        // заряд ветра: бросок (интент UseHeld), не чаще раза в 0.5 с
        if (!this._usedThisPress && this._placeCooldown <= 0) {
          this.intents.push(Intent.UseHeld, {});
          events.emit("armSwing");
          this._usedThisPress = true;
          this._placeCooldown = 0.5;
        }
      } else if (heldBoat) {
        // лодка — на воду под прицелом (обычный луч воду пропускает) или на блок
        const lh = raycastBlocks(
          this.world,
          this.player.eyePos,
          this.player.lookDir(),
          CONFIG.player.reach,
          true,
        );
        if (lh && !this._usedThisPress) {
          this.intents.push(Intent.UseItem, {
            x: lh.x,
            y: lh.y,
            z: lh.z,
            nx: lh.nx,
            ny: lh.ny,
            nz: lh.nz,
          });
          events.emit("armSwing");
          this._usedThisPress = true;
        }
      } else if (itemUse) {
        // кисть чистит, пока ПКМ зажата (взмах раз в 0.5 с); остальные предметы — раз на нажатие
        const brush = held!.item === "brush";
        if (brush ? this._placeCooldown <= 0 : !this._usedThisPress) {
          this.intents.push(Intent.UseItem, {
            x: t.x,
            y: t.y,
            z: t.z,
            nx: t.nx,
            ny: t.ny,
            nz: t.nz,
          });
          events.emit("armSwing");
          this._usedThisPress = true;
          if (brush) this._placeCooldown = 0.5;
        }
      } else if (held?.item === "shield") {
        blocking = true; // щит: пока держим ПКМ — прикрываемся
      } else if (crossbowLoaded) {
        // заряженный арбалет — выстрел одним нажатием
        if (!this._usedThisPress) {
          this.intents.push(Intent.ShootBow, { power: 1, charge: 0 });
          this._usedThisPress = true;
        }
      } else if (heldBow || heldCrossbow || heldTrident) {
        // лук натягиваем, арбалет заряжаем, трезубец замахиваемся — удержанием ПКМ
        drawing = true;
      } else if (bucketMode === "fill") {
        // пустое ведро — по жидкости под прицелом (обычный луч жидкость пропускает)
        const lh = raycastBlocks(
          this.world,
          this.player.eyePos,
          this.player.lookDir(),
          CONFIG.player.reach,
          true,
        );
        if (lh && BLOCKS[lh.id]!.liquid && !this._usedThisPress) {
          this.intents.push(Intent.Bucket, {
            mode: "fill",
            x: lh.x,
            y: lh.y,
            z: lh.z,
          });
          this._usedThisPress = true;
        }
      } else if (
        (bucketMode === "empty" || held?.item === "flint_and_steel") &&
        t
      ) {
        if (!this._usedThisPress) {
          this.intents.push(bucketMode ? Intent.Bucket : Intent.Ignite, {
            mode: "empty",
            x: t.x,
            y: t.y,
            z: t.z,
            nx: t.nx,
            ny: t.ny,
            nz: t.nz,
          });
          events.emit("armSwing");
          this._usedThisPress = true;
        }
      } else if (heldDrink) {
        // питьё (зелья, молоко) — как еда, но и сытым, и в креативе
        eatingNow = true;
        if (this._sentEat !== held.item) {
          this.intents.push(Intent.EatStart, { item: held.item });
          this._sentEat = held.item;
        }
      } else if (
        heldFood &&
        !plantHere &&
        this.player.food < CONFIG.player.maxFood &&
        this.player.mode !== "creative"
      ) {
        eatingNow = true;
        if (this._sentEat !== held.item) {
          this.intents.push(Intent.EatStart, { item: held.item });
          this._sentEat = held.item;
        }
      } else if (t && this._placeCooldown <= 0) {
        this.intents.push(Intent.PlaceBlock, {
          x: t.x,
          y: t.y,
          z: t.z,
          nx: t.nx,
          ny: t.ny,
          nz: t.nz,
          hy: t.hy,
          yaw: this.player.yaw,
          pitch: this.player.pitch,
        });
        events.emit("armSwing");
        this._placeCooldown = 0.25;
      }
    }
    // лук: отпустили — выстрел с силой натяжения (как в Minecraft: полная сила за 1 секунду)
    if (!drawing && this.bowCharge > 0) {
      if (this.bowCharge >= 0.1)
        this.intents.push(Intent.ShootBow, {
          power: bowPower(this.bowCharge),
          charge: this.bowCharge,
        });
      this.bowCharge = 0;
    }
    this._drawing = drawing;
    this.player.blocking = blocking;
    if (!eatingNow && this._sentEat) {
      this.intents.push(Intent.EatStop);
      this._sentEat = null;
    }
    if (!input.rightDown) {
      this._placeCooldown = 0;
      this._usedThisPress = false;
    }

    // визуализация трещин: активное ломание либо запомненный урон на блоке под прицелом
    let crack: { x: number; y: number; z: number; frac: number } | null = null;
    if (this.breaking && this.breaking.total > 0.06) {
      crack = {
        x: this.breaking.x,
        y: this.breaking.y,
        z: this.breaking.z,
        frac: this.breaking.progress,
      };
    } else if (this.target) {
      const d = this.damage.get(
        this.target.x + "," + this.target.y + "," + this.target.z,
      );
      const total = this._breakSecs(this.target.id);
      if (d && d.id === this.target.id && d.progress > 0 && total > 0.06)
        crack = {
          x: this.target.x,
          y: this.target.y,
          z: this.target.z,
          frac: d.progress,
        };
    }

    if (crack) {
      const stage = Math.min(9, Math.floor(crack.frac * 10));
      if (stage !== this._crackStage) {
        const uv = this.atlas.uv("crack" + stage);
        // двигаем offset/repeat клона атласа на нужный тайл
        this.crackMat.map!.repeat.set(uv.u1 - uv.u0, uv.v1 - uv.v0);
        this.crackMat.map!.offset.set(uv.u0, uv.v0);
        this._crackStage = stage;
      }
      this.crackMesh.visible = true;
      this.crackMesh.position.set(crack.x + 0.5, crack.y + 0.5, crack.z + 0.5);
    } else {
      this.crackMesh.visible = false;
      this._crackStage = -1;
    }
  }

  /** Рамка выделения по коробкам формы блока под прицелом (у ступеней — ступени, у факела — факел). */
  _placeHighlight(): void {
    const t = this.target;
    if (!t) {
      this.highlight.visible = false;
      return;
    }
    let b = [0, 0, 0, 1, 1, 1];
    const def = BLOCKS[t.id]!;
    if (def.shape !== "cube") {
      const boxes = selectionBoxes(def, t.meta, {
        neighbor: (dx, dy, dz) =>
          this.world.getBlock(t.x + dx, t.y + dy, t.z + dz),
      });
      if (boxes.length) {
        b = [...boxes[0]!];
        for (const q of boxes)
          for (let i = 0; i < 3; i++) {
            b[i] = Math.min(b[i]!, q[i]!);
            b[i + 3] = Math.max(b[i + 3]!, q[i + 3]!);
          }
      }
    }
    this.highlight.visible = true;
    this.highlight.scale.set(b[3]! - b[0]!, b[4]! - b[1]!, b[5]! - b[2]!);
    this.highlight.position.set(
      t.x + (b[0]! + b[3]!) / 2,
      t.y + (b[1]! + b[4]!) / 2,
      t.z + (b[2]! + b[5]!) / 2,
    );
  }

  frameTimers(dt: number): void {
    if (this._placeCooldown > 0) this._placeCooldown -= dt;
    if (this._swingTimer > 0) this._swingTimer -= dt;
    if (this._drawing) this.bowCharge += dt;
  }

  // ---- тиковая половина (симуляция) --------------------------------------------

  tick(dt: number): void {
    if (this._attackCooldown > 0) this._attackCooldown -= dt;

    this.intents.drain((intent: IntentMsg) => {
      switch (intent.type) {
        case Intent.BreakStart:
          this._startBreak(intent);
          break;
        case Intent.BreakStop:
          this.breaking = null;
          break;
        case Intent.PlaceBlock:
          this._place(intent);
          break;
        case Intent.UseBlock:
          this._use(intent);
          break;
        case Intent.InteractEntity:
          this._interactEntity(intent);
          break;
        case Intent.ShootBow:
          this._shootBow(intent);
          break;
        case Intent.Bucket:
          this._bucket(intent);
          break;
        case Intent.Ignite:
          this._ignite(intent);
          break;
        case Intent.DropItem:
          this._dropItem(intent);
          break;
        case Intent.PickBlock:
          this._pickBlock();
          break;
        case Intent.UseItem:
          this._useItem(intent);
          break;
        case Intent.ThrowEye:
          this._throwEye();
          break;
        case Intent.Fish:
          this._fish();
          break;
        case Intent.UseHeld:
          if (this.inventory.heldItem()?.item === "map") this.onUseMap?.();
          else if (this.inventory.heldItem()?.item === "rocket") {
            // в полёте на крыльях — рывок, на земле — фейерверк вверх (gfx/Fireworks)
            const boosted = this.player.boost();
            if (!boosted) {
              const p = this.player.pos;
              events.emit("fireworkLaunch", {
                x: Math.floor(intent.x ?? p.x),
                y: Math.floor(intent.y ?? p.y),
                z: Math.floor(intent.z ?? p.z),
              });
            }
            if (this.player.mode !== "creative") this.inventory.consumeHeld(1);
            events.emit(boosted ? "rocketBoost" : "fireworkShot");
          } else if (this.inventory.heldItem()?.item === "wind_charge")
            this._throwWindCharge();
          else if (this.inventory.heldItem()?.item === "bundle")
            this._emptyBundle();
          else if (this.inventory.heldItem()?.item === "snowball")
            this._throwSnowball();
          else if (this.inventory.heldItem()?.item === "rim_pearl")
            this._throwPearl();
          break;
        case Intent.EatStart:
          this._startEat(intent);
          break;
        case Intent.EatStop:
          this.eating = null;
          break;
        case Intent.Attack:
          this._attack(intent);
          break;
        case Intent.SelectSlot:
          if (intent.slot !== undefined) this.inventory.selectSlot(intent.slot);
          else this.inventory.scrollSlot(intent.delta);
          break;
        case Intent.ToggleMode:
          // сетевая игра: креатив — право оператора (Game подключает проверку)
          if (this.mayToggleMode?.() ?? true) this.player.toggleMode();
          else
            events.emit("chat", { text: "Смена режима — только у операторов" });
          break;
        case Intent.Command:
          this.onCommand?.(String(intent.text ?? ""));
          break;
      }
    });

    // прогресс ломания
    let activeKey: string | null = null;
    if (this.breaking) {
      const { x, y, z } = this.breaking;
      if (this.world.getBlock(x, y, z) !== this.breaking.id) {
        this.damage.delete(x + "," + y + "," + z);
        this.breaking = null;
      } else {
        // доля прочности за тик; инструмент в руке мог смениться посреди ломания
        const secs = this._breakSecs(this.breaking.id);
        this.breaking.progress += secs > 0 ? dt / secs : 1;
        activeKey = x + "," + y + "," + z;
        // запоминаем урон (heal:0 — таймер заживления сбрасывается, пока бьём)
        this.damage.set(activeKey, {
          id: this.breaking.id,
          progress: this.breaking.progress,
          heal: 0,
        });
        if (this.breaking.progress >= 1) {
          this._finishBreak(x, y, z, this.breaking.id);
          this.damage.delete(activeKey);
          this.breaking = null;
        }
      }
    }

    // заживление урона по блокам, которые сейчас не ломают
    for (const [k, d] of this.damage) {
      if (k === activeKey) continue;
      d.heal += dt;
      if (d.heal < CONFIG.player.breakHealDelay) continue;
      d.progress -= dt * CONFIG.player.breakHealRate;
      if (d.progress <= 0) this.damage.delete(k);
    }

    // процесс поедания
    if (this.eating) {
      const held = this.inventory.heldItem();
      const drink = ITEMS[this.eating.item]?.drink;
      if (
        !held ||
        held.item !== this.eating.item ||
        (!drink && this.player.food >= CONFIG.player.maxFood)
      ) {
        this.eating = null;
      } else {
        this.eating.time += dt;
        events.emit("armSwing"); // лёгкое подёргивание еды в руке
        if (this.eating.time >= CONFIG.player.eatTime) {
          if (drink) {
            this.player.drink(drink);
            // выпитое оставляет пузырёк или ведро (в креативе ничего не тратится)
            const rem = ITEMS[this.eating.item]?.remainder;
            if (this.player.mode !== "creative") {
              if (rem) this._giveHeld(rem);
              else this.inventory.consumeHeld(1);
            }
          } else if (this.player.eat(this.eating.item)) {
            // съеденный суп оставляет миску
            const rem = ITEMS[this.eating.item]?.remainder;
            if (rem && this.player.mode !== "creative") this._giveHeld(rem);
            else this.inventory.consumeHeld(1);
          }
          this.eating = null;
        }
      }
    }
  }

  _startEat({ item }: IntentMsg): void {
    const held = this.inventory.heldItem();
    if (!held || held.item !== item) return;
    const def = ITEMS[item];
    if (
      !def?.drink &&
      (!def?.food || this.player.food >= CONFIG.player.maxFood)
    )
      return;
    this.eating = { item, time: 0 };
  }

  _validDistance(x: number, y: number, z: number): boolean {
    const e = this.player.eyePos;
    const dx = x + 0.5 - e.x,
      dy = y + 0.5 - e.y,
      dz = z + 0.5 - e.z;
    return dx * dx + dy * dy + dz * dz <= (CONFIG.player.reach + 1) ** 2;
  }

  /** Описание предмета в руке (null — пустая рука). */
  _heldDef() {
    const held = this.inventory.heldItem();
    return held ? (ITEMS[held.item] ?? null) : null;
  }

  /** Секунды ломания блока тем, что сейчас в руке (в креативе — мгновенно). */
  _breakSecs(blockId: number): number {
    if (this.player.mode === "creative") return 0;
    // Спешка (маяк): +20% скорости добычи за уровень
    const haste = 1 + 0.2 * (this.player.effects.get("haste")?.level ?? 0);
    // Усталость (древний глубинник): добыча в 3.3, 11 и 370 раз медленнее, как в Minecraft
    const fatigue = [1, 0.3, 0.09, 0.0027, 0.00081][
      Math.min(4, this.player.effects.get("mining_fatigue")?.level ?? 0)
    ]!;
    return (
      breakSeconds(
        BLOCKS[blockId]!,
        this._heldDef(),
        enchLevel(this.inventory.heldItem(), "efficiency"),
      ) /
      (haste * fatigue)
    );
  }

  _startBreak({ x, y, z }: IntentMsg): void {
    if (!this._validDistance(x, y, z)) return;
    const id = this.world.getBlock(x, y, z);
    const def = BLOCKS[id]!;
    if (id === B.air || def.liquid || def.hardness === Infinity) return;
    const total = this._breakSecs(id);
    // возобновляем с запомненного урона (если это тот же блок), а не с нуля
    const stored = this.damage.get(x + "," + y + "," + z);
    const progress = stored && stored.id === id ? stored.progress : 0;
    this.breaking = { x, y, z, id, progress, total };
    if (total <= 0.05) {
      // мгновенное ломание
      this._finishBreak(x, y, z, id);
      this.damage.delete(x + "," + y + "," + z);
      this.breaking = null;
    }
  }

  _finishBreak(x: number, y: number, z: number, id: number): void {
    const def = BLOCKS[id]!;
    const meta = this.world.getMeta(x, y, z);
    this.world.setBlock(x, y, z, B.air!);
    events.emit("blockBreak", { x, y, z, id, byPlayer: true });
    this.player.addExhaustion(CONFIG.player.exhaustBreak);
    // В креативе дропов нет; без своего инструмента нужного уровня — тоже (камень рукой ломается
    // впустую, как в Minecraft). Блоки, державшиеся за этот (факел, растение, верх двери),
    // обрушивает systems/BlockUpdates.
    if (this.player.mode !== "creative" && canHarvest(def, this._heldDef()))
      // Шёлковое касание и Удача меняют дроп (systems/Enchant)
      for (const d of enchantDrops(
        def,
        dropsOf(def, meta),
        this.inventory.heldItem(),
      ))
        if (ITEMS[d.item])
          this.entities.spawnDrop(x + 0.5, y + 0.5, z + 0.5, d.item, d.n);
    // износ: инструмент тратит 1 прочности на твёрдый блок, меч — 2 (как в Minecraft)
    const tool = this._heldDef();
    if (this.player.mode !== "creative" && def.hardness > 0 && tool?.durability)
      this.inventory.damageHeld(tool.toolType === "sword" ? 2 : 1);
  }

  /** ПКМ по мобу: ножницами — остричь овцу, едой — покормить (двое накормленных дадут детёныша). */
  _interactEntity({ entityId }: IntentMsg): void {
    const m = this.entities.entities.get(entityId);
    // сетевая игра: в ней (на нём) уже сидит другой игрок — место занято
    if (
      (m?.kind === "minecart" || m?.kind === "boat" || m?.kind === "mob") &&
      m.rider &&
      (this.player.riding as unknown) !== m
    )
      return;
    if (m?.kind === "minecart" || m?.kind === "boat") {
      // сесть в вагонетку или лодку; у вагонетки с сундуком или воронкой — открыть груз
      if (
        !m.dead &&
        m.pos.distanceToSquared(this.player.eyePos) <=
          (CONFIG.player.reach + 1) ** 2
      ) {
        if (m.kind === "minecart" && m.variant !== "plain") {
          if (m.items.length) events.emit("ui:openCart", { entityId: m.id });
          return;
        }
        this.player.mount(m);
        events.emit("cartMount", { entity: m });
      }
      return;
    }
    if (!m || m.kind !== "mob" || m.dead) return;
    if (
      m.pos.distanceToSquared(this.player.eyePos) >
      (CONFIG.player.reach + 1) ** 2
    )
      return;
    if (m.def.trades && !m.baby) {
      events.emit("ui:openTrade", { entityId: m.id });
      return;
    }
    const held = this.inventory.heldItem();
    // золотое яблоко зомби-жителю — начать лечение (systems/Zombify); дважды не лечат
    if (m.def.curable && held?.item === CURE_ITEM && m.curing <= 0) {
      m.curing = CURE_SECONDS;
      if (this.player.mode !== "creative") this.inventory.consumeHeld(1);
      events.emit("villagerCuring", { entity: m });
      return;
    }
    const creative = this.player.mode === "creative";
    // поводок: привязанного ПКМ — отвязать (поводок в руку); поводком — привязать к себе
    if (m.leashed) {
      m.leashed = false;
      m.leashPost = null;
      m.leashMobId = null; // и у торговца можно отобрать ламу, как в Minecraft
      m.leashSlot = null;
      if (this.inventory.add("lead", 1) > 0)
        this.entities.spawnDrop(m.pos.x, m.pos.y + 0.5, m.pos.z, "lead", 1);
      events.emit("mobUnleashed", { entity: m });
      return;
    }
    if (held?.item === "lead" && m.def.category !== "hostile" && !m.def.boss) {
      m.leashed = true;
      m.leashSlot = this.entities.localSlot; // в сетевой игре — именно у этого игрока
      if (!creative) this.inventory.consumeHeld(1);
      events.emit("mobLeashed", { entity: m });
      return;
    }
    // вьюк: сундуком — навьючить (осла и мула — ручных); присев, ПКМ — открыть
    if (m.def.chestSlots) {
      if (
        held?.item === "chest" &&
        !m.items.length &&
        (m.tamed || !m.def.rideable)
      ) {
        m.items = new Array<ItemStack | null>(m.def.chestSlots).fill(null);
        if (!creative) this.inventory.consumeHeld(1);
        events.emit("mobChested", { entity: m });
        return;
      }
      if (m.items.length && this.player._sneaking) {
        events.emit("ui:openCart", { entityId: m.id });
        return;
      }
    }
    // дух-помощник: предмет — «вот что собирать» (берёт один); пустой рукой — забрать его и собранное
    if (m.def.collector) {
      if (!held && m.carry) {
        const left = this.inventory.add(m.carry.item, 1 + m.bag);
        if (left > 0)
          this.entities.spawnDrop(
            this.player.pos.x,
            this.player.pos.y + 1,
            this.player.pos.z,
            m.carry.item,
            left,
          );
        events.emit("allayTaken", { entity: m, item: m.carry.item });
        m.carry = null;
        m.bag = 0;
      } else if (held && !m.carry) {
        m.carry = { item: held.item, count: 1 };
        if (!creative) this.inventory.consumeHeld(1);
        events.emit("allayGiven", { entity: m, item: held.item });
      }
      return;
    }
    // броненосец: щёткой — щиток (как в Minecraft), щётка изнашивается
    if (m.def.rollsUp && held?.item === "brush" && !m.baby) {
      this.entities.spawnDrop(
        m.pos.x,
        m.pos.y + 0.5,
        m.pos.z,
        "armadillo_scute",
        1,
      );
      if (!creative) this.inventory.damageHeld(16);
      events.emit("mobBrushed", { entity: m });
      return;
    }
    // ручной волк: броня из щитков — надеть (до усаживания, иначе ПКМ посадит волка)
    if (
      m.def.wearsArmor &&
      m.tamed &&
      held?.item === "wolf_armor" &&
      m.wolfArmor <= 0
    ) {
      m.wolfArmor = WOLF_ARMOR;
      if (!creative) this.inventory.consumeHeld(1);
      events.emit("wolfArmored", { entity: m });
      return;
    }
    if (this._petAction(m, held, creative)) return;
    if (!held) return;
    // бирка с именем: строка ввода, имя вешает ui/NameEditor (он же тратит бирку)
    if (held.item === "name_tag") {
      events.emit("ui:nameMob", { entityId: m.id });
      return;
    }
    if (held.item === "bucket" && MILKABLE.has(m.def.name) && !m.baby) {
      if (this.inventory.swapHeldOne("milk_bucket"))
        this.entities.spawnDrop(
          this.player.pos.x,
          this.player.pos.y + 1,
          this.player.pos.z,
          "milk_bucket",
          1,
        );
      events.emit("bucketFill", { item: "milk_bucket" });
      return;
    }
    // ведро воды по рыбе — поймать её в ведро (как в Minecraft)
    const fishBucket = `${m.def.name}_bucket`;
    if (
      held.item === "water_bucket" &&
      m.def.needsWater &&
      fishBucket in FISH_BUCKETS
    ) {
      m.dead = true; // hp > 0 — без дропа: рыба теперь в ведре
      this._giveHeld(fishBucket);
      events.emit("bucketFill", { item: fishBucket });
      return;
    }
    // печенье попугаю ядовито, как в Minecraft
    if (m.def.name === "parrot" && held.item === "cookie") {
      if (!creative) this.inventory.consumeHeld(1);
      m.damage(m.hp);
      events.emit("parrotPoisoned", { entity: m });
      return;
    }
    // свинорыл: золотой слиток — бартер (случайное из таблицы systems/Barter)
    if (m.def.barters && held.item === "gold_ingot" && !m.baby) {
      if (!creative) this.inventory.consumeHeld(1);
      const s = barterRoll(Math.random);
      this.entities.spawnDrop(m.pos.x, m.pos.y + 1, m.pos.z, s.item, s.count);
      events.emit("barter", { entity: m, item: s.item });
      return;
    }
    // грибная корова: миской — суп, ножницами — обычная корова и 5 красных грибов
    if (m.def.name === "mooshroom" && !m.baby) {
      if (held.item === "bowl") {
        if (creative) this.inventory.add("mushroom_stew", 1);
        else this._giveHeld("mushroom_stew");
        events.emit("mooshroomStew", { entity: m });
        return;
      }
      if (held.item === "shears") {
        m.dead = true; // hp > 0 — без дропа: на её месте обычная корова
        this.entities.spawnMob("cow", m.pos.x, m.pos.y, m.pos.z);
        this.entities.spawnDrop(
          m.pos.x,
          m.pos.y + 1,
          m.pos.z,
          "red_mushroom",
          5,
        );
        if (!creative) this.inventory.damageHeld(1);
        events.emit("mobSheared", { entity: m });
        return;
      }
    }
    // овца: краситель — шерсть этого цвета (и у стриженой — отрастёт цветной)
    if (m.def.dyeable && held.item.endsWith("_dye") && !m.baby) {
      const color = held.item.slice(0, -4);
      const next = color === "white" ? null : color;
      if (m.woolColor !== next) {
        m.woolColor = next;
        if (!creative) this.inventory.consumeHeld(1);
        events.emit("mobDyed", { entity: m, color });
      }
      return;
    }
    const shear = m.def.shearDrop;
    if (held.item === "shears" && shear && !m.sheared && !m.baby) {
      m.sheared = true;
      const n = shear.max
        ? shear.n + Math.floor(Math.random() * (shear.max - shear.n + 1))
        : shear.n;
      this.entities.spawnDrop(m.pos.x, m.pos.y + 1, m.pos.z, m.woolItem(), n);
      if (!creative) this.inventory.damageHeld(1);
      events.emit("mobSheared", { entity: m });
      return;
    }
    if (
      m.def.temptItems?.includes(held.item) &&
      !m.baby &&
      m.loveT <= 0 &&
      m.breedCd <= 0
    ) {
      m.loveT = 30;
      if (!creative) this.inventory.consumeHeld(1);
      events.emit("mobFed", { entity: m });
    }
  }

  /**
   * ПКМ по приручаемому, как в Minecraft. Лошадь: дикая — попытка приручить (посадка), ручной
   * надеть седло, осёдланная — сесть. Волк и кошка: дикого — приручить своей едой (шанс), ручного —
   * посадить или поднять. @returns действие состоялось
   */
  _petAction(m: Mob, held: ItemStack | null, creative: boolean): boolean {
    const d = m.def;
    if (m.baby) return false;
    if (d.saddleOnly) {
      // страйдер: седлается без приручения, осёдланный — сесть
      if (!m.saddled && held?.item === "saddle") {
        m.saddled = true;
        if (!creative) this.inventory.consumeHeld(1);
        events.emit("mobSaddled", { entity: m });
      } else if (m.saddled) {
        this.player.mount(m);
        events.emit("cartMount", { entity: m });
      } else events.emit("ui:hint", { text: "Нужно седло" });
      return true;
    }
    if (d.rideable) {
      if (m.tamed && !m.saddled && held?.item === "saddle") {
        m.saddled = true;
        if (!creative) this.inventory.consumeHeld(1);
        events.emit("mobSaddled", { entity: m });
      } else if (!m.tamed) {
        if (Math.random() < (d.tameChance ?? 1 / 3)) {
          m.tamed = true;
          events.emit("mobTamed", { entity: m });
        } else {
          m.vel.y = 5; // встала на дыбы — не далась
          events.emit("tameFail", { entity: m });
        }
      } else if (m.saddled) {
        this.player.mount(m);
        events.emit("cartMount", { entity: m });
      } else events.emit("ui:hint", { text: "Нужно седло" });
      return true;
    }
    if (!d.tameItems) return false;
    if (!m.tamed && held && d.tameItems.includes(held.item)) {
      if (!creative) this.inventory.consumeHeld(1);
      if (Math.random() < (d.tameChance ?? 1 / 3)) {
        m.tamed = true;
        m.aggro = false;
        m.sitting = true; // как в Minecraft: только что прирученный садится
        events.emit("mobTamed", { entity: m });
      } else events.emit("tameFail", { entity: m });
      return true;
    }
    if (m.tamed && !(held && d.temptItems?.includes(held.item))) {
      m.sitting = !m.sitting;
      m.speed = 0;
      events.emit("mobSit", { entity: m, sitting: m.sitting });
      return true;
    }
    return false;
  }

  /** ПКМ пустой картой — Game заводит карту участка (systems/Maps). */
  onUseMap: (() => void) | null = null;

  /**
   * Удочка: поплавка нет — забросить; есть — вытащить. Клюёт в этот момент — улов в инвентарь
   * (не влез — под ноги), опыт 1..6, износ удочки.
   */
  _fish(): void {
    if (this.inventory.heldItem()?.item !== "fishing_rod") return;
    const hook = this.entities.playerHook();
    const p = this.player.pos;
    if (hook) {
      if (hook.bite > 0) {
        const loot = fishLoot(Math.random);
        if (this.inventory.addStack(loot) > 0)
          this.entities.spawnDrop(
            p.x,
            p.y + 1,
            p.z,
            loot.item,
            loot.count,
            loot.dmg,
          );
        this.entities.spawnXp(
          p.x,
          p.y + 0.5,
          p.z,
          1 + Math.floor(Math.random() * 6),
        );
        events.emit("fishCaught", { item: loot.item });
        if (this.player.mode !== "creative") this.inventory.damageHeld(1);
      }
      hook.dead = true;
      return;
    }
    const eye = this.player.eyePos,
      dir = this.player.lookDir();
    this.entities.castHook(
      eye.clone().addScaledVector(dir, 0.5),
      dir
        .clone()
        .multiplyScalar(14)
        .add(new THREE.Vector3(0, 2, 0)),
    );
    events.emit("fishCast");
  }

  /** Бросить Око Предела: тратится (в креативе — нет), куда лететь, решает Game (throwEye). */
  _throwEye(): void {
    const held = this.inventory.heldItem();
    if (held?.item !== "rim_eye") return;
    const from = this.player.eyePos;
    if (this.player.mode !== "creative") this.inventory.consumeHeld(1);
    events.emit("throwEye", { x: from.x, y: from.y, z: from.z });
  }

  /** ПКМ предметом со своим действием (мотыга, костная мука) — хук из world/itemUse. */
  _useItem(intent: IntentMsg): void {
    const { x, y, z } = intent;
    if (!this._validDistance(x, y, z)) return;
    const held = this.inventory.heldItem();
    // мёд с полного улья: ножницы — 3 соты у улья, пузырёк — бутылочка в руку
    if (
      held &&
      (held.item === "shears" || held.item === "glass_bottle") &&
      isHive(this.world.getBlock(x, y, z))
    ) {
      const loot = harvestHive(this.world, x, y, z, held.item);
      if (!loot) return;
      if (held.item === "shears") {
        this.entities.spawnDrop(x + 0.5, y + 1, z + 0.5, loot.item, loot.count);
        if (this.player.mode !== "creative") this.inventory.damageHeld(1);
      } else this._giveHeld(loot.item);
      return;
    }
    const fn = held ? itemUseFor(held.item) : undefined;
    if (!held || !fn) return;
    const creative = this.player.mode === "creative";
    fn({
      world: this.world,
      x,
      y,
      z,
      id: this.world.getBlock(x, y, z),
      meta: this.world.getMeta(x, y, z),
      nx: intent.nx,
      ny: intent.ny,
      nz: intent.nz,
      item: held.item,
      rng: Math.random,
      consume: () => {
        if (!creative) this.inventory.consumeHeld(1);
      },
      wear: (n = 1) => {
        if (!creative) this.inventory.damageHeld(n);
      },
      give: (item) => {
        if (!creative) this._giveHeld(item);
      },
    });
  }

  /** Отдать предмет в руку взамен одного из стака; не влезло — под ноги. */
  _giveHeld(item: string): void {
    if (this.inventory.swapHeldOne(item)) {
      const p = this.player.pos;
      this.entities.spawnDrop(p.x, p.y + 1, p.z, item, 1);
    }
  }

  /** Ведро: зачерпнуть источник воды/лавы или вылить жидкость у грани (источником). */
  _bucket(intent: IntentMsg): void {
    const { x, y, z } = intent;
    if (!this._validDistance(x, y, z)) return;
    const held = this.inventory.heldItem();
    if (!held) return;
    if (intent.mode === "fill") {
      const id = this.world.getBlock(x, y, z);
      if (held.item === "glass_bottle") {
        // пузырёк набирает воду, не забирая источник (как в Minecraft)
        if (id !== B.water) return;
        this._giveHeld("potion_water");
        events.emit("bucketFill", { item: "potion_water" });
        return;
      }
      if (held.item !== "bucket") return;
      if (id === B.powder_snow) {
        this.world.setBlock(x, y, z, B.air!);
        this._giveHeld("powder_snow_bucket");
        events.emit("bucketFill", { item: "powder_snow_bucket" });
        return;
      }
      if (!BLOCKS[id]?.liquid || !isWaterSource(this.world.getMeta(x, y, z)))
        return;
      this.world.setBlock(x, y, z, B.air!);
      const full = id === B.lava ? "lava_bucket" : "water_bucket";
      this._giveHeld(full);
      events.emit("bucketFill", { item: full });
      return;
    }
    // ведро с рыбой выливается водой, а рыба выплывает
    const fish = FISH_BUCKETS[held.item];
    const fluid =
      held.item === "water_bucket" || fish
        ? B.water!
        : held.item === "lava_bucket"
          ? B.lava!
          : held.item === "powder_snow_bucket"
            ? B.powder_snow!
            : -1;
    if (fluid < 0) return;
    const hitId = this.world.getBlock(x, y, z);
    const inPlace = BLOCKS[hitId]?.replaceable ?? false;
    const cx = inPlace ? x : x + intent.nx,
      cy = inPlace ? y : y + intent.ny,
      cz = inPlace ? z : z + intent.nz;
    const cur = this.world.getBlock(cx, cy, cz);
    if (cur !== B.air && !BLOCKS[cur]?.replaceable) return;
    if (fluid === B.water && DIMENSIONS[this.world.dimension].waterEvaporates) {
      events.emit("evaporate", { x: cx, y: cy, z: cz }); // в Пекле вода испаряется
    } else {
      this.world.setBlock(
        cx,
        cy,
        cz,
        fluid,
        fluid === B.powder_snow ? 0 : packWater(8, true),
      );
      if (fish) this.entities.spawnMob(fish, cx + 0.5, cy + 0.1, cz + 0.5);
    }
    if (this.player.mode !== "creative") this._giveHeld("bucket");
    events.emit("bucketEmpty", { item: held.item });
  }

  /** Огниво: TNT — взвести, иначе огонь в клетке у грани (портал в Пекло зажигается так же). */
  _ignite(intent: IntentMsg): void {
    const { x, y, z } = intent;
    if (!this._validDistance(x, y, z)) return;
    const held = this.inventory.heldItem();
    if (held?.item !== "flint_and_steel") return;
    const id = this.world.getBlock(x, y, z);
    if (id === B.tnt) {
      this.world.setBlock(x, y, z, B.air!);
      this.entities.spawnTnt(x + 0.5, y, z + 0.5, 4);
    } else {
      const cx = x + intent.nx,
        cy = y + intent.ny,
        cz = z + intent.nz;
      if (this.world.getBlock(cx, cy, cz) !== B.air) return;
      // на песке и почве душ огниво зажигает огонь душ
      const soul = [B.soul_sand, B.soul_soil].includes(
        this.world.getBlock(cx, cy - 1, cz),
      );
      this.world.setBlock(cx, cy, cz, soul ? B.soul_fire! : B.fire!, 0);
      events.emit("fireLit", { x: cx, y: cy, z: cz }); // в рамке зажжёт портал (behaviours/fire)
    }
    if (this.player.mode !== "creative") this.inventory.damageHeld(1);
  }

  /** Q: выбросить предмет (или весь стак) вперёд; подобрать можно через 2 секунды. */
  _dropItem(intent: IntentMsg): void {
    const held = this.inventory.heldItem();
    if (!held) return;
    const n = intent.all ? held.count : 1;
    const dir = this.player.lookDir();
    const from = this.player.eyePos.addScaledVector(dir, 0.4);
    const drop = this.entities.spawnDrop(
      from.x,
      from.y - 0.3,
      from.z,
      held.item,
      n,
      held.dmg,
      held.tag,
    );
    drop.vel
      .copy(dir)
      .multiplyScalar(5)
      .setY(dir.y * 5 + 1.5);
    drop.pickupDelay = 2;
    this.inventory.consumeHeld(n);
    events.emit("itemThrow", { item: held.item });
  }

  /** Снежок: летит дугой по взгляду; бросившего не задевает (PLAYER_SHOT). */
  _throwSnowball(): void {
    const dir = this.player.lookDir();
    this.entities.spawnFireball(
      "snowball",
      this.player.eyePos.clone().addScaledVector(dir, 0.6),
      dir.clone().multiplyScalar(20),
      0,
      PLAYER_SHOT,
    );
    if (this.player.mode !== "creative") this.inventory.consumeHeld(1);
    events.emit("snowballThrow");
  }

  /** Жемчуг Предела: бросок дугой; где упал — туда игрока и переносит (Game слушает pearlLand). */
  _throwPearl(): void {
    const dir = this.player.lookDir();
    this.entities.spawnFireball(
      "pearl",
      this.player.eyePos.clone().addScaledVector(dir, 0.6),
      dir.clone().multiplyScalar(22),
      0,
      PLAYER_SHOT,
    );
    if (this.player.mode !== "creative") this.inventory.consumeHeld(1);
    events.emit("pearlThrow");
  }

  /** Мешок в руке: ПКМ в мире — всё содержимое выпадает перед игроком. */
  _emptyBundle(): void {
    const held = this.inventory.heldItem();
    if (held?.item !== "bundle") return;
    const items = bundleItems(held);
    if (!items.length) return;
    const p = this.player.eyePos
      .clone()
      .addScaledVector(this.player.lookDir(), 0.8);
    for (const s of items)
      this.entities.spawnDrop(
        p.x,
        p.y - 0.3,
        p.z,
        s.item,
        s.count,
        s.dmg,
        s.tag,
      );
    this.inventory.setSlot(this.inventory.hotbarIndex, {
      ...held,
      tag: { ...(held.tag ?? {}), items: [] },
    });
    events.emit("bundleRemove", { all: true });
  }

  /** Заряд ветра: летит по взгляду; порыв в точке попадания отбрасывает всех рядом — и бросившего. */
  _throwWindCharge(): void {
    const dir = this.player.lookDir();
    this.entities.spawnFireball(
      "wind_charge",
      this.player.eyePos.clone().addScaledVector(dir, 0.6),
      dir.clone().multiplyScalar(20),
      0,
      PLAYER_SHOT,
    );
    if (this.player.mode !== "creative") this.inventory.consumeHeld(1);
    events.emit("windThrow");
  }

  /** Средняя кнопка: взять блок под прицелом — выбрать его слот в хотбаре, в креативе — выдать. */
  _pickBlock(): void {
    const t = this.target;
    if (!t) return;
    const def = BLOCKS[t.id]!;
    const name = def.item ?? def.name;
    if (!ITEMS[name]) return;
    const inv = this.inventory;
    const hot = inv.slots.findIndex((s, i) => i < 9 && s?.item === name);
    if (hot >= 0) return inv.selectSlot(hot);
    const main = inv.slots.findIndex((s, i) => i >= 9 && s?.item === name);
    if (main >= 0) {
      const tmp = inv.slots[inv.hotbarIndex] ?? null;
      inv.setSlot(inv.hotbarIndex, inv.slots[main] ?? null);
      inv.setSlot(main, tmp);
      return;
    }
    if (this.player.mode === "creative")
      inv.setSlot(inv.hotbarIndex, {
        item: name,
        count: ITEMS[name]!.maxStack,
      });
  }

  /** Выстрел из лука: тратит стрелу (в креативе — нет) и прочность лука. */
  /** Арбалет: заряженный — выстрел (сильнее и быстрее лука); нет — зарядить, если держали 1.25 с. */
  _crossbow(held: ItemStack, charge: number): void {
    const creative = this.player.mode === "creative";
    if (held.tag?.loaded) {
      const dir = this.player.lookDir();
      const from = this.player.eyePos.addScaledVector(dir, 0.4);
      this.entities.spawnArrow(
        from,
        dir.clone().multiplyScalar(75),
        9,
        true,
        0,
      );
      this.inventory.setSlot(this.inventory.hotbarIndex, {
        ...held,
        tag: { ...held.tag, loaded: false },
      });
      if (!creative) this.inventory.damageHeld(1);
      events.emit("crossbowShoot");
      return;
    }
    if (charge < CROSSBOW_CHARGE) return;
    if (!creative) {
      const bolt = this.inventory.slots.find((s) => s && isArrow(s.item));
      if (!bolt) return;
      this.inventory.consume(bolt.item, 1);
    }
    this.inventory.setSlot(this.inventory.hotbarIndex, {
      ...held,
      tag: { ...(held.tag ?? {}), loaded: true },
    });
    events.emit("crossbowLoad");
  }

  /** Трезубец: держали ПКМ полсекунды — бросок; летит и втыкается, подбирается с износом (entities/Arrow). */
  _throwTrident(held: ItemStack, charge: number): void {
    if (charge < TRIDENT_CHARGE) return;
    const dir = this.player.lookDir();
    const from = this.player.eyePos.addScaledVector(dir, 0.4);
    const a = this.entities.spawnArrow(
      from,
      dir.clone().multiplyScalar(60),
      8,
      true,
      0,
    );
    a.asTrident({
      item: "trident",
      count: 1,
      dmg: (held.dmg ?? 0) + 1,
      ...(held.tag ? { tag: held.tag } : {}),
    });
    if (this.player.mode !== "creative")
      this.inventory.setSlot(this.inventory.hotbarIndex, null);
    events.emit("tridentThrow");
  }

  _shootBow({ power, charge }: IntentMsg): void {
    const held = this.inventory.heldItem();
    if (held?.item === "crossbow")
      return this._crossbow(held, Number(charge) || 0);
    if (held?.item === "trident")
      return this._throwTrident(held, Number(charge) || 0);
    if (held?.item !== "bow") return;
    // какой стрелой стреляем: первая по порядку слотов, как в Minecraft (в креативе — обычная)
    const ammo =
      this.player.mode === "creative"
        ? "arrow"
        : (this.inventory.slots.find((s) => s && isArrow(s.item))?.item ??
          null);
    if (this.player.mode !== "creative") {
      if (!ammo) return;
      this.inventory.consume(ammo, 1);
      this.inventory.damageHeld(1);
    }
    const p = Math.max(0.1, Math.min(1, Number(power) || 0));
    const dir = this.player.lookDir();
    const from = this.player.eyePos.addScaledVector(dir, 0.4);
    const shot = this.entities.spawnArrow(
      from,
      dir.clone().multiplyScalar(60 * p),
      // Сила лука: +25% × (уровень + 1)
      Math.max(
        1,
        Math.round(
          9 *
            p *
            (1 +
              (enchLevel(held, "power") > 0
                ? 0.25 * (enchLevel(held, "power") + 1)
                : 0)),
        ),
      ),
      true,
      0,
    );
    // отравленная стрела несёт свой эффект и подбирается собой (systems/TippedArrow)
    if (ammo && ammo !== "arrow") {
      shot.effect = tippedEffect(ammo);
      shot.pick = { item: ammo, count: 1 };
    }
    events.emit("bowShoot", { power: p });
  }

  /** ПКМ по блоку с поведением (дверь, люк, верстак). */
  /** Животные на поводке у игрока (не у забора) в 10 блоках. */
  _leashedHere(): Mob[] {
    const out: Mob[] = [];
    for (const e of this.entities.entities.values())
      if (
        e.kind === "mob" &&
        !e.dead &&
        e.leashed &&
        !e.leashPost &&
        e.leashMobId === null &&
        (e.leashSlot === null || e.leashSlot === this.entities.localSlot) &&
        e.pos.distanceTo(this.player.pos) < 10
      )
        out.push(e);
    return out;
  }

  /** Привязать животных на поводке к забору в (x, y, z). @returns false — привязывать некого */
  _tieToPost(x: number, y: number, z: number): boolean {
    const list = this._leashedHere();
    if (!list.length) return false;
    for (const m of list) m.leashPost = [x, y, z];
    events.emit("leashTied", { x, y, z, n: list.length });
    return true;
  }

  _use({ x, y, z }: IntentMsg): void {
    if (!this._validDistance(x, y, z)) return;
    const id = this.world.getBlock(x, y, z);
    // забор: животные на поводке у игрока — привязать к нему (узел на столбе)
    if (BLOCKS[id]?.shape === "fence" && this._tieToPost(x, y, z)) return;
    const use = BEHAVIOURS.get(id)?.use;
    if (!use) return;
    const creative = this.player.mode === "creative";
    use({
      world: this.world,
      x,
      y,
      z,
      id,
      meta: this.world.getMeta(x, y, z),
      held: this.inventory.heldItem()?.item ?? null,
      consume: () => {
        if (!creative) this.inventory.consumeHeld(1);
      },
      wear: (n = 1) => {
        if (!creative) this.inventory.damageHeld(n);
      },
      drop: (item, n = 1) =>
        this.entities.spawnDrop(x + 0.5, y + 0.5, z + 0.5, item, n),
      give: (item) => {
        if (!creative) this._giveHeld(item);
      },
    });
  }

  _place(intent: IntentMsg): void {
    const { x, y, z } = intent;
    if (!this._validDistance(x, y, z)) return;
    const held = this.inventory.heldItem();
    if (!held) return;
    const item = ITEMS[held.item];
    if (!item || item.blockId === null) return;
    const id = this.world.getBlock(x, y, z);
    if (id === B.air) return; // блок, по которому кликнули, успел исчезнуть
    const cells = planPlacement(
      this.world,
      item.blockId,
      {
        x,
        y,
        z,
        id,
        nx: intent.nx,
        ny: intent.ny,
        nz: intent.nz,
        hy: intent.hy,
      },
      intent.yaw,
      intent.pitch ?? 0,
    );
    if (!cells) return;
    for (const c of cells) {
      if (!this._validDistance(c.x, c.y, c.z)) return;
      if (BLOCKS[c.id]!.solid && this.player.intersectsBlock(c.x, c.y, c.z))
        return; // не в себя
    }
    for (const c of cells) this.world.setBlock(c.x, c.y, c.z, c.id, c.meta);
    const first = cells[0]!;
    events.emit("blockPlace", {
      x: first.x,
      y: first.y,
      z: first.z,
      id: first.id,
      // панцирный сундук с вещами — они вернутся внутрь (world/blockentities/shell)
      ...(held.tag ? { tag: held.tag } : {}),
    });
    if (this.player.mode !== "creative") this.inventory.consumeHeld(1);
  }

  _attack({ entityId }: IntentMsg): void {
    if (this._attackCooldown > 0) return;
    const cart = this.entities.entities.get(entityId);
    if (cart?.kind === "minecart" || cart?.kind === "boat") {
      // вагонетка и лодка: три удара — сломана, выпадает предметом (в креативе — нет)
      if (
        cart.dead ||
        cart.pos.distanceToSquared(this.player.eyePos) >
          (CONFIG.player.reach + 1) ** 2
      )
        return;
      this._attackCooldown = 0.3;
      events.emit("armSwing");
      if (cart.hit()) {
        if (this.player.riding === cart) this.player.dismount();
        if (this.player.mode !== "creative")
          this.entities.spawnDrop(
            cart.pos.x,
            cart.pos.y + 0.5,
            cart.pos.z,
            cart.dropItem,
            1,
          );
        // груз вагонетки высыпается всегда
        if (cart.kind === "minecart")
          for (const s of cart.items)
            if (s)
              this.entities.spawnDrop(
                cart.pos.x,
                cart.pos.y + 0.5,
                cart.pos.z,
                s.item,
                s.count,
                s.dmg,
                s.tag,
              );
      }
      return;
    }
    // та же проверка дистанции, что у блоков: в этапе 2 интент придёт и от удалённого игрока
    const target = this.entities.entities.get(entityId);
    if (!target || target.kind !== "mob" || target.dead) return;
    const eye = this.player.eyePos;
    if (target.pos.distanceToSquared(eye) > (CONFIG.player.reach + 1) ** 2)
      return;
    this._attackCooldown = CONFIG.player.attackCooldown;
    this.player.addExhaustion(CONFIG.player.exhaustAttack);
    events.emit("armSwing"); // замах — на каждый удар, в том числе при удержании ЛКМ
    const held = this.inventory.heldItem();
    // Сила: +3 урона за уровень, как в Minecraft
    // Острота: +0.5 × уровень + 0.5 (как в Minecraft)
    const sharp = enchLevel(held, "sharpness");
    // булава: удар в падении — урон от высоты, а падение гасится (прыгай с заряда ветра и бей снова)
    const smash =
      held?.item === "mace"
        ? maceSmash(this.player._fallDist, enchLevel(held, "density"))
        : 0;
    const damage =
      (held ? (ITEMS[held.item]?.damage ?? 1) : CONFIG.player.attackDamage) +
      3 * (this.player.effects.get("strength")?.level ?? 0) -
      2 * (this.player.effects.get("weakness")?.level ?? 0) +
      (sharp > 0 ? 0.5 * sharp + 0.5 : 0) +
      smash;
    this.entities.hurt(entityId, damage, this.player.pos);
    if (smash > 0) {
      this.player._fallDist = 0;
      events.emit("maceSmash", { damage });
      // Порыв ветра: после сокрушения подбрасывает — можно бить снова
      const burst = enchLevel(held, "wind_burst");
      if (burst > 0) {
        this.player.vel.y = Math.max(this.player.vel.y, 6 + 2 * burst);
        const p = this.player.pos;
        events.emit("windBurst", { x: p.x, y: p.y, z: p.z });
      }
    }
    // износ оружия: меч и топор — 1, прочие инструменты — 2 (как в Minecraft)
    const tool = this._heldDef();
    if (this.player.mode !== "creative" && tool?.durability)
      this.inventory.damageHeld(
        tool.toolType === "sword" || tool.toolType === "axe" ? 1 : 2,
      );
  }
}
