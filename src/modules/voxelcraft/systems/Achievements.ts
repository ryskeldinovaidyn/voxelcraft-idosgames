// Достижения, как в Minecraft: список целей от «добыть древесину» до «победить дракона». Каждое
// ждёт своё событие шины (крафт, путешествие через портал, смерть моба…) и, если условие выполнено,
// открывается один раз — событие achievement (всплывашка — ui/AchievementsView). Хранятся в сейве мира.
// Добавить достижение = одна строка в ACHIEVEMENTS; игровой код о них не знает.
import { events } from "../core/EventBus";

/** Что достижению можно спросить у игры. */
export interface AchievementCtx {
  /** Есть ли в инвентаре подходящий предмет. */
  has(pred: (item: string) => boolean): boolean;
  /** Надето ли подходящее. */
  wearing(pred: (item: string) => boolean): boolean;
  /** Действует ли эффект. */
  effect(id: string): boolean;
}

type Payload = Record<string, unknown>;

export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  /** Событие шины, после которого проверяется условие. */
  on: string;
  test?(p: Payload, c: AchievementCtx): boolean;
}

const hasItem =
  (item: string) =>
  (_p: Payload, c: AchievementCtx): boolean =>
    c.has((i) => i === item);
const crafted =
  (item: string) =>
  (p: Payload): boolean =>
    p.item === item;
/** Моб из события mobDied. */
const mobOf = (p: Payload) =>
  p.entity as
    | { def?: { name?: string; category?: string }; hitByPlayerT?: number }
    | undefined;

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: "wood",
    title: "Добыть древесину",
    desc: "Раздобудьте бревно",
    on: "invChanged",
    test: (_p, c) => c.has((i) => i.endsWith("_log")),
  },
  {
    id: "workbench",
    title: "Верстак",
    desc: "Смастерите верстак",
    on: "craft",
    test: crafted("crafting_table"),
  },
  {
    id: "stone_age",
    title: "Каменный век",
    desc: "Добудьте булыжник",
    on: "invChanged",
    test: hasItem("cobblestone"),
  },
  {
    id: "better_tools",
    title: "Инструменты получше",
    desc: "Смастерите каменную кирку",
    on: "craft",
    test: crafted("stone_pickaxe"),
  },
  {
    id: "bread",
    title: "Хлеб насущный",
    desc: "Испеките хлеб",
    on: "craft",
    test: crafted("bread"),
  },
  {
    id: "iron",
    title: "Горячая штучка",
    desc: "Выплавьте железный слиток",
    on: "invChanged",
    test: hasItem("iron_ingot"),
  },
  {
    id: "iron_armor",
    title: "Железный доспех",
    desc: "Наденьте железную броню",
    on: "invChanged",
    test: (_p, c) => c.wearing((i) => i.startsWith("iron_")),
  },
  {
    id: "diamonds",
    title: "Алмазы!",
    desc: "Добудьте алмаз",
    on: "invChanged",
    test: hasItem("diamond"),
  },
  {
    id: "obsidian",
    title: "Обсидиан",
    desc: "Получите обсидиан",
    on: "invChanged",
    test: hasItem("obsidian"),
  },
  {
    id: "enchanter",
    title: "Зачарователь",
    desc: "Зачаруйте предмет",
    on: "enchanted",
  },
  {
    id: "sleep",
    title: "Сладких снов",
    desc: "Проспите ночь в кровати",
    on: "slept",
  },
  {
    id: "fisher",
    title: "Рыбак",
    desc: "Поймайте что-нибудь удочкой",
    on: "fishCaught",
  },
  {
    id: "tame",
    title: "Лучший друг",
    desc: "Приручите животное",
    on: "mobTamed",
  },
  {
    id: "trade",
    title: "Выгодная сделка",
    desc: "Поторгуйте с жителем",
    on: "trade",
  },
  {
    id: "honey",
    title: "Сладкая жизнь",
    desc: "Соберите мёд из улья",
    on: "hiveHarvest",
  },
  {
    id: "hunter",
    title: "Охотник на монстров",
    desc: "Убейте враждебное существо",
    on: "mobDied",
    test: (p) =>
      mobOf(p)?.def?.category === "hostile" &&
      (mobOf(p)?.hitByPlayerT ?? 0) > 0,
  },
  {
    id: "inferno",
    title: "Нам нужно глубже",
    desc: "Попадите в Пекло",
    on: "portalTravel",
    test: (p) => p.dimension === "inferno",
  },
  {
    id: "flame_rod",
    title: "В огонь",
    desc: "Добудьте огненный стержень",
    on: "invChanged",
    test: hasItem("flame_rod"),
  },
  {
    id: "brewer",
    title: "Своя пивоварня",
    desc: "Сварите зелье",
    on: "invChanged",
    test: (_p, c) =>
      c.has((i) => i.startsWith("potion_") && i !== "potion_water"),
  },
  {
    id: "eye",
    title: "Око Предела",
    desc: "Бросьте Око Предела",
    on: "eyeThrown",
  },
  {
    id: "beyond",
    title: "Конец?",
    desc: "Войдите в портал Предела",
    on: "portalTravel",
    test: (p) => p.dimension === "beyond",
  },
  {
    id: "dragon",
    title: "Освобождение Предела",
    desc: "Победите Дракона Предела",
    on: "dragonDefeated",
  },
  {
    id: "ash_lord_summon",
    title: "Пепел к пеплу",
    desc: "Призовите Пепельного владыку",
    on: "ashLordSummoned",
  },
  {
    id: "ash_lord_kill",
    title: "Повергнуть владыку",
    desc: "Победите Пепельного владыку",
    on: "mobDied",
    test: (p) => mobOf(p)?.def?.name === "ash_lord",
  },
  { id: "beacon", title: "Маяк", desc: "Выберите силу маяка", on: "beaconSet" },
  {
    id: "outer",
    title: "Дальние острова",
    desc: "Пройдите Врата Предела",
    on: "gatewayTravel",
    test: (p) => p.outer === true,
  },
  {
    id: "wings",
    title: "Небо — не предел",
    desc: "Полетите на Крыльях Предела",
    on: "glideStart",
  },
  {
    id: "turtle_helmet",
    title: "Черепашья сила",
    desc: "Наденьте черепаший панцирь",
    on: "invChanged",
    test: (_p, c) => c.wearing((i) => i === "turtle_helmet"),
  },
  {
    id: "elder",
    title: "Глубоко под водой",
    desc: "Победите древнего глубинника",
    on: "mobDied",
    test: (p) => mobOf(p)?.def?.name === "elder_deepling",
  },
  {
    id: "heart",
    title: "Кладоискатель",
    desc: "Найдите сердце моря",
    on: "invChanged",
    test: hasItem("heart_of_the_sea"),
  },
  {
    id: "conduit",
    title: "Сила моря",
    desc: "Получите силу проводника",
    on: "conduitPower",
  },
  {
    id: "sculk_spread",
    title: "Оно распространяется",
    desc: "Убейте существо рядом с катализатором скалка",
    on: "sculkSpread",
  },
  {
    id: "archaeology",
    title: "Бережно и аккуратно",
    desc: "Найдите что-нибудь кистью",
    on: "brushLoot",
  },
  {
    id: "sniffer",
    title: "Чем пахнет?",
    desc: "Дождитесь, пока нюхач выкопает семя",
    on: "snifferDig",
  },
  {
    id: "vault",
    title: "Под замком",
    desc: "Откройте хранилище ключом испытаний",
    on: "vaultOpen",
  },
  {
    id: "trim",
    title: "Стиль — это всё",
    desc: "Украсьте броню отделкой на кузнечном столе",
    on: "armorTrimmed",
  },
  {
    id: "wax",
    title: "Вощёная медь",
    desc: "Покройте медь воском",
    on: "copperWax",
  },
  {
    id: "bundle",
    title: "Всё своё ношу с собой",
    desc: "Положите что-нибудь в мешок",
    on: "bundleInsert",
  },
  {
    id: "snow_golem",
    title: "Снежный друг",
    desc: "Слепите снеговика из снега и тыквы",
    on: "snowGolemBuilt",
  },
  {
    id: "barter",
    title: "Звон золота",
    desc: "Выменяйте что-нибудь у свинорыла за золотой слиток",
    on: "barter",
  },
  {
    id: "allay",
    title: "Ты мой друг",
    desc: "Дух-помощник принёс вам собранное",
    on: "allayDeliver",
  },
  {
    id: "mace",
    title: "Сверхсокрушение",
    desc: "Нанесите булавой 50 урона одним ударом",
    on: "maceSmash",
    test: (p) => Number(p.damage) >= 50,
  },
  {
    id: "froglight",
    title: "Лягушачий свет",
    desc: "Добудьте лягушачий свет",
    on: "invChanged",
    test: (_p, c) => c.has((i) => i.endsWith("_froglight")),
  },
  {
    id: "warden",
    title: "Страж пробуждён",
    desc: "Разбудите Стража в глубокой тьме",
    on: "wardenSummoned",
  },
  {
    id: "omen",
    title: "Кто теперь капитан?",
    desc: "Победите капитана мародёров",
    on: "badOmen",
  },
  {
    id: "raid",
    title: "Герой деревни",
    desc: "Отбейте набег на деревню",
    on: "raidWon",
  },
  {
    id: "totem",
    title: "Смерть подождёт",
    desc: "Спаситесь тотемом жизни",
    on: "totemUsed",
  },
  {
    id: "levitation",
    title: "Вверх!",
    desc: "Попадите под пулю панцирника",
    on: "effectsChanged",
    test: (p, c) => p.id === "levitation" && c.effect("levitation"),
  },
];

