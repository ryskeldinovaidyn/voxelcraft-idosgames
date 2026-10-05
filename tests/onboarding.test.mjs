import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { events } from "../src/modules/voxelcraft/core/EventBus.ts";
import { CraftingGrid } from "../src/modules/voxelcraft/systems/Crafting.ts";
import { Inventory } from "../src/modules/voxelcraft/systems/Inventory.ts";
import { InventoryUI } from "../src/modules/voxelcraft/ui/InventoryUI.ts";
import { OnboardingDirector } from "../src/modules/voxelcraft/onboarding/OnboardingDirector.ts";
import { ensureStarterResourceZone, nearestStarterWood } from "../src/modules/voxelcraft/onboarding/StarterResourceZone.ts";
import { B } from "../src/modules/voxelcraft/registry/Blocks.ts";

function fixture(storage = new Map()) {
  events.clear();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  const classes = new Set();
  const hint = { textContent: "", classList: { add: (key) => classes.add(key), remove: (key) => classes.delete(key) } };
  const guideClasses = new Set(["hidden"]);
  const guide = { classList: { add: (key) => guideClasses.add(key), remove: (key) => guideClasses.delete(key) } };
  const progress = { textContent: "" }, title = { textContent: "" }, action = { textContent: "" };
  const elements = { tutorialHint: hint, tutorialGuide: guide, tutorialGuideProgress: progress, tutorialGuideTitle: title, tutorialGuideAction: action };
  globalThis.document = { getElementById: (id) => elements[id] ?? null };
  const inventory = new Inventory();
  const game = {
    inventory,
    player: { pos: new THREE.Vector3(0, 71, 0), mode: "survival", dead: false },
    world: { getBlock: () => B.air, chunkAt: () => null, surfaceY: () => 70 },
    scene: new THREE.Scene(),
    entities: { beginnerCombat: false },
    input: { uiOpen: false }, invUI: { open: false },
    interaction: { target: null, targetEntity: null },
    dayNight: { phase: 0.2 }, achievements: { serialize: () => [] },
    playing: true, dimension: "overworld", net: null, touch: null,
  };
  return { game, hint, guideClasses, progress, title, action, storage };
}

test("persistent in-game guide follows resources, crafting, equipment and can be turned off", () => {
  const { game, guideClasses, title, action } = fixture();
  const director = new OnboardingDirector(game);
  director.load();
  director.tick(5);
  assert.equal(title.textContent, "Осмотрись и пройдись");
  assert.equal(guideClasses.has("hidden"), false);
  game.invUI.open = true;
  director.tick(1);
  assert.equal(guideClasses.has("hidden"), true, "inventory uses its own recipe card");
  game.invUI.open = false;
  game.player.pos.x = 5;
  director.tick(1);
  assert.equal(title.textContent, "Добудь бревно");
  game.inventory.add("oak_log", 1);
  director.tick(1);
  assert.equal(title.textContent, "Открой инвентарь");
  events.emit("ui:inventoryOpened", { kind: "inventory" });
  director.tick(1);
  assert.equal(title.textContent, "Сделай доски");
  assert.match(action.textContent, /сетк/);
  game.inventory.add("planks", 4);
  director.tick(1);
  assert.equal(title.textContent, "Сделай палку");
  game.inventory.add("stick", 1);
  director.tick(1);
  assert.equal(title.textContent, "Создай деревянный меч");
  events.emit("craft", { item: "wooden_sword" });
  game.inventory.setSlot(1, { item: "wooden_sword", count: 1 });
  director.tick(1);
  assert.equal(title.textContent, "Возьми меч в руку");
  game.inventory.selectSlot(1);
  director.tick(1);
  assert.equal(title.textContent, "Первый бой");
  director.setMode("off");
  assert.equal(guideClasses.has("hidden"), true);
  director.dispose();
});

test("one log is enough for the 2×2 first sword recipe", () => {
  const grid = new CraftingGrid(2);
  grid.slots = [{ item: "oak_log", count: 1 }, null, null, null];
  assert.deepEqual(grid.takeResult(), { item: "planks", count: 4 });
  grid.slots = [{ item: "planks", count: 2 }, null, { item: "planks", count: 1 }, null];
  assert.deepEqual(grid.takeResult(), { item: "stick", count: 4 });
  grid.slots = [{ item: "planks", count: 1 }, { item: "stick", count: 1 }, { item: "planks", count: 1 }, null];
  assert.deepEqual(grid.takeResult(), { item: "wooden_sword", count: 1 });
});

