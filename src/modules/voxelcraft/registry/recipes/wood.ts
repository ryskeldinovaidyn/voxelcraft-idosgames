// Рецепты пород дерева (registry/blocks/wood.ts): бревно → 4 доски своей породы, из досок — ступени,
// плиты, забор, калитка, дверь, люк (как у дуба в recipes/building.ts).
import type { Recipe } from "../../types";
import { WOOD_SPECIES, woodForm } from "../blocks/wood";

export const WOOD_RECIPES: Recipe[] = WOOD_SPECIES.flatMap((s): Recipe[] => {
  const P = s.planks;
  const out: Recipe[] = [];
  // у дуба бревно → доски уже есть (recipes/basic)
  if (s.id !== "oak")
    out.push({ shapeless: [s.log], result: { item: P, count: 4 } });
  // лодка — у каждой породы своя (items/outdoor)
  out.push({
    pattern: [
      [P, null, P],
      [P, P, P],
    ],
    result: { item: `${s.id}_boat`, count: 1 },
  });
  if (s.has.forms) return out;
  const f = (form: string) => woodForm(s, form);
  out.push(
    { pattern: [[P, P, P]], result: { item: f("slab"), count: 6 } },
    {
      pattern: [
        [P, null, null],
        [P, P, null],
        [P, P, P],
      ],
      result: { item: f("stairs"), count: 4 },
    },
    {
      pattern: [
        [P, "stick", P],
        [P, "stick", P],
      ],
      result: { item: f("fence"), count: 3 },
    },
    {
      pattern: [
        ["stick", P, "stick"],
        ["stick", P, "stick"],
      ],
      result: { item: f("fence_gate"), count: 1 },
    },
    {
      pattern: [
        [P, P],
        [P, P],
        [P, P],
      ],
      result: { item: f("door"), count: 3 },
    },
    {
      pattern: [
        [P, P, P],
        [P, P, P],
      ],
      result: { item: f("trapdoor"), count: 2 },
    },
  );
  return out;
});
