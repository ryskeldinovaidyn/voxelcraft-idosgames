// Музыкальные пластинки, как в Minecraft: вставил в проигрыватель — играет своя мелодия, вынул —
// замолкает. Мелодии не файлы: у каждой пластинки свой сид и свой лад (systems/Music сочиняет пьесу
// из сида), поэтому «Уголь» звучит по-пекловски, а «Пустота» — по-предельному. Чистые данные.
import type { Mood } from "./Music";

export interface DiscDef {
  name: string;
  /** Лад мелодии (systems/Music). */
  mood: Mood;
  /** Сид пьесы — мелодия пластинки всегда одна и та же. */
  seed: number;
}

export const DISCS: readonly DiscDef[] = [
  { name: "disc_dawn", mood: "overworld", seed: 0x1d0a },
  { name: "disc_drift", mood: "overworld", seed: 0x2f41 },
  { name: "disc_hollow", mood: "overworld", seed: 0x3b77 },
  { name: "disc_ember", mood: "inferno", seed: 0x4c19 },
  { name: "disc_void", mood: "beyond", seed: 0x5e05 },
];

const BY_NAME = new Map(DISCS.map((d) => [d.name, d]));

/** Пластинка ли это. */
export const isDisc = (item: string | null | undefined): boolean =>
  !!item && BY_NAME.has(item);

/** Описание пластинки (null — не пластинка). */
export const discOf = (item: string | null | undefined): DiscDef | null =>
  (item && BY_NAME.get(item)) || null;
