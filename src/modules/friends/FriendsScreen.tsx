import { useCallback, useEffect, useState, type ReactNode } from "react";
import type {
  FeatureRegistry,
  FeatureScreenProps,
} from "@idosgames/module-sdk";
import { useIDosGamesClient, useUserState } from "@idosgames/react";
import {
  Button,
  Center,
  ConfirmPopup,
  EmptyState,
  Icon,
  Popup,
  Spinner,
  Tabs,
  errorText,
  formatAmount,
  outlined,
  panel,
  useStagger,
  useToast,
  useUiKit,
  v,
} from "@idosgames/react/ui";
import {
  actorsText,
  canRemove,
  cleanUserID,
  displayName,
  friendsBadge,
  inboxKind,
  initial,
  sortByName,
  type InboxKind,
  type ProfileView,
} from "./model";
import { t } from "./i18n";

// Friends (Unity Runtime/UI/Friends): the friends list, requests (incoming and sent), suggestions
// and the notification inbox as tabs. A player card, adding by ID and the confirmations are popups.
// In "friends from idosgames.com only" mode the requests, suggestions and "Add" disappear.

type Tab = "friends" | "requests" | "suggested" | "inbox";
type InboxItem = {
  Id: string;
  Verb?: string | null;
  Count?: number | null;
  LastActors?: Array<{ DisplayName?: string | null } | null> | null;
  Payload?: { Title?: string | null } | null;
  OccurredAt?: string | null;
};

/** Keeps the badge: incoming requests (sent with the player state) + unread notifications. */
export function makeFriendsWatcher(features: FeatureRegistry) {
  return function FriendsWatcher(): ReactNode {
    const client = useIDosGamesClient();
    const state = useUserState();
    const [unread, setUnread] = useState(0);
    useEffect(() => {
      const load = () =>
        void client.social
          .getInboxUnread()
          .then((r) => r.ok && setUnread(Number(r.data.UnreadCount ?? 0)));
      load();
      const id = setInterval(load, 5 * 60_000);
      const off = client.on("social:inboxBadge", (r) =>
        setUnread(Number(r.UnreadCount ?? 0)),
      );
      return () => {
        clearInterval(id);
        off();
      };
    }, [client]);
    useEffect(
      () =>
        features.setBadge(
          "friends",
          friendsBadge(
            state?.Social as { IncomingCount?: number } | undefined,
            unread,
          ),
        ),
      [state?.Social, unread],
    );
    return null;
  };
}

export function makeFriendsScreen(features: FeatureRegistry) {
  return function FriendsScreen(_: FeatureScreenProps): ReactNode {
    const client = useIDosGamesClient();
    const state = useUserState();
    const [tab, setTab] = useState<Tab>("friends");
    const [adding, setAdding] = useState(false);
    const [card, setCard] = useState<ProfileView | null>(null);
    const [version, setVersion] = useState(0);
    const requestsAllowed = client.social.friendRequestsAllowed();
    const incoming = Number(
      (state?.Social as { IncomingCount?: number } | undefined)
        ?.IncomingCount ?? 0,
    );
    const refresh = () => setVersion((n) => n + 1);
    const tabs: Array<{ id: Tab; label: string; badge?: number }> = [
      { id: "friends", label: t("friends") },
      ...(requestsAllowed
        ? [
            { id: "requests" as const, label: t("requests"), badge: incoming },
            { id: "suggested" as const, label: t("suggested") },
          ]
        : []),
      { id: "inbox", label: t("inbox") },
    ];
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 12,
        }}
      >
        <MyID />
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Tabs tabs={tabs} value={tab} onChange={setTab} />
          </div>
          {requestsAllowed ? (
            <Button
              tone="gold"
              size="sm"
              onClick={() => setAdding(true)}
              data-tutorial-anchor="friends:add"
            >
              <Icon glyph="plus" size={16} /> {t("add")}
            </Button>
          ) : null}
        </div>
        <div key={`${tab}:${version}`}>
          {tab === "friends" ? <FriendList onPick={setCard} /> : null}
          {tab === "requests" ? (
            <Requests onChange={refresh} onPick={setCard} />
          ) : null}
          {tab === "suggested" ? <Suggested onPick={setCard} /> : null}
          {tab === "inbox" ? <Inbox /> : null}
        </div>
        {adding ? (
          <AddFriendPopup onClose={() => setAdding(false)} onSent={refresh} />
        ) : null}
        {card ? (
          <PlayerCard
            player={card}
            features={features}
            onClose={() => setCard(null)}
            onChange={refresh}
          />
        ) : null}
      </div>
    );
  };
}

