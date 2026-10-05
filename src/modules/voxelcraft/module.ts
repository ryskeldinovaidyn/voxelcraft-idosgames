import { defineModule, type Module } from "@idosgames/module-sdk";
import { createVoxelcraft } from "./scene";
import { createClientWorldAI } from "./ai/worldAi";

// The VoxelCraft feature module. It contributes ONLY an engine scene and a nav entry — no React UI
// panels (the game draws its own DOM HUD). This exercises the scene-only branch of the contract and
// proves a module need not use React.
//
// The SDK is used for client.ai — building a world from a picture + description (feature
// "voxel-world" of the title; without it "Create world" offers the local, AI-free path) — and for
// network play through the lobby's rooms system (ctx.multiplayer): VoxelCraft only declares how it
// plays online and takes the room when the host presses "Play"; it has no rooms UI of its own.
const MODE = "voxelcraft";

export const voxelcraftModule: Module = defineModule({
  id: "voxelcraft",
  meta: {
    name: "VoxelCraft",
    type: "game",
    genre: "sandbox",
    engine: "three",
  },
  setup(ctx) {
    // setup() runs after login, so the client already has a session for client.ai.
    const { scene, agent, content, whenGame } = createVoxelcraft({
      ai: createClientWorldAI(ctx.client),
      // «Играть с друзьями» в паузе — «Создать комнату» лобби с этой игрой. Нет системы мультиплеера
      // (или она выключена у тайтла) — кнопки нет, игра одиночная.
      online: {
        available: () => ctx.features.get("multiplayer")?.available === true,
        openForFriends: () =>
          ctx.features.open("multiplayer", { mode: MODE, create: true }),
      },
    });
    ctx.registerScene(scene);
    ctx.registerRoute({ id: MODE, label: "Voxel", icon: "🧊" });
    // Сетевая игра: звезда вокруг хоста, свой чат в игре, до 8 игроков, опоздавших пускаем — у мира
    // есть вход в идущую игру (Hello → Welcome с миром хоста). Настройки комнаты — режим гостей и
    // команды для всех (их читает NetGame.roomSettingsOf).
    ctx.multiplayer.registerGame({
      mode: MODE,
      label: "VoxelCraft",
      topology: "Host",
      chatMode: "P2P",
      maxPlayers: 8,
      joinInProgress: true,
      settings: [
        {
          id: "guestMode",
          label: "Режим гостей",
          kind: "choice",
          options: [
            { value: "survival", label: "Выживание" },
            { value: "creative", label: "Творчество" },
          ],
          default: "survival",
        },
        { id: "cheats", label: "Команды всем", kind: "toggle", default: false },
      ],
      start: async (room) => (await whenGame()).acceptRoom(room),
    });
    // Миры в Мастерской: модуль-браузер показывает, публикует и открывает их через этот обработчик,
    // не зная ничего про сейвы. Без модуля workshop в проекте регистрация просто ни на что не влияет.
    ctx.content.registerType(content);
    // Глаза и руки агента: у canvas-игры DOM пустой, без этого она для него невидима.
    ctx.exposeToAgent(agent);
  },
});
