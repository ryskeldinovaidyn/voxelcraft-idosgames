// Предметы глубокой тьмы: осколок эха (в сундуках древнего города) и компас возвращения из него —
// стрелка указывает на место последней смерти (ui/HUD._gadget).
import type { ItemDef } from "../../types";
import { addNames } from "../names";
import { item } from "./define";

export const SCULK_ITEMS: ItemDef[] = [
  item({ name: "echo_shard", tile: "echo_shard" }),
  item({ name: "recovery_compass", tile: "recovery_compass", maxStack: 1 }),
];

addNames({
  echo_shard: "Осколок эха",
  recovery_compass: "Компас возвращения",
  warden: "Страж",
});