function MyID(): ReactNode {
  const client = useIDosGamesClient();
  const toast = useToast();
  const id = client.auth.context?.userID ?? "";
  const copy = () =>
    void navigator.clipboard?.writeText(id).then(() => toast(t("copied")));
  return (
    <div
      style={{
        ...panel,
        padding: 10,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span style={{ ...outlined, fontSize: 12, color: v.textDim }}>
        {t("yourID")}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontFamily: "monospace",
          fontSize: 13,
        }}
      >
        {id}
      </span>
      <Button size="sm" tone="blue" onClick={copy}>
        <Icon glyph="copy" size={16} />
      </Button>
    </div>
  );
}

function Avatar({
  player,
  size = 44,
}: {
  player: ProfileView;
  size?: number;
}): ReactNode {
  const url = player.PublicData?.AvatarUrl;
  return (
    <div
      style={{
        width: size,
        height: size,
        flex: "0 0 auto",
        borderRadius: "50%",
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
        background: `linear-gradient(180deg, ${v.blue}, ${v.blueDeep})`,
        border: `2px solid color-mix(in srgb, ${v.text} 60%, transparent)`,
        ...outlined,
        fontSize: size * 0.42,
      }}
    >
      {url ? (
        <img
          src={url}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        initial(player)
      )}
    </div>
  );
}

function PlayerRow({
  player,
  index,
  onPick,
  right,
}: {
  player: ProfileView;
  index: number;
  onPick?: (p: ProfileView) => void;
  right?: ReactNode;
}): ReactNode {
  const stagger = useStagger();
  return (
    <div
      onClick={onPick ? () => onPick(player) : undefined}
      style={{
        ...panel,
        padding: 10,
        display: "flex",
        alignItems: "center",
        gap: 10,
        cursor: onPick ? "pointer" : undefined,
        ...stagger(index),
      }}
    >
      <Avatar player={player} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            ...outlined,
            fontSize: 15,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {displayName(player)}
        </div>
        <div style={{ ...outlined, fontSize: 12, color: v.textDim }}>
          {player.PublicData?.Level
            ? `${t("level")} ${player.PublicData.Level}`
            : ""}
          {player.PublicData?.Power
            ? ` · ${t("power")} ${formatAmount(player.PublicData.Power)}`
            : ""}
          {player.Source === "Platform" ? ` · ${t("platformFriend")}` : ""}
        </div>
      </div>
      {right}
    </div>
  );
}

function useList(
  load: () => Promise<{
    ok: boolean;
    data?: { Friends?: ProfileView[] | null };
  }>,
): ProfileView[] | null {
  const [list, setList] = useState<ProfileView[] | null>(null);
  useEffect(() => {
    void load().then((r) =>
      setList(r.ok ? sortByName(r.data?.Friends ?? []) : []),
    );
  }, [load]);
  return list;
}

function FriendList({
  onPick,
}: {
  onPick: (p: ProfileView) => void;
}): ReactNode {
  const client = useIDosGamesClient();
  const list = useList(
    useCallback(() => client.social.getFriendsList(), [client]),
  );
  if (!list)
    return (
      <Center>
        <Spinner />
      </Center>
    );
  if (list.length === 0)
    return <EmptyState glyph="friends" text={t("noFriends")} />;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {list.map((p, i) => (
        <PlayerRow key={p.UserID} player={p} index={i} onPick={onPick} />
      ))}
    </div>
  );
}

