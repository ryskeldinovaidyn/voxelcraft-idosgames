import type { Game } from "../main";

export type EventId = "falling_star" | "meteor_large" | "animal_migration";
export type EventRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type EventCategory = "ambient" | "sky" | "weather" | "creature" | "npc" | "structure" | "world_anomaly" | "story";
export type EventIntensity = "ambient" | "major";
export type EventPhase = "pending" | "spawning" | "active" | "discovered" | "interacted" | "completed" | "expired" | "cancelled";
export type Position = [number, number, number];

export interface EventDefinition {
  id: EventId;
  telemetryPrefix: string;
  category: EventCategory;
  rarity: EventRarity;
  intensity: EventIntensity;
  enabled: boolean;
  baseWeight: number;
  cooldownGameDays: number;
  cooldownRealMinutes: number;
  maxOccurrences: number | null;
  minimumWorldAgeDays: number;
  minimumPlaytimeMinutes: number;
  allowedBiomes: string[];
  allowedWeather: string[];
  allowedTime: "any" | "night" | "day" | "twilight" | "day_or_twilight";
  outdoors: boolean;
  minimumDistanceFromBase: number;
  spawnDistance: [number, number];
  lifetime: number;
  duration: [number, number];
  conflicts: EventId[];
}

export interface EventContext {
  game: Game;
  worldAgeDays: number;
  playtimeMinutes: number;
  biome: string;
  weather: string;
  phase: number;
  outdoors: boolean;
  distanceFromBase: number;
  majorBossActive: boolean;
}

export interface EventInstance {
  id: EventId;
  instanceId: string;
  phase: EventPhase;
  position: Position;
  biome: string;
  seed: number;
  elapsed: number;
  duration: number;
  worldDay: number;
  data: Record<string, number | string | boolean>;
  seenSeconds: number;
  interacted: boolean;
}

export interface HistoryEntry {
  eventId: EventId;
  instanceId: string;
  worldDay: number;
  realTimestamp: number;
  position: Position;
  biome: string;
  phase: EventPhase;
  completed: boolean;
  interacted: boolean;
  seen: boolean;
  metadata: Record<string, number | string | boolean>;
}

export interface FragmentSite {
  id: string;
  position: Position;
  collected: boolean;
}

export interface WorldPulseSave {
  version: 1;
  elapsedSeconds: number;
  nextEvaluationAt: number;
  majorUntil: number;
  meteorHintUntil: number;
  serial: number;
  history: HistoryEntry[];
  active: EventInstance[];
  cooldowns: Record<string, { gameUntil: number; realUntil: number }>;
  weights: Record<string, number>;
  fragments: FragmentSite[];
  testMode: boolean;
  metrics: Record<string, number>;
}

export interface EventHandler {
  definition: EventDefinition;
  findSpawn(context: EventContext, random: () => number): Position | null;
  start(game: Game, instance: EventInstance): void;
  tick(game: Game, instance: EventInstance, dt: number): EventPhase | void;
  frame?(game: Game, instance: EventInstance, dt: number): void;
  onFrameClock?(dt: number): void;
  viewPositions?(game: Game, instance: EventInstance): Position[];
  takeTelemetry?(game: Game, instance: EventInstance, dt: number): string[];
  restore?(game: Game, instance: EventInstance): void;
  stop?(game: Game, instance: EventInstance): void;
}
