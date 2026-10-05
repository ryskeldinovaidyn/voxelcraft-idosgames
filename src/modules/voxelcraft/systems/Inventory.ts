// Инвентарь — чистая модель данных без DOM (UI подписывается на invChanged).
// 36 слотов: 0..8 — хотбар, 9..35 — рюкзак. Слот: {item, count, dmg?} | null.
// Броня — 4 отдельных слота: шлем, нагрудник, поножи, ботинки.
import { events } from "../core/EventBus";
import { enchLevel } from "./Enchant";
import { ITEMS } from "../registry/Items";
import type { ArmorSlot, ItemStack, InventorySave } from "../types";

/** Порядок слотов брони. */
export const ARMOR_SLOTS: readonly ArmorSlot[] = [
  "head",
  "chest",
  "legs",
  "feet",
];

/** Сколько слотов у сундука Предела (общего склада игрока). */
export const ENDER_SIZE = 27;

/**
 * Стак из чужих данных (сейв, Мастерская, старая версия игры): предмет должен существовать в игре,
 * иначе HUD и экран инвентаря падают на `ITEMS[item]!` каждый кадр. Негодное — пустой слот.
 */
export function sanitizeStack(s: unknown): ItemStack | null {
  if (!s || typeof s !== "object") return null;
  const v = s as Partial<ItemStack>;
  if (typeof v.item !== "string" || !ITEMS[v.item]) return null;
  const count = Math.floor(Number(v.count));
  if (!Number.isFinite(count) || count <= 0) return null;
  const out: ItemStack = { ...(v as ItemStack), count };
  if (out.dmg !== undefined && !(Number(out.dmg) >= 0)) delete out.dmg;
  return out;
}

export class Inventory {
  slots: (ItemStack | null)[];
  hotbarIndex: number;
  armor: (ItemStack | null)[] = [null, null, null, null];
  /**
   * Сундук Предела: один склад на все свои копии и все измерения, поэтому он у игрока, а не у
   * клетки (world/behaviours/extras, экран — ui/InventoryUI).
   */
  ender: (ItemStack | null)[] = new Array(ENDER_SIZE).fill(null);

  constructor(size = 36) {
    this.slots = new Array(size).fill(null);
    this.hotbarIndex = 0;
  }

  _changed() {
    events.emit("invChanged");
  }

  heldItem(): ItemStack | null {
    return this.slots[this.hotbarIndex]!;
  }

  selectSlot(i: number) {
    this.hotbarIndex = Math.max(0, Math.min(8, i));
    this._changed();
  }
  scrollSlot(delta: number) {
    this.hotbarIndex = (this.hotbarIndex + delta + 9) % 9;
    this._changed();
  }

  /** Добавить предметы (сначала в существующие стаки, потом в пустые слоты).
   *  @returns {number} сколько НЕ поместилось */
  add(itemName: string, count: number): number {
    const max = ITEMS[itemName]?.maxStack ?? 64;
    const requested = count;
    for (let i = 0; i < this.slots.length && count > 0; i++) {
      const s = this.slots[i];
      // в стак с износом или tag (зачарование, имя, содержимое) обычные предметы не доливаем
      if (s && s.item === itemName && s.count < max && !s.dmg && !s.tag) {
        const take = Math.min(count, max - s.count);
        s.count += take;
        count -= take;
      }
    }
    for (let i = 0; i < this.slots.length && count > 0; i++) {
      if (!this.slots[i]) {
        const take = Math.min(count, max);
        this.slots[i] = { item: itemName, count: take };
        count -= take;
      }
    }
    // Ничего не легло (инвентарь полон) — подписчиков не будим: дроп у ног игрока зовёт add()
    // каждый тик, и HUD с рукой перерисовывались бы 20 раз в секунду впустую.
    if (count !== requested) this._changed();
    return count;
  }

  /**
   * Положить стак с износом (инструмент, броня) — в пустой слот целиком, износ сохраняется; обычный
   * стак — как add(). @returns сколько не поместилось
   */
  addStack(s: ItemStack): number {
    if (!s.dmg && !s.tag) return this.add(s.item, s.count);
    const i = this.slots.findIndex((x) => !x);
    if (i < 0) return s.count;
    this.slots[i] = { ...s };
    this._changed();
    return 0;
  }

  /**
   * Заменить один предмет в руке другим (ведро → ведро воды). Из стака пустых вёдер берётся одно,
   * полное кладётся в инвентарь. @returns true — не поместилось (надо выбросить под ноги)
   */
  swapHeldOne(item: string): boolean {
    const s = this.slots[this.hotbarIndex];
    if (!s) return false;
    if (s.count <= 1) {
      this.slots[this.hotbarIndex] = { item, count: 1 };
      this._changed();
      return false;
    }
    s.count -= 1;
    const left = this.add(item, 1);
    this._changed();
    return left > 0;
  }

  consumeHeld(n = 1) {
    const s = this.slots[this.hotbarIndex];
    if (!s) return;
    s.count -= n;
    if (s.count <= 0) this.slots[this.hotbarIndex] = null;
    this._changed();
  }

