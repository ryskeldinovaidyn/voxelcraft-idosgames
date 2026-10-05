import * as THREE from "three";
import { PULSE } from "./config";
import { eligible, weightOf, weightedPick, type SelectionState } from "./logic";
import { biomeAt, isOutdoors } from "./Spawn";
import { worldPulseHandlers } from "./registry";
import { DebugOverlay } from "./DebugOverlay";
import { events } from "../core/EventBus";
import type { Game } from "../main";
import type { EventContext, EventHandler, EventId, EventInstance, EventPhase, FragmentSite, HistoryEntry, Position, WorldPulseSave } from "./types";

const FINAL = new Set<EventPhase>(["completed", "expired", "cancelled"]);
const finite = (v: unknown, fallback = 0): number => typeof v === "number" && Number.isFinite(v) ? v : fallback;
const positionOf = (v: unknown): v is Position => Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number" && Number.isFinite(n));

export class WorldEventDirector {
  readonly handlers = new Map<EventId, EventHandler>();
  private active: EventInstance[] = [];
  private history: HistoryEntry[] = [];
  private fragments: FragmentSite[] = [];
  private cooldowns: Record<string, { gameUntil: number; realUntil: number }> = {};
  private weights: Record<string, number> = {};
  private elapsedSeconds = 0;
  private nextEvaluationAt = 90 + Math.random() * 60;
  private majorUntil = 0;
  private meteorHintUntil = 0;
  private serial = 0;
  private testMode = false;
  private overlayEnabled = false;
  private overlayTime = 0;
  private overlay = new DebugOverlay();
  private metrics: Record<string, number> = {};
  private readonly projected = new THREE.Vector3();

  constructor(private game: Game) {
    for (const handler of worldPulseHandlers((sites) => this.fragments.push(...sites))) this.register(handler);
    events.on("itemPickup", (payload: { item?: string; tag?: Record<string, unknown> }) => {
      if (payload.item !== "meteor_fragment") return;
      const id = payload.tag?.pulseFragmentId;
      if (typeof id !== "string") return;
      const site = this.fragments.find((f) => f.id === id);
      if (site) site.collected = true;
      const instanceId = id.split(":").slice(0, -1).join(":");
      const h = this.history.find((entry) => entry.instanceId === instanceId);
      if (h) { h.interacted = true; h.phase = "interacted"; }
      const a = this.active.find((entry) => entry.instanceId === instanceId);
      if (a) { a.interacted = true; a.phase = "interacted"; }
      this.telemetry("world_event_interacted", "meteor_large", instanceId);
      this.telemetry("meteor_fragment_collected", "meteor_large", instanceId);
    });
    events.on("mobHurt", (payload: { entity?: { migrationId?: string | null } }) => {
      const instanceId = payload.entity?.migrationId;
      if (!instanceId) return;
      const active = this.active.find((a) => a.instanceId === instanceId);
      if (active) this.telemetry("migration_attacked", active.id, instanceId);
    });
  }

  register(handler: EventHandler): void {
    if (this.handlers.has(handler.definition.id)) throw new Error(`World Pulse: duplicate ${handler.definition.id}`);
    this.handlers.set(handler.definition.id, handler);
  }

  private state(): SelectionState {
    return { elapsedSeconds: this.elapsedSeconds, cooldowns: this.cooldowns, history: this.history.filter((h) => h.phase !== "cancelled"), active: this.active, weights: this.weights, majorUntil: this.majorUntil, meteorHintUntil: this.meteorHintUntil };
  }

  private context(): EventContext {
    const g = this.game, p = g.player.pos, base = g.player.spawnPoint;
    const cycle = g.dayNight.cycleLength;
    return {
      game: g,
      worldAgeDays: this.elapsedSeconds / cycle,
      playtimeMinutes: this.elapsedSeconds / 60,
      biome: biomeAt(g.world, Math.floor(p.x), Math.floor(p.z)),
      weather: g.weather.kind,
      phase: g.dayNight.phase,
      outdoors: isOutdoors(g.world, p.x, p.y, p.z),
      distanceFromBase: Math.hypot(p.x - base.x, p.z - base.z),
      majorBossActive: [...g.entities.entities.values()].some((e) => e.kind === "mob" && !!e.def.boss && !e.dead),
    };
  }