const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export class Achievements {
  readonly done = new Set<string>();
  private readonly offs: (() => void)[] = [];

  constructor(private readonly ctx: AchievementCtx) {
    const byEvent = new Map<string, AchievementDef[]>();
    for (const a of ACHIEVEMENTS)
      byEvent.set(a.on, [...(byEvent.get(a.on) ?? []), a]);
    for (const [ev, list] of byEvent) {
      const off: unknown = events.on(ev, (p?: Payload) => {
        for (const a of list)
          if (!this.done.has(a.id) && (!a.test || a.test(p ?? {}, this.ctx)))
            this.unlock(a.id);
      });
      if (typeof off === "function") this.offs.push(off as () => void);
    }
  }

  /** Открыть достижение; false — уже открыто или такого нет. */
  unlock(id: string): boolean {
    const a = BY_ID.get(id);
    if (!a || this.done.has(id)) return false;
    this.done.add(id);
    events.emit("achievement", { id, title: a.title, desc: a.desc });
    return true;
  }

  /** Из сейва: известные id (неизвестные — от будущих версий или мусор — пропускаются). */
  load(list: unknown): void {
    this.done.clear();
    if (Array.isArray(list))
      for (const id of list)
        if (typeof id === "string" && BY_ID.has(id)) this.done.add(id);
  }

  serialize(): string[] {
    return [...this.done];
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
  }
}
