// Археология, как в Minecraft 1.20: подозрительный песок (под пустынными колодцами) и гравий (в засыпанных
// руинах) — кисть расчищает их за 4 взмаха (стадия — в мете), и выпадает находка (WorldGenerator.lootAt;
// сломанный — пропадает вместе с находкой). Расписной горшок — из 4 черепков.
import type { BlockDef } from "../../types";
import { addNames } from "../names";
import { all, block } from "./define";

/** Сколько взмахов кистью до находки. */
export const BRUSH_STAGES = 4;
/** Подозрительный блок → каким становится после расчистки. */
export const SUSPICIOUS: Record<string, string> = {
  suspicious_sand: "sand",
  suspicious_gravel: "gravel",
};

const SUS = { hardness: 0.25, tool: "shovel" as const, drops: [] };

export const ARCHAEOLOGY_BLOCKS: BlockDef[] = [
  block({
    name: "suspicious_sand",
    ...SUS,
    tex: all("suspicious_sand"),
    mapColor: 0xd8c890,
  }),
  block({
    name: "suspicious_gravel",
    ...SUS,
    tex: all("suspicious_gravel"),
    mapColor: 0x8a8680,
  }),
  block({
    name: "decorated_pot",
    opaque: false,
    hardness: 0.5,
    tex: {
      top: "decorated_pot_top",
      side: "decorated_pot_side",
      bottom: "decorated_pot_top",
    },
    mapColor: 0x9a5a3a,
  }),
];

addNames({
  suspicious_sand: "Подозрительный песок",
  suspicious_gravel: "Подозрительный гравий",
  decorated_pot: "Расписной горшок",
  trail_ruins: "Руины",
});