  private randomInterval(): number {
    const [low, high] = PULSE.evaluationSeconds;
    return this.testMode ? 8 : low + Math.random() * (high - low);
  }

  tick(dt: number, authoritative: boolean): void {
    if (!authoritative || this.game.dimension !== "overworld") return;
    this.elapsedSeconds += dt;
    for (const instance of [...this.active]) {
      instance.elapsed += dt;
      const handler = this.handlers.get(instance.id)!;
      const result = handler.tick(this.game, instance, dt);
      for (const action of handler.takeTelemetry?.(this.game, instance, dt) ?? [])
        this.telemetry(action, instance.id, instance.instanceId);
      if (result && FINAL.has(result)) this.finish(instance, result);
      else if (instance.elapsed > handler.definition.lifetime) this.finish(instance, "expired");
    }
    this.materializeFragments();
    this.discoverCrater();
    if (this.overlayEnabled || this.testMode) {
      this.overlayTime += dt;
      if (this.overlayTime >= 1) { this.overlayTime = 0; this.updateOverlay(); }
    }
    if (this.elapsedSeconds < this.nextEvaluationAt) return;
    this.nextEvaluationAt = this.elapsedSeconds + this.randomInterval();
    if (this.game.player.dead || !this.game.playing || this.game.world.genQueue.length > 60) return;
    if (Math.random() > (this.testMode ? 1 : PULSE.evaluationChance)) return;
    this.telemetry("evaluation", null);
    this.evaluate();
  }

  private candidates(context: EventContext): { handler: EventHandler; weight: number; reason: string | null }[] {
    const state = this.state(), now = Date.now();
    if (this.testMode) {
      state.cooldowns = {};
      state.majorUntil = 0;
      state.weights = { ...state.weights };
      for (const handler of this.handlers.values())
        if (handler.definition.rarity !== "common")
          state.weights[handler.definition.id] = Math.max(100, state.weights[handler.definition.id] ?? handler.definition.baseWeight);
      context = { ...context, worldAgeDays: Math.max(context.worldAgeDays, 100), playtimeMinutes: Math.max(context.playtimeMinutes, 1000) };
    }
    return [...this.handlers.values()].map((handler) => {
      const reason = eligible(handler.definition, context, state, now);
      const weight = reason ? 0 : weightOf(handler.definition, state, context);
      return { handler, weight, reason };
    });
  }

  evaluate(): boolean {
    const context = this.context();
    const allowed = this.candidates(context).filter((e) => !e.reason && e.weight > 0);
    this.metrics.eligible_candidates = (this.metrics.eligible_candidates ?? 0) + allowed.length;
    if (!allowed.length) return false;
    const picked = weightedPick(allowed, allowed.map((e) => e.weight), Math.random);
    if (!picked) return false;
    return this.start(picked.handler, context, false);
  }

