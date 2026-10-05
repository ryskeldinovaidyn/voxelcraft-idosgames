import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type {
  MailboxCategory,
  MailboxDefinitions,
  MailboxGiftStatusResponse,
  MailboxLetter,
  MailboxPendingReward,
} from "@idosgames/core";
import type {
  FeatureRegistry,
  FeatureScreenProps,
} from "@idosgames/module-sdk";
import { useIDosGamesClient, useUserState } from "@idosgames/react";
import {
  Button,
  Card,
  Center,
  ConfirmPopup,
  EmptyState,
  Icon,
  Popup,
  ResourceBadge,
  ResourceList,
  Spinner,
  Tabs,
  Timer,
  configSection,
  errorText,
  grantLines,
  grantedBy,
  bundleLines,
  isGlyph,
  outlined,
  pickLanguage,
  panel,
  useCatalog,
  useCelebrate,
  useNow,
  useStagger,
  useToast,
  useUiKit,
  v,
  type Glyph,
} from "@idosgames/react/ui";
import {
  afterFee,
  claimableCount,
  expiresSoon,
  feePercent,
  letterState,
  letterText,
  mailBadge,
  mergePages,
  newRequestID,
  transferEntries,
  transferOptions,
  type TransferInventory,
  type TransferOption,
} from "./model";
import { builtInText, mailError, t } from "./i18n";

// Mailbox (Unity V2/Runtime/UI/Mailbox): letters newest first by category, a letter opened in a
// popup, "Claim" / "Claim all", missed rewards of other systems on top, and "Send gifts" — a free
// daily gift to friends and a transfer of own resources. Everything the server decides (expiry,
// limits, friendship) comes back as its codes; the screen only words them.

type Tab = "all" | "Reward" | "Gift" | "System";

/** What `ctx.features.open("mailbox", args)` understands — the friends system sends it. */
interface MailboxArgs {
  friendUserID?: string;
  friendName?: string;
  mode?: "gift" | "transfer";
}

interface Friend {
  UserID: string;
  PublicData?: { Username?: string | null; AvatarUrl?: string | null } | null;
}

function words(error: string | null | undefined): string {
  return mailError(error) ?? errorText(error);
}

function friendName(f: Friend): string {
  const name = f.PublicData?.Username?.trim();
  if (name) return name;
  return f.UserID.length > 10
    ? `${f.UserID.slice(0, 5)}…${f.UserID.slice(-4)}`
    : f.UserID;
}

const CATEGORY_GLYPH: Record<MailboxCategory, Glyph> = {
  System: "bell",
  Reward: "chest",
  Gift: "gift",
  Social: "friends",
};

const MODULE_GLYPH: Record<string, Glyph> = {
  Leaderboard: "trophy",
  CoopEvent: "swords",
  Season: "crown",
  Referral: "link",
};

/** Badge on login and on coming back to the tab; mailbox actions refresh it themselves. */
export function makeMailboxWatcher(features: FeatureRegistry) {
  return function MailboxWatcher(): ReactNode {
    const client = useIDosGamesClient();
    useEffect(() => {
      const off = client.on("mailbox:countersChanged", (c) =>
        features.setBadge("mailbox", mailBadge(c)),
      );
      void client.mailbox.getUnreadCount();
      const onVisible = () => {
        if (document.visibilityState === "visible")
          void client.mailbox.getUnreadCount();
      };
      document.addEventListener("visibilitychange", onVisible);
      return () => {
        off();
        document.removeEventListener("visibilitychange", onVisible);
      };
    }, [client]);
    return null;
  };
}

export function makeMailboxScreen(features: FeatureRegistry) {
  return function MailboxScreen({ args }: FeatureScreenProps): ReactNode {
    const client = useIDosGamesClient();
    const defs = configSection<MailboxDefinitions>(client, "Mailbox");
    if (defs?.Enabled !== true)
      return <EmptyState glyph="gift" text={t("disabled")} />;
    return (
      <Mailbox
        features={features}
        defs={defs}
        args={(args ?? {}) as MailboxArgs}
      />
    );
  };
}

