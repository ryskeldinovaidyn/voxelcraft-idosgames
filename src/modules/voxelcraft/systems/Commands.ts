// Команды консоли, как в Minecraft (/give, /tp, /time…). Текст приходит интентом Command (из
// консоли игрока или от агента AI-кодера) и исполняется на тике — тем же путём, что и остальной
// ввод. Выключаются целиком CONFIG.commands.enabled (издатель может закрыть читы в своей игре).
import { CONFIG } from "../config";
import {
  DIFFICULTY_NAMES,
  parseDifficulty,
  rules,
  setDifficulty,
} from "./Difficulty";
import { events } from "../core/EventBus";
import { ALIASES, resolveBlock, resolveItem } from "../registry/aliases";
import { B, packWater } from "../registry/Blocks";
import { MOBS } from "../registry/Mobs";
import { ITEMS } from "../registry/Items";
import { ENCHANTS, enchantLine, withEnchants, type EnchantId } from "./Enchant";
import { EFFECT_NAMES, labelOf } from "../registry/names";
import { startCharge } from "../entities/AshLordBrain";
import { ACHIEVEMENTS } from "./Achievements";
import type { Game } from "../main";
import type { EffectId } from "../types";

type Handler = (game: Game, args: string[]) => string;

const WORLD_BORDER = 30_000_000;

/** Координата: число или `~`/`~N` относительно игрока. */
function coord(arg: string | undefined, base: number): number {
  if (arg === undefined) throw new Error("не хватает координат");
  // `~abc` раньше давал NaN: игрок улетал в NaN-координаты, и мир переставал грузиться насовсем
  const v = arg.startsWith("~")
    ? base + (arg.length > 1 ? Number(arg.slice(1)) : 0)
    : Number(arg);
  if (!Number.isFinite(v)) throw new Error("не число: " + arg);
  // граница мира, как в Minecraft: на 1e300 шум генератора и ключи чанков теряют точность
  if (Math.abs(v) > WORLD_BORDER)
    throw new Error(`за границей мира (±${WORLD_BORDER}): ${arg}`);
  return v;
}

/** Три координаты начиная с args[i] (целые — для блоков). */
function xyz(
  game: Game,
  args: string[],
  i: number,
  whole: boolean,
): [number, number, number] {
  const p = game.player.pos;
  const r = [
    coord(args[i], p.x),
    coord(args[i + 1], p.y),
    coord(args[i + 2], p.z),
  ] as [number, number, number];
  return whole ? (r.map(Math.floor) as [number, number, number]) : r;
}

function blockArg(name: string | undefined): number {
  const id = name === undefined ? null : resolveBlock(name);
  if (id === null) throw new Error("нет такого блока: " + name);
  return id;
}

/** Мета по умолчанию: жидкость ставится источником (как в Minecraft), иначе 0 — вода с метой 0 утекает. */
const defaultMeta = (id: number): number =>
  id === B.water || id === B.lava ? packWater(8, true) : 0;

const TIMES: Record<string, (d: number, n: number) => number> = {
  day: (d) => d * 0.3,
  noon: (d) => d * 0.5,
  sunset: (d) => d * 0.94,
  night: (d, n) => d + n * 0.3,
  midnight: (d, n) => d + n * 0.5,
};

