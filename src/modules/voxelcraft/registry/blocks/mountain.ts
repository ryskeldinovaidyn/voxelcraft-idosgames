// Горы и вишнёвые рощи: снег-порох (не твёрдый — в нём вязнешь и мёрзнешь, в кожаных ботинках держит:
// Player, physics/Collision, systems/Freezing; набирается ведром) и розовые лепестки под вишнями.
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { all, block } from "./define";

export const MOUNTAIN_BLOCKS: BlockDef[] = [
  block({
    name: "powder_snow",
    solid: false,
    // не «непрозрачный»: иначе грани соседей к нему отсекаются и изнутри видно сквозь землю;
    // свет гасит, как и раньше
    opaque: false,
    filter: 15,
    hardness: 0.25,
    tool: "shovel",
    drops: [],
    tex: all("powder_snow"),
    mapColor: 0xf4f8fc,
  }),
  block({
    name: "pink_petals",
    shape: "carpet",
    solid: false,
    opaque: false,
    hardness: 0,
    flammable: true,
    tex: all("pink_petals"),
    mapColor: 0xf0a8c8,
  }),
];

addNames({
  powder_snow: "Снег-порох",
  pink_petals: "Розовые лепестки",
  cherry_grove: "Вишнёвая роща",
});
