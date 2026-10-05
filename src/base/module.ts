import { defineModule, type Module } from "@idosgames/module-sdk";
import appConfig from "../app.config";
import { IDOS_WEB3, IDOS_WEB3_NETWORK_ID } from "../idos.title";
import { LOBBY_MODE, type AppConfig } from "./app-config";
import { makeLobbyPanel } from "./lobby/Lobby";
import { makePlayScreen } from "./lobby/PlayScreen";
import { makeBackToLobby } from "./lobby/BackToLobby";
import { PLAY, gameModes, hasWallet } from "./lobby/model";
import { t } from "./lobby/i18n";

// The base of every app on the platform — the lobby, the home the player lands on after sign-in (the
// sign-in itself is ./login, rendered by the host before any module runs). It is written against the
// same module contract as everything in src/modules/, and main.tsx installs it first.
//
//  - The lobby lays out the features of the installed modules (the shop, heroes, leaders…) as tabs,
//    with the balances, the wallet and the profile on top.
//  - Every game module's mode gets a "Play" button (the "Play" tab); over a game the base draws only
//    a small button back to the lobby.
//  - It takes the shared-UI roles it draws for everybody, so games hide their own balances and wallet,
//    and the host draws no nav, ☰ or "Log out" of its own.
//
// What happens after sign-in and the order of the tabs: ../app.config.ts.
export const baseModule: Module = createBaseModule(appConfig, {
  web3: IDOS_WEB3,
  networkID: IDOS_WEB3_NETWORK_ID,
});

/** The web3 identity of the project (src/idos.title.ts) — whether the lobby offers the wallet. */
export interface BaseWeb3 {
  web3: boolean;
  networkID: string;
}

/** The base for a given app.config — the project uses `baseModule`; a test harness makes its own. */
export function createBaseModule(
  config: AppConfig,
  identity: BaseWeb3,
): Module {
  return defineModule({
    id: "base",
    meta: { name: "Base", type: "app", engine: "dom" },
    sharedUi: {
      provides: ["currency-bar", "wallet", "account", "menu", "modes"],
    },
    setup(ctx) {
      ctx.registerRoute({
        id: LOBBY_MODE,
        label: t("lobby"),
        icon: "🏠",
        order: -1000,
      });

      // The wallet lives next to the balances — for any web3 title (EVM or Solana).
      const wallet = hasWallet(identity);

      // `features.open(id)` from a game (the lobby is not on screen, its own presenter is gone): switch
      // to the lobby and let it open the screen on mount. While the lobby is shown, its presenter —
      // registered later — handles the request first.
      let pending: { id: string; args?: Record<string, unknown> } | null = null;
      ctx.features.setPresenter((id, args) => {
        pending = { id, args };
        ctx.navigate(LOBBY_MODE);
        return true;
      });

      ctx.registerPanel({
        id: "lobby",
        slot: "overlay",
        component: makeLobbyPanel({
          features: ctx.features,
          lobby: config.lobby,
          wallet,
          pending: {
            take: () => {
              const next = pending;
              pending = null;
              return next;
            },
          },
        }),
      });
      ctx.registerPanel({
        id: "back",
        slot: "modal",
        activeOnly: false,
        component: makeBackToLobby(ctx.modes, ctx.navigate),
      });

      // "Play" — only while there is something to play. The modes are known once every module is
      // installed, so this follows the list instead of reading it here.
      const PlayScreen = makePlayScreen(
        ctx.modes,
        ctx.navigate,
        ctx.multiplayer,
        ctx.features,
      );
      let offPlay: (() => void) | null = null;
      const syncPlay = (): void => {
        const hasGames = gameModes(ctx.modes.list()).length > 0;
        if (hasGames && !offPlay)
          offPlay = ctx.features.register({
            id: PLAY,
            label: t("play"),
            icon: "star",
            group: "events",
            order: 0,
            primary: true,
            Screen: PlayScreen,
          });
        else if (!hasGames && offPlay) {
          offPlay();
          offPlay = null;
        }
      };
      ctx.modes.subscribe(syncPlay);

      // app.config.ts `start`: a game's mode id starts straight in it (the host applies it on its first
      // render — no flash of the lobby). An id no module registered is ignored by the host.
      if (config.start !== LOBBY_MODE) ctx.navigate(config.start);

      // The lobby is ordinary React in the DOM: an agent reads it as a tree and presses its buttons.
      // What is not on screen goes here — above all, why a tab is missing.
      ctx.exposeToAgent({
        state: () => ({
          mode: ctx.modes.current(),
          start: config.start,
          games: gameModes(ctx.modes.list()).map((m) => m.id),
          wallet,
          features: ctx.features.list().map((f) => ({
            id: f.id,
            module: f.moduleId,
            available: f.available,
            ...(f.unavailableReason
              ? { hiddenBecause: f.unavailableReason }
              : {}),
            badge: f.badge,
          })),
        }),
        actions: {
          go: (args) => ctx.navigate(String(args?.mode ?? LOBBY_MODE)),
          open: (args) => ctx.features.open(String(args?.feature ?? "")),
        },
        describeActions: {
          go: 'go({ mode }) — switch to a mode: "lobby" or a game\'s mode id',
          open: 'open({ feature }) — open a tab by feature id ("store", "character"…); false if it is hidden',
        },
      });
    },
  });
}