  /**
   * Износ предмета в руке (инструмент, оружие): n единиц прочности. Кончилась — предмет ломается,
   * как в Minecraft. У предметов без прочности ничего не происходит.
   */
  damageHeld(n = 1) {
    const s = this.slots[this.hotbarIndex];
    const max = s ? (ITEMS[s.item]?.durability ?? 0) : 0;
    if (!s || !max) return;
    // Прочность: износ тратится лишь с шансом 1/(уровень+1), как в Minecraft
    const ub = enchLevel(s, "unbreaking");
    if (ub > 0 && Math.random() >= 1 / (ub + 1)) return;
    s.dmg = (s.dmg ?? 0) + n;
    if (s.dmg >= max) {
      this.slots[this.hotbarIndex] = null;
      events.emit("toolBreak", { item: s.item });
    }
    this._changed();
  }

  /** Сколько предметов itemName во всех слотах (торговля). */
  count(itemName: string): number {
    let n = 0;
    for (const s of this.slots) if (s && s.item === itemName) n += s.count;
    return n;
  }

  /** Съесть count предметов itemName из любого места (для крафта). */
  consume(itemName: string, count: number) {
    for (let i = 0; i < this.slots.length && count > 0; i++) {
      const s = this.slots[i];
      if (s && s.item === itemName) {
        const take = Math.min(count, s.count);
        s.count -= take;
        count -= take;
        if (s.count <= 0) this.slots[i] = null;
      }
    }
    this._changed();
  }

  setSlot(i: number, stack: ItemStack | null) {
    this.slots[i] = stack;
    this._changed();
  }

  // ---- броня ----------------------------------------------------------------------------

  setArmor(i: number, stack: ItemStack | null) {
    this.armor[i] = stack;
    this._changed();
  }

  /** Сумма очков защиты и твёрдости надетой брони. */
  armorStats(): { points: number; toughness: number; protection: number } {
    let points = 0,
      toughness = 0,
      protection = 0;
    for (const s of this.armor) {
      const d = s ? ITEMS[s.item] : undefined;
      if (d) {
        points += d.armor;
        toughness += d.toughness;
      }
      protection += enchLevel(s, "protection");
    }
    return { points, toughness, protection };
  }

  /** Износ брони от удара: каждая часть теряет max(1, урон/4), как в Minecraft. */
  damageArmor(dmg: number) {
    const wear = Math.max(1, Math.floor(dmg / 4));
    let changed = false;
    this.armor.forEach((s, i) => {
      const max = s ? (ITEMS[s.item]?.durability ?? 0) : 0;
      if (!s || !max || !ITEMS[s.item]?.armor) return; // крылья от ударов не изнашиваются
      const ub = enchLevel(s, "unbreaking");
      if (ub > 0 && Math.random() >= 1 / (ub + 1)) return;
      s.dmg = (s.dmg ?? 0) + wear;
      changed = true;
      if (s.dmg >= max) {
        this.armor[i] = null;
        events.emit("toolBreak", { item: s.item });
      }
    });
    if (changed) this._changed();
  }

  /** Надеты годные Крылья Предела: последняя единица прочности не летает (как у элитр). */
  canGlide(): boolean {
    const s = this.armor[1];
    return (
      s?.item === "wings" && (s.dmg ?? 0) < (ITEMS.wings?.durability ?? 0) - 1
    );
  }

  /** Секунда полёта на крыльях — единица износа (Прочность бережёт), до последней единицы. */
  wearWings(): void {
    const s = this.armor[1];
    const max = ITEMS.wings?.durability ?? 0;
    if (s?.item !== "wings" || !max) return;
    const ub = enchLevel(s, "unbreaking");
    if (ub > 0 && Math.random() >= 1 / (ub + 1)) return;
    s.dmg = Math.min(max - 1, (s.dmg ?? 0) + 1);
    this._changed();
  }

  serialize(): InventorySave {
    return {
      slots: this.slots,
      hotbarIndex: this.hotbarIndex,
      armor: this.armor,
      ender: this.ender,
    };
  }
  deserialize(d: InventorySave) {
    const slots = Array.isArray(d?.slots) ? d.slots : [];
    this.slots = new Array(36)
      .fill(null)
      .map((_, i) => sanitizeStack(slots[i]));
    const hb = Number(d?.hotbarIndex);
    this.hotbarIndex = Number.isInteger(hb) && hb >= 0 && hb <= 8 ? hb : 0;
    this.armor = [0, 1, 2, 3].map((i) => sanitizeStack(d?.armor?.[i]));
    // сейвы до сундука Предела поля не знают — склад просто пуст
    this.ender = new Array(ENDER_SIZE)
      .fill(null)
      .map((_, i) => sanitizeStack(d?.ender?.[i]));
    this._changed();
  }

  /**
   * Смерть: рюкзак, хотбар и броня пусты (их вещи Game уже бросил на землю). Сундук Предела —
   * склад, а не карманы: его содержимое смерть не трогает, как в Minecraft.
   */
  clearCarried() {
    this.slots = new Array(36).fill(null);
    this.armor = [null, null, null, null];
    this._changed();
  }
}
