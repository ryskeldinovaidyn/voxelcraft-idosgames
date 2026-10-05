// Уровни сложности, как в Minecraft: мирная, лёгкая, обычная и высокая. Правила собраны в одну
// таблицу — чистые данные; кто их применяет, написано у каждого поля. Текущий уровень хранит игра
// (сейв, команда /difficulty), а читают его через rules() те места, куда неудобно протаскивать
// ссылку на Game: мозг моба, перепись населения и голод игрока.

export type Difficulty = "peaceful" | "easy" | "normal" | "hard";

export const DIFFICULTIES: readonly Difficulty[] = [
  "peaceful",
  "easy",
  "normal",
  "hard",
];

export const DIFFICULTY_NAMES: Record<Difficulty, string> = {
  peaceful: "Мирная",
  easy: "Лёгкая",
  normal: "Обычная",
  hard: "Высокая",
};

export interface DifficultyRules {
  /** Множитель урона мобов по игроку (entities/MobBrain). */
  mobDamage: number;
  /**
   * До какого здоровья добивает голод; null — не голодает вовсе (мирная).
   * В Minecraft: лёгкая — до 10, обычная — до 1, высокая — насмерть (player/Player).
   */
  starveFloor: number | null;
  /** Появляются ли враждебные мобы (entities/EntityManager, перепись). */
  hostiles: boolean;
  /** Ломают ли зомби двери — только на высокой (entities/Mob). */
  doorBreaking: boolean;
  /** Множитель шанса ночной осады деревни (systems/Siege через Game). */
  siege: number;
  /** С какой вероятностью убитый зомби житель встаёт зомби-жителем (systems/Zombify). */
  zombify: number;
}

export const RULES: Record<Difficulty, DifficultyRules> = {
  peaceful: {
    mobDamage: 0,
    starveFloor: null,
    hostiles: false,
    doorBreaking: false,
    siege: 0,
    zombify: 0,
  },
  easy: {
    mobDamage: 0.5,
    starveFloor: 10,
    hostiles: true,
    doorBreaking: false,
    siege: 0.5,
    zombify: 0,
  },
  normal: {
    mobDamage: 1,
    starveFloor: 1,
    hostiles: true,
    doorBreaking: false,
    siege: 1,
    zombify: 0.5,
  },
  hard: {
    mobDamage: 1.5,
    starveFloor: 0,
    hostiles: true,
    doorBreaking: true,
    siege: 1.5,
    zombify: 1,
  },
};

/** Сложность по имени (и по цифре 0..3, как в Minecraft); не узнали — null. */
export function parseDifficulty(v: string | undefined): Difficulty | null {
  if (!v) return null;
  const s = v.toLowerCase();
  const byDigit = DIFFICULTIES[Number(s)];
  if (/^[0-3]$/.test(s) && byDigit) return byDigit;
  const alias: Record<string, Difficulty> = {
    peaceful: "peaceful",
    мирная: "peaceful",
    easy: "easy",
    лёгкая: "easy",
    легкая: "easy",
    normal: "normal",
    обычная: "normal",
    hard: "hard",
    высокая: "hard",
  };
  return alias[s] ?? null;
}

let current: Difficulty = "normal";

/** Текущий уровень и его правила. */
export const difficulty = (): Difficulty => current;
export const rules = (): DifficultyRules => RULES[current];

/** Сменить уровень (Game: команда /difficulty и загрузка сейва). */
export function setDifficulty(d: Difficulty): void {
  current = d;
}