function Requests({
  onChange,
  onPick,
}: {
  onChange: () => void;
  onPick: (p: ProfileView) => void;
}): ReactNode {
  const client = useIDosGamesClient();
  const toast = useToast();
  const kit = useUiKit();
  const incoming = useList(
    useCallback(() => client.social.getIncomingRequests(), [client]),
  );
  const outgoing = useList(
    useCallback(() => client.social.getOutgoingRequests(), [client]),
  );
  const [busy, setBusy] = useState<string | null>(null);
  if (!incoming || !outgoing)
    return (
      <Center>
        <Spinner />
      </Center>
    );
  if (incoming.length === 0 && outgoing.length === 0)
    return <EmptyState glyph="friends" text={t("noRequests")} />;
  const answer = async (id: string, yes: boolean) => {
    setBusy(id);
    const res = yes
      ? await client.social.acceptFriendRequest(id)
      : await client.social.declineFriendRequest(id);
    setBusy(null);
    if (!res.ok) return toast(errorText(res.error), "error");
    if (yes) kit.play("claim");
    onChange();
  };
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {incoming.length > 0 ? (
        <div style={{ ...outlined, fontSize: 13, color: v.textDim }}>
          {t("incoming")}
        </div>
      ) : null}
      {incoming.map((p, i) => (
        <PlayerRow
          key={p.UserID}
          player={p}
          index={i}
          onPick={onPick}
          right={
            <div
              style={{ display: "flex", gap: 6 }}
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                size="sm"
                tone="green"
                busy={busy === p.UserID}
                onClick={() => void answer(p.UserID, true)}
                data-tutorial-anchor="friends:accept"
              >
                {t("accept")}
              </Button>
              <Button
                size="sm"
                tone="grey"
                disabled={busy === p.UserID}
                onClick={() => void answer(p.UserID, false)}
              >
                ✕
              </Button>
            </div>
          }
        />
      ))}
      {outgoing.length > 0 ? (
        <div style={{ ...outlined, fontSize: 13, color: v.textDim }}>
          {t("outgoing")}
        </div>
      ) : null}
      {outgoing.map((p, i) => (
        <PlayerRow
          key={p.UserID}
          player={p}
          index={incoming.length + i}
          onPick={onPick}
          right={<Icon glyph="clock" size={20} />}
        />
      ))}
    </div>
  );
}

function Suggested({
  onPick,
}: {
  onPick: (p: ProfileView) => void;
}): ReactNode {
  const client = useIDosGamesClient();
  const toast = useToast();
  const list = useList(
    useCallback(() => client.social.getRecommendedFriends(10), [client]),
  );
  const [sent, setSent] = useState<Set<string>>(new Set());
  if (!list)
    return (
      <Center>
        <Spinner />
      </Center>
    );
  if (list.length === 0)
    return <EmptyState glyph="friends" text={t("noSuggestions")} />;
  const add = async (id: string) => {
    const res = await client.social.sendFriendRequest(id);
    if (!res.ok) return toast(errorText(res.error), "error");
    setSent((s) => new Set(s).add(id));
    toast(t("sent"));
  };
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {list.map((p, i) => (
        <PlayerRow
          key={p.UserID}
          player={p}
          index={i}
          onPick={onPick}
          right={
            <span onClick={(e) => e.stopPropagation()}>
              {sent.has(p.UserID) ? (
                <Icon glyph="check" size={22} />
              ) : (
                <Button
                  size="sm"
                  tone="green"
                  onClick={() => void add(p.UserID)}
                >
                  {t("add")}
                </Button>
              )}
            </span>
          }
        />
      ))}
    </div>
  );
}

const VERB_TEXT: Record<InboxKind, Parameters<typeof t>[0]> = {
  attack: "vAttack",
  raid: "vRaid",
  friend: "vFriend",
  sale: "vSale",
  follow: "vFollow",
  like: "vLike",
  comment: "vComment",
  reply: "vReply",
  other: "vOther",
};
const VERB_GLYPH: Record<
  InboxKind,
  "swords" | "flame" | "friends" | "coin" | "user" | "heart" | "chat"
> = {
  attack: "swords",
  raid: "flame",
  friend: "friends",
  sale: "coin",
  follow: "user",
  like: "heart",
  comment: "chat",
  reply: "chat",
  other: "chat",
};