function Mailbox({
  features,
  defs,
  args,
}: {
  features: FeatureRegistry;
  defs: MailboxDefinitions;
  args: MailboxArgs;
}): ReactNode {
  const client = useIDosGamesClient();
  const toast = useToast();
  const celebrate = useCelebrate();
  const stagger = useStagger();
  const now = useNow(30_000);
  const [tab, setTab] = useState<Tab>("all");
  const [letters, setLetters] = useState<MailboxLetter[] | null>(null);
  const [pending, setPending] = useState<MailboxPendingReward[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyAll, setBusyAll] = useState(false);
  const [opened, setOpened] = useState<MailboxLetter | null>(null);
  const [askClean, setAskClean] = useState(false);
  const [gifts, setGifts] = useState<MailboxArgs | null>(
    args.friendUserID || args.mode ? args : null,
  );

  const category = tab === "all" ? undefined : tab;
  // Letters in the language the screen speaks: the game's own locale when it has localization
  // tables, else the kit's language — otherwise a Russian screen showed English letters.
  const language = client.localization.locale ?? pickLanguage();
  const load = useCallback(async () => {
    const res = await client.mailbox.getMessages({ category, language });
    if (!res.ok) {
      toast(words(res.error), "error");
      setLetters([]);
      return;
    }
    setLetters(res.data.Messages);
    setPending(res.data.PendingRewards ?? []);
    setCursor(res.data.NextCursor ?? null);
  }, [client, category, language]);
  useEffect(() => {
    setLetters(null);
    void load();
  }, [load]);

  const more = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    const res = await client.mailbox.getMessages({
      category,
      cursor,
      language,
    });
    setLoadingMore(false);
    if (!res.ok) return toast(words(res.error), "error");
    setLetters((shown) => mergePages(shown ?? [], res.data.Messages));
    setCursor(res.data.NextCursor ?? null);
  };

  const claimAll = async () => {
    setBusyAll(true);
    const res = await client.mailbox.claimAll();
    setBusyAll(false);
    if (!res.ok) return toast(words(res.error), "error");
    const got = grantedBy(res.data);
    if (got.length > 0) celebrate(got);
    if (res.data.Failed.length > 0)
      toast(words(res.data.Failed[0]?.Error), "error");
    await load();
  };

  const cleanRead = async () => {
    const res = await client.mailbox.deleteMessages("allRead");
    if (!res.ok) {
      toast(words(res.error), "error");
      return false;
    }
    toast(t("deleted"));
    await load();
  };

  const giftsOn =
    Object.values(defs.Gifts?.Social ?? {}).some(
      (g) => g && g.Enabled !== false,
    ) || defs.Gifts?.Transfer?.Enabled === true;
  const shownPending = tab === "all" || tab === "Reward" ? pending : [];
  const toClaim = letters ? claimableCount(letters, shownPending, now) : 0;
  const hasRead = (letters ?? []).some(
    (l) => l.ReadAt && letterState(l, now) !== "claimable",
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        gap: 10,
      }}
    >
      <Tabs<Tab>
        tabs={[
          { id: "all", label: t("tabAll") },
          { id: "Reward", label: t("tabReward"), glyph: "chest" },
          { id: "Gift", label: t("tabGift"), glyph: "gift" },
          { id: "System", label: t("tabSystem"), glyph: "bell" },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {toClaim > 1 ? (
          <Button
            tone="green"
            attract
            busy={busyAll}
            onClick={() => void claimAll()}
            style={{ flex: 1 }}
          >
            {t("claimAll")} · {toClaim}
          </Button>
        ) : null}
        {giftsOn ? (
          <Button
            tone="gold"
            onClick={() => setGifts({})}
            style={{ flex: 1 }}
            data-tutorial-anchor="mailbox:gifts"
          >
            <Icon glyph="gift" size={18} /> {t("sendGifts")}
          </Button>
        ) : null}
      </div>

      {letters === null ? (
        <Center>
          <Spinner />
        </Center>
      ) : (
        <>
          {shownPending.length > 0 ? (
            <div style={{ ...outlined, fontSize: 13, color: v.textDim }}>
              {t("waiting")}
            </div>
          ) : null}
          {shownPending.map((p, i) => (
            <PendingRow
              key={p.MessageID}
              reward={p}
              onClaimed={load}
              style={stagger(i)}
            />
          ))}
          {letters.length === 0 && shownPending.length === 0 ? (
            <EmptyState
              glyph="gift"
              text={tab === "all" ? t("empty") : t("emptyTab")}
            />
          ) : null}
          {letters.map((l, i) => (
            <LetterRow
              key={l.MessageID}
              letter={l}
              now={now}
              onOpen={() => setOpened(l)}
              onClaimed={load}
              style={stagger(i + shownPending.length)}
            />
          ))}
          {cursor ? (
            <Button
              tone="grey"
              size="sm"
              busy={loadingMore}
              onClick={() => void more()}
            >
              {t("more")}
            </Button>
          ) : null}
          {hasRead ? (
            <Button tone="grey" size="sm" onClick={() => setAskClean(true)}>
              <Icon glyph="trash" size={16} /> {t("deleteRead")}
            </Button>
          ) : null}
        </>
      )}

      {opened ? (
        <LetterPopup
          letter={opened}
          features={features}
          onClose={() => setOpened(null)}
          onRead={(id, readAt) =>
            setLetters((shown) =>
              (shown ?? []).map((l) =>
                l.MessageID === id ? { ...l, ReadAt: readAt } : l,
              ),
            )
          }
          onChanged={load}
        />
      ) : null}
      {askClean ? (
        <ConfirmPopup
          title={t("deleteRead")}
          tone="red"
          onClose={() => setAskClean(false)}
          onConfirm={cleanRead}
        >
          <div style={{ ...outlined, fontSize: 14, textAlign: "center" }}>
            {t("deleteReadAsk")}
          </div>
        </ConfirmPopup>
      ) : null}
      {gifts ? (
        <GiftsPopup
          defs={defs}
          initial={gifts}
          onClose={() => setGifts(null)}
        />
      ) : null}
    </div>
  );
}

