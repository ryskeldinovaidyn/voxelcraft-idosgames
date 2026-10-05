import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { RoomListItem } from "@idosgames/core";
import type {
  FeatureScreenProps,
  ModeRegistry,
  MultiplayerGame,
  MultiplayerRegistry,
} from "@idosgames/module-sdk";
import { useIDosGamesClient } from "@idosgames/react";
import {
  Button,
  Card,
  Center,
  EmptyState,
  Icon,
  Popup,
  SectionTitle,
  Spinner,
  configSection,
  errorText,
  outlined,
  panel,
  useNow,
  usePopupClose,
  useStagger,
  useToast,
  v,
} from "@idosgames/react/ui";
import {
  cleanCode,
  defaultSettings,
  memberRows,
  newCode,
  settingsFromState,
  visibleRooms,
  type MultiplayerSection,
} from "./model";
import type { Rooms } from "./rooms";
import { t } from "./i18n";

// The rooms system's screen (a lobby tab): the rooms of the games this app plays online, "Create a
// room" for one of them, joining by code — and, once in a room, its members, "Ready", the room chat and
// the host's "Play", which takes the whole room into the game. Opened with `{ mode }` it shows one
// game's rooms (the lobby's "With friends"); with `{ mode, create: true }` straight on "Create" (a
// game's "Open for friends").

export interface ScreenDeps {
  rooms: Rooms;
  games: MultiplayerRegistry;
  modes: ModeRegistry;
}

const useGames = (games: MultiplayerRegistry) =>
  useSyncExternalStore(games.subscribe, games.listGames, games.listGames);

export function makeMultiplayerScreen(deps: ScreenDeps) {
  return function MultiplayerScreen({ args }: FeatureScreenProps): ReactNode {
    const state = useSyncExternalStore(
      deps.rooms.subscribe,
      deps.rooms.get,
      deps.rooms.get,
    );
    const mode = typeof args?.mode === "string" ? args.mode : null;
    return state.session ? (
      <Room deps={deps} />
    ) : (
      <Rooms deps={deps} mode={mode} create={args?.create === true} />
    );
  };
}

/** A game's label: its own, else its route's. */
function gameLabel(
  game: MultiplayerGame | undefined,
  modes: ModeRegistry,
  mode: string | null | undefined,
): string {
  return (
    game?.label ?? modes.list().find((m) => m.id === mode)?.label ?? mode ?? ""
  );
}

// ── The list of rooms ────────────────────────────────────────────────────────────────────────

