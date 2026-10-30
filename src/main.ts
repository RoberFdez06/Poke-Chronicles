import Phaser from 'phaser';
import { TitleScene } from './scenes/TitleScene';
import { MenuScene } from './scenes/MenuScene';
import { StarterScene } from './scenes/StarterScene';
import { GameScene } from './scenes/GameScene';
import { GachaScene } from './scenes/GachaScene';
import { SlotsScene } from './scenes/SlotsScene';
import { FirstStarterScene } from './scenes/FirstStarterScene';
import { ModeScene } from './scenes/ModeScene';
import { SettingsScene } from './scenes/SettingsScene';
import { PokedexScene } from './scenes/PokedexScene';
import { UpgradeScene } from './scenes/UpgradeScene';
import { MissionsScene } from './scenes/MissionsScene';
import { GardenScene } from './scenes/GardenScene';
import { RunDexScene } from './scenes/RunDexScene';
import { SummaryScene } from './scenes/SummaryScene';
import { HistoryScene } from './scenes/HistoryScene';
import { KeysScene } from './scenes/KeysScene';
import { ControlsScene } from './scenes/ControlsScene';
import { SecondChanceScene } from './scenes/SecondChanceScene';
import { PauseScene } from './scenes/PauseScene';
import { AccountScene } from './scenes/AccountScene';
import { BossIntroScene } from './scenes/BossIntroScene';
import { GymPuzzleScene } from './scenes/GymPuzzleScene';
import { FloorIntroScene } from './scenes/FloorIntroScene';
import { FinalPromptScene } from './scenes/FinalPromptScene';
import { RouteScene } from './scenes/RouteScene';
import { SlotSwapScene } from './scenes/SlotSwapScene';
import { ItemChoiceScene } from './scenes/ItemChoiceScene';
import { ConfirmScene } from './scenes/ConfirmScene';
import { PadLegendScene } from './scenes/PadLegendScene';
import { SeedCodeScene } from './scenes/SeedCodeScene';
import { TowerDefenseMenuScene } from './scenes/TowerDefenseMenuScene';
import { TowerDefenseScene } from './scenes/TowerDefenseScene';
import { AdminScene } from './scenes/AdminScene';
import { trackInput } from './ui/inputMode';
import { COLORS, hex, loadThemeFont, setLowFxProbe } from './ui/theme';
import { loadFx } from './data/save';
import { initAudio, playMusic, reloadAudioSettings } from './ui/audio';
import { initAccount } from './net/cloud';
import { refreshControls, touchOnlyDevice } from './data/controls';
import { boostedSize, mobileUi, parseFontPx, setMobileUi, viewportCssPerPx } from './ui/uiScale';
import { H, U, W } from './ui/layout';
import { PLACEHOLDER_SPRITE } from './data/offline';
import { installErrorScreen } from './ui/errorScreen';

// T30: los menús se escalan ×1,6875 desde su diseño de 960×640; para que el texto no se vea borroso, todos los
// textos se generan a doble resolución (Phaser los rasteriza en un canvas aparte).
const TEXT_RESOLUTION = Math.ceil(U);
const makeText = Phaser.GameObjects.GameObjectFactory.prototype.text;
Phaser.GameObjects.GameObjectFactory.prototype.text = function (this: Phaser.GameObjects.GameObjectFactory, ...args: Parameters<typeof makeText>) {
  // Modo móvil: las letras pequeñas se agrandan (con tope) para que se lean; en escritorio no cambia nada
  if (mobileUi() && args[3]) {
    const px = parseFontPx(args[3].fontSize);
    if (px !== null) {
      const size = boostedSize(px, viewportCssPerPx());
      if (size !== px) args[3] = { ...args[3], fontSize: `${size}px` };
    }
  }
  return makeText.apply(this, args).setResolution(TEXT_RESOLUTION);
};

