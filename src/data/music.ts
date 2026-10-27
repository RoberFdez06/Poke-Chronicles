// Música chiptune por bioma y para el jefe (supervisor). Compuesta para el juego: sin derechos de terceros.
// Cada paso es una corchea; null es silencio. Batería: 1 bombo, 2 caja, 0 nada. Se reproduce con playTrack() de ui/audio.ts.
import type { Wave } from './sounds.ts';

export interface MusicTrack {
  bpm: number;
  /** Onda de la melodía. */
  lead: Wave;
  melody: (number | null)[];
  bass: (number | null)[];
  drums?: number[];
  /** Segunda voz (capa de armonía, onda cuadrada suave). */
  harmony?: (number | null)[];
  /** Arpegio rápido de la nota del bajo (dos octavas arriba) en cada paso: más intensidad. */
  arp?: boolean;
}

export const TRACKS: Record<string, MusicTrack> = {
  bosque: {
    bpm: 120,
    lead: 'square',
    melody: [79, null, 86, 83, 91, null, 86, null, 72, 76, 79, 84, 79, 76, 72, null, 74, null, 81, 78, 86, null, 81, null, 86, null, null, 83, 79, null, null, null, 76, null, 83, 79, 88, null, 83, null, 72, 76, 79, 84, 79, 76, 72, null, 74, null, 81, 78, 86, null, 81, null, 86, null, null, 83, 79, null, null, null],
    bass: [55, null, 62, null, 55, null, 59, null, 48, null, 55, null, 48, null, 52, null, 50, null, 57, null, 50, null, 54, null, 55, null, 62, null, 55, null, 59, null, 52, null, 59, null, 52, null, 55, null, 48, null, 55, null, 48, null, 52, null, 50, null, 57, null, 50, null, 54, null, 55, null, 62, null, 55, null, 59, null],
  },
  cueva: {
    bpm: 92,
    lead: 'triangle',
    melody: [88, null, null, 84, 81, null, null, null, 89, null, null, null, 81, null, 77, null, 86, null, null, 83, 79, null, null, null, 88, null, null, null, 79, null, 76, null],
    bass: [57, null, null, null, null, null, null, null, 53, null, null, null, null, null, null, null, 55, null, null, null, null, null, null, null, 52, null, null, null, null, null, null, null],
  },
  mar: {
    bpm: 108,
    lead: 'triangle',
    melody: [77, 84, 81, 89, 77, 84, 81, 89, 74, 81, 77, 86, 74, 81, 77, 86, 82, 89, 86, 94, 82, 89, 86, 94, 72, 76, 79, 84, 79, 76, 72, null],
    bass: [53, null, 65, null, 53, null, 65, null, 50, null, 62, null, 50, null, 62, null, 58, null, 70, null, 58, null, 70, null, 48, null, 60, null, 48, null, 60, null],
  },
  volcan: {
    bpm: 150,
    lead: 'sawtooth',
    melody: [74, 74, 86, 74, 81, 74, 77, 81, 82, 82, 94, 82, 89, 82, 86, 89, 72, 76, 79, 84, 79, 76, 72, null, 74, 74, 86, 74, 81, 74, 77, 81, 74, 74, 86, 74, 81, 74, 77, 81, 82, 82, 94, 82, 89, 82, 86, 89, 81, 85, 88, 93, 88, 85, 81, null, 81, 81, 93, 81, 88, 81, 85, 88],
    bass: [50, null, 50, 50, 50, null, 50, 50, 58, null, 58, 58, 58, null, 58, 58, 48, null, 48, 48, 48, null, 48, 48, 50, null, 50, 50, 50, null, 50, 50, 50, null, 50, 50, 50, null, 50, 50, 58, null, 58, 58, 58, null, 58, 58, 57, null, 57, 57, 57, null, 57, 57, 57, null, 57, 57, 57, null, 57, 57],
    drums: [1, 0, 2, 0, 1, 1, 2, 0, 1, 0, 2, 0, 1, 1, 2, 0, 1, 0, 2, 0, 1, 1, 2, 0, 1, 0, 2, 0, 1, 1, 2, 0, 1, 0, 2, 0, 1, 1, 2, 0, 1, 0, 2, 0, 1, 1, 2, 0, 1, 0, 2, 0, 1, 1, 2, 0, 1, 0, 2, 0, 1, 1, 2, 0],
  },
  torre: {
    bpm: 84,
    lead: 'triangle',
    melody: [88, null, null, null, 79, null, 76, null, 84, null, null, null, 76, null, 72, null, 88, null, null, 84, 81, null, null, null, 95, null, null, null, 87, null, 83, null],
    bass: [52, null, null, null, null, null, null, null, 48, null, null, null, null, null, null, null, 57, null, null, null, null, null, null, null, 59, null, null, null, null, null, null, null],
  },
  ciudad: {
    bpm: 128,
    lead: 'square',
    melody: [72, null, 79, 76, 84, null, 79, null, 81, 84, 88, 93, 88, 84, 81, null, 77, null, 84, 81, 89, null, 84, null, 79, 83, 86, 91, 86, 83, 79, null],
    bass: [48, null, 60, null, 48, null, 60, null, 57, null, 69, null, 57, null, 69, null, 53, null, 65, null, 53, null, 65, null, 55, null, 67, null, 55, null, 67, null],
    drums: [1, 0, 2, 0, 1, 0, 2, 2, 1, 0, 2, 0, 1, 0, 2, 2, 1, 0, 2, 0, 1, 0, 2, 2, 1, 0, 2, 0, 1, 0, 2, 2],
  },
  nieve: {
    bpm: 100,
    lead: 'triangle',
    melody: [100, null, 95, null, 92, null, 95, null, 97, null, 92, null, 88, null, 92, null, 100, null, null, 97, 93, null, null, null, 107, null, 102, null, 99, null, 102, null],
    bass: [64, null, 71, null, 64, null, 68, null, 61, null, 68, null, 61, null, 64, null, 69, null, 76, null, 69, null, 73, null, 71, null, 78, null, 71, null, 75, null],
  },
  pantano: {
    bpm: 86,
    lead: 'square',
    melody: [89, null, null, 85, 82, null, null, null, 90, null, null, null, 82, null, 78, null, 87, null, null, 84, 80, null, null, null, 89, null, null, null, 81, null, 77, null],
    bass: [58, null, null, null, null, null, null, null, 54, null, null, null, null, null, null, null, 56, null, null, null, null, null, null, null, 53, null, null, null, null, null, null, null],
  },
  cumbre: {
    bpm: 136,
    lead: 'square',
    melody: [74, null, null, 81, 86, null, 81, 77, 72, 76, 79, 84, 79, 76, 72, null, 82, null, null, 89, 94, null, 89, 86, 72, 72, 84, 72, 79, 72, 76, 79, 74, null, null, 81, 86, null, 81, 77, 77, 81, 84, 89, 84, 81, 77, null, 72, null, null, 79, 84, null, 79, 76, 81, 81, 93, 81, 88, 81, 85, 88],
    bass: [50, null, 62, null, 50, null, 62, null, 48, null, 60, null, 48, null, 60, null, 58, null, 70, null, 58, null, 70, null, 48, null, 60, null, 48, null, 60, null, 50, null, 62, null, 50, null, 62, null, 53, null, 65, null, 53, null, 65, null, 48, null, 60, null, 48, null, 60, null, 57, null, 69, null, 57, null, 69, null],
    drums: [1, 0, 2, 0, 1, 0, 2, 1, 1, 0, 2, 0, 1, 0, 2, 1, 1, 0, 2, 0, 1, 0, 2, 1, 1, 0, 2, 0, 1, 0, 2, 1, 1, 0, 2, 0, 1, 0, 2, 1, 1, 0, 2, 0, 1, 0, 2, 1, 1, 0, 2, 0, 1, 0, 2, 1, 1, 0, 2, 0, 1, 0, 2, 1],
  },
  jefe: {
    bpm: 160,
    lead: 'sawtooth',
    melody: [72, 84, 72, 79, 72, 75, 72, 84, 80, 92, 80, 87, 80, 84, 80, 92, 82, 82, 94, 82, 89, 82, 86, 89, 79, 83, 86, 91, 86, 83, 79, null, 72, 84, 72, 79, 72, 75, 72, 84, 80, 92, 80, 87, 80, 84, 80, 92, 77, 77, 89, 77, 84, 77, 81, 84, 79, 83, 86, 91, 86, 83, 79, null],
    bass: [48, null, 48, 48, 48, null, 48, 48, 56, null, 56, 56, 56, null, 56, 56, 58, null, 58, 58, 58, null, 58, 58, 55, null, 55, 55, 55, null, 55, 55, 48, null, 48, 48, 48, null, 48, 48, 56, null, 56, 56, 56, null, 56, 56, 53, null, 53, 53, 53, null, 53, 53, 55, null, 55, 55, 55, null, 55, 55],
    drums: [1, 1, 2, 0, 1, 1, 2, 2, 1, 1, 2, 0, 1, 1, 2, 2, 1, 1, 2, 0, 1, 1, 2, 2, 1, 1, 2, 0, 1, 1, 2, 2, 1, 1, 2, 0, 1, 1, 2, 2, 1, 1, 2, 0, 1, 1, 2, 2, 1, 1, 2, 0, 1, 1, 2, 2, 1, 1, 2, 0, 1, 1, 2, 2],
  },
  // Combate (salas con enemigos): más rápida que la del bioma, con batería y una segunda voz
  combate: {
    bpm: 148,
    lead: 'square',
    melody: [76, null, 79, 81, 83, null, 81, 79, 76, null, 74, 76, 79, null, null, null, 72, null, 76, 79, 81, null, 79, 76, 74, 76, 77, 79, 81, null, null, null],
    harmony: [64, null, null, null, 67, null, null, null, 64, null, null, null, 67, null, null, null, 60, null, null, null, 64, null, null, null, 62, null, null, null, 65, null, null, null],
    bass: [45, null, 45, 57, 45, null, 45, 57, 43, null, 43, 55, 43, null, 43, 55, 41, null, 41, 53, 41, null, 41, 53, 43, null, 43, 55, 47, null, 47, 59],
    drums: [1, 3, 2, 3, 1, 3, 2, 3, 1, 3, 2, 3, 1, 1, 2, 3, 1, 3, 2, 3, 1, 3, 2, 3, 1, 3, 2, 3, 1, 1, 2, 2],
  },
  // Jefe final: la más épica, rapidísima, con armonía, arpegio y doble bombo
  jefeFinal: {
    bpm: 176,
    lead: 'sawtooth',
    melody: [74, 86, 74, 81, 74, 77, 74, 86, 82, 94, 82, 89, 82, 86, 82, 94, 84, 84, 96, 84, 91, 84, 88, 91, 81, 85, 88, 93, 88, 85, 81, 93, 74, 86, 74, 81, 74, 77, 74, 86, 79, 91, 79, 86, 79, 82, 79, 91, 77, 89, 77, 84, 77, 81, 77, 89, 81, 85, 88, 93, 96, 93, 88, 85],
    harmony: [62, null, null, null, 65, null, null, null, 70, null, null, null, 74, null, null, null, 72, null, null, null, 76, null, null, null, 69, null, null, null, 73, null, null, null, 62, null, null, null, 65, null, null, null, 67, null, null, null, 70, null, null, null, 65, null, null, null, 69, null, null, null, 69, null, null, null, 73, null, 76, null],
    bass: [38, 38, 50, 38, 38, 38, 50, 38, 46, 46, 58, 46, 46, 46, 58, 46, 48, 48, 60, 48, 48, 48, 60, 48, 45, 45, 57, 45, 45, 45, 57, 45, 38, 38, 50, 38, 38, 38, 50, 38, 43, 43, 55, 43, 43, 43, 55, 43, 41, 41, 53, 41, 41, 41, 53, 41, 45, 45, 57, 45, 45, 45, 57, 45],
    drums: [1, 1, 2, 3, 1, 1, 2, 3, 1, 1, 2, 3, 1, 1, 2, 2, 1, 1, 2, 3, 1, 1, 2, 3, 1, 1, 2, 3, 1, 2, 2, 2, 1, 1, 2, 3, 1, 1, 2, 3, 1, 1, 2, 3, 1, 1, 2, 2, 1, 1, 2, 3, 1, 1, 2, 3, 1, 2, 1, 2, 2, 2, 2, 2],
    arp: true,
  },
};

// El jefe normal: segunda voz y arpegio encima de su pista (más capas que la de combate)
TRACKS.jefe.harmony = [60, null, null, null, 63, null, null, null, 68, null, null, null, 72, null, null, null, 70, null, null, null, 74, null, null, null, 67, null, null, null, 71, null, null, null];
TRACKS.jefe.arp = true;

/** Qué música toca según lo que pasa en la sala: jefe final, jefe (o minijefe), combate o la del bioma. */
export type MusicMood = 'final' | 'boss' | 'combat' | 'calm';
export function trackForMood(mood: MusicMood, biomeId: string): MusicTrack {
  if (mood === 'final') return TRACKS.jefeFinal;
  if (mood === 'boss') return TRACKS.jefe;
  if (mood === 'combat') return TRACKS.combate;
  return trackForBiome(biomeId);
}

/** Pista de cada bioma (por id de src/level/biomes.ts); si no hay, la del bosque. */
export const trackForBiome = (biomeId: string): MusicTrack => TRACKS[biomeId] ?? TRACKS.bosque;
