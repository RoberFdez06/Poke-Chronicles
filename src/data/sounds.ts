// Efectos de sonido y música descritos como datos: se generan con Web Audio (src/ui/audio.ts), sin archivos
// con derechos. Lógica pura, sin navegador, para poder testearla.

export type Wave = 'square' | 'triangle' | 'sawtooth' | 'sine' | 'noise';

/** Un tono: frecuencia (Hz), duración y retardo (s), forma de onda, volumen (0-1) y deslizamiento opcional. */
export interface Tone {
  freq: number;
  dur: number;
  wave: Wave;
  gain: number;
  delay?: number;
  /** Frecuencia a la que llega al final (para "piu" y "bum"). */
  slideTo?: number;
}

export const SFX_NAMES = ['shot', 'hit', 'pickup', 'coin', 'door', 'clear', 'hurt', 'buy', 'select', 'heal', 'boom'] as const;
export type SfxName = (typeof SFX_NAMES)[number];

export const SFX: Readonly<Record<SfxName, readonly Tone[]>> = {
  shot: [{ freq: 880, slideTo: 440, dur: 0.07, wave: 'square', gain: 0.12 }],
  hit: [{ freq: 220, slideTo: 90, dur: 0.08, wave: 'noise', gain: 0.25 }],
  pickup: [
    { freq: 523, dur: 0.07, wave: 'square', gain: 0.18 },
    { freq: 659, dur: 0.07, wave: 'square', gain: 0.18, delay: 0.07 },
    { freq: 784, dur: 0.12, wave: 'square', gain: 0.18, delay: 0.14 },
  ],
  coin: [
    { freq: 988, dur: 0.05, wave: 'square', gain: 0.15 },
    { freq: 1319, dur: 0.12, wave: 'square', gain: 0.15, delay: 0.05 },
  ],
  door: [{ freq: 140, slideTo: 60, dur: 0.18, wave: 'triangle', gain: 0.35 }],
  clear: [
    { freq: 523, dur: 0.1, wave: 'triangle', gain: 0.3 },
    { freq: 659, dur: 0.1, wave: 'triangle', gain: 0.3, delay: 0.1 },
    { freq: 784, dur: 0.1, wave: 'triangle', gain: 0.3, delay: 0.2 },
    { freq: 1047, dur: 0.3, wave: 'triangle', gain: 0.3, delay: 0.3 },
  ],
  hurt: [{ freq: 300, slideTo: 120, dur: 0.2, wave: 'sawtooth', gain: 0.2 }],
  buy: [
    { freq: 784, dur: 0.06, wave: 'square', gain: 0.15 },
    { freq: 1175, dur: 0.16, wave: 'square', gain: 0.15, delay: 0.06 },
  ],
  select: [{ freq: 660, dur: 0.04, wave: 'square', gain: 0.1 }],
  boom: [
    { freq: 160, slideTo: 40, dur: 0.5, wave: 'noise', gain: 0.4 },
    { freq: 90, slideTo: 40, dur: 0.4, wave: 'triangle', gain: 0.35 },
  ],
  heal: [
    { freq: 659, dur: 0.12, wave: 'sine', gain: 0.25 },
    { freq: 880, dur: 0.12, wave: 'sine', gain: 0.25, delay: 0.12 },
    { freq: 1319, dur: 0.25, wave: 'sine', gain: 0.25, delay: 0.24 },
  ],
};

/** Duración total de un efecto (s). */
export const sfxLength = (tones: readonly Tone[]): number => Math.max(0, ...tones.map((t) => (t.delay ?? 0) + t.dur));

/** Nota MIDI → frecuencia (69 = La 440 Hz). */
export const midiToFreq = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

/**
 * Música de fondo: un bucle sencillo de melodía y bajo, al estilo de las consolas portátiles. Cada paso dura
 * una corchea; null es silencio. Compuesta para el juego (sin derechos de terceros).
 */
export const MUSIC = {
  bpm: 132,
  melody: [
    72, null, 76, 79, 77, null, 76, 74, 72, null, 69, 71, 72, null, null, null,
    74, null, 77, 81, 79, null, 77, 76, 74, null, 71, 72, 74, null, null, null,
  ] as (number | null)[],
  bass: [
    48, null, 55, null, 53, null, 55, null, 48, null, 55, null, 53, null, 52, null,
    50, null, 57, null, 55, null, 57, null, 50, null, 55, null, 43, null, 47, null,
  ] as (number | null)[],
};

/** Segundos que dura cada paso (corchea) a este tempo. */
export const stepSeconds = (bpm: number): number => 60 / bpm / 2;

// --- Volumen (se guarda en save.ts) ---

export interface AudioSettings {
  /** 0 = sin sonido, 1 = máximo. */
  music: number;
  sfx: number;
}

export const DEFAULT_AUDIO: Readonly<AudioSettings> = { music: 0.5, sfx: 0.8 };

const clamp01 = (v: unknown, def: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : def);

export function parseAudio(raw: string | null): AudioSettings {
  if (!raw) return { ...DEFAULT_AUDIO };
  try {
    const d = JSON.parse(raw) as Partial<AudioSettings>;
    return { music: clamp01(d?.music, DEFAULT_AUDIO.music), sfx: clamp01(d?.sfx, DEFAULT_AUDIO.sfx) };
  } catch {
    return { ...DEFAULT_AUDIO };
  }
}

/** Sube o baja un volumen en pasos de 10 %, sin salirse de 0-1 (para los ajustes). */
export const stepVolume = (v: number, d: number): number => Math.round(Math.min(1, Math.max(0, v + d * 0.1)) * 10) / 10;
