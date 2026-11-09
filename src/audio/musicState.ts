// Lógica pura del estado de la música (sin Web Audio ni Phaser): qué situación suena, con qué retardos
// y cómo se reparte el volumen en un crossfade. ui/audio.ts y GameScene solo la usan.

/** Situación musical: jefe final, jefe, minijefe, combate o la del bioma. */
export type MusicMood = 'final' | 'boss' | 'mini' | 'combat' | 'calm';

/** Entrar en combate (o subir de intensidad) casi enseguida: filtra un solo fotograma, no un cambio real. */
export const MUSIC_ENTER_MS = 450;
/** Salir de combate: espera tras limpiar la sala para no parpadear con puertas ni oleadas seguidas. */
export const MUSIC_EXIT_MS = 2800;
/** Duración del crossfade entre pistas. */
export const CROSSFADE_S = 1.5;
/** Si una pista vuelve a sonar antes de este tiempo, se reanuda donde iba en vez de empezar de cero. */
export const RESUME_WINDOW_MS = 20000;

const RANK: Record<MusicMood, number> = { calm: 0, combat: 1, mini: 2, boss: 3, final: 4 };

/** Retardo para pasar de `from` a `to`: corto si sube la intensidad, largo si baja. */
export const moodDelay = (from: MusicMood, to: MusicMood): number => (RANK[to] > RANK[from] ? MUSIC_ENTER_MS : MUSIC_EXIT_MS);

export interface MoodState {
  /** Situación que suena ahora. */
  mood: MusicMood;
  /** Situación candidata que aún no ha aguantado su retardo (null si no hay). */
  pending: MusicMood | null;
  /** Instante (ms) en que apareció la candidata. */
  since: number;
}

export const initialMood = (mood: MusicMood = 'calm'): MoodState => ({ mood, pending: null, since: 0 });

/**
 * Un paso de histéresis: `desired` es lo que piden los enemigos ahora mismo. Solo cambia `mood` si `desired`
 * se mantiene (sin interrupciones) durante `moodDelay`. Si vuelve a lo actual, la candidata se descarta.
 * Devuelve el estado nuevo y si `mood` cambió.
 */
export function stepMood(s: MoodState, desired: MusicMood, now: number): { state: MoodState; changed: boolean } {
  if (desired === s.mood) return { state: s.pending === null ? s : { ...s, pending: null }, changed: false };
  if (s.pending !== desired) return { state: { ...s, pending: desired, since: now }, changed: false };
  if (now - s.since >= moodDelay(s.mood, desired)) return { state: { mood: desired, pending: null, since: now }, changed: true };
  return { state: s, changed: false };
}

/** Fuerza una situación al instante (el jefe aparece con su intro y su pista propia). */
export const forceMood = (mood: MusicMood, now: number): MoodState => ({ mood, pending: null, since: now });

/** Volumen (0..1) de la pista que entra y de la que sale a los `t` segundos de un crossfade de `dur`; potencia constante. */
export function crossfadeGains(t: number, dur = CROSSFADE_S): { inGain: number; outGain: number } {
  const k = dur <= 0 ? 1 : Math.max(0, Math.min(1, t / dur));
  return { inGain: Math.sin((k * Math.PI) / 2), outGain: Math.cos((k * Math.PI) / 2) };
}

/** Paso desde el que arranca una pista: reanuda donde iba si hace poco que dejó de sonar, si no desde el principio. */
export function resumeStep(lastStep: number, silentMs: number, length: number): number {
  if (length <= 0 || lastStep <= 0) return 0;
  return silentMs <= RESUME_WINDOW_MS ? lastStep % length : 0;
}

/** ¿El contexto está parado y hay que reanudarlo? (`interrupted` es el estado de iOS tras una llamada o al volver de otra app) */
export function needsResume(state: string): boolean {
  return state === 'suspended' || state === 'interrupted';
}

/**
 * Frecuencia de un filtro dentro de su rango válido (0 a la mitad de la frecuencia de muestreo, Nyquist). El navegador
 * ya la recorta así (suena igual), pero avisa en consola con cada nota («outside nominal range»).
 */
export const filterFreq = (f: number, sampleRate: number): number => Math.min(Math.max(f, 0), sampleRate / 2);
