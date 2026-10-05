// Очередь интентов — сетевой шов этапа 2.
// Ввод НИКОГДА не мутирует мир напрямую: он кладёт сюда команды-намерения,
// а симуляция на тике достаёт их, валидирует (дистанция, наличие предмета,
// кулдаун) и исполняет. В мультиплеере хост будет класть в эту же очередь
// интенты удалённых игроков (с их playerId) — код исполнения один.

export const Intent = {
  BreakStart: "BreakStart", // {x,y,z}     — начать ломать блок
  BreakStop: "BreakStop", // {}          — отпустили ЛКМ / увели прицел
  PlaceBlock: "PlaceBlock", // {x,y,z,nx,ny,nz,hy,yaw,pitch} — поставить блок из слота по попаданию луча
  UseBlock: "UseBlock", // {x,y,z}     — ПКМ по блоку с поведением (дверь, люк, верстак)
  InteractEntity: "InteractEntity", // {entityId} — ПКМ по мобу: покормить, остричь
  ShootBow: "ShootBow", // {power}     — отпустили натянутый лук (0..1)
  Bucket: "Bucket", // {mode: fill|empty, x,y,z,nx,ny,nz} — зачерпнуть или вылить ведром
  Ignite: "Ignite", // {x,y,z,nx,ny,nz} — огниво: огонь у грани, TNT, портал
  PickBlock: "PickBlock", // {} — средняя кнопка: взять блок под прицелом в руку
  UseItem: "UseItem", // {x,y,z,nx,ny,nz} — ПКМ предметом со своим действием (мотыга, костная мука)
  ThrowEye: "ThrowEye", // {} — бросить Око Предела (ПКМ не по рамке портала)
  Fish: "Fish", // {} — удочка: забросить поплавок или подсечь
  UseHeld: "UseHeld", // {} — ПКМ предметом без цели в мире (пустая карта — завести карту)
  EatStart: "EatStart", // {item}      — начать есть еду из руки (удержание ПКМ)
  EatStop: "EatStop", // {}          — прекратить есть
  Attack: "Attack", // {entityId}  — удар по сущности
  SelectSlot: "SelectSlot", // {slot}      — 0..8
  CraftItem: "CraftItem", // {gridIds:[...], size} — взять результат крафта
  MoveInvItem: "MoveInvItem", // обрабатывается InventoryUI → Inventory (см. там)
  DropItem: "DropItem", // {all?}      — Q: выбросить предмет из руки (all — весь стак)
  ToggleMode: "ToggleMode", // {}          — выживание/креатив
  Command: "Command", // {text}      — команда консоли (/give, /tp…), исполняет systems/Commands
};

// Интент — команда-намерение: тип + произвольные поля данных (playerId добавится
// в этапе 2). Полезная нагрузка динамическая — локальный any здесь оправдан.
export interface IntentMsg {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export class IntentQueue {
  private _q: IntentMsg[];
  constructor() {
    this._q = [];
  }
  push(type: string, data: Record<string, unknown> = {}): void {
    this._q.push({ type, ...data });
  }
  /** Выгребает всё накопленное; вызывается симуляцией раз в тик. */
  drain(fn: (intent: IntentMsg) => void): void {
    const q = this._q;
    this._q = [];
    for (const intent of q) fn(intent);
  }
  clear(): void {
    this._q.length = 0;
  }
}
