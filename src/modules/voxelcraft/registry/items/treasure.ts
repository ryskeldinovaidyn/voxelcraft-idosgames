// Море и клады: вёдра с рыбой (ведро воды по рыбе — поймать, вылить — выпустить вместе с водой),
// карта сокровищ (из сундука затонувшего корабля; в руке превращается в карту с крестиком над
// зарытым кладом), сердце моря (в кладе) и раковина наутилуса — из них проводник.
import type { ItemDef } from "../../types";
import { addNames } from "../names";
import { item } from "./define";

/** Ведро с рыбой → какая рыба в нём. */
export const FISH_BUCKETS: Record<string, string> = {
  cod_bucket: "cod",
  salmon_bucket: "salmon",
  tropical_fish_bucket: "tropical_fish",
  pufferfish_bucket: "pufferfish",
  axolotl_bucket: "axolotl",
  tadpole_bucket: "tadpole",
};

export const TREASURE_ITEMS: ItemDef[] = [
  ...Object.keys(FISH_BUCKETS).map((name) =>
    item({ name, tile: name, maxStack: 1 }),
  ),
  item({ name: "treasure_map", tile: "treasure_map", maxStack: 1 }),
  item({ name: "heart_of_the_sea", tile: "heart_of_the_sea" }),
  item({ name: "nautilus_shell", tile: "nautilus_shell" }),
];

addNames({
  cod_bucket: "Ведро с треской",
  salmon_bucket: "Ведро с лососем",
  tropical_fish_bucket: "Ведро с тропической рыбой",
  pufferfish_bucket: "Ведро с иглобрюхом",
  axolotl_bucket: "Ведро с аксолотлем",
  treasure_map: "Карта сокровищ",
  heart_of_the_sea: "Сердце моря",
  nautilus_shell: "Раковина наутилуса",
  buried_treasure: "Зарытый клад",
});
