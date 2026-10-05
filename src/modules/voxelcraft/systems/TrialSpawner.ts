// Спавнер испытаний, как в Minecraft 1.21 — чистая машина состояний (Game._tickTrials зовёт её на каждой
// блочной сущности trial_spawner, передавая, рядом ли игрок и как вызвать моба).
//   idle     — ждёт игрока в выживании в 14 блоках;
//   active   — выпускает волну из TRIAL_WAVE мобов своего вида (не больше 2 живых сразу, раз в 2 с);
//              игрок ушёл больше чем на минуту — спавнер сбрасывается;
//   cooldown — волна побеждена: выпала награда и ключ испытаний; через 10 минут — снова idle.
// Убитых считает Game (mobDied моба с trialFrom → state.killed++).
import { hashString, mulberry32 } from "../core/Noise";
import { ITEMS } from "../registry/Items";
import type { ItemStack } from "../types";

export const TRIAL_WAVE = 6;
const MAX_ALIVE = 2;
const SPAWN_EVERY = 2;
export const TRIAL_COOLDOWN = 600;
const GIVE_UP = 60;
export const TRIAL_RANGE = 14;

export type TrialState = {
  phase: "idle" | "active" | "cooldown";
  spawned: number;
  killed: number;
  t: number;
  /** Сколько игрока нет рядом во время волны. */
  away: number;
};

export const newTrialState = (): TrialState => ({
  phase: "idle",
  spawned: 0,
  killed: 0,
  t: 0,
  away: 0,
});

export interface TrialEnv {
  dt: number;
  /** Игрок в выживании в TRIAL_RANGE блоках. */
  near: boolean;
  /** Вызвать моба волны; false — места нет. */
  spawn(): boolean;
  /** Волна побеждена — выдать награду. */
  reward(items: ItemStack[]): void;
  rng: () => number;
}

/** Награда спавнера: 1–2 броска по таблице и ключ испытаний. */
const REWARD: readonly (readonly [string, number, number, number])[] = [
  ["arrow", 4, 8, 3],
  ["bread", 1, 3, 3],
  ["emerald", 1, 2, 2],
  ["iron_ingot", 1, 3, 2],
  ["wind_charge", 2, 4, 2],
  ["golden_apple", 1, 1, 1],
];

function roll(
  table: readonly (readonly [string, number, number, number])[],
  rng: () => number,
): ItemStack {
  const pool = table.filter(([n]) => ITEMS[n]);
  let r = rng() * pool.reduce((s, e) => s + e[3], 0);
  let e = pool[0]!;
  for (const p of pool) {
    r -= p[3];
    if (r <= 0) {
      e = p;
      break;
    }
  }
  return { item: e[0], count: e[1] + Math.floor(rng() * (e[2] - e[1] + 1)) };
}

export function trialStep(s: TrialState, env: TrialEnv): void {
  switch (s.phase) {
    case "idle":
      if (env.near)
        Object.assign(s, {
          phase: "active",
          spawned: 0,
          killed: 0,
          t: SPAWN_EVERY,
          away: 0,
        });
      return;
    case "active": {
      s.away = env.near ? 0 : s.away + env.dt;
      if (s.away > GIVE_UP) {
        Object.assign(s, newTrialState());
        return;
      }
      if (s.killed >= TRIAL_WAVE) {
        const items = [roll(REWARD, env.rng)];
        if (env.rng() < 0.5) items.push(roll(REWARD, env.rng));
        items.push({ item: "trial_key", count: 1 });
        env.reward(items);
        Object.assign(s, { phase: "cooldown", t: TRIAL_COOLDOWN });
        return;
      }
      s.t += env.dt;
      if (
        s.t >= SPAWN_EVERY &&
        s.spawned < TRIAL_WAVE &&
        s.spawned - s.killed < MAX_ALIVE &&
        env.spawn()
      ) {
        s.spawned++;
        s.t = 0;
      }
      return;
    }
    case "cooldown":
      s.t -= env.dt;
      if (s.t <= 0) Object.assign(s, newTrialState());
      return;
  }
}

/** Добыча хранилища: 2–4 броска; тяжёлое ядро — редко (как в Minecraft). */
const VAULT: readonly (readonly [string, number, number, number])[] = [
  ["emerald", 2, 4, 5],
  ["arrow", 4, 12, 4],
  ["iron_ingot", 2, 4, 4],
  ["wind_charge", 4, 12, 4],
  ["diamond", 1, 2, 2],
  ["golden_apple", 1, 1, 2],
  ["diamond_axe", 1, 1, 1],
  ["diamond_chestplate", 1, 1, 1],
  ["heavy_core", 1, 1, 1],
  ["flow_armor_trim_smithing_template", 1, 1, 2],
];

export function vaultLoot(rng: () => number): ItemStack[] {
  const out: ItemStack[] = [];
  for (let i = 2 + Math.floor(rng() * 3); i > 0; i--)
    out.push(roll(VAULT, rng));
  return out;
}

/** Добыча хранилища постройки — детерминированно по сиду и координатам. */
export const vaultLootAt = (
  seed: number,
  x: number,
  y: number,
  z: number,
): ItemStack[] =>
  vaultLoot(mulberry32(hashString(`vault:${seed}:${x},${y},${z}`)));
