import Phaser from 'phaser';
import { TOUCH_INTERRUPT } from './touchSanity';

/**
 * Llama a `f` cuando la ventana o la pestaña pierden el foco (blur de la ventana o pestaña oculta), para abrir la pausa.
 * En móvil también al girar a vertical (`TOUCH_INTERRUPT`, ui/touchSanity.ts). Se desengancha sola al cerrarse la
 * escena. No toca el teclado, el ratón ni el mando: solo avisa.
 */
export function onFocusLost(scene: Phaser.Scene, f: () => void) {
  const ev = scene.game.events;
  ev.on(Phaser.Core.Events.BLUR, f);
  ev.on(Phaser.Core.Events.HIDDEN, f);
  ev.on(TOUCH_INTERRUPT, f);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    ev.off(Phaser.Core.Events.BLUR, f);
    ev.off(Phaser.Core.Events.HIDDEN, f);
    ev.off(TOUCH_INTERRUPT, f);
  });
}
