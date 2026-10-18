import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene';
import { StarterScene } from './scenes/StarterScene';
import { GameScene } from './scenes/GameScene';
import { GachaScene } from './scenes/GachaScene';
import { SlotsScene } from './scenes/SlotsScene';
import { PauseScene } from './scenes/PauseScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 640,
  backgroundColor: '#172036',
  physics: { default: 'arcade', arcade: { debug: false } },
  input: { gamepad: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  // La primera escena es la que arranca; añade las nuevas (p. ej. GachaScene) al final
  // PauseScene va la última para dibujarse encima de la partida
  scene: [MenuScene, SlotsScene, StarterScene, GameScene, GachaScene, PauseScene],
});
