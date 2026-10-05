// Зомби-житель: во что превращается житель, убитый зомби (systems/Zombify). Горит на солнце, как
// вся нежить; лечится золотым яблоком (Interaction) и возвращает свою профессию с опытом.
import type { MobDef } from "../../types";
import { humanoid } from "./hostile";

const FORWARD: [number, number, number] = [-Math.PI / 2, 0, 0];

export const ZOMBIE_VILLAGER_MOBS: Record<string, MobDef> = {
  zombie_villager: {
    name: "zombie_villager",
    category: "hostile",
    hp: 20,
    walkSpeed: 1.1,
    fleeSpeed: 2.2,
    chaseSpeed: 2.2,
    follow: 24,
    box: { w: 0.6, h: 1.95 },
    attack: { damage: 3, reach: 1.2, cooldown: 1 },
    burnsInSun: true,
    curable: true,
    drops: [{ item: "rotten_flesh", n: 0, max: 2 }],
    xp: [5, 5],
    // зелёная кожа зомби и коричневая мантия жителя
    parts: humanoid({
      skin: "#5a8a3a",
      shirt: "#6a4a32",
      pants: "#4a3a28",
      eyes: "#1a2a1a",
      armPose: FORWARD,
    }),
  },
};
