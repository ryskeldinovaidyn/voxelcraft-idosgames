// Фейерверк с земли: ПКМ ракетой по блоку запускает её вверх, через секунду с небольшим — залп
// цветных искр, которые разлетаются и гаснут. Чистая картинка: ни урона, ни столкновений, как и у
// фейерверка в Minecraft без крыльев. Ракета в полёте на крыльях — по-прежнему player/Glide.
import * as THREE from "three";
import { DYE_COLORS } from "../registry/blocks/colors";

const RISE = 1.2; // секунд подъёма
const FADE = 1.1; // секунд, пока искры гаснут
const SPARKS = 60;
const rocketGeo = new THREE.BoxGeometry(0.12, 0.28, 0.12);
const rocketMat = new THREE.MeshBasicMaterial({ color: 0xd8d8d8 });

interface Shot {
  rocket: THREE.Mesh | null;
  burst: THREE.Points | null;
  vel: Float32Array;
  t: number;
  at: THREE.Vector3;
}

export class Fireworks {
  private readonly shots: Shot[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  /** Запустить ракету из клетки (x, y, z). */
  launch(x: number, y: number, z: number): void {
    const rocket = new THREE.Mesh(rocketGeo, rocketMat);
    rocket.position.set(x + 0.5, y + 0.6, z + 0.5);
    this.scene.add(rocket);
    this.shots.push({
      rocket,
      burst: null,
      vel: new Float32Array(SPARKS * 3),
      t: 0,
      at: rocket.position.clone(),
    });
  }

  update(dt: number): void {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i]!;
      s.t += dt;
      if (s.rocket) {
        s.rocket.position.y += dt * 9;
        s.at.copy(s.rocket.position);
        if (s.t >= RISE) {
          this.scene.remove(s.rocket);
          s.rocket = null;
          s.burst = this._burst(s);
          s.t = 0;
        }
        continue;
      }
      const burst = s.burst!;
      const pos = burst.geometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      for (let k = 0; k < SPARKS; k++) {
        pos.setXYZ(
          k,
          pos.getX(k) + s.vel[k * 3]! * dt,
          pos.getY(k) + s.vel[k * 3 + 1]! * dt - 1.5 * dt * s.t,
          pos.getZ(k) + s.vel[k * 3 + 2]! * dt,
        );
      }
      pos.needsUpdate = true;
      const m = burst.material as THREE.PointsMaterial;
      m.opacity = Math.max(0, 1 - s.t / FADE);
      if (s.t >= FADE) {
        this.scene.remove(burst);
        burst.geometry.dispose();
        m.dispose();
        this.shots.splice(i, 1);
      }
    }
  }

  /** Залп: искры одного случайного цвета разлетаются шаром. */
  private _burst(s: Shot): THREE.Points {
    const hex = DYE_COLORS[(Math.random() * DYE_COLORS.length) | 0]!.hex;
    const p = new Float32Array(SPARKS * 3);
    for (let k = 0; k < SPARKS; k++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const sp = 3 + Math.random() * 2;
      s.vel[k * 3] = Math.sin(ph) * Math.cos(th) * sp;
      s.vel[k * 3 + 1] = Math.cos(ph) * sp;
      s.vel[k * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp;
      p[k * 3] = s.at.x;
      p[k * 3 + 1] = s.at.y;
      p[k * 3 + 2] = s.at.z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(p, 3));
    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: new THREE.Color(hex),
        size: 0.22,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.scene.add(pts);
    return pts;
  }

  dispose(): void {
    for (const s of this.shots) {
      if (s.rocket) this.scene.remove(s.rocket);
      if (s.burst) this.scene.remove(s.burst);
    }
    this.shots.length = 0;
  }
}