  private start(handler: EventHandler, context: EventContext, force: boolean): boolean {
    const def = handler.definition;
    if (!force && this.candidates(context).find((c) => c.handler === handler)?.reason) return false;
    if (force) {
      const state = this.state();
      if (state.active.some((a) => a.id === def.id)) return false;
      if (def.intensity === "major" && state.active.some((a) => this.handlers.get(a.id)?.definition.intensity === "major")) return false;
    }
    const spawn = handler.findSpawn(context, Math.random);
    if (!spawn || !positionOf(spawn)) {
      this.telemetry("spawn_failed", def.id);
      this.nextEvaluationAt = Math.min(this.nextEvaluationAt, this.elapsedSeconds + PULSE.technicalRetrySeconds);
      return false;
    }
    const instance: EventInstance = {
      id: def.id, instanceId: `${def.id}:${++this.serial}`, phase: "spawning", position: spawn,
      biome: biomeAt(this.game.world, Math.floor(spawn[0]), Math.floor(spawn[2])),
      seed: Math.floor(Math.random() * 0xffffffff), elapsed: 0,
      duration: def.duration[0] + Math.random() * (def.duration[1] - def.duration[0]),
      worldDay: context.worldAgeDays, data: { legendary: def.rarity === "legendary", intensity: def.intensity }, seenSeconds: 0, interacted: false,
    };
    this.active.push(instance);
    try { handler.start(this.game, instance); }
    catch (error) { this.active = this.active.filter((a) => a !== instance); handler.stop?.(this.game, instance); console.error("World Pulse event start", error); return false; }
    if (instance.data.failed) { this.finish(instance, "cancelled"); return false; }
    this.history.push({
      eventId: def.id, instanceId: instance.instanceId, worldDay: context.worldAgeDays,
      realTimestamp: Date.now(), position: [...spawn], biome: instance.biome, phase: "active",
      completed: false, interacted: false, seen: false, metadata: { ...instance.data },
    });
    instance.phase = "active";
    this.telemetry("world_event_triggered", def.id, instance.instanceId);
    this.telemetry(`${def.telemetryPrefix}_triggered`, def.id, instance.instanceId);
    return true;
  }

  private finish(instance: EventInstance, phase: EventPhase): void {
    this.handlers.get(instance.id)?.stop?.(this.game, instance);
    this.active = this.active.filter((a) => a !== instance);
    instance.phase = phase;
    const h = this.history.find((entry) => entry.instanceId === instance.instanceId);
    if (h) {
      h.phase = phase; h.completed = phase === "completed"; h.interacted ||= instance.interacted;
      h.seen ||= instance.seenSeconds >= PULSE.seenSeconds; h.metadata = { ...instance.data };
    }
    if (phase !== "cancelled") {
      const d = this.handlers.get(instance.id)!.definition;
      this.cooldowns[d.id] = { gameUntil: this.elapsedSeconds + d.cooldownGameDays * this.game.dayNight.cycleLength, realUntil: Date.now() + d.cooldownRealMinutes * 60000 };
      if (d.intensity === "major") this.majorUntil = this.elapsedSeconds + PULSE.majorCooldownGameDays * this.game.dayNight.cycleLength;
      if (instance.id === "falling_star" && instance.data.potentialMeteor)
        this.meteorHintUntil = this.elapsedSeconds + this.game.dayNight.cycleLength * 0.25;
    }
    this.telemetry(`world_event_${phase}`, instance.id, instance.instanceId);
  }

  frame(dt: number): void {
    for (const handler of this.handlers.values()) handler.onFrameClock?.(dt);
    if (this.game.dimension !== "overworld") return;
    for (const instance of this.active) {
      const h = this.handlers.get(instance.id)!;
      h.frame?.(this.game, instance, dt);
      const views = h.viewPositions?.(this.game, instance) ?? [instance.position];
      if (views.some((pos) => this.isVisible(pos))) {
        instance.seenSeconds += dt;
        const entry = this.history.find((e) => e.instanceId === instance.instanceId);
        if (entry && instance.seenSeconds >= PULSE.seenSeconds && !entry.seen) {
          entry.seen = true;
          this.telemetry("world_event_seen", instance.id, instance.instanceId);
          this.telemetry(`${h.definition.telemetryPrefix}_seen`, instance.id, instance.instanceId);
        }
      }
    }
  }

  private isVisible(pos: Position): boolean {
    const camera = this.game.camera;
    const d = camera.position.distanceTo(new THREE.Vector3(...pos));
    if (d > camera.far || d < camera.near) return false;
    this.projected.set(...pos).project(camera);
    return this.projected.z >= -1 && this.projected.z <= 1 && Math.abs(this.projected.x) <= 1 && Math.abs(this.projected.y) <= 1;
  }

