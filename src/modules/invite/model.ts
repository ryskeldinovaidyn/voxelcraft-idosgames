// Pure helpers of the invite screen (Unity V2/Runtime/UI/Referral): the code a player types, the
// ladder of rewards for friends who came by your code, and the badge. The server validates codes,
// counts friends and pays — this only decides what the screen shows. Covered by model.test.ts.

import { grantLines, type ResourceLine } from "@idosgames/react/ui";

/** The code alphabet: no vowels, no 0/O, no 1/I/L — so a code read aloud is typed right. */
const CODE_ALPHABET = /^[BCDFGHJKMNPQRSTVWXZ]{8}$/;

/** A code as the player typed it: separators dropped, upper case; `null` when it can't be a code. */
export function normalizeCode(input: string): string | null {
  const code = input.replace(/[\s\-_.]/g, "").toUpperCase();
  return CODE_ALPHABET.test(code) ? code : null;
}

/** "WDJB-MJHT" — easier to read out and copy by eye. */
export function prettyCode(code: string | null | undefined): string {
  if (!code) return "";
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export interface InviteRow {
  id: string;
  name: string | null;
  required: number;
  reward: ResourceLine[];
  state: "claimed" | "ready" | "locked";
}

export function inviteRows(
  rewards:
    | Record<
        string,
        {
          MilestoneID?: string | null;
          DisplayName?: string | null;
          RequiredProgress?: number | null;
          Rewards?: unknown;
        } | null
      >
    | null
    | undefined,
  state:
    | {
        FollowersCount?: number | null;
        InviteRewardStates?: Record<
          string,
          { IsClaimed?: boolean | null } | null
        > | null;
      }
    | null
    | undefined,
): InviteRow[] {
  const friends = Number(state?.FollowersCount ?? 0);
  return Object.entries(rewards ?? {})
    .filter(([, m]) => m)
    .map(([key, m]) => {
      const id = m!.MilestoneID || key;
      const required = Number(m!.RequiredProgress ?? 0);
      const claimed = state?.InviteRewardStates?.[id]?.IsClaimed === true;
      return {
        id,
        name: m!.DisplayName ?? null,
        required,
        reward: grantLines(m!.Rewards as never),
        state: claimed ? "claimed" : friends >= required ? "ready" : "locked",
      } satisfies InviteRow;
    })
    .sort((a, b) => a.required - b.required || a.id.localeCompare(b.id));
}

/** Badge: invite rewards ready to take. */
export function referralBadge(rows: InviteRow[]): number {
  return rows.filter((r) => r.state === "ready").length;
}

/** Whether invites are on for the title (off by default) — until they are, the lobby hides the tab. */
export function hasTitleData(
  section: { IsEnabled?: boolean | null } | null | undefined,
): boolean {
  return section?.IsEnabled === true;
}
