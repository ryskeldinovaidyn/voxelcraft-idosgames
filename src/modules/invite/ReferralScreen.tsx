import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { ReferralDefinitions } from "@idosgames/core";
import type {
  FeatureRegistry,
  FeatureScreenProps,
} from "@idosgames/module-sdk";
import { useIDosGamesClient, useUserState } from "@idosgames/react";
import {
  Button,
  Card,
  Center,
  EmptyState,
  errorText,
  formatAmount,
  grantedBy,
  grantLines,
  Icon,
  outlined,
  panel,
  plural,
  Popup,
  ResourceList,
  Spinner,
  toneSurface,
  useCelebrate,
  useStagger,
  useToast,
  useUiKit,
  v,
} from "@idosgames/react/ui";
import {
  inviteRows,
  normalizeCode,
  prettyCode,
  referralBadge,
  type InviteRow,
} from "./model";
import { t } from "./i18n";

// Invite friends (Unity V2/Runtime/UI/Referral): the player's own code and link to share, how many
// friends came by it and the reward ladder for them. Entering a friend's code is a popup (it pays
// the newcomer's gift). Most players arrive bound already — the SDK sends ?ref= with the login.

type ReferralState = {
  Code?: string | null;
  SubscribedToUserID?: string | null;
  FollowersCount?: number | null;
  InviteRewardStates?: Record<
    string,
    { IsClaimed?: boolean | null } | null
  > | null;
};

/** Badge on login: invite rewards ready (definitions + state are one read each, once). */
export function makeReferralWatcher(features: FeatureRegistry) {
  return function ReferralWatcher(): ReactNode {
    const client = useIDosGamesClient();
    const state = useUserState();
    const defs = useRef<ReferralDefinitions | null>(null);
    useEffect(() => {
      void client.referral.getDefinitions().then((r) => {
        defs.current = r.ok ? (r.data.ReferralDefinitions ?? null) : null;
        features.setBadge(
          "invite",
          referralBadge(
            inviteRows(
              defs.current?.InviteRewards,
              client.data.user.state?.Referral as ReferralState | undefined,
            ),
          ),
        );
      });
    }, [client]);
    useEffect(() => {
      if (defs.current)
        features.setBadge(
          "invite",
          referralBadge(
            inviteRows(
              defs.current.InviteRewards,
              state?.Referral as ReferralState | undefined,
            ),
          ),
        );
    }, [state?.Referral]);
    return null;
  };
}

/**
 * `enabled` — whether the title has invites on (Referral.IsEnabled). The tab is always in the lobby;
 * with invites off the screen says so and makes no request (the referral reads mint a code).
 */
export function makeReferralScreen(enabled: boolean) {
  return function ReferralScreen(_: FeatureScreenProps): ReactNode {
    return enabled ? (
      <Referral />
    ) : (
      <EmptyState glyph="link" text={t("disabled")} />
    );
  };
}

