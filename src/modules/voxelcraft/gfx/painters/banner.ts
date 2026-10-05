// Тайлы полотен знамён 16 цветов: ткань с перекладиной сверху (узоры рисует gfx/Banners поверх).
import { DYE_COLORS } from "../../registry/blocks/colors";
import { paintCloth } from "../BannerArt";
import { PAINTERS } from "../paint";

export const BANNER_TILES: string[] = [];

for (const c of DYE_COLORS) {
  const name = `${c.id}_banner`;
  PAINTERS[name] = (px) => paintCloth(px, c.hex);
  BANNER_TILES.push(name);
}
