// Рецепт мира БЕЗ ИИ: из текста (ключевые слова, русский и английский) и разбора картинки.
// Бесплатно и офлайн. ИИ-путь отдаёт тот же WorldSpec — всё дальше общее.
import { CONFIG } from "../config";
import { mulberry32 } from "../core/Noise";
import {
  bytesToBase64,
  parseWorldSpec,
  type Biome,
  type StructureType,
  type TerrainShape,
  type TimeOfDay,
  type WorldSize,
  type WorldSpec,
} from "./WorldSpec";
import {
  IMAGE_LAND_PALETTE,
  nearestBlock,
  type MoodResult,
  type TopDownResult,
} from "./ImageAnalyzer";

type Rule<T> = [RegExp, T];

const SHAPE_RULES: Rule<TerrainShape>[] = [
  [/архипелаг|острова|archipelago|islands/, "archipelago"],
  [/остров|island/, "island"],
  [/гор[аыноу]|горн|скал|пик|mountain|peak|cliff/, "mountains"],
  [/долин|каньон|ущель|рек[аиу]|valley|canyon|river/, "valley"],
  [/плато|столов|plateau|mesa/, "plateau"],
  [/равнин|степ|поле|plain|flat|field|steppe/, "flat"],
  [/материк|континент|continent/, "continent"],
];

const BIOME_RULES: Rule<Biome>[] = [
  [/берёз|берез|birch/, "birch_forest"],
  [/тайг|ель|ёл|елов|хвой|pine|spruce|taiga|conifer/, "taiga"],
  [/джунгл|тропическ|jungle|rainforest/, "jungle"],
  [/лес|роща|чащ|forest|wood/, "forest"],
  [
    /снег|снеж|зим|лёд|лед|ледян|мороз|арктик|snow|winter|ice|frozen|arctic/,
    "snow",
  ],
  [/пустын|дюн|бархан|desert|dune/, "desert"],
  [/красн.*скал|бесплод|badlands|red rock/, "badlands"],
  [/пляж|пальм|побереж|beach|palm|coast/, "beach"],
  [/болот|топь|трясин|swamp|marsh|bog/, "swamp"],
  [/саванн|savanna/, "savanna"],
  [/камен|валун|stone|rocky|boulder/, "rocky"],
  [/луг|цвет|поляна|meadow|flower|glade/, "meadow"],
];

// Русские слова — по основе, а не по словарной форме: «с замком», «у замка», «стеной».
const STRUCTURE_RULES: Rule<StructureType>[] = [
  [/замок|замк|крепост|цитадел|castle|fortress|citadel/, "castle"],
  [/деревн|посёл|посел|город|village|town|hamlet/, "village"],
  [/дом|хижин|избушк|house|cabin|hut|cottage/, "house"],
  [/башн|маяк|tower|lighthouse/, "tower"],
  [/мост|bridge/, "bridge"],
  [/стен[аыуое]|стенк|оград|wall/, "wall"],
  [/руин|развалин|древн|ruin|ancient/, "ruins"],
  [/пирамид|pyramid/, "pyramid"],
  [/колодец|колодц|well/, "well"],
  [/ферм|огород|поле пшен|farm|crop/, "farm"],
  [/озер|озёр|пруд|lake|pond/, "pond"],
  [/дорог|тропа|путь|road|path/, "road"],
];

const TIME_RULES: Rule<TimeOfDay>[] = [
  [/ноч|луна|звёзд|звезд|night|moon|star/, "night"],
  [/закат|вечер|sunset|evening|dusk/, "sunset"],
  [/рассвет|утр|dawn|sunrise|morning/, "dawn"],
];

const all = <T>(text: string, rules: Rule<T>[]): T[] =>
  rules.filter(([re]) => re.test(text)).map(([, v]) => v);

/** Биом по «настроению» картинки, если текст про биомы молчит. */
function biomesFromMood(m: MoodResult): Biome[] {
  const s = m.shares;
  const out: Biome[] = [];
  if (s.snow > 0.25) out.push("snow");
  if (s.sand > 0.25) out.push("desert");
  if (s.red > 0.2) out.push("badlands");
  if (s.green > 0.2) out.push(m.luma < 0.45 ? "forest" : "meadow");
  if (s.gray > 0.35) out.push("rocky");
  return out;
}

/** Материал стен/крыши по доминирующим цветам картинки. */
function paletteFromMood(m: MoodResult): { wall?: string; roof?: string } {
  const build = [
    "planks",
    "dark_planks",
    "stone_bricks",
    "bricks",
    "sandstone",
    "cobblestone",
    "white_wool",
    "terracotta",
  ];
  const warm = m.dominant.filter(
    (d) => Math.max(d.r, d.g, d.b) - Math.min(d.r, d.g, d.b) > 30,
  );
  const pickFor = (d: { r: number; g: number; b: number } | undefined) =>
    d ? build[nearestBlock(d.r, d.g, d.b, build)] : undefined;
  return {
    wall: pickFor(m.dominant[0]),
    roof: pickFor(warm[0] ?? m.dominant[1]),
  };
}

