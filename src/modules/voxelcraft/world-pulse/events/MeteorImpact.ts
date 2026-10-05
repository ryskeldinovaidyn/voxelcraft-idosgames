import * as THREE from "three";
import { PULSE, DEFINITIONS } from "../config";
import { craterCells, findMeteorSite, hasModifiedBlocks, terrainHeight } from "../Spawn";
import type { EventContext, EventHandler, EventInstance, EventPhase, FragmentSite, Position } from "../types";
import type { Game } from "../../main";
import { events } from "../../core/EventBus";

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class MeteorImpact implements EventHandler {
  definition = DEFINITIONS[1]!;
  private visuals = new Map<string, { ball: THREE.Mesh; flash: THREE.Mesh; glow: THREE.PointLight; smoke: THREE.Mesh[] }>();
  constructor(private addFragments: (sites: FragmentSite[]) => void) {}

  findSpawn(c: EventContext, random: () => number): Position | null {
    return findMeteorSite(c, this.definition, random);
  }

  start(game: Game, instance: EventInstance): void {
    const random = seeded(instance.seed);
    instance.data.precursor = PULSE.meteor.precursor[0] + random() * (PULSE.meteor.precursor[1] - PULSE.meteor.precursor[0]);
    instance.data.diameter = Math.round(PULSE.meteor.diameter[0] + random() * (PULSE.meteor.diameter[1] - PULSE.meteor.diameter[0]));
    instance.data.depth = Math.round(PULSE.meteor.depth[0] + random() * (PULSE.meteor.depth[1] - PULSE.meteor.depth[0]));
    instance.data.craterDone = false;
    instance.data.soundDone = false;
    instance.data.shake = 0;
    this.restore(game, instance);
  }

  restore(game: Game, instance: EventInstance): void {
    if (this.visuals.has(instance.instanceId)) return;
    if (!Number.isFinite(Number(instance.data.precursor))) instance.data.precursor = PULSE.meteor.precursor[0];
    if (!Number.isFinite(Number(instance.data.diameter))) instance.data.diameter = PULSE.meteor.diameter[0];
    if (!Number.isFinite(Number(instance.data.depth))) instance.data.depth = PULSE.meteor.depth[0];
    instance.data.craterDone = instance.data.craterDone === true;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff8b35, transparent: true, opacity: 0.9, fog: false }));
    const flash = new THREE.Mesh(new THREE.SphereGeometry(3, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffb05d, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    flash.visible = false;
    const glow = new THREE.PointLight(0xff5b21, 3, 60);
    const smoke: THREE.Mesh[] = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(2.3 + i * 0.6, 7, 5), new THREE.MeshBasicMaterial({ color: 0x51473f, transparent: true, opacity: 0.35, depthWrite: false, fog: false }));
      m.visible = false;
      game.scene.add(m);
      smoke.push(m);
    }
    game.scene.add(ball, flash, glow);
    this.visuals.set(instance.instanceId, { ball, flash, glow, smoke });
  }

  tick(game: Game, instance: EventInstance, dt: number): EventPhase | void {
    const impactAt = Number(instance.data.precursor) + PULSE.meteor.flyover;
    if (instance.elapsed < Number(instance.data.precursor)) {
      instance.phase = "pending";
      if (!instance.data.soundDone && instance.elapsed > 0.3) {
        game.audio.blip(85, 1.3, "sawtooth", 0.055, 155);
        instance.data.soundDone = true;
      }
    } else if (instance.elapsed < impactAt) instance.phase = "active";
    else if (!instance.data.craterDone) {
      const [x, , z] = instance.position;
      if (hasModifiedBlocks(game.world, x, z, PULSE.meteor.safetyRadius)) return "cancelled";
      const diameter = Number(instance.data.diameter), depth = Number(instance.data.depth);
      for (const [bx, by, bz, id] of craterCells(game.world, instance.position, instance.seed, diameter, depth))
        game.world.applyRemoteBlock(bx, by, bz, id, 0);
      const random = seeded(instance.seed ^ 0x9e3779b9);
      const count = Math.round(PULSE.meteor.fragments[0] + random() * (PULSE.meteor.fragments[1] - PULSE.meteor.fragments[0]));
      const sites: FragmentSite[] = [];
      for (let i = 0; i < count; i++) {
        const angle = random() * Math.PI * 2, radius = 1 + random() * (diameter / 2 - 1);
        const fx = Math.floor(x + Math.cos(angle) * radius), fz = Math.floor(z + Math.sin(angle) * radius);
        const fy = terrainHeight(game.world, fx, fz) - Math.max(0, Math.round(depth * (1 - (radius / (diameter / 2)) ** 1.7))) + 1;
        sites.push({ id: `${instance.instanceId}:${i}`, position: [fx + 0.5, fy + 0.5, fz + 0.5], collected: false });
      }
      this.addFragments(sites);
      instance.data.craterDone = true;
      instance.data.fragmentCount = count;
      instance.data.shake = 0.7;
      events.emit("explosion", { x, y: instance.position[1], z });
      game.audio.blip(60, 0.8, "sawtooth", 0.19, 35);
      instance.phase = "active";
    }
    instance.data.shake = Math.max(0, Number(instance.data.shake || 0) - dt);
    if (instance.elapsed >= instance.duration || instance.elapsed > this.definition.lifetime) return "completed";
  }

  frame(game: Game, instance: EventInstance): void {
    const v = this.visuals.get(instance.instanceId);
    if (!v) return;
    const [x, y, z] = instance.position;
    const impactAt = Number(instance.data.precursor) + PULSE.meteor.flyover;
    const to = new THREE.Vector3(x - game.player.pos.x, 0, z - game.player.pos.z).normalize();
    const progress = Math.max(0, Math.min(1, (instance.elapsed - Number(instance.data.precursor)) / PULSE.meteor.flyover));
    v.ball.visible = instance.elapsed >= Number(instance.data.precursor) && instance.elapsed < impactAt;
    v.ball.position.copy(game.player.eyePos).addScaledVector(to, 80 + progress * 15);
    v.ball.position.y += 55 - progress * 45;
    v.glow.position.copy(v.ball.position);
    const sinceImpact = instance.elapsed - impactAt;
    v.flash.visible = !!instance.data.craterDone && sinceImpact >= 0 && sinceImpact < 1.5;
    v.flash.position.copy(game.player.eyePos).addScaledVector(to, 70);
    v.flash.position.y += 6;
    v.flash.scale.setScalar(1 + Math.max(0, sinceImpact) * 5);
    (v.flash.material as THREE.MeshBasicMaterial).opacity = v.flash.visible ? Math.max(0, 0.8 - sinceImpact * 0.55) : 0;
    if (v.flash.visible) v.glow.position.copy(v.flash.position);
    v.glow.visible = v.ball.visible || v.flash.visible;
    if (instance.data.craterDone) {
      const distance = Math.hypot(x - game.player.pos.x, z - game.player.pos.z);
      const center = distance < 90 ? new THREE.Vector3(x, y, z) : game.player.eyePos.clone().addScaledVector(to, 69).add(new THREE.Vector3(0, -3, 0));
      v.smoke.forEach((m, i) => {
        m.visible = true;
        m.position.set(center.x + Math.sin(i * 5.3) * 2, center.y + 1 + i * 3 + Math.sin(instance.elapsed + i) * 1.5, center.z + Math.cos(i * 4.1) * 2);
        (m.material as THREE.MeshBasicMaterial).opacity = Math.max(0.02, 0.3 - Math.max(0, sinceImpact) / PULSE.meteor.smokeSeconds * 0.27);
      });
    }
    const shake = Number(instance.data.shake || 0);
    if (shake > 0) {
      const distance = Math.hypot(x - game.player.pos.x, z - game.player.pos.z);
      const [minDistance, maxDistance] = this.definition.spawnDistance;
      const near = Math.max(0, Math.min(1, (maxDistance - distance) / (maxDistance - minDistance)));
      const strength = PULSE.meteor.shakeMin + (PULSE.meteor.shakeMax - PULSE.meteor.shakeMin) * near;
      game.camera.position.x += Math.sin(instance.elapsed * 75) * 0.09 * shake * strength;
      game.camera.position.y += Math.cos(instance.elapsed * 61) * 0.07 * shake * strength;
    }
  }

  viewPositions(_game: Game, instance: EventInstance): Position[] {
    const v = this.visuals.get(instance.instanceId);
    if (!v) return [];
    if (v.ball.visible) return [[v.ball.position.x, v.ball.position.y, v.ball.position.z]];
    if (v.flash.visible) return [[v.flash.position.x, v.flash.position.y, v.flash.position.z]];
    return v.smoke.filter((m) => m.visible).map((m) => [m.position.x, m.position.y, m.position.z]);
  }

  stop(game: Game, instance: EventInstance): void {
    const v = this.visuals.get(instance.instanceId);
    if (!v) return;
    game.scene.remove(v.ball, v.flash, v.glow, ...v.smoke);
    v.ball.geometry.dispose(); (v.ball.material as THREE.Material).dispose();
    v.flash.geometry.dispose(); (v.flash.material as THREE.Material).dispose();
    for (const m of v.smoke) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
    this.visuals.delete(instance.instanceId);
  }
}