test("new player progress follows actual pickups, crafting, equipment, combat and shelter", () => {
  const { game } = fixture();
  const director = new OnboardingDirector(game);
  director.load();
  assert.equal(director.shouldShowRecipe(), true);
  events.emit("blockBreak", { byPlayer: true, id: B.oak_log });
  assert.equal(director.world.firstWood, false, "breaking is not yet collecting");
  events.emit("itemPickup", { item: "oak_log", count: 1 });
  events.emit("ui:inventoryOpened", { kind: "inventory" });
  assert.equal(director.world.firstWood, true);
  assert.equal(director.knowledge.inventory, true);
  events.emit("craft", { item: "wooden_sword", count: 1 });
  assert.equal(director.world.firstWeaponCrafted, true);
  assert.equal(director.shouldShowRecipe(), false);
  game.inventory.setSlot(0, { item: "wooden_sword", count: 1 });
  assert.equal(director.world.weaponEquipped, true);
  const enemy = { def: { category: "hostile" }, hitByPlayerT: 2 };
  events.emit("playerHitMob", { entity: enemy });
  events.emit("mobDied", { entity: enemy });
  assert.equal(director.knowledge.combat, true);
  for (let i = 0; i < 4; i++) events.emit("blockPlace", { id: B.planks });
  events.emit("blockPlace", { id: B.torch });
  assert.equal(director.world.shelterPrepared, true);
  director.dispose();
});

test("first crafted sword goes into a free hotbar slot without changing normal later crafting", () => {
  const { game } = fixture();
  const director = new OnboardingDirector(game);
  game.onboarding = director;
  director.load();
  game.inventory.setSlot(0, { item: "planks", count: 1 });
  const ui = Object.create(InventoryUI.prototype);
  ui.game = game;
  ui.inventory = game.inventory;
  ui.grid = new CraftingGrid(2);
  ui.grid.slots = [{ item: "planks", count: 1 }, { item: "stick", count: 1 }, { item: "planks", count: 1 }, null];
  ui.cursor = null;
  ui._render = () => {};
  ui._clickResult(false);
  assert.equal(game.inventory.slots[1]?.item, "wooden_sword");
  assert.equal(ui.cursor, null);
  assert.equal(director.world.weaponEquipped, false, "player still chooses slot 2");
  game.inventory.selectSlot(1);
  assert.equal(director.world.weaponEquipped, true);
  director.dispose();
});

test("recipe card names the missing ingredient and how to obtain it", () => {
  const { game } = fixture();
  const director = new OnboardingDirector(game);
  game.onboarding = director;
  director.load();
  const parts = new Map([
    ['[data-ingredient="planks"]', { textContent: "", className: "" }],
    ['[data-ingredient="stick"]', { textContent: "", className: "" }],
    [".recipeHelp", { textContent: "" }],
  ]);
  const ui = Object.create(InventoryUI.prototype);
  ui.game = game; ui.inventory = game.inventory; ui.grid = new CraftingGrid(2); ui.cursor = null;
  ui.recipeEl = { querySelector: (selector) => parts.get(selector), remove: () => {} };
  game.inventory.add("oak_log", 1);
  ui.renderRecipe();
  assert.match(parts.get('[data-ingredient="planks"]').textContent, /0\/2/);
  assert.match(parts.get(".recipeHelp").textContent, /бревно/);
  game.inventory.add("planks", 2);
  ui.renderRecipe();
  assert.match(parts.get(".recipeHelp").textContent, /2 доски/);
  game.inventory.add("stick", 1);
  ui.renderRecipe();
  assert.match(parts.get(".recipeHelp").textContent, /любые три клетки/);
  director.dispose();
});

test("stalled help escalates once per level, then cancels when materials arrive", () => {
  const { game } = fixture();
  const director = new OnboardingDirector(game);
  director.setMode("full");
  director.load();
  game.player.pos.x = 5;
  events.emit("itemPickup", { item: "oak_log" });
  events.emit("ui:inventoryOpened", { kind: "inventory" });
  for (let i = 0; i < 160; i++) director.tick(1);
  const shown = director.hints.status().shown;
  assert.ok(shown.includes("materials1"));
  assert.ok(shown.includes("materials2"));
  assert.ok(shown.includes("materials3"));
  game.inventory.add("planks", 2);
  game.inventory.add("stick", 1);
  director.tick(1);
  assert.ok(!director.hints.status().queue.some((key) => key.startsWith("materials")));
  director.setMode("off");
  assert.equal(director.hints.status().current, null);
  director.dispose();
});

