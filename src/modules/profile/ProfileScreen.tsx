import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { PlayAccessWallet } from "@idosgames/core";
import type {
  FeatureRegistry,
  FeatureScreenProps,
} from "@idosgames/module-sdk";
import { useIDosGamesClient, useUserState } from "@idosgames/react";
import {
  Button,
  ConfirmPopup,
  Icon,
  Popup,
  Tabs,
  errorText,
  outlined,
  panel,
  usePlayerPrefs,
  useToast,
  useUiKit,
  v,
} from "@idosgames/react/ui";
import {
  deleteUnlocked,
  languageChoices,
  nameProblem,
  shortAddress,
  unlinkRefusal,
  volumePercent,
} from "./model";
import { t } from "./i18n";

// Profile and settings (Unity Alikhan/Username, UI/HUD/Settings, Runtime/UI/Consent, Localization):
// the name and ID, sound, volume and motion (kept on this device), the game's language, tutorials,
// linked wallets, logging out and deleting the account. Renaming, unlinking a wallet and deleting are
// popups. No analytics switch (owner's decision 29.09.2026): anonymous analytics stays on as the SDK
// ships it (client.analytics).

export function makeProfileScreen(features: FeatureRegistry) {
  return function ProfileScreen(_: FeatureScreenProps): ReactNode {
    const client = useIDosGamesClient();
    const state = useUserState();
    const toast = useToast();
    const kit = useUiKit();
    const [prefs, setPrefs] = usePlayerPrefs();
    const [name, setName] = useState<string | null>(null);
    const [renaming, setRenaming] = useState(false);
    const [ask, setAsk] = useState<"logout" | "delete" | null>(null);
    const [locale, setLocale] = useState(client.localization.locale ?? "");
    const id = client.auth.context?.userID ?? "";
    const shown = name ?? state?.PublicData?.Username ?? t("guest");
    const languages = languageChoices(client.localization.locales);

    const switchLanguage = async (next: string) => {
      const res = await client.localization.setLocale(next);
      if (!res.ok) return toast(errorText(res.error), "error");
      setLocale(res.data);
    };

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 12,
          maxWidth: 560,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div
          style={{
            ...panel,
            padding: 16,
            display: "grid",
            justifyItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              background: `linear-gradient(180deg, ${v.blue}, ${v.blueDeep})`,
              border: `3px solid color-mix(in srgb, ${v.text} 70%, transparent)`,
              ...outlined,
              fontSize: 36,
            }}
          >
            {(shown.trim()[0] ?? "?").toUpperCase()}
          </div>
          <div style={{ ...outlined, fontSize: 20 }}>{shown}</div>
          <Button
            size="sm"
            tone="blue"
            onClick={() => setRenaming(true)}
            data-tutorial-anchor="profile:rename"
          >
            <Icon glyph="edit" size={16} /> {t("rename")}
          </Button>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              maxWidth: "100%",
            }}
          >
            <span style={{ ...outlined, fontSize: 11, color: v.textDim }}>
              {t("playerID")}
            </span>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 12,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {id}
            </span>
            <button
              type="button"
              aria-label={t("playerID")}
              onClick={() =>
                void navigator.clipboard
                  ?.writeText(id)
                  .then(() => toast(t("copied")))
              }
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 2,
              }}
            >
              <Icon glyph="copy" size={16} />
            </button>
          </div>
        </div>

        <div style={{ ...panel, padding: 12, display: "grid", gap: 12 }}>
          <div style={{ ...outlined, fontSize: 14, color: v.textDim }}>
            {t("settings")}
          </div>
          <Toggle
            glyph={prefs.muted ? "mute" : "sound"}
            label={t("sound")}
            value={!prefs.muted}
            onChange={(on) => {
              setPrefs({ muted: !on });
              if (on) kit.play("click");
            }}
          />
          <div
            style={{ display: "grid", gap: 4, opacity: prefs.muted ? 0.5 : 1 }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                ...outlined,
                fontSize: 13,
              }}
            >
              <span>{t("volume")}</span>
              <span>{volumePercent(prefs.volume)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              disabled={prefs.muted}
              value={volumePercent(prefs.volume)}
              onChange={(e) =>
                setPrefs({ volume: Number(e.target.value) / 100 })
              }
              onPointerUp={() => kit.play("coin")}
              style={{ width: "100%", accentColor: v.gold }}
            />
          </div>
          <Toggle
            glyph="flame"
            label={t("motion")}
            value={prefs.reducedMotion}
            onChange={(on) => setPrefs({ reducedMotion: on })}
          />
          {languages.length > 1 ? (
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ ...outlined, fontSize: 13 }}>{t("language")}</div>
              <Tabs
                tabs={languages.map((l) => ({ id: l.id, label: l.name }))}
                value={
                  languages.find((l) => locale.startsWith(l.id))?.id ??
                  languages[0]!.id
                }
                onChange={(l) => void switchLanguage(l)}
              />
            </div>
          ) : null}
        </div>

        <WalletsSection />

        {features.get("tutorials") ? (
          <Button tone="blue" onClick={() => features.open("tutorials")}>
            <Icon glyph="bulb" size={18} /> {t("tutorials")}
          </Button>
        ) : null}
        <Button tone="grey" onClick={() => setAsk("logout")}>
          <Icon glyph="logout" size={18} /> {t("logout")}
        </Button>
        <Button tone="red" onClick={() => setAsk("delete")}>
          <Icon glyph="trash" size={18} /> {t("delete")}
        </Button>

        {renaming ? (
          <RenamePopup
            current={shown}
            onClose={() => setRenaming(false)}
            onDone={(n) => {
              setName(n);
              setRenaming(false);
            }}
          />
        ) : null}
        {ask === "logout" ? (
          <ConfirmPopup
            title={t("logout")}
            tone="red"
            onClose={() => setAsk(null)}
            // Only the logout: the host returns to the sign-in screen on "auth:loggedOut" by itself.
            // A page reload here blanked the AI Coder's live preview (its files arrive by message
            // and do not survive one) and restarted the whole app for nothing.
            onConfirm={() => client.auth.logout()}
          >
            <div style={{ ...outlined, fontSize: 14, textAlign: "center" }}>
              {t("logoutAsk")}
            </div>
          </ConfirmPopup>
        ) : null}
        {ask === "delete" ? <DeletePopup onClose={() => setAsk(null)} /> : null}
      </div>
    );
  };
}

