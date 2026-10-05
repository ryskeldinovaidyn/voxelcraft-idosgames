// Экран маяка (InventoryUI, вид "beacon"): уровень пирамиды, основные силы по уровню, на 4-м — вторая
// сила. Выбор стоит одного слитка железа или золота, изумруда, алмаза или пеклита из инвентаря (в
// креативе — даром). Логика — world/Beacon.ts.
import { events } from "../core/EventBus";
import { EFFECT_NAMES, labelOf } from "../registry/names";
import {
  BEACON_PAYMENT,
  BEACON_POWERS,
  canChoose,
  type BeaconState,
} from "../world/Beacon";
import type { BlockEntity } from "../world/BlockEntities";
import type { Inventory } from "../systems/Inventory";
import type { EffectId } from "../types";

export function renderBeaconPowers(
  el: HTMLElement,
  inv: Inventory,
  be: BlockEntity,
  creative: boolean,
  onDone: () => void,
): void {
  const s = be.state as unknown as BeaconState;
  el.innerHTML = "";
  const line = (text: string) => {
    const d = document.createElement("div");
    d.className = "beaconInfo";
    d.textContent = text;
    el.appendChild(d);
  };
  line(
    s.levels
      ? `Пирамида: ${s.levels} ур.${s.active ? "" : " — небо над маяком закрыто"}`
      : "Нет пирамиды: поставьте маяк на блоки железа, золота, алмазов или изумрудов",
  );
  const pay = creative
    ? null
    : (BEACON_PAYMENT.find((i) => inv.count(i) > 0) ?? null);

  const row = (label: string, on: boolean, ok: boolean, pick: () => void) => {
    const b = document.createElement("div");
    b.className = "enchOffer" + (on ? " on" : "") + (ok && !on ? "" : " off");
    b.textContent = label;
    b.onmousedown = (e) => {
      e.preventDefault();
      if (!ok || on) return;
      if (!creative) {
        if (!pay) return;
        inv.consume(pay, 1);
      }
      pick();
      events.emit("beaconSet", {
        x: be.x,
        y: be.y,
        z: be.z,
        primary: s.primary,
        secondary: s.secondary,
      });
      onDone();
    };
    el.appendChild(b);
  };
  const paid = creative || pay !== null;
  for (const p of BEACON_POWERS)
    row(
      `${EFFECT_NAMES[p.id]} (с ${p.tier} ур.)`,
      s.primary === p.id,
      paid && canChoose(s, p.id, 0),
      () => {
        s.primary = p.id;
        if (s.secondary !== "regeneration") s.secondary = null; // «та же сила II» была про прежнюю
      },
    );
  if (s.levels >= 4 && s.primary) {
    const second: EffectId[] = ["regeneration", s.primary];
    for (const id of second)
      row(
        id === s.primary ? `${EFFECT_NAMES[id]} II` : EFFECT_NAMES[id]!,
        s.secondary === id,
        paid && canChoose(s, id, 1),
        () => (s.secondary = id),
      );
  }
  line(
    creative
      ? "Креатив: без оплаты"
      : pay
        ? `Оплата: ${labelOf(pay)} (1 шт.)`
        : "Оплата: слиток железа или золота, изумруд или алмаз — в инвентаре нет",
  );
}
