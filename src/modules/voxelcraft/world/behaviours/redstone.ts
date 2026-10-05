// Поведения красного камня (логика сигнала — world/Redstone.ts). Всё, что меняет сигнал, отвечает
// на соседей через запланированный тик, а не сразу: провод, пересчитав себя, будит соседей, и
// прямой вызов ушёл бы в рекурсию. Факел переключается через 2 тика, лампа гаснет через 4 — как в
// Minecraft.
import { events } from "../../core/EventBus";
import { BLOCKS, B } from "../../registry/Blocks";
import { DIR6, EXTENDED, OPEN, TOP } from "../../registry/meta";
import { extendPiston, retractPiston } from "../Piston";
import {
  COMPARATOR_SUB,
  ON,
  attachedTo,
  comparatorTick,
  isPowered,
  repeaterInput,
  updateWires,
} from "../Redstone";
import {
  behave,
  behaveWhere,
  type TickCtx,
  type UseCtx,
} from "../blockBehaviour";

/** Дверь или люк «запитаны» — чтобы сигнал не спорил с ручным открыванием. */
const POWERED = 0x10;

behave("redstone_wire", {
  neighborChanged: (c) => c.world.scheduleTick(c.x, c.y, c.z, 1),
  scheduledTick: (c) => updateWires(c.world, c.x, c.y, c.z),
});

behave("lever", {
  use: (c) => {
    c.world.setBlock(c.x, c.y, c.z, c.id, c.meta ^ ON);
    events.emit("leverClick", {
      x: c.x,
      y: c.y,
      z: c.z,
      on: (c.meta & ON) === 0,
    });
    return true;
  },
});

// кнопка: нажата 1 секунду (20 тиков)
behave("stone_button", {
  use: (c) => {
    if (c.meta & ON) return true;
    c.world.setBlock(c.x, c.y, c.z, c.id, c.meta | ON);
    c.world.scheduleTick(c.x, c.y, c.z, 20);
    events.emit("buttonClick", { x: c.x, y: c.y, z: c.z });
    return true;
  },
  scheduledTick: (c) => {
    if (c.meta & ON) c.world.setBlock(c.x, c.y, c.z, c.id, c.meta & ~ON);
  },
});

behave("redstone_lamp", {
  neighborChanged: (c) => c.world.scheduleTick(c.x, c.y, c.z, 1),
  scheduledTick: (c) => {
    if (isPowered(c.world, c.x, c.y, c.z))
      c.world.setBlock(c.x, c.y, c.z, B.redstone_lamp_on!);
  },
});
behave("redstone_lamp_on", {
  neighborChanged: (c) => c.world.scheduleTick(c.x, c.y, c.z, 4),
  scheduledTick: (c) => {
    if (!isPowered(c.world, c.x, c.y, c.z))
      c.world.setBlock(c.x, c.y, c.z, B.redstone_lamp!);
  },
});

// красный факел — инвертор: гаснет, когда заряжен блок, к которому он прикреплён
const attachedPowered = (c: TickCtx): boolean => {
  const [ax, ay, az] = attachedTo(c.x, c.y, c.z, c.meta);
  return isPowered(c.world, ax, ay, az);
};
behave("redstone_torch", {
  neighborChanged: (c) => c.world.scheduleTick(c.x, c.y, c.z, 2),
  scheduledTick: (c) => {
    if (attachedPowered(c))
      c.world.setBlock(c.x, c.y, c.z, B.redstone_torch_off!, c.meta);
  },
});
behave("redstone_torch_off", {
  neighborChanged: (c) => c.world.scheduleTick(c.x, c.y, c.z, 2),
  scheduledTick: (c) => {
    if (!attachedPowered(c))
      c.world.setBlock(c.x, c.y, c.z, B.redstone_torch!, c.meta);
  },
});

