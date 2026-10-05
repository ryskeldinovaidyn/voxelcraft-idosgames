// Лягушки и магмовые кубы: магмовый крем (с маленького магмового куба); названия лягушек и головастика.
import type { ItemDef } from "../../types";
import { addNames } from "../names";
import { item } from "./define";

export const FROG_ITEMS: ItemDef[] = [
  item({ name: "magma_cream", tile: "magma_cream" }),
];

addNames({
  magma_cream: "Магмовый крем",
  frog_temperate: "Лягушка",
  frog_warm: "Лягушка",
  frog_cold: "Лягушка",
  tadpole: "Головастик",
  tadpole_bucket: "Ведро с головастиком",
  magma_cube: "Магмовый куб",
  magma_cube_medium: "Магмовый куб",
  magma_cube_small: "Магмовый куб",
});
