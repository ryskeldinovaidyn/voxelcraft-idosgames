// Единый конфиг игры. Все тюнинги — здесь, логика магических чисел не содержит.
export const CONFIG = {
  // Размер чанка в блоках. Высота 128 — с сейва v3; старые генераторы (мир по сиду v1/v2 и
  // рецепты) строят только нижние 64 слоя — см. LEGACY_SY в Chunk.ts.
  chunk: { sx: 16, sy: 128, sz: 16 },
  renderDistance: 5, // радиус в чанках
  unloadDistance: 7, // дальше этого — выгрузка
  genBudgetPerFrame: 2, // генераций данных чанков за кадр
  meshBudgetPerFrame: 2, // пересборок мешей за кадр

  tps: 20, // тиков симуляции в секунду
  randomTickSpeed: 3, // случайных тиков на секцию 16³ за симтик, как в Minecraft
  maxCatchupTicks: 4, // защита от «спирали смерти» после сворачивания вкладки

  world: {
    seed: 1337,
    waterLevel: 25, // уровень моря (y)
    baseHeight: 31,
    hillAmp: 14, // амплитуда холмов
  },

  player: {
    width: 0.6,
    height: 1.8,
    eye: 1.62,
    walkSpeed: 4.3,
    runSpeed: 6.5,
    flySpeed: 11,
    jumpSpeed: 8.2,
    gravity: 24,
    swimSpeed: 2.4,
    swimUp: 4.0,
    waterDrag: 0.6,
    reach: 5, // дистанция взаимодействия с блоками
    breakHealDelay: 1.2, // сек простоя, прежде чем урон блока начнёт заживать
    breakHealRate: 0.3, // доля прочности блока, восстанавливаемая за секунду простоя
    maxHealth: 20, // 10 сердечек
    fallSafe: 3.5, // блоков падения без урона
    stepHeight: 0.6, // шаг вверх без прыжка (ступени, плиты), как в Minecraft
    climbSpeed: 2.35, // блоков/с по лестнице
    sneakSpeed: 1.3, // шаг присевшего
    sneakEye: 1.27, // высота глаз присевшего
    attackDamage: 1, // урон кулаком
    attackCooldown: 0.35, // сек
    swingTime: 0.3, // сек на замах руки; он же период замахов, пока ЛКМ зажата по блоку

    // Голод (модель Minecraft: еда + сатурация + накопитель «истощения»)
    maxFood: 20, // 10 «окорочков»
    sprintFood: 6, // ниже — нельзя бежать
    exhaustionPerFood: 4.0, // истощения на -1 очко еды/сатурации
    exhaustIdle: 0.02, // пассивное истощение в секунду (стоя)
    exhaustWalk: 0.04, // истощение на блок ходьбы
    exhaustSprint: 0.08, // истощение на блок бега
    exhaustJump: 0.2, // за прыжок
    exhaustBreak: 0.06, // за сломанный блок
    exhaustAttack: 0.1, // за удар
    exhaustRegen: 6.0, // за восстановленное сердце (регенерация «стоит» еды)
    regenFoodThreshold: 18, // еда >= этого → лечит HP
    regenInterval: 3.5, // сек на +1 HP
    starveInterval: 4.0, // сек на -1 HP при нулевой еде
    eatTime: 1.4, // сек удержания ПКМ, чтобы съесть
  },

  drops: {
    magnetRadius: 1.9,
    pickupRadius: 0.6,
    magnetPull: 14,
    gravity: 18,
    bounce: 0.3,
    friction: 0.6,
    maxCount: 60,
    mergeRadius: 0.6,
    scale: 0.25,
    despawnTime: 300, // сек
  },

  mobs: {
    passiveCap: 10, // мирных вокруг игрока (в countRadius)
    hostileCap: 15, // враждебных
    countRadius: 64,
    spawnRadius: [24, 48], // мин/макс дистанция спавна (ближе 24 не появляются, как в Minecraft)
    despawnRadius: 72, // враждебные дальше — исчезают
    spawnAttempts: 3, // попыток спавна за перепись (раз в секунду)
  },

  water: {
    tickEvery: 5, // каждый N-й симтик (20/5 = 4 Гц)
    cellBudget: 400, // макс клеток за водный тик
    maxLevel: 8,
    minFlowLevel: 2, // уровень 2 останавливает растекание (~7 блоков)
  },

  lava: {
    tickEvery: 30, // лава течёт медленнее воды (каждый 30-й симтик), как в Minecraft
    step: 2, // уровень падает на 2 за блок — растекается на 3 блока
  },

  dayNight: {
    // секунд; цикл 20 минут, как в Minecraft. День включает рассвет, ночь — сумерки.
    dayLength: 720,
    nightLength: 480,
  },

  // Графика. Тени и AO — главные слагаемые «казуальной» картинки; на слабых устройствах их можно
  // выключить здесь, игровая логика от них не зависит.
  graphics: {
    shadows: true,
    shadowMapSize: 2048,
    shadowDistance: 40, // полуразмер области теней вокруг игрока, блоков
    shadowSoftness: 6, // радиус PCF-размытия края тени, текселей
    shadowStrength: 0.75, // 1 — тень без подсветки; меньше — светлее и мягче
    ao: true, // вершинное ambient occlusion: мягкие контактные тени в стыках блоков
    exposure: 1.0,
  },

  // Задел под этап 2 (мультиплеер «звезда с хостом»). В MVP не используется.
  // ИИ-генерация миров (client.ai). Фичу с этим ключом издатель настраивает в конфиге тайтла.
  ai: {
    featureKey: "voxel-world",
    pollMs: 4000, // опрос асинхронной задачи — каждый опрос платит издатель
    pollTimeoutMs: 10 * 60_000,
  },

  net: {
    maxPlayers: 8,
    snapshotRateHz: 15, // рассылка позиций unreliable-каналом
    interpBufferMs: 120,
    timeoutMs: 8000,
    protocolVersion: 1,
  },

  // Команды консоли (/give, /tp…). Издатель может выключить читы в своей игре.
  commands: { enabled: true },

  // 2: в сейве есть `world` — источник мира (сид или рецепт). Сейвы v1 грузятся как мир по сиду.
  // 3: палитра id→имя, измерения, блочные сущности, точка возрождения (v1/v2 читаются как раньше).
  saveVersion: 3,
};
