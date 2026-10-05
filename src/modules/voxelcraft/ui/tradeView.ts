// Список сделок жителя на экране торговли (InventoryUI, вид "trade"): что отдать → что получить и
// сколько раз ещё; клик по доступной строке — сделка. Логика — systems/Trading.ts.
import { events } from "../core/EventBus";
import { ITEMS } from "../registry/Items";
import { labelOf } from "../registry/names";
import { enchantSuffix } from "../systems/Enchant";
import { priceOf } from "../systems/Reputation";
import {
  TIER_NAMES,
  TRADE_XP,
  canAfford,
  levelOf,
  tierOf,
  trade,
  tradesOf,
} from "../systems/Trading";
import type { Mob } from "../entities/Mob";
import type { Inventory } from "../systems/Inventory";
import type { ItemStack } from "../types";

function part(parent: HTMLElement, s: ItemStack): void {
  const img = document.createElement("img");
  img.draggable = false;
  img.src = ITEMS[s.item]?.iconURL ?? "";
  parent.appendChild(img);
  parent.appendChild(
    document.createTextNode(
      `${s.count}× ${labelOf(s.item)}${enchantSuffix(s)}`,
    ),
  );
}

export function renderTradeOffers(
  el: HTMLElement,
  inv: Inventory,
  mob: Mob,
  drop: (s: ItemStack) => void,
  onDone: () => void,
  /** Уровень Героя деревни — скидка (0 — без неё). */
  heroLevel = 0,
  /** Репутация игрока в деревне: хорошая делает плату дешевле, плохая — дороже. */
  rep = 0,
): void {
  el.innerHTML = "";
  const level = levelOf(mob.villagerXp);
  tradesOf(mob.def.trades).forEach((base, i) => {
    const used = mob.uses[i] ?? 0;
    // плата: скидка Героя, спрос на эту сделку и репутация (systems/Reputation)
    const t = priceOf(base, { heroLevel, uses: used, rep });
    const soldOut = used >= t.maxUses;
    // сделка выше уровня жителя закрыта, пока он не наторгует опыт
    const locked = tierOf(i) > level;
    const ok = !locked && !soldOut && canAfford(inv, t);
    const row = document.createElement("div");
    row.className = "enchOffer tradeOffer" + (ok ? "" : " off");
    part(row, { item: t.buy[0], count: t.buy[1] });
    if (t.buy2) {
      row.appendChild(document.createTextNode(" + "));
      part(row, { item: t.buy2[0], count: t.buy2[1] });
    }
    row.appendChild(document.createTextNode(" → "));
    part(row, t.sell);
    const left = document.createElement("span");
    left.className = "tradeLeft";
    left.textContent = locked
      ? TIER_NAMES[tierOf(i) - 1]!
      : soldOut
        ? "распродано"
        : `ещё ${t.maxUses - used}`;
    row.appendChild(left);
    row.onmousedown = (e) => {
      e.preventDefault();
      if (!ok || !trade(inv, t, drop)) return;
      mob.uses[i] = used + 1;
      mob.traded = true; // торговавший житель профессию больше не теряет
      mob.villagerXp += TRADE_XP; // опыт профессии открывает следующие ступени списка
      events.emit("trade", { item: t.sell.item });
      events.emit("xpGain", { amount: 2 });
      onDone();
    };
    el.appendChild(row);
  });
}
