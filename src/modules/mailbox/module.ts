import { defineModule, type Module } from "@idosgames/module-sdk";
import { configSection } from "@idosgames/react/ui";
import { makeMailboxScreen, makeMailboxWatcher } from "./MailboxScreen";
import { mailboxEnabled } from "./model";
import { t } from "./i18n";

// The mailbox as a feature of the game: letters with rewards, broadcasts, friends' gifts and
// transfers, missed rewards of other systems. The always-on watcher keeps the badge — one cheap
// counter read on start and whenever the player comes back to the tab; every mailbox action brings
// fresh counters itself (mailbox:countersChanged). Hidden until the title turns the mailbox on.
export const mailboxModule: Module = defineModule({
  id: "mailbox",
  meta: { name: "Mailbox", type: "app", engine: "dom" },
  setup(ctx) {
    const enabled = mailboxEnabled(
      configSection<{ Enabled?: boolean | null }>(ctx.client, "Mailbox"),
    );
    ctx.features.register({
      id: "mailbox",
      label: t("title"),
      icon: "gift",
      group: "social",
      order: 85,
      available: false,
      Screen: makeMailboxScreen(ctx.features),
    });
    ctx.features.setAvailable(
      "mailbox",
      enabled,
      "the mailbox is off on the title (Mailbox.Enabled)",
    );
    if (enabled)
      ctx.registerPanel({
        id: "badge",
        slot: "modal",
        activeOnly: false,
        component: makeMailboxWatcher(ctx.features),
      });
    ctx.exposeToAgent({
      state: () => ({ ui: "dom", feature: "mailbox" }),
      describeActions: {},
    });
  },
});
