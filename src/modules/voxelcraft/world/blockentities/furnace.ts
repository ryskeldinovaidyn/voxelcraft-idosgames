// Печь: вход, топливо, выход, как в Minecraft. Предмет плавится 10 секунд, топливо горит своё время
// (ItemDef.fuel), горит печь только пока есть что плавить. Горящая печь — отдельный блок (свет 13),
// блочная сущность у обоих одна и та же.
import { B } from "../../registry/Blocks";
import { ITEMS } from "../../registry/Items";
import { smeltResult } from "../../registry/recipes/smelting";
import type { ItemStack } from "../../types";
import { registerBlockEntity } from "../BlockEntities";

/** Секунд на один предмет. */
export const COOK_TIME = 10;

export type FurnaceState = {
  input: ItemStack | null;
  fuel: ItemStack | null;
  output: ItemStack | null;
  /** Сколько ещё гореть текущему топливу, сек. */
  burn: number;
  /** Сколько горело это топливо с начала (для шкалы огня). */
  burnMax: number;
  /** Прогресс плавки текущего предмета, сек. */
  cook: number;
  /** Накопленный опыт — отдаётся, когда забирают выход. */
  xp: number;
};

export const newFurnace = (): FurnaceState => ({
  input: null,
  fuel: null,
  output: null,
  burn: 0,
  burnMax: 0,
  cook: 0,
  xp: 0,
});

/** Режим печи: обычная, коптильня (только еда), плавильная (только руды и сырой металл). */
export type FurnaceMode = "furnace" | "smoker" | "blast";

/** Берёт ли печь этого режима вход (коптильня — то, что жарится в еду; плавильная — руды и сырой металл). */
export function furnaceAccepts(mode: FurnaceMode, input: string): boolean {
  if (mode === "furnace") return true;
  const res = smeltResult(input);
  if (!res) return false;
  if (mode === "smoker") return (ITEMS[res.result]?.food ?? 0) > 0;
  return /_ore$|^raw_|^ancient_debris$/.test(input);
}

/**
 * Шаг печи на dt секунд — чистая функция состояния (её и проверяют тесты). Коптильня и плавильная печь
 * работают вдвое быстрее и вдвое быстрее жгут топливо, как в Minecraft.
 */
export function stepFurnace(
  s: FurnaceState,
  dt: number,
  mode: FurnaceMode = "furnace",
): void {
  if (mode !== "furnace") dt *= 2;
  const res =
    s.input && furnaceAccepts(mode, s.input.item)
      ? smeltResult(s.input.item)
      : null;
  const max = res ? (ITEMS[res.result]?.maxStack ?? 64) : 0;
  const canSmelt =
    !!res &&
    (!s.output ||
      (s.output.item === res.result && s.output.count + res.count <= max));

  if (s.burn > 0) s.burn = Math.max(0, s.burn - dt);
  if (s.burn <= 0 && canSmelt && s.fuel) {
    const f = ITEMS[s.fuel.item]?.fuel ?? 0;
    if (f > 0) {
      s.burn = s.burnMax = f;
      const rem = ITEMS[s.fuel.item]?.remainder ?? null;
      s.fuel.count -= 1;
      if (s.fuel.count <= 0) s.fuel = rem ? { item: rem, count: 1 } : null;
    }
  }

  if (s.burn > 0 && canSmelt && res) {
    s.cook += dt;
    if (s.cook >= COOK_TIME) {
      s.cook = 0;
      s.input!.count -= 1;
      if (s.input!.count <= 0) s.input = null;
      s.output = s.output
        ? { ...s.output, count: s.output.count + res.count }
        : { item: res.result, count: res.count };
      s.xp += res.xp;
    }
  } else s.cook = Math.max(0, s.cook - dt * 2); // без огня прогресс остывает
}

/** Пары «погасшая → горящая» печей (id берутся при вызове — реестр уже собран). */
const LIT_PAIRS = (): [number, number][] =>
  (
    [
      [B.furnace, B.lit_furnace],
      [B.smoker, B.lit_smoker],
      [B.blast_furnace, B.lit_blast_furnace],
    ] as [number | undefined, number | undefined][]
  ).filter(
    (p): p is [number, number] => p[0] !== undefined && p[1] !== undefined,
  );

registerBlockEntity("furnace", {
  create: newFurnace,
  tick: ({ world, be, dt }) => {
    const s = be.state as FurnaceState;
    const id = world.getBlock(be.x, be.y, be.z);
    // режим — по блоку: коптильня, плавильная печь или обычная (горящие — те же режимы)
    const mode: FurnaceMode =
      id === B.smoker || id === B.lit_smoker
        ? "smoker"
        : id === B.blast_furnace || id === B.lit_blast_furnace
          ? "blast"
          : "furnace";
    stepFurnace(s, dt, mode);
    // вид блока: горит — горящий двойник (свет), погасла — обычный; сторона (мета) та же
    const lit = s.burn > 0;
    for (const [off, on] of LIT_PAIRS()) {
      if (lit && id === off)
        world.setBlock(be.x, be.y, be.z, on, world.getMeta(be.x, be.y, be.z));
      else if (!lit && id === on)
        world.setBlock(be.x, be.y, be.z, off, world.getMeta(be.x, be.y, be.z));
    }
  },
  contents: (st) => {
    const s = st as FurnaceState;
    return [s.input, s.fuel, s.output];
  },
});