/** Слои картинки «карта сверху» в формате рецепта. */
export function topDownLayers(td: TopDownResult, waterLevel: number) {
  const low = Math.max(2, waterLevel - 6);
  const high = Math.min(CONFIG.chunk.sy - 14, waterLevel + 22);
  const v = (y: number) => Math.round(((y - low) / (high - low)) * 255);
  const vWater = v(waterLevel - 3),
    vShore = v(waterLevel + 1);
  const n = td.w * td.h;
  const heights = new Uint8Array(n);
  const surface = new Uint8Array(n);
  const palette = [...IMAGE_LAND_PALETTE, "water"];
  const waterIdx = palette.length - 1;
  for (let i = 0; i < n; i++) {
    if (td.water[i]) {
      heights[i] = vWater;
      surface[i] = waterIdx;
    } else {
      heights[i] = Math.round(vShore + td.elevation[i]! * (255 - vShore));
      surface[i] = td.surface[i]!;
    }
  }
  return {
    heightmap: { w: td.w, h: td.h, low, high, data: bytesToBase64(heights) },
    surfaceMap: { w: td.w, h: td.h, palette, data: bytesToBase64(surface) },
  };
}

export interface NoAIInput {
  text: string;
  size: WorldSize;
  seed: number;
  topDown?: TopDownResult;
  mood?: MoodResult;
}

/** Рецепт из текста и разбора картинки. Всегда валиден (проходит parseWorldSpec). */
export function buildSpecWithoutAI(input: NoAIInput): WorldSpec {
  const text = input.text.toLowerCase();
  const rng = mulberry32(input.seed ^ 0x5bd1e995);
  const water = CONFIG.world.waterLevel;

  let shape: TerrainShape | undefined = all(text, SHAPE_RULES)[0];
  let biomes = all(text, BIOME_RULES);
  if (!biomes.length && input.mood) biomes = biomesFromMood(input.mood);
  if (!shape && input.mood && input.mood.shares.water > 0.35)
    shape = "archipelago";
  const structures = all(text, STRUCTURE_RULES);
  if (structures.includes("bridge") && !shape) shape = "valley"; // мосту нужна река
  shape ??= input.size.mode === "island" ? "island" : "continent";
  const time = all(text, TIME_RULES)[0] ?? "day";

  const zones: Record<string, unknown>[] = [];
  const primary = biomes[0] ?? (shape === "mountains" ? "taiga" : "meadow");
  zones.push({ x: 0.5, z: 0.5, radius: 0.5, biome: primary });
  biomes.slice(1, 5).forEach((biome, i, rest) => {
    const a = (i / rest.length) * Math.PI * 2 + rng() * 0.6;
    zones.push({
      x: 0.5 + Math.cos(a) * 0.3,
      z: 0.5 + Math.sin(a) * 0.3,
      radius: 0.28,
      biome,
    });
  });

  const placed: Record<string, unknown>[] = [];
  const spot = () => ({ x: 0.3 + rng() * 0.4, z: 0.3 + rng() * 0.4 });
  const settlements: { x: number; z: number }[] = [];
  for (const type of structures) {
    if (type === "road") continue; // дороги — ниже, между поселениями
    if (type === "bridge") {
      placed.push({ type, x: 0.35, z: 0.5, x2: 0.65, z2: 0.5 });
      continue;
    }
    if (type === "wall") {
      const p = spot();
      placed.push({
        type,
        x: p.x - 0.15,
        z: p.z,
        x2: p.x + 0.15,
        z2: p.z,
        size: "medium",
      });
      continue;
    }
    const p = type === "castle" ? { x: 0.5, z: 0.45 } : spot();
    placed.push({
      type,
      ...p,
      size: type === "castle" || type === "village" ? "large" : "medium",
      rotation: Math.floor(rng() * 4) * 90,
    });
    if (["castle", "village", "house", "tower"].includes(type))
      settlements.push(p);
  }
  if (structures.includes("road") || settlements.length > 1)
    for (let i = 1; i < settlements.length; i++) {
      const a = settlements[0]!,
        b = settlements[i]!;
      placed.push({
        type: "road",
        x: a.x,
        z: a.z,
        x2: b.x,
        z2: b.z,
        size: "small",
      });
    }
  // немного природы, если постройки не заказаны
  if (!placed.length) {
    if (primary === "rocky" || shape === "mountains")
      placed.push({ type: "rock", ...spot(), size: "large" });
    if (["forest", "birch_forest", "taiga", "jungle"].includes(primary))
      placed.push({ type: "tree_cluster", ...spot(), size: "large" });
    if (primary === "meadow")
      placed.push({ type: "pond", ...spot(), size: "medium" });
  }

  const amplitude = shape === "mountains" ? 22 : shape === "flat" ? 4 : 12;
  const terrain: Record<string, unknown> = {
    shape,
    baseHeight: shape === "mountains" ? 30 : water + 5,
    amplitude,
    roughness: shape === "mountains" ? 0.7 : 0.45,
    waterLevel: water,
  };
  if (input.topDown)
    Object.assign(terrain, topDownLayers(input.topDown, water));

  const trimmed = input.text.trim().replace(/\s+/g, " ");
  const name = trimmed
    ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1, 40)
    : input.topDown || input.mood
      ? "Мир по картинке"
      : "Новый мир";

  const parsed = parseWorldSpec(
    {
      name,
      description: trimmed.slice(0, 500),
      seed: input.seed,
      size: input.size,
      terrain,
      zones,
      structures: placed,
      palette: input.mood ? paletteFromMood(input.mood) : {},
      ambience: { timeOfDay: time },
    },
    { fallbackSeed: input.seed },
  );
  if (!parsed.ok) throw new Error(parsed.error); // объект собран здесь же — отказа быть не может
  return parsed.spec;
}
