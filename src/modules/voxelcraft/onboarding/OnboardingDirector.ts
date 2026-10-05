// Ненавязчивое обучение наблюдает за событиями существующих игровых систем.
import { events } from "../core/EventBus";
import * as THREE from "three";
import { BLOCKS } from "../registry/Blocks";
import { TAGS } from "../registry/tags";
import { TutorialHintManager } from "./TutorialHintManager";
import { TutorialGuide, type TutorialGuideStep } from "./TutorialGuide";
import { nearestStarterWood, type NearbyWood } from "./StarterResourceZone";
import type { Game } from "../main";
import type { Mob } from "../entities/Mob";

export type AssistMode = "auto" | "full" | "light" | "off";
export interface PlayerKnowledgeState {
  moved: boolean;
  resourceGathering: boolean;
  woodGathering: boolean;
  inventory: boolean;
  crafting: boolean;
  weaponRecipe: boolean;
  combat: boolean;
  shelter: boolean;
}
export interface WorldOnboardingState {
  firstWood: boolean;
  firstWeaponCrafted: boolean;
  weaponEquipped: boolean;
  firstEnemyKilled: boolean;
  shelterPrepared: boolean;
  coreCompleted: boolean;
  placedBlocks: number;
  placedLight: boolean;
}
export interface OnboardingSave {
  world: WorldOnboardingState;
  elapsedSeconds?: number;
  stalledSeconds?: number;
  milestones?: Record<string, number>;
}

const PROFILE_KEY = "voxelcraft:onboarding:profile:v1";
export const ONBOARDING_TIMING = {
  initialDelay: 14,
  hintLevel1: 40,
  hintLevel2: 85,
  hintLevel3: 145,
} as const;
const freshKnowledge = (): PlayerKnowledgeState => ({ moved: false, resourceGathering: false, woodGathering: false, inventory: false, crafting: false, weaponRecipe: false, combat: false, shelter: false });
const freshWorld = (): WorldOnboardingState => ({ firstWood: false, firstWeaponCrafted: false, weaponEquipped: false, firstEnemyKilled: false, shelterPrepared: false, coreCompleted: false, placedBlocks: 0, placedLight: false });
const sword = (item: string) => item.endsWith("_sword") || item === "trident";
const wood = (item: string) => !!TAGS.logs?.includes(item) || !!TAGS.planks?.includes(item);

function readProfile(): { mode: AssistMode; knowledge: PlayerKnowledgeState } {
  try {
    const raw = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "null") as { mode?: AssistMode; knowledge?: Partial<PlayerKnowledgeState> } | null;
    return {
      mode: raw?.mode && ["auto", "full", "light", "off"].includes(raw.mode) ? raw.mode : "auto",
      knowledge: { ...freshKnowledge(), ...raw?.knowledge, woodGathering: raw?.knowledge?.woodGathering === true || raw?.knowledge?.weaponRecipe === true },
    };
  } catch { return { mode: "auto", knowledge: freshKnowledge() }; }
}

export class OnboardingDirector {
  readonly hints = new TutorialHintManager();
  readonly guide = new TutorialGuide();
  knowledge: PlayerKnowledgeState;
  world: WorldOnboardingState = freshWorld();
  mode: AssistMode;
  private elapsed = 0;
  private step = 0;
  private startX: number;
  private startZ: number;
  private stalled = 0;
  private assist = 0;
  private engagedUntil = 0;
  private lookedAtWood = false;
  private nearbyWood: NearbyWood | null = null;
  private nextWoodSearch = 0;
  private debugReplay = false;
  private marker: THREE.LineSegments | null = null;
  private readonly unsub: (() => void)[] = [];
  private readonly seen = new Set<string>();
  private milestones: Record<string, number> = {};

