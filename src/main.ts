import Phaser from 'phaser';
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
import { PauseScene } from './scenes/PauseScene';
import { COLORS, hex, loadThemeFont } from './ui/theme';
import { initAudio, playMusic } from './ui/audio';

// El audio se desbloquea con el primer clic, tecla o botón; la música empieza entonces
initAudio();
playMusic();

// La fuente pixel se carga antes de crear el juego (Phaser no espera a las fuentes al dibujar texto)
void loadThemeFont().then(() => startGame());

function startGame() {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 960,
    height: 640,
    backgroundColor: hex(COLORS.bg),
    physics: { default: 'arcade', arcade: { debug: false } },
    input: { gamepad: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    // La primera escena es la que arranca; añade las nuevas (p. ej. GachaScene) al final
    // PauseScene va la última para dibujarse encima de la partida
    scene: [MenuScene, SlotsScene, StarterScene, GameScene, GachaScene, FirstStarterScene, ModeScene, SettingsScene, PokedexScene, UpgradeScene, PauseScene],
  });
  lockEscapeInFullscreen(game);
  // Para las pruebas de navegador (npm run e2e): saber qué pantalla está activa
  (window as Window & { __POKEISAAC__?: Phaser.Game }).__POKEISAAC__ = game;
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

