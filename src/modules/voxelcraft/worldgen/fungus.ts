// Огромный гриб Пекла, как в Minecraft: стебель 4–8, шляпка из наростов (багровый — адский нарост,
// искажённый — искажённый нарост) в три яруса, внутри нижних ярусов — светогрибы. Генератор Пекла ставит
// их в лесах, костная мука выращивает из гриба на своём нилии (world/behaviours/farming).
import { B } from "../registry/Blocks";
import type { MushroomPut } from "./mushrooms";

export const HUGE_FUNGUS_RADIUS = 2;
export const HUGE_FUNGUS_HEIGHT = 9;

/** Вырастить огромный гриб Пекла со стеблем из (x, y, z) вверх. */
export function growHugeFungus(
  put: MushroomPut,
  x: number,
  y: number,
  z: number,
  warped: boolean,
  rng: () => number,
): void {
  const h = 4 + Math.floor(rng() * 5);
  const stem = warped ? B.warped_stem! : B.crimson_stem!;
  const wart = warped ? B.warped_wart_block! : B.inferno_wart_block!;
  for (let k = 0; k < h; k++) put(x, y + k, z, stem, k > 0);
  const top = y + h;
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++) put(x + dx, top, z + dz, wart, true);
  for (let dy = 1; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++) {
        const corner = Math.abs(dx) === 2 && Math.abs(dz) === 2;
        const ring = Math.abs(dx) === 2 || Math.abs(dz) === 2;
        if (corner || (dy === 2 && !ring) || (dy === 2 && rng() < 0.4))
          continue;
        if (!ring && dx === 0 && dz === 0) continue; // тут стебель
        put(
          x + dx,
          top - dy,
          z + dz,
          !ring && rng() < 0.25 ? B.shroomlight! : wart,
          true,
        );
      }
}
