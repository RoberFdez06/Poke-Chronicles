// Compositor de chiptune por parámetros (lógica pura, sin Web Audio). Cada pista es una composición propia del juego
// descrita por su estilo: escala/modo, tónica, tempo, ondas, ritmo de la melodía, bajo, batería, armonía y forma
// (secciones A/B). La melodía se escribe con un motivo que se repite y varía sobre la progresión de acordes, con una
// semilla fija por nombre: la misma pista suena siempre igual. Sin samples ni música de terceros.
import type { Wave } from './sounds.ts';
import type { MusicTrack } from './music.ts';

/** Escalas (semitonos desde la tónica). */
export const SCALES = {
  mayor: [0, 2, 4, 5, 7, 9, 11],
  menor: [0, 2, 3, 5, 7, 8, 10],
  dorico: [0, 2, 3, 5, 7, 9, 10],
  frigio: [0, 1, 3, 5, 7, 8, 10],
  lidio: [0, 2, 4, 6, 7, 9, 11],
  mixolidio: [0, 2, 4, 5, 7, 9, 10],
  armonica: [0, 2, 3, 5, 7, 8, 11],
  frigioMayor: [0, 1, 4, 5, 7, 8, 10],
  pentaMayor: [0, 2, 4, 7, 9],
  pentaMenor: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  tonos: [0, 2, 4, 6, 8, 10],
} as const satisfies Record<string, readonly number[]>;
export type ScaleName = keyof typeof SCALES;

/** Ritmos de la melodía por compás de 8 corcheas (1 = nota, 0 = silencio). */
export const RHYTHMS = {
  llano: [1, 0, 1, 1, 1, 0, 1, 0],
  corrido: [1, 1, 1, 1, 1, 1, 1, 1],
  sincopa: [1, 0, 0, 1, 0, 1, 1, 0],
  galope: [1, 0, 1, 1, 0, 1, 1, 1],
  lento: [1, 0, 0, 0, 1, 0, 0, 0],
  balada: [1, 0, 0, 1, 1, 0, 0, 0],
  marcha: [1, 0, 1, 0, 1, 0, 1, 1],
  saltos: [1, 1, 0, 1, 1, 0, 1, 0],
} as const satisfies Record<string, readonly number[]>;
export type RhythmName = keyof typeof RHYTHMS;

/** Bajos (r = fundamental, t = tercera, f = quinta, o = octava, _ = silencio). */
export const BASSES = {
  pedal: 'r___r___',
  octavas: 'r_o_r_o_',
  galope: 'r_rrr_rr',
  caminante: 'r_t_f_t_',
  largo: 'r_______',
  pulso: 'rrrrrrrr',
  quintas: 'r_f_o_f_',
  saltarin: 'r__or_f_',
} as const satisfies Record<string, string>;
export type BassName = keyof typeof BASSES;

/** Batería por compás (0 nada, 1 bombo, 2 caja, 3 charles, 4 timbal, 5 charles abierto). */
export const DRUMS = {
  rock: [1, 3, 2, 3, 1, 1, 2, 3],
  disco: [1, 3, 2, 5, 1, 3, 2, 5],
  marcha: [1, 3, 2, 3, 1, 3, 2, 2],
  galope: [1, 0, 1, 2, 1, 0, 1, 2],
  breaks: [1, 0, 2, 0, 0, 1, 2, 3],
  tribal: [1, 0, 4, 0, 1, 4, 4, 0],
  suave: [1, 0, 0, 3, 0, 0, 3, 0],
  doble: [1, 1, 2, 3, 1, 1, 2, 3],
  vals: [1, 0, 3, 3, 2, 0, 3, 3],
} as const satisfies Record<string, readonly number[]>;
export type DrumName = keyof typeof DRUMS;
/** Redoble al final de cada sección (solo con batería que no sea suave). */
const FILL = [1, 3, 2, 2, 4, 4, 2, 2];

export type Form = 'AB' | 'ABAB' | 'AABB' | 'AABA';

export interface MusicStyle {
  /** Nombre de la pista (también es su semilla). */
  name: string;
  bpm: number;
  /** Tónica (MIDI, 55-67 recomendado). */
  root: number;
  scale: ScaleName;
  lead: Wave;
  /** Progresión de la sección A y de la B (grados de la escala, desde 0; 4 compases). */
  progA: readonly number[];
  progB: readonly number[];
  rhythmA: RhythmName;
  rhythmB: RhythmName;
  bass: BassName;
  bassWave?: Wave;
  drums?: DrumName;
  harmony?: 'pad' | 'terceras';
  harmonyWave?: Wave;
  arp?: boolean;
  echo?: boolean;
  form?: Form;
  /** La melodía de la sección B sube una octava (estribillo brillante). */
  liftB?: boolean;
}

