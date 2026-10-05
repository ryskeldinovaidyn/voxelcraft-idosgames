import {
  useCallback,
  useEffect,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import type {
  WorkshopAccessOption,
  WorkshopAccessOptionInput,
  WorkshopBrowseQuery,
  WorkshopContentResponse,
  WorkshopContentView,
  WorkshopDefinitionsResponse,
  SocialReportReason,
  WorkshopVisibility,
} from "@idosgames/core";
import type {
  ContentRegistry,
  ContentTypeHandler,
  FeatureScreenProps,
  IDosGamesClient,
} from "@idosgames/module-sdk";
import { buttonStyle, panel, v } from "@idosgames/react/ui";

// The Workshop screen: catalog, content card, publish wizard, "mine / licenses / favorites".
//
// It is the same for every game. Everything game-specific comes from two places: the title's Workshop
// config (which types exist, formats, access modes — read via client.workshop.getDefinitions()) and the
// handlers games register in ctx.content (how to list, capture and open their content). This file is
// plain editable React with inline styles — restyle or replace it like any other module source.

/** What the panel needs from the host — the module passes it in at setup(). */
export interface WorkshopHost {
  client: IDosGamesClient;
  content: ContentRegistry;
  navigate(modeId: string): void;
}

/** The Workshop as a tab of the lobby (a feature screen); `navigate` hands the screen to a game. */
export function makeWorkshopScreen(
  host: WorkshopHost,
): ComponentType<FeatureScreenProps> {
  return function WorkshopScreen(): ReactNode {
    return <WorkshopApp host={host} />;
  };
}

type Tab = "catalog" | "publish" | "mine" | "licenses" | "favorites";

const TABS: Array<[Tab, string]> = [
  ["catalog", "Catalog"],
  ["publish", "Publish"],
  ["mine", "My content"],
  ["licenses", "My library"],
  ["favorites", "Favorites"],
];

/** Server error codes → words. Anything else is shown as is (it is already a sentence). */
const ERRORS: Record<string, string> = {
  WORKSHOP_DISABLED: "The Workshop is turned off.",
  WORKSHOP_NOT_CONFIGURED: "The Workshop is not set up in this game yet.",
  WORKSHOP_NOT_AVAILABLE: "The Workshop is not available to you.",
  WORKSHOP_CLOSED: "The Workshop is closed right now.",
  PRICE_CHANGED: "The author changed the price — look at it again.",
  HOLDING_REQUIREMENTS_NOT_MET: "You don't hold what this option requires.",
  ACCESS_DENIED: "You don't have access to this yet.",
  CONTENT_NOT_FOUND: "Not found (or not shared with you).",
  CONTENT_NOT_AVAILABLE: "This publication is not available now.",
  CONTENT_TEXT_REJECTED:
    "The title or description contains words that are not allowed.",
  PUBLISH_LIMIT_REACHED:
    "You have reached the limit of publications of this type.",
  DAILY_PUBLISH_LIMIT_REACHED: "You have reached today's publishing limit.",
  PUBLISH_NOT_ALLOWED: "You can't publish this type of content yet.",
  CANNOT_LIKE_OWN_CONTENT: "You can't like your own publication.",
  WORKSHOP_STORAGE_NOT_CONFIGURED:
    "File storage is not configured for this game.",
  TOO_MANY_PENDING_UPLOADS:
    "You have too many unfinished uploads — try again a bit later.",
  ACCESS_REQUIRED: "Add at least one way for others to get it.",
  OPTION_REQUIRED: "Choose how you want to get it.",
  PRICE_NO_LONGER_ALLOWED: "This price is no longer allowed in this game.",
  TITLE_REQUIRED: "Give it a title.",
  TITLE_TOO_LONG: "The title is too long.",
  THUMBNAIL_REQUIRED: "This type of content needs a preview image.",
  FILE_TOO_LARGE: "The file is too large for this type of content.",
  FILE_TYPE_MISMATCH: "The file does not match its declared format.",
  CONTENT_TYPE_NOT_ALLOWED:
    "This type of content can't be published in this game.",
  CANNOT_REPORT_OWN_CONTENT: "You can't report your own publication.",
  CANNOT_FOLLOW_SELF: "You can't follow yourself.",
};
const errorText = (e: string): string => ERRORS[e] ?? e;

export function WorkshopApp({ host }: { host: WorkshopHost }): ReactNode {
  const [defs, setDefs] = useState<WorkshopDefinitionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("catalog");
  const [openID, setOpenID] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void host.client.workshop.getDefinitions().then((r) => {
      if (!alive) return;
      if (r.ok) setDefs(r.data);
      else setError(errorText(r.error));
    });
    return () => {
      alive = false;
    };
  }, [host]);

  if (!defs) return <Frame>{error ?? "Loading the Workshop…"}</Frame>;
  if (!defs.Definitions?.Enabled || !defs.GatePassed)
    return <Frame>The Workshop is not available in this game right now.</Frame>;

  return (
    <Frame>
      <div style={tabsRow}>
        {TABS.map(([id, label]) => (
          <button
            key={id}
            style={id === tab ? tabActive : tabBtn}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "catalog" && (
        <Catalog host={host} defs={defs} onOpen={setOpenID} />
      )}
      {tab === "publish" && (
        <PublishWizard
          host={host}
          defs={defs}
          onDone={(id) => {
            setTab("mine");
            setOpenID(id);
          }}
        />
      )}
      {tab === "mine" && <MyList host={host} kind="mine" onOpen={setOpenID} />}
      {tab === "licenses" && (
        <MyList host={host} kind="licenses" onOpen={setOpenID} />
      )}
      {tab === "favorites" && (
        <MyList host={host} kind="favorites" onOpen={setOpenID} />
      )}
      {openID && (
        <ContentDetails
          host={host}
          contentID={openID}
          onClose={() => setOpenID(null)}
        />
      )}
    </Frame>
  );
}

// ────────────────────────────── Catalog ──────────────────────────────

function Catalog({
  host,
  defs,
  onOpen,
}: {
  host: WorkshopHost;
  defs: WorkshopDefinitionsResponse;
  onOpen(id: string): void;
}): ReactNode {
  const handlers = useContentTypes(host.content);
  const [query, setQuery] = useState<WorkshopBrowseQuery>({ sort: "New" });
  const [collection, setCollection] = useState<string | null>(null);
  const [items, setItems] = useState<WorkshopContentView[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (more: boolean) => {
      setBusy(true);
      setError(null);
      if (collection) {
        const r = await host.client.workshop.getCollection(collection);
        if (r.ok) {
          setItems(r.data.Items ?? []);
          setCursor(null);
        } else setError(errorText(r.error));
      } else {
        const r = await host.client.workshop.browse({
          ...query,
          pageSize: 24,
          continuationToken: more ? (cursor ?? undefined) : undefined,
        });
        if (r.ok) {
          setItems((prev) =>
            more ? [...prev, ...(r.data.Items ?? [])] : (r.data.Items ?? []),
          );
          setCursor(r.data.ContinuationToken ?? null);
        } else setError(errorText(r.error));
      }
      setBusy(false);
    },
    [host, query, collection, cursor],
  );

  // Reload from the first page whenever the filter changes (not when the cursor does).
  useEffect(() => {
    void load(false);
  }, [query, collection]);

  const types = Object.entries(defs.Definitions?.ContentTypes ?? {}).filter(
    ([, t]) => t.Enabled !== false,
  );

  return (
    <div>
      {(defs.Collections?.length ?? 0) > 0 && (
        <div style={chipsRow}>
          <button
            style={collection === null ? chipActive : chip}
            onClick={() => setCollection(null)}
          >
            All
          </button>
          {defs.Collections?.map((c) => (
            <button
              key={c.CollectionID ?? ""}
              style={collection === c.CollectionID ? chipActive : chip}
              onClick={() => setCollection(c.CollectionID ?? null)}
            >
              ★ {c.Name ?? c.CollectionID}
            </button>
          ))}
        </div>
      )}
      {!collection && (
        <div style={filtersRow}>
          <select
            style={input}
            value={query.contentType ?? ""}
            onChange={(e) =>
              setQuery({ ...query, contentType: e.target.value || undefined })
            }
          >
            <option value="">All types</option>
            {types.map(([id, t]) => (
              <option key={id} value={id}>
                {handlers.find((h) => h.type === id)?.label ??
                  t.DisplayName ??
                  id}
              </option>
            ))}
          </select>
          <select
            style={input}
            value={query.sort ?? "New"}
            onChange={(e) =>
              setQuery({
                ...query,
                sort: e.target.value as WorkshopBrowseQuery["sort"],
              })
            }
          >
            <option value="New">Newest</option>
            <option value="Popular">Most acquired</option>
            <option value="MostLiked">Most liked</option>
          </select>
          <input
            style={input}
            placeholder="Tag"
            defaultValue={query.tag ?? ""}
            onKeyDown={(e) => {
              if (e.key === "Enter")
                setQuery({
                  ...query,
                  tag: (e.target as HTMLInputElement).value.trim() || undefined,
                });
            }}
          />
          <label style={checkLabel}>
            <input
              type="checkbox"
              checked={query.fromFollowing === true}
              onChange={(e) =>
                setQuery({
                  ...query,
                  fromFollowing: e.target.checked || undefined,
                })
              }
            />
            From authors I follow
          </label>
        </div>
      )}
      {error && <div style={errorBox}>{error}</div>}
      {items.length === 0 && !busy && (
        <div style={muted}>Nothing here yet.</div>
      )}
      <div style={grid}>
        {items.map((item) => (
          <ContentCard
            key={item.ContentID ?? ""}
            item={item}
            handlers={handlers}
            onClick={() => item.ContentID && onOpen(item.ContentID)}
          />
        ))}
      </div>
      {cursor && (
        <button
          style={secondaryBtn}
          disabled={busy}
          onClick={() => void load(true)}
        >
          {busy ? "Loading…" : "Show more"}
        </button>
      )}
    </div>
  );
}

function ContentCard({
  item,
  handlers,
  onClick,
}: {
  item: WorkshopContentView;
  handlers: ContentTypeHandler[];
  onClick(): void;
}): ReactNode {
  const handler = handlers.find((h) => h.type === item.ContentType);
  return (
    <button style={card} onClick={onClick}>
      <div style={thumbBox}>
        {item.ThumbnailUrl ? (
          <img src={item.ThumbnailUrl} alt="" style={thumbImg} />
        ) : (
          <span style={{ fontSize: 34 }}>{handler?.icon ?? "📦"}</span>
        )}
      </div>
      <div style={cardTitle}>
        {item.Title ||
          (item.Status === "Uploading" ? "Unfinished upload" : "Untitled")}
      </div>
      <div style={cardMeta}>
        {item.IsOfficial
          ? "Official"
          : (item.CreatorPublicData?.Username ?? "Player")}{" "}
        · ♥ {item.Stats?.Likes ?? 0}
      </div>
      <div style={badgesRow}>
        {item.IsMine ? (
          <span style={badgeOwned}>Yours</span>
        ) : item.Owned ? (
          <span style={badgeOwned}>In library</span>
        ) : (
          (item.Access ?? []).map((o) => (
            <span key={o.OptionID ?? ""} style={badge}>
              {accessLabel(o)}
            </span>
          ))
        )}
        {item.Status && item.Status !== "Published" && (
          <span style={badgeWarn}>{item.Status}</span>
        )}
      </div>
    </button>
  );
}

// ────────────────────────────── Details ──────────────────────────────

const REPORT_REASONS: SocialReportReason[] = [
  "Inappropriate",
  "Spam",
  "Stolen",
  "Broken",
  "Harassment",
  "Other",
];

function ContentDetails({
  host,
  contentID,
  onClose,
}: {
  host: WorkshopHost;
  contentID: string;
  onClose(): void;
}): ReactNode {
  const [data, setData] = useState<WorkshopContentResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [reportReason, setReportReason] =
    useState<SocialReportReason>("Inappropriate");

  const reload = useCallback(async () => {
    const r = await host.client.workshop.getContent(contentID);
    if (!r.ok) {
      setMessage(errorText(r.error));
      return;
    }
    setData(r.data);
    // Following the author is a social-layer edge on the PLAYER, not part of the card.
    const creator = r.data.Content?.CreatorUserID;
    if (creator && !r.data.Content?.IsMine) {
      const s = await host.client.social.getEntityStates("User", [creator]);
      if (s.ok) setFollowing(s.data.Items?.[0]?.Following === true);
    }
  }, [host, contentID]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const view = data?.Content;
  const handler = view?.ContentType
    ? host.content.getType(view.ContentType)
    : undefined;

  const run = async (
    label: string,
    work: () => Promise<string | null>,
  ): Promise<void> => {
    setBusy(label);
    setMessage(null);
    try {
      setMessage(await work());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const open = (): Promise<void> =>
    run("open", async () => {
      if (!view?.ContentID) return null;
      if (!handler?.open)
        return "This game can't open this type of content here.";
      const r = await host.client.workshop.downloadFiles(view.ContentID);
      if (!r.ok) return errorText(r.error);
      await handler.open({
        contentID: view.ContentID,
        title: view.Title,
        revision: view.Revision,
        files: r.data.files,
      });
      if (handler.modeId) host.navigate(handler.modeId);
      return null;
    });

  const acquire = (option: WorkshopAccessOption): Promise<void> =>
    run(`get:${option.OptionID}`, async () => {
      const r = await host.client.workshop.acquire(contentID, option);
      if (!r.ok) return errorText(r.error);
      await reload();
      return r.data.AlreadyOwned
        ? "Already in your library."
        : "Added to your library.";
    });

  if (!view) return <Modal onClose={onClose}>{message ?? "Loading…"}</Modal>;

  const states = new Map(
    (data?.AccessState ?? []).map((s) => [
      s.OptionID ?? "",
      s.Available !== false,
    ]),
  );
  const canOpen = Boolean(data?.CanDownload);

  return (
    <Modal onClose={onClose}>
      <div style={detailsHead}>
        <div style={detailsThumb}>
          {view.ThumbnailUrl ? (
            <img src={view.ThumbnailUrl} alt="" style={thumbImg} />
          ) : (
            <span style={{ fontSize: 48 }}>{handler?.icon ?? "📦"}</span>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: "0 0 6px" }}>{view.Title}</h2>
          <div style={muted}>
            {view.IsOfficial
              ? "Official content"
              : `by ${view.CreatorPublicData?.Username ?? "a player"}`}{" "}
            · {handler?.label ?? view.ContentType} · rev. {view.Revision}
          </div>
          <div style={muted}>
            ♥ {view.Stats?.Likes ?? 0} · ★ {view.Stats?.Favorites ?? 0} · ⬇{" "}
            {view.Stats?.Acquisitions ?? 0}
            {view.TotalBytes ? ` · ${formatBytes(view.TotalBytes)}` : ""}
          </div>
          {(view.Tags?.length ?? 0) > 0 && (
            <div style={badgesRow}>
              {view.Tags?.map((t) => (
                <span key={t} style={badge}>
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {view.Description && (
        <p style={{ whiteSpace: "pre-wrap" }}>{view.Description}</p>
      )}
      {view.IsMine && view.ModerationNote && (
        <div style={errorBox}>Moderation: {view.ModerationNote}</div>
      )}
      {view.IsMine && (view.Access?.length ?? 0) > 0 && (
        <div style={muted}>
          Others get it: {(view.Access ?? []).map(accessLabel).join(" · ")}
        </div>
      )}

      <div style={actionsCol}>
        {canOpen ? (
          <button
            style={primaryBtn}
            disabled={busy !== null || !handler?.open}
            onClick={() => void open()}
          >
            {busy === "open"
              ? "Opening…"
              : handler?.open
                ? "Open"
                : "Owned (open it in the game)"}
          </button>
        ) : (
          (view.Access ?? []).map((o) => {
            const available = states.get(o.OptionID ?? "") ?? true;
            return (
              <button
                key={o.OptionID ?? ""}
                style={available ? primaryBtn : disabledBtn}
                disabled={!available || busy !== null}
                title={
                  available
                    ? undefined
                    : "You don't meet this option's requirements"
                }
                onClick={() => void acquire(o)}
              >
                {busy === `get:${o.OptionID}` ? "…" : `Get — ${accessLabel(o)}`}
              </button>
            );
          })
        )}
      </div>

      <div style={filtersRow}>
        {!view.IsMine && (
          <button
            style={secondaryBtn}
            disabled={busy !== null}
            onClick={() =>
              void run("like", async () => {
                const r = view.Liked
                  ? await host.client.social.unlike("WorkshopItem", contentID)
                  : await host.client.social.like("WorkshopItem", contentID);
                if (!r.ok) return errorText(r.error);
                await reload();
                return null;
              })
            }
          >
            {view.Liked ? "♥ Liked" : "♡ Like"}
          </button>
        )}
        <button
          style={secondaryBtn}
          disabled={busy !== null}
          onClick={() =>
            void run("fav", async () => {
              const r = view.Favorited
                ? await host.client.social.unfavorite("WorkshopItem", contentID)
                : await host.client.social.favorite("WorkshopItem", contentID);
              if (!r.ok) return errorText(r.error);
              await reload();
              return null;
            })
          }
        >
          {view.Favorited ? "★ In favorites" : "☆ Favorite"}
        </button>
        {!view.IsMine && view.CreatorUserID && (
          <button
            style={secondaryBtn}
            disabled={busy !== null}
            onClick={() =>
              void run("follow", async () => {
                const creator = view.CreatorUserID ?? "";
                const r = following
                  ? await host.client.social.unfollow("User", creator)
                  : await host.client.social.follow("User", creator);
                if (!r.ok) return errorText(r.error);
                setFollowing(r.data.Following === true);
                return r.data.Following ? "You follow this author." : null;
              })
            }
          >
            {following ? "Following ✓" : "Follow author"}
          </button>
        )}
        {view.IsMine && view.Status !== "Removed" && (
          <button
            style={dangerBtn}
            disabled={busy !== null}
            onClick={() => {
              if (
                !confirm(
                  "Unpublish for good? Players who already have it keep it.",
                )
              )
                return;
              void run("unpublish", async () => {
                const r = await host.client.workshop.unpublish(contentID);
                if (!r.ok) return errorText(r.error);
                await reload();
                return "Unpublished.";
              });
            }}
          >
            Unpublish
          </button>
        )}
      </div>

      {!view.IsMine && (
        <div style={filtersRow}>
          <select
            style={input}
            value={reportReason}
            onChange={(e) =>
              setReportReason(e.target.value as SocialReportReason)
            }
          >
            {REPORT_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            style={secondaryBtn}
            disabled={busy !== null}
            onClick={() =>
              void run("report", async () => {
                const r = await host.client.social.report(
                  "WorkshopItem",
                  contentID,
                  reportReason,
                );
                if (!r.ok) return errorText(r.error);
                return r.data.AlreadyReported
                  ? "You already reported this."
                  : "Thanks — the publisher will review it.";
              })
            }
          >
            Report
          </button>
        </div>
      )}

      {message && <div style={noticeBox}>{message}</div>}
    </Modal>
  );
}

// ────────────────────────────── Publish ──────────────────────────────

interface AccessDraft {
  mode: "Free" | "Price" | "Holding";
  resource: string; // "vc:GOLD" | "item:<catalog>/<item>"
  amount: number;
  holdMode: "WhileHeld" | "UnlockOnce";
}

function PublishWizard({
  host,
  defs,
  onDone,
}: {
  host: WorkshopHost;
  defs: WorkshopDefinitionsResponse;
  onDone(contentID: string): void;
}): ReactNode {
  const handlers = useContentTypes(host.content).filter(
    (h) => h.listLocal && h.capture && defs.CanPublish?.[h.type] === true,
  );
  const [type, setType] = useState<string | null>(null);
  const [locals, setLocals] = useState<Array<{
    id: string;
    name: string;
    subtitle?: string;
  }> | null>(null);
  const [localId, setLocalId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState<WorkshopVisibility>("Public");
  const [access, setAccess] = useState<AccessDraft[]>([
    { mode: "Free", resource: "", amount: 1, holdMode: "UnlockOnce" },
  ]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handler = handlers.find((h) => h.type === type);
  const typeDef = type ? defs.Definitions?.ContentTypes?.[type] : undefined;
  const allowedModes = typeDef?.AllowedAccessModes?.length
    ? typeDef.AllowedAccessModes
    : ["Free", "Price", "Holding"];
  const resources = useResourceOptions(host.client);
  // Плата за публикацию берётся только ресурсами: вариант с оплатой в сторе сервер отвергнет.
  const fee = Object.entries(typeDef?.PublishFeeOptions ?? {}).find(
    ([, option]) =>
      !(option?.Cost?.Standard?.Entries ?? []).some(
        (e) => e?.Type === "Purchase",
      ),
  );

  useEffect(() => {
    setLocals(null);
    setLocalId(null);
    if (!handler?.listLocal) return;
    void handler
      .listLocal()
      .then(setLocals, (e: unknown) =>
        setMessage(e instanceof Error ? e.message : String(e)),
      );
  }, [handler]);

  if (handlers.length === 0)
    return (
      <div style={muted}>
        Nothing to publish from here: the games in this project either do not
        register their content, or you can't publish it yet.
      </div>
    );

  const publish = async (): Promise<void> => {
    if (!handler?.capture || !type || !localId) return;
    // Опция без ресурса молча выпала бы из списка, и публикация ушла бы не с теми способами получить.
    if (access.some((a) => a.mode !== "Free" && !a.resource)) {
      setMessage("Pick a resource for every paid or hold-to-unlock option.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const captured = await handler.capture(localId);
      const r = await host.client.workshop.publish({
        contentType: type,
        files: captured.files,
        thumbnail: captured.thumbnail,
        title: title.trim() || captured.suggestedTitle || "Untitled",
        description: description.trim() || captured.suggestedDescription,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .concat(captured.tags ?? []),
        metadata: captured.metadata,
        visibility,
        access: access
          .map(toAccessInput)
          .filter((a): a is WorkshopAccessOptionInput => a !== null),
        selectedFeeOptionID: fee?.[0],
      });
      if (!r.ok) setMessage(errorText(r.error));
      else if (r.data.Content?.ContentID) onDone(r.data.Content.ContentID);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={formCol}>
      <label style={fieldLabel}>What</label>
      <div style={chipsRow}>
        {handlers.map((h) => (
          <button
            key={h.type}
            style={type === h.type ? chipActive : chip}
            onClick={() => setType(h.type)}
          >
            {h.icon} {h.label}
          </button>
        ))}
      </div>

      {handler && (
        <>
          <label style={fieldLabel}>Which one</label>
          {!locals ? (
            <div style={muted}>Loading…</div>
          ) : locals.length === 0 ? (
            <div style={muted}>You have nothing of this type yet.</div>
          ) : (
            <div style={formCol}>
              {locals.map((l) => (
                <label key={l.id} style={checkLabel}>
                  <input
                    type="radio"
                    name="wsLocal"
                    checked={localId === l.id}
                    onChange={() => {
                      setLocalId(l.id);
                      if (!title) setTitle(l.name);
                    }}
                  />
                  {l.name}{" "}
                  {l.subtitle && <span style={muted}>· {l.subtitle}</span>}
                </label>
              ))}
            </div>
          )}
        </>
      )}

      {localId && (
        <>
          <label style={fieldLabel}>Title</label>
          <input
            style={input}
            value={title}
            maxLength={defs.Definitions?.Limits?.MaxTitleLength ?? 60}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label style={fieldLabel}>Description</label>
          <textarea
            style={{ ...input, minHeight: 70 }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <label style={fieldLabel}>
            Tags (comma separated
            {typeDef?.TagVocabulary?.length
              ? `: ${typeDef.TagVocabulary.join(", ")}`
              : ""}
            )
          </label>
          <input
            style={input}
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
          <label style={fieldLabel}>Who can see it</label>
          <select
            style={input}
            value={visibility}
            onChange={(e) =>
              setVisibility(e.target.value as WorkshopVisibility)
            }
          >
            <option value="Public">Everyone (in the catalog)</option>
            <option value="Unlisted">Anyone with the link</option>
            <option value="Friends">Only my friends</option>
          </select>

          <label style={fieldLabel}>How others get it — any option works</label>
          {access.map((a, i) => (
            <div key={i} style={filtersRow}>
              <select
                style={input}
                value={a.mode}
                onChange={(e) =>
                  setAccess(
                    patch(access, i, {
                      mode: e.target.value as AccessDraft["mode"],
                    }),
                  )
                }
              >
                {allowedModes.map((m) => (
                  <option key={m} value={m}>
                    {m === "Free"
                      ? "Free"
                      : m === "Price"
                        ? "For resources"
                        : "Hold to unlock"}
                  </option>
                ))}
              </select>
              {a.mode !== "Free" && (
                <>
                  <select
                    style={input}
                    value={a.resource}
                    onChange={(e) =>
                      setAccess(patch(access, i, { resource: e.target.value }))
                    }
                  >
                    <option value="">— resource —</option>
                    {resources
                      .filter(
                        (r) => a.mode === "Holding" || r.startsWith("vc:"),
                      )
                      .map((r) => (
                        <option key={r} value={r}>
                          {r.replace(/^vc:/, "").replace(/^item:/, "item ")}
                        </option>
                      ))}
                  </select>
                  <input
                    style={{ ...input, width: 90 }}
                    type="number"
                    min={1}
                    value={a.amount}
                    onChange={(e) =>
                      setAccess(
                        patch(access, i, {
                          amount: Math.max(1, Number(e.target.value) || 1),
                        }),
                      )
                    }
                  />
                </>
              )}
              {a.mode === "Holding" && (
                <select
                  style={input}
                  value={a.holdMode}
                  onChange={(e) =>
                    setAccess(
                      patch(access, i, {
                        holdMode: e.target.value as AccessDraft["holdMode"],
                      }),
                    )
                  }
                >
                  <option value="UnlockOnce">Checked once, then forever</option>
                  <option value="WhileHeld">Only while they hold it</option>
                </select>
              )}
              {access.length > 1 && (
                <button
                  style={secondaryBtn}
                  onClick={() => setAccess(access.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            style={secondaryBtn}
            onClick={() =>
              setAccess([
                ...access,
                {
                  mode: allowedModes.includes("Price") ? "Price" : "Free",
                  resource: "",
                  amount: 10,
                  holdMode: "UnlockOnce",
                },
              ])
            }
          >
            + Add an option
          </button>

          {fee && (
            <div style={muted}>
              Publishing costs {bundleLabel(fee[1].Cost?.Standard)} (charged
              once).
            </div>
          )}
          <button
            style={primaryBtn}
            disabled={busy}
            onClick={() => void publish()}
          >
            {busy ? "Publishing…" : "Publish"}
          </button>
        </>
      )}
      {message && <div style={errorBox}>{message}</div>}
    </div>
  );
}

function patch<T>(list: T[], index: number, change: Partial<T>): T[] {
  return list.map((item, i) => (i === index ? { ...item, ...change } : item));
}

function toAccessInput(a: AccessDraft): WorkshopAccessOptionInput | null {
  if (a.mode === "Free") return { Mode: "Free" };
  if (!a.resource) return null;
  const [kind, id = ""] = a.resource.split(":", 2);
  if (a.mode === "Price") {
    return {
      Mode: "Price",
      Price: {
        Entries: [
          { Type: "VirtualCurrency", CurrencyID: id, Amount: a.amount },
        ],
      },
    };
  }
  const [catalogID, itemID] = id.split("/", 2);
  return {
    Mode: "Holding",
    Holding: {
      Mode: a.holdMode,
      Match: "All",
      Requirements: [
        kind === "vc"
          ? { Type: "VirtualCurrency", CurrencyID: id, Amount: a.amount }
          : {
              Type: "Item",
              CatalogID: catalogID,
              ItemID: itemID ?? "",
              Amount: a.amount,
            },
      ],
    },
  };
}

// ────────────────────────────── Lists ──────────────────────────────

function MyList({
  host,
  kind,
  onOpen,
}: {
  host: WorkshopHost;
  kind: "mine" | "licenses" | "favorites";
  onOpen(id: string): void;
}): ReactNode {
  const handlers = useContentTypes(host.content);
  const [items, setItems] = useState<WorkshopContentView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async (): Promise<void> => {
      const w = host.client.workshop;
      if (kind === "licenses") {
        const r = await w.getMyLicenses();
        if (!alive) return;
        if (r.ok)
          setItems(
            (r.data.Licenses ?? [])
              .map((l) => l.Content)
              .filter((c): c is WorkshopContentView => Boolean(c)),
          );
        else setError(errorText(r.error));
        return;
      }
      const r =
        kind === "mine" ? await w.getMyContent() : await w.getMyFavorites();
      if (!alive) return;
      if (r.ok) setItems(r.data.Items ?? []);
      else setError(errorText(r.error));
    };
    void load();
    return () => {
      alive = false;
    };
  }, [host, kind]);

  if (error) return <div style={errorBox}>{error}</div>;
  if (!items) return <div style={muted}>Loading…</div>;
  if (items.length === 0) return <div style={muted}>Empty.</div>;
  return (
    <div style={grid}>
      {items.map((item) => (
        <ContentCard
          key={item.ContentID ?? ""}
          item={item}
          handlers={handlers}
          onClick={() => item.ContentID && onOpen(item.ContentID)}
        />
      ))}
    </div>
  );
}

// ────────────────────────────── helpers ──────────────────────────────

/**
 * Registered content types, re-read on every registry change. ⚠ Not keyed by the NUMBER of types: a game
 * re-installed after re-login registers the same type again with a new handler, the count stays the
 * same, and a count-based snapshot kept the handler of the destroyed game.
 */
function useContentTypes(content: ContentRegistry): ContentTypeHandler[] {
  const [types, setTypes] = useState(() => content.listTypes());
  useEffect(() => {
    setTypes(content.listTypes());
    return content.subscribe(() => setTypes(content.listTypes()));
  }, [content]);
  return types;
}

/** "vc:GOLD" and "item:<catalog>/<item>" for every currency and item the title defines. */
function useResourceOptions(client: IDosGamesClient): string[] {
  const [list] = useState(() => {
    const out: string[] = [];
    for (const id of Object.keys(
      client.data.config.currencyDefinitions?.VirtualCurrencies ?? {},
    ))
      out.push(`vc:${id}`);
    for (const [catalogID, catalog] of Object.entries(
      client.data.config.itemDefinitions?.Catalogs ?? {},
    ))
      for (const itemID of Object.keys(catalog?.Items ?? {}))
        out.push(`item:${catalogID}/${itemID}`);
    return out;
  });
  return list;
}

type BundleLike =
  | {
      Entries?: Array<{
        CurrencyID?: string | null;
        ItemID?: string | null;
        Amount?: number | null;
      } | null> | null;
    }
  | null
  | undefined;

function bundleLabel(bundle: BundleLike): string {
  const parts = (bundle?.Entries ?? [])
    .filter((e): e is NonNullable<typeof e> => Boolean(e))
    .map((e) => `${e.Amount ?? 0} ${e.CurrencyID ?? e.ItemID ?? ""}`.trim());
  return parts.length ? parts.join(" + ") : "free";
}

function accessLabel(o: WorkshopAccessOption): string {
  if (o.Mode === "Free") return "Free";
  if (o.Mode === "Price") return bundleLabel(o.Price);
  const reqs = (o.Holding?.Requirements ?? []).map(
    (r) =>
      `${r.Amount ?? 0} ${r.CurrencyID ?? r.ItemID ?? ""}${r.MinLevel ? ` (lvl ${r.MinLevel}+)` : ""}`,
  );
  const joined = reqs.join(o.Holding?.Match === "Any" ? " or " : " + ");
  return `🔑 hold ${joined}${o.Holding?.Mode === "WhileHeld" ? " (while held)" : ""}`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function Frame({ children }: { children: ReactNode }): ReactNode {
  return <div style={frame}>{children}</div>;
}

function Modal({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose(): void;
}): ReactNode {
  return (
    <div style={backdrop} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <button style={closeBtn} onClick={onClose} aria-label="Close">
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

// ────────────────────────────── styles ──────────────────────────────
// Every colour is a theme token of the UI kit (the project's src/ui.config.ts), like every other
// system — the workshop must not be a dark island in a light app. Change the theme, not these.

const frame: CSSProperties = {
  // A tab of the lobby: the lobby scrolls it and gives it the width.
  minHeight: 360,
  borderRadius: 16,
  padding: "16px 20px 40px",
  ...panel,
  color: v.text,
  fontFamily: v.font,
  pointerEvents: "auto",
};
const tabsRow: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  marginBottom: 14,
};
const tabBtn: CSSProperties = {
  background: "transparent",
  color: v.textDim,
  border: `1px solid ${v.line}`,
  borderRadius: 8,
  padding: "6px 12px",
  cursor: "pointer",
};
const tabActive: CSSProperties = {
  ...tabBtn,
  background: `linear-gradient(180deg, ${v.blue}, ${v.blueDeep})`,
  color: v.onBlue,
  border: "1px solid transparent",
};
const chipsRow: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  margin: "8px 0",
};
const chip: CSSProperties = {
  ...tabBtn,
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 13,
};
const chipActive: CSSProperties = {
  ...chip,
  background: `color-mix(in srgb, ${v.blue} 30%, transparent)`,
  color: v.text,
};
const filtersRow: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
  margin: "8px 0",
};
const input: CSSProperties = {
  background: v.well,
  color: v.text,
  border: `1px solid ${v.line}`,
  boxShadow: v.wellShadow,
  borderRadius: 6,
  padding: "6px 8px",
  font: "inherit",
};
const checkLabel: CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "center",
  fontSize: 14,
};
const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
  gap: 12,
};
const card: CSSProperties = {
  textAlign: "left",
  background: v.panelDeep,
  border: `1px solid ${v.panelEdge}`,
  borderRadius: 10,
  padding: 8,
  color: "inherit",
  cursor: "pointer",
  font: "inherit",
};
const thumbBox: CSSProperties = {
  aspectRatio: "1 / 1",
  borderRadius: 8,
  background: v.wellSoft,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};
const thumbImg: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  imageRendering: "pixelated",
};
const cardTitle: CSSProperties = {
  fontWeight: 600,
  margin: "6px 0 2px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const cardMeta: CSSProperties = { fontSize: 12, color: v.textDim };
const badgesRow: CSSProperties = {
  display: "flex",
  gap: 4,
  flexWrap: "wrap",
  marginTop: 6,
};
const badge: CSSProperties = {
  fontSize: 11,
  background: v.wellSoft,
  color: v.text,
  borderRadius: 4,
  padding: "2px 6px",
};
const badgeOwned: CSSProperties = {
  ...badge,
  background: `color-mix(in srgb, ${v.green} 35%, transparent)`,
};
const badgeWarn: CSSProperties = {
  ...badge,
  background: `color-mix(in srgb, ${v.gold} 35%, transparent)`,
};
const muted: CSSProperties = { color: v.textDim, fontSize: 13 };
const errorBox: CSSProperties = {
  background: `color-mix(in srgb, ${v.red} 18%, transparent)`,
  border: `1px solid color-mix(in srgb, ${v.red} 45%, transparent)`,
  color: v.text,
  borderRadius: 6,
  padding: "8px 10px",
  margin: "8px 0",
};
const noticeBox: CSSProperties = {
  background: `color-mix(in srgb, ${v.blue} 16%, transparent)`,
  borderRadius: 6,
  padding: "8px 10px",
  marginTop: 10,
};
const primaryBtn: CSSProperties = {
  ...buttonStyle("blue", false, "sm"),
  font: "inherit",
  fontWeight: 800,
};
const disabledBtn: CSSProperties = {
  ...buttonStyle("blue", true, "sm"),
  font: "inherit",
  fontWeight: 800,
  cursor: "not-allowed",
};
const secondaryBtn: CSSProperties = { ...tabBtn, color: v.text };
const dangerBtn: CSSProperties = {
  ...tabBtn,
  color: v.red,
  border: `1px solid color-mix(in srgb, ${v.red} 50%, transparent)`,
};
const actionsCol: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  margin: "12px 0",
};
const formCol: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  maxWidth: 640,
};
const fieldLabel: CSSProperties = {
  fontSize: 13,
  color: v.textDim,
  marginTop: 8,
};
const backdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: v.backdrop,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
};
const modal: CSSProperties = {
  position: "relative",
  ...panel,
  color: v.text,
  padding: 20,
  width: "min(640px, 94vw)",
  maxHeight: "90vh",
  overflow: "auto",
};
const closeBtn: CSSProperties = {
  position: "absolute",
  top: 10,
  right: 10,
  background: "transparent",
  color: v.textDim,
  border: 0,
  fontSize: 18,
  cursor: "pointer",
};
const detailsHead: CSSProperties = {
  display: "flex",
  gap: 14,
  alignItems: "flex-start",
  marginRight: 24,
};
const detailsThumb: CSSProperties = {
  ...thumbBox,
  width: 120,
  flex: "0 0 120px",
};