  private materializeFragments(): void {
    const p = this.game.player.pos;
    for (const site of this.fragments) {
      if (site.collected || Math.hypot(site.position[0] - p.x, site.position[2] - p.z) > PULSE.fragmentSpawnDistance) continue;
      if (!this.game.world.chunkAt(site.position[0], site.position[2])?.generated) continue;
      const exists = [...this.game.entities.entities.values()].some((e) => e.kind === "drop" && e.tag?.pulseFragmentId === site.id && !e.dead);
      if (!exists) this.game.entities.spawnDrop(...site.position, "meteor_fragment", 1, undefined, { pulseFragmentId: site.id });
    }
  }

  private discoverCrater(): void {
    const p = this.game.player.pos;
    for (const h of this.history) {
      if (h.eventId !== "meteor_large" || h.phase === "cancelled" || h.phase === "discovered" || h.phase === "interacted") continue;
      const active = this.active.find((a) => a.instanceId === h.instanceId);
      if (!(active?.data.craterDone || h.metadata.craterDone)) continue;
      if (Math.hypot(h.position[0] - p.x, h.position[2] - p.z) < PULSE.discoveryDistance) {
        h.phase = "discovered";
        this.telemetry("world_event_discovered", h.eventId, h.instanceId);
        this.telemetry("meteor_crater_discovered", h.eventId, h.instanceId);
      }
    }
  }

  command(args: string[]): string {
    const [op, arg, value] = args;
    if (op === "list") return [...this.handlers.values()].map((h) => `${h.definition.id} [${h.definition.rarity}, ${h.definition.intensity}] weight=${this.weights[h.definition.id] ?? h.definition.baseWeight}`).join("; ");
    if (op === "eligible") return this.candidates(this.context()).map((e) => `${e.handler.definition.id}: ${e.reason ?? `eligible (${e.weight.toFixed(1)})`}`).join("; ");
    if (op === "trigger") {
      const handler = this.handlers.get(arg as EventId);
      if (!handler) throw new Error("/event trigger falling_star|meteor_large|animal_migration");
      return this.start(handler, this.context(), true) ? `Запущено: ${arg}` : `Не удалось безопасно запустить ${arg}`;
    }
    if (op === "cancel" && arg === "all") { for (const a of [...this.active]) this.finish(a, "cancelled"); return "Активные события отменены"; }
    if (op === "history") return this.history.slice(-12).map((h) => `${h.eventId} #${h.instanceId} day ${h.worldDay.toFixed(1)} @${h.position.map(Math.round).join(",")} ${h.phase}${h.seen ? " seen" : ""}`).join("; ") || "История пуста";
    if (op === "cooldown" && arg === "reset") { this.cooldowns = {}; this.majorUntil = 0; return "Cooldown сброшен"; }
    if (op === "cooldown") return [...this.handlers.keys()].map((id) => `${id}: ${Math.max(0, Math.ceil((this.cooldowns[id]?.gameUntil ?? 0) - this.elapsedSeconds))} game s / ${Math.max(0, Math.ceil(((this.cooldowns[id]?.realUntil ?? 0) - Date.now()) / 60_000))} real min`).join("; ");
    if (op === "setweight" && this.handlers.has(arg as EventId) && Number.isFinite(Number(value)) && Number(value) >= 0) { this.weights[arg!] = Number(value); return `${arg}: weight=${value}`; }
    if (op === "test" && (arg === "on" || arg === "off")) { this.testMode = arg === "on"; this.nextEvaluationAt = this.elapsedSeconds + this.randomInterval(); this.syncOverlay(); return `Test mode: ${arg}`; }
    if (op === "overlay" && (arg === "on" || arg === "off")) { this.overlayEnabled = arg === "on"; this.syncOverlay(); return `Debug overlay: ${arg}`; }
    if (op === "metrics") return Object.entries(this.metrics).map(([k, v]) => `${k}=${v}`).join("; ") || "Метрик пока нет";
    throw new Error("/event list|eligible|trigger <id>|cancel all|history|cooldown [reset]|setweight <id> <n>|test on|off|overlay on|off|metrics");
  }

