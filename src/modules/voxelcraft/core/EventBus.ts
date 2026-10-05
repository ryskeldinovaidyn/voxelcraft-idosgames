// Событийная шина — единственный канал связи между системами.
// В этапе 2 (мультиплеер) сетевой слой станет просто ещё одним подписчиком:
// у хоста события уходят в сеть как дельты, у клиента входящие дельты эмитятся сюда же.
//
// Основные события:
//   blockChanged {x,y,z,id,meta,prevId}  — любое изменение блока (самодостаточно для репликации)
//   blockBreak   {x,y,z,id,byPlayer}     — блок сломан (уже после blockChanged)
//   blockPlace   {x,y,z,id}
//   itemPickup   {item,count}
//   playerHurt   {amount,health,cause}
//   mobHurt      {entity,amount}
//   mobDied      {entity}
//   craft        {item,count}
//   tick         {n}                     — каждый симуляционный тик (20 TPS)
//   invChanged   {}                      — инвентарь игрока изменился (HUD перерисовать)

// Полезная нагрузка событий намеренно динамическая (разные события несут разные
// поля-мешки); подписчик получает нетипизированный data — локальный any здесь оправдан.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventHandler = (data?: any) => void;

class EventBus {
  private _map: Map<string, Set<EventHandler>>;
  constructor() {
    this._map = new Map();
  }
  on(name: string, fn: EventHandler): () => void {
    if (!this._map.has(name)) this._map.set(name, new Set());
    this._map.get(name)!.add(fn);
    return () => this.off(name, fn);
  }
  off(name: string, fn: EventHandler): void {
    this._map.get(name)?.delete(fn);
  }
  emit(name: string, data?: unknown): void {
    const set = this._map.get(name);
    if (!set) return;
    for (const fn of set) fn(data);
  }
  /** Снять ВСЕ подписки. Зовёт Game.destroy(): шина — синглтон модуля и переживает игру. */
  clear(): void {
    this._map.clear();
  }
}

export const events = new EventBus();
