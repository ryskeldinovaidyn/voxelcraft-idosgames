// Обновления соседей: блок, у которого пропала опора (факел, растение, дверь, лестница…), ломается
// с дропом, как в Minecraft. Слушает blockChanged и перепроверяет шестерых соседей изменённой
// клетки; цепочки (дверь → её вторая половина) разворачиваются через те же события.
import { events } from "../core/EventBus";
import { BLOCKS, B } from "../registry/Blocks";
import { ITEMS } from "../registry/Items";
import { readsSignal } from "../world/Redstone";
import { isSupported } from "../world/Support";
import { BEHAVIOURS } from "../world/blockBehaviour";
import { dropsOf } from "./Mining";
import { sim } from "../net/sim";
import type { ChunkManager } from "../world/ChunkManager";
import type { ItemStack } from "../types";
import type { BlockEntity } from "../world/BlockEntities";

/** Куда падает дроп (EntityManager); остальное — для машин (воронка, раздатчик). */
export interface DropSink {
  spawnDrop(
    x: number,
    y: number,
    z: number,
    item: string,
    count: number,
    dmg?: number,
    tag?: Record<string, unknown>,
  ): unknown;
  /** Вагонетка с сундуком или воронкой в клетке — как контейнер (воронка берёт из неё и кладёт в неё). */
  cartItems?(x: number, y: number, z: number): BlockEntity | null;
  /** Забрать из лежащего в коробке дропа один предмет, если accept его взял. */
  takeDrop?(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    accept: (s: ItemStack) => boolean,
  ): boolean;
  /** Выбросить стак с начальной скоростью (выбрасыватель). */
  ejectItem?(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    s: ItemStack,
  ): void;
  /** Пустить стрелу (раздатчик). */
  shootArrow?(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    /** Вид стрелы: обычная или отравленная (systems/TippedArrow). */
    item?: string,
  ): void;
  /** Выпустить пчелу из улья в (x,y,z); false — рядом нет места. */
  spawnBee?(x: number, y: number, z: number): boolean;
}

const NEIGHBORS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
] as const;

export class BlockUpdates {
  /** @param world — текущий мир (он пересоздаётся при смене мира/измерения) */
  constructor(
    private readonly world: () => ChunkManager,
    private readonly drops: DropSink,
  ) {
    // Реплика (сетевая игра, чужое измерение) каскадов не считает: их посчитает владелец измерения
    // и пришлёт результат (net/sim).
    events.on(
      "blockChanged",
      ({ x, y, z }: { x: number; y: number; z: number }) => {
        if (sim.authority) this.checkAround(x, y, z);
      },
    );
    // проверить опору одной клетки (растение на своём случайном тике: тростник без воды осыпается)
    events.on(
      "blockRecheck",
      ({ x, y, z }: { x: number; y: number; z: number }) => {
        if (sim.authority) this.check(x, y, z);
      },
    );
    // сломать с дропом (поршень упёрся в факел или траву)
    events.on(
      "blockDestroy",
      ({ x, y, z }: { x: number; y: number; z: number }) => {
        if (sim.authority) this.destroy(x, y, z);
      },
    );
  }

  checkAround(x: number, y: number, z: number): void {
    this.notify(x, y, z); // сам изменённый блок (поставленный песок проверит опору)
    for (const [dx, dy, dz] of NEIGHBORS) this.check(x + dx, y + dy, z + dz);
    // второй круг — только читателям сигнала: сигнал проходит сквозь твёрдый блок
    const w = this.world();
    for (const [ax, ay, az] of NEIGHBORS)
      for (const [bx, by, bz] of NEIGHBORS) {
        const nx = x + ax + bx,
          ny = y + ay + by,
          nz = z + az + bz;
        if (
          (nx !== x || ny !== y || nz !== z) &&
          readsSignal(w.getBlock(nx, ny, nz))
        )
          this.notify(nx, ny, nz);
      }
  }

  /** Сообщить блоку, что рядом что-то изменилось (падающие блоки, жидкости). */
  private notify(x: number, y: number, z: number): void {
    const w = this.world();
    const id = w.getBlock(x, y, z);
    const fn = BEHAVIOURS.get(id)?.neighborChanged;
    if (fn)
      fn({ world: w, x, y, z, id, meta: w.getMeta(x, y, z), rng: Math.random });
  }

  /** Сломать блок в клетке, если он больше не держится; иначе — сообщить ему о соседе. */
  check(x: number, y: number, z: number): void {
    const w = this.world();
    const id = w.getBlock(x, y, z);
    if (id === B.air) return;
    const meta = w.getMeta(x, y, z);
    if (isSupported(w, x, y, z, id, meta)) {
      this.notify(x, y, z);
      return;
    }
    this.destroy(x, y, z);
  }

  /** Сломать блок с дропом: пропала опора, раздавил поршень. */
  destroy(x: number, y: number, z: number): void {
    const w = this.world();
    const id = w.getBlock(x, y, z);
    if (id === B.air) return;
    const meta = w.getMeta(x, y, z);
    w.setBlock(x, y, z, B.air!);
    events.emit("blockBreak", { x, y, z, id, byPlayer: false });
    for (const d of dropsOf(BLOCKS[id]!, meta))
      if (ITEMS[d.item])
        this.drops.spawnDrop(x + 0.5, y + 0.5, z + 0.5, d.item, d.n);
  }
}