function Referral(): ReactNode {
  const client = useIDosGamesClient();
  const toast = useToast();
  const celebrate = useCelebrate();
  const stagger = useStagger();
  const [defs, setDefs] = useState<ReferralDefinitions | null | undefined>(
    undefined,
  );
  const [me, setMe] = useState<ReferralState | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [entering, setEntering] = useState(false);
  const [busyAll, setBusyAll] = useState(false);

  // getUserState is not a pure read: it mints the code lazily and settles a pending gift —
  // so it runs every time the screen opens.
  const load = useCallback(async () => {
    const [d, s] = await Promise.all([
      client.referral.getDefinitions(),
      client.referral.getUserState(),
    ]);
    setDefs(d.ok ? (d.data.ReferralDefinitions ?? null) : null);
    if (s.ok) {
      setMe((s.data.Referral as ReferralState | null) ?? null);
      setUrl(s.data.InviteUrl ?? null);
    }
  }, [client]);
  useEffect(() => {
    void load();
  }, [load]);

  if (defs === undefined)
    return (
      <Center>
        <Spinner />
      </Center>
    );
  if (!defs || !defs.IsEnabled)
    return <EmptyState glyph="link" text={t("disabled")} />;

  const rows = inviteRows(defs.InviteRewards, me);
  const ready = rows.filter((r) => r.state === "ready");

  const copy = (text: string) =>
    void navigator.clipboard?.writeText(text).then(() => toast(t("copied")));
  const share = async () => {
    const link = url ?? "";
    const text = `${t("inviteText")} ${prettyCode(me?.Code)}`;
    if (navigator.share) {
      try {
        await navigator.share({ text, url: link || undefined });
        return;
      } catch {
        // The player closed the share sheet — fall back to copying.
      }
    }
    copy(link ? `${text} ${link}` : text);
  };
  const claimAll = async () => {
    setBusyAll(true);
    const res = await client.referral.claimInviteRewardsBatch(
      ready.map((r) => r.id),
    );
    setBusyAll(false);
    if (!res.ok) return toast(errorText(res.error), "error");
    const got = grantedBy(res.data);
    celebrate(got.length > 0 ? got : ready.flatMap((r) => r.reward));
    await load();
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        gap: 12,
      }}
    >
      <Card
        style={{
          display: "grid",
          gap: 10,
          justifyItems: "center",
          ...toneSurface("green"),
        }}
      >
        <div style={{ ...outlined, fontSize: 14 }}>{t("yourCode")}</div>
        <div
          className="idos-bounce"
          style={{
            ...outlined,
            fontSize: 34,
            letterSpacing: 3,
            fontFamily: "monospace",
          }}
        >
          {me?.Code ? prettyCode(me.Code) : "…"}
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <Button
            size="sm"
            tone="blue"
            disabled={!me?.Code}
            onClick={() => me?.Code && copy(me.Code)}
          >
            <Icon glyph="copy" size={16} /> {t("copyCode")}
          </Button>
          <Button
            size="sm"
            tone="gold"
            attract
            disabled={!me?.Code}
            onClick={() => void share()}
            data-tutorial-anchor="invite:share"
          >
            <Icon glyph="link" size={16} /> {t("share")}
          </Button>
        </div>
      </Card>

      <div
        style={{
          ...panel,
          padding: 12,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Icon glyph="friends" size={30} />
        <div style={{ flex: 1, ...outlined, fontSize: 14 }}>{t("joined")}</div>
        <div style={{ ...outlined, fontSize: 24, color: v.gold }}>
          {formatAmount(Number(me?.FollowersCount ?? 0))}
        </div>
      </div>

      {rows.length > 0 ? (
        <div style={{ ...outlined, fontSize: 14, color: v.textDim }}>
          {t("rewards")}
        </div>
      ) : null}
      {ready.length > 1 ? (
        <Button
          tone="green"
          attract
          busy={busyAll}
          onClick={() => void claimAll()}
        >
          {t("claimAll")} · {ready.length}
        </Button>
      ) : null}
      <div style={{ display: "grid", gap: 8 }}>
        {rows.map((row, i) => (
          <InviteCard
            key={row.id}
            row={row}
            onClaimed={load}
            style={stagger(i)}
          />
        ))}
      </div>

      {me?.SubscribedToUserID ? (
        <div
          style={{
            ...panel,
            padding: 10,
            display: "flex",
            alignItems: "center",
            gap: 8,
            ...outlined,
            fontSize: 13,
            color: v.green,
          }}
        >
          <Icon glyph="check" size={20} /> {t("youCameBy")}
        </div>
      ) : (
        <Button
          tone="blue"
          onClick={() => setEntering(true)}
          data-tutorial-anchor="invite:enter"
        >
          {t("enterCode")}
        </Button>
      )}
      {entering ? (
        <EnterCodePopup
          defs={defs}
          onClose={() => setEntering(false)}
          onDone={load}
        />
      ) : null}
    </div>
  );
}

