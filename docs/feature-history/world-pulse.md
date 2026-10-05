# World Pulse V1

## Architecture audit and integration

VoxelCraft already had a 20 TPS simulation loop (`main.ts`), a frame renderer, a single save snapshot, a per-world IndexedDB store, streamed chunks with pending block diffs, the entity/mob brain, a command console, synthesized audio, and a local event bus. World Pulse lives inside `src/modules/voxelcraft/world-pulse/` and reuses those systems. It does not create a second world clock, navigation engine, save store, or player-facing event UI.

The director is created once per `Game`, advances only when the host owns the overworld simulation, and evaluates events at a jittered 90–150 second interval. Handlers register in `registry.ts`. The director handles eligibility, weighted selection, budgets, cooldowns, lifecycle, history, local telemetry counters, and save data; handlers own spawn logic and runtime effects. A new handler needs a definition and one registry entry. `test mode` reduces the evaluation interval to eight seconds and bypasses age/playtime/cooldowns, while retaining terrain safety checks.

`SaveData.worldPulse` is optional so pre-V1 saves load unchanged. It stores the clock, next evaluation, history, active instances and seeds, cooldowns, occurrence evidence, weight overrides, fragment sites, and metrics. Debug test mode is deliberately session-only on reload. The crater itself lives in ordinary `ChunkDiffMap`: `applyRemoteBlock` writes loaded chunks or pending diffs, and the existing save includes both. Active migration animals carry a migration id and target through entity serialization. Active sky visuals are rebuilt from saved instance data after loading or returning from another dimension.

The meteor resolver rejects sea, steep terrain, known structures/villages, player spawn proximity, and any modified block in a safety radius. It checks again at impact. It uses the deterministic generator's height function to sample unloaded terrain, then writes the crater as pending diffs. This avoids loading 350–1200 block distant chunks. Natural structures that a generator does not expose through `structureAt` or `villagesNear` cannot be identified without preview-generating all target chunks; this is the remaining terrain safety limit.

The migration handler spawns existing passive mobs just beyond the direct view. Each has an individual target, while the existing `MobBrain` and collision code steer, avoid edges, and jump obstacles. The handler scales herd size by measured frame rate, removes members when they travel away, and releases any animals still close to the player as ordinary mobs when the event ends.

## Developer commands

`/event list`, `/event eligible`, `/event trigger falling_star`, `/event trigger meteor_large`, `/event trigger animal_migration`, `/event cancel all`, `/event history`, `/event cooldown`, `/event cooldown reset`, `/event setweight meteor_large 100`, `/event test on|off`, `/event overlay on|off`, `/event metrics`.

The overlay appears only in test mode or after the explicit overlay command. Regular players receive no event announcement, rarity label, countdown, map marker, or quest arrow.

## Validation

`npm run test:world-pulse` covers eligibility, budget, cooldown, max occurrences, weight selection, protected meteor terrain, crater cell creation, pending diffs and reload without a repeated impact, star visual cleanup, migration goals/cleanup, and director save/load. `npm run typecheck` and `npm run build` pass. The local browser preview was reloaded, `/event list` showed all three registrations, the overlay toggle worked, and the browser reported no console errors.

World Pulse emits local `worldPulseTelemetry` events and keeps per-action counters in the world save. The project currently has no analytics upload pipeline; these events can be forwarded by a future platform analytics integration without changing event handlers. Multiplayer V1 is host-authoritative for scheduling and persistence; network replication of event visuals and delayed crater edits remains future work.