function Rooms({
  deps,
  mode,
  create,
}: {
  deps: ScreenDeps;
  mode: string | null;
  create: boolean;
}): ReactNode {
  const client = useIDosGamesClient();
  const toast = useToast();
  const stagger = useStagger();
  const games = useGames(deps.games);
  const [rooms, setRooms] = useState<RoomListItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [popup, setPopup] = useState<"create" | "code" | null>(
    create ? "create" : null,
  );
  const modesList = useMemo(() => games.map((g) => g.mode), [games]);

  const load = useCallback(async () => {
    const res = await client.multiplayer.listRooms(0, 50);
    setRooms(res.ok ? (res.data.Rooms ?? []) : []);
  }, [client]);
  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 5_000);
    return () => clearInterval(id);
  }, [load]);

  const join = async (roomID: string, code?: string) => {
    setBusy(roomID);
    const error = await deps.rooms.join(roomID, code);
    setBusy(null);
    if (error)
      toast(
        error === "inProgress" ? t("inProgress") : errorText(error),
        "error",
      );
  };

  const shown = visibleRooms(rooms ?? [], modesList, mode);
  const title = mode
    ? `${t("roomsOf")} ${gameLabel(deps.games.getGame(mode), deps.modes, mode)}`
    : t("open");

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <Button
          tone="green"
          attract
          onClick={() => setPopup("create")}
          style={{ flex: 1 }}
          data-tutorial-anchor="multiplayer:create"
        >
          <Icon glyph="plus" size={18} /> {t("create")}
        </Button>
        <Button tone="blue" onClick={() => setPopup("code")}>
          {t("byCode")}
        </Button>
      </div>
      <SectionTitle>{title}</SectionTitle>
      {!rooms ? (
        <Center>
          <Spinner />
        </Center>
      ) : shown.length === 0 ? (
        <EmptyState glyph="globe" text={t("noRooms")} />
      ) : (
        shown.map((r, i) => (
          <Card
            key={r.RoomID}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              alignItems: "center",
              gap: 12,
              ...stagger(i),
            }}
          >
            <Icon glyph="globe" size={34} />
            <div style={{ minWidth: 0 }}>
              <div style={{ ...outlined, fontSize: 15 }}>
                {r.Name || t("room")}
              </div>
              <div style={{ ...outlined, fontSize: 12, color: v.textDim }}>
                {gameLabel(
                  deps.games.getGame(r.Mode ?? ""),
                  deps.modes,
                  r.Mode,
                )}{" "}
                · {t("players")}: {r.MemberCount ?? 0} / {r.MaxPlayers ?? 8}
              </div>
            </div>
            <Button
              tone="green"
              size="sm"
              busy={busy === r.RoomID}
              disabled={(r.MemberCount ?? 0) >= (r.MaxPlayers ?? 8)}
              onClick={() => void join(r.RoomID ?? "")}
            >
              {t("join")}
            </Button>
          </Card>
        ))
      )}
      {popup === "create" ? (
        <Popup title={t("create")} onClose={() => setPopup(null)} width={420}>
          <CreateForm deps={deps} games={games} preset={mode} />
        </Popup>
      ) : popup === "code" ? (
        <Popup title={t("byCode")} onClose={() => setPopup(null)} width={400}>
          <CodeForm onJoin={(id, code) => void join(id, code)} />
        </Popup>
      ) : null}
    </div>
  );
}

const input = {
  ...panel,
  padding: "10px 12px",
  color: v.text,
  fontSize: 15,
  width: "100%",
  boxSizing: "border-box" as const,
};

function CreateForm({
  deps,
  games,
  preset,
}: {
  deps: ScreenDeps;
  games: MultiplayerGame[];
  preset: string | null;
}): ReactNode {
  const client = useIDosGamesClient();
  const toast = useToast();
  const close = usePopupClose();
  const [mode, setMode] = useState(
    games.find((g) => g.mode === preset)?.mode ?? games[0]?.mode ?? "",
  );
  const game = games.find((g) => g.mode === mode);
  const cap = Math.min(
    Number(
      configSection<MultiplayerSection>(client, "Multiplayer")
        ?.MaxPlayersPerRoom ?? 8,
    ),
    game?.maxPlayers ?? 8,
  );
  const sizes = [2, 4, 8].filter((n) => n <= cap);
  const [name, setName] = useState("");
  const [max, setMax] = useState(sizes[sizes.length - 1] ?? 2);
  const [priv, setPriv] = useState(false);
  const [settings, setSettings] = useState(() => defaultSettings(game));
  const [busy, setBusy] = useState(false);
  useEffect(() => setSettings(defaultSettings(game)), [mode]);

  if (!game) return <EmptyState glyph="globe" text={t("noGames")} />;

  const create = async () => {
    setBusy(true);
    const error = await deps.rooms.create({
      name: name.trim() || t("room"),
      mode,
      maxPlayers: max,
      private: priv,
      joinCode: newCode(),
      settings,
    });
    setBusy(false);
    if (error) return toast(errorText(error), "error");
    close();
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {games.length > 1 ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {games.map((g) => (
            <Button
              key={g.mode}
              size="sm"
              tone={g.mode === mode ? "gold" : "grey"}
              onClick={() => setMode(g.mode)}
            >
              {gameLabel(g, deps.modes, g.mode)}
            </Button>
          ))}
        </div>
      ) : null}
      <input
        value={name}
        maxLength={40}
        placeholder={t("roomName")}
        onChange={(e) => setName(e.target.value)}
        style={input}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          ...outlined,
          fontSize: 14,
        }}
      >
        {t("players")}:
        {sizes.map((n) => (
          <Button
            key={n}
            size="sm"
            tone={max === n ? "gold" : "grey"}
            onClick={() => setMax(n)}
          >
            {n}
          </Button>
        ))}
      </div>
      <Button
        tone={priv ? "gold" : "grey"}
        size="sm"
        onClick={() => setPriv(!priv)}
      >
        <Icon glyph="lock" size={16} /> {priv ? t("private") : t("public")}
      </Button>
      {(game.settings ?? []).map((field) =>
        field.kind === "toggle" ? (
          <Button
            key={field.id}
            size="sm"
            tone={settings[field.id] === true ? "gold" : "grey"}
            onClick={() =>
              setSettings({
                ...settings,
                [field.id]: settings[field.id] !== true,
              })
            }
          >
            {settings[field.id] === true ? "✓ " : ""}
            {field.label}
          </Button>
        ) : (
          <div key={field.id} style={{ display: "grid", gap: 6 }}>
            <span style={{ ...outlined, fontSize: 13, color: v.textDim }}>
              {field.label}
            </span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(field.options ?? []).map((o) => (
                <Button
                  key={o.value}
                  size="sm"
                  tone={settings[field.id] === o.value ? "gold" : "grey"}
                  onClick={() =>
                    setSettings({ ...settings, [field.id]: o.value })
                  }
                >
                  {o.label}
                </Button>
              ))}
            </div>
          </div>
        ),
      )}
      <Button tone="green" busy={busy} onClick={() => void create()}>
        {t("create")}
      </Button>
    </div>
  );
}

