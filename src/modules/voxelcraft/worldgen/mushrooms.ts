// Огромные грибы, как в Minecraft: у бурого — плоская шляпка 7×7 без углов на высоте 5–7, у красного —
// купол (крышка 3×3 и три кольца стенок) на высоте 4–6. Генератор ставит их в грибных полях, костная мука
// выращивает из маленького гриба (world/behaviours/farming).
import { B } from "../registry/Blocks";

/** Поставить блок; soft — только в пустоту (шляпка не затирает соседей). */
export type MushroomPut = (
  x: number,
  y: number,
  z: number,
  id: number,
  soft: boolean,
) => void;

/** Радиус шляпки — генератор держит гриб в чанке. */
export const HUGE_MUSHROOM_RADIUS = 3;
export const HUGE_MUSHROOM_HEIGHT = 8;

/** Вырастить огромный гриб с ножкой из (x, y, z) вверх. */
export function growHugeMushroom(
  put: MushroomPut,
  x: number,
  y: number,
  z: number,
  red: boolean,
  rng: () => number,
): void {
  const h = (red ? 4 : 5) + Math.floor(rng() * 3);
  for (let k = 0; k < h; k++) put(x, y + k, z, B.mushroom_stem!, k > 0);
  if (!red) {
    for (let dx = -3; dx <= 3; dx++)
      for (let dz = -3; dz <= 3; dz++)
        if (Math.abs(dx) + Math.abs(dz) < 6)
          put(x + dx, y + h, z + dz, B.brown_mushroom_block!, true);
    return;
  }
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++)
      put(x + dx, y + h, z + dz, B.red_mushroom_block!, true);
  for (let dy = 1; dy <= 3; dy++)
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++)
        if (
          (Math.abs(dx) === 2 || Math.abs(dz) === 2) &&
          !(Math.abs(dx) === 2 && Math.abs(dz) === 2)
        )
          put(x + dx, y + h - dy, z + dz, B.red_mushroom_block!, true);
}
