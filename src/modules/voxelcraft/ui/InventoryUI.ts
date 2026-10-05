// Экраны инвентаря, как в Minecraft: инвентарь (броня + крафт 2×2), верстак (3×3), сундук, печь.
// У всех внизу рюкзак и хотбар игрока. Мышь: ЛКМ — взять/положить стак, ПКМ — половину/по одному,
// Shift+ЛКМ — перенести в «другую половину» экрана (броню — на тело, руду — в печь).
// UI мутирует ТОЛЬКО модели (Inventory, CraftingGrid, состояние блочной сущности) и живёт поверх них.
import { events } from "../core/EventBus";
import { ITEMS } from "../registry/Items";
import { labelOf } from "../registry/names";
import { smeltResult } from "../registry/recipes/smelting";
import { CraftingGrid } from "../systems/Crafting";
import { ARMOR_SLOTS } from "../systems/Inventory";
import { COOK_TIME, type FurnaceState } from "../world/blockentities/furnace";
import { BREW_TIME, type BrewingState } from "../world/blockentities/brewing";
import { smithResult } from "../systems/Smithing";
import { TRIM_MATERIALS } from "../registry/items/trims";
import { bundleInsert, bundleTakeLast } from "../systems/Bundle";
import { stonecutOptions } from "../systems/Stonecutter";
import { TOO_EXPENSIVE, anvilResult } from "../systems/Anvil";
import { grindResult } from "../systems/Grindstone";
import {
  BANNER_PATTERNS,
  bannerColor,
  dyeColor,
  layersOf,
  loomResult,
} from "../systems/Banner";
import { bannerCanvas } from "../gfx/BannerArt";
import {
  canEnchant,
  countShelves,
  enchantLine,
  enchantOffers,
  enchantsOf,
  enchantSuffix,
  withEnchants,
} from "../systems/Enchant";
import { B, BLOCKS } from "../registry/Blocks";
import type { ChestState } from "../world/blockentities/chest";
import type { BlockEntity } from "../world/BlockEntities";
import { drawDurability } from "./slotView";
import { renderTradeOffers } from "./tradeView";
import { TIER_NAMES, levelOf } from "../systems/Trading";
import type { Mob } from "../entities/Mob";
import type { Minecart } from "../entities/Minecart";
import { buildCreativePalette } from "./creativePalette";
import { TAGS } from "../registry/tags";
import { renderBeaconPowers } from "./beaconView";
import type { Game } from "../main";
import type { ItemStack } from "../types";

export type ScreenKind =
  | "inventory"
  | "crafting"
  | "chest"
  | "furnace"
  | "brewing"
  | "smithing"
  | "enchanting"
  | "anvil"
  | "trade"
  | "beacon"
  | "creative"
  | "stonecutter"
  | "grindstone"
  | "loom"
  | "ender"
  | "armor_stand";

type Group =
  | "hotbar"
  | "main"
  | "armor"
  | "craft"
  | "chest"
  | "fIn"
  | "fFuel"
  | "fOut"
  | "bIn"
  | "bFuel"
  | "bottle"
  | "smTpl"
  | "smBase"
  | "smAdd"
  | "enItem"
  | "enLapis"
  | "anLeft"
  | "anRight"
  | "scIn"
  | "grLeft"
  | "grRight"
  | "loBanner"
  | "loDye"
  | "ender"
  | "stand"
  | "trash";

interface SlotRef {
  group: Group;
  get(): ItemStack | null;
  set(s: ItemStack | null): void;
  /** Можно ли положить (броня — только в свой слот, топливо — только топливо). */
  accepts?(s: ItemStack): boolean;
  /** Только забирать (выход печи). */
  takeOnly?: boolean;
  el?: HTMLDivElement;
}

const TITLES: Record<ScreenKind, string> = {
  inventory: "Инвентарь",
  crafting: "Верстак",
  chest: "Сундук",
  furnace: "Печь",
  creative: "Креатив",
  brewing: "Варочная стойка",
  smithing: "Кузнечный стол",
  enchanting: "Стол зачарований",
  anvil: "Наковальня",
  trade: "Торговля",
  beacon: "Маяк",
  stonecutter: "Камнерез",
  grindstone: "Точило",
  loom: "Ткацкий станок",
  ender: "Сундук Предела",
  armor_stand: "Стойка для брони",
};

const maxOf = (item: string): number => ITEMS[item]?.maxStack ?? 64;
/**
 * Складываются ли два стака: один предмет, без износа и с одинаковыми доп. данными. Сравнение tag
 * обязательно: иначе знамя с узорами, слитое со стопкой чистых, потеряло бы узоры (systems/Banner).
 */
const sameTag = (
  a?: Record<string, unknown>,
  b?: Record<string, unknown>,
): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const stackable = (a: ItemStack, b: ItemStack): boolean =>
  a.item === b.item && !a.dmg && !b.dmg && sameTag(a.tag, b.tag);

export class InventoryUI {
  game: Game;
  inventory: Game["inventory"];
  grid: CraftingGrid;
  cursor: ItemStack | null;
  open: boolean;
  kind: ScreenKind = "inventory";
  /** Кузнечный стол: основа (алмазная вещь) и добавка (пеклитовый слиток). */
  /** Кузнечный стол: вещь, добавка (пеклит или материал отделки), шаблон отделки. */
  smith: (ItemStack | null)[] = [null, null, null];
  /** Стол зачарований: предмет и лазурит; где стоит стол (полки вокруг); список вариантов. */
  enchSlots: (ItemStack | null)[] = [null, null];
  enchPos: { x: number; y: number; z: number } | null = null;
  private offersEl: HTMLElement | null = null;
  /** Наковальня: левый и правый слот; строка цены. */
  anvil: (ItemStack | null)[] = [null, null];
  /** Вход камнереза (экран "stonecutter"). */
  stoneIn: (ItemStack | null)[] = [null];
  /** Точило: два слота (экран "grindstone"). */
  grind: (ItemStack | null)[] = [null, null];
  /** Ткацкий станок: знамя и краситель (экран "loom"). */
  loom: (ItemStack | null)[] = [null, null];
  private costEl: HTMLElement | null = null;
  /** Житель, с которым торгуем (экран "trade"). */
  tradeMob: Mob | null = null;
  /** Вагонетка, чей груз открыт (экран "chest" поверх её слотов). */
  cart: Minecart | Mob | null = null;
  /** Блочная сущность открытого сундука/печи. */
  be: BlockEntity | null = null;
  /** Сетевая игра: контейнер, который этот экран держит занятым (net/NetGame.openContainer). */
  private lockKey: string | null = null;
  rootEl: HTMLElement;
  cursorEl: HTMLElement;
  private panelEl: HTMLElement;
  private refs: SlotRef[] = [];
  private resultEl: HTMLDivElement | null = null;
  private flameEl: HTMLDivElement | null = null;
  private arrowEl: HTMLDivElement | null = null;
  private recipeEl: HTMLElement | null = null;

