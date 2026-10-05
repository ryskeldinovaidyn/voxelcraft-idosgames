// Знамя: помнит основной цвет и слои узора (systems/Banner). Слои приходят из tag стака при
// установке (событие blockPlace несёт tag — player/Interaction) и уходят обратно в выпадающий
// предмет, поэтому узоры переживают «поставил — сломал».
import {
  decodeLayers,
  encodeLayers,
  type BannerLayer,
} from "../../systems/Banner";
import type { ItemStack } from "../../types";
import { BLOCKS } from "../../registry/Blocks";
import { registerBlockEntity } from "../BlockEntities";

export type BannerState = { base: string; layers: BannerLayer[] };

registerBlockEntity("banner", {
  create: (): BannerState => ({ base: "white", layers: [] }),
  keep: (st): ItemStack => {
    const { base, layers } = st as BannerState;
    return {
      item: `${base}_banner`,
      count: 1,
      ...(layers.length ? { tag: { banner: encodeLayers(layers) } } : {}),
    };
  },
  on: {
    blockPlace: (be, p) => {
      const st = be.state as BannerState;
      const name = BLOCKS[Number(p.id)]?.name ?? "";
      if (name.endsWith("_banner")) st.base = name.slice(0, -7);
      st.layers = decodeLayers(
        (p.tag as { banner?: unknown } | undefined)?.banner,
      );
    },
  },
});
