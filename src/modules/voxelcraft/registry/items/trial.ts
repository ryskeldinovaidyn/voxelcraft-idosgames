// Предметы испытательных камер: ключ испытаний (награда спавнера, открывает хранилище), стержень вихря
// (с вихря) → заряды ветра (бросок ПКМ — порыв отбрасывает, в том числе самого бросившего), тяжёлое ядро
// (редко в хранилище) и булава из ядра и стержня: удар в падении — урон от высоты (maceBonus), падение
// гасится.
import type { ItemDef } from "../../types";
import { addNames } from "../names";
import { item } from "./define";

/** Урон булавы сверх обычного за падение на fall блоков (как в Minecraft): +4 за первые 3, +2 за следующие 5, +1 дальше. */
export function maceBonus(fall: number): number {
  if (fall <= 1.5) return 0;
  return (
    4 * Math.min(fall, 3) +
    2 * Math.min(Math.max(fall - 3, 0), 5) +
    Math.max(fall - 8, 0)
  );
}

/** Весь урон сокрушения: maceBonus и Плотность (+0.5 за блок падения за уровень); без падения — 0. */
export function maceSmash(fall: number, density = 0): number {
  const b = maceBonus(fall);
  return b > 0 ? b + 0.5 * density * fall : 0;
}

export const TRIAL_ITEMS: ItemDef[] = [
  item({ name: "trial_key", tile: "trial_key" }),
  item({ name: "breeze_rod", tile: "breeze_rod" }),
  item({ name: "wind_charge", tile: "wind_charge" }),
  item({ name: "heavy_core", tile: "heavy_core", maxStack: 1 }),
  item({
    name: "mace",
    tile: "mace",
    kind: "tool",
    maxStack: 1,
    damage: 6,
    durability: 500,
  }),
];

addNames({
  trial_key: "Ключ испытаний",
  breeze_rod: "Стержень вихря",
  wind_charge: "Заряд ветра",
  heavy_core: "Тяжёлое ядро",
  mace: "Булава",
  breeze: "Вихрь",
});