  private telemetry(action: string, eventId: EventId | null, instanceId?: string): void {
    const key = eventId ? `${eventId}.${action}` : action;
    this.metrics[key] = (this.metrics[key] ?? 0) + 1;
    const entry = this.history.find((h) => h.instanceId === instanceId);
    const at = entry?.position;
    const p = this.game.player.pos;
    events.emit("worldPulseTelemetry", {
      action,
      event_id: eventId,
      instance_id: instanceId,
      world_id: this.game.worldId,
      world_day: this.elapsedSeconds / this.game.dayNight.cycleLength,
      player_playtime_minutes: this.elapsedSeconds / 60,
      biome: entry?.biome ?? this.context().biome,
      distance_from_player: at ? Math.hypot(at[0] - p.x, at[2] - p.z) : 0,
      occurrence_number: eventId ? this.history.filter((h) => h.eventId === eventId && h.phase !== "cancelled").length : 0,
    });
  }

  private syncOverlay(): void {
    if (this.overlayEnabled || this.testMode) { this.overlay.show(); this.updateOverlay(); }
    else this.overlay.hide();
  }

  private updateOverlay(): void {
    const eligibleCount = this.candidates(this.context()).filter((c) => !c.reason).length;
    const ambient = this.active.filter((a) => a.data.intensity === "ambient").length;
    const major = this.active.filter((a) => a.data.intensity === "major").length;
    const meteor = this.cooldowns.meteor_large;
    const cool = meteor ? Math.max(0, (meteor.gameUntil - this.elapsedSeconds) / this.game.dayNight.cycleLength).toFixed(1) : "0";
    this.overlay.update(["World Pulse: ON" + (this.testMode ? " [TEST]" : ""), `Next evaluation: ${Math.max(0, Math.ceil(this.nextEvaluationAt - this.elapsedSeconds))}s`, `Eligible events: ${eligibleCount}`, `Ambient slots: ${ambient}/${PULSE.maxAmbient}`, `Major slots: ${major}/${PULSE.maxMajor}`, `Last event: ${this.history.at(-1)?.eventId ?? "none"}`, `Meteor cooldown: ${cool} days`]);
  }

  serialize(): WorldPulseSave {
    return { version: 1, elapsedSeconds: this.elapsedSeconds, nextEvaluationAt: this.nextEvaluationAt,
      majorUntil: this.majorUntil, meteorHintUntil: this.meteorHintUntil, serial: this.serial, history: this.history.map((h) => ({ ...h, position: [...h.position], metadata: { ...h.metadata } })),
      active: this.active.map((a) => ({ ...a, position: [...a.position], data: { ...a.data } })),
      cooldowns: { ...this.cooldowns }, weights: { ...this.weights },
      fragments: this.fragments.map((f) => ({ ...f, position: [...f.position] })), testMode: this.testMode, metrics: { ...this.metrics } };
  }

