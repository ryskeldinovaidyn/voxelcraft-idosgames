// Заражённые блоки, как в Minecraft: выглядят как камень, кирпич, булыжник, ломаются быстрее, ничего
// не роняют — из них вылезает чешуйница (EntityManager слушает blockBreak). Встречаются в стенах
// Подземных цитаделей (worldgen/features/citadel). Предмета нет — в креативе выбирается обычный блок.
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { all, block } from "./define";

const INF: Partial<BlockDef> = {
  hardness: 0.75,
  tool: "pickaxe",
  drops: [],
  noItem: true,
};

export const INFESTED_BLOCKS: BlockDef[] = [
  block({
    name: "infested_stone",
    ...INF,
    item: "stone",
    tex: all("stone"),
    mapColor: 0x7d7d7d,
  }),
  block({
    name: "infested_cobblestone",
    ...INF,
    item: "cobblestone",
    tex: all("cobblestone"),
    mapColor: 0x828282,
  }),
  block({
    name: "infested_stone_bricks",
    ...INF,
    item: "stone_bricks",
    tex: all("stone_bricks"),
    mapColor: 0x7a7a7a,
  }),
];

addNames({
  infested_stone: "Заражённый камень",
  infested_cobblestone: "Заражённый булыжник",
  infested_stone_bricks: "Заражённый каменный кирпич",
});

/** Имена заражённых блоков (id по ним строит EntityManager — реестр к тому времени собран). */
export const INFESTED_NAMES: readonly string[] = INFESTED_BLOCKS.map(
  (b) => b.name,
);
