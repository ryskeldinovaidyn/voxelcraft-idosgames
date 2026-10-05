// Машины для предметов (сейв v3): воронка, выбрасыватель, раздатчик. Логика — блочные сущности
// world/blockentities/hopper.ts и dispenser.ts, перенос между блоками — world/Containers.ts.
import type { BlockDef } from "../../types";
import { block } from "./define";

const STONE = {
  hardness: 3.5,
  tool: "pickaxe",
  harvest: 1,
  mapColor: 0x6e6e6e,
} as const;

export const MACHINE_BLOCKS: BlockDef[] = [
  block({
    name: "hopper",
    shape: "hopper",
    opaque: false,
    hardness: 3,
    tool: "pickaxe",
    harvest: 1,
    blockEntity: "hopper",
    tex: {
      top: "hopper_top",
      side: "hopper_side",
      bottom: "hopper_side",
      icon: "hopper_item",
    },
    mapColor: 0x3a3a3a,
  }),
  block({
    name: "dropper",
    ...STONE,
    facing6: true,
    blockEntity: "dispenser",
    tex: {
      front: "dropper_front",
      side: "machine_side",
      top: "machine_side",
      bottom: "machine_side",
    },
  }),
  block({
    name: "dispenser",
    ...STONE,
    facing6: true,
    blockEntity: "dispenser",
    tex: {
      front: "dispenser_front",
      side: "machine_side",
      top: "machine_side",
      bottom: "machine_side",
    },
  }),
  // компаратор: мета — направление выхода (0..1), вычитание (0x4), сила выхода (биты 3..6)
  block({
    name: "comparator",
    shape: "comparator",
    solid: false,
    opaque: false,
    hardness: 0,
    tex: {
      top: "comparator",
      side: "stone",
      bottom: "stone",
      on: "comparator_on",
    },
    mapColor: 0x9a9a9a,
  }),
  // наблюдатель: лицо — DIR6 из меты, тыл (upper) — выход, горит (on) во время импульса
  block({
    name: "observer",
    ...STONE,
    facing6: true,
    blockEntity: "observer",
    tex: {
      front: "observer_front",
      upper: "observer_back",
      on: "observer_back_on",
      side: "observer_side",
      top: "observer_side",
      bottom: "observer_side",
    },
  }),
  // рельсы (world/Rails.ts): форма — мета; у разгонных и нажимных бит 0x8 — «под током»
  block({
    name: "rail",
    shape: "rail",
    solid: false,
    opaque: false,
    hardness: 0.7,
    tool: "pickaxe",
    tex: { top: "rail", side: "rail", bottom: "rail" },
    mapColor: 0x8a8a8a,
  }),
  block({
    name: "powered_rail",
    shape: "rail",
    solid: false,
    opaque: false,
    hardness: 0.7,
    tool: "pickaxe",
    tex: {
      top: "powered_rail",
      side: "powered_rail",
      bottom: "powered_rail",
      on: "powered_rail_on",
    },
    mapColor: 0xc8a040,
  }),
  block({
    name: "detector_rail",
    shape: "rail",
    solid: false,
    opaque: false,
    hardness: 0.7,
    tool: "pickaxe",
    tex: {
      top: "detector_rail",
      side: "detector_rail",
      bottom: "detector_rail",
      on: "detector_rail_on",
    },
    mapColor: 0x8a6a6a,
  }),
];
