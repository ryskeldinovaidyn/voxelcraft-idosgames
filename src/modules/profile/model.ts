// Pure helpers of the profile screen (Unity Alikhan/Username, UI/HUD/Settings): the name rules the
// server applies, the volume as a percentage, and the typed word that unlocks account deletion.
// Covered by model.test.ts.

export const NAME_MIN = 3;
export const NAME_MAX = 24;

/** The server trims and wants 3–24 characters; `null` = fine. */
export function nameProblem(name: string): "short" | "long" | null {
  const n = name.trim().length;
  if (n < NAME_MIN) return "short";
  if (n > NAME_MAX) return "long";
  return null;
}

export function volumePercent(volume: number | null | undefined): number {
  return Math.round(Math.min(1, Math.max(0, Number(volume ?? 1))) * 100);
}

/** Deleting an account can't be undone — the player types the word to unlock the button. */
export function deleteUnlocked(typed: string, word: string): boolean {
  return typed.trim().toUpperCase() === word.toUpperCase();
}

/** "0x1234…abcd" — enough to recognise a wallet without a line-wide hash. */
export function shortAddress(address: string | null | undefined): string {
  const a = (address ?? "").trim();
  return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

/** The server's refusal of an unlink → the key of a sentence the player understands; null — show as is. */
export function unlinkRefusal(
  code: string | null | undefined,
): "unlinkLogin" | "unlinkTooMany" | "unlinkMissing" | null {
  switch (code) {
    case "WALLET_IS_LOGIN_WALLET":
      return "unlinkLogin";
    case "WALLET_CHANGES_TOO_FREQUENT":
      return "unlinkTooMany";
    case "WALLET_NOT_LINKED":
      return "unlinkMissing";
    default:
      return null;
  }
}

/** Languages the title offers, in its order; the picker shows them only when there are two or more. */
export function languageChoices(
  locales:
    | ReadonlyArray<{
        Locale?: string | null;
        DisplayName?: string | null;
        Order?: number | null;
      }>
    | null
    | undefined,
): Array<{ id: string; name: string }> {
  return [...(locales ?? [])]
    .filter((l) => l.Locale)
    .sort((a, b) => Number(a.Order ?? 0) - Number(b.Order ?? 0))
    .map((l) => ({ id: l.Locale!, name: l.DisplayName || l.Locale! }));
}
