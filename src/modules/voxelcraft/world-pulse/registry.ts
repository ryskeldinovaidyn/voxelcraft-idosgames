import { FallingStar } from "./events/FallingStar";
import { MeteorImpact } from "./events/MeteorImpact";
import { AnimalMigration } from "./events/AnimalMigration";
import type { EventHandler, FragmentSite } from "./types";

/** Новое событие подключается здесь после создания definition и handler. */
export function worldPulseHandlers(addFragments: (sites: FragmentSite[]) => void): EventHandler[] {
  return [new FallingStar(), new MeteorImpact(addFragments), new AnimalMigration()];
}
