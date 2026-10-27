import Phaser from 'phaser';

/**
 * Llama a `f` cuando la ventana o la pestaña pierden el foco (blur de la ventana o pestaña oculta), para abrir la pausa.
 * Se desengancha sola al cerrarse la escena. No toca el teclado, el ratón ni el mando: solo avisa.
 */
export function onFocusLost(scene: Phaser.Scene, f: () => void) {
  const ev = scene.game.events;
  ev.on(Phaser.Core.Events.BLUR, f);
  ev.on(Phaser.Core.Events.HIDDEN, f);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    ev.off(Phaser.Core.Events.BLUR, f);
    ev.off(Phaser.Core.Events.HIDDEN, f);
  });
}
