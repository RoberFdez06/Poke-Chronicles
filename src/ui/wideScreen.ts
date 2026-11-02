// Pantallas anchas en escritorio (ver data/wideLayout.ts): ancho del lienzo según la ventana, y al redimensionar
// (o entrar/salir de pantalla completa) se cambia en vivo y se recolocan las escenas activas sin reiniciarlas.
import Phaser from 'phaser';
import { touchOnlyDevice } from '../data/controls';
import { logicalWidth } from '../data/wideLayout';
import { fitDesign, H, LW, OFF, setLogicalWidth, U } from './layout';

/** Evento del juego (game.events) tras cambiar el ancho lógico. */
export const WIDE_RESIZED = 'wide-resized';

/** Escena que se recoloca ella misma (la partida: sala y cámaras del HUD). */
interface WideAware {
  relayoutWide(): void;
}

function parentBox(): { w: number; h: number } {
  const el = document.getElementById('game');
  const r = el?.getBoundingClientRect();
  const w = r && r.width > 0 ? r.width : window.innerWidth;
  const h = r && r.height > 0 ? r.height : window.innerHeight;
  return { w, h };
}

/** Ancho lógico para la ventana actual (antes de crear el juego). */
export function initialWideWidth(): number {
  const { w, h } = parentBox();
  const lw = logicalWidth(w, h, touchOnlyDevice());
  setLogicalWidth(lw);
  return lw;
}

/** Recoloca una escena activa al nuevo ancho. */
export function relayoutScene(scene: Phaser.Scene) {
  const s = scene as Phaser.Scene & Partial<WideAware>;
  if (typeof s.relayoutWide === 'function') {
    s.relayoutWide();
    return;
  }
  const cam = scene.cameras?.main;
  if (!cam) return;
  if (Math.abs(cam.zoom - U) < 1e-6) fitDesign(scene);
  else {
    // Escenas en coordenadas reales (intros): el diseño de 1920 centrado
    cam.setViewport(0, 0, LW, H);
    cam.setScroll(-OFF, cam.scrollY);
  }
}

export function installWideScreen(game: Phaser.Game) {
  if (touchOnlyDevice()) return;
  let timer = 0;
  const apply = () => {
    const { w, h } = parentBox();
    const lw = logicalWidth(w, h, false);
    if (lw === LW && game.scale.gameSize.width === lw) return;
    setLogicalWidth(lw);
    game.scale.setGameSize(lw, H);
    for (const scene of game.scene.getScenes(true)) relayoutScene(scene);
    game.events.emit(WIDE_RESIZED, lw);
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = window.setTimeout(apply, 80);
  };
  window.addEventListener('resize', schedule);
  document.addEventListener('fullscreenchange', schedule);
  // Las escenas que arrancan después ya leen el ancho nuevo
  game.events.once(Phaser.Core.Events.READY, apply);
}
