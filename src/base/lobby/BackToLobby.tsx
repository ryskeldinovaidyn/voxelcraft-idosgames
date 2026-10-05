import {
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from "react";
import type { ModeRegistry } from "@idosgames/module-sdk";
import { IconButton } from "@idosgames/react/ui";
import { LOBBY_MODE } from "../app-config";
import { t } from "./i18n";

// The only thing the base draws over a game: a small round button back to the lobby, in the top-left
// corner. Balances, the wallet and the tabs stay in the lobby — the game keeps the whole screen.
// A game with its own "exit" calls ctx.navigate("lobby") instead; then delete this panel in
// ../module.ts.

export function makeBackToLobby(
  modes: ModeRegistry,
  navigate: (modeId: string) => void,
): ComponentType {
  return function BackToLobby(): ReactNode {
    const current = useSyncExternalStore(
      modes.subscribe,
      modes.current,
      modes.current,
    );
    if (current === null || current === LOBBY_MODE) return null;
    return (
      <div
        style={{
          position: "absolute",
          top: "calc(var(--idos-safe-top, 0px) + 10px)",
          left: 10,
          pointerEvents: "auto",
        }}
      >
        <IconButton
          glyph="back"
          label={t("toLobby")}
          onClick={() => navigate(LOBBY_MODE)}
          size={40}
          tone="blue"
        />
      </div>
    );
  };
}
