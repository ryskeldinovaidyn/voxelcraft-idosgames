import { makeT } from "@idosgames/react/ui";

// The Workshop's name in the lobby. The screen itself speaks English for now.

const EN = {
  title: "Workshop",
} as const;

export type StringKey = keyof typeof EN;

export const t = makeT<StringKey>(EN, {
  title: "Мастерская",
});
