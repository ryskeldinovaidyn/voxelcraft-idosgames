// Торговля с жителями, как в Minecraft: у профессии свой список сделок — товар за изумруды и
// изумруды за товар. Каждая сделка ограничена числом раз (Mob.uses), утром житель пополняет товар
// (Game). Экран — ui/tradeView.ts через InventoryUI; профессия — поле `trades` описания моба.
import { withEnchants } from "./Enchant";
import { ITEMS } from "../registry/Items";
import type { Inventory } from "./Inventory";
import type { ItemStack } from "../types";

export type Profession =
  | "farmer"
  | "librarian"
  | "armorer"
  | "toolsmith"
  | "cleric"
  | "butcher"
  | "cartographer"
  | "fisherman"
  | "mason"
  | "weaponsmith"
  | "shepherd"
  | "fletcher"
  | "leatherworker";
export const PROFESSIONS: readonly Profession[] = [
  "farmer",
  "librarian",
  "armorer",
  "toolsmith",
  "cleric",
  "butcher",
  "cartographer",
  "fisherman",
  "mason",
  "weaponsmith",
  "shepherd",
  "fletcher",
  "leatherworker",
];

/**
 * Уровни профессии, как в Minecraft: опыт за сделки открывает следующие ступени списка.
 * Порог — сколько опыта нужно, чтобы ступень открылась.
 */
export const VILLAGER_TIERS: readonly number[] = [0, 10, 70, 150, 250];
export const TIER_NAMES: readonly string[] = [
  "Новичок",
  "Подмастерье",
  "Ремесленник",
  "Знаток",
  "Мастер",
];
/** Опыт жителя за одну сделку. */
export const TRADE_XP = 2;

/** Уровень профессии по опыту: 1..5. */
export function levelOf(xp: number): number {
  let lvl = 1;
  for (let i = 1; i < VILLAGER_TIERS.length; i++)
    if (xp >= VILLAGER_TIERS[i]!) lvl = i + 1;
  return lvl;
}

/**
 * Ступень сделки по её месту в списке: по две сделки на уровень. В Minecraft ступень записана у
 * каждой сделки отдельно; здесь она выводится из порядка — списки и так идут от простого к дорогому.
 */
export const tierOf = (index: number): number =>
  Math.min(5, 1 + Math.floor(index / 2));

export interface Trade {
  /** Что отдать: предмет и сколько; иногда второй предмет (книга к изумрудам). */
  buy: [string, number];
  buy2?: [string, number];
  /** Что получить. */
  sell: ItemStack;
  /** Сколько раз до пополнения. */
  maxUses: number;
}

/** Товар за изумруды. */
const sells = (
  price: number,
  item: string,
  count = 1,
  maxUses = 12,
  buy2?: [string, number],
): Trade => ({
  buy: ["emerald", price],
  ...(buy2 ? { buy2 } : {}),
  sell: { item, count },
  maxUses,
});
/** Изумруд за товар. */
const buys = (item: string, count: number, maxUses = 16): Trade => ({
  buy: [item, count],
  sell: { item: "emerald", count: 1 },
  maxUses,
});

/** Списки сделок: профессии жителей и странствующий торговец (он не житель — в PROFESSIONS его нет). */
export type TradeList = Profession | "wandering";

