// Хранилище: ПКМ ключом испытаний — ключ тратится, выпадает добыча (у хранилища постройки — по сиду из
// lootAt генератора, у поставленного — случайная), хранилище остаётся открытым навсегда (бит меты).
import { events } from "../../core/EventBus";
import { VAULT_OPEN } from "../../registry/blocks/trial";
import { vaultLoot } from "../../systems/TrialSpawner";
import { behave } from "../blockBehaviour";

behave("vault", {
  use: (c) => {
    if (c.held !== "trial_key" || c.meta & VAULT_OPEN) return false;
    const loot =
      c.world.generator.lootAt?.(c.x, c.y, c.z)?.filter((s) => !!s) ??
      vaultLoot(Math.random);
    c.consume?.();
    c.world.setBlock(c.x, c.y, c.z, c.id, c.meta | VAULT_OPEN);
    for (const s of loot) if (s) c.drop?.(s.item, s.count);
    events.emit("vaultOpen", { x: c.x, y: c.y, z: c.z });
    return true;
  },
});