function LetterIcon({
  icon,
  fallback,
  size = 34,
}: {
  icon: string | null | undefined;
  fallback: Glyph;
  size?: number;
}): ReactNode {
  const glyph =
    icon && (isGlyph(icon) || !/^https?:/i.test(icon)) ? icon : null;
  if (icon && /^https?:/i.test(icon))
    return (
      <img
        src={icon}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          objectFit: "cover",
        }}
      />
    );
  return <Icon glyph={glyph ?? fallback} size={size} />;
}

function LetterRow({
  letter,
  now,
  onOpen,
  onClaimed,
  style,
}: {
  letter: MailboxLetter;
  now: number;
  onOpen: () => void;
  onClaimed: () => Promise<void>;
  style: CSSProperties;
}): ReactNode {
  const client = useIDosGamesClient();
  const toast = useToast();
  const celebrate = useCelebrate();
  const kit = useUiKit();
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const state = letterState(letter, now);
  const text = letterText(letter, builtInText);
  const unread = !letter.ReadAt;
  const reward = grantLines(letter.Rewards);

  const claim = async () => {
    setBusy(true);
    const res = await client.mailbox.claimReward(letter.MessageID);
    setBusy(false);
    if (!res.ok) return toast(words(res.error), "error");
    kit.play("claim");
    kit.fx.burst(ref.current);
    const got = grantedBy(res.data);
    celebrate(got.length > 0 ? got : reward);
    await onClaimed();
  };

  return (
    <div
      ref={ref}
      onClick={onOpen}
      className="idos-press"
      style={{
        ...panel,
        padding: 10,
        display: "flex",
        alignItems: "center",
        gap: 10,
        cursor: "pointer",
        border: state === "claimable" ? `2px solid ${v.gold}` : panel.border,
        opacity: state === "claimed" || state === "expired" ? 0.6 : 1,
        ...style,
      }}
    >
      <div style={{ position: "relative" }}>
        <LetterIcon
          icon={letter.Icon}
          fallback={CATEGORY_GLYPH[letter.Category]}
        />
        {unread ? (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              width: 10,
              height: 10,
              borderRadius: 5,
              background: v.red,
            }}
          />
        ) : null}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 3 }}>
        <div
          style={{
            ...outlined,
            fontSize: 15,
            fontWeight: unread ? 800 : 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {text.subject || t("title")}
        </div>
        <div
          style={{
            ...outlined,
            fontSize: 12,
            color: v.textDim,
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {letter.SenderName ? <span>{letter.SenderName}</span> : null}
          <span>{new Date(letter.SentAt).toLocaleDateString()}</span>
          {state === "claimable" && expiresSoon(letter, now) ? (
            <Timer at={letter.ExpiresAt} now={now} label={t("expiresIn")} />
          ) : null}
        </div>
        {reward.length > 0 ? <ResourceList lines={reward} size={20} /> : null}
      </div>
      {state === "claimable" ? (
        <Button
          size="sm"
          tone="green"
          attract
          busy={busy}
          onClick={(e) => {
            e.stopPropagation();
            void claim();
          }}
        >
          {t("claim")}
        </Button>
      ) : state === "claimed" ? (
        <Icon glyph="check" size={22} />
      ) : state === "expired" ? (
        <Icon glyph="clock" size={22} />
      ) : null}
    </div>
  );
}

function PendingRow({
  reward,
  onClaimed,
  style,
}: {
  reward: MailboxPendingReward;
  onClaimed: () => Promise<void>;
  style: CSSProperties;
}): ReactNode {
  const client = useIDosGamesClient();
  const toast = useToast();
  const celebrate = useCelebrate();
  const kit = useUiKit();
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const text = letterText(reward, builtInText);
  const lines = grantLines(reward.Rewards);
  const claim = async () => {
    setBusy(true);
    const res = await client.mailbox.claimReward(reward.MessageID);
    setBusy(false);
    if (!res.ok) return toast(words(res.error), "error");
    kit.play("claim");
    kit.fx.burst(ref.current);
    const got = grantedBy(res.data);
    celebrate(got.length > 0 ? got : lines);
    await onClaimed();
  };
  return (
    <div
      ref={ref}
      style={{
        ...panel,
        padding: 10,
        display: "flex",
        alignItems: "center",
        gap: 10,
        border: `2px solid ${v.gold}`,
        ...style,
      }}
    >
      <Icon glyph={MODULE_GLYPH[reward.Module] ?? "chest"} size={34} />
      <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 3 }}>
        <div style={{ ...outlined, fontSize: 15 }}>{text.subject}</div>
        {text.body ? (
          <div style={{ ...outlined, fontSize: 12, color: v.textDim }}>
            {text.body}
          </div>
        ) : null}
        {lines.length > 0 ? <ResourceList lines={lines} size={20} /> : null}
      </div>
      <Button
        size="sm"
        tone="green"
        attract
        busy={busy}
        onClick={() => void claim()}
      >
        {t("claim")}
      </Button>
    </div>
  );
}

