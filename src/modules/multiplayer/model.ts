// Pure helpers of the rooms system — covered by model.test.ts. No React, no network.

import type { MultiplayerGame } from "@idosgames/module-sdk";

/** The title's Multiplayer section, as far as the rooms system cares. */
export interface MultiplayerSection {
  SystemState?: { Enabled?: boolean | null } | null;
  MaxPlayersPerRoom?: number | null;
  MemberTimeoutMs?: number | null;
}

export interface RoomMember {
  UserID?: string | null;
  Username?: string | null;
  Ready?: boolean | null;
  IsHost?: boolean | null;
  LastSeenMs?: number | null;
  State?: Record<string, string> | null;
}

export interface MemberRow {
  userID: string;
  name: string;
  host: boolean;
  ready: boolean;
  online: boolean;
  me: boolean;
}

/** The room's members: host first, then by name; a member silent past the timeout is offline. */
export function memberRows(
  members: Iterable<RoomMember> | null | undefined,
  me: string | null | undefined,
  hostId: string | null | undefined,
  nowMs: number,
  timeoutMs: number,
): MemberRow[] {
  return [...(members ?? [])]
    .filter((m): m is RoomMember & { UserID: string } => !!m?.UserID)
    .map((m) => ({
      userID: m.UserID,
      name: m.Username || m.UserID,
      host: hostId ? m.UserID === hostId : m.IsHost === true,
      ready: m.Ready === true,
      online: !m.LastSeenMs || nowMs - m.LastSeenMs <= timeoutMs,
      me: m.UserID === me,
    }))
    .sort(
      (a, b) => Number(b.host) - Number(a.host) || a.name.localeCompare(b.name),
    );
}

// ── The host's member state: the game's settings and "the game started" ─────────────────────
//
// The server keeps a small string map per member. The host's map carries the room's settings
// (`set:<id>`) from the moment the room is created, and `start` once "Play" is pressed — so a player
// who joins later reads both from the snapshot, and a guest who missed the DataChannel message still
// learns about the start from the next member refresh.

export const START_KEY = "start";
const SETTING_PREFIX = "set:";

/** The room's settings as the host's member state stores them. */
export function settingsToState(
  settings: Record<string, string | boolean>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, value] of Object.entries(settings))
    out[SETTING_PREFIX + id] =
      typeof value === "boolean" ? (value ? "1" : "0") : value;
  return out;
}

/** The room's settings read back from the host's member state, defaults filled in from the game. */
export function settingsFromState(
  game: Pick<MultiplayerGame, "settings"> | undefined,
  state: Record<string, string> | null | undefined,
): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const field of game?.settings ?? []) {
    const raw = state?.[SETTING_PREFIX + field.id];
    out[field.id] =
      raw === undefined
        ? field.default
        : field.kind === "toggle"
          ? raw === "1"
          : field.options?.some((o) => o.value === raw)
            ? raw
            : field.default;
  }
  return out;
}

/** Default settings of a game (what "Create a room" starts with). */
export function defaultSettings(
  game: Pick<MultiplayerGame, "settings"> | undefined,
): Record<string, string | boolean> {
  return settingsFromState(game, null);
}

/** The game mode the host started for the room (null — still in the lobby). */
export function startedMode(
  host: RoomMember | null | undefined,
): string | null {
  return host?.State?.[START_KEY] || null;
}

// ── The lobby's own DataChannel message ──────────────────────────────────────────────────────
//
// "Play" reaches guests at once over the links the lobby already opened (the member-state poll of a
// guest is slow on purpose). The game owns the channels only after it started, and the host sends
// this before any game message, on the ordered channel — so a game never sees it.

const START_TAG = "idos.lobby.start";

export function encodeStart(mode: string): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({ t: START_TAG, mode }));
}

/** The mode a lobby start message carries, or null for anything else. */
export function decodeStart(data: Uint8Array): string | null {
  if (data.length > 256 || data[0] !== 0x7b) return null;
  try {
    const msg = JSON.parse(new TextDecoder().decode(data)) as {
      t?: unknown;
      mode?: unknown;
    };
    return msg.t === START_TAG && typeof msg.mode === "string"
      ? msg.mode
      : null;
  } catch {
    return null;
  }
}

// ── Rooms list ───────────────────────────────────────────────────────────────────────────────

export interface ListedRoom {
  RoomID?: string | null;
  Name?: string | null;
  Mode?: string | null;
  MemberCount?: number | null;
  MaxPlayers?: number | null;
}

/** Rooms the player can see: only those of a game this app has; of one game when asked. */
export function visibleRooms(
  rooms: ListedRoom[],
  games: string[],
  onlyMode: string | null | undefined,
): ListedRoom[] {
  return rooms.filter(
    (r) =>
      !!r.RoomID &&
      !!r.Mode &&
      games.includes(r.Mode) &&
      (!onlyMode || r.Mode === onlyMode),
  );
}

/** A join code the way players type it: letters and digits, upper case. */
export function cleanCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

/** A fresh private-room code: six letters and digits without look-alikes. */
export function newCode(random: () => number = Math.random): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += abc[Math.floor(random() * abc.length)];
  return out;
}

/** Whether multiplayer is on for the title. */
export function hasTitleData(section: MultiplayerSection | undefined): boolean {
  return !!section && section.SystemState?.Enabled !== false;
}
