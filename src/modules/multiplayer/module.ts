import { defineModule, type Module } from "@idosgames/module-sdk";
import { configSection } from "@idosgames/react/ui";
import { makeMultiplayerScreen } from "./MultiplayerScreen";
import { hasTitleData, type MultiplayerSection } from "./model";
import { createRooms } from "./rooms";
import { t } from "./i18n";

// The rooms system of the app: the lobby tab with the rooms, and the owner of the player's room and
// its connection. Games that play online register in `ctx.multiplayer` and take the room in `start`;
// they never create or join rooms. The tab shows while multiplayer is on for the title AND the app has
// a game that plays online. No badge and no startup request.
export const multiplayerModule: Module = defineModule({
  id: "multiplayer",
  meta: { name: "Multiplayer", type: "app", engine: "dom" },
  setup(ctx) {
    const rooms = createRooms({
      client: ctx.client,
      games: ctx.multiplayer,
      navigate: (mode) => ctx.navigate(mode),
    });
    ctx.features.register({
      id: "multiplayer",
      label: t("title"),
      icon: "globe",
      group: "social",
      order: 75,
      available: false,
      Screen: makeMultiplayerScreen({
        rooms,
        games: ctx.multiplayer,
        modes: ctx.modes,
      }),
    });
    const on = hasTitleData(
      configSection<MultiplayerSection>(ctx.client, "Multiplayer"),
    );
    // Games register in their own setup() — before or after this one: follow the registry.
    const refresh = () =>
      ctx.features.setAvailable(
        "multiplayer",
        on && ctx.multiplayer.listGames().length > 0,
        on
          ? "no game of the app plays online (ctx.multiplayer.registerGame)"
          : "multiplayer is off on the title (Multiplayer.SystemState.Enabled)",
      );
    refresh();
    ctx.multiplayer.subscribe(refresh);
    ctx.exposeToAgent({
      state: () => {
        const s = rooms.get();
        return {
          ui: "dom",
          feature: "multiplayer",
          games: ctx.multiplayer.listGames().map((g) => g.mode),
          room: s.session
            ? {
                id: s.session.roomId,
                mode: s.session.mode,
                host: s.session.isHost,
                members: s.session.members.size,
                started: s.started,
              }
            : null,
        };
      },
      describeActions: {},
    });
  },
});