  constructor(game: Game, signal: AbortSignal) {
    this.game = game;
    this.inventory = game.inventory;
    this.grid = new CraftingGrid(2);
    this.cursor = null; // стак «в руке» у курсора
    this.open = false;

    // Элементы гарантированно есть в разметке — non-null утверждается локально.
    this.rootEl = document.getElementById("invScreen")!;
    this.cursorEl = document.getElementById("cursorStack")!;
    this.panelEl = this.rootEl.querySelector(".invPanel")!;

    events.on("ui:toggleInventory", () => {
      if (this.open) this.close();
      // в креативе E открывает палитру всех предметов, как в Minecraft
      else
        this.show(game.player.mode === "creative" ? "creative" : "inventory");
    });
    events.on("ui:openCrafting", () => this.show("crafting"));
    events.on("ui:openSmithing", () => this.show("smithing"));
    events.on("ui:openAnvil", () => this.show("anvil"));
    events.on("ui:openStonecutter", () => this.show("stonecutter"));
    events.on("ui:openGrindstone", () => this.show("grindstone"));
    events.on("ui:openLoom", () => this.show("loom"));
    events.on("ui:openEnder", () => this.show("ender"));
    events.on(
      "ui:openArmorStand",
      ({ x, y, z }: { x: number; y: number; z: number }) =>
        this._gated(`b:${x},${y},${z}`, () => {
          const be = game.blockEntities.ensure(x, y, z);
          if (be?.type === "armor_stand") this.show("armor_stand", be);
        }),
    );
    events.on("ui:openEnchanting", (p: { x: number; y: number; z: number }) => {
      this.enchPos = p;
      this.show("enchanting");
    });
    events.on("ui:openTrade", ({ entityId }: { entityId: number }) =>
      this._gated(`e:${entityId}`, () => {
        const m = game.entities.entities.get(entityId);
        if (m?.kind !== "mob" || !m.def.trades) return;
        this.tradeMob = m;
        this.show("trade");
        if (this.open) m.trading = true; // пока торгуем — стоит и смотрит на игрока (MobBrain)
      }),
    );
    events.on("ui:openCart", ({ entityId }: { entityId: number }) =>
      this._gated(`e:${entityId}`, () => {
        const c = game.entities.entities.get(entityId);
        // груз вагонетки или вьюк осла, мула, ламы
        if (
          (c?.kind !== "minecart" && c?.kind !== "mob") ||
          !c.items.length ||
          this.open
        )
          return;
        this.cart = c;
        this.show("chest", game.entities.cartBox(c));
        if (!this.open) this.cart = null;
      }),
    );
    events.on(
      "ui:openContainer",
      ({ x, y, z }: { x: number; y: number; z: number }) =>
        this._gated(`b:${x},${y},${z}`, () => this._openContainer(x, y, z)),
    );
    document.addEventListener(
      "mousemove",
      (e) => {
        if (!this.open) return;
        this.cursorEl.style.left = e.clientX + "px";
        this.cursorEl.style.top = e.clientY + "px";
      },
      { signal },
    );
  }

  /** Открыть экран. Уже открыт — ничего (закрывается E или Esc). */
  show(kind: ScreenKind, be: BlockEntity | null = null) {
    if (this.open) return;
    // На стартовом оверлее и паузе игра стоит: инвентарь открылся бы ПОД оверлеем, а его закрытие
    // (requestLock → takeControl) запускало бы игру в обход оверлея.
    if (!this.game.playing) return;
    // Поверх другого экрана (смерть, титры, табличка, чат) не открываемся: закрытие инвентаря
    // захватывало мышь, и кнопку «Возродиться» на экране смерти становилось нечем нажать.
    if (this.game.player.dead || this.game.input.uiOpen) return;
    this.open = true;
    this.kind = kind;
    this.be = be;
    this.grid.setSize(kind === "crafting" ? 3 : 2);
    this.game.input.uiOpen = true;
    this.game.input.releaseLock();
    this.rootEl.classList.remove("hidden");
    this._build();
    this._render();
    events.emit("ui:inventoryOpened", { kind });
    if (this.recipeEl) events.emit("ui:recipeViewed", { item: "wooden_sword" });
  }

  /** Совместимость со старым вызовом: toggle(2) — инвентарь, toggle(3, true) — верстак. */
  toggle(craftSize: number, forceOpen = false) {
    if (this.open && !forceOpen) return this.close();
    this.show(craftSize === 3 ? "crafting" : "inventory");
  }

  /** Открыть блочный контейнер (сундук, печь, варочную стойку, воронку, маяк…). */
  private _openContainer(x: number, y: number, z: number): void {
    // ensure: сундук постройки генератора получает сущность (и добычу) при первом открытии
    const be = this.game.blockEntities.ensure(x, y, z);
    if (
      be &&
      (be.type === "chest" || be.type === "furnace" || be.type === "brewing")
    )
      this.show(be.type, be);
    // воронка, раздатчик, панцирный сундук — тот же экран, что сундук (слоты items), со своим заголовком
    else if (
      be &&
      (be.type === "hopper" || be.type === "dispenser" || be.type === "shell")
    )
      this.show("chest", be);
    else if (be?.type === "beacon") this.show("beacon", be);
  }

  /**
   * Сетевая игра: контейнер открывается, только если он не открыт у другого игрока (иначе двое,
   * перекладывая одно и то же, размножали бы предметы). Одиночная игра — сразу.
   */
  private _gated(key: string, open: () => void): void {
    const net = this.game.net;
    if (!net) return open();
    if (this.open) return;
    net.openContainer(key, () => {
      if (this.open) return net.releaseContainer(key);
      open();
      if (this.open) this.lockKey = key;
      else net.releaseContainer(key);
    });
  }

