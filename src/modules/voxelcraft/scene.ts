import type {
  ContentTypeHandler,
  EngineScene,
  ModuleAgentApi,
  SceneMountContext,
} from "@idosgames/module-sdk";
import { createVoxelcraftAgentApi } from "./agent";
import { createVoxelWorldContentType } from "./workshop";
import { Game, type GameOptions } from "./main";
import "./style.css";

// VoxelCraft is a standalone vanilla-Three game with its own DOM HUD (queried by id) and its own
// RAF loop — no React, no SDK. It becomes a composable module by (1) injecting the DOM it expects
// into the host surface instead of relying on index.html, and (2) exposing mount/suspend/destroy.
// Because the host surface is in the document, the game's document.getElementById(...) lookups keep
// working unchanged — no rewrite of its HUD/input code needed.
//
// This is the "engine scene with NO React panels" branch of the contract: the module registers a
// scene and a nav entry, and nothing else.

const VOXEL_DOM = `
  <canvas id="game"></canvas>
  <div id="crosshair"></div>
  <div id="fps"></div>
  <div id="debug"></div>
  <div id="timeIndicator"></div>
  <div id="hearts"></div>
  <div id="hunger"></div>
  <div id="hotbar"></div>
  <div id="hurtFlash"></div>
  <div id="message"></div>
  <div id="tutorialHint" role="status" aria-live="polite"></div>
  <div id="tutorialGuide" class="hidden" role="status" aria-live="polite">
    <div class="tutorialGuideLabel">ОБУЧЕНИЕ <span id="tutorialGuideProgress"></span></div>
    <strong id="tutorialGuideTitle"></strong>
    <p id="tutorialGuideAction"></p>
  </div>
  <div id="invScreen" class="hidden">
    <div class="invPanel">
      <h3 id="invTitle">Inventory</h3>
      <div class="craftRow">
        <div id="craftGrid"></div>
        <div class="arrow">&rarr;</div>
        <div id="craftResult" class="slot result"></div>
      </div>
      <div id="invGrid"></div>
      <div id="invHotbar"></div>
    </div>
  </div>
  <div id="cursorStack" class="hidden"><img draggable="false" /><span class="count"></span></div>
  <div id="overlay">
    <div class="panel">
      <h1 id="overlayTitle">VoxelCraft</h1>
      <p id="overlayHint">Click to play</p>
      <div class="controls">
        <div><b>WASD</b> move, <b>Space</b> jump / swim up, <b>Shift</b> / <b>W W</b> sprint, <b>Ctrl</b> sneak</div>
        <div><b>LMB</b> (hold) break / attack, <b>RMB</b> place block / open door</div>
        <div><b>Wheel / 1-9</b> hotbar slot, <b>E</b> inventory &amp; 2&times;2 craft</div>
        <div><b>RMB (hold) with food</b> eat (watch the hunger bar)</div>
        <div><b>RMB on a workbench</b> 3&times;3 craft, <b>C</b> creative (double <b>Space</b> to fly)</div>
        <div><b>Esc</b> pause</div>
      </div>
      <div class="buttons">
        <button id="btnWorlds" class="accent">Create world</button>
        <button id="btnExport">Export world</button>
        <button id="btnImport">Import world</button>
        <button id="btnNewSeed">New seed</button>
        <button id="btnTutorial">Начать обучение заново</button>
        <button id="btnTutorialToggle">Скрыть подсказки</button>
      </div>
    </div>
  </div>
  <div id="worldScreen" class="hidden">
    <div class="wsPanel">
      <div class="wsHead">
        <button class="wsTab active" data-tab="new">Новый мир</button>
        <button class="wsTab" data-tab="mine">Мои миры</button>
        <button id="wsClose" class="wsClose" title="Закрыть (Esc)">&times;</button>
      </div>
      <div id="wsNew" class="wsBody">
        <div class="wsForm">
          <div class="wsLabel">Картинки-референсы <span class="wsNote">до 4, можно один объект с разных сторон</span></div>
          <div id="wsDrop" class="wsDrop" title="Клик, перетаскивание или Ctrl+V">
            <div id="wsThumbs" class="wsThumbs hidden"></div>
            <span id="wsDropHint">Перетащите картинки, вставьте Ctrl+V или нажмите, чтобы выбрать</span>
          </div>
          <div class="wsRow">
            <label title="ИИ сам поймёт по описанию, что на картинках: объект, который надо построить из блоков, стиль или место">
              <input type="radio" name="wsRead" value="reference" checked /> Образец для ИИ</label>
            <label><input type="radio" name="wsRead" value="topdown" /> Карта сверху</label>
            <label><input type="radio" name="wsRead" value="mood" /> Настроение</label>
            <button id="wsClearImg" class="wsLink hidden">убрать картинки</button>
          </div>
          <label class="wsLabel" for="wsText">Описание</label>
          <textarea id="wsText" rows="3" maxlength="600"
            placeholder="Например: тропический остров, на взлётной полосе стоит самолёт с картинок"></textarea>
          <div class="wsLabel">Размер</div>
          <div class="wsRow">
            <label><input type="radio" name="wsSize" value="island" checked /> Остров 256</label>
            <label><input type="radio" name="wsSize" value="large" /> Большой 512</label>
            <label><input type="radio" name="wsSize" value="infinite" /> Бесконечный</label>
            <label><input type="radio" name="wsSize" value="custom" /> Свой</label>
            <span id="wsCustom" class="hidden">
              <input id="wsW" type="number" min="4" max="48" value="24" /> &times;
              <input id="wsD" type="number" min="4" max="48" value="24" /> чанков
            </span>
          </div>
          <div class="wsLabel">Как строить</div>
          <div class="wsRow">
            <label><input type="radio" name="wsMode" value="local" checked /> Без ИИ</label>
            <label id="wsAiLabel"><input type="radio" name="wsMode" value="ai" disabled /> С ИИ</label>
            <span id="wsAiNote" class="wsNote"></span>
          </div>
          <div class="wsButtons">
            <button id="wsGenerate" class="wsPrimary">Сгенерировать</button>
            <button id="wsLoadSpec">Загрузить рецепт</button>
          </div>
          <div id="wsStatus" class="wsStatus"></div>
        </div>
        <div class="wsPreview">
          <canvas id="wsMap" width="256" height="256"></canvas>
          <div id="wsInfo" class="wsInfo">Здесь появится карта мира</div>
          <div class="wsButtons">
            <button id="wsPlay" class="wsPrimary" disabled>Играть в этом мире</button>
            <button id="wsSaveSpec" disabled>Скачать рецепт</button>
          </div>
        </div>
      </div>
      <div id="wsMine" class="wsBody hidden"><div id="wsList" class="wsList"></div></div>
    </div>
  </div>
`;