/** Generador pseudoaleatorio reproducible (mulberry32). */
export function rngFrom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashName(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Rangos de notas que admite el motor (MIDI). */
export const MELODY_RANGE = [55, 100] as const;
export const BASS_RANGE = [28, 64] as const;
export const HARMONY_RANGE = [48, 84] as const;

const fit = (n: number, [lo, hi]: readonly [number, number]): number => {
  let x = n;
  while (x < lo) x += 12;
  while (x > hi) x -= 12;
  return x;
};

/** Nota MIDI del grado `deg` (puede pasar de 7 o ser negativo) de la escala. */
export function degreeNote(scale: readonly number[], root: number, deg: number): number {
  const n = scale.length;
  const oct = Math.floor(deg / n);
  const i = ((deg % n) + n) % n;
  return root + 12 * oct + scale[i];
}

/** Motivo de un compás: grados relativos a la fundamental del acorde, uno por nota del ritmo. */
function makeMotif(rng: () => number, onsets: number, span: number): number[] {
  const out: number[] = [];
  let d = [0, 2, 4][Math.floor(rng() * 3)];
  for (let k = 0; k < onsets; k++) {
    out.push(d);
    const r = rng();
    const step = r < 0.3 ? 1 : r < 0.55 ? -1 : r < 0.7 ? 2 : r < 0.85 ? -2 : r < 0.93 ? 3 : 0;
    d = Math.max(-2, Math.min(span, d + step));
  }
  return out;
}

/** Compone la pista de un estilo. */
export function compose(s: MusicStyle): MusicTrack {
  const scale: readonly number[] = SCALES[s.scale];
  const len = scale.length;
  const rng = rngFrom(hashName(s.name));
  const form = s.form ?? 'AB';
  const sections: Record<'A' | 'B', { mel: (number | null)[]; bass: (number | null)[]; harm: (number | null)[] }> = {
    A: { mel: [], bass: [], harm: [] },
    B: { mel: [], bass: [], harm: [] },
  };
  for (const sec of ['A', 'B'] as const) {
    const prog = sec === 'A' ? s.progA : s.progB;
    const rhythm = RHYTHMS[sec === 'A' ? s.rhythmA : s.rhythmB];
    const onsets = rhythm.reduce<number>((a, b) => a + b, 0);
    const motif = makeMotif(rng, onsets, len);
    const lift = sec === 'B' ? (s.liftB ? len : 2) : 0;
    const melBase = s.root + 12;
    for (let bar = 0; bar < 4; bar++) {
      const chord = prog[bar % prog.length];
      const cadence = bar === 3;
      // Variación: una nota del motivo cambia en el compás 3; en el 4, cadencia hacia la tónica del acorde
      const varIdx = bar === 2 ? Math.floor(rng() * onsets) : -1;
      let k = 0;
      for (let st = 0; st < 8; st++) {
        const on = cadence ? (st === 0 || st === 2 || st === 4) : rhythm[st] === 1;
        if (!on) {
          sections[sec].mel.push(null);
        } else {
          let deg = cadence ? [2, 1, 0][Math.min(2, k)] : motif[k % motif.length];
          if (k === varIdx) deg += rng() < 0.5 ? 1 : -1;
          // Tiempos fuertes: nota del acorde
          if (st % 4 === 0 && ![0, 2, 4, len].includes(((deg % len) + len) % len)) deg -= 1;
          sections[sec].mel.push(fit(degreeNote(scale, melBase, chord + deg + lift), MELODY_RANGE));
          k++;
        }
      }
      const r = fit(degreeNote(scale, s.root - 24, chord), BASS_RANGE);
      const t = fit(degreeNote(scale, s.root - 24, chord + 2), [r, r + 12]);
      const f = fit(degreeNote(scale, s.root - 24, chord + 4), [r, r + 12]);
      for (const ch of BASSES[s.bass]) {
        const n = ch === 'r' ? r : ch === 't' ? t : ch === 'f' ? f : ch === 'o' ? r + 12 : null;
        sections[sec].bass.push(n === null ? null : fit(n, BASS_RANGE));
      }
      const h3 = fit(degreeNote(scale, s.root, chord + 2), HARMONY_RANGE);
      const h5 = fit(degreeNote(scale, s.root, chord + 4), HARMONY_RANGE);
      for (let st = 0; st < 8; st++) {
        if (s.harmony === 'pad') sections[sec].harm.push(st === 0 ? h3 : st === 4 ? h5 : null);
        else if (s.harmony === 'terceras') {
          const m = sections[sec].mel[sections[sec].mel.length - 8 + st];
          sections[sec].harm.push(m !== null && st % 2 === 0 ? fit(m - (scale[2] ?? 4), HARMONY_RANGE) : null);
        } else sections[sec].harm.push(null);
      }
    }
  }
  const order = form.split('') as ('A' | 'B')[];
  const melody: (number | null)[] = [];
  const bass: (number | null)[] = [];
  const harmony: (number | null)[] = [];
  const drums: number[] = [];
  for (const sec of order) {
    melody.push(...sections[sec].mel);
    bass.push(...sections[sec].bass);
    harmony.push(...sections[sec].harm);
    if (s.drums) {
      const pat = DRUMS[s.drums];
      for (let bar = 0; bar < 4; bar++) drums.push(...(bar === 3 && s.drums !== 'suave' ? FILL : pat));
    }
  }
  const third = scale[2] ?? 4;
  const fifth = scale.includes(7) ? 7 : scale[Math.min(3, len - 1)];
  const t: MusicTrack = { name: s.name, bpm: s.bpm, lead: s.lead, melody, bass };
  if (s.drums) t.drums = drums;
  if (s.harmony) {
    t.harmony = harmony;
    if (s.harmonyWave) t.harmonyWave = s.harmonyWave;
  }
  if (s.bassWave) t.bassWave = s.bassWave;
  if (s.arp) {
    t.arp = true;
    t.arpSteps = [24, 24 + third, 24 + fifth, 36];
  }
  if (s.echo) t.echo = true;
  return t;
}
