// Луч против коробки (slab-тест): расстояние входа или null. Общий для прицела по мобам и стрел.
interface V3 {
  x: number;
  y: number;
  z: number;
}

export function rayBox(
  origin: V3,
  dir: V3,
  maxDist: number,
  min: V3,
  max: V3,
): number | null {
  let t0 = 0,
    t1 = maxDist;
  for (const ax of ["x", "y", "z"] as const) {
    const d = dir[ax],
      o = origin[ax];
    if (Math.abs(d) < 1e-9) {
      if (o < min[ax] || o > max[ax]) return null;
      continue;
    }
    let ta = (min[ax] - o) / d,
      tb = (max[ax] - o) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return null;
  }
  return t0;
}