/**
 * Сцена + debug-поверхность для агента + тип контента для Мастерской: все смотрят на ОДИН экземпляр
 * игры, который создаётся в `mount()` и обнуляется в `destroy()`. Поэтому они получают не объект, а
 * доступ к текущему `game` — иначе после пересоздания сцены держали бы ссылку на мёртвую игру.
 */
export function createVoxelcraft(opts: GameOptions = {}): {
  scene: EngineScene;
  agent: ModuleAgentApi;
  content: ContentTypeHandler;
  /** The game once the scene is mounted (the room from the lobby may arrive before the first frame). */
  whenGame(): Promise<Game>;
} {
  let game: Game | null = null;
  const waiting: Array<(g: Game) => void> = [];
  const scene = buildScene(
    () => game,
    (next) => {
      game = next;
      if (next) for (const resolve of waiting.splice(0)) resolve(next);
    },
    opts,
  );
  return {
    scene,
    agent: createVoxelcraftAgentApi(() => game),
    content: createVoxelWorldContentType(() => game),
    whenGame: () =>
      game ? Promise.resolve(game) : new Promise<Game>((r) => waiting.push(r)),
  };
}

function buildScene(
  getGame: () => Game | null,
  setGame: (game: Game | null) => void,
  opts: GameOptions,
): EngineScene {
  return {
    surface: "fullbleed-canvas",
    mount(ctx: SceneMountContext): void {
      // The game reads its elements by id from the document; provide them inside the host surface.
      ctx.host.innerHTML = VOXEL_DOM;
      setGame(new Game(opts));
    },
    // The host keeps its loading screen up until the last played world is restored from the
    // player's storage — otherwise the start world flashes first and is swapped a moment later.
    ready(): Promise<void> {
      return getGame()?.restored ?? Promise.resolve();
    },
    activate(): void {
      getGame()?.setRunning(true);
    },
    suspend(): void {
      getGame()?.setRunning(false);
    },
    capture(): Promise<Blob | null> {
      return getGame()?.capture() ?? Promise.resolve(null);
    },
    destroy(): void {
      getGame()?.destroy();
      setGame(null);
    },
  };
}

/** @deprecated Используйте `createVoxelcraft()` — он отдаёт ещё и поверхность для агента. */
export function createVoxelScene(): EngineScene {
  return createVoxelcraft().scene;
}
