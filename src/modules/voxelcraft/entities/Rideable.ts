// То, на чём ездит игрок (Player.riding): вагонетка, лодка. Седок держится за renderPos (позиция
// отрисовки — без рывков 20 TPS), «вперёд» толкает транспорт в сторону взгляда.
import type * as THREE from "three";

export interface Rideable {
  /** Вид транспорта: minecart | boat. */
  kind: string;
  pos: THREE.Vector3;
  renderPos: THREE.Vector3;
  dead: boolean;
  rider: boolean;
  /** На сколько выше позиции транспорта сидит игрок. */
  seatY: number;
  push(dx: number, dz: number, dt: number): void;
}
