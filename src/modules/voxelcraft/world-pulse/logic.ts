import { PULSE } from "./config";
import type { EventContext, EventDefinition, EventInstance, HistoryEntry } from "./types";

export interface SelectionState {
  elapsedSeconds: number;
  cooldowns: Record<string, { gameUntil: number; realUntil: number }>;
  history: HistoryEntry[];
  active: EventInstance[];
  weights: Record<string, number>;
  majorUntil: number;
  meteorHintUntil: number;
}

export function eligible(def: EventDefinition, c: EventContext, state: SelectionState, now: number): string | null {
  if (!def.enabled) return "disabled";
  if (c.worldAgeDays < def.minimumWorldAgeDays) return "world age";
  if (c.playtimeMinutes < def.minimumPlaytimeMinutes) return "playtime";
  if (def.outdoors && !c.outdoors) return "indoors";
  // Расстояние от базы проверяет spawn resolver по целевой точке, а не по игроку.
  if (def.allowedBiomes.length && !def.allowedBiomes.includes(c.biome)) return "biome";
  if (def.allowedWeather.length && !def.allowedWeather.includes(c.weather)) return "weather";
  if (def.allowedTime === "night" && (c.phase < 0.59 || c.phase > 0.95)) return "time";
  if (def.allowedTime === "day" && c.phase >= 0.5) return "time";
  if (def.allowedTime === "twilight" && !(c.phase < 0.11 || (c.phase > 0.39 && c.phase < 0.61) || c.phase > 0.92)) return "time";
  if (def.allowedTime === "day_or_twilight" && c.phase >= 0.61 && c.phase <= 0.92) return "time";
  const past = state.history.filter((h) => h.eventId === def.id).length;
  if (def.maxOccurrences !== null && past >= def.maxOccurrences) return "max occurrences";
  const cd = state.cooldowns[def.id];
  if (cd && (state.elapsedSeconds < cd.gameUntil || now < cd.realUntil)) return "cooldown";
  if (state.active.some((a) => a.id === def.id || def.conflicts.includes(a.id))) return "conflict";
  const ambient = state.active.filter((a) => a.data.intensity === "ambient").length;
  const major = state.active.filter((a) => a.data.intensity === "major").length;
  const legendary = state.active.filter((a) => a.data.legendary === true).length;
  if (def.intensity === "ambient" && ambient >= PULSE.maxAmbient) return "ambient budget";
  if (def.intensity === "major" && (major >= PULSE.maxMajor || legendary || state.elapsedSeconds < state.majorUntil)) return "major budget";
  if (def.intensity === "major" && c.majorBossActive) return "major boss";
  if (def.rarity === "legendary" && (legendary >= PULSE.maxLegendary || major)) return "legendary budget";
  return null;
}

export function weightOf(def: EventDefinition, state: SelectionState, c: EventContext): number {
  const history = state.history.filter((h) => h.eventId === def.id);
  const seen = history.filter((h) => h.seen).length;
  const novelty = seen === 0 ? 1.25 : seen === 1 ? 1 : seen === 2 ? 0.75 : 0.5;
  const recent = state.history.slice(-3).filter((h) => h.eventId === def.id).length;
  const repetition = recent ? Math.pow(0.65, recent) : 1;
  const biome = !def.allowedBiomes.length || def.allowedBiomes.includes(c.biome) ? 1 : 0;
  const age = c.worldAgeDays > def.minimumWorldAgeDays + 10 ? 1.1 : 1;
  const context = def.id === "meteor_large" && state.elapsedSeconds < state.meteorHintUntil ? 2 : 1;
  return Math.max(0, (state.weights[def.id] ?? def.baseWeight) * novelty * repetition * biome * age * context);
}

export function weightedPick<T>(items: T[], weights: number[], random: () => number): T | null {
  const sum = weights.reduce((a, b) => a + Math.max(0, b), 0);
  if (sum <= 0) return null;
  let point = random() * sum;
  for (let i = 0; i < items.length; i++) {
    point -= Math.max(0, weights[i] ?? 0);
    if (point < 0) return items[i]!;
  }
  return items.at(-1) ?? null;
}
