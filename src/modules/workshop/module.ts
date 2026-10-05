import { defineModule, type Module } from "@idosgames/module-sdk";
import { makeWorkshopScreen } from "./WorkshopApp";
import { t } from "./i18n";

// The Workshop system: a tab of the lobby (ctx.features) with the catalog of player & publisher
// content. It works for any game — what a content type IS (how to list, capture and open it) comes
// from the handlers games register in `ctx.content`; the Workshop never imports a game. With no game
// that registers a content type there is nothing to share, and the tab stays hidden.
export const workshopModule: Module = defineModule({
  id: "workshop",
  meta: {
    name: "Workshop",
    type: "app",
    engine: "dom",
  },
  setup(ctx) {
    ctx.features.register({
      id: "workshop",
      label: t("title"),
      icon: "globe",
      group: "social",
      order: 88,
      available: false,
      Screen: makeWorkshopScreen({
        client: ctx.client,
        content: ctx.content,
        navigate: (modeId) => ctx.navigate(modeId),
      }),
    });

    // Games register their content types in their own setup() — before or after this one — so the
    // tab follows the registry instead of looking once.
    const sync = (): void =>
      ctx.features.setAvailable(
        "workshop",
        ctx.content.listTypes().length > 0,
        "no installed game registers a content type (ctx.content.registerType)",
      );
    sync();
    ctx.content.subscribe(sync);

    ctx.exposeToAgent({
      state: () => ({
        contentTypes: ctx.content.listTypes().map((type) => ({
          type: type.type,
          canPublish: Boolean(type.listLocal && type.capture),
          canOpen: Boolean(type.open),
        })),
      }),
      describeActions: {},
    });
  },
});
