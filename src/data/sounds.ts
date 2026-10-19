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

export const SHOT_TYPES = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'] as const;
export const SFX_NAMES = [
  'shot', 'hit', 'pickup', 'coin', 'door', 'clear', 'hurt', 'buy', 'select', 'heal', 'boom',
  // Nuevos: jefe, evolución, cofres, puertas de Gimnasio, trampilla, crítico y mejoras
  'roar', 'enrage', 'evolve', 'levelup', 'chest', 'gymOpen', 'gymClose', 'fall', 'crit', 'warn', 'summon', 'faint', 'record',
  ...SHOT_TYPES.map((t) => `shot_${t}` as const),
] as const;
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
  roar: [
    { freq: 110, slideTo: 55, dur: 0.55, wave: 'sawtooth', gain: 0.3 },
    { freq: 70, slideTo: 35, dur: 0.6, wave: 'square', gain: 0.18, delay: 0.05 },
    { freq: 200, slideTo: 60, dur: 0.4, wave: 'noise', gain: 0.25 },
  ],
  enrage: [
    { freq: 90, slideTo: 180, dur: 0.35, wave: 'sawtooth', gain: 0.3 },
    { freq: 180, slideTo: 60, dur: 0.5, wave: 'sawtooth', gain: 0.3, delay: 0.35 },
    { freq: 300, slideTo: 80, dur: 0.6, wave: 'noise', gain: 0.3, delay: 0.3 },
  ],
  evolve: [
    { freq: 392, dur: 0.12, wave: 'triangle', gain: 0.3 },
    { freq: 440, dur: 0.12, wave: 'triangle', gain: 0.3, delay: 0.1 },
    { freq: 494, dur: 0.12, wave: 'triangle', gain: 0.3, delay: 0.2 },
    { freq: 523, dur: 0.12, wave: 'triangle', gain: 0.3, delay: 0.3 },
    { freq: 659, dur: 0.12, wave: 'triangle', gain: 0.3, delay: 0.4 },
    { freq: 784, dur: 0.12, wave: 'triangle', gain: 0.3, delay: 0.5 },
    { freq: 1047, dur: 0.4, wave: 'square', gain: 0.2, delay: 0.6 },
  ],
  levelup: [
    { freq: 523, dur: 0.08, wave: 'square', gain: 0.18 },
    { freq: 784, dur: 0.08, wave: 'square', gain: 0.18, delay: 0.08 },
    { freq: 1047, dur: 0.08, wave: 'square', gain: 0.18, delay: 0.16 },
    { freq: 1568, dur: 0.25, wave: 'square', gain: 0.18, delay: 0.24 },
  ],
  chest: [
    { freq: 200, slideTo: 400, dur: 0.12, wave: 'triangle', gain: 0.3 },
    { freq: 784, dur: 0.1, wave: 'square', gain: 0.15, delay: 0.14 },
    { freq: 988, dur: 0.1, wave: 'square', gain: 0.15, delay: 0.24 },
    { freq: 1319, dur: 0.25, wave: 'square', gain: 0.15, delay: 0.34 },
  ],
  gymOpen: [
    { freq: 80, slideTo: 140, dur: 0.3, wave: 'triangle', gain: 0.35 },
    { freq: 440, dur: 0.06, wave: 'square', gain: 0.12, delay: 0.25 },
    { freq: 660, dur: 0.12, wave: 'square', gain: 0.12, delay: 0.31 },
  ],
  gymClose: [
    { freq: 140, slideTo: 60, dur: 0.22, wave: 'triangle', gain: 0.35 },
    { freq: 120, slideTo: 40, dur: 0.15, wave: 'noise', gain: 0.35, delay: 0.2 },
  ],
  fall: [{ freq: 900, slideTo: 80, dur: 0.6, wave: 'triangle', gain: 0.25 }],
  crit: [
    { freq: 1500, slideTo: 600, dur: 0.06, wave: 'square', gain: 0.18 },
    { freq: 300, slideTo: 100, dur: 0.1, wave: 'noise', gain: 0.3 },
  ],
  warn: [
    { freq: 520, dur: 0.1, wave: 'square', gain: 0.15 },
    { freq: 520, dur: 0.1, wave: 'square', gain: 0.15, delay: 0.16 },
  ],
  summon: [
    { freq: 220, slideTo: 660, dur: 0.3, wave: 'sine', gain: 0.25 },
    { freq: 330, slideTo: 990, dur: 0.3, wave: 'triangle', gain: 0.18, delay: 0.08 },
  ],
  faint: [
    { freq: 400, slideTo: 80, dur: 0.45, wave: 'triangle', gain: 0.3 },
    { freq: 200, slideTo: 50, dur: 0.3, wave: 'noise', gain: 0.2, delay: 0.1 },
  ],
  record: [
    { freq: 659, dur: 0.1, wave: 'square', gain: 0.18 },
    { freq: 784, dur: 0.1, wave: 'square', gain: 0.18, delay: 0.1 },
    { freq: 988, dur: 0.1, wave: 'square', gain: 0.18, delay: 0.2 },
    { freq: 1319, dur: 0.1, wave: 'square', gain: 0.18, delay: 0.3 },
    { freq: 1568, dur: 0.35, wave: 'square', gain: 0.18, delay: 0.4 },
  ],
  // Un disparo con su carácter por tipo
  shot_normal: [{ freq: 700, slideTo: 380, dur: 0.07, wave: 'square', gain: 0.12 }],
  shot_fire: [{ freq: 300, slideTo: 150, dur: 0.14, wave: 'noise', gain: 0.18 }, { freq: 500, slideTo: 250, dur: 0.1, wave: 'sawtooth', gain: 0.08 }],
  shot_water: [{ freq: 500, slideTo: 900, dur: 0.1, wave: 'sine', gain: 0.18 }, { freq: 700, slideTo: 450, dur: 0.08, wave: 'sine', gain: 0.12, delay: 0.07 }],
  shot_electric: [{ freq: 1800, slideTo: 300, dur: 0.06, wave: 'square', gain: 0.1 }, { freq: 1200, slideTo: 1800, dur: 0.05, wave: 'square', gain: 0.1, delay: 0.05 }, { freq: 2200, slideTo: 400, dur: 0.05, wave: 'square', gain: 0.08, delay: 0.1 }],
  shot_grass: [{ freq: 450, slideTo: 700, dur: 0.05, wave: 'triangle', gain: 0.18 }, { freq: 700, slideTo: 500, dur: 0.06, wave: 'triangle', gain: 0.14, delay: 0.05 }],
  shot_ice: [{ freq: 2000, slideTo: 1500, dur: 0.12, wave: 'sine', gain: 0.14 }, { freq: 2600, dur: 0.1, wave: 'sine', gain: 0.1, delay: 0.04 }],
  shot_fighting: [{ freq: 160, slideTo: 80, dur: 0.1, wave: 'noise', gain: 0.3 }],
  shot_poison: [{ freq: 260, slideTo: 130, dur: 0.16, wave: 'sawtooth', gain: 0.12 }, { freq: 190, slideTo: 260, dur: 0.12, wave: 'sine', gain: 0.1, delay: 0.05 }],
  shot_ground: [{ freq: 110, slideTo: 60, dur: 0.14, wave: 'noise', gain: 0.3 }, { freq: 90, dur: 0.1, wave: 'triangle', gain: 0.25 }],
  shot_flying: [{ freq: 600, slideTo: 1200, dur: 0.1, wave: 'noise', gain: 0.1 }],
  shot_psychic: [{ freq: 440, slideTo: 880, dur: 0.18, wave: 'sine', gain: 0.16 }, { freq: 880, slideTo: 440, dur: 0.18, wave: 'sine', gain: 0.12, delay: 0.05 }],
  shot_bug: [{ freq: 1100, slideTo: 1000, dur: 0.05, wave: 'sawtooth', gain: 0.1 }, { freq: 1100, slideTo: 1000, dur: 0.05, wave: 'sawtooth', gain: 0.1, delay: 0.07 }],
  shot_rock: [{ freq: 140, slideTo: 70, dur: 0.12, wave: 'noise', gain: 0.3 }, { freq: 220, slideTo: 100, dur: 0.08, wave: 'square', gain: 0.1 }],
  shot_ghost: [{ freq: 330, slideTo: 165, dur: 0.22, wave: 'sine', gain: 0.16 }, { freq: 349, slideTo: 175, dur: 0.22, wave: 'sine', gain: 0.1, delay: 0.03 }],
  shot_dragon: [{ freq: 200, slideTo: 90, dur: 0.2, wave: 'sawtooth', gain: 0.2 }, { freq: 400, slideTo: 180, dur: 0.14, wave: 'noise', gain: 0.1 }],
  shot_dark: [{ freq: 240, slideTo: 100, dur: 0.14, wave: 'sawtooth', gain: 0.16 }],
  shot_steel: [{ freq: 1400, slideTo: 1100, dur: 0.08, wave: 'square', gain: 0.1 }, { freq: 2100, dur: 0.06, wave: 'sine', gain: 0.08, delay: 0.02 }],
  shot_fairy: [{ freq: 1200, dur: 0.05, wave: 'sine', gain: 0.14 }, { freq: 1600, dur: 0.05, wave: 'sine', gain: 0.14, delay: 0.05 }, { freq: 2000, dur: 0.1, wave: 'sine', gain: 0.12, delay: 0.1 }],
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

/** El efecto de disparo de un tipo (si no existe, el básico). */
export const shotSfx = (type: string): SfxName => ((SHOT_TYPES as readonly string[]).includes(type) ? (`shot_${type}` as SfxName) : 'shot');
