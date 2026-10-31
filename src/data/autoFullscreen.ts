// Pantalla completa automática en móvil táctil y reajuste del lienzo (lógica pura; el DOM está en ui/screenFit.ts).

/** Estado que decide si hay que pedir pantalla completa en este toque. */
export interface AutoFsState {
  /** Móvil o tableta sin ratón (touchOnlyDevice). */
  touch: boolean;
  /** El navegador permite pantalla completa (iPhone Safari no). */
  supported: boolean;
  /** Ya está en pantalla completa (o abierto como app instalada). */
  active: boolean;
  /** El jugador la ha desactivado a mano en Ajustes: no se fuerza. */
  optedOut: boolean;
  /** Queda un intento pendiente: al empezar sí, tras pedirla no hasta que se salga de ella. */
  armed: boolean;
}

/** Hay que pedirla solo en táctil, si se puede, si no está ya, si el jugador no la rechazó y queda un intento. */
export function shouldRequestFullscreen(s: AutoFsState): boolean {
  return s.touch && s.supported && !s.active && !s.optedOut && s.armed;
}

/** Tras pedirla se gasta el intento (si falla no se insiste en cada toque). */
export const afterRequest = (): boolean => false;

/** Al salir de pantalla completa se rearma un intento, salvo que el jugador la haya rechazado. */
export const afterLeave = (optedOut: boolean): boolean => !optedOut;

/** Retardos (ms) de las pasadas de reajuste: los navegadores móviles actualizan su tamaño tarde. */
export const REFRESH_DELAYS_MS: readonly number[] = [150, 600];

/** Preferencia guardada: 'off' si el jugador la quitó a mano; cualquier otra cosa, automática. */
export const parseAutoFs = (raw: string | null): boolean => raw !== 'off';
