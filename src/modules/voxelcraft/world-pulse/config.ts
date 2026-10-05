import type { EventDefinition, EventRarity } from "./types";

export const RARITY_WEIGHTS: Record<EventRarity, number> = {
  common: 100, uncommon: 40, rare: 10, epic: 2, legendary: 0.2,
};

export const PULSE = {
  evaluationSeconds: [90, 150] as [number, number],
  technicalRetrySeconds: 20,
  evaluationChance: 0.45,
  maxAmbient: 2,
  maxMajor: 1,
  maxLegendary: 1,
  majorCooldownGameDays: 0.75,
  seenSeconds: 0.5,
  discoveryDistance: 30,
  fragmentSpawnDistance: 72,
  fallingStar: { angleDegrees: [30, 110], meteorHintChance: 0.03, trailCount: 8 },
  meteor: { diameter: [10, 18], depth: [3, 7], fragments: [3, 8], precursor: [2, 5], flyover: 3.2, smokeSeconds: 90, siteAttempts: 14, maxSlope: 7, safetyRadius: 13, shakeMin: 0.1, shakeMax: 0.5 },
  migration: { herdSize: [8, 30], lowFpsSize: 8, distance: [80, 160], travelDistance: 125, maxSeconds: 180, animals: ["sheep", "cow", "pig"] },
} as const;

export const DEFINITIONS: EventDefinition[] = [
  {
    id: "falling_star", telemetryPrefix: "falling_star", category: "sky", rarity: "common", intensity: "ambient", enabled: true,
    baseWeight: RARITY_WEIGHTS.common, cooldownGameDays: 0, cooldownRealMinutes: 4, maxOccurrences: null,
    minimumWorldAgeDays: 1, minimumPlaytimeMinutes: 15, allowedBiomes: [],
    allowedWeather: ["clear"], allowedTime: "night", outdoors: true,
    minimumDistanceFromBase: 0, spawnDistance: [70, 115], lifetime: 5,
    duration: [1.5, 4], conflicts: [],
  },
  {
    id: "meteor_large", telemetryPrefix: "meteor", category: "world_anomaly", rarity: "rare", intensity: "major", enabled: true,
    baseWeight: RARITY_WEIGHTS.rare, cooldownGameDays: 20, cooldownRealMinutes: 180, maxOccurrences: 3,
    minimumWorldAgeDays: 5, minimumPlaytimeMinutes: 0, allowedBiomes: [],
    allowedWeather: ["clear", "rain"], allowedTime: "any", outdoors: true,
    minimumDistanceFromBase: 250, spawnDistance: [350, 1200], lifetime: 100,
    duration: [95, 100], conflicts: [],
  },
  {
    id: "animal_migration", telemetryPrefix: "migration", category: "creature", rarity: "uncommon", intensity: "ambient", enabled: true,
    baseWeight: RARITY_WEIGHTS.uncommon, cooldownGameDays: 2, cooldownRealMinutes: 30, maxOccurrences: null,
    minimumWorldAgeDays: 1, minimumPlaytimeMinutes: 0,
    allowedBiomes: ["plains", "steppe", "savanna", "forest", "forest_edge", "meadow", "classic"],
    allowedWeather: ["clear", "rain"], allowedTime: "day_or_twilight", outdoors: true,
    minimumDistanceFromBase: 0, spawnDistance: [80, 160], lifetime: 180,
    duration: [100, 180], conflicts: [],
  },
];
