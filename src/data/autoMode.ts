// «Modo automático» (solo móvil): el juego dispara solo al enemigo más cercano y, en «Completo», también lanza los
// poderes listos y mueve al personaje (IA de data/autoMove.ts). Tocar el joystick de moverse o de apuntar siempre manda
// mientras se use. Lógica pura y guardado en localStorage (con try/catch) para probarla con node --test.

export const AUTO_MODES = ['off', 'shoot', 'full'] as const;
export type AutoMode = (typeof AUTO_MODES)[number];

export const AUTO_MODE_LABEL: Record<AutoMode, string> = { off: 'Desactivado', shoot: 'Solo disparo', full: 'Completo' };
/** Texto corto del indicador del HUD. */
export const AUTO_MODE_SHORT: Record<AutoMode, string> = { off: 'AUTO NO', shoot: 'AUTO: DISPARO', full: 'AUTO' };

export const AUTO_MODE_KEY = 'pokeisaac.autoMode';

export interface AutoModeSetting {
  mode: AutoMode;
  /** Último modo encendido (el botón rápido del HUD vuelve a él). */
  last: Exclude<AutoMode, 'off'>;
}

/** Por defecto: Completo en móvil (fuera de móvil el modo no existe). */
export const DEFAULT_AUTO_MODE: Readonly<AutoModeSetting> = { mode: 'full', last: 'full' };

const isMode = (v: unknown): v is AutoMode => (AUTO_MODES as readonly unknown[]).includes(v);

/** Siguiente valor (o anterior con d = -1), dando la vuelta. */
export function stepAutoMode(m: AutoMode, d = 1): AutoMode {
  const i = AUTO_MODES.indexOf(m);
  const n = AUTO_MODES.length;
  return AUTO_MODES[(((i < 0 ? 0 : i) + Math.sign(d || 1)) % n + n) % n];
}

/** Cambia el modo recordando el último encendido. */
export function withMode(s: AutoModeSetting, mode: AutoMode): AutoModeSetting {
  return { mode, last: mode === 'off' ? s.last : mode };
}

/** Botón rápido del HUD: apaga, o vuelve al último modo encendido. */
export function quickToggle(s: AutoModeSetting): AutoModeSetting {
  return withMode(s, s.mode === 'off' ? s.last : 'off');
}

export function parseAutoMode(raw: string | null): AutoModeSetting {
  const out: AutoModeSetting = { ...DEFAULT_AUTO_MODE };
  if (!raw) return out;
  try {
    const d = JSON.parse(raw) as Partial<AutoModeSetting> | null;
    if (d && typeof d === 'object') {
      if (isMode(d.mode)) out.mode = d.mode;
      const last: unknown = d.last;
      if (isMode(last) && last !== 'off') out.last = last;
      else if ((out.mode as AutoMode) !== 'off') out.last = out.mode as Exclude<AutoMode, 'off'>;
    }
  } catch {
    // corrupto: lo de por defecto
  }
  return out;
}

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const defaultStore = (): Store | undefined => {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
};

export function loadAutoMode(store: Store | undefined = defaultStore()): AutoModeSetting {
  try {
    return parseAutoMode(store?.getItem(AUTO_MODE_KEY) ?? null);
  } catch {
    return { ...DEFAULT_AUTO_MODE };
  }
}

export function saveAutoMode(s: AutoModeSetting, store: Store | undefined = defaultStore()): void {
  try {
    store?.setItem(AUTO_MODE_KEY, JSON.stringify({ mode: s.mode, last: s.last }));
  } catch {
    // sin almacenamiento: solo dura esta sesión
  }
}

/** Modo efectivo: fuera de móvil siempre apagado (teclado, ratón y mando siguen igual). */
export const effectiveAutoMode = (m: AutoMode, mobile: boolean): AutoMode => (mobile ? m : 'off');
export const autoFires = (m: AutoMode): boolean => m !== 'off';
export const autoCasts = (m: AutoMode): boolean => m === 'full';
export const autoMoves = (m: AutoMode): boolean => m === 'full';

/** Alcance del disparo automático (px de mundo): más lejos no se gasta munición al aire. */
export const AUTO_FIRE_RANGE = 900;
/** Alcance para lanzar poderes solos. */
export const AUTO_CAST_RANGE = 620;
/** Separación mínima entre dos poderes automáticos (ms): no se vacían todas las ranuras a la vez. */
export const AUTO_CAST_GAP = 450;
/** Largo mínimo (al cuadrado) de un joystick para que el control manual mande. */
export const MANUAL_STICK_SQ = 0.0225;

/** ¿Manda el jugador? (está empujando ese joystick). */
export const manualOverride = (stickLenSq: number): boolean => stickLenSq > MANUAL_STICK_SQ;

export interface AutoCastInput {
  now: number;
  /** Momento en que cada ranura está lista (las vacías, Infinity o sin movimiento). */
  readyAt: readonly number[];
  /** Ranuras con movimiento. */
  has: readonly boolean[];
  /** Distancia al enemigo más cercano (Infinity si no hay). */
  targetDist: number;
  /** Último poder lanzado solo (ms). */
  lastAutoAt: number;
  range?: number;
  gap?: number;
}

/** Qué ranura lanzar sola ahora (la primera lista), o -1. Respeta recargas (las mismas que a mano). */
export function pickAutoCast(o: AutoCastInput): number {
  if (!(o.targetDist <= (o.range ?? AUTO_CAST_RANGE))) return -1;
  if (o.now - o.lastAutoAt < (o.gap ?? AUTO_CAST_GAP)) return -1;
  for (let i = 0; i < o.readyAt.length; i++) if (o.has[i] && o.now >= o.readyAt[i]) return i;
  return -1;
}
