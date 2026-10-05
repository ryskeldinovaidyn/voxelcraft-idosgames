// Жидкости (вода и лава) — клеточный автомат на dirty-set: мир никогда не сканируется,
// обрабатываются только клетки из очередей. У каждой жидкости свой темп (вода — каждый 5-й
// симтик, лава — каждый 30-й, как в Minecraft) и своя дальность (вода ~7 блоков, лава 3).
// Бюджет клеток за тик жёстко ограничен — остаток «дотекает» в следующие тики.
//
// Правила:
//   • source (бит меты) никогда не гаснет;
//   • под жидкостью воздух → жидкость падает вниз, уровень наследуется;
//   • иначе растекается горизонтально с уровнем max(соседей)-step, пока не ниже minLevel;
//   • текущая жидкость без питания убывает;
//   • лава + вода: источник лавы → обсидиан, текущая лава → булыжник, лава сверху на воду → камень.
import { CONFIG } from "../config";
import { events } from "../core/EventBus";
import { B, packWater, waterLevel, isWaterSource } from "../registry/Blocks";
import { sim } from "../net/sim";
import type { ChunkManager } from "../world/ChunkManager";

interface Cell {
  x: number;
  y: number;
  z: number;
}

interface Fluid {
  id: number;
  /** Каждый N-й симтик. */
  every: number;
  /** На сколько падает уровень за блок растекания. */
  step: number;
  minLevel: number;
  /** Меняет только водный меш (дешёвая пересборка) — лава в общем меше. */
  waterOnly: boolean;
  queue: Map<string, Cell>;
}

const key = (x: number, y: number, z: number) => x + "," + y + "," + z;
const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
const AROUND = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
] as const;

export class FluidSim {
  world: ChunkManager;
  private readonly fluids: Fluid[];
  private _tickCounter = 0;

  constructor(world: ChunkManager) {
    this.world = world;
    this.fluids = [
      {
        id: B.water!,
        every: CONFIG.water.tickEvery,
        step: 1,
        minLevel: CONFIG.water.minFlowLevel,
        waterOnly: true,
        queue: new Map(),
      },
      {
        id: B.lava!,
        every: CONFIG.lava.tickEvery,
        step: CONFIG.lava.step,
        minLevel: 2,
        waterOnly: false,
        queue: new Map(),
      },
    ];

    // любое изменение мира будит жидкости вокруг — так «прорывается дамба». Реплика (net/sim) жидкости
    // не считает: течение пришлёт владелец измерения.
    events.on("blockChanged", ({ x, y, z }) => {
      if (!sim.authority) return;
      this.wake(x, y, z);
      this.wakeNeighbors(x, y, z);
    });
  }

  get queueSize(): number {
    let n = 0;
    for (const f of this.fluids) n += f.queue.size;
    return n;
  }

  clear(): void {
    for (const f of this.fluids) f.queue.clear();
  }

  wake(x: number, y: number, z: number): void {
    const id = this.world.getBlock(x, y, z);
    for (const f of this.fluids)
      if (id === f.id || id === B.air) f.queue.set(key(x, y, z), { x, y, z });
  }

  wakeNeighbors(x: number, y: number, z: number): void {
    for (const [dx, dy, dz] of AROUND) this.wake(x + dx, y + dy, z + dz);
  }

  tick(): void {
    this._tickCounter++;
    for (const f of this.fluids) {
      if (this._tickCounter % f.every !== 0 || f.queue.size === 0) continue;
      const batch: Cell[] = [];
      for (const cell of f.queue.values()) {
        batch.push(cell);
        if (batch.length >= CONFIG.water.cellBudget) break;
      }
      for (const c of batch) f.queue.delete(key(c.x, c.y, c.z));
      for (const { x, y, z } of batch) this._updateCell(f, x, y, z);
    }
  }

  private _set(
    f: Fluid,
    x: number,
    y: number,
    z: number,
    id: number,
    meta: number,
  ): void {
    this.world.setBlock(x, y, z, id, meta, { waterOnly: f.waterOnly });
    this.wakeNeighbors(x, y, z);
    f.queue.set(key(x, y, z), { x, y, z });
  }