  load(raw: unknown): void {
    this.disposeVisuals();
    this.active = []; this.history = []; this.fragments = []; this.cooldowns = {}; this.weights = {};
    this.elapsedSeconds = 0; this.serial = 0; this.majorUntil = 0; this.meteorHintUntil = 0; this.testMode = false; this.metrics = {};
    this.nextEvaluationAt = this.randomInterval();
    if (!raw || typeof raw !== "object") { this.syncOverlay(); return; }
    const data = raw as Partial<WorldPulseSave>;
    if (data.version !== 1) { this.syncOverlay(); return; }
    this.elapsedSeconds = Math.max(0, finite(data.elapsedSeconds));
    this.nextEvaluationAt = Math.max(this.elapsedSeconds, finite(data.nextEvaluationAt, this.elapsedSeconds + this.randomInterval()));
    this.majorUntil = Math.max(0, finite(data.majorUntil));
    this.meteorHintUntil = Math.max(0, finite(data.meteorHintUntil));
    this.serial = Math.max(0, Math.floor(finite(data.serial)));
    // Developer test mode is session-only: imported/shared saves never expose debug UI to players.
    this.testMode = false;
    if (data.metrics && typeof data.metrics === "object")
      for (const [key, value] of Object.entries(data.metrics)) if (Number.isFinite(value) && value >= 0) this.metrics[key] = value;
    if (data.cooldowns && typeof data.cooldowns === "object")
      for (const id of this.handlers.keys()) {
        const c = data.cooldowns[id];
        if (c) this.cooldowns[id] = { gameUntil: Math.max(0, finite(c.gameUntil)), realUntil: Math.max(0, finite(c.realUntil)) };
      }
    if (data.weights && typeof data.weights === "object")
      for (const id of this.handlers.keys()) if (Number.isFinite(data.weights[id]) && data.weights[id]! >= 0) this.weights[id] = data.weights[id]!;
    if (Array.isArray(data.history)) this.history = data.history.filter((h): h is HistoryEntry => !!h && this.handlers.has(h.eventId) && typeof h.instanceId === "string" && positionOf(h.position)).slice(-1000).map((h) => ({
      ...h,
      worldDay: Math.max(0, finite(h.worldDay)), realTimestamp: Math.max(0, finite(h.realTimestamp)),
      biome: typeof h.biome === "string" ? h.biome : "unknown",
      phase: typeof h.phase === "string" ? h.phase : "completed",
      completed: h.completed === true, interacted: h.interacted === true, seen: h.seen === true,
      metadata: h.metadata && typeof h.metadata === "object" && !Array.isArray(h.metadata) ? h.metadata : {},
    }));
    if (Array.isArray(data.fragments)) this.fragments = data.fragments.filter((f): f is FragmentSite => !!f && typeof f.id === "string" && positionOf(f.position)).slice(-1000);
    if (Array.isArray(data.active)) for (const a of data.active) {
      if (!a || !this.handlers.has(a.id) || !positionOf(a.position) || typeof a.instanceId !== "string") continue;
      const instance: EventInstance = { ...a, seed: finite(a.seed), worldDay: Math.max(0, finite(a.worldDay)), biome: typeof a.biome === "string" ? a.biome : "unknown", phase: typeof a.phase === "string" ? a.phase : "active", elapsed: Math.max(0, finite(a.elapsed)), duration: Math.max(1, finite(a.duration, this.handlers.get(a.id)!.definition.duration[1])), seenSeconds: Math.max(0, finite(a.seenSeconds)), interacted: a.interacted === true, data: a.data && typeof a.data === "object" && !Array.isArray(a.data) ? a.data : {} };
      this.active.push(instance);
      if (this.game.dimension === "overworld") this.handlers.get(instance.id)?.restore?.(this.game, instance);
    }
    for (const id of [...this.history.map((h) => h.instanceId), ...this.active.map((a) => a.instanceId)]) {
      const n = Number(id.slice(id.lastIndexOf(":") + 1));
      if (Number.isSafeInteger(n) && n > this.serial) this.serial = n;
    }
    this.syncOverlay();
  }

  private disposeVisuals(): void {
    for (const instance of this.active) if (instance.id !== "animal_migration") this.handlers.get(instance.id)?.stop?.(this.game, instance);
  }

  dimensionChanged(): void {
    if (this.game.dimension === "overworld") {
      for (const instance of this.active) this.handlers.get(instance.id)?.restore?.(this.game, instance);
    } else this.disposeVisuals();
  }

  dispose(): void { this.disposeVisuals(); this.active = []; this.overlay.hide(); }
}
