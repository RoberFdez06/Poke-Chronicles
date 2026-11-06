// Seguro global de toques (rama `movil`, 2026-11-06), solo en móvil o tableta táctil (data/controls.ts
// `touchOnlyDevice`). Phaser guarda un puntero por dedo y solo lo libera con su touchend/touchcancel: si el navegador
// se lo come (deslizar desde el borde, notificación, multitarea de iOS, 4-5 dedos en iPad, barra que aparece), ese
// puntero se queda «pulsado» para siempre y, con 5 perdidos, ningún toque nuevo llega al juego. Aquí, en cada evento
// táctil de la página (fase de captura, antes que Phaser), los punteros activos cuyo dedo ya no está en la lista real
// `touches` se cancelan por el camino normal de Phaser (pointerup con wasCanceled en las escenas). Y al girar a
// vertical (aviso «Gira el móvil» de index.html) se cancelan todos y se avisa a las escenas para que pausen.
import type Phaser from 'phaser';
import { ghostTouches, noFingersLeft } from '../data/touchPointers';

/** Evento de `game.events`: el jugador no puede seguir tocando la partida (vertical): las escenas abren su pausa. */
export const TOUCH_INTERRUPT = 'touch-interrupt';

/** El mismo criterio que el aviso `#rotate` de index.html. */
const PORTRAIT_QUERY = '(orientation: portrait) and (pointer: coarse) and (max-width: 1100px)';

type Mgr = Phaser.Input.InputManager & { onTouchCancel(e: unknown): void };

/** Cancela en Phaser los punteros táctiles de `ids` (identificadores de Touch) sin moverlos de donde estaban. */
function cancelPointers(game: Phaser.Game, ids: readonly number[], timeStamp: number) {
  const mgr = game.input as Mgr | undefined;
  if (!mgr || ids.length === 0) return;
  const canvas = game.canvas;
  const rect = canvas.getBoundingClientRect();
  const sx = rect.width > 0 ? rect.width / (game.scale.width || 1) : 1;
  const changedTouches = mgr.pointers
    .filter((p) => p.active && p.wasTouch !== false && ids.includes(p.identifier))
    .map((p) => ({
      identifier: p.identifier,
      // Mismo sitio en la página que su última posición (Phaser vuelve a pasarlo a coordenadas del juego)
      pageX: rect.left + window.scrollX + p.x * sx,
      pageY: rect.top + window.scrollY + p.y * sx,
      target: canvas,
    }));
  if (changedTouches.length === 0) return;
  try {
    mgr.onTouchCancel({ changedTouches, timeStamp, type: 'touchcancel', defaultPrevented: false });
  } catch {
    // Si Phaser cambia por dentro, al menos se sueltan a mano
    for (const p of mgr.pointers) {
      if (!ids.includes(p.identifier) || !p.active) continue;
      p.isDown = false;
      p.active = false;
      p.buttons = 0;
    }
  }
}

/** Ids de los punteros táctiles que Phaser tiene activos. */
const activeTouchIds = (game: Phaser.Game): number[] => (game.input?.pointers ?? []).filter((p) => p.active && p.id > 0).map((p) => p.identifier);

export function installTouchSanity(game: Phaser.Game) {
  if (typeof window === 'undefined') return;
  const ids = (l: TouchList) => Array.from({ length: l.length }, (_, i) => l[i].identifier);
  const onTouch = (e: TouchEvent) => {
    const live = ids(e.touches);
    const changed = ids(e.changedTouches);
    // Sin dedos tras este evento: todo lo que Phaser tenga activo y no sea de este evento sobra
    const ghosts = ghostTouches(activeTouchIds(game), noFingersLeft(e.type, live.length) ? [] : live, changed);
    cancelPointers(game, ghosts, e.timeStamp);
  };
  for (const ev of ['touchstart', 'touchend', 'touchcancel'] as const) window.addEventListener(ev, onTouch, { capture: true, passive: true });
  // Cambiar de app, bloquear o girar: Phaser no recibe los touchend de los dedos que había
  const all = () => cancelPointers(game, activeTouchIds(game), performance.now());
  window.addEventListener('pagehide', all);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && all());
  try {
    const mq = matchMedia(PORTRAIT_QUERY);
    const onTurn = () => {
      all();
      if (mq.matches) game.events.emit(TOUCH_INTERRUPT);
    };
    mq.addEventListener?.('change', onTurn);
    window.addEventListener('orientationchange', () => window.setTimeout(onTurn, 50));
  } catch {
    // matchMedia sin addEventListener (navegadores viejos): queda el touchcancel normal
  }
}