function CodeForm({
  onJoin,
}: {
  onJoin: (roomID: string, code: string) => void;
}): ReactNode {
  const close = usePopupClose();
  const [invite, setInvite] = useState("");
  // An invite is "<room id>:<code>" (what the room screen shows for copying); a bare id works too.
  const [roomId, code = ""] = invite.trim().split(":");
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <input
        value={invite}
        placeholder={t("invitePlaceholder")}
        onChange={(e) => setInvite(e.target.value)}
        style={input}
      />
      <Button
        tone="green"
        disabled={!roomId}
        onClick={() => {
          close();
          onJoin(roomId ?? "", cleanCode(code));
        }}
      >
        {t("join")}
      </Button>
    </div>
  );
}

// ── In a room ────────────────────────────────────────────────────────────────────────────────

function Room({ deps }: { deps: ScreenDeps }): ReactNode {
  const client = useIDosGamesClient();
  const toast = useToast();
  const now = useNow();
  const state = useSyncExternalStore(
    deps.rooms.subscribe,
    deps.rooms.get,
    deps.rooms.get,
  );
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const session = state.session!;
  const game = deps.games.getGame(session.mode ?? "");
  const timeout = Number(
    configSection<MultiplayerSection>(client, "Multiplayer")?.MemberTimeoutMs ??
      15_000,
  );
  const rows = memberRows(
    session.members.values(),
    session.selfId,
    session.hostId,
    now,
    timeout,
  );
  const me = rows.find((r) => r.me);
  const nameOf = (id: string) =>
    rows.find((r) => r.userID === id)?.name ?? t("player");
  const settings = settingsFromState(
    game,
    session.members.get(session.hostId)?.State,
  );
  const invite = `${session.roomId}${state.joinCode ? `:${state.joinCode}` : ""}`;

  const act = async (run: () => Promise<string | null>) => {
    setBusy(true);
    const error = await run();
    setBusy(false);
    if (error) toast(errorText(error), "error");
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ ...panel, padding: 12, display: "grid", gap: 4 }}>
        <div style={{ ...outlined, fontSize: 17 }}>
          {gameLabel(game, deps.modes, session.mode)}
        </div>
        <div style={{ ...outlined, fontSize: 12, color: v.textDim }}>
          {t("players")}: {rows.length}
          {(game?.settings ?? []).map((f) => {
            const value = settings[f.id];
            const shown =
              f.kind === "toggle"
                ? value === true
                  ? f.label
                  : null
                : `${f.label}: ${f.options?.find((o) => o.value === value)?.label ?? value}`;
            return shown ? ` · ${shown}` : null;
          })}
        </div>
        <button
          type="button"
          className="idos-press"
          onClick={() =>
            void navigator.clipboard
              ?.writeText(invite)
              .then(() => toast(t("copied")))
          }
          style={{
            border: "none",
            background: "none",
            padding: 0,
            textAlign: "left",
            cursor: "pointer",
            ...outlined,
            fontSize: 12,
            color: v.gold,
          }}
        >
          <Icon glyph="copy" size={14} /> {t("invite")}: {invite}
        </button>
      </div>

      {state.started ? (
        <Button
          tone="gold"
          size="lg"
          attract
          onClick={() => deps.rooms.resume()}
        >
          {t("backToGame")}
        </Button>
      ) : null}
      {state.error ? (
        <div style={{ ...outlined, fontSize: 13, color: v.red }}>
          {t(state.error === "noGame" ? "noGame" : "startFailed")}
        </div>
      ) : null}

      <SectionTitle>{t("members")}</SectionTitle>
      {rows.map((m) => (
        <Card
          key={m.userID}
          highlight={m.me}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            opacity: m.online ? 1 : 0.5,
          }}
        >
          <Icon glyph={m.host ? "crown" : "user"} size={24} />
          <span style={{ ...outlined, fontSize: 14, flex: 1 }}>
            {m.me ? `${m.name} (${t("you")})` : m.name}
          </span>
          {m.ready ? <Icon glyph="check" size={20} /> : null}
          {session.isHost && !m.me && !state.started ? (
            <Button
              tone="grey"
              size="sm"
              onClick={() => void act(() => deps.rooms.kick(m.userID))}
            >
              {t("kick")}
            </Button>
          ) : null}
        </Card>
      ))}

      {state.started ? null : session.isHost ? (
        <Button
          tone="gold"
          size="lg"
          attract
          busy={busy}
          disabled={!game}
          onClick={() => void act(() => deps.rooms.start())}
          data-tutorial-anchor="multiplayer:play"
        >
          {t("play")} · {gameLabel(game, deps.modes, session.mode)}
        </Button>
      ) : (
        <>
          <Button
            tone={me?.ready ? "grey" : "green"}
            busy={busy}
            onClick={() => void act(() => deps.rooms.setReady(!me?.ready))}
          >
            {me?.ready ? t("notReady") : t("ready")}
          </Button>
          <div
            style={{
              ...outlined,
              fontSize: 12,
              color: v.textDim,
              textAlign: "center",
            }}
          >
            {t("waitHost")}
          </div>
        </>
      )}

      {session.chatMode === "ServerRelay" ? (
        <div style={{ ...panel, padding: 10, display: "grid", gap: 8 }}>
          <div
            style={{
              display: "grid",
              gap: 4,
              maxHeight: 180,
              overflowY: "auto",
            }}
          >
            {state.chat.length === 0 ? (
              <div style={{ ...outlined, fontSize: 12, color: v.textDim }}>
                {t("noChat")}
              </div>
            ) : (
              state.chat.map((c, i) => (
                <div key={i} style={{ fontSize: 13, color: v.text }}>
                  <b>{nameOf(c.from)}:</b> {c.text}
                </div>
              ))
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={text}
              maxLength={200}
              placeholder={t("message")}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const msg = text;
                setText("");
                void act(() => deps.rooms.sendChat(msg));
              }}
              style={{ ...input, flex: 1 }}
            />
            <Button
              tone="blue"
              size="sm"
              onClick={() => {
                const msg = text;
                setText("");
                void act(() => deps.rooms.sendChat(msg));
              }}
            >
              {t("send")}
            </Button>
          </div>
        </div>
      ) : null}

      <Button tone="grey" size="sm" onClick={() => void deps.rooms.leave()}>
        {t("leave")}
      </Button>
    </div>
  );
}
