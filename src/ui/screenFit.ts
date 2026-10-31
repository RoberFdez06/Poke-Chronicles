import type Phaser from 'phaser';
import { touchOnlyDevice } from '../data/controls';
import { afterLeave, afterRequest, parseAutoFs, REFRESH_DELAYS_MS, shouldRequestFullscreen } from '../data/autoFullscreen';

const KEY = 'pokeisaac.autofs';

type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitFullscreenEnabled?: boolean };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

const doc = document as FsDoc;
const isFs = (): boolean => !!(doc.fullscreenElement ?? doc.webkitFullscreenElement);
const fsSupported = (): boolean => !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
/** Abierto como app instalada: ya es pantalla completa, no hay nada que pedir. */
const installed = (): boolean => {
  try {
    return matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
};

const readOptedOut = (): boolean => {
  try {
    return !parseAutoFs(localStorage.getItem(KEY));
  } catch {
    return false;
  }
};

/** Ajustes: el jugador activa o quita la pantalla completa a mano; si la quita, no se vuelve a forzar. */
export function setAutoFullscreenPref(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // sin almacenamiento: vale solo esta sesión
  }
}

/** Pide pantalla completa (y bloquea en horizontal). Sin soporte o sin gesto, no hace nada. */
export function enterFullscreen() {
  const el = document.documentElement as FsEl;
  try {
    const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen?.();
    void Promise.resolve(p)
      .then(() => lockLandscape())
      .catch(() => undefined);
  } catch {
    // no disponible (p. ej. iPhone)
  }
}

function lockLandscape() {
  try {
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    void o.lock?.('landscape').catch(() => undefined);
  } catch {
    // no disponible
  }
}

export function exitFullscreen() {
  try {
    if (doc.exitFullscreen) void doc.exitFullscreen().catch(() => undefined);
  } catch {
    // no está en pantalla completa
  }
}

/**
 * Pantalla completa automática en móvil táctil (en el primer toque; si se sale, en el siguiente toque) y reajuste
 * del lienzo cuando cambia el tamaño real (girar, barra del navegador, volver de la ventana de Google).
 */
export function installScreenFit(game: Phaser.Game) {
  // --- B: reajuste del lienzo, con dos pasadas porque el móvil actualiza el tamaño tarde
  let timers: number[] = [];
  const refresh = () => {
    timers.forEach((t) => clearTimeout(t));
    timers = REFRESH_DELAYS_MS.map((ms) => window.setTimeout(() => game.scale.refresh(), ms));
  };
  window.addEventListener('resize', refresh);
  window.addEventListener('orientationchange', refresh);
  window.addEventListener('focus', refresh);
  window.addEventListener('pageshow', refresh);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
  window.visualViewport?.addEventListener('resize', refresh);

  // --- A: pantalla completa automática, solo en táctil
  if (!touchOnlyDevice()) return;
  let armed = true;
  const onGesture = () => {
    const optedOut = readOptedOut();
    const active = isFs() || installed();
    if (!shouldRequestFullscreen({ touch: true, supported: fsSupported(), active, optedOut, armed })) return;
    armed = afterRequest();
    enterFullscreen();
  };
  // Pedir pantalla completa exige un gesto "de activación": en táctil son pointerup/touchend
  window.addEventListener('pointerup', onGesture, true);
  window.addEventListener('touchend', onGesture, true);
  const onChange = () => {
    if (!isFs()) armed = afterLeave(readOptedOut());
    refresh();
  };
  document.addEventListener('fullscreenchange', onChange);
  document.addEventListener('webkitfullscreenchange', onChange);
}
