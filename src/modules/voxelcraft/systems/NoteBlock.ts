// Нотный блок, как в Minecraft: высота ноты — мета (25 полутонов, две октавы), а ТЕМБР задаёт блок
// ПОД ним: по дереву — бас, по камню — большой барабан, по песку — малый, по стеклу — щелчок,
// по золоту — колокольчик, иначе — арфа. Чистая таблица: её зовут поведение блока (звук — Audio)
// и тесты.

export interface Instrument {
  id: string;
  name: string;
  /** Форма волны и длительность — их берёт systems/Audio. */
  wave: OscillatorType;
  seconds: number;
  /** Шум вместо тона (барабаны). */
  noise?: boolean;
}

export const INSTRUMENTS: Record<string, Instrument> = {
  harp: { id: "harp", name: "Арфа", wave: "triangle", seconds: 0.5 },
  bass: { id: "bass", name: "Бас", wave: "sine", seconds: 0.8 },
  bell: { id: "bell", name: "Колокольчик", wave: "sine", seconds: 1.4 },
  flute: { id: "flute", name: "Флейта", wave: "sine", seconds: 0.7 },
  guitar: { id: "guitar", name: "Гитара", wave: "sawtooth", seconds: 0.4 },
  basedrum: {
    id: "basedrum",
    name: "Большой барабан",
    wave: "square",
    seconds: 0.2,
    noise: true,
  },
  snare: {
    id: "snare",
    name: "Малый барабан",
    wave: "square",
    seconds: 0.15,
    noise: true,
  },
  hat: {
    id: "hat",
    name: "Щелчок",
    wave: "square",
    seconds: 0.08,
    noise: true,
  },
};

const has = (name: string, ...parts: string[]): boolean =>
  parts.some((p) => name.includes(p));

/** Инструмент по имени блока под нотным блоком. */
export function instrumentBelow(block: string | null | undefined): Instrument {
  const n = block ?? "";
  if (!n || n === "air") return INSTRUMENTS.harp!;
  if (n === "gold_block") return INSTRUMENTS.bell!;
  if (has(n, "_wool")) return INSTRUMENTS.guitar!;
  if (has(n, "clay", "terracotta")) return INSTRUMENTS.flute!;
  if (has(n, "glass")) return INSTRUMENTS.hat!;
  if (has(n, "sand", "gravel")) return INSTRUMENTS.snare!;
  if (has(n, "planks", "_log", "wood", "bamboo", "barrel", "chest"))
    return INSTRUMENTS.bass!;
  if (
    has(
      n,
      "stone",
      "brick",
      "deepslate",
      "basalt",
      "obsidian",
      "ore",
      "tuff",
      "granite",
      "diorite",
      "andesite",
    )
  )
    return INSTRUMENTS.basedrum!;
  return INSTRUMENTS.harp!;
}

/** Частота ноты: 25 полутонов от ля малой октавы, как в Minecraft. */
export const noteFrequency = (pitch: number): number =>
  220 * Math.pow(2, pitch / 12);