function LetterPopup({
  letter,
  features,
  onClose,
  onRead,
  onChanged,
}: {
  letter: MailboxLetter;
  features: FeatureRegistry;
  onClose: () => void;
  onRead: (id: string, readAt: string) => void;
  onChanged: () => Promise<void>;
}): ReactNode {
  const client = useIDosGamesClient();
  const toast = useToast();
  const celebrate = useCelebrate();
  const kit = useUiKit();
  const now = useNow(30_000);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<"decline" | null>(null);
  const [claimedNow, setClaimedNow] = useState(false);
  const text = letterText(letter, builtInText);
  const reward = grantLines(letter.Rewards);
  const state = claimedNow ? "claimed" : letterState(letter, now);

  // Opening a letter reads it — once, and only an unread one.
  useEffect(() => {
    if (letter.ReadAt) return;
    void client.mailbox.readMessages([letter.MessageID]).then((r) => {
      if (r.ok) onRead(letter.MessageID, new Date().toISOString());
    });
  }, [letter.MessageID]);

  const claim = async () => {
    setBusy(true);
    const res = await client.mailbox.claimReward(letter.MessageID);
    setBusy(false);
    if (!res.ok) return toast(words(res.error), "error");
    kit.play("claim");
    const got = grantedBy(res.data);
    celebrate(got.length > 0 ? got : reward);
    setClaimedNow(true);
    await onChanged();
  };
  const remove = async (force: boolean) => {
    const res = await client.mailbox.deleteMessages([letter.MessageID], {
      force,
    });
    if (!res.ok) {
      toast(words(res.error), "error");
      return false;
    }
    toast(force ? t("declined") : t("deleted"));
    await onChanged();
    onClose();
  };
  const link = letter.Link;
  const follow = () => {
    if (link?.FeatureID) {
      onClose();
      features.open(link.FeatureID, link.Args ?? undefined);
    } else if (link?.Url && /^https:\/\//i.test(link.Url)) {
      window.open(link.Url, "_blank", "noopener,noreferrer");
    }
  };
  const canFollow =
    (!!link?.FeatureID && !!features.get(link.FeatureID)?.available) ||
    (!!link?.Url && /^https:\/\//i.test(link.Url));

  return (
    <Popup title={text.subject || t("title")} onClose={onClose} width={440}>
      {letter.Banner && /^https?:/i.test(letter.Banner) ? (
        <img
          src={letter.Banner}
          alt=""
          style={{
            width: "100%",
            borderRadius: 10,
            objectFit: "cover",
            maxHeight: 180,
          }}
        />
      ) : null}
      {letter.SenderName ? (
        <div style={{ ...outlined, fontSize: 12, color: v.textDim }}>
          {t("from")}: {letter.SenderName} ·{" "}
          {new Date(letter.SentAt).toLocaleString()}
        </div>
      ) : null}
      {text.body ? (
        <div
          style={{
            ...outlined,
            fontSize: 14,
            whiteSpace: "pre-wrap",
            lineHeight: 1.4,
          }}
        >
          {text.body}
        </div>
      ) : null}
      {letter.SenderNote ? (
        <div
          style={{
            ...panel,
            padding: 10,
            ...outlined,
            fontSize: 13,
            fontStyle: "italic",
          }}
        >
          «{letter.SenderNote}»
        </div>
      ) : null}
      {reward.length > 0 ? (
        <div style={{ display: "grid", justifyItems: "center", gap: 6 }}>
          <ResourceList lines={reward} size={34} gap={12} />
          {state === "claimable" && letter.ExpiresAt ? (
            <Timer at={letter.ExpiresAt} now={now} label={t("expiresIn")} />
          ) : null}
        </div>
      ) : null}
      <div style={{ display: "grid", gap: 8 }}>
        {state === "claimable" ? (
          <Button tone="green" attract busy={busy} onClick={() => void claim()}>
            {t("claim")}
          </Button>
        ) : state === "claimed" ? (
          <div style={{ ...outlined, textAlign: "center", color: v.green }}>
            <Icon glyph="check" size={18} /> {t("claimed")}
          </div>
        ) : state === "expired" ? (
          <div style={{ ...outlined, textAlign: "center", color: v.textDim }}>
            {t("expired")}
          </div>
        ) : null}
        {canFollow ? (
          <Button tone="blue" onClick={follow}>
            {link?.Label || t("open")}
          </Button>
        ) : null}
        {state === "claimable" && letter.IsTransfer ? (
          <Button tone="grey" onClick={() => setAsk("decline")}>
            {t("decline")}
          </Button>
        ) : state !== "claimable" ? (
          <Button tone="grey" size="sm" onClick={() => void remove(false)}>
            <Icon glyph="trash" size={16} /> {t("delete")}
          </Button>
        ) : null}
      </div>
      {ask ? (
        <ConfirmPopup
          title={t("decline")}
          tone="red"
          onClose={() => setAsk(null)}
          onConfirm={() => remove(true)}
        >
          <div style={{ ...outlined, fontSize: 14, textAlign: "center" }}>
            {t("declineAsk")}
          </div>
        </ConfirmPopup>
      ) : null}
    </Popup>
  );
}

// ── Gifts ──────────────────────────────────────────────────────────────────

function GiftsPopup({
  defs,
  initial,
  onClose,
}: {
  defs: MailboxDefinitions;
  initial: MailboxArgs;
  onClose: () => void;
}): ReactNode {
  const client = useIDosGamesClient();
  const social = Object.entries(defs.Gifts?.Social ?? {}).filter(
    ([, g]) => g && g.Enabled !== false,
  );
  const transferOn = defs.Gifts?.Transfer?.Enabled === true;
  const [mode, setMode] = useState<"gift" | "transfer">(
    initial.mode === "transfer" && transferOn
      ? "transfer"
      : social.length > 0
        ? "gift"
        : "transfer",
  );
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [status, setStatus] = useState<MailboxGiftStatusResponse | null>(null);

  const refresh = useCallback(async () => {
    const s = await client.mailbox.getGiftStatus();
    if (s.ok) setStatus(s.data);
  }, [client]);
  useEffect(() => {
    void client.social.getFriendsList().then((r) => {
      const list = (r.ok ? (r.data.Friends ?? []) : []) as Friend[];
      setFriends(
        [...list].sort((a, b) => friendName(a).localeCompare(friendName(b))),
      );
    });
    void refresh();
  }, [client, refresh]);

  return (
    <Popup title={t("sendGifts")} onClose={onClose} width={460}>
      <Tabs<"gift" | "transfer">
        tabs={[
          ...(social.length > 0
            ? [{ id: "gift" as const, label: t("gift"), glyph: "gift" }]
            : []),
          ...(transferOn
            ? [{ id: "transfer" as const, label: t("transfer"), glyph: "bag" }]
            : []),
        ]}
        value={mode}
        onChange={setMode}
      />
      {friends === null ? (
        <Center minHeight={160}>
          <Spinner />
        </Center>
      ) : friends.length === 0 ? (
        <EmptyState glyph="friends" text={t("noFriends")} />
      ) : mode === "gift" ? (
        <SocialGifts
          gifts={social}
          friends={friends}
          status={status}
          initialFriend={initial.friendUserID}
          onSent={refresh}
        />
      ) : (
        <Transfer
          defs={defs}
          friends={friends}
          status={status}
          initialFriend={initial.friendUserID}
          onSent={refresh}
          onDone={onClose}
        />
      )}
    </Popup>
  );
}

function FriendChip({
  friend,
  selected,
  done,
  onClick,
}: {
  friend: Friend;
  selected: boolean;
  done?: boolean;
  onClick?: () => void;
}): ReactNode {
  return (
    <div
      onClick={done ? undefined : onClick}
      className={done ? undefined : "idos-press"}
      style={{
        ...panel,
        padding: "8px 10px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        cursor: done ? "default" : "pointer",
        border: selected ? `2px solid ${v.gold}` : panel.border,
        opacity: done ? 0.55 : 1,
      }}
    >
      {friend.PublicData?.AvatarUrl ? (
        <img
          src={friend.PublicData.AvatarUrl}
          alt=""
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            objectFit: "cover",
          }}
        />
      ) : (
        <Icon glyph="user" size={26} />
      )}
      <span
        style={{
          ...outlined,
          fontSize: 14,
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {friendName(friend)}
      </span>
      {done ? (
        <Icon glyph="check" size={18} />
      ) : selected ? (
        <Icon glyph="gift" size={18} />
      ) : null}
    </div>
  );
}

function SocialGifts({
  gifts,
  friends,
  status,
  initialFriend,
  onSent,
}: {
  gifts: Array<
    [
      string,
      NonNullable<NonNullable<MailboxDefinitions["Gifts"]>["Social"]>[string],
    ]
  >;
  friends: Friend[];
  status: MailboxGiftStatusResponse | null;
  initialFriend?: string;
  onSent: () => Promise<void>;
}): ReactNode {
  const client = useIDosGamesClient();
  const toast = useToast();
  const [giftID, setGiftID] = useState(gifts[0]?.[0] ?? "");
  const [picked, setPicked] = useState<Set<string>>(
    () =>
      new Set(
        initialFriend && friends.some((f) => f.UserID === initialFriend)
          ? [initialFriend]
          : [],
      ),
  );
  const [busy, setBusy] = useState(false);
  const now = useNow(30_000);
  const mine = status?.Social?.[giftID];
  const sentTo = new Set(mine?.SentTo ?? []);
  const open = friends.filter((f) => !sentTo.has(f.UserID));
  const gift = gifts.find(([id]) => id === giftID)?.[1];
  const price = bundleLines(gift?.Cost);

  const send = async (ids: string[]) => {
    if (ids.length === 0) return;
    setBusy(true);
    const res = await client.mailbox.sendGift(giftID, ids);
    setBusy(false);
    if (!res.ok) return toast(words(res.error), "error");
    if (res.data.Sent.length > 0) toast(t("giftSent"), "success");
    if (res.data.Failed.length > 0)
      toast(`${t("someFailed")}: ${words(res.data.Failed[0]?.Error)}`, "error");
    setPicked(new Set());
    await onSent();
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div
        style={{
          ...outlined,
          fontSize: 13,
          color: v.textDim,
          textAlign: "center",
        }}
      >
        {t("giftHint")}
      </div>
      {gifts.length > 1 ? (
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {gifts.map(([id, g]) => (
            <Card
              key={id}
              highlight={id === giftID}
              onClick={() => {
                setGiftID(id);
                setPicked(new Set());
              }}
              style={{ padding: 8 }}
            >
              <ResourceList lines={bundleLines(g?.Grant)} size={24} />
            </Card>
          ))}
        </div>
      ) : gift ? (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <ResourceList lines={bundleLines(gift.Grant)} size={30} gap={12} />
        </div>
      ) : null}
      {price.length > 0 ? (
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            justifyContent: "center",
            ...outlined,
            fontSize: 12,
          }}
        >
          {t("pricePerFriend")}: <ResourceList lines={price} size={18} />
        </div>
      ) : null}
      {mine ? (
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "center",
            ...outlined,
            fontSize: 12,
            color: v.textDim,
          }}
        >
          <span>
            {t("leftInPeriod")}: {mine.RemainingInPeriod}
          </span>
          <Timer at={mine.ResetsAt} now={now} label={t("resetsIn")} />
        </div>
      ) : null}
      <div
        style={{ display: "grid", gap: 6, maxHeight: 280, overflowY: "auto" }}
      >
        {friends.map((f) => (
          <FriendChip
            key={f.UserID}
            friend={f}
            done={sentTo.has(f.UserID)}
            selected={picked.has(f.UserID)}
            onClick={() =>
              setPicked((s) => {
                const next = new Set(s);
                if (next.has(f.UserID)) next.delete(f.UserID);
                else next.add(f.UserID);
                return next;
              })
            }
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Button
          tone="green"
          busy={busy}
          disabled={picked.size === 0}
          onClick={() => void send([...picked])}
          style={{ flex: 1 }}
        >
          {t("sendTo")}
          {picked.size > 0 ? ` · ${picked.size}` : ""}
        </Button>
        <Button
          tone="gold"
          attract={open.length > 0}
          busy={busy}
          disabled={open.length === 0}
          onClick={() => void send(open.map((f) => f.UserID))}
          style={{ flex: 1 }}
        >
          {t("toEveryone")}
        </Button>
      </div>
    </div>
  );
}

function Transfer({
  defs,
  friends,
  status,
  initialFriend,
  onSent,
  onDone,
}: {
  defs: MailboxDefinitions;
  friends: Friend[];
  status: MailboxGiftStatusResponse | null;
  initialFriend?: string;
  onSent: () => Promise<void>;
  onDone: () => void;
}): ReactNode {
  const client = useIDosGamesClient();
  const toast = useToast();
  const state = useUserState();
  const catalog = useCatalog();
  const [to, setTo] = useState<string | null>(
    initialFriend && friends.some((f) => f.UserID === initialFriend)
      ? initialFriend
      : null,
  );
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [ask, setAsk] = useState(false);
  // One key per attempt: a retry after a timeout reuses it, so the server never charges twice.
  const requestID = useRef(newRequestID());
  const options = useMemo(
    () =>
      transferOptions(
        defs.Gifts?.Transfer?.AllowedResources,
        state?.InventoryV2 as TransferInventory | undefined,
      ),
    [defs, state?.InventoryV2],
  );
  const entries = transferEntries(options, amounts);
  const friend = friends.find((f) => f.UserID === to) ?? null;
  const now = useNow(30_000);
  const fee = feePercent(defs.Gifts?.Transfer?.FeePercent);
  const receives = afterFee(entries, fee);
  const fixedFee = bundleLines(defs.Gifts?.Transfer?.FeeCost);

  const send = async () => {
    if (!to) return false;
    const res = await client.mailbox.sendTransfer(to, entries, {
      requestID: requestID.current,
      note: note.trim() || undefined,
    });
    if (!res.ok) {
      toast(words(res.error), "error");
      return false;
    }
    requestID.current = newRequestID();
    toast(t("transferSent"), "success");
    await onSent();
    onDone();
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div
        style={{
          ...outlined,
          fontSize: 13,
          color: v.textDim,
          textAlign: "center",
        }}
      >
        {t("transferHint")}
      </div>
      {status?.Transfer ? (
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "center",
            ...outlined,
            fontSize: 12,
            color: v.textDim,
          }}
        >
          <span>
            {t("leftInPeriod")}: {status.Transfer.RemainingInPeriod}
          </span>
          <Timer
            at={status.Transfer.ResetsAt}
            now={now}
            label={t("resetsIn")}
          />
        </div>
      ) : null}
      {fee > 0 || fixedFee.length > 0 ? (
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            ...outlined,
            fontSize: 12,
          }}
        >
          {fee > 0 ? (
            <span>{t("commission").replace("{p}", String(fee))}</span>
          ) : null}
          {fixedFee.length > 0 ? (
            <>
              <span>{t("fixedFee")}:</span>
              <ResourceList lines={fixedFee} size={18} />
            </>
          ) : null}
        </div>
      ) : null}
      <div style={{ ...outlined, fontSize: 13 }}>{t("pickFriend")}</div>
      <div
        style={{ display: "grid", gap: 6, maxHeight: 180, overflowY: "auto" }}
      >
        {friends.map((f) => (
          <FriendChip
            key={f.UserID}
            friend={f}
            selected={to === f.UserID}
            onClick={() => setTo(f.UserID)}
          />
        ))}
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {options.map((o) => (
          <TransferRow
            key={o.key}
            option={o}
            value={amounts[o.key] ?? 0}
            name={
              o.kind === "currency"
                ? catalog.currencyName(o.id)
                : catalog.itemName(o.id)
            }
            onChange={(n) => setAmounts((a) => ({ ...a, [o.key]: n }))}
          />
        ))}
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={120}
        placeholder={t("notePlaceholder")}
        style={{
          ...panel,
          padding: "10px 12px",
          fontSize: 14,
          color: v.text,
          outline: "none",
        }}
      />
      <Button
        tone="green"
        disabled={!to || entries.length === 0 || receives.length === 0}
        onClick={() =>
          entries.length === 0 ? toast(t("nothingToSend")) : setAsk(true)
        }
      >
        {t("sendTo")}
      </Button>
      {ask && friend ? (
        <ConfirmPopup
          title={t("transfer")}
          tone="gold"
          onClose={() => setAsk(false)}
          onConfirm={send}
        >
          <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
            <div style={{ ...outlined, fontSize: 14, textAlign: "center" }}>
              {t("transferAsk").replace("{name}", friendName(friend))}
            </div>
            <ResourceList
              lines={bundleLines({ Entries: entries })}
              size={28}
              gap={12}
            />
            {fee > 0 ? (
              <div style={{ display: "grid", justifyItems: "center", gap: 4 }}>
                <div style={{ ...outlined, fontSize: 12, color: v.textDim }}>
                  {t("friendGets")}
                </div>
                <ResourceList
                  lines={bundleLines({ Entries: receives })}
                  size={22}
                  gap={10}
                />
              </div>
            ) : null}
            {fixedFee.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  ...outlined,
                  fontSize: 12,
                  color: v.textDim,
                }}
              >
                {t("fixedFee")}: <ResourceList lines={fixedFee} size={18} />
              </div>
            ) : null}
          </div>
        </ConfirmPopup>
      ) : null}
    </div>
  );
}

