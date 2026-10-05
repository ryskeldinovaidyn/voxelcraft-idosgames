// Варочная стойка, как в Minecraft: ингредиент сверху, огненный порошок — топливо (1 = 20 варок),
// три бутылки внизу. Варка 20 с превращает каждую подходящую бутылку и тратит один ингредиент.
import type { ItemStack } from "../../types";
import { registerBlockEntity } from "../BlockEntities";

/** Секунд на одну варку. */
export const BREW_TIME = 20;
/** Варок на один огненный порошок. */
export const BREWS_PER_POWDER = 20;

export type BrewingState = {
  ingredient: ItemStack | null;
  fuel: ItemStack | null;
  bottles: (ItemStack | null)[];
  /** Прогресс текущей варки, сек. */
  brew: number;
  /** Сколько варок осталось в загруженном порошке. */
  fuelLeft: number;
};

/**
 * Ингредиент → (зелье в бутылке → что получится). Сброженный паучий глаз «портит» зелье в
 * противоположное, как в Minecraft: вода → слабость, скорость → замедление, лечение и яд → урон.
 */
export const BREWS: Record<string, Record<string, string>> = {
  inferno_wart: { potion_water: "potion_awkward" },
  flame_powder: { potion_awkward: "potion_strength" },
  wailer_tear: { potion_awkward: "potion_regeneration" },
  golden_carrot: { potion_awkward: "potion_night_vision" },
  glistering_melon: { potion_awkward: "potion_healing" },
  sugar: { potion_awkward: "potion_swiftness" },
  pufferfish: { potion_awkward: "potion_water_breathing" },
  magma_cream: { potion_awkward: "potion_fire_resistance" },
  spider_eye: { potion_awkward: "potion_poison" },
  fermented_spider_eye: {
    potion_water: "potion_weakness",
    potion_swiftness: "potion_slowness",
    potion_healing: "potion_harming",
    potion_poison: "potion_harming",
  },
};

export function brewResult(ingredient: string, potion: string): string | null {
  return BREWS[ingredient]?.[potion] ?? null;
}

export const newBrewing = (): BrewingState => ({
  ingredient: null,
  fuel: null,
  bottles: [null, null, null],
  brew: 0,
  fuelLeft: 0,
});

/** Шаг стойки на dt секунд — чистая функция состояния (её и проверяют тесты). */
export function stepBrewing(s: BrewingState, dt: number): void {
  const ing = s.ingredient;
  const canBrew =
    !!ing && s.bottles.some((b) => b && brewResult(ing.item, b.item));
  if (!canBrew) {
    s.brew = 0;
    return;
  }
  if (s.fuelLeft <= 0 && s.fuel?.item === "flame_powder") {
    s.fuelLeft = BREWS_PER_POWDER;
    s.fuel.count -= 1;
    if (s.fuel.count <= 0) s.fuel = null;
  }
  if (s.fuelLeft <= 0) return;
  s.brew += dt;
  if (s.brew < BREW_TIME) return;
  s.brew = 0;
  s.fuelLeft -= 1;
  s.bottles = s.bottles.map((b) => {
    const r = b ? brewResult(ing.item, b.item) : null;
    return r ? { item: r, count: 1 } : b;
  });
  ing.count -= 1;
  if (ing.count <= 0) s.ingredient = null;
}

registerBlockEntity("brewing", {
  create: newBrewing,
  tick: ({ be, dt }) => stepBrewing(be.state as BrewingState, dt),
  contents: (st) => {
    const s = st as BrewingState;
    return [s.ingredient, s.fuel, ...s.bottles];
  },
});
