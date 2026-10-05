// Pure helpers of the friends screen (Unity Runtime/UI/Friends): names, sorting, what can be done
// with a friend, the inbox lines and the badge. The server owns the graph — every rule (limits,
// platform friends, blocks) is enforced there. Covered by model.test.ts.

export interface ProfileView {
  UserID: string;
  PublicData?: {
    Username?: string | null;
    AvatarUrl?: string | null;
    Level?: number | null;
    Power?: number | null;
    Country?: string | null;
  } | null;
  Source?: "Title" | "Platform" | null;
}

/** A player's name: the chosen username, else a short form of the id. */
export function displayName(
  p:
    | {
        UserID?: string | null;
        PublicData?: { Username?: string | null } | null;
      }
    | null
    | undefined,
): string {
  const name = p?.PublicData?.Username?.trim();
  if (name) return name;
  const id = p?.UserID ?? "";
  return id.length > 10 ? `${id.slice(0, 5)}…${id.slice(-4)}` : id || "?";
}

/** The letter for an avatar without a picture. */
export function initial(p: ProfileView | null | undefined): string {
  return (displayName(p).trim()[0] ?? "?").toUpperCase();
}

export function sortByName<T extends ProfileView>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => displayName(a).localeCompare(displayName(b)));
}

/** A platform friend is a mutual follow on idosgames.com — it is removed there, not in the game. */
export function canRemove(friend: ProfileView): boolean {
  return friend.Source !== "Platform";
}

/** A player id typed by hand: trimmed, one token, not my own. */
export function cleanUserID(
  input: string,
  myID: string | null | undefined,
): string | null {
  const id = input.trim();
  if (!id || /\s/.test(id) || id === myID) return null;
  return id;
}

/** Badge: requests waiting for my answer + unread notifications. */
export function friendsBadge(
  social: { IncomingCount?: number | null } | null | undefined,
  inboxUnread: number,
): number {
  return (
    Math.max(0, Number(social?.IncomingCount ?? 0)) + Math.max(0, inboxUnread)
  );
}

export type InboxKind =
  | "attack"
  | "raid"
  | "friend"
  | "sale"
  | "follow"
  | "like"
  | "comment"
  | "reply"
  | "other";

/** The server's verbs are open-ended strings; anything new falls into "other". */
export function inboxKind(verb: string | null | undefined): InboxKind {
  switch (verb) {
    case "Attack":
      return "attack";
    case "Raid":
      return "raid";
    case "FriendAdded":
      return "friend";
    case "WorkshopSale":
      return "sale";
    case "Followed":
      return "follow";
    case "Liked":
      return "like";
    case "Commented":
      return "comment";
    case "Replied":
      return "reply";
    default:
      return "other";
  }
}

/** "Ann", "Ann and Bob", "Ann and 41 more" — the actors of an aggregated notification. */
export function actorsText(
  actors: Array<{ DisplayName?: string | null } | null> | null | undefined,
  count: number | null | undefined,
  someone: string,
  and: string,
  more: string,
): string {
  const names = (actors ?? []).map((a) => a?.DisplayName?.trim() || someone);
  const total = Math.max(Number(count ?? 0), names.length);
  if (names.length === 0) return someone;
  if (total <= 1) return names[0]!;
  if (total === 2 && names.length >= 2) return `${names[0]} ${and} ${names[1]}`;
  return `${names[0]} ${and} ${total - 1} ${more}`;
}
