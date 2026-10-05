import { defineModule, type Module } from "@idosgames/module-sdk";
import { configSection } from "@idosgames/react/ui";
import { makeReferralScreen, makeReferralWatcher } from "./ReferralScreen";
import { hasTitleData } from "./model";
import { t } from "./i18n";

// Invite friends as a feature of the game. The watcher sets the badge (invite rewards ready) once
// on login and whenever the cached referral state changes — on a title with invites on.
export const inviteModule: Module = defineModule({
  id: "invite",
  meta: { name: "Invite", type: "app", engine: "dom" },
  setup(ctx) {
    // Always in the lobby (owner's decision 29.09.2026); with invites off the screen says so.
    const enabled = hasTitleData(
      configSection<{ IsEnabled?: boolean | null }>(ctx.client, "Referral"),
    );
    ctx.features.register({
      id: "invite",
      label: t("title"),
      icon: "link",
      group: "social",
      order: 90,
      Screen: makeReferralScreen(enabled),
    });
    // The badge reads the referral definitions — only where invites are on. On a title without them
    // that read was one more request in the startup burst, and the engine's per-player limit
    // answered it 429.
    if (enabled)
      ctx.registerPanel({
        id: "badge",
        slot: "modal",
        activeOnly: false,
        component: makeReferralWatcher(ctx.features),
      });
    ctx.exposeToAgent({
      state: () => ({ ui: "dom", feature: "invite" }),
      describeActions: {},
    });
  },
});