// повторитель: сигнал сзади → вперёд, 15 заново, с задержкой 1..4 тика красного камня (2..8 тиков);
// ПКМ меняет задержку
const repeater = {
  use: (c: UseCtx) => {
    c.world.setBlock(
      c.x,
      c.y,
      c.z,
      c.id,
      (c.meta & 3) | ((((c.meta >> 2) + 1) & 3) << 2),
    );
    events.emit("buttonClick", { x: c.x, y: c.y, z: c.z });
    return true;
  },
  neighborChanged: (c: TickCtx) =>
    c.world.scheduleTick(c.x, c.y, c.z, 2 * (1 + ((c.meta >> 2) & 3))),
  scheduledTick: (c: TickCtx) => {
    const on = repeaterInput(c.world, c.x, c.y, c.z, c.meta);
    if (on && c.id === B.repeater)
      c.world.setBlock(c.x, c.y, c.z, B.repeater_on!, c.meta);
    else if (!on && c.id === B.repeater_on)
      c.world.setBlock(c.x, c.y, c.z, B.repeater!, c.meta);
  },
};
behave("repeater", repeater);
behave("repeater_on", repeater);

// поршни: сигнал с любой стороны, кроме лица; головку сломали — поршень втягивается
const piston = {
  neighborChanged: (c: TickCtx) => c.world.scheduleTick(c.x, c.y, c.z, 1),
  scheduledTick: (c: TickCtx) => {
    const face = DIR6[c.meta & 7]!;
    const out = (c.meta & EXTENDED) !== 0;
    if (
      out &&
      c.world.getBlock(c.x + face[0], c.y + face[1], c.z + face[2]) !==
        B.piston_head
    ) {
      c.world.setBlock(c.x, c.y, c.z, c.id, c.meta & ~EXTENDED);
      return;
    }
    const p = isPowered(c.world, c.x, c.y, c.z, face);
    if (p && !out) extendPiston(c.world, c.x, c.y, c.z, c.id, c.meta);
    else if (!p && out) retractPiston(c.world, c.x, c.y, c.z, c.id, c.meta);
  },
};
behave("piston", piston);
behave("sticky_piston", piston);

// компаратор: ПКМ — сравнение ↔ вычитание; сам опрашивает вход каждый тик (onTick)
behave("comparator", {
  use: (c) => {
    c.world.setBlock(c.x, c.y, c.z, c.id, c.meta ^ COMPARATOR_SUB);
    events.emit("buttonClick", { x: c.x, y: c.y, z: c.z });
    return true;
  },
});
if (B.comparator !== undefined) BLOCKS[B.comparator]!.onTick = comparatorTick;

// TNT от сигнала взводится
behave("tnt", {
  neighborChanged: (c) => {
    if (!isPowered(c.world, c.x, c.y, c.z)) return;
    c.world.setBlock(c.x, c.y, c.z, B.air!);
    events.emit("tntPrime", { x: c.x, y: c.y, z: c.z, fuse: 4 });
  },
});

// двери и люки: сигнал появился — открыть, пропал — закрыть (дверь — обе половины)
behaveWhere((d) => d.shape === "door" || d.shape === "trapdoor", {
  neighborChanged: (c) => {
    const door =
      c.world.getBlock(c.x, c.y, c.z) === c.id &&
      c.world.getBlock(c.x, c.y + (c.meta & TOP ? -1 : 1), c.z) === c.id;
    const other = c.meta & TOP ? c.y - 1 : c.y + 1;
    const p =
      isPowered(c.world, c.x, c.y, c.z) ||
      (door && isPowered(c.world, c.x, other, c.z));
    if (p === ((c.meta & POWERED) !== 0)) return;
    const set = (y: number, meta: number) =>
      c.world.setBlock(
        c.x,
        y,
        c.z,
        c.id,
        p ? meta | POWERED | OPEN : meta & ~POWERED & ~OPEN,
      );
    set(c.y, c.meta);
    if (door) set(other, c.world.getMeta(c.x, other, c.z));
    events.emit("blockToggle", { x: c.x, y: c.y, z: c.z, open: p });
  },
});