function Toggle({
  glyph,
  label,
  value,
  onChange,
}: {
  glyph: "sound" | "mute" | "flame" | "globe";
  label: string;
  value: boolean;
  onChange: (on: boolean) => void;
}): ReactNode {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "none",
        border: "none",
        color: v.text,
        cursor: "pointer",
        padding: 0,
        textAlign: "left",
      }}
    >
      <Icon glyph={glyph} size={24} />
      <span style={{ flex: 1, ...outlined, fontSize: 14 }}>{label}</span>
      <span
        style={{
          width: 52,
          height: 30,
          borderRadius: 15,
          background: value ? v.green : v.wellSoft,
          boxShadow: `inset 0 0 0 1px ${v.line}`,
          position: "relative",
          transition: "background .2s",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: value ? 25 : 3,
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "#fff",
            transition: "left .2s",
            boxShadow: "0 2px 4px rgba(0,0,0,.3)",
          }}
        />
      </span>
    </button>
  );
}

/**
 * Wallets linked by signature, each with "Unlink" (`client.auth.unlinkWallet`). Hidden while there are
 * none. The wallet an account signs in with has no button: the server refuses it (`CanUnlink`).
 */
function WalletsSection(): ReactNode {
  const client = useIDosGamesClient();
  const toast = useToast();
  const [wallets, setWallets] = useState<PlayAccessWallet[]>([]);
  const [asking, setAsking] = useState<PlayAccessWallet | null>(null);

  const load = useCallback(async () => {
    const res = await client.blockchain.getPlayAccess();
    if (res.ok) setWallets(res.data.LinkedWallets ?? []);
  }, [client]);
  useEffect(() => {
    void load();
  }, [load]);

  // The popup shows the spinner and closes itself when this resolves.
  const unlink = async (wallet: PlayAccessWallet) => {
    const res = await client.auth.unlinkWallet(wallet.NetworkID ?? "");
    if (!res.ok) {
      const known = unlinkRefusal(res.error);
      toast(known ? t(known) : errorText(res.error), "error");
    } else toast(t("unlinked"), "success");
    await load();
  };

  if (wallets.length === 0) return null;
  return (
    <div style={{ ...panel, padding: 12, display: "grid", gap: 10 }}>
      <div style={{ ...outlined, fontSize: 14, color: v.textDim }}>
        {t("wallets")}
      </div>
      {wallets.map((w) => (
        <div
          key={`${w.NetworkID}:${w.Address}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
          }}
        >
          <Icon glyph="link" size={22} />
          <div style={{ flex: 1, minWidth: 0, display: "grid" }}>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 13,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {shortAddress(w.Address)}
            </span>
            <span style={{ ...outlined, fontSize: 11, color: v.textDim }}>
              {(w.NetworkID ?? "").toUpperCase()}
              {w.CanUnlink === false ? ` · ${t("loginWallet")}` : ""}
            </span>
          </div>
          {w.CanUnlink !== false ? (
            <Button size="sm" tone="grey" onClick={() => setAsking(w)}>
              {t("unlink")}
            </Button>
          ) : null}
        </div>
      ))}
      {asking ? (
        <ConfirmPopup
          title={t("unlinkTitle")}
          confirmLabel={t("unlink")}
          tone="red"
          onClose={() => setAsking(null)}
          onConfirm={() => unlink(asking)}
        >
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 14,
              textAlign: "center",
            }}
          >
            {shortAddress(asking.Address)}
          </div>
          <div
            style={{
              ...outlined,
              fontSize: 13,
              textAlign: "center",
              lineHeight: 1.4,
            }}
          >
            {t("unlinkAsk")}
          </div>
        </ConfirmPopup>
      ) : null}
    </div>
  );
}

function RenamePopup({
  current,
  onClose,
  onDone,
}: {
  current: string;
  onClose: () => void;
  onDone: (name: string) => void;
}): ReactNode {
  const client = useIDosGamesClient();
  const toast = useToast();
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);
  const problem = nameProblem(value);
  const save = async () => {
    if (problem) return;
    setBusy(true);
    const res = await client.user.changeUsername(value.trim());
    setBusy(false);
    if (!res.ok) return toast(errorText(res.error), "error");
    toast(t("renamed"), "success");
    // The SDK does not patch the cached name — the screen shows the server's answer.
    onDone(res.data.Username ?? value.trim());
  };
  return (
    <Popup title={t("rename")} onClose={onClose} width={400}>
      <input
        value={value}
        autoFocus
        maxLength={40}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void save()}
        placeholder={t("newName")}
        style={{
          ...panel,
          padding: "12px 14px",
          fontSize: 16,
          color: v.text,
          outline: "none",
        }}
      />
      {problem ? (
        <div style={{ ...outlined, fontSize: 12, color: v.red }}>
          {problem === "short" ? t("nameShort") : t("nameLong")}
        </div>
      ) : null}
      <Button
        tone="green"
        disabled={!!problem}
        busy={busy}
        onClick={() => void save()}
      >
        {t("save")}
      </Button>
    </Popup>
  );
}

function DeletePopup({ onClose }: { onClose: () => void }): ReactNode {
  const client = useIDosGamesClient();
  const toast = useToast();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const word = t("deleteWord");
  const remove = async () => {
    setBusy(true);
    const res = await client.user.deleteUserAccount();
    setBusy(false);
    if (!res.ok) return toast(errorText(res.error), "error");
    // Logout first: it clears the app's notifications, and "deleted" must be seen on the
    // sign-in screen the host returns to.
    client.auth.logout();
    toast(t("deleted"));
  };
  return (
    <Popup title={t("delete")} onClose={onClose} width={420}>
      <div style={{ ...outlined, fontSize: 14, textAlign: "center" }}>
        {t("deleteAsk")} <span style={{ color: v.red }}>{word}</span>
      </div>
      <input
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={word}
        style={{
          ...panel,
          padding: "12px 14px",
          fontSize: 16,
          color: v.text,
          outline: "none",
          textAlign: "center",
        }}
      />
      <Button
        tone="red"
        disabled={!deleteUnlocked(typed, word)}
        busy={busy}
        onClick={() => void remove()}
      >
        {t("delete")}
      </Button>
    </Popup>
  );
}
