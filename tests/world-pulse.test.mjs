import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { DEFINITIONS } from "../src/modules/voxelcraft/world-pulse/config.ts";
import { eligible, weightOf, weightedPick } from "../src/modules/voxelcraft/world-pulse/logic.ts";
import { craterCells, findMeteorSite, hasModifiedBlocks } from "../src/modules/voxelcraft/world-pulse/Spawn.ts";
import { WorldEventDirector } from "../src/modules/voxelcraft/world-pulse/WorldEventDirector.ts";
import { ChunkManager } from "../src/modules/voxelcraft/world/ChunkManager.ts";
import { B } from "../src/modules/voxelcraft/registry/Blocks.ts";
import { ITEMS } from "../src/modules/voxelcraft/registry/Items.ts";
import { events } from "../src/modules/voxelcraft/core/EventBus.ts";
import { think } from "../src/modules/voxelcraft/entities/MobBrain.ts";

function fixture() {
  const player = { pos: new THREE.Vector3(0, 71, 0), eyePos: new THREE.Vector3(0, 72.6, 0), spawnPoint: new THREE.Vector3(0, 71, 0), dead: false, yaw: 0 };
  const world = {
    generator: { waterLevel: 60, heightAt: () => 70, biomeOf: () => "plains", structureAt: () => null, villagesNear: () => [] },
    chunks: new Map([["0,0", { generated: true, modified: new Map() }]]), pendingDiffs: new Map(), genQueue: [],
    chunkAt: (x, z) => Math.abs(x) < 16 && Math.abs(z) < 16 ? { generated: true } : null,
    getBlock: () => 0, surfaceY: () => 70,
  };
  const game = { player, world, dayNight: { cycleLength: 1200, phase: 0.7 }, weather: { kind: "clear" }, dimension: "overworld", playing: true,
    entities: { entities: new Map(), spawnDrop: () => {} }, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(75, 1, 0.1, 150), audio: { blip: () => {} } };
  const context = { game, worldAgeDays: 8, playtimeMinutes: 200, biome: "plains", weather: "clear", phase: 0.7, outdoors: true, distanceFromBase: 0 };
  const state = { elapsedSeconds: 9600, cooldowns: {}, history: [], active: [], weights: {}, majorUntil: 0, meteorHintUntil: 0 };
  return { game, context, state };
}

test("eligibility honors age, cooldown, occurrence and category budget", () => {
  const { context, state } = fixture();
  const meteor = DEFINITIONS.find((d) => d.id === "meteor_large");
  assert.equal(eligible(meteor, context, state, Date.now()), null);
  assert.equal(eligible(meteor, { ...context, worldAgeDays: 1 }, state, Date.now()), "world age");
  state.cooldowns.meteor_large = { gameUntil: 9601, realUntil: 0 };
  assert.equal(eligible(meteor, context, state, Date.now()), "cooldown");
  state.cooldowns = {};
  state.active.push({ id: "falling_star", data: { intensity: "major" } });
  assert.equal(eligible(meteor, context, state, Date.now()), "major budget");
  state.active = [];
  state.history = Array.from({ length: 3 }, (_, n) => ({ eventId: "meteor_large", instanceId: `${n}`, seen: false }));
  assert.equal(eligible(meteor, context, state, Date.now()), "max occurrences");
});

test("weights favor novelty and deterministic weighted selection", () => {
  const { context, state } = fixture();
  const star = DEFINITIONS.find((d) => d.id === "falling_star");
  const first = weightOf(star, state, context);
  state.history.push({ eventId: "falling_star", seen: true });
  assert.ok(weightOf(star, state, context) < first);
  assert.equal(weightedPick(["star", "meteor"], [100, 10], () => 0), "star");
  assert.equal(weightedPick(["star", "meteor"], [100, 10], () => 0.99), "meteor");
});

test("meteor resolver rejects edited terrain and crater yields persistent cells", () => {
  const { game, context } = fixture();
  const meteor = DEFINITIONS.find((d) => d.id === "meteor_large");
  const at = findMeteorSite(context, meteor, () => 0);
  assert.deepEqual(at, [350, 70, 0]);
  game.player.spawnPoint.set(350, 71, 0);
  assert.equal(findMeteorSite(context, meteor, () => 0), null, "base is protected");
  game.player.spawnPoint.set(0, 71, 0);
  const cells = craterCells(game.world, at, 123, 14, 5);
  assert.ok(cells.length > 50);
  assert.ok(cells.some(([x, y, z, id]) => x === 350 && z === 0 && y < 70));
  game.world.pendingDiffs.set("21,0", new Map([[14, [0, 0]]]));
  assert.equal(hasModifiedBlocks(game.world, 350, 0, 13), true);
  assert.equal(findMeteorSite(context, meteor, () => 0), null);
});