  constructor(private readonly game: Game) {
    const profile = readProfile();
    this.knowledge = profile.knowledge;
    this.mode = profile.mode;
    this.startX = game.player.pos.x;
    this.startZ = game.player.pos.z;
    this.listen("itemPickup", (p: { item?: string }) => this.itemPickup(p.item));
    this.listen("blockBreak", (p: { byPlayer?: boolean; id?: number }) => {
      if (!p.byPlayer) return;
      this.learn("resourceGathering");
    });
    this.listen("ui:inventoryOpened", (p: { kind: string }) => {
      if (p.kind === "inventory" || p.kind === "crafting") {
        this.learn("inventory");
        this.milestone("inventory_first_opened");
        if (p.kind === "crafting") this.milestone("crafting_first_opened");
        this.hints.cancel("inventory");
      }
    });
    this.listen("ui:recipeViewed", () => { this.seen.add("recipe"); this.milestone("first_weapon_recipe_viewed"); });
    this.listen("craft", (p: { item: string }) => this.crafted(p.item));
    this.listen("invChanged", () => {
      if (!this.world.firstWood && this.game.inventory.slots.some((s) => !!s && wood(s.item))) this.learnWood();
      this.equipmentChanged();
    });
    this.listen("playerHitMob", (p: { entity: Mob }) => {
      if (p.entity.def.category !== "hostile") return;
      this.engagedUntil = this.elapsed + 12;
      this.milestone("first_combat_started");
      this.hints.cancel("combat");
    });
    this.listen("playerHurt", (p: { cause?: string }) => {
      if (p.cause !== "attack" && p.cause !== "projectile") return;
      this.engagedUntil = this.elapsed + 12;
      if (this.world.weaponEquipped && !this.knowledge.combat)
        this.offer("combat", this.game.touch ? "Удерживай ⚒, чтобы атаковать." : "ЛКМ — атаковать. Отступай между ударами.", 3, 4);
    });
    this.listen("mobDied", (p: { entity: Mob }) => {
      if (p.entity.def.category !== "hostile" || p.entity.hitByPlayerT <= 0) return;
      this.world.firstEnemyKilled = true;
      this.milestone("first_enemy_killed");
      this.learn("combat");
      this.hints.cancel("combat");
    });
    this.listen("blockPlace", (p: { id?: number }) => this.blockPlaced(p.id));
    this.listen("slept", () => this.learnShelter());
  }