function TransferRow({
  option,
  value,
  name,
  onChange,
}: {
  option: TransferOption;
  value: number;
  name: string;
  onChange: (n: number) => void;
}): ReactNode {
  const disabled = option.max <= 0;
  const set = (n: number) =>
    onChange(Math.max(0, Math.min(option.max, Math.floor(n) || 0)));
  return (
    <div
      style={{
        ...panel,
        padding: 8,
        display: "flex",
        alignItems: "center",
        gap: 8,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <ResourceBadge
        line={{ kind: option.kind, id: option.id, amount: option.owned }}
        size={24}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...outlined, fontSize: 13 }}>{name}</div>
        <div style={{ ...outlined, fontSize: 11, color: v.textDim }}>
          {t("owned")}: {option.owned}
        </div>
      </div>
      <input
        type="number"
        min={0}
        max={option.max}
        disabled={disabled}
        value={value || ""}
        placeholder="0"
        onChange={(e) => set(Number(e.target.value))}
        style={{
          ...panel,
          width: 80,
          padding: "6px 8px",
          fontSize: 15,
          textAlign: "center",
          color: v.text,
          outline: "none",
        }}
      />
      <Button
        size="sm"
        tone="grey"
        disabled={disabled}
        onClick={() => set(option.max)}
      >
        max
      </Button>
    </div>
  );
}
