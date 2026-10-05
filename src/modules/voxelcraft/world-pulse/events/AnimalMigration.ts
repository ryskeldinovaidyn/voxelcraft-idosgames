import { PULSE, DEFINITIONS } from "../config";
import { isSafeAnimalSpot } from "../Spawn";
import type { EventContext, EventHandler, EventInstance, EventPhase, Position } from "../types";
import type { Game } from "../../main";

export class AnimalMigration implements EventHandler {
  definition = DEFINITIONS[2]!;
  private fps = 60;

  onFrameClock(dt: number): void {
    if (dt > 0) this.fps = this.fps * 0.97 + Math.min(120, 1 / dt) * 0.03;
  }

  findSpawn(c: EventContext, random: () => number): Position | null {
    const { game } = c, p = game.player.pos;
    for (let n = 0; n < 36; n++) {
      const distance = this.definition.spawnDistance[0] + random() * (this.definition.spawnDistance[1] - this.definition.spawnDistance[0]);
      const angle = random() * Math.PI * 2;
      const x = Math.floor(p.x + Math.cos(angle) * distance);
      const z = Math.floor(p.z + Math.sin(angle) * distance);
      const forward = [-Math.sin(game.player.yaw), -Math.cos(game.player.yaw)];
      if ((x - p.x) * forward[0]! + (z - p.z) * forward[1]! > distance * 0.3) continue;
      const y = isSafeAnimalSpot(game.world, x, z);
      if (y !== null) return [x, y, z];
    }
    return null;
  }

  start(game: Game, instance: EventInstance): void {
    const [x, , z] = instance.position;
    const towardX = game.player.pos.x - x, towardZ = game.player.pos.z - z;
    const length = Math.hypot(towardX, towardZ) || 1;
    const dx = towardX / length, dz = towardZ / length;
    const nx = -dz, nz = dx;
    const scale = Math.max(0, Math.min(1, (this.fps - 25) / 35));
    const size = Math.round(PULSE.migration.lowFpsSize + (PULSE.migration.herdSize[1] - PULSE.migration.lowFpsSize) * scale * Math.random());
    const species = PULSE.migration.animals[Math.floor(Math.random() * PULSE.migration.animals.length)]!;
    let spawned = 0;
    for (let i = 0; i < size; i++) {
      const along = Math.floor(Math.random() * 13 - 6);
      const across = Math.floor(Math.random() * 13 - 6);
      const sx = Math.floor(x + dx * along + nx * across);
      const sz = Math.floor(z + dz * along + nz * across);
      const sy = isSafeAnimalSpot(game.world, sx, sz);
      if (sy === null) continue;
      const mob = game.entities.spawnMob(species, sx + 0.5, sy, sz + 0.5);
      mob.migrationId = instance.instanceId;
      mob.migrationTarget = [
        x + dx * PULSE.migration.travelDistance + nx * (across + Math.random() * 7 - 3),
        z + dz * PULSE.migration.travelDistance + nz * (across + Math.random() * 7 - 3),
      ];
      mob.leaveT = PULSE.migration.maxSeconds;
      spawned++;
    }
    instance.data.species = species;
    instance.data.herdSize = spawned;
    instance.data.destinationX = x + dx * PULSE.migration.travelDistance;
    instance.data.destinationZ = z + dz * PULSE.migration.travelDistance;
    if (spawned < 4) instance.data.failed = true;
  }

  tick(game: Game, instance: EventInstance): EventPhase | void {
    if (instance.data.failed) return "cancelled";
    const members = [...game.entities.entities.values()].filter((e) => e.kind === "mob" && e.migrationId === instance.instanceId && !e.dead);
    if (!members.length) return "completed";
    for (const m of members) {
      if (m.kind !== "mob") continue;
      const target = m.migrationTarget;
      if (!target) continue;
      const reached = Math.hypot(m.pos.x - target[0], m.pos.z - target[1]) < 8;
      const far = Math.hypot(m.pos.x - game.player.pos.x, m.pos.z - game.player.pos.z) > 105;
      if (reached && far) m.dead = true;
    }
    if (instance.elapsed >= instance.duration) return "completed";
  }

  takeTelemetry(game: Game, instance: EventInstance, dt: number): string[] {
    if (instance.data.followed) return [];
    const nearby = [...game.entities.entities.values()].some((e) => e.kind === "mob" && e.migrationId === instance.instanceId && !e.dead && Math.hypot(e.pos.x - game.player.pos.x, e.pos.z - game.player.pos.z) < 22);
    instance.data.followSeconds = Math.max(0, Number(instance.data.followSeconds || 0) + (nearby ? dt : -2 * dt));
    if (Number(instance.data.followSeconds) < 10) return [];
    instance.data.followed = true;
    return ["migration_followed"];
  }

  viewPositions(game: Game, instance: EventInstance): Position[] {
    return [...game.entities.entities.values()]
      .filter((e) => e.kind === "mob" && e.migrationId === instance.instanceId && !e.dead)
      .slice(0, 20)
      .map((m) => [m.pos.x, m.pos.y + 1, m.pos.z]);
  }

  stop(game: Game, instance: EventInstance): void {
    for (const e of game.entities.entities.values()) {
      if (e.kind !== "mob" || e.migrationId !== instance.instanceId) continue;
      // Рядом со зрителем звери остаются обычными животными; вдали удаляются без дропа.
      if (Math.hypot(e.pos.x - game.player.pos.x, e.pos.z - game.player.pos.z) > 55) e.dead = true;
      e.migrationId = null;
      e.migrationTarget = null;
      e.leaveT = Infinity;
    }
  }
}
