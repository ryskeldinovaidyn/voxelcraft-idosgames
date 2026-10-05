import type { ModuleAgentApi } from "@idosgames/module-sdk";
import { difficulty } from "./systems/Difficulty";
import { events } from "./core/EventBus";
import { Intent } from "./core/Intents";
import { BLOCKS } from "./registry/Blocks";
import { sim } from "./net/sim";
import type { Game } from "./main";
import { buildSpecWithoutAI } from "./worldgen/textSpec";
import { SIZE_PRESETS, parseWorldSpec } from "./worldgen/WorldSpec";

// Debug-поверхность VoxelCraft для агента AI-кодера (контракт `ctx.exposeToAgent`).
//
// Зачем она нужна именно здесь: агент осматривает работающее приложение, читая DOM, а вся игра —
// один `<canvas>`. Без этого файла для агента экран пуст, и «персонаж провалился сквозь пол» он
// не увидит никак.
//
// ПРАВИЛО, которое нельзя нарушать: действия идут тем же путём, что и живой ввод — через клавиши
// `Input` и очередь интентов. Второй реализации ходьбы здесь нет и быть не должно, иначе агент
// проверял бы не ту игру, в которую играет человек.

/** Потолок удержания клавиши: агент не должен уметь «зажать W» на минуту. */
const MAX_HOLD_MS = 5000;

/** Сколько времени на действие, если агент не сказал. */
const DEFAULT_HOLD_MS = 400;

const DIR_KEYS: Record<string, string> = {
  forward: "KeyW",
  back: "KeyS",
  left: "KeyA",
  right: "KeyD",
};

function clampMs(value: unknown): number {
  const ms = typeof value === "number" && value > 0 ? value : DEFAULT_HOLD_MS;
  return Math.min(ms, MAX_HOLD_MS);
}

function round(value: number, digits = 2): number {
  const k = 10 ** digits;
  return Math.round(value * k) / k;
}

const toDegrees = (rad: number): number => round((rad * 180) / Math.PI, 1);

/**
 * @param getGame доступ к текущему экземпляру игры. Именно функция, а не объект: сцена создаёт
 * `Game` в `mount()` и обнуляет в `destroy()`, а поверхность регистрируется один раз на `setup()`.
 */
