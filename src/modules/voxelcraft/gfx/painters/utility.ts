// Тайлы утилит: вёдра (пустое, с водой, с лавой, с молоком), огниво, огонь.
import { P, PAINTERS, type Painter } from "../paint";

export const UTILITY_TILES: string[] = [];

const add = (name: string, p: Painter): void => {
  PAINTERS[name] = p;
  UTILITY_TILES.push(name);
};

const BUCKET = [
  "................",
  "................",
  "................",
  "...hhhhhhhhhh...",
  "...hccccccccl...",
  "...hmccccccml...",
  "....hmmmmmml....",
  "....hmmmmmml....",
  "....hmmmmmml....",
  ".....hmmmml.....",
  ".....hhhhhh.....",
  "................",
  "................",
  "................",
  "................",
  "................",
];
const bucket = (contents: string) =>
  P(BUCKET, { h: "#6a6a6a", l: "#e0e0e0", m: "#b8b8b8", c: contents });

add("bucket", bucket("#3a3a3a"));
add("water_bucket", bucket("#3057d8"));
add("lava_bucket", bucket("#e8661c"));
add("milk_bucket", bucket("#f4f4f4"));

add(
  "flint_and_steel",
  P(
    [
      "................",
      "................",
      "...sss..........",
      "..s...s.........",
      "..s...s.........",
      "...s.ss.........",
      "....ss..........",
      "........ff......",
      ".......ffff.....",
      "......ffffff....",
      ".......ffff.....",
      "........ff......",
      "................",
      "................",
      "................",
      "................",
    ],
    { s: "#b8b8b8", f: "#3a3a3a" },
  ),
);

add(
  "fire",
  P(
    [
      "................",
      "...y......y.....",
      "...yy....yy...y.",
      "..yoy...yoy...y.",
      "..yooy..yooy.yy.",
      ".yooooy.yooyyoy.",
      ".yooroo.yooooy..",
      "yoorrooyoorrooy.",
      "yoorrroooorrrooy",
      "yorrrrroorrrrroy",
      "yorrrrrrrrrrrroy",
      "oorrrrrrrrrrrroo",
      "orrrrrrrrrrrrrro",
      "rrrrrrrrrrrrrrrr",
      "rrrrrrrrrrrrrrrr",
      "rrrrrrrrrrrrrrrr",
    ],
    { y: "#ffe27a", o: "#f5a023", r: "#e05a14" },
  ),
);
