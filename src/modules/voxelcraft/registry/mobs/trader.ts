// Странствующий торговец (Minecraft 1.14): приходит сам (EntityManager.spawnWanderingTrader — раз в
// 20 минут с шансом 25%) с двумя ламами на поводке, торгует саженцами, растениями и диковинками (сделки
// «wandering» — systems/Trading), через 40–60 минут уходит вместе с ламами (MobDef.leavesAfter).
import type { MobDef, MobPart } from "../../types";
import { addNames } from "../names";
import { HOOFED_MOBS } from "./hoofed";
import { VILLAGER_MOBS } from "./villager";

const LEAVE: [number, number] = [2400, 3600];
const recolor = (parts: MobPart[], map: Record<string, string>): MobPart[] =>
  parts.map((p) => ({ ...p, color: map[p.color ?? ""] ?? p.color }));

const villager = VILLAGER_MOBS.villager_farmer!;
const llama = HOOFED_MOBS.llama!;

export const TRADER_MOBS: Record<string, MobDef> = {
  wandering_trader: {
    ...villager,
    name: "wandering_trader",
    trades: "wandering",
    persistent: true, // не пропадает вдали — уходит сам по сроку
    leavesAfter: LEAVE,
    nightInvisible: true,
    // синяя мантия, голубой фартук
    parts: recolor(villager.parts, {
      "#6a4a32": "#2a4a8a",
      "#c8a040": "#3a6ab0",
    }),
  },
  trader_llama: {
    ...llama,
    name: "trader_llama",
    spawn: undefined,
    persistent: true,
    leavesAfter: LEAVE,
    parts: recolor(llama.parts, { "#b83a2a": "#3a6ab0" }), // синяя попона торговца
  },
};

addNames({
  wandering_trader: "Странствующий торговец",
  trader_llama: "Лама торговца",
});
