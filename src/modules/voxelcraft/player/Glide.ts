// Полёт на Крыльях Предела — физика элитр Minecraft, один тик (1/20 с). Формулы Minecraft работают в
// блоках за тик и с pitch «вниз — плюс», поэтому скорость пересчитывается туда и обратно.
// Ракета толкает вдоль взгляда, пока горит (Player.boost).

export const GLIDE_TICK = 0.05;

/** Один тик планирования: меняет vel (блоки/с) по взгляду (pitch вверх — плюс, yaw как у игрока). */
export function glideTick(
  vel: { x: number; y: number; z: number },
  pitch: number,
  yaw: number,
  boost: boolean,
): void {
  const p = -pitch; // Minecraft: взгляд вниз — положительный
  const cosP = Math.cos(p);
  const lx = -Math.sin(yaw) * cosP,
    ly = -Math.sin(p),
    lz = -Math.cos(yaw) * cosP;
  let vx = vel.x / 20,
    vy = vel.y / 20,
    vz = vel.z / 20;
  const hlook = cosP;
  const hvel = Math.hypot(vx, vz);
  const cos2 = cosP * cosP;
  vy += -0.08 + cos2 * 0.06;
  if (vy < 0 && hlook > 0) {
    // падение переходит в скорость вперёд
    const k = vy * -0.1 * cos2;
    vy += k;
    vx += (lx * k) / hlook;
    vz += (lz * k) / hlook;
  }
  if (p < 0 && hlook > 0) {
    // взгляд вверх: скорость вперёд уходит в набор высоты
    const k = hvel * -Math.sin(p) * 0.04;
    vy += k * 3.2;
    vx -= (lx * k) / hlook;
    vz -= (lz * k) / hlook;
  }
  if (hlook > 0) {
    vx += ((lx / hlook) * hvel - vx) * 0.1;
    vz += ((lz / hlook) * hvel - vz) * 0.1;
  }
  vx *= 0.99;
  vy *= 0.98;
  vz *= 0.99;
  if (boost) {
    vx += lx * 0.1 + (lx * 1.5 - vx) * 0.5;
    vy += ly * 0.1 + (ly * 1.5 - vy) * 0.5;
    vz += lz * 0.1 + (lz * 1.5 - vz) * 0.5;
  }
  vel.x = vx * 20;
  vel.y = vy * 20;
  vel.z = vz * 20;
}
