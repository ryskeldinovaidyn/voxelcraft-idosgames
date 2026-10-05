import type { IDosGamesClient } from "@idosgames/core";
import { RealtimeSession } from "@idosgames/core/realtime";
import type {
  MultiplayerRegistry,
  MultiplayerRoom,
} from "@idosgames/module-sdk";
import {
  START_KEY,
  decodeStart,
  encodeStart,
  settingsFromState,
  settingsToState,
  startedMode,
} from "./model";

// The player's room, owned by the module rather than by its screen: it has to outlive the screen —
// the room goes into a game and comes back to the lobby, and the session (with its WebRTC links) is
// the same all along. The screen only draws this state and calls these actions.
//
// Start protocol: the host writes `start = <mode>` into its member state (for late joiners and for a
// guest who missed the message) and sends a start message over the links the lobby already opened
// (instant, before any game message on the ordered channel). Every device then switches to the game's
// mode and hands the room to the game's `start`. From that moment the game owns the channels.

export interface ChatLine {
  from: string;
  text: string;
  at: number;
}

export interface RoomsState {
  session: RealtimeSession | null;
  /** The private room's code — known to its creator (to share it) and to whoever typed it. */
  joinCode: string | null;
  /** The game the room went into (null — still in the lobby). */
  started: string | null;
  chat: ChatLine[];
  /** A problem to show (a game the app does not have, a start that failed). */
  error: string | null;
}

export interface RoomsDeps {
  client: IDosGamesClient;
  games: MultiplayerRegistry;
  navigate: (modeId: string) => void;
}

/** Test seam: how sessions are opened. */
export interface SessionFactory {
  create: typeof RealtimeSession.create;
  join: typeof RealtimeSession.join;
}

export interface CreateOptions {
  name: string;
  mode: string;
  maxPlayers: number;
  private: boolean;
  joinCode: string;
  settings: Record<string, string | boolean>;
}

export function createRooms(
  deps: RoomsDeps,
  factory: SessionFactory = {
    create: (...a) => RealtimeSession.create(...a),
    join: (...a) => RealtimeSession.join(...a),
  },
) {
  let state: RoomsState = {
    session: null,
    joinCode: null,
    started: null,
    chat: [],
    error: null,
  };
  const listeners = new Set<() => void>();
  let offs: Array<() => void> = [];
  const set = (patch: Partial<RoomsState>) => {
    state = { ...state, ...patch };
    for (const l of listeners) l();
  };

  const reset = () => {
    for (const off of offs.splice(0)) off();
    set({
      session: null,
      joinCode: null,
      started: null,
      chat: [],
      error: null,
    });
  };

  /** Hand the room to the game — once per room. */
  const enter = (mode: string, lateJoin: boolean) => {
    const session = state.session;
    if (!session || state.started) return;
    const game = deps.games.getGame(mode);
    if (!game) {
      set({ error: "noGame" });
      return;
    }
    const host = session.members.get(session.hostId);
    const room: MultiplayerRoom = {
      session,
      mode,
      isHost: session.isHost,
      settings: settingsFromState(game, host?.State),
      lateJoin,
      leave: () => api.leave(),
    };
    set({ started: mode, error: null });
    deps.navigate(mode);
    // After the switch: the game's scene becomes active on the next render.
    setTimeout(() => {
      void Promise.resolve(game.start(room)).catch(() =>
        set({ error: "startFailed" }),
      );
    }, 0);
  };

  const attach = (session: RealtimeSession, joinCode: string | null) => {
    for (const off of offs.splice(0)) off();
    set({ session, joinCode, started: null, chat: [], error: null });
    offs = [
      session.on("message", ({ from, data }) => {
        if (state.started || from !== session.hostId) return;
        const mode = decodeStart(data);
        if (mode) enter(mode, false);
      }),
      session.on("membersUpdated", () => {
        const mode = startedMode(session.members.get(session.hostId));
        if (mode && !state.started) enter(mode, false);
        else set({});
      }),
      session.on("hostChanged", () => set({})),
      session.on("chat", ({ from, text }) =>
        set({
          chat: [...state.chat, { from, text, at: Date.now() }].slice(-100),
        }),
      ),
      session.on("roomClosed", () => reset()),
      session.on("removed", () => reset()),
    ];
  };

  const api = {
    get: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    /** Create a room for a game — this player hosts it. */
    async create(o: CreateOptions): Promise<string | null> {
      const game = deps.games.getGame(o.mode);
      if (!game) return "noGame";
      const res = await factory.create(deps.client, o.name, {
        topology: game.topology ?? "Mesh",
        chatMode: game.chatMode ?? "ServerRelay",
        maxPlayers: o.maxPlayers,
        visibility: o.private ? "Private" : "Public",
        joinCode: o.private ? o.joinCode : undefined,
        mode: o.mode,
      });
      if (!res.ok) return res.error;
      attach(res.data, o.private ? o.joinCode : null);
      // The settings live in the host's member state: whoever joins reads them from the snapshot.
      const saved = await deps.client.multiplayer.setMemberState(
        res.data.roomId,
        undefined,
        settingsToState(o.settings),
      );
      if (!saved.ok) return saved.error;
      await res.data.refreshMembers();
      return null;
    },

    /** Join a room; into its game right away when the game is running and lets players in. */
    async join(roomId: string, joinCode?: string): Promise<string | null> {
      const res = await factory.join(
        deps.client,
        roomId,
        joinCode || undefined,
      );
      if (!res.ok) return res.error;
      const session = res.data;
      attach(session, joinCode || null);
      const running = startedMode(session.members.get(session.hostId));
      if (running) {
        if (deps.games.getGame(running)?.joinInProgress) enter(running, true);
        else {
          await api.leave();
          return "inProgress";
        }
      }
      return null;
    },

    async setReady(ready: boolean): Promise<string | null> {
      const s = state.session;
      if (!s) return null;
      const res = await deps.client.multiplayer.setMemberState(s.roomId, ready);
      return res.ok ? null : res.error;
    },

    async sendChat(text: string): Promise<string | null> {
      const s = state.session;
      if (!s || !text.trim()) return null;
      const res = await deps.client.multiplayer.sendChat(s.roomId, text.trim());
      return res.ok ? null : res.error;
    },

    /** The host takes the whole room into its game. */
    async start(): Promise<string | null> {
      const s = state.session;
      const mode = s?.mode;
      if (!s || !mode || !s.isHost) return null;
      const host = s.members.get(s.selfId);
      const res = await deps.client.multiplayer.setMemberState(s.roomId, true, {
        ...(host?.State ?? {}),
        [START_KEY]: mode,
      });
      if (!res.ok) return res.error;
      s.broadcast("rel", encodeStart(mode));
      enter(mode, false);
      return null;
    },

    /** Back to the running game from the lobby (the room is still on). */
    resume() {
      if (state.started) deps.navigate(state.started);
    },

    async kick(userId: string): Promise<string | null> {
      const s = state.session;
      if (!s) return null;
      const res = await s.kick(userId);
      return res.ok ? null : res.error;
    },

    async leave(): Promise<void> {
      const s = state.session;
      reset();
      await s?.leave();
    },
  };
  return api;
}

export type Rooms = ReturnType<typeof createRooms>;