test("knowledge and world milestones survive reload; old equipped saves skip beginner recipe", () => {
  const storage = new Map();
  const a = fixture(storage);
  const first = new OnboardingDirector(a.game);
  first.load();
  events.emit("craft", { item: "wooden_sword" });
  a.game.inventory.setSlot(0, { item: "wooden_sword", count: 1 });
  const save = JSON.parse(JSON.stringify(first.serialize()));
  first.dispose();
  const b = fixture(storage);
  const second = new OnboardingDirector(b.game);
  second.load(save);
  assert.equal(second.knowledge.weaponRecipe, true);
  assert.equal(second.world.firstWeaponCrafted, true);
  assert.equal(second.shouldShowRecipe(), false);
  b.game.inventory.deserialize({ slots: new Array(36).fill(null), hotbarIndex: 0 });
  second.load(); // new world, same browser knowledge
  b.game.player.pos.x = 5;
  for (let i = 0; i < 60; i++) second.tick(1);
  assert.equal(second.shouldShowRecipe(), false);
  assert.ok(!second.hints.status().shown.includes("wood"));
  second.dispose();
  const c = fixture(new Map());
  c.game.inventory.setSlot(0, { item: "iron_sword", count: 1 });
  const legacy = new OnboardingDirector(c.game);
  legacy.load(undefined, true);
  assert.equal(legacy.shouldShowRecipe(), false);
  assert.equal(legacy.knowledge.crafting, true);
  legacy.dispose();
  const d = fixture(new Map());
  for (let i = 0; i < 12; i++) d.game.inventory.setSlot(i, { item: "cobblestone", count: 1 });
  const veteran = new OnboardingDirector(d.game);
  veteran.load(undefined, true);
  assert.equal(veteran.world.coreCompleted, true);
  assert.equal(veteran.knowledge.shelter, true);
  veteran.dispose();
});

test("debug reset replays guidance in the same world and off leaves crafting available", () => {
  const { game } = fixture();
  game.inventory.setSlot(0, { item: "wooden_sword", count: 1 });
  const director = new OnboardingDirector(game);
  director.load(undefined, true);
  assert.equal(director.shouldShowRecipe(), false);
  assert.match(director.command(["reset"]), /сброшено/);
  assert.equal(director.shouldShowRecipe(), true);
  director.command(["off"]);
  assert.equal(director.shouldShowRecipe(), false);
  const grid = new CraftingGrid(2);
  grid.slots = [{ item: "planks", count: 1 }, { item: "stick", count: 1 }, { item: "planks", count: 1 }, null];
  assert.equal(grid.takeResult()?.item, "wooden_sword");
  director.dispose();
});

test("completed knowledge stays quiet in a new world", () => {
  const { game } = fixture();
  const director = new OnboardingDirector(game);
  director.load();
  events.emit("itemPickup", { item: "oak_log" });
  events.emit("ui:inventoryOpened", { kind: "inventory" });
  events.emit("craft", { item: "wooden_sword" });
  game.inventory.setSlot(0, { item: "wooden_sword", count: 1 });
  events.emit("mobDied", { entity: { def: { category: "hostile" }, hitByPlayerT: 1 } });
  events.emit("blockPlace", { id: B.red_bed });
  game.player.pos.x = 5;
  director.tick(1);
  assert.equal(director.world.coreCompleted, true);
  game.inventory.deserialize({ slots: new Array(36).fill(null), hotbarIndex: 0 });
  director.load();
  for (let i = 0; i < 20; i++) director.tick(1);
  assert.equal(director.world.coreCompleted, true);
  assert.deepEqual(director.hints.status().shown, []);
  director.dispose();
});

test("starter zone adds reachable natural wood only when none exists", () => {
  const blocks = new Map();
  const key = (x, y, z) => `${x},${y},${z}`;
  const world = {
    waterLevel: 60,
    chunkAt: () => ({ generated: true }),
    surfaceY: () => 70,
    getBlock: (x, y, z) => blocks.get(key(x, y, z)) ?? (y === 70 ? B.grass : B.air),
    setBlock(x, y, z, id) { blocks.set(key(x, y, z), id); return true; },
  };
  const found = ensureStarterResourceZone(world, 0, 0);
  assert.ok(found && found.distance <= 22);
  assert.equal(world.getBlock(found.x, found.y, found.z), B.oak_log);
  const before = blocks.size;
  assert.ok(nearestStarterWood(world, 0, 0, 40));
  ensureStarterResourceZone(world, 0, 0);
  assert.equal(blocks.size, before, "existing wood is left alone");
});
