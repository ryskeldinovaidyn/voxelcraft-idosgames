// Профессия от рабочего блока, как в Minecraft: безработный житель занимает свободный рабочий блок
// рядом и становится мастером; сломали блок — профессия теряется, но только пока житель ни разу не
// торговал. Чистые функции: блоки приходят колбэком, занятые места — списком (entities/EntityManager).
import type { Profession } from "./Trading";

/** Рабочий блок → профессия. Горящие печи — те же места, что и погасшие. */
export const JOB_SITES: Record<string, Profession> = {
  composter: "farmer",
  lectern: "librarian",
  blast_furnace: "armorer",
  lit_blast_furnace: "armorer",
  smithing_table: "toolsmith",
  brewing_stand: "cleric",
  smoker: "butcher",
  lit_smoker: "butcher",
  cartography_table: "cartographer",
  barrel: "fisherman",
  stonecutter: "mason",
  grindstone: "weaponsmith",
  loom: "shepherd",
  fletching_table: "fletcher",
  cauldron: "leatherworker",
};

/** Профессия этого блока (undefined — не рабочий блок). */
export const jobAt = (block: string): Profession | undefined =>
  JOB_SITES[block];

/** Насколько далеко житель ищет работу: клеток по горизонтали и по вертикали. */
export const JOB_RANGE = 6;
export const JOB_RANGE_Y = 3;

export interface JobSite {
  site: [number, number, number];
  job: Profession;
}

/**
 * Ближайший свободный рабочий блок вокруг (x, y, z).
 * @param blockAt имя блока в клетке
 * @param taken занято ли место другим жителем
 */
export function findJob(
  blockAt: (x: number, y: number, z: number) => string,
  x: number,
  y: number,
  z: number,
  taken: (x: number, y: number, z: number) => boolean,
): JobSite | null {
  let best: JobSite | null = null;
  let bestD = Infinity;
  for (let dy = -JOB_RANGE_Y; dy <= JOB_RANGE_Y; dy++)
    for (let dz = -JOB_RANGE; dz <= JOB_RANGE; dz++)
      for (let dx = -JOB_RANGE; dx <= JOB_RANGE; dx++) {
        const job = jobAt(blockAt(x + dx, y + dy, z + dz));
        if (!job) continue;
        const d = dx * dx + dy * dy + dz * dz;
        if (d >= bestD || taken(x + dx, y + dy, z + dz)) continue;
        best = { site: [x + dx, y + dy, z + dz], job };
        bestD = d;
      }
  return best;
}
