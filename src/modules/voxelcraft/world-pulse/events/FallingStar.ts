import * as THREE from "three";
import { PULSE, DEFINITIONS } from "../config";
import type { EventContext, EventHandler, EventInstance, EventPhase, Position } from "../types";
import type { Game } from "../../main";

export class FallingStar implements EventHandler {
  definition = DEFINITIONS[0]!;
  private visuals = new Map<string, { group: THREE.Group; material: THREE.MeshBasicMaterial }>();

  findSpawn(c: EventContext, random: () => number): Position {
    const p = c.game.player.pos;
    return [p.x, p.y + 60, p.z];
  }

  start(game: Game, instance: EventInstance): void {
    const angle = PULSE.fallingStar.angleDegrees;
    instance.data.angle = (angle[0] + Math.random() * (angle[1] - angle[0])) * (Math.random() < 0.5 ? -1 : 1);
    instance.data.slope = Math.random() < 0.5 ? -1 : 1;
    instance.data.variant = Math.floor(Math.random() * 3);
    instance.data.yaw = game.player.yaw;
    instance.data.originX = game.player.eyePos.x;
    instance.data.originY = game.player.eyePos.y;
    instance.data.originZ = game.player.eyePos.z;
    // Только намёк для селектора: метеор по-прежнему обязан пройти общий eligibility/budget.
    instance.data.potentialMeteor = Math.random() < PULSE.fallingStar.meteorHintChance;
    this.restore(game, instance);
    game.audio.blip(1300, 0.16, "sine", 0.014, 850);
  }

  restore(game: Game, instance: EventInstance): void {
    if (this.visuals.has(instance.instanceId)) return;
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: 0xffefb4, transparent: true, opacity: 0.95, depthWrite: false, fog: false });
    const geometry = new THREE.SphereGeometry(0.55, 8, 6);
    for (let i = 0; i < PULSE.fallingStar.trailCount; i++) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.setScalar(Math.max(0.12, 1 - i * 0.12));
      group.add(mesh);
    }
    game.scene.add(group);
    this.visuals.set(instance.instanceId, { group, material });
  }

  tick(_game: Game, instance: EventInstance): EventPhase | void {
    if (instance.elapsed >= instance.duration) return "completed";
  }

  frame(game: Game, instance: EventInstance): void {
    const visual = this.visuals.get(instance.instanceId);
    if (!visual) return;
    const t = Math.min(1, instance.elapsed / instance.duration);
    const yaw = Number(instance.data.yaw ?? game.player.yaw) + Number(instance.data.angle ?? 45) * Math.PI / 180;
    const direction = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const side = new THREE.Vector3(-direction.z, 0, direction.x);
    const center = new THREE.Vector3(Number(instance.data.originX ?? instance.position[0]), Number(instance.data.originY ?? instance.position[1]), Number(instance.data.originZ ?? instance.position[2])).addScaledVector(direction, 82);
    center.y += 40 + Number(instance.data.variant) * 8 - 18 * t;
    center.addScaledVector(side, (t - 0.5) * 43 * Number(instance.data.slope ?? 1));
    instance.position = [center.x, center.y, center.z];
    visual.material.opacity = Math.min(0.96, (1 - t) * 2.3);
    visual.group.children.forEach((mesh, i) => {
      mesh.position.copy(center).addScaledVector(side, -i * 2.2 * Number(instance.data.slope ?? 1));
      mesh.position.y += i * 0.9;
    });
  }

  stop(game: Game, instance: EventInstance): void {
    const v = this.visuals.get(instance.instanceId);
    if (!v) return;
    game.scene.remove(v.group);
    (v.group.children[0] as THREE.Mesh).geometry.dispose();
    v.material.dispose();
    this.visuals.delete(instance.instanceId);
  }
}