export const TRADES: Record<TradeList, Trade[]> = {
  // странствующий торговец: саженцы, растения, диковинки — только продаёт, по 5 раз, как в Minecraft
  wandering: [
    sells(5, "jungle_sapling", 1, 5),
    sells(5, "cherry_sapling", 1, 5),
    sells(5, "mangrove_propagule", 1, 5),
    sells(1, "cocoa_beans", 3, 5),
    sells(1, "bamboo", 2, 5),
    sells(1, "sugar_cane", 1, 5),
    sells(3, "cactus", 1, 5),
    sells(1, "brown_mushroom", 1, 5),
    sells(1, "red_mushroom", 1, 5),
    sells(1, "pumpkin_seeds", 1, 5),
    sells(1, "melon_seeds", 1, 5),
    sells(2, "glowstone", 1, 5),
    sells(4, "slime_ball", 1, 5),
    sells(1, "red_sand", 8, 5),
    sells(3, "moss_block", 2, 5),
    sells(1, "blue_dye", 3, 5),
  ],
  farmer: [
    buys("wheat", 20),
    buys("carrot", 22),
    buys("potato", 26),
    buys("pumpkin", 6, 12),
    sells(1, "bread", 6),
    sells(1, "apple", 4),
    sells(3, "golden_carrot", 3),
  ],
  librarian: [
    buys("paper", 24),
    buys("book", 4, 12),
    sells(9, "bookshelf", 1),
    sells(1, "glass", 4),
    {
      buy: ["emerald", 10],
      buy2: ["book", 1],
      sell: withEnchants(
        { item: "enchanted_book", count: 1 },
        { protection: 2 },
      ),
      maxUses: 6,
    },
    {
      buy: ["emerald", 14],
      buy2: ["book", 1],
      sell: withEnchants(
        { item: "enchanted_book", count: 1 },
        { sharpness: 3 },
      ),
      maxUses: 6,
    },
  ],
  armorer: [
    buys("coal", 15),
    buys("iron_ingot", 4, 12),
    buys("diamond", 1, 6),
    sells(5, "iron_helmet"),
    sells(9, "iron_chestplate"),
    sells(7, "iron_leggings"),
    sells(4, "iron_boots"),
  ],
  toolsmith: [
    buys("coal", 15),
    buys("iron_ingot", 4, 12),
    buys("diamond", 1, 6),
    sells(1, "stone_axe"),
    sells(1, "stone_pickaxe"),
    sells(6, "iron_pickaxe", 1, 6),
    sells(5, "iron_axe", 1, 6),
    sells(4, "iron_shovel", 1, 6),
  ],
  cleric: [
    buys("rotten_flesh", 32),
    buys("gold_ingot", 3, 12),
    sells(1, "redstone", 2),
    sells(1, "lapis_lazuli", 1),
    sells(4, "glowstone", 1),
    // Жемчуг Предела у священника — ещё один путь к Оку Предела, как в Minecraft
    sells(5, "rim_pearl", 1, 6),
  ],
  butcher: [
    buys("raw_chicken", 14),
    buys("porkchop", 7),
    buys("coal", 15),
    sells(1, "cooked_porkchop", 5),
    sells(1, "cooked_chicken", 8),
    sells(6, "saddle", 1, 3),
  ],
  // картограф: пустые карты и карты-исследователи — так в Minecraft находят особняк и подводный храм
  cartographer: [
    buys("paper", 24),
    buys("glass_pane", 11),
    sells(7, "map", 1),
    sells(13, "ocean_explorer_map", 1, 1, ["compass", 1]),
    sells(14, "woodland_explorer_map", 1, 1, ["compass", 1]),
  ],
  // рыбак (бочка) и каменщик (камнерез) — профессии от рабочего блока, systems/Jobs.ts
  fisherman: [
    buys("string", 20),
    buys("coal", 15),
    buys("cod", 15),
    sells(1, "cooked_cod", 5),
    sells(3, "fishing_rod", 1, 6),
  ],
  mason: [
    buys("clay", 10),
    buys("stone", 20),
    sells(1, "bricks", 10),
    sells(1, "terracotta", 10),
    sells(1, "quartz", 1),
    sells(1, "stone_bricks", 4),
  ],
  // профессии от станков: точило, ткацкий станок, стол фехтовальщика, котёл (systems/Jobs.ts)
  weaponsmith: [
    buys("coal", 15),
    buys("iron_ingot", 4, 12),
    buys("diamond", 1, 6),
    sells(1, "stone_axe", 1, 12),
    sells(5, "iron_axe", 1, 6),
  ],
  shepherd: [
    buys("white_wool", 18),
    buys("black_wool", 18),
    sells(2, "shears", 1, 6),
    sells(1, "white_wool", 1),
    sells(1, "red_wool", 1),
  ],
  fletcher: [
    buys("stick", 32),
    buys("string", 14),
    sells(1, "arrow", 16),
    sells(3, "bow", 1, 6),
  ],
  leatherworker: [
    buys("leather", 6),
    sells(2, "cauldron", 1, 6),
    sells(5, "saddle", 1, 3),
  ],
};

/** Сделки списка; сделки с предметами, которых нет в реестре, пропускаются. */
export function tradesOf(p: string | undefined): Trade[] {
  if (!p || !(p in TRADES)) return [];
  return TRADES[p as TradeList].filter(
    (t) =>
      ITEMS[t.sell.item] && ITEMS[t.buy[0]] && (!t.buy2 || ITEMS[t.buy2[0]]),
  );
}

/**
 * Скидка Героя деревни (эффект hero), как в Minecraft: первая плата дешевле на 30% и ещё на 6.25%
 * за каждый уровень сверх первого, но не меньше 1.
 */
export function withDiscount(t: Trade, heroLevel: number): Trade {
  if (heroLevel <= 0) return t;
  const k = 0.3 + 0.0625 * (heroLevel - 1);
  return { ...t, buy: [t.buy[0], Math.max(1, Math.floor(t.buy[1] * (1 - k)))] };
}

/** Хватает ли у игрока предметов на сделку. */
export function canAfford(inv: Pick<Inventory, "count">, t: Trade): boolean {
  if (t.buy2 && t.buy2[0] === t.buy[0])
    return inv.count(t.buy[0]) >= t.buy[1] + t.buy2[1];
  return (
    inv.count(t.buy[0]) >= t.buy[1] &&
    (!t.buy2 || inv.count(t.buy2[0]) >= t.buy2[1])
  );
}

/**
 * Совершить сделку: забрать плату, выдать товар. Не влезло в инвентарь — `drop` (под ноги).
 * @returns false — не хватает предметов
 */
export function trade(
  inv: Pick<Inventory, "count" | "consume" | "addStack">,
  t: Trade,
  drop: (s: ItemStack) => void,
): boolean {
  if (!canAfford(inv, t)) return false;
  inv.consume(t.buy[0], t.buy[1]);
  if (t.buy2) inv.consume(t.buy2[0], t.buy2[1]);
  const s: ItemStack = {
    ...t.sell,
    ...(t.sell.tag ? { tag: structuredClone(t.sell.tag) } : {}),
  };
  const left = inv.addStack(s);
  if (left > 0) drop({ ...s, count: left });
  return true;
}
