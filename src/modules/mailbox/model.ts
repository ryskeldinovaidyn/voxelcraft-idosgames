// Pure helpers of the mailbox screen: which letters can be claimed, what a letter says when the
// server sends only its template, the badge, and what a player may transfer to a friend. The server
// owns every rule (expiry, limits, friendship, the transfer white list) — this only decides what the
// screen shows. Covered by model.test.ts.

import type {
  MailboxLetter,
  MailboxPendingReward,
  ResourceEntry,
  TransferableResource,
} from "@idosgames/core";

/** Whether the title has the mailbox on (off by default) — until it is, the lobby hides the tab. */
export function mailboxEnabled(
  section: { Enabled?: boolean | null } | null | undefined,
): boolean {
  return section?.Enabled === true;
}

/**
 * The lobby badge. Unread letters and rewards waiting overlap (a new letter with a gift is both), so
 * the bigger of the two — never their sum.
 */
export function mailBadge(
  counters:
    | { UnreadCount?: number | null; UnclaimedCount?: number | null }
    | null
    | undefined,
): number {
  return Math.max(
    Number(counters?.UnreadCount ?? 0),
    Number(counters?.UnclaimedCount ?? 0),
  );
}

export type LetterState = "claimable" | "claimed" | "plain" | "expired";

export function letterState(
  letter: Pick<MailboxLetter, "HasRewards" | "ClaimedAt" | "ExpiresAt">,
  now: number,
): LetterState {
  if (letter.HasRewards && letter.ClaimedAt) return "claimed";
  if (letter.ExpiresAt && Date.parse(letter.ExpiresAt) <= now) return "expired";
  return letter.HasRewards ? "claimable" : "plain";
}

/** A letter's reward expires within `hours` — the row shows the timer. */
export function expiresSoon(
  letter: Pick<MailboxLetter, "ExpiresAt">,
  now: number,
  hours = 24,
): boolean {
  if (!letter.ExpiresAt) return false;
  const left = Date.parse(letter.ExpiresAt) - now;
  return left > 0 && left <= hours * 3_600_000;
}

/** `{name}` placeholders of a text, filled from the letter's params; unknown ones stay as they are. */
export function fillParams(
  text: string,
  params: Record<string, string> | null | undefined,
): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (all, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key)
      ? String(params[key])
      : all,
  );
}

export interface LetterText {
  subject: string;
  body: string;
}

/**
 * What a letter says. Letters of the platform's own templates (a friend's gift, a missed season
 * reward…) come without text unless the publisher rewrote the template — the screen has those texts
 * in both languages (`builtIn`).
 */
export function letterText(
  letter: {
    Subject?: string | null;
    Body?: string | null;
    TemplateID?: string | null;
    TemplateParams?: Record<string, string> | null;
  },
  builtIn: (templateID: string) => LetterText | null,
): LetterText {
  const fallback = letter.TemplateID ? builtIn(letter.TemplateID) : null;
  return {
    subject: fillParams(
      letter.Subject?.trim() || fallback?.subject || "",
      letter.TemplateParams,
    ),
    body: fillParams(
      letter.Body?.trim() || fallback?.body || "",
      letter.TemplateParams,
    ),
  };
}

/** Everything "Claim all" would take — for the button's count. */
export function claimableCount(
  letters: readonly MailboxLetter[],
  pending: readonly MailboxPendingReward[],
  now: number,
): number {
  return (
    letters.filter((l) => letterState(l, now) === "claimable").length +
    pending.length
  );
}

/** Newer letters first; a page added after "More" never duplicates a letter already shown. */
export function mergePages(
  shown: readonly MailboxLetter[],
  next: readonly MailboxLetter[],
): MailboxLetter[] {
  const seen = new Set(shown.map((l) => l.MessageID));
  return [...shown, ...next.filter((l) => !seen.has(l.MessageID))];
}

// ── Transfers ─────────────────────────────────────────────────────────────

/** Minimal slice of the player's inventory the transfer form reads. */
export interface TransferInventory {
  VirtualCurrencies?: Record<string, { Amount?: number } | null> | null;
  Items?: Record<string, { StackableAmount?: number } | null> | null;
}

