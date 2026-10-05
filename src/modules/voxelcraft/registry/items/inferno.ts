// Предметы Пекла: светокаменная пыль, кварц, адский кирпич (плавится из адского камня).
import type { ItemDef } from "../../types";
import { item } from "./define";

export const INFERNO_ITEMS: ItemDef[] = [
  item({ name: "glowstone_dust", tile: "glowstone_dust" }),
  item({ name: "quartz", tile: "quartz" }),
  item({ name: "inferno_brick", tile: "inferno_brick" }),
  // добыча мобов Пекла
  item({ name: "flame_rod", tile: "flame_rod", fuel: 120 }), // топливо на 120 с, как в Minecraft
  item({ name: "flame_powder", tile: "flame_powder" }),
  item({ name: "wailer_tear", tile: "wailer_tear" }),
  // пеклит: обломки плавятся в лом, 4 лома + 4 золота = слиток
  item({ name: "infernite_scrap", tile: "infernite_scrap" }),
  item({ name: "infernite_ingot", tile: "infernite_ingot" }),
];
