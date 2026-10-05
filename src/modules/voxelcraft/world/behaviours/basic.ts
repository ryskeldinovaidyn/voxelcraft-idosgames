// Базовые поведения: верстак открывает крафт 3×3, двери/люки/калитки открываются.
import { events } from "../../core/EventBus";
import { OPEN, TOP } from "../../registry/meta";
import { behave, behaveWhere, type UseCtx } from "../blockBehaviour";

behave("crafting_table", {
  use: () => {
    events.emit("ui:openCrafting");
    return true;
  },
});

// кузнечный стол: алмазное + пеклитовый слиток → пеклитовое (systems/Smithing.ts)
behave("smithing_table", {
  use: () => {
    events.emit("ui:openSmithing");
    return true;
  },
});

// стол зачарований: экран знает, где стоит стол — считает книжные полки вокруг
behave("enchanting_table", {
  use: (c) => {
    events.emit("ui:openEnchanting", { x: c.x, y: c.y, z: c.z });
    return true;
  },
});

// наковальня: починка, соединение вещей, зачарования с книг (systems/Anvil.ts)
behave("anvil", {
  use: () => {
    events.emit("ui:openAnvil");
    return true;
  },
});

// точило: экран «снять зачарования и починить» (systems/Grindstone)
behave("grindstone", {
  use: () => {
    events.emit("ui:openGrindstone");
    return true;
  },
});

// камнерез: экран «блок → изделие» (systems/Stonecutter)
behave("stonecutter", {
  use: () => {
    events.emit("ui:openStonecutter");
    return true;
  },
});

// сундук и печь открывают свой экран (InventoryUI находит блочную сущность по координатам)
for (const name of [
  "chest",
  "furnace",
  "lit_furnace",
  "brewing_stand",
  "hopper",
  "dropper",
  "dispenser",
  "beacon",
  "shell_chest",
  "barrel",
  "smoker",
  "lit_smoker",
  "blast_furnace",
  "lit_blast_furnace",
])
  behave(name, {
    use: (c) => {
      events.emit("ui:openContainer", { x: c.x, y: c.y, z: c.z });
      return true;
    },
  });

function toggle(c: UseCtx): boolean {
  c.world.setBlock(c.x, c.y, c.z, c.id, c.meta ^ OPEN);
  events.emit("blockToggle", {
    x: c.x,
    y: c.y,
    z: c.z,
    open: (c.meta & OPEN) === 0,
  });
  return true;
}

behaveWhere((d) => d.shape === "door", {
  use: (c) => {
    toggle(c);
    // вторая половина двери открывается вместе с первой
    const oy = c.meta & TOP ? c.y - 1 : c.y + 1;
    if (c.world.getBlock(c.x, oy, c.z) === c.id)
      c.world.setBlock(
        c.x,
        oy,
        c.z,
        c.id,
        c.world.getMeta(c.x, oy, c.z) ^ OPEN,
      );
    return true;
  },
});

behaveWhere((d) => d.shape === "trapdoor" || d.shape === "fence_gate", {
  use: toggle,
});