export interface TransferOption {
  /** Stable key of the row: "VirtualCurrency:CO", "Item:health_potion". */
  key: string;
  kind: "currency" | "item";
  id: string;
  catalogID: string | null;
  owned: number;
  /** The most that can go in one transfer: the title's cap, but never more than the player has. */
  max: number;
}

/**
 * What the player can transfer: the title's white list (currencies and stackable items only — the
 * server refuses the rest), with how much they own. Rows the player owns nothing of stay, disabled
 * (max 0), so the list does not change shape as balances move.
 */
export function transferOptions(
  allowed:
    readonly (TransferableResource | null | undefined)[] | null | undefined,
  inventory: TransferInventory | null | undefined,
): TransferOption[] {
  const out: TransferOption[] = [];
  for (const r of allowed ?? []) {
    if (!r) continue;
    let option: Omit<TransferOption, "max"> | null = null;
    if (r.Type === "VirtualCurrency" && r.CurrencyID) {
      option = {
        key: `VirtualCurrency:${r.CurrencyID}`,
        kind: "currency",
        id: r.CurrencyID,
        catalogID: null,
        owned: Number(
          inventory?.VirtualCurrencies?.[r.CurrencyID]?.Amount ?? 0,
        ),
      };
    } else if (r.Type === "Item" && r.ItemID) {
      option = {
        key: `Item:${r.ItemID}`,
        kind: "item",
        id: r.ItemID,
        catalogID: r.CatalogID ?? null,
        owned: Number(inventory?.Items?.[r.ItemID]?.StackableAmount ?? 0),
      };
    }
    if (!option) continue;
    const cap =
      r.MaxAmountPerGift && r.MaxAmountPerGift > 0
        ? r.MaxAmountPerGift
        : Infinity;
    out.push({ ...option, max: Math.max(0, Math.min(cap, option.owned)) });
  }
  return out;
}

/** The entries of a transfer from the amounts typed: whole, positive, clamped to each row's max. */
export function transferEntries(
  options: readonly TransferOption[],
  amounts: Record<string, number>,
): ResourceEntry[] {
  const entries: ResourceEntry[] = [];
  for (const o of options) {
    const raw = Math.floor(Number(amounts[o.key] ?? 0));
    const amount = Math.min(Number.isFinite(raw) ? raw : 0, o.max);
    if (amount <= 0) continue;
    entries.push(
      o.kind === "currency"
        ? { Type: "VirtualCurrency", CurrencyID: o.id, Amount: amount }
        : {
            Type: "Item",
            ItemID: o.id,
            ...(o.catalogID ? { CatalogID: o.catalogID } : {}),
            Amount: amount,
          },
    );
  }
  return entries;
}

/** Commission as the server applies it: 0–90 %, anything else clamped. */
export function feePercent(value: number | null | undefined): number {
  const p = Number(value ?? 0);
  if (!Number.isFinite(p) || p <= 0) return 0;
  return Math.min(p, 90);
}

/**
 * The fee of one entry by the platform convention (the server's RateResolver/AmountMath): rounded
 * UP, after snapping double noise to the nearest integer (100 × 0.1 must stay 10, not 11).
 */
function feeOf(amount: number, percent: number): number {
  const v = (amount * percent) / 100;
  if (!(v > 0)) return 0;
  const nearest = Math.round(v);
  if (Math.abs(v - nearest) <= 1e-9 * Math.max(1, Math.abs(v)))
    return Math.min(nearest, amount);
  return Math.min(Math.ceil(v), amount);
}

/**
 * What the friend receives after the commission — per entry, the friend gets the entry minus its
 * fee; entries that end at zero drop out. The same rule as the server's, so the preview matches
 * the letter.
 */
export function afterFee(
  entries: readonly ResourceEntry[],
  percent: number,
): ResourceEntry[] {
  const p = feePercent(percent);
  return entries
    .map((e) => {
      const amount = Number(e.Amount ?? 0);
      return { ...e, Amount: p === 0 ? amount : amount - feeOf(amount, p) };
    })
    .filter((e) => Number(e.Amount) > 0);
}

/** The idempotency key of ONE transfer attempt: a retry after a timeout reuses it, never charges twice. */
export function newRequestID(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
