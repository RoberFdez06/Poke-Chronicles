// Pantalla de error (T43): en vez de quedarse colgado, un cuadro "Algo ha fallado" con el mensaje, "Volver al menú"
// y "Copiar detalles". Es HTML encima del juego porque un error dentro de una escena para el bucle de Phaser.
// Teclado (flechas/Tab, Enter, Esc), ratón y mando (cruceta, A, B). El guardado no se toca.
import Phaser from 'phaser';
import { errorDetails, isBenignError, shortMessage } from '../data/errorReport';
import { COLORS, FONT, hex } from './theme';

let open = false;

/** Engancha los errores globales (window.onerror y promesas sin capturar) a la pantalla de error. */
export function installErrorScreen(game: Phaser.Game) {
  window.addEventListener('error', (e) => handle(game, e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => handle(game, e.reason));
}

function activeScenes(game: Phaser.Game): string[] {
  try {
    return game.scene.getScenes(true).map((s) => s.scene.key);
  } catch {
    return [];
  }
}

/** Saca la pantalla de error para un fallo que el juego ha capturado (p. ej. al cargar la partida). */
export const reportError = (game: Phaser.Game, err: unknown) => handle(game, err);

function handle(game: Phaser.Game, err: unknown) {
  if (isBenignError(err)) return;
  const details = errorDetails(err, {
    scenes: activeScenes(game),
    url: location.href,
    userAgent: navigator.userAgent,
    when: new Date().toISOString(),
  });
  console.error(`[PokeIsaac] ${details}`);
  if (open) return;
  showErrorScreen(game, shortMessage(err), details);
}

/** Vuelve a arrancar el bucle del juego, para las pantallas que hubiera y abre el menú. */
function backToMenu(game: Phaser.Game) {
  try {
    // Si el error fue dentro de un fotograma, el bucle se quedó parado: dormirlo y despertarlo lo reanuda
    game.loop.sleep();
    game.loop.wake();
    for (const key of activeScenes(game)) game.scene.stop(key);
    game.scene.start('Menu');
  } catch {
    location.reload();
  }
}

export function showErrorScreen(game: Phaser.Game, message: string, details: string) {
  open = true;
  const navy = hex(COLORS.navy);
  const overlay = document.createElement('div');
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-label', 'Algo ha fallado');
  overlay.style.cssText = `position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;
    background:rgba(13,20,37,.82);font-family:${FONT},monospace;padding:16px;box-sizing:border-box;`;
  const box = document.createElement('div');
  box.style.cssText = `background:${hex(COLORS.panel)};color:${navy};border:6px solid ${navy};outline:4px solid ${hex(COLORS.frame)};
    outline-offset:-10px;border-radius:6px;max-width:640px;width:100%;padding:28px 32px;box-sizing:border-box;text-align:center;`;
  const title = document.createElement('div');
  title.textContent = 'Algo ha fallado';
  title.style.cssText = 'font-size:32px;font-weight:bold;margin-bottom:12px;';
  const msg = document.createElement('div');
  msg.textContent = message;
  msg.style.cssText = 'font-size:16px;opacity:.85;margin-bottom:8px;word-break:break-word;';
  const note = document.createElement('div');
  note.textContent = 'Tu progreso guardado no se ha tocado.';
  note.style.cssText = 'font-size:14px;opacity:.7;margin-bottom:22px;';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:16px;justify-content:center;flex-wrap:wrap;';
  const button = (label: string) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = `font-family:inherit;font-size:18px;font-weight:bold;padding:12px 22px;border:4px solid ${navy};
      background:${hex(COLORS.panel)};color:${navy};border-radius:4px;cursor:pointer;min-width:200px;`;
    return b;
  };
  const menuBtn = button('Volver al menú');
  const copyBtn = button('Copiar detalles');
  const hint = document.createElement('div');
  hint.textContent = 'Flechas, ratón o mando · Enter o A para elegir · Esc o B: volver al menú';
  hint.style.cssText = 'font-size:12px;opacity:.6;margin-top:18px;';
  row.append(menuBtn, copyBtn);
  box.append(title, msg, note, row, hint);
  overlay.append(box);
  document.body.append(overlay);

  const buttons = [menuBtn, copyBtn];
  let focus = 0;
  const paint = () =>
    buttons.forEach((b, k) => {
      b.style.background = k === focus ? hex(COLORS.gold) : hex(COLORS.panel);
      if (k === focus) b.focus({ preventScroll: true });
    });
  const move = (d: number) => {
    focus = (focus + d + buttons.length) % buttons.length;
    paint();
  };
  const close = () => {
    open = false;
    window.removeEventListener('keydown', onKey, true);
    clearInterval(padTimer);
    overlay.remove();
    backToMenu(game);
  };
  const copy = () => {
    const done = () => (copyBtn.textContent = '¡Copiado!');
    navigator.clipboard?.writeText(details).then(done, () => (copyBtn.textContent = 'No se pudo copiar'));
  };
  const activate = () => (focus === 0 ? close() : copy());
  menuBtn.addEventListener('click', close);
  copyBtn.addEventListener('click', copy);
  buttons.forEach((b, k) => b.addEventListener('mouseenter', () => ((focus = k), paint())));

  // Teclado: lo atrapamos antes que Phaser para que no llegue al juego
  const onKey = (e: KeyboardEvent) => {
    const k = e.key;
    if (['ArrowLeft', 'ArrowUp', 'a', 'w'].includes(k)) move(-1);
    else if (['ArrowRight', 'ArrowDown', 'd', 's', 'Tab'].includes(k)) move(e.shiftKey && k === 'Tab' ? -1 : 1);
    else if (k === 'Enter' || k === ' ') activate();
    else if (k === 'Escape' || k === 'Backspace') close();
    else return;
    e.preventDefault();
    e.stopPropagation();
  };
  window.addEventListener('keydown', onKey, true);

  // Mando: se lee aquí porque el bucle de Phaser puede estar parado
  let prev: boolean[] = [];
  let first = true;
  const padTimer = window.setInterval(() => {
    const pad = navigator.getGamepads?.().find((p) => p && p.connected);
    if (!pad) return;
    const now = [0, 1, 12, 13, 14, 15].map((i) => !!pad.buttons[i]?.pressed);
    const axis = pad.axes[0] ?? 0;
    // Lo que ya estaba pulsado al abrir no cuenta
    if (!first) {
      const edge = (k: number) => now[k] && !prev[k];
      if (edge(0)) activate();
      else if (edge(1)) close();
      else if (edge(2) || edge(4)) move(-1);
      else if (edge(3) || edge(5)) move(1);
    }
    if (Math.abs(axis) > 0.6 && !first && !prev[6]) move(axis > 0 ? 1 : -1);
    prev = [...now, Math.abs(axis) > 0.6];
    first = false;
  }, 60);

  paint();
}
