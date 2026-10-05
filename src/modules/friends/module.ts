import { defineModule, type Module } from "@idosgames/module-sdk";
import { makeFriendsScreen, makeFriendsWatcher } from "./FriendsScreen";
import { t } from "./i18n";

// Friends as a feature of the game. The always-on watcher keeps the badge: requests waiting for an
// answer (a counter that comes with the player state) and unread notifications.
export const friendsModule: Module = defineModule({
  id: "friends",
  meta: { name: "Friends", type: "app", engine: "dom" },
  setup(ctx) {
    ctx.features.register({
      id: "friends",
      label: t("title"),
      icon: "friends",
      group: "social",
      order: 80,
      Screen: makeFriendsScreen(ctx.features),
    });
    ctx.registerPanel({
      id: "badge",
      slot: "modal",
      activeOnly: false,
      component: makeFriendsWatcher(ctx.features),
    });
    ctx.exposeToAgent({
      state: () => ({ ui: "dom", feature: "friends" }),
      describeActions: {},
    });
  },
});