  /** Встреча лавы с водой. true — клетка перестала быть жидкостью. */
  private _react(f: Fluid, x: number, y: number, z: number): boolean {
    const meta = this.world.getMeta(x, y, z);
    if (f.id === B.lava) {
      for (const [dx, dy, dz] of AROUND)
        // вода прямо под лавой — не сюда: лава стечёт в неё, и вода станет камнем (_spread)
        if (
          dy !== -1 &&
          this.world.getBlock(x + dx, y + dy, z + dz) === B.water
        ) {
          this.world.setBlock(
            x,
            y,
            z,
            isWaterSource(meta) ? B.obsidian! : B.cobblestone!,
          );
          return true;
        }
      return false;
    }
    // вода остывает соседнюю лаву сама (лава тикает редко — ждать её не нужно)
    for (const [dx, dy, dz] of AROUND) {
      if (dy === 1) continue; // лава сверху решает сама: стекает в воду камнем
      const nx = x + dx,
        ny = y + dy,
        nz = z + dz;
      if (this.world.getBlock(nx, ny, nz) !== B.lava) continue;
      const source = isWaterSource(this.world.getMeta(nx, ny, nz));
      this.world.setBlock(nx, ny, nz, source ? B.obsidian! : B.cobblestone!);
    }
    return false;
  }

  private _updateCell(f: Fluid, x: number, y: number, z: number): void {
    const id = this.world.getBlock(x, y, z);

    if (id === B.air) {
      // может ли жидкость прийти сюда? сверху — или сбоку с уровнем, не ниже minLevel
      if (this.world.getBlock(x, y + 1, z) === f.id) {
        // ВАЖНО: при падении уровень наследуется (не сбрасывается в максимум) —
        // иначе каскад по склону заливает конус до океана (как в MC, но
        // неподъёмно для геймплея «сломал дамбу — лужа растеклась и встала»).
        this._set(
          f,
          x,
          y,
          z,
          f.id,
          packWater(waterLevel(this.world.getMeta(x, y + 1, z)), false),
        );
        return;
      }
      let best = 0;
      for (const [dx, dz] of SIDES) {
        if (this.world.getBlock(x + dx, y, z + dz) !== f.id) continue;
        // сосед отдаёт жидкость вбок, только если сам стоит на опоре
        if (this.world.getBlock(x + dx, y - 1, z + dz) === B.air) continue;
        best = Math.max(
          best,
          waterLevel(this.world.getMeta(x + dx, y, z + dz)),
        );
      }
      if (best - f.step >= f.minLevel)
        this._set(f, x, y, z, f.id, packWater(best - f.step, false));
      return;
    }

    if (id !== f.id) return;
    if (this._react(f, x, y, z)) return;
    const meta = this.world.getMeta(x, y, z);
    if (isWaterSource(meta)) {
      this._spread(f, x, y, z, CONFIG.water.maxLevel);
      return;
    }

    // пересчёт уровня текущей жидкости: питание сверху или от соседей
    let want = 0;
    if (this.world.getBlock(x, y + 1, z) === f.id)
      want = waterLevel(this.world.getMeta(x, y + 1, z));
    else
      for (const [dx, dz] of SIDES)
        if (this.world.getBlock(x + dx, y, z + dz) === f.id)
          want = Math.max(
            want,
            waterLevel(this.world.getMeta(x + dx, y, z + dz)) - f.step,
          );

    const cur = waterLevel(meta);
    if (want < f.minLevel) {
      this._set(f, x, y, z, B.air!, 0); // высохла
      return;
    }
    if (want !== cur) {
      this._set(f, x, y, z, f.id, packWater(want, false));
      return;
    }
    this._spread(f, x, y, z, cur);
  }

  /** Растекание из клетки: сначала вниз (уровень наследуется), потом в стороны. */
  private _spread(
    f: Fluid,
    x: number,
    y: number,
    z: number,
    level: number,
  ): void {
    const below = this.world.getBlock(x, y - 1, z);
    if (below === B.air) {
      this._set(f, x, y - 1, z, f.id, packWater(level, false));
      return; // жидкость уходит вниз — вбок не льём
    }
    if (f.id === B.lava && below === B.water) {
      this.world.setBlock(x, y - 1, z, B.stone!); // лава на воду сверху — камень
      return;
    }
    if (level - f.step < f.minLevel) return;
    for (const [dx, dz] of SIDES) {
      const nid = this.world.getBlock(x + dx, y, z + dz);
      if (nid === B.air)
        this._set(f, x + dx, y, z + dz, f.id, packWater(level - f.step, false));
      else if (
        nid === f.id &&
        waterLevel(this.world.getMeta(x + dx, y, z + dz)) < level - f.step
      )
        this._set(f, x + dx, y, z + dz, f.id, packWater(level - f.step, false));
    }
  }
}