export function createVoxelcraftAgentApi(
  getGame: () => Game | null,
): ModuleAgentApi {
  /** Игра, готовая принимать команды: существует и не на паузе после действий агента. */
  function live(): Game {
    const game = getGame();
    if (!game) throw new Error("VoxelCraft is not mounted yet");
    // Действие в игре, которая стоит на паузе, молча не сделало бы ничего — сначала берём
    // управление (это же снимает оверлей паузы, как клик игрока).
    game.input.takeControl();
    return game;
  }

  /** Удержать клавишу как живой игрок: нажали, подождали, отпустили. */
  function hold(code: string, ms: number): Promise<void> {
    const game = live();
    game.input.keys.add(code);
    return new Promise((resolve) => {
      setTimeout(() => {
        game.input.keys.delete(code);
        resolve();
      }, ms);
    });
  }

  /**
   * Удержать кнопку мыши (ломать/ставить обрабатываются по удержанию). Отпускаем не раньше, чем
   * нажатие увидели два кадра: в фоне кадр идёт раз в 200 мс, и «клик» на 120 мс игра не замечала.
   */
  function holdButton(button: "left" | "right", ms: number): Promise<void> {
    const game = live();
    if (button === "left") game.input.leftDown = true;
    else game.input.rightDown = true;
    const frame0 = game.loop.frameN;
    const t0 = performance.now();
    return new Promise((resolve) => {
      const check = () => {
        const seen = game.loop.frameN - frame0 >= 2;
        if (
          performance.now() - t0 < ms ||
          (!seen && performance.now() - t0 < 1000)
        ) {
          setTimeout(check, 20);
          return;
        }
        if (button === "left") game.input.leftDown = false;
        else game.input.rightDown = false;
        resolve();
      };
      setTimeout(check, 20);
    });
  }

  /** Игра без захвата управления: смена мира работает и на паузе. */
  function mounted(): Game {
    const game = getGame();
    if (!game) throw new Error("VoxelCraft is not mounted yet");
    return game;
  }

  return {
    state() {
      const game = getGame();
      if (!game) return { mounted: false };

      const p = game.player;
      const held = game.inventory.heldItem();
      const src = game.world.source;

      return {
        mounted: true,
        // Идёт ли симуляция. false = игра на паузе (оверлей «Click to play»): в этом состоянии
        // персонаж не двигается вообще, и это НЕ баг движения.
        playing: game.playing,
        inputActive: game.input.active,
        player: {
          pos: { x: round(p.pos.x), y: round(p.pos.y), z: round(p.pos.z) },
          velocity: {
            x: round(p.vel.x),
            y: round(p.vel.y),
            z: round(p.vel.z),
          },
          yawDeg: toDegrees(p.yaw),
          pitchDeg: toDegrees(p.pitch),
          health: p.health,
          food: p.food,
          mode: p.mode,
          flying: p.flying,
          gliding: p.gliding,
          xpLevel: p.xpLevel,
          armor: game.inventory.armorStats().points,
          onGround: p.onGround,
          inWater: p.inWater,
          dead: p.dead,
          // на чём едет: minecart | boat | имя животного (horse); null — пешком
          riding: p.riding
            ? ((p.riding as { def?: { name: string } }).def?.name ??
              p.riding.kind)
            : null,
        },
        // открытый экран: inventory | crafting | chest | furnace; null — идёт игра
        screen: game.invUI.open ? game.invUI.kind : null,
        // идущий набег: волна, ожидание или бой, сколько разбойников живы
        raid: game.raid
          ? {
              wave: game.raid.wave,
              state: game.raid.state,
              raiders: game.raid.raiders.length,
            }
          : null,
        // открытые достижения (id; список — systems/Achievements)
        achievements: game.achievements.serialize(),
        // блок под прицелом (то, что сломает ЛКМ и на что сработает ПКМ)
        lookingAt: (() => {
          const t = game.interaction.target;
          return t
            ? { block: BLOCKS[t.id]?.name ?? t.id, x: t.x, y: t.y, z: t.z }
            : null;
        })(),
        // мобы в 32 блоках: сколько каждого вида (что видит игрок вокруг)
        mobsNearby: (() => {
          const out: Record<string, number> = {};
          for (const e of game.entities.entities.values())
            if (e.kind === "mob" && !e.dead && e.pos.distanceTo(p.pos) < 32)
              out[e.def.name] = (out[e.def.name] ?? 0) + 1;
          return out;
        })(),
        // босс рядом (Дракон Предела): имя, здоровье — как полоса босса на экране
        boss: (() => {
          for (const e of game.entities.entities.values())
            if (e.kind === "mob" && e.def.boss && !e.dead)
              return {
                name: e.def.name,
                hp: Math.round(e.hp),
                max: e.def.hp,
                pos: {
                  x: round(e.pos.x),
                  y: round(e.pos.y),
                  z: round(e.pos.z),
                },
              };
          return null;
        })(),
        // Экран «Создать мир» открыт — игра под ним на паузе, ввод заморожен.
        createWorldOpen: game.worldUI.open,
        world: {
          id: game.worldId,
          name: game.worldName,
          // "noise" — классический мир по сиду; "spec" — мир по рецепту (картинка/описание/ИИ)
          source: src.kind,
          // поколение генератора: 1 — прежний мир, 2 — высота 128, биомы, пещеры
          gen: src.gen ?? 1,
          dimension: game.dimension,
          // погода: clear | rain | thunder (в Пекле и Пределе её не видно)
          weather: game.weather.kind,
          // сложность: peaceful | easy | normal | hard (systems/Difficulty)
          difficulty: difficulty(),
          seed: game.world.seed,
          waterLevel: game.world.waterLevel,
          spawnHint: game.world.generator.spawnHint(),
          ...(src.kind === "spec"
            ? {
                size: src.spec.size,
                shape: src.spec.terrain.shape,
                biomes: src.spec.zones.map((z) => z.biome),
                structures: src.spec.structures.map((s) => s.type),
                fromPicture: Boolean(src.spec.terrain.heightmap),
              }
            : {}),
          loadedChunks: game.world.chunks.size,
          // Блок под ногами: по нему видно и «стоит на траве», и «провалился в пустоту».
          blockBelow: game.world.getBlock(
            Math.floor(p.pos.x),
            Math.floor(p.pos.y - 0.1),
            Math.floor(p.pos.z),
          ),
        },
        inventory: {
          hotbarIndex: game.inventory.hotbarIndex,
          inHand: held ? { item: held.item, count: held.count } : null,
        },
        // Сетевая игра: null — одиночная. owner — этот клиент симулирует своё измерение (мобы,
        // жидкости, блочные обновления); false — он реплика и показывает то, что шлёт владелец.
        net: game.net
          ? {
              host: game.net.isHost,
              owner: sim.authority,
              edits: game.net.diffs.count(game.dimension),
              players: game.net.playerList().map((pl) => {
                const pose = game.net?.peers.get(pl.slot)?.pose;
                return {
                  name: pl.name,
                  host: pl.host,
                  op: pl.op,
                  dim: pl.dim,
                  rttMs: Math.round(pl.rtt),
                  pos:
                    pl.userId === game.net?.selfId
                      ? {
                          x: round(p.pos.x),
                          y: round(p.pos.y),
                          z: round(p.pos.z),
                        }
                      : pose
                        ? {
                            x: round(pose.x),
                            y: round(pose.y),
                            z: round(pose.z),
                          }
                        : null,
                };
              }),
            }
          : null,
      };
    },

    actions: {
      move: async (args) => {
        const dir = String(args?.dir ?? "forward");
        const code = DIR_KEYS[dir];
        if (!code)
          throw new Error(
            `unknown dir '${dir}' — use forward | back | left | right`,
          );
        await hold(code, clampMs(args?.ms));
      },

      jump: async (args) => {
        await hold("Space", clampMs(args?.ms ?? 120));
      },

      look: (args) => {
        const game = live();
        const dYaw = Number(args?.yawDeg ?? 0) * (Math.PI / 180);
        const dPitch = Number(args?.pitchDeg ?? 0) * (Math.PI / 180);
        // Через штатный метод игрока — те же ограничения по pitch, что и у мыши.
        game.player.look(dYaw, dPitch);
      },

      breakBlock: async (args) => {
        // Ломание идёт по удержанию ЛКМ: короткий «клик» не сломает ничего, кроме мгновенных блоков.
        await holdButton("left", clampMs(args?.ms ?? 1200));
      },

      placeBlock: async () => {
        await holdButton("right", 120);
      },

      /**
       * Удержать кнопку мыши столько, сколько нужно ДЕЙСТВИЮ, а не одному клику: натянуть лук,
       * зарядить арбалет, выпить зелье, закрыться щитом, размахнуться трезубцем. Без этого действия
       * агент умел только «тапнуть», и все такие вещи проверялись лишь тестами.
       */
      holdButton: async (args) => {
        const button = args?.button === "left" ? "left" : "right";
        await holdButton(button, clampMs(args?.ms ?? 1200));
      },

      selectSlot: (args) => {
        const n = Number(args?.slot ?? 1);
        if (!Number.isInteger(n) || n < 1 || n > 9)
          throw new Error("slot must be 1..9");
        live().intents.push(Intent.SelectSlot, { slot: n - 1 });
      },

      toggleMode: () => {
        live().intents.push(Intent.ToggleMode, {});
      },

      toggleInventory: () => {
        // то же событие, что клавиша E и тач-кнопка: в креативе — палитра всех предметов
        live();
        events.emit("ui:toggleInventory");
      },

      respawn: () => {
        // та же кнопка «Возродиться», что на экране смерти
        const game = mounted();
        if (!game.player.dead) throw new Error("the player is alive");
        game.respawnPlayer();
      },

      command: async (args) => {
        // Тем же путём, что строка консоли игрока: интент Command → исполнение на тике.
        const game = live();
        const text = String(args?.text ?? "").trim();
        if (!text)
          throw new Error("text is required, e.g. { text: '/give torch 16' }");
        const before = game.commands.log.length;
        game.intents.push(Intent.Command, {
          text: text.startsWith("/") ? text : "/" + text,
        });
        for (let i = 0; i < 40 && game.commands.log.length === before; i++)
          await new Promise((r) => setTimeout(r, 50));
        return { output: game.commands.log.slice(before) };
      },

      entitiesNear: (args) => {
        // Ближайшие сущности (только чтение): вид, id, позиция, дистанция — прицелиться и сверить
        const game = mounted();
        const r = Math.min(64, Math.max(1, Number(args?.radius ?? 16)));
        const p = game.player.pos;
        const out: ({
          id: number;
          kind: string;
          x: number;
          y: number;
          z: number;
          dist: number;
        } & Record<string, unknown>)[] = [];
        for (const e of game.entities.entities.values()) {
          if (e.dead) continue;
          const dist = e.pos.distanceTo(p);
          if (dist > r) continue;
          out.push({
            id: e.id,
            kind: e.kind,
            ...(e.kind === "mob"
              ? {
                  type: e.def.name,
                  // состояние от действий игрока — сверить у двух игроков сети
                  ...(e.sheared ? { sheared: true } : {}),
                  ...(e.tamed ? { tamed: true } : {}),
                  ...(e.saddled ? { saddled: true } : {}),
                  ...(e.leashed ? { leashed: true } : {}),
                  ...(e.customName ? { name: e.customName } : {}),
                }
              : {}),
            x: round(e.pos.x),
            y: round(e.pos.y),
            z: round(e.pos.z),
            dist: round(dist),
            ...("rider" in e && e.rider ? { rider: true } : {}),
          });
        }
        return out.sort((a, b) => a.dist - b.dist).slice(0, 30);
      },

      blockAt: (args) => {
        // Прочитать блок мира по координатам (только чтение) — сверить мир у двух игроков сети.
        const game = mounted();
        const x = Math.floor(Number(args?.x));
        const y = Math.floor(Number(args?.y));
        const z = Math.floor(Number(args?.z));
        if (![x, y, z].every(Number.isFinite))
          throw new Error("x, y, z are required numbers");
        const id = game.world.getBlock(x, y, z);
        return { block: BLOCKS[id]?.name ?? id, id };
      },

      generateWorld: (args) => {
        const game = mounted();
        const key = String(args?.size ?? "island");
        const size =
          key === "large" || key === "infinite"
            ? SIZE_PRESETS[key]
            : SIZE_PRESETS.island;
        const seed = Number(args?.seed);
        const spec = buildSpecWithoutAI({
          text: String(args?.text ?? ""),
          size: { ...size },
          seed: Number.isFinite(seed)
            ? seed >>> 0
            : (Math.random() * 0xffffffff) >>> 0,
        });
        game.newWorld({ kind: "spec", spec });
        return {
          name: spec.name,
          structures: spec.structures.map((s) => s.type),
        };
      },

      loadWorldSpec: (args) => {
        const r = parseWorldSpec(args?.spec);
        if (!r.ok) throw new Error(r.error);
        mounted().newWorld({ kind: "spec", spec: r.spec });
        return { name: r.spec.name, warnings: r.warnings };
      },
    },

    describeActions: {
      move: "Walk: { dir: forward|back|left|right, ms?: number } — holds the movement key for ms (default 400, max 5000).",
      jump: "Jump: { ms?: number } — taps Space.",
      look: "Turn the camera by a DELTA in degrees: { yawDeg?: number, pitchDeg?: number }. Positive pitch looks up.",
      breakBlock:
        "Hold left mouse to break the block under the crosshair: { ms?: number } (default 1200 — breaking takes time).",
      placeBlock:
        "Tap right mouse to place the block from the selected hotbar slot.",
      holdButton:
        "Hold a mouse button for a while: { button?: 'left'|'right' (default right), ms?: number } (default 1200, max 5000). This is how you draw a bow, load a crossbow, drink a potion, raise a shield or wind up a trident — a tap is too short for them.",
      selectSlot: "Select a hotbar slot: { slot: 1..9 }.",
      toggleMode: "Switch between survival and creative.",
      toggleInventory:
        "Open/close the inventory like the E key (state.screen shows which one: inventory, or creative — every item with search — in creative mode).",
      respawn:
        "Press 'Respawn' on the death screen (player.dead = true): back to the bed or the world spawn.",
      command:
        "Run a console command like a player typing it in chat: { text: '/give torch 16' }. Commands: /help, /give <item> [n], /tp x y z, /time set day|noon|night|midnight|<sec>, /weather clear|rain|thunder [sec],/difficulty peaceful|easy|normal|hard, /gamemode survival|creative, /setblock x y z <block> [meta], /fill x1 y1 z1 x2 y2 z2 <block>, /summon <mob> [x y z], /kill [mob] (the player, or every mob of that kind within 64 blocks — a normal death with drops, slimes split), /clear, /seed, /locate fortress|citadel|village (nearest structure of this dimension), /enchant <efficiency|unbreaking|fortune|silk_touch|sharpness|protection|power> [level] (the held item), /newworld [seed] (a new seed world of the current generation; the old world stays in 'My worlds'). Coordinates accept ~ (relative). Minecraft names (grass_block, oak_planks) are accepted. Returns the output lines.",
      entitiesNear:
        "Nearest entities (read-only): { radius?: 1..64 (default 16) } → up to 30 of { id, kind, type?, x, y, z, dist, rider?, sheared?, tamed?, saddled?, leashed?, name? }, nearest first.",
      blockAt:
        "Read one block of the current dimension (read-only): { x, y, z } → { block, id }. In a network game compare it across players to check world sync.",
      generateWorld:
        "Build a new world WITHOUT AI from a description (Russian/English keywords): { text: string, size?: island|large|infinite, seed?: number }. Replaces the current world (the old one stays in 'My worlds').",
      loadWorldSpec:
        "Build a new world from a WorldSpec recipe object: { spec: object } (see the voxelcraft-worlds skill). Invalid fields are clamped/dropped; returns warnings.",
    },
  };
}
