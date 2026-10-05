// «Мои миры»: сейвы в IndexedDB этого браузера. Автосейв текущего мира + список для продолжения.
// IndexedDB может не быть (приватный режим, запрет хранилища во фрейме) — тогда open() отдаёт null,
// и игра работает как раньше, без сохранения между запусками.
import type { SaveData } from "../types";

export interface StoredWorld {
  id: string;
  name: string;
  updatedAt: number;
  save: SaveData;
}

export type StoredWorldInfo = Omit<StoredWorld, "save"> & {
  kind: "noise" | "spec";
};

const DB = "voxelcraft";
const STORE = "worlds";

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export function newWorldId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export class WorldStore {
  private constructor(private readonly db: IDBDatabase) {}

  static async open(): Promise<WorldStore | null> {
    try {
      if (typeof indexedDB === "undefined") return null;
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains(STORE))
          open.result.createObjectStore(STORE, { keyPath: "id" });
      };
      return new WorldStore(await req(open));
    } catch {
      return null;
    }
  }

  private tx(mode: IDBTransactionMode): IDBObjectStore {
    return this.db.transaction(STORE, mode).objectStore(STORE);
  }

  async put(world: StoredWorld): Promise<void> {
    await req(this.tx("readwrite").put(world));
  }

  async get(id: string): Promise<StoredWorld | undefined> {
    return (await req(this.tx("readonly").get(id))) as StoredWorld | undefined;
  }

  async delete(id: string): Promise<void> {
    await req(this.tx("readwrite").delete(id));
  }

  /** Все миры, свежие сверху (без тяжёлых сейвов). */
  async list(): Promise<StoredWorldInfo[]> {
    const all = (await req(this.tx("readonly").getAll())) as StoredWorld[];
    return all
      .map((w) => ({
        id: w.id,
        name: w.name,
        updatedAt: w.updatedAt,
        kind:
          w.save.world?.kind === "spec"
            ? ("spec" as const)
            : ("noise" as const),
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async lastPlayed(): Promise<StoredWorld | undefined> {
    const [top] = await this.list();
    return top ? this.get(top.id) : undefined;
  }

  close(): void {
    this.db.close();
  }
}