// T42: si una imagen no carga (sin conexión o servidor caído), se pone la Poké Ball genérica con la misma clave,
// así ninguna pantalla se queda sin sprite. Vale para todas las escenas.
const loadImage = Phaser.Loader.LoaderPlugin.prototype.image;
Phaser.Loader.LoaderPlugin.prototype.image = function (this: Phaser.Loader.LoaderPlugin & { offlineHook?: boolean }, ...args: Parameters<typeof loadImage>) {
  if (!this.offlineHook) {
    this.offlineHook = true;
    this.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      if (file.type !== 'image' || typeof file.key !== 'string' || String(file.url).endsWith(PLACEHOLDER_SPRITE)) return;
      console.warn(`[Poké Chronicles] imagen sin cargar, uso la genérica: ${file.key}`);
      loadImage.call(this, file.key, PLACEHOLDER_SPRITE);
    });
  }
  return loadImage.apply(this, args);
};

// T42: caché persistente de PokeAPI, sprites y gritos (sirve lo ya visto al instante y sin conexión)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('sw.js').catch(() => undefined));
}

// El audio se desbloquea con el primer clic, tecla o botón; la música empieza entonces
initAudio();
playMusic();

// La fuente pixel se carga antes de crear el juego (Phaser no espera a las fuentes al dibujar texto). A la vez se
// decide dónde se guarda (T45): invitado (memoria), cuenta (nube) o pruebas (navegador); luego se releen el
// volumen y las teclas de ese almacenamiento.
// Efectos bajos (N21): fundidos y fondos animados de los menús se apagan
setLowFxProbe(() => loadFx().low);

void Promise.all([loadThemeFont(), initAccount()]).then(() => {
  reloadAudioSettings();
  refreshControls();
  startGame();
});

function startGame() {
  trackInput();
  // Modo móvil (letra mínima y filas de menú más fáciles de tocar): solo en móvil o tableta táctil
  setMobileUi(touchOnlyDevice());
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: W,
    height: H,
    backgroundColor: hex(COLORS.bg),
    physics: { default: 'arcade', arcade: { debug: false } },
    input: { gamepad: true },
    // Una imagen que tarda más de 8 s cuenta como fallida (y se usa la genérica)
    loader: { timeout: 8000 },
    // 16:9: en pantallas 16:9 llena la ventana; en otras deja bandas
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    // La primera escena es la que arranca; añade las nuevas (p. ej. GachaScene) al final
    // PauseScene va la última para dibujarse encima de la partida
    scene: [TitleScene, MenuScene, SlotsScene, StarterScene, GameScene, GachaScene, FirstStarterScene, ModeScene, SettingsScene, PokedexScene, UpgradeScene, MissionsScene, GardenScene, RunDexScene, SummaryScene, HistoryScene, KeysScene, BossIntroScene, GymPuzzleScene, FloorIntroScene, FinalPromptScene, RouteScene, SlotSwapScene, ItemChoiceScene, ConfirmScene, ControlsScene, SecondChanceScene, SeedCodeScene, PauseScene, AccountScene, PadLegendScene, TowerDefenseMenuScene, TowerDefenseScene, AdminScene],
  });
  lockEscapeInFullscreen(game);
  // T43: un error no deja el juego colgado: pantalla "Algo ha fallado" con vuelta al menú
  installErrorScreen(game);
  // Para las pruebas de navegador (npm run e2e): saber qué pantalla está activa
  (window as Window & { __POKEISAAC__?: Phaser.Game }).__POKEISAAC__ = game;
  // Barra con los botones del mando, siempre encima de los menús
  game.events.once(Phaser.Core.Events.READY, () => game.scene.start('PadLegend'));
}

/**
 * En pantalla completa el navegador usa Esc para salir y el juego no lo recibe. En Chrome y Edge,
 * `navigator.keyboard.lock` deja que Esc llegue al juego (para salir de pantalla completa hay que mantenerlo pulsado).
 */
function lockEscapeInFullscreen(game: Phaser.Game) {
  type KeyboardLock = { lock?: (codes: string[]) => Promise<void>; unlock?: () => void };
  const kb = (navigator as Navigator & { keyboard?: KeyboardLock }).keyboard;
  if (!kb?.lock) return;
  game.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, () => void kb.lock!(['Escape']).catch(() => undefined));
  game.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, () => kb.unlock?.());
}

