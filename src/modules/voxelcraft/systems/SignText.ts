// Текст таблички: четыре строки по 15 знаков, как в Minecraft. Чистые функции — их зовут редактор
// таблички (ui/SignEditor), отрисовка (gfx/SignText) и тесты. Сам перенос общий: им же режет
// страницы книга (systems/Book).

/** Сколько строк на табличке и сколько знаков в строке. */
export const SIGN_LINES = 4;
export const SIGN_COLS = 15;

/**
 * Разложить текст по строкам заданной ширины: перенос по словам, слово длиннее строки рвётся,
 * лишнее сверх maxLines отбрасывается. Пустые строки в конце не хранятся.
 */
export function wrapText(
  raw: string,
  cols: number,
  maxLines: number,
): string[] {
  const out: string[] = [];
  let line = "";
  const push = () => {
    if (out.length < maxLines) out.push(line);
    line = "";
  };
  for (const word of raw.replace(/\s+/g, " ").trim().split(" ")) {
    if (!word) continue;
    let w = word;
    while (w.length > cols) {
      // слово длиннее строки — рвём по месту
      if (line) push();
      line = w.slice(0, cols);
      w = w.slice(cols);
      push();
    }
    if (!w) continue;
    if (!line) line = w;
    else if (line.length + 1 + w.length <= cols) line += " " + w;
    else {
      push();
      line = w;
    }
    if (out.length >= maxLines) break;
  }
  if (line) push();
  return out.slice(0, maxLines);
}

/** Строки таблички из введённого текста. */
export const wrapSignText = (raw: string): string[] =>
  wrapText(raw, SIGN_COLS, SIGN_LINES);

/** Строки таблички одной строкой — для подсказки и сейва. */
export const signSummary = (lines: readonly string[]): string =>
  lines.join(" ").trim();