const HANDLERS: Record<string, Handler> = {
  help: () =>
    "Команды: /give <предмет> [n], /tp x y z, /time set day|noon|night|midnight|<сек>, /weather clear|rain|thunder [сек], " +
    "/difficulty мирная|лёгкая|обычная|высокая, /gamemode survival|creative, /setblock x y z <блок> [мета], /fill x1 y1 z1 x2 y2 z2 <блок>, " +
    "/summon <моб> [x y z], /kill [моб], /effect <эффект>|clear [сек] [уровень], /achievements, /music on|off|next, /event <команда>, /tutorial status|reset|auto|full|light|off|trigger, /clear, /seed, /locate fortress|citadel|village|outpost|temple|shipwreck|buried_treasure|mansion|ancient_city|trail_ruins|trial_chambers|city, /enchant <зачарование> [уровень], /newworld [сид]. Координаты можно с ~ (относительно себя).",

  tutorial: (g, args) => g.onboarding.command(args),

  event: (g, args) => {
    if (g.net && !g.net.isHost) throw new Error("World Pulse: команды доступны только владельцу мира");
    return g.worldPulse.command(args);
  },

  give: (g, [name, n]) => {
    const item = name === undefined ? null : resolveItem(name);
    if (!item) throw new Error("нет такого предмета: " + name);
    const count = Math.max(
      1,
      Math.min(64 * 36, Math.floor(Number(n ?? 1)) || 1),
    );
    const left = g.inventory.add(item, count);
    if (left > 0) {
      const p = g.player.pos;
      g.entities.spawnDrop(p.x, p.y + 1, p.z, item, left);
    }
    return `Выдано: ${labelOf(item)} ×${count}`;
  },

  tp: (g, args) => {
    const [x, y, z] = xyz(g, args, 0, false);
    g.warmup(x, z);
    if (g.player.riding) g.player.dismount(); // телепорт высаживает из транспорта, как в Minecraft
    g.player.pos.set(x, y, z);
    g.player.vel.set(0, 0, 0);
    g.player._fallDist = 0;
    return `Телепорт: ${x.toFixed(1)} ${y.toFixed(1)} ${z.toFixed(1)}`;
  },

  time: (g, [op, v]) => {
    const { dayLength, nightLength } = CONFIG.dayNight;
    const cycle = dayLength + nightLength;
    if (op === "set" && v !== undefined) {
      const named = TIMES[v];
      const t = named ? named(dayLength, nightLength) : Number(v);
      if (!Number.isFinite(t))
        throw new Error("время: day, noon, night, midnight или секунды");
      g.dayNight.time = ((t % cycle) + cycle) % cycle;
    } else if (op === "add" && v !== undefined) {
      const dt = Number(v);
      if (!Number.isFinite(dt)) throw new Error("не число: " + v); // NaN ломал небо и свет
      g.dayNight.time = (((g.dayNight.time + dt) % cycle) + cycle) % cycle;
    } else throw new Error("/time set <день|ночь|сек> или /time add <сек>");
    return "Время: " + Math.round(g.dayNight.time) + " c";
  },

  weather: (g, [k, sec]) => {
    if (k !== "clear" && k !== "rain" && k !== "thunder")
      throw new Error("/weather clear|rain|thunder [сек]");
    const s = sec === undefined ? undefined : Number(sec);
    if (s !== undefined && !(s > 0)) throw new Error("не число: " + sec);
    g.weather.set(k, s);
    return (
      "Погода: " + (k === "clear" ? "ясно" : k === "rain" ? "дождь" : "гроза")
    );
  },

  gamemode: (g, [m]) => {
    const mode =
      m === "creative" || m === "1" || m === "c"
        ? "creative"
        : m === "survival" || m === "0" || m === "s"
          ? "survival"
          : null;
    if (!mode) throw new Error("/gamemode survival|creative");
    if (g.player.mode !== mode) g.player.toggleMode();
    return "Режим: " + (mode === "creative" ? "креатив" : "выживание");
  },

  difficulty: (g, [d]) => {
    const next = parseDifficulty(d);
    if (!next)
      throw new Error("/difficulty мирная|лёгкая|обычная|высокая (0..3)");
    setDifficulty(next);
    // на мирной монстры исчезают сразу, как в Minecraft
    if (!rules().hostiles) g.entities.clearHostiles();
    events.emit("difficultyChanged", { difficulty: next });
    return "Сложность: " + DIFFICULTY_NAMES[next];
  },

  setblock: (g, args) => {
    const [x, y, z] = xyz(g, args, 0, true);
    const id = blockArg(args[3]);
    const meta =
      args[4] === undefined ? defaultMeta(id) : Number(args[4]) & 255;
    if (!g.world.setBlock(x, y, z, id, meta))
      throw new Error("клетка вне загруженного мира");
    return `Блок ${labelOf(args[3]!)} в ${x} ${y} ${z}`;
  },

  fill: (g, args) => {
    const [x1, y1, z1] = xyz(g, args, 0, true);
    const [x2, y2, z2] = xyz(g, args, 3, true);
    const id = blockArg(args[6]);
    const cells =
      (Math.abs(x2 - x1) + 1) *
      (Math.abs(y2 - y1) + 1) *
      (Math.abs(z2 - z1) + 1);
    if (cells > 65536)
      throw new Error(`слишком много блоков: ${cells} (максимум 65536)`);
    const meta = defaultMeta(id);
    let n = 0;
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
        for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++)
          if (g.world.setBlock(x, y, z, id, meta)) n++;
    return `Заполнено блоков: ${n}`;
  },

  achievements: (g) => {
    const got = ACHIEVEMENTS.filter((a) => g.achievements.done.has(a.id)).map(
      (a) => a.title,
    );
    return `Достижения ${got.length}/${ACHIEVEMENTS.length}: ${got.join(", ") || "пока нет"} (L — список)`;
  },

  music: (g, [op]) => {
    if (op === "off") {
      g.music.enabled = false;
      g.music.stop();
      return "Музыка выключена";
    }
    if (op === "on" || op === "next") {
      g.music.enabled = true;
      if (op === "next") g.music.next();
      return op === "next" ? "Сейчас заиграет" : "Музыка включена";
    }
    return (
      "Музыка: " +
      { off: "выключена", playing: "играет", waiting: "ждёт своего часа" }[
        g.music.status
      ]
    );
  },

  effect: (g, [id, sec, lvl]) => {
    if (id === "clear") {
      g.player.clearEffects();
      return "Эффекты сняты";
    }
    if (!id || !EFFECT_NAMES[id])
      throw new Error(
        "нет такого эффекта: " +
          id +
          " (" +
          Object.keys(EFFECT_NAMES).join(", ") +
          ")",
      );
    const seconds = sec === undefined ? 30 : Number(sec),
      level = lvl === undefined ? 1 : Number(lvl);
    if (!(seconds > 0) || !(level >= 1))
      throw new Error("время и уровень — положительные числа");
    g.player.addEffect(id as EffectId, seconds, Math.floor(level));
    return `${EFFECT_NAMES[id]} ${Math.floor(level)} на ${seconds} с`;
  },

  summon: (g, args) => {
    // Minecraft-имена существ тоже годятся (/summon wither)
    const type =
      args[0] === undefined
        ? undefined
        : MOBS[args[0]]
          ? args[0]
          : ALIASES[args[0].toLowerCase()];
    if (!type || !MOBS[type])
      throw new Error("нет такого существа: " + args[0]);
    const [x, y, z] =
      args.length >= 4
        ? xyz(g, args, 1, false)
        : [g.player.pos.x + 2, g.player.pos.y, g.player.pos.z];
    const m = g.entities.spawnMob(type, x, y, z);
    if (m.def.boss === "ash_lord") startCharge(m); // как призванный: сперва набирает силу
    return "Призвано: " + labelOf(type);
  },

  // без аргумента — игрок; с видом моба — все такие в 64 блоках, обычной смертью (с дропом и распадом)
  kill: (g, [type]) => {
    if (!type) {
      g.player._die();
      return "Игрок погиб";
    }
    if (!MOBS[type]) throw new Error("нет такого существа: " + type);
    let n = 0;
    for (const e of g.entities.entities.values())
      if (
        e.kind === "mob" &&
        !e.dead &&
        e.def.name === type &&
        e.pos.distanceTo(g.player.pos) < 64
      ) {
        e.damage(e.hp);
        n++;
      }
    return `Убито: ${labelOf(type)} × ${n}`;
  },

  clear: (g) => {
    // карманы и броня; сундук Предела — склад, /clear его не трогает (как в Minecraft)
    g.inventory.clearCarried();
    return "Инвентарь очищен";
  },

  seed: (g) => "Сид мира: " + g.world.seed,

  enchant: (g, [id, lvl]) => {
    const held = g.inventory.heldItem();
    if (!held) throw new Error("в руке пусто");
    if (!id || !(id in ENCHANTS))
      throw new Error("нет такого зачарования: " + (id ?? "?"));
    const e = ENCHANTS[id as EnchantId];
    const def = ITEMS[held.item];
    if (!def || !e.fits(def))
      throw new Error(`${e.name} не подходит к этому предмету`);
    const level = Math.max(
      1,
      Math.min(e.max, Math.floor(Number(lvl ?? 1)) || 1),
    );
    g.inventory.setSlot(
      g.inventory.hotbarIndex,
      withEnchants(held, { [id]: level }),
    );
    return "Зачаровано: " + enchantLine(id as EnchantId, level);
  },

  locate: (g, [what]) => {
    const kind =
      what === "fortress" || what === "крепость"
        ? "fortress"
        : what === "деревня"
          ? "village"
          : what === "город" || what === "end_city"
            ? "city"
            : what === "храм" ||
                what === "monument" ||
                what === "ocean_monument"
              ? "temple"
              : what === "корабль"
                ? "shipwreck"
                : what === "застава" || what === "pillager_outpost"
                  ? "outpost"
                  : what === "клад" || what === "treasure"
                    ? "buried_treasure"
                    : what === "особняк" || what === "woodland_mansion"
                      ? "mansion"
                      : what === "древний" || what === "древний_город"
                        ? "ancient_city"
                        : what === "руины" || what === "ruins"
                          ? "trail_ruins"
                          : what === "камеры" || what === "trial"
                            ? "trial_chambers"
                            : what;
    const p = g.player.pos;
    const found = kind ? g.world.generator.locate?.(kind, p.x, p.z) : null;
    if (!found)
      throw new Error(
        kind === "fortress" && g.dimension !== "inferno"
          ? "адские крепости есть только в Пекле"
          : "не нашлось: " + (what ?? "?"),
      );
    const d = Math.round(Math.hypot(found.x - p.x, found.z - p.z));
    return `Ближайшая: ${found.x} ${found.y} ${found.z} (${d} блоков)`;
  },

  newworld: (g, [s]) => {
    const seed =
      s !== undefined && Number.isFinite(Number(s))
        ? Number(s) >>> 0
        : (Math.random() * 1e9) >>> 0;
    g.newWorld(seed); // текущий мир остаётся в «Моих мирах»
    return "Новый мир, сид " + seed;
  },
};

export class Commands {
  /** Последние строки вывода (консоль игрока и ответ агенту). */
  log: string[] = [];

  constructor(private readonly game: Game) {}

  /** Исполнить строку команды (с `/` или без). Возвращает вывод. */
  run(text: string): string {
    const parts = text.trim().replace(/^\//, "").split(/\s+/);
    const name = (parts.shift() ?? "").toLowerCase();
    let out: string;
    // сетевая игра: права (оператор / «команды всем») и команды «про мир» — у хоста (net/NetGame)
    const routed = this.game.net?.routeCommand(name, text) ?? null;
    if (!CONFIG.commands.enabled && name !== "tutorial") out = "Команды в этой игре выключены";
    else if (routed !== null) out = routed;
    else {
      const h = HANDLERS[name];
      try {
        out = h
          ? h(this.game, parts)
          : `Неизвестная команда: /${name}. /help — список`;
      } catch (e) {
        out = "Ошибка: " + (e instanceof Error ? e.message : String(e));
      }
    }
    this.log.push(out);
    if (this.log.length > 50) this.log.shift();
    events.emit("chat", { text: out });
    return out;
  }
}