  close() {
    if (!this.open) return;
    this.open = false;
    if (this.lockKey) {
      this.game.net?.releaseContainer(this.lockKey);
      this.lockKey = null;
    }
    // вернуть всё из крафт-сетки и курсора; некуда класть — выбрасываем под ноги, ничего не теряем
    this.grid.dumpInto(this.inventory);
    // Остаток сетки выбрасываем обязательно: следующий show() пересоздаёт её (setSize), и то,
    // что «осталось в сетке», пропадало бы бесследно.
    this.grid.slots.forEach((s, i) => {
      if (!s) return;
      this._dropAtFeet(s);
      this.grid.slots[i] = null;
    });
    // кузнечный стол: всё обратно в инвентарь (с износом), не влезло — под ноги
    for (const slots of [
      this.smith,
      this.enchSlots,
      this.anvil,
      this.stoneIn,
      this.grind,
    ])
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        if (s && this.inventory.addStack(s) > 0) this._dropAtFeet(s);
        slots[i] = null;
      }
    if (this.cursor) {
      // addStack — инструмент в курсоре не теряет износ (раньше add() его обнулял)
      const left = this.inventory.addStack(this.cursor);
      if (left > 0) this._dropAtFeet(this.cursor, left);
      this.cursor = null;
    }
    this.be = null;
    if (this.tradeMob) this.tradeMob.trading = false;
    this.tradeMob = null;
    this.cart = null;
    this.rootEl.classList.add("hidden");
    this.cursorEl.classList.add("hidden");
    this.game.input.uiOpen = false;
    // закрыт смертью — мышь не захватываем, экран смерти должен остаться кликабельным
    if (!this.game.player.dead) this.game.input.requestLock();
  }

  /** Кадр: у печи бегут шкалы; сломанный сундук/печь закрывают свой экран. */
  frame() {
    if (this.open && this.kind === "trade") {
      // житель умер или ушёл — торговля закрывается
      const m = this.tradeMob;
      if (!m || m.dead || m.pos.distanceTo(this.game.player.pos) > 8)
        this.close();
      return;
    }
    if (this.open && this.cart) {
      // вагонетку сломали или она уехала — экран закрывается
      const c = this.cart;
      if (c.dead || c.pos.distanceTo(this.game.player.pos) > 8) this.close();
      return;
    }
    if (!this.open || !this.be) return;
    const be = this.be;
    if (this.game.blockEntities.get(be.x, be.y, be.z) !== be)
      return this.close();
    if (this.kind === "furnace" || this.kind === "brewing") this._render();
  }

  /** Бросить стак под ноги — целиком, с износом и tag (зачарования, имя): иначе вещь «чинилась» и
   *  теряла чары, если в инвентаре не нашлось места. */
  _dropAtFeet(s: ItemStack, count = s.count) {
    if (count <= 0) return;
    const p = this.game.player.pos;
    this.game.entities.spawnDrop(
      p.x,
      p.y + 1,
      p.z,
      s.item,
      count,
      s.dmg,
      s.tag,
    );
  }

  // ---- построение ------------------------------------------------------------------------

  /** Имя блока под открытой блочной сущностью (для заголовка). */
  private _beBlockName(): string {
    const be = this.be;
    if (!be) return "";
    return BLOCKS[this.game.world.getBlock(be.x, be.y, be.z)]?.name ?? be.type;
  }

  private _build() {
    const inv = this.inventory;
    this.refs = [];
    this.recipeEl = null;
    this.resultEl = this.flameEl = this.arrowEl = null;
    this.panelEl.innerHTML = "";
    const h = document.createElement("h3");
    h.id = "invTitle";
    h.textContent = this.cart
      ? labelOf(
          this.cart.kind === "mob" ? this.cart.def.name : this.cart.dropItem,
        )
      : this.kind === "trade" && this.tradeMob
        ? `${labelOf(this.tradeMob.def.name)} — ${TIER_NAMES[levelOf(this.tradeMob.villagerXp) - 1]}`
        : // воронка, раздатчик, бочка, коптильня, плавильная печь — своим именем (горящие — как погасшие)
          (this.kind === "chest" || this.kind === "furnace") &&
            this.be &&
            !["chest", "furnace", "lit_furnace"].includes(this._beBlockName())
          ? labelOf(this._beBlockName().replace(/^lit_/, ""))
          : TITLES[this.kind];
    this.panelEl.appendChild(h);

    if ((this.kind === "inventory" || this.kind === "crafting") && this.game.onboarding.shouldShowRecipe()) {
      const card = this._div(this.panelEl, "tutorialRecipe");
      card.innerHTML = '<strong>Первое оружие · Деревянный меч</strong><div class="ingredients"><span data-ingredient="planks"></span><span data-ingredient="stick"></span></div><div class="recipeHelp"></div>';
      this.recipeEl = card;
    }

    if (this.kind === "creative")
      buildCreativePalette(this.panelEl, (item, right, shift) =>
        this._clickPalette(item, right, shift),
      );

    const top = this._div(this.panelEl, "invTop");
    if (this.kind === "creative") {
      // корзина: положенный сюда стак исчезает (ПКМ — по одному)
      this._div(top, "trashLabel").textContent = "Удалить:";
      this._slot(top, {
        group: "trash",
        get: () => null,
        set: () => {},
      }).classList.add("trash");
    }
    if (this.kind === "inventory") {
      const armor = this._div(top, "armorCol");
      ARMOR_SLOTS.forEach((slotName, i) =>
        this._slot(armor, {
          group: "armor",
          get: () => inv.armor[i] ?? null,
          set: (s) => inv.setArmor(i, s),
          accepts: (s) => ITEMS[s.item]?.armorSlot === slotName,
        }),
      );
    }
    if (this.kind === "inventory" || this.kind === "crafting") {
      const n = this.grid.size;
      const craft = this._div(top, "craftGrid");
      if (this.recipeEl) craft.classList.add("tutorialCraftGlow");
      craft.style.gridTemplateColumns = `repeat(${n}, 44px)`;
      for (let i = 0; i < n * n; i++)
        this._slot(craft, {
          group: "craft",
          get: () => this.grid.slots[i] ?? null,
          set: (s) => (this.grid.slots[i] = s),
        });
      this._div(top, "arrow").textContent = "→";
      const res = this._div(top, "slot result") as HTMLDivElement;
      res.innerHTML = '<img draggable="false"><span class="count"></span>';
      res.onmousedown = (e) => {
        this._clickResult(e.shiftKey);
        e.preventDefault();
      };
      this.resultEl = res;
    }
    if (this.kind === "armor_stand" && this.be) {
      // стойка: те же четыре слота брони, что у игрока, но у клетки (gfx/ArmorStand показывает их)
      const items = (this.be.state as ChestState).items;
      const col = this._div(top, "armorCol");
      ARMOR_SLOTS.forEach((slotName, i) =>
        this._slot(col, {
          group: "stand",
          get: () => items[i] ?? null,
          set: (s) => (items[i] = s),
          accepts: (s) => ITEMS[s.item]?.armorSlot === slotName,
        }),
      );
    }
    if (this.kind === "ender") {
      // сундук Предела: слоты не у клетки, а у игрока — один склад на все сундуки и измерения
      const grid = this._div(top, "chestGrid");
      for (let i = 0; i < inv.ender.length; i++)
        this._slot(grid, {
          group: "ender",
          get: () => inv.ender[i] ?? null,
          set: (s) => (inv.ender[i] = s),
        });
    }
    if (this.kind === "chest" && this.be) {
      const items = (this.be.state as ChestState).items;
      const grid = this._div(top, "chestGrid");
      if (items.length === 9)
        grid.style.gridTemplateColumns = "repeat(3, 44px)"; // раздатчик 3×3
      for (let i = 0; i < items.length; i++)
        this._slot(grid, {
          group: "chest",
          get: () => items[i] ?? null,
          set: (s) => (items[i] = s),
          // панцирный сундук в панцирный не кладётся, как в Minecraft
          accepts: (s) =>
            !(this.be?.type === "shell" && s.item === "shell_chest"),
        });
    }
    if (this.kind === "furnace" && this.be) {
      const st = this.be.state as FurnaceState;
      const col = this._div(top, "furnaceCol");
      this._slot(col, {
        group: "fIn",
        get: () => st.input,
        set: (s) => (st.input = s),
      });
      this.flameEl = this._div(
        this._div(col, "flame"),
        "flameFill",
      ) as HTMLDivElement;
      this._slot(col, {
        group: "fFuel",
        get: () => st.fuel,
        set: (s) => (st.fuel = s),
        accepts: (s) => (ITEMS[s.item]?.fuel ?? 0) > 0,
      });
      this.arrowEl = this._div(
        this._div(top, "cookArrow"),
        "cookFill",
      ) as HTMLDivElement;
      this._slot(top, {
        group: "fOut",
        get: () => st.output,
        set: (s) => (st.output = s),
        takeOnly: true,
      }).classList.add("result");
    }

    this.offersEl = null;
    this.costEl = null;
    if (this.kind === "anvil") {
      this._slot(top, {
        group: "anLeft",
        get: () => this.anvil[0] ?? null,
        set: (s) => (this.anvil[0] = s),
      });
      this._div(top, "arrow").textContent = "+";
      this._slot(top, {
        group: "anRight",
        get: () => this.anvil[1] ?? null,
        set: (s) => (this.anvil[1] = s),
      });
      this._div(top, "arrow").textContent = "→";
      const res = this._div(top, "slot result") as HTMLDivElement;
      res.innerHTML = '<img draggable="false"><span class="count"></span>';
      res.onmousedown = (e) => {
        this._clickAnvil(e.shiftKey);
        e.preventDefault();
      };
      this.resultEl = res;
      this.costEl = this._div(top, "anvilCost");
    }
    if (this.kind === "grindstone") {
      // точило: два слота и результат без зачарований (опыт возвращается игроку)
      this._slot(top, {
        group: "grLeft",
        get: () => this.grind[0] ?? null,
        set: (s) => (this.grind[0] = s),
      });
      this._div(top, "arrow").textContent = "+";
      this._slot(top, {
        group: "grRight",
        get: () => this.grind[1] ?? null,
        set: (s) => (this.grind[1] = s),
      });
      this._div(top, "arrow").textContent = "→";
      const res = this._div(top, "slot result") as HTMLDivElement;
      res.innerHTML = '<img draggable="false"><span class="count"></span>';
      res.onmousedown = (e) => {
        this._clickGrind(e.shiftKey);
        e.preventDefault();
      };
      this.resultEl = res;
      this.costEl = this._div(top, "anvilCost");
    }
    if (this.kind === "enchanting") {
      const col = this._div(top, "enchCol");
      this._slot(col, {
        group: "enItem",
        get: () => this.enchSlots[0] ?? null,
        set: (s) => (this.enchSlots[0] = s),
        accepts: (s) => canEnchant(s.item),
      });
      this._slot(col, {
        group: "enLapis",
        get: () => this.enchSlots[1] ?? null,
        set: (s) => (this.enchSlots[1] = s),
        accepts: (s) => s.item === "lapis_lazuli",
      });
      this.offersEl = this._div(top, "enchOffers");
    }
    if (this.kind === "loom") {
      // ткацкий станок: знамя, краситель и список узоров — щелчок кладёт слой
      this._slot(top, {
        group: "loBanner",
        get: () => this.loom[0] ?? null,
        set: (s) => (this.loom[0] = s),
        accepts: (s) => bannerColor(s.item) !== null,
      });
      this._div(top, "arrow").textContent = "+";
      this._slot(top, {
        group: "loDye",
        get: () => this.loom[1] ?? null,
        set: (s) => (this.loom[1] = s),
        accepts: (s) => dyeColor(s.item) !== null,
      });
      this._div(top, "arrow").textContent = "→";
      this.offersEl = this._div(top, "enchOffers tradeOffers loomOffers");
    }
    if (this.kind === "stonecutter") {
      // камнерез: вход и список изделий — щелчок режет один блок
      this._slot(top, {
        group: "scIn",
        get: () => this.stoneIn[0] ?? null,
        set: (s) => (this.stoneIn[0] = s),
        accepts: (s) => stonecutOptions(s.item).length > 0,
      });
      this._div(top, "arrow").textContent = "→";
      this.offersEl = this._div(top, "enchOffers tradeOffers");
    }
    if (this.kind === "trade")
      this.offersEl = this._div(top, "enchOffers tradeOffers");
    if (this.kind === "beacon")
      this.offersEl = this._div(top, "enchOffers beaconPowers");
    if (this.kind === "smithing") {
      // шаблон отделки (необязателен: без него — улучшение до пеклита)
      this._slot(top, {
        group: "smTpl",
        get: () => this.smith[2] ?? null,
        set: (s) => (this.smith[2] = s),
        accepts: (s) => s.item.endsWith("_smithing_template"),
      });
      this._div(top, "arrow").textContent = "+";
      this._slot(top, {
        group: "smBase",
        get: () => this.smith[0] ?? null,
        set: (s) => (this.smith[0] = s),
        accepts: (s) =>
          s.item.startsWith("diamond_") || !!ITEMS[s.item]?.armorSlot,
      });
      this._div(top, "arrow").textContent = "+";
      this._slot(top, {
        group: "smAdd",
        get: () => this.smith[1] ?? null,
        set: (s) => (this.smith[1] = s),
        accepts: (s) =>
          s.item === "infernite_ingot" || s.item in TRIM_MATERIALS,
      });
      this._div(top, "arrow").textContent = "→";
      const res = this._div(top, "slot result") as HTMLDivElement;
      res.innerHTML = '<img draggable="false"><span class="count"></span>';
      res.onmousedown = (e) => {
        this._clickSmith(e.shiftKey);
        e.preventDefault();
      };
      this.resultEl = res;
    }
    if (this.kind === "brewing" && this.be) {
      const st = this.be.state as BrewingState;
      const col = this._div(top, "brewCol");
      this._slot(col, {
        group: "bIn",
        get: () => st.ingredient,
        set: (s) => (st.ingredient = s),
      });
      this._slot(col, {
        group: "bFuel",
        get: () => st.fuel,
        set: (s) => (st.fuel = s),
        accepts: (s) => s.item === "flame_powder",
      });
      this.arrowEl = this._div(
        this._div(top, "cookArrow"),
        "cookFill",
      ) as HTMLDivElement;
      const row = this._div(top, "bottleRow");
      for (let i = 0; i < 3; i++)
        this._slot(row, {
          group: "bottle",
          get: () => st.bottles[i] ?? null,
          set: (s) => (st.bottles[i] = s),
          accepts: (s) =>
            s.item.startsWith("potion_") || s.item === "glass_bottle",
        });
    }

    const main = this._div(this.panelEl, "invGrid");
    for (let i = 9; i < 36; i++)
      this._slot(main, {
        group: "main",
        get: () => inv.slots[i] ?? null,
        set: (s) => inv.setSlot(i, s),
      });
    const hot = this._div(this.panelEl, "invHotbar");
    for (let i = 0; i < 9; i++)
      this._slot(hot, {
        group: "hotbar",
        get: () => inv.slots[i] ?? null,
        set: (s) => inv.setSlot(i, s),
      });
  }

  private _div(parent: HTMLElement, cls: string): HTMLElement {
    const d = document.createElement("div");
    d.className = cls;
    parent.appendChild(d);
    return d;
  }

  private _slot(parent: HTMLElement, ref: SlotRef): HTMLDivElement {
    const d = document.createElement("div");
    d.className = "slot";
    d.innerHTML = '<img draggable="false"><span class="count"></span>';
    d.onmousedown = (e) => {
      this._clickSlot(ref, e.button === 2, e.shiftKey);
      e.preventDefault();
    };
    d.oncontextmenu = (e) => e.preventDefault();
    parent.appendChild(d);
    ref.el = d;
    this.refs.push(ref);
    return d;
  }

  // ---- клики -------------------------------------------------------------------------------

  private _clickSlot(ref: SlotRef, rightClick: boolean, shift: boolean) {
    if (shift) {
      this._quickMove(ref);
      this._render();
      return;
    }
    const cur = this.cursor;
    const slot = ref.get();

    if (ref.takeOnly) {
      // выход печи: только забрать — целиком в курсор, если влезает
      if (!slot) return;
      if (!cur) {
        this.cursor = slot;
        ref.set(null);
      } else if (
        stackable(cur, slot) &&
        cur.count + slot.count <= maxOf(cur.item)
      ) {
        cur.count += slot.count;
        ref.set(null);
      } else return;
      this._tookOutput(ref);
      this._render();
      return;
    }

    // мешок: ПКМ мешком по предмету или предметом по мешку — положить; ПКМ пустой рукой по мешку — достать
    if (
      rightClick &&
      cur?.item === "bundle" &&
      slot &&
      slot.item !== "bundle"
    ) {
      const moved = bundleInsert(cur, slot);
      if (moved > 0) {
        slot.count -= moved;
        ref.set(slot.count > 0 ? slot : null);
        events.emit("bundleInsert", { item: slot.item });
        this._render();
      }
      return;
    }
    if (rightClick && slot?.item === "bundle" && cur?.item !== "bundle") {
      if (!cur) {
        const out = bundleTakeLast(slot);
        if (out) {
          this.cursor = out;
          ref.set(slot);
          events.emit("bundleRemove", { item: out.item });
          this._render();
          return;
        }
      } else {
        const moved = bundleInsert(slot, cur);
        if (moved > 0) {
          cur.count -= moved;
          if (cur.count <= 0) this.cursor = null;
          ref.set(slot);
          events.emit("bundleInsert", { item: cur.item });
        }
        this._render();
        return;
      }
    }

    if (!cur) {
      if (!slot) return;
      if (rightClick) {
        // взять половину
        const take = Math.ceil(slot.count / 2);
        this.cursor = { ...slot, count: take };
        slot.count -= take;
        ref.set(slot.count > 0 ? slot : null);
      } else {
        this.cursor = slot;
        ref.set(null);
      }
    } else {
      if (ref.accepts && !ref.accepts(cur)) return;
      const max = maxOf(cur.item);
      if (!slot) {
        if (rightClick) {
          ref.set({ ...cur, count: 1 });
          cur.count -= 1;
          if (cur.count <= 0) this.cursor = null;
        } else {
          ref.set(cur);
          this.cursor = null;
        }
      } else if (stackable(slot, cur) && max > 1) {
        // нескладываемые (мечи, вёдра, зелья) — обмен ниже, как в Minecraft: раньше клик мечом по
        // такому же мечу не делал ничего
        const move = rightClick ? 1 : cur.count;
        const take = Math.min(move, max - slot.count);
        slot.count += take;
        cur.count -= take;
        ref.set(slot);
        if (cur.count <= 0) this.cursor = null;
      } else {
        // обмен
        ref.set(cur);
        this.cursor = slot;
      }
    }
    this._render();
  }

  /**
   * Креатив: клик по палитре — полный стак в курсор (ПКМ — один); с чем-то в курсоре — удалить
   * это, как в Minecraft; Shift — стак сразу в инвентарь.
   */
  private _clickPalette(item: string, rightClick: boolean, shift: boolean) {
    if (shift) this.inventory.add(item, maxOf(item));
    else if (this.cursor) this.cursor = null;
    else this.cursor = { item, count: rightClick ? 1 : maxOf(item) };
    this._render();
  }

  /** Книжные полки вокруг открытого стола зачарований. */
  private _shelves(): number {
    const p = this.enchPos;
    if (!p) return 0;
    const w = this.game.world;
    return countShelves(
      (x, y, z) => w.getBlock(x, y, z),
      B.bookshelf!,
      p.x,
      p.y,
      p.z,
    );
  }

  /** Варианты стола: текст, доступность (уровень, лазурит), клик — зачаровать. */
  /** Камнерез: блок из входа → изделие в курсор (не лезет — в инвентарь), с Shift — сразу в инвентарь. */
  private _stonecut(out: ItemStack, shift: boolean) {
    const input = this.stoneIn[0];
    if (!input) return;
    input.count -= 1;
    if (input.count <= 0) this.stoneIn[0] = null;
    const made: ItemStack = { item: out.item, count: out.count };
    const cur = this.cursor;
    if (!shift && !cur) this.cursor = made;
    else if (
      !shift &&
      cur &&
      cur.item === made.item &&
      !cur.dmg &&
      cur.count + made.count <= maxOf(made.item)
    )
      cur.count += made.count;
    else {
      const left = this.inventory.addStack(made);
      if (left > 0) this._dropAtFeet(made, left);
    }
    events.emit("stonecut", { item: made.item });
    this._render();
  }

  private _renderOffers() {
    const el = this.offersEl;
    if (!el) return;
    if (this.kind === "beacon") {
      if (this.be)
        renderBeaconPowers(
          el,
          this.inventory,
          this.be,
          this.game.player.mode === "creative",
          () => this._render(),
        );
      return;
    }
    if (this.kind === "trade") {
      if (this.tradeMob)
        renderTradeOffers(
          el,
          this.inventory,
          this.tradeMob,
          (s) => this._dropAtFeet(s),
          () => this._render(),
          this.game.player.effects.get("hero")?.level ?? 0,
          this.game.player.villageRep,
        );
      return;
    }
    if (this.kind === "loom") {
      el.innerHTML = "";
      const banner = this.loom[0] ?? null;
      const dye = this.loom[1] ?? null;
      const base = banner ? bannerColor(banner.item) : null;
      for (const p of BANNER_PATTERNS) {
        const out = loomResult(banner, dye, p.id);
        if (!out) continue;
        const b = document.createElement("div");
        b.className = "enchOffer";
        const pic = bannerCanvas(base, layersOf(out), 2);
        pic.className = "loomPic";
        b.appendChild(pic);
        b.appendChild(document.createTextNode(p.name));
        b.onmousedown = (e) => {
          e.preventDefault();
          this._loom(p.id, e.shiftKey);
        };
        el.appendChild(b);
      }
      return;
    }
    if (this.kind === "stonecutter") {
      el.innerHTML = "";
      const input = this.stoneIn[0];
      for (const out of input ? stonecutOptions(input.item) : []) {
        const b = document.createElement("div");
        b.className = "enchOffer";
        b.textContent = `${labelOf(input!.item)} → ${out.count > 1 ? out.count + "× " : ""}${labelOf(out.item)}`;
        b.onmousedown = (e) => {
          e.preventDefault();
          this._stonecut(out, e.shiftKey);
        };
        el.appendChild(b);
      }
      return;
    }
    const item = this.enchSlots[0];
    const offers =
      item && enchantsOf(item).length === 0
        ? enchantOffers(item.item, this._shelves(), this.game.player.enchSeed)
        : null;
    el.innerHTML = "";
    const pl = this.game.player;
    const lapis = this.enchSlots[1]?.count ?? 0;
    (offers ?? []).forEach((o, i) => {
      const ok =
        pl.mode === "creative" || (pl.xpLevel >= o.level && lapis >= o.cost);
      const b = document.createElement("div");
      b.className = "enchOffer" + (ok ? "" : " off");
      b.textContent =
        o.ench.map(([id, l]) => enchantLine(id, l)).join(", ") +
        ` · ${o.level} ур. · ${o.cost} лаз.`;
      b.onmousedown = (e) => {
        e.preventDefault();
        if (ok) this._enchant(i);
      };
      el.appendChild(b);
    });
  }

  /** Зачаровать вариантом i: списать уровни и лазурит (в креативе — нет), сменить зерно. */
  private _enchant(i: number) {
    const item = this.enchSlots[0];
    if (!item) return;
    const o = enchantOffers(
      item.item,
      this._shelves(),
      this.game.player.enchSeed,
    )?.[i];
    if (!o) return;
    const pl = this.game.player;
    if (pl.mode !== "creative") {
      const lapis = this.enchSlots[1];
      if (!lapis || lapis.count < o.cost || pl.xpLevel < o.level) return;
      lapis.count -= o.cost;
      if (lapis.count <= 0) this.enchSlots[1] = null;
      pl.xpLevel = Math.max(0, pl.xpLevel - o.cost);
    }
    // книга становится зачарованной книгой (одна; остальные книги — обратно в инвентарь)
    let base = item;
    if (item.item === "book") {
      // не влезло — под ноги только остаток (раньше выбрасывалась вся стопка сверх одной: дюп книг)
      const left =
        item.count > 1 ? this.inventory.add("book", item.count - 1) : 0;
      if (left > 0) this._dropAtFeet({ item: "book", count: left });
      base = { item: "enchanted_book", count: 1 };
    }
    this.enchSlots[0] = withEnchants(base, Object.fromEntries(o.ench));
    pl.enchSeed = (Math.random() * 0xffffffff) >>> 0;
    events.emit("enchanted", { item: item.item });
    this._render();
  }

  /** Результат наковальни: списать уровни (в креативе — нет), левый слот и нужное из правого. */
  private _clickAnvil(shift: boolean) {
    const r = anvilResult(this.anvil[0] ?? null, this.anvil[1] ?? null);
    if (!r || (!shift && this.cursor)) return;
    const pl = this.game.player;
    if (pl.mode !== "creative") {
      if (r.cost >= TOO_EXPENSIVE || pl.xpLevel < r.cost) return;
      pl.xpLevel -= r.cost;
    }
    // из левого слота уходит одна вещь (результат — всегда одна), остаток стопки остаётся на месте
    const left = this.anvil[0]!;
    left.count -= 1;
    if (left.count <= 0) this.anvil[0] = null;
    const right = this.anvil[1]!;
    right.count -= r.useRight;
    if (right.count <= 0) this.anvil[1] = null;
    if (shift) {
      if (this.inventory.addStack(r.result) > 0) this._dropAtFeet(r.result);
    } else this.cursor = r.result;
    events.emit("anvilUse", { item: r.result.item });
    this._render();
  }

  /** Результат точила: вещь без зачарований, снятый опыт — игроку (как в Minecraft). */
  private _clickGrind(shift: boolean) {
    const r = grindResult(this.grind[0] ?? null, this.grind[1] ?? null);
    if (!r || (!shift && this.cursor)) return;
    this.grind[0] = null;
    if (r.useRight) this.grind[1] = null;
    if (shift) {
      if (this.inventory.addStack(r.result) > 0) this._dropAtFeet(r.result);
    } else this.cursor = r.result;
    if (r.xp > 0) events.emit("xpGain", { amount: r.xp });
    events.emit("grindstoneUse", { item: r.result.item });
    this._render();
  }

  /** Узор на знамя: тратит один краситель, знамя из слота заменяется на новое со слоем. */
  private _loom(pattern: string, shift: boolean) {
    const out = loomResult(this.loom[0] ?? null, this.loom[1] ?? null, pattern);
    if (!out || (!shift && this.cursor)) return;
    const dye = this.loom[1]!;
    dye.count -= 1;
    if (dye.count <= 0) this.loom[1] = null;
    const banner = this.loom[0]!;
    banner.count -= 1;
    if (banner.count <= 0) this.loom[0] = null;
    if (shift) {
      if (this.inventory.addStack(out) > 0) this._dropAtFeet(out);
    } else this.cursor = out;
    events.emit("loomUse", { item: out.item });
    this._render();
  }

  /** Результат кузнечного стола: в курсор (рука свободна) или Shift — сразу в инвентарь. */
  private _clickSmith(shift: boolean) {
    const tpl = this.smith[2] ?? null;
    const res = smithResult(this.smith[0] ?? null, this.smith[1] ?? null, tpl);
    if (!res || (!shift && this.cursor)) return;
    this.smith[0] = null;
    const add = this.smith[1]!;
    add.count -= 1;
    if (add.count <= 0) this.smith[1] = null;
    if (tpl) {
      tpl.count -= 1; // шаблон тратится, как в Minecraft
      if (tpl.count <= 0) this.smith[2] = null;
      events.emit("armorTrimmed", { item: res.item });
    }
    if (shift) {
      if (this.inventory.addStack(res) > 0) this._dropAtFeet(res);
    } else this.cursor = res;
    events.emit("craft", { item: res.item, count: 1 });
    this._render();
  }

  /** Забрали выход печи: накопленный опыт — игроку. */
  private _tookOutput(ref: SlotRef) {
    if (ref.group !== "fOut" || !this.be) return;
    const st = this.be.state as FurnaceState;
    if (st.xp > 0) events.emit("xpGain", { amount: st.xp });
    st.xp = 0;
  }

  /** Куда Shift-клик переносит стак из этой группы, по порядку предпочтения. */
  private _targets(from: Group, s: ItemStack): SlotRef[] {
    const of = (...g: Group[]) => this.refs.filter((r) => g.includes(r.group));
    const player =
      from === "hotbar"
        ? of("main")
        : from === "main"
          ? of("hotbar")
          : of("hotbar", "main");
    if (from === "hotbar" || from === "main") {
      const def = ITEMS[s.item];
      if (def?.armorSlot) {
        const armor = of("armor").filter((r) => !r.get() && r.accepts?.(s));
        if (armor.length) return armor;
      }
      if (this.kind === "chest") return [...of("chest"), ...player];
      if (this.kind === "ender") return [...of("ender"), ...player];
      if (this.kind === "armor_stand")
        return ITEMS[s.item]?.armorSlot ? [...of("stand"), ...player] : player;
      if (this.kind === "stonecutter" && stonecutOptions(s.item).length)
        return [...of("scIn"), ...player];
      if (this.kind === "anvil")
        return [...of("anLeft"), ...of("anRight"), ...player];
      if (this.kind === "grindstone")
        return [...of("grLeft"), ...of("grRight"), ...player];
      if (this.kind === "loom") {
        if (bannerColor(s.item)) return [...of("loBanner"), ...player];
        if (dyeColor(s.item)) return [...of("loDye"), ...player];
        return player;
      }
      if (this.kind === "enchanting") {
        if (s.item === "lapis_lazuli") return [...of("enLapis"), ...player];
        if (canEnchant(s.item)) return [...of("enItem"), ...player];
        return player;
      }
      if (this.kind === "smithing") {
        if (s.item.endsWith("_smithing_template"))
          return [...of("smTpl"), ...player];
        if (s.item.startsWith("diamond_") || ITEMS[s.item]?.armorSlot)
          return [...of("smBase"), ...player];
        if (s.item === "infernite_ingot" || s.item in TRIM_MATERIALS)
          return [...of("smAdd"), ...player];
        return player;
      }
      if (this.kind === "brewing") {
        if (s.item.startsWith("potion_")) return [...of("bottle"), ...player];
        if (s.item === "flame_powder")
          return [...of("bFuel"), ...of("bIn"), ...player];
        return [...of("bIn"), ...player];
      }
      if (this.kind === "furnace") {
        if (smeltResult(s.item)) return [...of("fIn"), ...player];
        if ((def?.fuel ?? 0) > 0) return [...of("fFuel"), ...player];
      }
      return player;
    }
    return of("hotbar", "main");
  }

  private _quickMove(ref: SlotRef) {
    const s = ref.get();
    if (!s) return;
    let left = s.count;
    const targets = this._targets(ref.group, s).filter(
      (t) => t !== ref && !t.takeOnly && (!t.accepts || t.accepts(s)),
    );
    // сначала досыпать в такие же стаки, потом — в пустые
    for (const pass of [0, 1])
      for (const t of targets) {
        if (left <= 0) break;
        const ts = t.get();
        if (pass === 0 && ts && stackable(ts, s)) {
          const take = Math.min(left, maxOf(s.item) - ts.count);
          if (take > 0) {
            ts.count += take;
            left -= take;
            t.set(ts);
          }
        } else if (pass === 1 && !ts) {
          const take = Math.min(left, maxOf(s.item));
          t.set({ ...s, count: take });
          left -= take;
        }
      }
    ref.set(left > 0 ? { ...s, count: left } : null);
    if (left < s.count) this._tookOutput(ref);
  }

  /** Результат крафта: клик — в курсор; Shift — скрафтить сколько получится прямо в инвентарь. */
  private _clickResult(shift: boolean) {
    const res = this.grid.result();
    if (!res) return;
    const firstSword = res.item === "wooden_sword" && this.game.onboarding.shouldShowRecipe();
    if (shift) {
      for (let n = 0; n < 64; n++) {
        const cur = this.grid.result();
        if (!cur || cur.item !== res.item) break;
        const taken = this.grid.takeResult()!;
        const left = firstSword && n === 0 && this.stashFirstSword(taken)
          ? 0 : this.inventory.addStack(taken);
        if (left > 0) {
          this._dropAtFeet(taken, left);
          break;
        }
      }
      this._render();
      return;
    }
    if (
      this.cursor &&
      (this.cursor.item !== res.item ||
        // в курсоре такая же вещь, но с износом или tag — не сливаем, иначе новая «прилипла» бы к ней
        this.cursor.dmg ||
        this.cursor.tag ||
        this.cursor.count + res.count > maxOf(res.item))
    )
      return;
    const taken = this.grid.takeResult()!; // result() уже проверен выше — сетка не менялась, результат есть
    if (firstSword && !this.cursor && this.stashFirstSword(taken)) {
      // Первое оружие сразу видно на панели, дальше работает обычное поведение крафта.
    } else if (this.cursor) this.cursor.count += taken.count;
    else this.cursor = { item: taken.item, count: taken.count };
    this._render();
  }

  private stashFirstSword(stack: ItemStack): boolean {
    const slot = this.inventory.slots.findIndex((s, i) => i < 9 && !s);
    if (slot < 0) return false;
    this.inventory.setSlot(slot, { ...stack });
    return true;
  }

  private renderRecipe() {
    const card = this.recipeEl;
    if (!card) return;
    if (!this.game.onboarding.shouldShowRecipe()) { card.remove(); this.recipeEl = null; return; }
    const stacks = [...this.inventory.slots, ...this.grid.slots, this.cursor];
    const count = (test: (item: string) => boolean) => stacks.reduce<number>((n, s) => n + (s && test(s.item) ? s.count : 0), 0);
    const planks = count((item) => !!TAGS.planks?.includes(item));
    const sticks = count((item) => item === "stick");
    const logs = count((item) => !!TAGS.logs?.includes(item));
    const line = (key: string, name: string, have: number, need: number) => {
      const el = card.querySelector<HTMLElement>(`[data-ingredient="${key}"]`)!;
      el.textContent = `${name} ${Math.min(have, need)}/${need}${have >= need ? " ✓" : ""}`;
      el.className = have >= need ? "ready" : "missing";
    };
    line("planks", "Доски", planks, 2);
    line("stick", "Палка", sticks, 1);
    const help = card.querySelector<HTMLElement>(".recipeHelp")!;
    help.textContent = planks >= 2 && sticks >= 1
      ? `Положи 2 доски и 1 палку в любые три клетки сетки ${this.grid.size}×${this.grid.size}, затем забери меч справа.`
      : planks < 2 && logs > 0
        ? "Положи бревно в сетку крафта — получишь 4 доски."
        : planks < 2
          ? "Добудь ствол дерева удержанием ЛКМ, затем сделай из него доски."
          : "Для палок положи 2 доски одну над другой в сетке крафта.";
  }

  // ---- отрисовка ----------------------------------------------------------------------------

  _render() {
    this.renderRecipe();
    const draw = (el: HTMLElement, stack: ItemStack | null) => {
      const img = el.querySelector("img")!; // разметка слота всегда содержит <img>
      const count = el.querySelector(".count")!; // …и .count
      if (stack) {
        img.src = ITEMS[stack.item]?.iconURL ?? ""; // iconURL заполняется buildIcons() до первого рендера; неизвестный предмет — пустая иконка
        img.style.display = "";
        img.title = labelOf(stack.item) + enchantSuffix(stack);
        count.textContent = stack.count > 1 ? String(stack.count) : "";
        el.classList.toggle("ench", enchantsOf(stack).length > 0);
      } else {
        img.style.display = "none";
        count.textContent = "";
        el.classList.remove("ench");
      }
      drawDurability(el, stack);
    };
    for (const r of this.refs) if (r.el) draw(r.el, r.get());
    if (this.resultEl) {
      const anvil =
        this.kind === "anvil"
          ? anvilResult(this.anvil[0] ?? null, this.anvil[1] ?? null)
          : null;
      const res =
        this.kind === "smithing"
          ? smithResult(
              this.smith[0] ?? null,
              this.smith[1] ?? null,
              this.smith[2] ?? null,
            )
          : this.kind === "anvil"
            ? (anvil?.result ?? null)
            : this.kind === "grindstone"
              ? (grindResult(this.grind[0] ?? null, this.grind[1] ?? null)
                  ?.result ?? null)
              : this.grid.result();
      draw(this.resultEl, res ? { ...res } : null);
      if (this.costEl) {
        const pl = this.game.player;
        this.costEl.textContent = !anvil
          ? ""
          : anvil.cost >= TOO_EXPENSIVE && pl.mode !== "creative"
            ? "Слишком дорого!"
            : `Цена: ${anvil.cost} ур.`;
      }
    }
    if (this.be && this.kind === "brewing" && this.arrowEl) {
      const st = this.be.state as BrewingState;
      this.arrowEl.style.width = ((st.brew / BREW_TIME) * 100).toFixed(1) + "%";
    }
    if (this.be && this.kind === "furnace") {
      const st = this.be.state as FurnaceState;
      if (this.flameEl)
        this.flameEl.style.height =
          (st.burnMax > 0 ? (st.burn / st.burnMax) * 100 : 0).toFixed(1) + "%";
      if (this.arrowEl)
        this.arrowEl.style.width =
          ((st.cook / COOK_TIME) * 100).toFixed(1) + "%";
    }

    // курсорный стак
    if (this.cursor) {
      this.cursorEl.classList.remove("hidden");
      this.cursorEl.querySelector("img")!.src =
        ITEMS[this.cursor.item]?.iconURL ?? "";
      this.cursorEl.querySelector(".count")!.textContent =
        this.cursor.count > 1 ? String(this.cursor.count) : "";
    } else {
      this.cursorEl.classList.add("hidden");
    }
    this._renderOffers();
    events.emit("invChanged"); // HUD-хотбар обновится
  }
}