function Inbox(): ReactNode {
  const client = useIDosGamesClient();
  const stagger = useStagger();
  const [items, setItems] = useState<InboxItem[] | null>(null);
  useEffect(() => {
    void client.social.getInbox({ limit: 30 }).then((r) => {
      setItems(r.ok ? ((r.data.Items ?? []) as InboxItem[]) : []);
      // Opening the news marks them seen (once, not per page).
      if (r.ok) void client.social.markInboxSeen();
    });
  }, [client]);
  if (!items)
    return (
      <Center>
        <Spinner />
      </Center>
    );
  if (items.length === 0)
    return <EmptyState glyph="bell" text={t("noInbox")} />;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {items.map((it, i) => {
        const kind = inboxKind(it.Verb);
        return (
          <div
            key={it.Id}
            style={{
              ...panel,
              padding: 10,
              display: "flex",
              alignItems: "center",
              gap: 10,
              ...stagger(i),
            }}
          >
            <Icon glyph={VERB_GLYPH[kind]} size={28} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...outlined, fontSize: 14 }}>
                {actorsText(
                  it.LastActors,
                  it.Count,
                  t("someone"),
                  t("and"),
                  t("more"),
                )}{" "}
                {t(VERB_TEXT[kind])}
                {it.Payload?.Title ? ` · ${it.Payload.Title}` : ""}
              </div>
              {it.OccurredAt ? (
                <div style={{ fontSize: 11, color: v.textDim }}>
                  {new Date(it.OccurredAt).toLocaleString()}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AddFriendPopup({
  onClose,
  onSent,
}: {
  onClose: () => void;
  onSent: () => void;
}): ReactNode {
  const client = useIDosGamesClient();
  const toast = useToast();
  const kit = useUiKit();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const id = cleanUserID(value, client.auth.context?.userID);
  const send = async () => {
    if (!id) return;
    setBusy(true);
    const res = await client.social.sendFriendRequest(id);
    setBusy(false);
    if (!res.ok) return toast(errorText(res.error), "error");
    kit.play("notify");
    toast(t("sent"));
    onSent();
    onClose();
  };
  return (
    <Popup title={t("addFriend")} onClose={onClose} width={400}>
      <div style={{ display: "grid", gap: 10 }}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("playerID")}
          autoFocus
          style={{
            ...panel,
            padding: "12px 14px",
            fontSize: 15,
            color: v.text,
            outline: "none",
            fontFamily: "monospace",
          }}
          onKeyDown={(e) => e.key === "Enter" && void send()}
        />
        {value && !id ? (
          <div style={{ ...outlined, fontSize: 12, color: v.red }}>
            {t("badID")}
          </div>
        ) : null}
        <Button
          tone="green"
          disabled={!id}
          busy={busy}
          onClick={() => void send()}
        >
          {t("send")}
        </Button>
      </div>
    </Popup>
  );
}

function PlayerCard({
  player,
  features,
  onClose,
  onChange,
}: {
  player: ProfileView;
  features: FeatureRegistry;
  onClose: () => void;
  onChange: () => void;
}): ReactNode {
  const client = useIDosGamesClient();
  const toast = useToast();
  const [ask, setAsk] = useState<"remove" | "block" | null>(null);
  const hasChat = !!features.get("chat");
  const hasMail = !!features.get("mailbox")?.available;
  const isFriend =
    !!player.Source ||
    (
      client.data.user.state?.Social?.Accepted as
        Array<{ UserID?: string }> | undefined
    )?.some((f) => f.UserID === player.UserID);
  return (
    <Popup title={displayName(player)} onClose={onClose} width={400}>
      <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
        <Avatar player={player} size={84} />
        <div
          style={{
            ...outlined,
            fontSize: 13,
            color: v.textDim,
            textAlign: "center",
          }}
        >
          {player.PublicData?.Level
            ? `${t("level")} ${player.PublicData.Level}`
            : ""}
          {player.PublicData?.Power
            ? ` · ${t("power")} ${formatAmount(player.PublicData.Power)}`
            : ""}
        </div>
        <div
          style={{ fontFamily: "monospace", fontSize: 11, color: v.textDim }}
        >
          {player.UserID}
        </div>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {hasChat && isFriend ? (
          <Button
            tone="blue"
            onClick={() => {
              // The chat opens in its own window — the card must not stay on top of it.
              onClose();
              features.open("chat", { userID: player.UserID });
            }}
          >
            <Icon glyph="chat" size={18} /> {t("message")}
          </Button>
        ) : null}
        {hasMail && isFriend ? (
          <Button
            tone="gold"
            onClick={() => {
              // Gifts and transfers live in the mailbox — it opens straight on this friend.
              onClose();
              features.open("mailbox", {
                friendUserID: player.UserID,
                friendName: displayName(player),
              });
            }}
          >
            <Icon glyph="gift" size={18} /> {t("gift")}
          </Button>
        ) : null}
        {isFriend && canRemove(player) ? (
          <Button tone="grey" onClick={() => setAsk("remove")}>
            {t("remove")}
          </Button>
        ) : null}
        <Button tone="red" onClick={() => setAsk("block")}>
          {t("block")}
        </Button>
      </div>
      {ask ? (
        <ConfirmPopup
          title={ask === "remove" ? t("remove") : t("block")}
          tone="red"
          onClose={() => setAsk(null)}
          onConfirm={async () => {
            const res =
              ask === "remove"
                ? await client.social.removeFriend(player.UserID)
                : await client.social.block("User", player.UserID);
            if (!res.ok) {
              toast(errorText(res.error), "error");
              return false;
            }
            if (ask === "block") toast(t("blocked"));
            onChange();
            onClose();
          }}
        >
          <div style={{ ...outlined, fontSize: 14, textAlign: "center" }}>
            {ask === "remove" ? t("removeAsk") : t("blockAsk")}
          </div>
        </ConfirmPopup>
      ) : null}
    </Popup>
  );
}
