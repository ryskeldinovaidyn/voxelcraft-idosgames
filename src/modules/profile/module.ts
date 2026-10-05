import { defineModule, type Module } from "@idosgames/module-sdk";
import { makeProfileScreen } from "./ProfileScreen";
import { t } from "./i18n";

// Profile and settings as a feature of the game. The lobby of the base opens it from its profile
// button (features.open("profile")).
export const profileModule: Module = defineModule({
  id: "profile",
  meta: { name: "Profile", type: "app", engine: "dom" },
  setup(ctx) {
    ctx.features.register({
      id: "profile",
      label: t("title"),
      icon: "user",
      group: "profile",
      order: 100,
      Screen: makeProfileScreen(ctx.features),
    });
    ctx.exposeToAgent({
      state: () => ({ ui: "dom", feature: "profile" }),
      describeActions: {},
    });
  },
});
