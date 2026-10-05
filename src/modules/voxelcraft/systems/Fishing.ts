// Улов, как в Minecraft (без Удачи моря): 85% рыба (треска 70%, лосось 30%), 10% мусор, 5% сокровище
// — зачарованная книга, лук или удочка с износом. Подсекает Interaction по поклёвке поплавка.
import { ENCHANT_IDS, withEnchants } from "./Enchant";
import type { ItemStack } from "../types";

const JUNK = ["stick", "string", "bone", "leather", "rotten_flesh"];

export function fishLoot(rng: () => number): ItemStack {
  const r = rng();
  if (r < 0.05) {
    const k = rng();
    if (k < 0.4) {
      const id = ENCHANT_IDS[Math.floor(rng() * ENCHANT_IDS.length)]!;
      return withEnchants(
        { item: "enchanted_book", count: 1 },
        { [id]: 1 + Math.floor(rng() * 2) },
      );
    }
    if (k < 0.65)
      return { item: "bow", count: 1, dmg: Math.floor(rng() * 150) };
    if (k < 0.85)
      return { item: "fishing_rod", count: 1, dmg: Math.floor(rng() * 40) };
    return { item: rng() < 0.55 ? "saddle" : "nautilus_shell", count: 1 };
  }
  if (r < 0.15)
    return { item: JUNK[Math.floor(rng() * JUNK.length)]!, count: 1 };
  // рыба, как в Minecraft: треска 60%, лосось 25%, иглобрюх 13%, тропическая 2%
  const f = rng();
  return {
    item:
      f < 0.6
        ? "cod"
        : f < 0.85
          ? "salmon"
          : f < 0.98
            ? "pufferfish"
            : "tropical_fish",
    count: 1,
  };
}