  private listen(name: string, fn: (data: any) => void) { this.unsub.push(events.on(name, fn)); }
  private persistProfile() {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify({ mode: this.mode, knowledge: this.knowledge })); } catch { /* private mode */ }
  }
  private learn(key: keyof PlayerKnowledgeState) {
    if (this.knowledge[key]) return;
    this.knowledge[key] = true;
    this.persistProfile();
    this.hints.cancel(key);
  }
  private milestone(id: string) {
    if (id in this.milestones) return;
    this.milestones[id] = Math.round(this.elapsed);
    events.emit("onboardingMilestone", { id, seconds: this.milestones[id] });
  }
  private learnWood() {
    if (this.world.firstWood) return;
    this.world.firstWood = true;
    this.milestone("first_resource_collected");
    this.learn("resourceGathering");
    this.learn("woodGathering");
    this.hints.cancel("wood");
    this.hints.cancel("woodDistance");
    this.hideMarker();
    if (!this.knowledge.inventory) this.offer("inventory", this.game.touch
      ? "Древесина пригодится для крафта. Открой инвентарь кнопкой ▦."
      : "Древесина пригодится для крафта. Нажми E, чтобы открыть инвентарь.", 2);
  }
  private itemPickup(item?: string) {
    if (!item) return;
    if (wood(item)) this.learnWood();
    else if (item === "cobblestone") this.learn("resourceGathering");
    if (sword(item)) for (const key of ["materials1", "materials2", "materials3"]) this.hints.cancel(key);
  }
  private crafted(item: string) {
    this.learn("crafting");
    if (!sword(item)) return;
    const first = !this.world.firstWeaponCrafted && !this.knowledge.weaponRecipe;
    this.world.firstWeaponCrafted = true;
    this.debugReplay = false;
    this.milestone("first_weapon_crafted");
    this.world.firstWood = true;
    this.learn("resourceGathering");
    this.learn("woodGathering");
    this.learn("inventory");
    this.learn("weaponRecipe");
    for (const key of ["materials1", "materials2", "materials3"]) this.hints.cancel(key);
    if (first) this.offer("weaponReady", "Первое оружие готово! Оно появится на панели быстрого доступа.", 3, 5);
  }
  private equipmentChanged() {
    const held = this.game.inventory.heldItem();
    if (!held || !sword(held.item)) return;
    this.world.weaponEquipped = true;
    this.milestone("first_weapon_equipped");
    this.hints.cancel("equipPlace");
    this.hints.cancel("equipSelect");
  }
  private blockPlaced(id?: number) {
    const name = BLOCKS[id ?? -1]?.name ?? "";
    if (name.includes("bed")) return this.learnShelter();
    if (name === "torch" || name === "lantern" || name === "campfire") this.world.placedLight = true;
    else if (name.includes("planks") || name === "cobblestone" || name === "dirt" || name === "stone") this.world.placedBlocks++;
    if (this.world.placedLight && this.world.placedBlocks >= 4) this.learnShelter();
  }
  private learnShelter() {
    this.world.shelterPrepared = true;
    this.milestone("first_shelter_completed");
    this.learn("shelter");
    this.hints.cancel("shelter");
  }
  private offer(key: string, text: string, priority = 1, duration = 6) {
    const autoLight = this.mode === "auto" && this.elapsed < 180 && this.knowledge.inventory && this.knowledge.crafting && this.knowledge.resourceGathering;
    if (this.mode === "off" || ((this.mode === "light" || autoLight) && priority < 2)) return;
    this.hints.offer(key, text, priority, duration);
  }

  /** Раз в секунду игрового времени; только текущая цель и несколько дешёвых проверок. */
  tick(dt: number) {
    if (!this.game.playing || this.game.player.mode === "creative") {
      this.game.entities.beginnerCombat = false;
      this.guide.hide();
      return;
    }
    this.elapsed += dt;
    this.step += dt;
    if (this.step < 1) return;
    this.step = 0;
    const g = this.game;
    const inCombat = this.elapsed < this.engagedUntil;
    const busy = g.player.dead || !g.playing || g.input.uiOpen || g.invUI.open;
    const dx = g.player.pos.x - this.startX, dz = g.player.pos.z - this.startZ;
    if (dx * dx + dz * dz >= 16) this.learn("moved");
    if (this.world.coreCompleted || Object.values(this.knowledge).every(Boolean)) {
      if (!this.world.coreCompleted) {
        this.world.coreCompleted = true;
        this.hints.clear();
        this.milestone("core_onboarding_completed");
      }
      g.entities.beginnerCombat = false;
      this.guide.hide();
      this.hints.tick(1, busy, inCombat);
      return;
    }
    if (this.mode !== "off" && this.elapsed >= ONBOARDING_TIMING.initialDelay) {
      if (!this.knowledge.moved) this.offer("moved", g.touch ? "Стик слева — движение, ⤒ — прыжок." : "WASD — движение, Space — прыжок.");
      else if (!this.world.firstWood && !this.knowledge.woodGathering && (!this.hasWeapon() || this.debugReplay)) {
        const target = g.interaction.target;
        const name = target ? BLOCKS[target.id]?.name : undefined;
        if (name && wood(name)) {
          if (!this.lookedAtWood) this.offer("wood", g.touch ? "Удерживай ⚒ на стволе, чтобы добыть древесину." : "Удерживай ЛКМ на стволе, чтобы добыть древесину.", 2);
          this.lookedAtWood = true;
        } else if (this.elapsed > ONBOARDING_TIMING.hintLevel1) this.offer("wood", g.touch ? "Найди ствол дерева и удерживай ⚒." : "Найди дерево и добудь ствол удержанием ЛКМ.");
        if (this.elapsed >= ONBOARDING_TIMING.hintLevel2 && !this.nearbyWood && this.elapsed >= this.nextWoodSearch) {
          this.nearbyWood = nearestStarterWood(g.world, g.player.pos.x, g.player.pos.z);
          this.nextWoodSearch = this.elapsed + 20;
        }
        if (this.nearbyWood && this.elapsed >= ONBOARDING_TIMING.hintLevel2) this.showMarker(this.nearbyWood);
        if (this.nearbyWood && this.elapsed >= ONBOARDING_TIMING.hintLevel3) {
          const d = Math.round(Math.hypot(g.player.pos.x - this.nearbyWood.x, g.player.pos.z - this.nearbyWood.z));
          this.offer("woodDistance", `Ближайшая древесина примерно в ${d} блоках.`, 2);
        }
      }
      if (this.world.firstWood && !this.knowledge.weaponRecipe && !this.hasWeapon()) this.materialGuidance();
      if (this.world.firstWeaponCrafted && !this.world.weaponEquipped) this.equipGuidance();
      if (this.world.weaponEquipped && !this.knowledge.combat && g.interaction.targetEntity?.def.category === "hostile")
        this.offer("combat", g.touch ? "Удерживай ⚒, чтобы атаковать. Между ударами держи дистанцию." : "ЛКМ — атаковать. Держи дистанцию между ударами.", 3, 4);
      if (!this.knowledge.shelter && g.dimension === "overworld" && g.dayNight.phase > 0.42 && g.dayNight.phase < 0.75)
        this.offer("shelter", "Темнеет. Найди укрытие или поставь блоки и свет.", 2, 7);
    }
    g.entities.beginnerCombat = this.mode !== "off" && !this.knowledge.combat && g.player.mode === "survival" && !g.net;
    const step = this.guideStep();
    if (this.mode !== "off" && this.elapsed >= 5 && !busy && (!inCombat || step?.number === 8) && step)
      this.guide.show(step);
    else this.guide.hide();
    this.hints.tick(1, busy, inCombat);
  }

  private guideStep(): TutorialGuideStep | null {
    const touch = !!this.game.touch;
    const invKey = touch ? "кнопкой ▦" : "клавишей E";
    const attack = touch ? "удерживай ⚒" : "удерживай ЛКМ";
    if (!this.knowledge.moved)
      return { number: 1, title: "Осмотрись и пройдись", action: touch ? "Двигайся левым стиком, кнопка ⤒ — прыжок." : "WASD — движение, Space — прыжок." };

    const slots = this.game.inventory.slots;
    const count = (match: (item: string) => boolean) => slots.reduce((n, s) => n + (s && match(s.item) ? s.count : 0), 0);
    const logs = count((item) => !!TAGS.logs?.includes(item));
    const planks = count((item) => !!TAGS.planks?.includes(item));
    const sticks = count((item) => item === "stick");
    const hasWeapon = this.hasWeapon();

    if (!hasWeapon && !this.world.firstWeaponCrafted && !this.knowledge.weaponRecipe) {
      if (logs === 0 && planks < (sticks ? 2 : 4)) {
        const target = this.game.interaction.target;
        const lookingAtLog = target && !!TAGS.logs?.includes(BLOCKS[target.id]?.name ?? "");
        return { number: 2, title: "Добудь бревно", action: lookingAtLog
          ? `${attack} на стволе, пока он не сломается. Подбери выпавшее бревно.`
          : `Найди дерево. ${touch ? "Удерживай ⚒" : "Удерживай ЛКМ"} на стволе и подбери бревно.` };
      }
      if (!this.knowledge.inventory)
        return { number: 3, title: "Открой инвентарь", action: `Открой инвентарь ${invKey}. В нём есть сетка крафта 2×2 и рецепт первого меча.` };
      if (planks < 2 || (sticks < 1 && planks < 4))
        return { number: 4, title: "Сделай доски", action: `Открой инвентарь ${invKey}, положи бревно в любую клетку сетки 2×2 и забери доски справа.` };
      if (sticks < 1)
        return { number: 5, title: "Сделай палку", action: `Положи две доски вертикально в сетку 2×2. Забери палки справа; для меча оставь ещё 2 доски.` };
      return { number: 6, title: "Создай деревянный меч", action: `Открой инвентарь ${invKey}. Положи 2 доски и 1 палку в любые три клетки 2×2, затем забери меч справа.` };
    }
    if (this.world.firstWeaponCrafted && !hasWeapon && !this.knowledge.combat)
      return { number: 6, title: "Нужно новое оружие", action: `Меча больше нет в инвентаре. Открой его ${invKey}: 2 доски и 1 палка в сетке 2×2 дадут новый меч.` };
    const held = this.game.inventory.heldItem();
    if (hasWeapon && !this.knowledge.combat && (!held || !sword(held.item))) {
      const slot = slots.findIndex((s, index) => index < 9 && !!s && sword(s.item));
      return { number: 7, title: "Возьми меч в руку", action: slot >= 0
        ? touch ? `Нажми на меч в ячейке ${slot + 1} внизу экрана.` : `Нажми ${slot + 1} — это ячейка меча на панели внизу.`
        : "Перенеси меч в нижний ряд инвентаря, затем выбери его на панели." };
    }
    if (!this.knowledge.combat)
      return { number: 8, title: "Первый бой", action: touch ? "Когда встретишь врага, удерживай ⚒ для атаки. Между ударами отступай." : "Когда встретишь врага, атакуй ЛКМ. Между ударами отступай." };
    if (!this.knowledge.shelter)
      return { number: 9, title: "Подготовь укрытие", action: "До ночи поставь стены из блоков и источник света или кровать. Это защитит от монстров." };
    return null;
  }

  private materialGuidance() {
    const inv = this.game.inventory;
    const planks = inv.slots.reduce((n, s) => n + (s && TAGS.planks?.includes(s.item) ? s.count : 0), 0);
    const sticks = inv.count("stick");
    if (planks >= 2 && sticks >= 1) {
      for (const key of ["materials1", "materials2", "materials3"]) this.hints.cancel(key);
      this.stalled = 0; return;
    }
    if (!this.knowledge.inventory) return;
    this.stalled += 1;
    if (this.stalled < ONBOARDING_TIMING.hintLevel1) return;
    if (this.stalled >= ONBOARDING_TIMING.hintLevel3) this.assist = 3;
    else if (this.stalled >= ONBOARDING_TIMING.hintLevel2) this.assist = 2;
    else this.assist = 1;
    const need = planks < 2 ? "доски" : "палка";
    const text = need === "доски"
      ? this.assist >= 2 ? "Положи бревно в сетку крафта: получится 4 доски." : "Для меча нужны доски. Их делают из бревна."
      : this.assist >= 2 ? "Положи две доски одну над другой: получишь 4 палки." : "Для меча нужна палка. Сделай её из двух досок.";
    this.offer(`materials${this.assist}`, this.assist === 3 ? text + (this.game.touch ? " Рецепт показан в инвентаре (▦)." : " Рецепт показан в инвентаре (E).") : text, 2, 7);
  }
  private equipGuidance() {
    const i = this.game.inventory.slots.findIndex((s, index) => index < 9 && !!s && sword(s.item));
    if (i >= 0) this.offer("equipSelect", this.game.touch ? `Нажми на меч в слоте ${i + 1} внизу экрана.` : `Нажми ${i + 1}, чтобы взять меч в руку.`, 2);
    else this.offer("equipPlace", "Перенеси меч в нижний ряд инвентаря — это панель быстрого доступа.", 2);
  }
  private hasWeapon() {
    return this.game.inventory.slots.some((s) => !!s && sword(s.item)) || !!(this.game.invUI.cursor && sword(this.game.invUI.cursor.item));
  }
  private showMarker(p: NearbyWood) {
    const name = BLOCKS[this.game.world.getBlock(p.x, p.y, p.z)]?.name;
    if (!name || !TAGS.logs?.includes(name)) { this.hideMarker(); this.nearbyWood = null; return; }
    if (!this.marker) {
      const box = new THREE.BoxGeometry(1.08, 1.08, 1.08);
      const geo = new THREE.EdgesGeometry(box);
      box.dispose();
      const mat = new THREE.LineBasicMaterial({ color: 0xffdb72, transparent: true, opacity: 0.7 });
      this.marker = new THREE.LineSegments(geo, mat);
      this.game.scene.add(this.marker);
    }
    this.marker.position.set(p.x + 0.5, p.y + 0.5, p.z + 0.5);
    this.marker.visible = true;
  }
  private hideMarker() { if (this.marker) this.marker.visible = false; }
  shouldShowRecipe() { return this.mode !== "off" && !this.world.coreCompleted && !this.knowledge.weaponRecipe && !this.world.firstWeaponCrafted && (!this.hasWeapon() || this.debugReplay) && this.game.player.mode === "survival"; }

  serialize(): OnboardingSave { return { world: { ...this.world }, elapsedSeconds: this.elapsed, stalledSeconds: this.stalled, milestones: { ...this.milestones } }; }
  load(data?: OnboardingSave, legacy = false) {
    this.hints.clear(); this.guide.hide(); this.elapsed = Number.isFinite(data?.elapsedSeconds) ? Math.max(0, data!.elapsedSeconds!) : 0;
    this.debugReplay = false;
    this.stalled = Number.isFinite(data?.stalledSeconds) ? Math.max(0, data!.stalledSeconds!) : 0;
    this.milestones = data?.milestones && typeof data.milestones === "object" ? { ...data.milestones } : {};
    this.assist = 0; this.lookedAtWood = false;
    this.nearbyWood = null; this.nextWoodSearch = 0; this.hideMarker();
    this.seen.clear();
    if ("first_weapon_recipe_viewed" in this.milestones) this.seen.add("recipe");
    this.startX = this.game.player.pos.x; this.startZ = this.game.player.pos.z;
    this.world = { ...freshWorld(), ...data?.world };
    this.game.entities.beginnerCombat = this.mode !== "off" && !this.knowledge.combat && this.game.player.mode === "survival" && !this.game.net;
    if (!data && legacy) {
      const inv = this.game.inventory.slots;
      const developed = inv.filter(Boolean).length >= 12 || this.game.achievements.serialize().length >= 3 || this.game.player.xpLevel >= 5;
      if (developed) {
        for (const k of Object.keys(this.knowledge) as (keyof PlayerKnowledgeState)[]) this.learn(k);
        this.world.coreCompleted = true;
      } else if (this.hasWeapon()) {
        this.world.firstWood = true;
        this.world.firstWeaponCrafted = true;
        for (const k of ["moved", "resourceGathering", "woodGathering", "inventory", "crafting", "weaponRecipe"] as const) this.learn(k);
      }
      this.equipmentChanged();
    }
  }
  reset() {
    this.knowledge = freshKnowledge(); this.mode = "full";
    this.persistProfile(); this.load({ world: freshWorld() });
    this.debugReplay = true;
  }
  setMode(mode: AssistMode) {
    this.mode = mode; this.persistProfile();
    if (mode === "off") { this.hints.clear(); this.guide.hide(); this.game.entities.beginnerCombat = false; }
  }
  command(args: string[]): string {
    const [op, value] = args;
    if (op === "reset") { this.reset(); return "Обучение сброшено в этом браузере и мире."; }
    if (op === "set" && value && ["auto", "full", "light", "off"].includes(value)) return this.command([value]);
    if (op === "off" || op === "full" || op === "light" || op === "auto") { this.setMode(op); return `Обучение: ${op}`; }
    if (op === "trigger" && value) {
      const messages: Record<string, string> = { movement: "WASD — движение, Space — прыжок.", crafting: "Нажми E: в сетке 2×2 можно собрать первый меч.", weapon: "Меч: две доски и палка в любых трёх клетках 2×2.", combat: "ЛКМ — атаковать.", shelter: "К ночи найди укрытие и поставь свет." };
      if (!messages[value]) return "Триггеры: movement, crafting, weapon, combat, shelter";
      this.hints.offer(value, messages[value], 5); return `Подсказка: ${value}`;
    }
    const objective = !this.knowledge.moved ? "movement" : !this.world.firstWood && !this.hasWeapon() ? "wood" : !this.knowledge.weaponRecipe ? "weapon" : !this.knowledge.combat ? "combat" : !this.knowledge.shelter ? "shelter" : "complete";
    return JSON.stringify({ mode: this.mode, knowledge: this.knowledge, world: this.world, recipeViewed: this.seen.has("recipe"), hint: this.hints.status(), assist: this.assist, currentCoreObjective: objective, secondsSinceStart: Math.floor(this.elapsed), secondsSinceProgress: Math.floor(this.elapsed - Math.max(0, ...Object.values(this.milestones))), secondsWithoutMaterials: Math.floor(this.stalled), milestones: this.milestones });
  }
  dispose() {
    this.unsub.forEach((off) => off()); this.hints.dispose(); this.guide.dispose();
    if (this.marker) {
      this.game.scene.remove(this.marker);
      this.marker.geometry.dispose();
      (this.marker.material as THREE.Material).dispose();
    }
  }
}
