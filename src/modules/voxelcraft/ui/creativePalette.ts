// Палитра креатива: все предметы реестра с поиском по названию (своему и id), как вкладка «Поиск»
// в Minecraft. Бесконечный источник — что делает клик, решает InventoryUI (onPick).
import { ITEMS } from "../registry/Items";
import { labelOf } from "../registry/names";

export function buildCreativePalette(
  parent: HTMLElement,
  onPick: (item: string, rightClick: boolean, shift: boolean) => void,
): void {
  const search = document.createElement("input");
  search.type = "search";
  search.className = "creativeSearch";
  search.placeholder = "Поиск предметов…";
  // буквы поиска не должны доходить до игры (E закрыл бы экран); Esc закрывает, как обычно
  search.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") e.stopPropagation();
  });
  const grid = document.createElement("div");
  grid.className = "creativeGrid";
  parent.append(search, grid);

  const all = Object.keys(ITEMS);
  const fill = () => {
    const q = search.value.trim().toLowerCase();
    grid.innerHTML = "";
    for (const name of all) {
      if (q && !name.includes(q) && !labelOf(name).toLowerCase().includes(q))
        continue;
      const d = document.createElement("div");
      d.className = "slot";
      const img = document.createElement("img");
      img.draggable = false;
      img.src = ITEMS[name]!.iconURL ?? "";
      img.title = labelOf(name);
      d.appendChild(img);
      d.onmousedown = (e) => {
        onPick(name, e.button === 2, e.shiftKey);
        e.preventDefault();
      };
      d.oncontextmenu = (e) => e.preventDefault();
      grid.appendChild(d);
    }
  };
  search.addEventListener("input", fill);
  fill();
}