test("director stores completion, occurrence and cooldown through reload", () => {
  const { game } = fixture();
  const first = new WorldEventDirector(game);
  const before = game.scene.children.length;
  assert.match(first.command(["trigger", "falling_star"]), /Запущено/);
  assert.ok(game.scene.children.length > before, "star visual is mounted");
  first.tick(5, true);
  assert.equal(game.scene.children.length, before, "star visual is removed");
  const save = JSON.parse(JSON.stringify(first.serialize()));
  assert.equal(save.history.length, 1);
  assert.equal(save.history[0].completed, true);
  assert.ok(save.cooldowns.falling_star.realUntil > Date.now());
  first.dispose();
  const second = new WorldEventDirector(game);
  second.load(save);
  assert.equal(second.serialize().history.length, 1);
  assert.deepEqual(second.serialize().cooldowns, save.cooldowns);
  second.dispose();
});

test("evaluation runs on its timer, not during render frames", () => {
  const { game } = fixture();
  const director = new WorldEventDirector(game);
  director.nextEvaluationAt = 2;
  for (let n = 0; n < 60; n++) director.frame(1 / 60);
  assert.equal(director.serialize().metrics.evaluation, undefined);
  director.tick(1, true);
  assert.equal(director.serialize().metrics.evaluation, undefined);
  const random = Math.random;
  try { Math.random = () => 0; director.tick(1.1, true); }
  finally { Math.random = random; }
  assert.equal(director.serialize().metrics.evaluation, 1);
  assert.ok(director.serialize().nextEvaluationAt >= 90);
  director.dispose();
});

test("meteor writes unloaded chunk diffs, fragments and resumes without a second impact", () => {
  const { game } = fixture();
  const makeWorld = () => {
    const world = new ChunkManager(new THREE.Scene(), {}, { kind: "noise", seed: 42, gen: 2 });
    world.generator = { seed: 42, waterLevel: 60, heightAt: () => 70, biomeOf: () => "plains", structureAt: () => null, villagesNear: () => [], spawnHint: () => ({ x: 0, z: 0 }), generate: () => {} };
    return world;
  };
  game.world = makeWorld();
  const first = new WorldEventDirector(game);
  assert.match(first.command(["trigger", "meteor_large"]), /Запущено/);
  first.tick(10, true);
  const diffs = game.world.serializeDiffs();
  assert.ok(Object.values(diffs).flat().length > 50, "crater is recorded as chunk edits");
  const pulse = JSON.parse(JSON.stringify(first.serialize()));
  assert.ok(pulse.fragments.length >= 3 && pulse.fragments.length <= 8);
  assert.equal(pulse.active[0].data.craterDone, true);
  first.dispose();
  game.world = makeWorld();
  game.world.loadDiffs(diffs);
  const second = new WorldEventDirector(game);
  second.load(pulse);
  second.tick(10, true);
  assert.deepEqual(game.world.serializeDiffs(), diffs, "reload does not repeat the crater");
  assert.equal(ITEMS.meteor_fragment.tile, "iron_nugget");
  const dropped = [];
  game.entities.spawnDrop = (...args) => dropped.push(args);
  game.world.chunkAt = () => ({ generated: true });
  const site = pulse.fragments[0];
  game.player.pos.set(...site.position);
  second.tick(0.05, true);
  assert.ok(dropped.some((args) => args[3] === "meteor_fragment" && args[6]?.pulseFragmentId === site.id));
  events.emit("itemPickup", { item: "meteor_fragment", count: 1, tag: { pulseFragmentId: site.id } });
  assert.equal(second.serialize().fragments.find((f) => f.id === site.id).collected, true);
  second.tick(100, true);
  assert.equal(second.serialize().history[0].completed, true);
  second.dispose();
});

test("migration gives animals separate goals and releases them on completion", () => {
  const { game } = fixture();
  const entities = new Map();
  game.world.chunkAt = () => ({ generated: true, modified: new Map() });
  game.world.getBlock = (_x, y) => y === 70 ? B.grass : B.air;
  game.entities = {
    entities,
    spawnMob(type, x, y, z) {
      const mob = { id: entities.size + 1, kind: "mob", def: { name: type, walkSpeed: 2 }, pos: new THREE.Vector3(x, y, z), dead: false, leaveT: Infinity, migrationId: null, migrationTarget: null };
      entities.set(mob.id, mob);
      return mob;
    },
  };
  const director = new WorldEventDirector(game);
  assert.match(director.command(["trigger", "animal_migration"]), /Запущено/);
  const members = [...entities.values()];
  assert.ok(members.length >= 4);
  assert.ok(new Set(members.map((m) => m.migrationTarget.join(","))).size > 1);
  director.tick(200, true);
  assert.ok(members.every((m) => m.migrationId === null));
  assert.ok(members.every((m) => m.dead || m.leaveT === Infinity));
  director.dispose();
});

test("existing mob brain steers a migrating animal toward its own target", () => {
  const mob = { migrationTarget: [20, 0], hitByPlayerT: 0, tamed: false, pos: new THREE.Vector3(0, 71, 0), def: { walkSpeed: 2, flies: false }, state: "idle", id: 3, onGround: false, targetYaw: 0, speed: 0 };
  think(mob, { world: {} }, 0.05);
  assert.equal(mob.state, "wander");
  assert.ok(mob.speed > 0);
  assert.ok(mob.targetYaw < 0, "steers toward positive X in the game's yaw system");
});
