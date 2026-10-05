// Утилиты: вёдра (вода и лава для обсидиана, молоко), огниво (огонь, TNT, портал).
import type { ItemDef } from "../../types";
import { item } from "./define";

export const UTILITY_ITEMS: ItemDef[] = [
  item({ name: "bucket", tile: "bucket", maxStack: 16 }),
  item({
    name: "water_bucket",
    tile: "water_bucket",
    maxStack: 1,
    remainder: "bucket",
  }),
  // ведро лавы — топливо печи на 1000 с, возвращается пустым ведром
  item({
    name: "lava_bucket",
    tile: "lava_bucket",
    maxStack: 1,
    fuel: 1000,
    remainder: "bucket",
  }),
  // молоко снимает все эффекты зелий, как в Minecraft
  item({
    name: "milk_bucket",
    tile: "milk_bucket",
    maxStack: 1,
    remainder: "bucket",
    drink: { clearsEffects: true },
  }),
  item({
    name: "flint_and_steel",
    tile: "flint_and_steel",
    kind: "tool",
    maxStack: 1,
    durability: 64,
  }),
];