function InviteCard({
  row,
  onClaimed,
  style,
}: {
  row: InviteRow;
  onClaimed: () => Promise<void>;
  style: CSSProperties;
}): ReactNode {
  const client = useIDosGamesClient();
  const toast = useToast();
  const celebrate = useCelebrate();
  const kit = useUiKit();
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const claim = async () => {
    setBusy(true);
    const res = await client.referral.claimInviteReward(row.id);
    setBusy(false);
    if (!res.ok) return toast(errorText(res.error), "error");
    kit.play("claim");
    kit.fx.burst(ref.current);
    const got = grantedBy(res.data);
    celebrate(got.length > 0 ? got : row.reward);
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
        border: row.state === "ready" ? `2px solid ${v.gold}` : panel.border,
        opacity: row.state === "claimed" ? 0.6 : 1,
        ...style,
      }}
    >
      <div style={{ display: "grid", justifyItems: "center", minWidth: 52 }}>
        <Icon glyph={row.state === "locked" ? "lock" : "friends"} size={24} />
        <span style={{ ...outlined, fontSize: 12 }}>
          {row.required} {plural(row.required, t("friends"))}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 4 }}>
        {row.name ? (
          <div style={{ ...outlined, fontSize: 13, color: v.textDim }}>
            {row.name}
          </div>
        ) : null}
        <ResourceList lines={row.reward} size={26} />
      </div>
      {row.state === "ready" ? (
        <Button
          size="sm"
          tone="green"
          attract
          busy={busy}
          onClick={() => void claim()}
        >
          {t("claim")}
        </Button>
      ) : row.state === "claimed" ? (
        <Icon glyph="check" size={22} />
      ) : null}
    </div>
  );
}

function EnterCodePopup({
  defs,
  onClose,
  onDone,
}: {
  defs: ReferralDefinitions;
  onClose: () => void;
  onDone: () => Promise<void>;
}): ReactNode {
  const client = useIDosGamesClient();
  const toast = useToast();
  const celebrate = useCelebrate();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const code = normalizeCode(value);
  const gift = grantLines(defs.ActivationReward);
  const activate = async () => {
    if (!code) return;
    setBusy(true);
    const res = await client.referral.activateReferralCode(code);
    setBusy(false);
    if (!res.ok) return toast(errorText(res.error), "error");
    toast(t("activated"), "success");
    const got = grantedBy(res.data);
    if (res.data.IsFirstActivation) celebrate(got.length > 0 ? got : gift);
    await onDone();
    onClose();
  };
  return (
    <Popup title={t("enterCode")} onClose={onClose} width={420}>
      <div style={{ ...outlined, fontSize: 14, textAlign: "center" }}>
        {t("enterHint")}
      </div>
      {gift.length > 0 ? (
        <div style={{ display: "grid", justifyItems: "center", gap: 6 }}>
          <div style={{ ...outlined, fontSize: 12, color: v.textDim }}>
            {t("youGet")}
          </div>
          <ResourceList lines={gift} size={32} gap={12} />
        </div>
      ) : null}
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="WDJB-MJHT"
        autoFocus
        maxLength={12}
        onKeyDown={(e) => e.key === "Enter" && void activate()}
        style={{
          ...panel,
          padding: "12px 14px",
          fontSize: 22,
          letterSpacing: 3,
          textAlign: "center",
          textTransform: "uppercase",
          color: v.text,
          outline: "none",
          fontFamily: "monospace",
        }}
      />
      {value && !code ? (
        <div
          style={{
            ...outlined,
            fontSize: 12,
            color: v.red,
            textAlign: "center",
          }}
        >
          {t("badCode")}
        </div>
      ) : null}
      <Button
        tone="green"
        disabled={!code}
        busy={busy}
        onClick={() => void activate()}
      >
        {t("activate")}
      </Button>
    </Popup>
  );
}
