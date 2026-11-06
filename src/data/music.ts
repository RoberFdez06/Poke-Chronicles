// Música chiptune por bioma, situación (combate, minijefe, jefe, jefe final, tienda, salas tranquilas), menú y Defensa
// de torres. Compuesta para el juego: sin derechos de terceros ni samples. Cada paso es una corchea; null es silencio.
// Batería: 0 nada, 1 bombo, 2 caja, 3 charles, 4 timbal, 5 charles abierto. Las pistas a mano están en TRACKS; el
// resto se compone por parámetros (musicGen.ts). Cada situación tiene una lista (PLAYLISTS) y ui/audio.ts la mezcla
// al azar sin repetir (audio/playlist.ts).
import { MUSIC, type Wave } from './sounds.ts';
import type { MusicMood } from '../audio/musicState.ts';
import { compose, type MusicStyle, type ScaleName, type DrumName, type RhythmName, type BassName } from './musicGen.ts';

export interface MusicTrack {
  /** Nombre (para depurar y tests). */
  name?: string;
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
  /** Intervalos del arpegio sobre el bajo (por defecto acorde mayor: 24, 28, 31, 36). */
  arpSteps?: number[];
  /** Onda del bajo (triángulo por defecto) y de la segunda voz (cuadrada por defecto). */
  bassWave?: Wave;
  harmonyWave?: Wave;
  /** Eco suave de la melodía medio paso después. */
  echo?: boolean;
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

/** Música del menú (la de siempre, de data/sounds.ts). */
TRACKS.menu = { name: 'Menú · Tema principal', bpm: MUSIC.bpm, lead: 'square', melody: MUSIC.melody, bass: MUSIC.bass };
for (const [k, t] of Object.entries(TRACKS)) t.name ??= k;

// --- Pistas compuestas por parámetros ---

type Opts = Partial<Pick<MusicStyle, 'bassWave' | 'drums' | 'harmony' | 'harmonyWave' | 'arp' | 'echo' | 'form' | 'liftB'>>;
/** Atajo para escribir un estilo en una línea. */
const st = (
  name: string, bpm: number, root: number, scale: ScaleName, lead: Wave, progA: number[], progB: number[],
  rhythmA: RhythmName, rhythmB: RhythmName, bass: BassName, o: Opts = {},
): MusicTrack => compose({ name, bpm, root, scale, lead, progA, progB, rhythmA, rhythmB, bass, ...o });

/** Exploración: 3 pistas nuevas por bioma (más la hecha a mano de TRACKS). */
const CALM: Record<string, MusicTrack[]> = {
  bosque: [
    st('Bosque · Senda de musgo', 116, 55, 'mayor', 'square', [0, 4, 5, 3], [3, 4, 0, 0], 'llano', 'saltos', 'caminante', { harmony: 'terceras', form: 'AABA' }),
    st('Bosque · Claro al alba', 100, 60, 'pentaMayor', 'triangle', [0, 3, 1, 4], [2, 3, 0, 4], 'balada', 'llano', 'octavas', { drums: 'suave' }),
    st('Bosque · Ardillas', 126, 62, 'mixolidio', 'square', [0, 6, 3, 0], [3, 6, 0, 4], 'galope', 'corrido', 'quintas', { drums: 'vals', harmony: 'pad', harmonyWave: 'triangle', form: 'ABAB' }),
  ],
  cueva: [
    st('Cueva · Gotas', 88, 57, 'menor', 'triangle', [0, 5, 3, 4], [0, 3, 6, 4], 'lento', 'balada', 'pedal', { echo: true, form: 'AABA' }),
    st('Cueva · Galería de cristal', 96, 59, 'dorico', 'sine', [0, 3, 0, 4], [5, 3, 1, 4], 'balada', 'sincopa', 'largo', { drums: 'suave', harmony: 'pad', echo: true }),
    st('Cueva · Vetas de mineral', 104, 52, 'frigio', 'square', [0, 1, 0, 6], [5, 6, 0, 1], 'sincopa', 'llano', 'octavas', { drums: 'tribal', bassWave: 'square', form: 'ABAB' }),
  ],
  mar: [
    st('Mar · Marea alta', 104, 65, 'lidio', 'triangle', [0, 1, 0, 4], [3, 1, 5, 4], 'llano', 'saltos', 'octavas', { harmony: 'pad', harmonyWave: 'sine', form: 'AABB' }),
    st('Mar · Brisa salada', 112, 60, 'mayor', 'sine', [0, 5, 3, 4], [3, 0, 4, 0], 'saltos', 'galope', 'saltarin', { drums: 'suave', arp: true }),
    st('Mar · Fondo azul', 92, 58, 'mixolidio', 'triangle', [0, 6, 0, 3], [5, 6, 3, 4], 'balada', 'lento', 'pedal', { echo: true, form: 'AABA' }),
  ],
  volcan: [
    st('Volcán · Lava viva', 148, 62, 'frigio', 'sawtooth', [0, 1, 0, 6], [5, 6, 1, 0], 'galope', 'corrido', 'galope', { drums: 'galope', bassWave: 'square' }),
    st('Volcán · Ceniza', 138, 57, 'armonica', 'square', [0, 3, 4, 0], [5, 3, 6, 4], 'marcha', 'galope', 'pulso', { drums: 'rock', harmony: 'pad', form: 'ABAB' }),
    st('Volcán · Magma lento', 120, 55, 'menor', 'sawtooth', [0, 5, 6, 0], [3, 4, 0, 0], 'sincopa', 'saltos', 'octavas', { drums: 'tribal', form: 'AABA' }),
  ],
  torre: [
    st('Torre · Velas', 80, 64, 'armonica', 'triangle', [0, 3, 4, 0], [5, 3, 1, 4], 'lento', 'balada', 'largo', { echo: true, harmony: 'pad', harmonyWave: 'sine' }),
    st('Torre · Escalera de caracol', 90, 60, 'tonos', 'sine', [0, 2, 4, 1], [3, 1, 5, 0], 'balada', 'sincopa', 'pedal', { drums: 'suave', echo: true, form: 'AABA' }),
    st('Torre · Campanario', 76, 57, 'menor', 'triangle', [0, 5, 3, 4], [0, 6, 5, 4], 'lento', 'llano', 'octavas', { harmony: 'terceras', form: 'AABB' }),
  ],
  ciudad: [
    st('Ciudad · Hora punta', 132, 60, 'mayor', 'square', [0, 5, 3, 4], [1, 4, 0, 0], 'saltos', 'corrido', 'caminante', { drums: 'disco', harmony: 'pad' }),
    st('Ciudad · Paseo', 118, 62, 'mixolidio', 'triangle', [0, 3, 6, 0], [3, 4, 0, 4], 'sincopa', 'llano', 'quintas', { drums: 'breaks', form: 'ABAB' }),
    st('Ciudad · Luces de neón', 124, 57, 'dorico', 'square', [0, 3, 0, 4], [5, 6, 0, 3], 'galope', 'saltos', 'saltarin', { drums: 'rock', arp: true, form: 'AABA' }),
  ],
  nieve: [
    st('Nieve · Copos', 96, 64, 'lidio', 'sine', [0, 1, 0, 4], [3, 1, 4, 0], 'balada', 'saltos', 'octavas', { echo: true, harmony: 'pad', harmonyWave: 'triangle' }),
    st('Nieve · Trineo', 132, 62, 'pentaMayor', 'square', [0, 3, 1, 4], [2, 3, 0, 4], 'galope', 'corrido', 'galope', { drums: 'vals' }),
    st('Nieve · Aurora', 86, 60, 'mayor', 'triangle', [0, 4, 5, 3], [3, 0, 4, 0], 'lento', 'balada', 'largo', { echo: true, liftB: true, form: 'AABA' }),
  ],
  pantano: [
    st('Pantano · Niebla', 84, 58, 'frigio', 'square', [0, 1, 6, 0], [5, 1, 0, 0], 'lento', 'sincopa', 'pedal', { echo: true }),
    st('Pantano · Ranas', 108, 55, 'blues', 'triangle', [0, 2, 3, 0], [3, 2, 1, 0], 'saltos', 'sincopa', 'caminante', { drums: 'breaks', form: 'ABAB' }),
    st('Pantano · Raíces', 92, 53, 'menor', 'square', [0, 5, 6, 0], [3, 5, 4, 0], 'balada', 'llano', 'octavas', { drums: 'suave', harmony: 'pad', form: 'AABA' }),
  ],
  cumbre: [
    st('Cumbre · Viento helado', 136, 62, 'dorico', 'square', [0, 3, 0, 6], [5, 6, 0, 4], 'marcha', 'corrido', 'quintas', { drums: 'marcha', harmony: 'pad' }),
    st('Cumbre · Cima', 128, 60, 'mixolidio', 'sawtooth', [0, 6, 3, 0], [3, 4, 6, 0], 'llano', 'galope', 'octavas', { drums: 'rock', liftB: true, form: 'AABA' }),
    st('Cumbre · Águilas', 144, 57, 'menor', 'square', [0, 5, 2, 6], [3, 4, 0, 0], 'saltos', 'corrido', 'galope', { drums: 'galope', arp: true, form: 'ABAB' }),
  ],
};

/** Sabor de cada bioma para sus pistas de combate: tónica, tres escalas, ondas y ajuste de tempo. */
const COMBAT_FLAVOR: Record<string, { root: number; scales: [ScaleName, ScaleName, ScaleName]; leads: [Wave, Wave, Wave]; bpm: number }> = {
  bosque: { root: 55, scales: ['mixolidio', 'menor', 'dorico'], leads: ['square', 'square', 'triangle'], bpm: 0 },
  cueva: { root: 57, scales: ['frigio', 'menor', 'armonica'], leads: ['triangle', 'square', 'sawtooth'], bpm: -6 },
  mar: { root: 60, scales: ['dorico', 'mixolidio', 'menor'], leads: ['triangle', 'square', 'square'], bpm: -2 },
  volcan: { root: 62, scales: ['frigioMayor', 'armonica', 'frigio'], leads: ['sawtooth', 'sawtooth', 'square'], bpm: 8 },
  torre: { root: 59, scales: ['armonica', 'tonos', 'menor'], leads: ['square', 'triangle', 'sawtooth'], bpm: -4 },
  ciudad: { root: 60, scales: ['dorico', 'mayor', 'blues'], leads: ['square', 'square', 'triangle'], bpm: 4 },
  nieve: { root: 64, scales: ['menor', 'lidio', 'dorico'], leads: ['triangle', 'square', 'square'], bpm: -2 },
  pantano: { root: 58, scales: ['blues', 'frigio', 'menor'], leads: ['square', 'triangle', 'square'], bpm: -4 },
  cumbre: { root: 62, scales: ['dorico', 'menor', 'mixolidio'], leads: ['sawtooth', 'square', 'square'], bpm: 6 },
};

function combatFor(biome: string): MusicTrack[] {
  const f = COMBAT_FLAVOR[biome] ?? COMBAT_FLAVOR.bosque;
  return [
    st(`${biome} · Refriega`, 144 + f.bpm, f.root, f.scales[0], f.leads[0], [0, 5, 6, 0], [3, 4, 0, 4], 'galope', 'corrido', 'galope', { drums: 'rock', harmony: 'pad' }),
    st(`${biome} · Emboscada`, 152 + f.bpm, f.root - 3, f.scales[1], f.leads[1], [0, 3, 4, 0], [5, 6, 4, 4], 'sincopa', 'saltos', 'pulso', { drums: 'doble', harmony: 'terceras', form: 'ABAB' }),
    st(`${biome} · Choque`, 138 + f.bpm, f.root + 2, f.scales[2], f.leads[2], [0, 6, 5, 6], [3, 4, 5, 4], 'marcha', 'corrido', 'quintas', { drums: 'breaks', arp: true, form: 'AABA' }),
  ];
}

const BOSS: MusicTrack[] = [
  st('Jefe · Trueno legendario', 162, 57, 'armonica', 'sawtooth', [0, 5, 3, 4], [0, 6, 5, 4], 'corrido', 'galope', 'galope', { drums: 'doble', harmony: 'pad', arp: true, form: 'ABAB' }),
  st('Jefe · Duelo en la cima', 156, 62, 'frigio', 'square', [0, 1, 0, 6], [5, 6, 1, 0], 'galope', 'corrido', 'pulso', { drums: 'rock', harmony: 'terceras', arp: true, bassWave: 'square' }),
  st('Jefe · Furia ancestral', 168, 55, 'menor', 'sawtooth', [0, 6, 5, 4], [3, 4, 0, 0], 'saltos', 'corrido', 'octavas', { drums: 'galope', harmony: 'pad', arp: true, form: 'AABA' }),
];
const MINI: MusicTrack[] = [
  st('Minijefe · Guardián', 150, 60, 'dorico', 'square', [0, 3, 6, 4], [5, 3, 4, 4], 'galope', 'corrido', 'galope', { drums: 'rock', harmony: 'pad' }),
  st('Minijefe · Desafío', 146, 59, 'armonica', 'sawtooth', [0, 5, 4, 0], [3, 4, 5, 4], 'marcha', 'saltos', 'quintas', { drums: 'marcha', arp: true, form: 'ABAB' }),
  st('Minijefe · Ultraente', 140, 61, 'tonos', 'square', [0, 2, 0, 4], [1, 3, 5, 0], 'sincopa', 'corrido', 'pulso', { drums: 'tribal', echo: true, harmony: 'terceras' }),
];
const FINAL: MusicTrack[] = [
  st('Jefe final · Origen', 178, 62, 'armonica', 'sawtooth', [0, 5, 3, 4], [0, 6, 5, 4], 'corrido', 'galope', 'galope', { drums: 'doble', harmony: 'pad', arp: true, liftB: true, form: 'AABA' }),
  st('Jefe final · Última luz', 172, 57, 'frigioMayor', 'square', [0, 1, 0, 6], [5, 6, 1, 0], 'galope', 'corrido', 'pulso', { drums: 'galope', harmony: 'terceras', arp: true, bassWave: 'square', form: 'ABAB' }),
];
const MENU: MusicTrack[] = [
  st('Menú · Nueva aventura', 124, 60, 'mayor', 'square', [0, 3, 4, 0], [5, 3, 1, 4], 'llano', 'saltos', 'caminante', { drums: 'suave', harmony: 'pad', harmonyWave: 'triangle', form: 'AABA' }),
  st('Menú · Mochila lista', 112, 62, 'mixolidio', 'triangle', [0, 6, 3, 0], [3, 4, 0, 4], 'balada', 'galope', 'octavas', { drums: 'vals' }),
];
/** Tienda y salas tranquilas (centro Pokémon, secretas, de objeto). */
const SHOP: MusicTrack[] = [
  st('Tienda · Mostrador', 110, 60, 'mayor', 'square', [0, 5, 1, 4], [3, 4, 0, 0], 'sincopa', 'saltos', 'saltarin', { drums: 'breaks' }),
  st('Tienda · Ofertas', 120, 65, 'pentaMayor', 'triangle', [0, 3, 1, 4], [2, 1, 3, 0], 'saltos', 'llano', 'caminante', { drums: 'vals', form: 'ABAB' }),
  st('Tienda · Monedas', 100, 57, 'dorico', 'sine', [0, 3, 0, 4], [5, 6, 3, 4], 'balada', 'sincopa', 'quintas', { drums: 'suave', echo: true, form: 'AABA' }),
];
const REST: MusicTrack[] = [
  st('Santuario · Descanso', 76, 60, 'lidio', 'sine', [0, 1, 0, 4], [3, 1, 5, 0], 'lento', 'balada', 'largo', { harmony: 'pad', harmonyWave: 'triangle', echo: true }),
  st('Santuario · Fuente', 84, 64, 'mayor', 'triangle', [0, 5, 3, 4], [3, 4, 0, 0], 'balada', 'llano', 'octavas', { echo: true, form: 'AABA' }),
  st('Santuario · Secreto', 90, 57, 'tonos', 'triangle', [0, 2, 4, 1], [3, 5, 1, 0], 'sincopa', 'lento', 'pedal', { drums: 'suave', echo: true }),
];
/** Pistas extra de exploración según el modo (se suman a las del bioma). */
const MODE_EXTRA: Record<string, MusicTrack[]> = {
  tower: [
    st('Torre · Ascenso', 130, 60, 'dorico', 'square', [0, 3, 4, 6], [5, 6, 0, 4], 'marcha', 'galope', 'quintas', { drums: 'marcha', liftB: true, form: 'AABA' }),
    st('Torre · Piso cien', 118, 62, 'lidio', 'triangle', [0, 1, 4, 0], [3, 1, 5, 4], 'llano', 'saltos', 'octavas', { arp: true, harmony: 'pad' }),
  ],
  endless: [
    st('Infinito · Sin fin', 140, 57, 'menor', 'sawtooth', [0, 5, 6, 0], [3, 6, 4, 4], 'galope', 'corrido', 'galope', { drums: 'rock', form: 'ABAB' }),
    st('Infinito · Bucle eterno', 126, 59, 'pentaMenor', 'square', [0, 2, 3, 1], [3, 4, 2, 0], 'sincopa', 'saltos', 'caminante', { drums: 'breaks' }),
  ],
};

// --- Defensa de torres: música por tipo ---

interface TypeFamily {
  root: number;
  scales: [ScaleName, ScaleName];
  leads: [Wave, Wave];
  bpm: number;
  drums: [DrumName | undefined, DrumName | undefined];
  rhythms: [RhythmName, RhythmName];
  bass: [BassName, BassName];
  prog: number[];
}
/** Familia de cada tipo: escala/modo, tempo, onda, batería y patrón propios para que se distingan al oído. */
export const TD_TYPE_FAMILY: Readonly<Record<string, TypeFamily>> = {
  normal: { root: 60, scales: ['mayor', 'mixolidio'], leads: ['square', 'triangle'], bpm: 120, drums: ['marcha', 'suave'], rhythms: ['llano', 'marcha'], bass: ['caminante', 'octavas'], prog: [0, 3, 4, 0] },
  fire: { root: 62, scales: ['mixolidio', 'frigioMayor'], leads: ['sawtooth', 'square'], bpm: 150, drums: ['galope', 'rock'], rhythms: ['galope', 'corrido'], bass: ['galope', 'pulso'], prog: [0, 6, 3, 0] },
  water: { root: 65, scales: ['lidio', 'mayor'], leads: ['triangle', 'sine'], bpm: 104, drums: ['suave', undefined], rhythms: ['saltos', 'balada'], bass: ['octavas', 'saltarin'], prog: [0, 1, 5, 4] },
  electric: { root: 64, scales: ['pentaMayor', 'mayor'], leads: ['square', 'square'], bpm: 160, drums: ['disco', 'doble'], rhythms: ['sincopa', 'corrido'], bass: ['pulso', 'octavas'], prog: [0, 3, 1, 4] },
  grass: { root: 55, scales: ['mayor', 'pentaMayor'], leads: ['triangle', 'square'], bpm: 112, drums: ['vals', 'suave'], rhythms: ['llano', 'saltos'], bass: ['quintas', 'caminante'], prog: [0, 4, 5, 3] },
  ice: { root: 67, scales: ['lidio', 'dorico'], leads: ['sine', 'triangle'], bpm: 94, drums: [undefined, 'suave'], rhythms: ['balada', 'lento'], bass: ['largo', 'octavas'], prog: [0, 1, 0, 4] },
  fighting: { root: 57, scales: ['menor', 'dorico'], leads: ['square', 'sawtooth'], bpm: 144, drums: ['tribal', 'marcha'], rhythms: ['marcha', 'galope'], bass: ['pulso', 'galope'], prog: [0, 6, 5, 6] },
  poison: { root: 58, scales: ['armonica', 'frigio'], leads: ['square', 'triangle'], bpm: 100, drums: ['breaks', 'suave'], rhythms: ['sincopa', 'saltos'], bass: ['caminante', 'pedal'], prog: [0, 1, 0, 4] },
  ground: { root: 52, scales: ['dorico', 'pentaMenor'], leads: ['sawtooth', 'square'], bpm: 108, drums: ['tribal', 'rock'], rhythms: ['balada', 'marcha'], bass: ['pedal', 'pulso'], prog: [0, 3, 0, 6] },
  flying: { root: 62, scales: ['mixolidio', 'lidio'], leads: ['triangle', 'square'], bpm: 132, drums: ['galope', 'vals'], rhythms: ['saltos', 'galope'], bass: ['octavas', 'quintas'], prog: [0, 6, 3, 4] },
  psychic: { root: 61, scales: ['tonos', 'lidio'], leads: ['sine', 'triangle'], bpm: 90, drums: ['suave', undefined], rhythms: ['balada', 'sincopa'], bass: ['largo', 'pedal'], prog: [0, 2, 1, 3] },
  bug: { root: 59, scales: ['pentaMenor', 'menor'], leads: ['square', 'square'], bpm: 138, drums: ['doble', 'breaks'], rhythms: ['corrido', 'saltos'], bass: ['pulso', 'saltarin'], prog: [0, 2, 3, 1] },
  rock: { root: 57, scales: ['menor', 'pentaMenor'], leads: ['sawtooth', 'square'], bpm: 116, drums: ['rock', 'tribal'], rhythms: ['marcha', 'llano'], bass: ['octavas', 'galope'], prog: [0, 5, 6, 0] },
  ghost: { root: 56, scales: ['armonica', 'tonos'], leads: ['triangle', 'sine'], bpm: 80, drums: [undefined, 'suave'], rhythms: ['lento', 'balada'], bass: ['pedal', 'largo'], prog: [0, 5, 3, 4] },
  dragon: { root: 62, scales: ['frigioMayor', 'armonica'], leads: ['sawtooth', 'sawtooth'], bpm: 152, drums: ['doble', 'galope'], rhythms: ['galope', 'corrido'], bass: ['galope', 'quintas'], prog: [0, 1, 6, 0] },
  dark: { root: 55, scales: ['blues', 'menor'], leads: ['square', 'triangle'], bpm: 104, drums: ['breaks', 'rock'], rhythms: ['sincopa', 'balada'], bass: ['caminante', 'octavas'], prog: [0, 2, 3, 0] },
  steel: { root: 60, scales: ['dorico', 'mixolidio'], leads: ['square', 'sawtooth'], bpm: 126, drums: ['marcha', 'disco'], rhythms: ['corrido', 'marcha'], bass: ['quintas', 'pulso'], prog: [0, 3, 6, 4] },
  fairy: { root: 64, scales: ['mayor', 'lidio'], leads: ['sine', 'triangle'], bpm: 118, drums: ['vals', 'suave'], rhythms: ['saltos', 'llano'], bass: ['saltarin', 'octavas'], prog: [0, 5, 3, 4] },
};

function tdTypeTracks(type: string): MusicTrack[] {
  const f = TD_TYPE_FAMILY[type] ?? TD_TYPE_FAMILY.normal;
  const progB = [f.prog[2], f.prog[3], f.prog[1], f.prog[0]];
  return [0, 1].map((v) =>
    st(`Torres · ${type} ${v + 1}`, f.bpm + (v ? -8 : 0), f.root + (v ? 2 : 0), f.scales[v], f.leads[v], v ? progB : f.prog, v ? f.prog : progB,
      f.rhythms[v], f.rhythms[1 - v], f.bass[v], { drums: f.drums[v], harmony: v ? 'terceras' : 'pad', echo: f.bpm < 100, form: v ? 'AABA' : 'AB' }),
  );
}

const TD_MENU: MusicTrack[] = [
  st('Torres · Plan de defensa', 116, 60, 'dorico', 'square', [0, 3, 4, 0], [5, 6, 3, 4], 'marcha', 'saltos', 'quintas', { drums: 'marcha', harmony: 'pad', form: 'AABA' }),
  st('Torres · Cuartel', 104, 57, 'mixolidio', 'triangle', [0, 6, 3, 4], [3, 4, 0, 0], 'llano', 'galope', 'caminante', { drums: 'suave' }),
];
const TD_CHIEF: MusicTrack[] = [
  st('Torres · Oleada del minijefe', 152, 59, 'armonica', 'square', [0, 5, 4, 0], [3, 4, 5, 4], 'galope', 'corrido', 'galope', { drums: 'rock', harmony: 'pad', arp: true }),
  st('Torres · Asalto legendario', 164, 62, 'frigio', 'sawtooth', [0, 1, 0, 6], [5, 6, 1, 0], 'corrido', 'galope', 'pulso', { drums: 'doble', harmony: 'terceras', arp: true, form: 'ABAB' }),
  st('Torres · Última oleada', 158, 55, 'menor', 'sawtooth', [0, 6, 5, 4], [3, 4, 0, 0], 'saltos', 'corrido', 'octavas', { drums: 'galope', harmony: 'pad', arp: true, form: 'AABA' }),
];

// --- Listas (playlists) ---

export interface Playlist {
  key: string;
  tracks: readonly MusicTrack[];
}

/** Ids de bioma con música propia (src/level/biomes.ts). */
export const MUSIC_BIOMES = Object.keys(CALM);
/** Situaciones especiales de sala con su propia lista. */
export type RoomMusic = 'tienda' | 'santuario';
/** Lista según el tipo de sala (floorGen `RoomKind`): tienda o sala tranquila; el resto, la del bioma. */
export const roomMusicFor = (kind: string): RoomMusic | null =>
  kind === 'shop' ? 'tienda' : kind === 'center' || kind === 'secret' || kind === 'item' ? 'santuario' : null;

const biomeKey = (b: string) => (CALM[b] ? b : 'bosque');
const calmCache = new Map<string, MusicTrack[]>();
const combatCache = new Map<string, MusicTrack[]>();

export const PLAYLISTS = {
  menu: [TRACKS.menu, ...MENU] as readonly MusicTrack[],
  minijefe: MINI as readonly MusicTrack[],
  jefe: [TRACKS.jefe, ...BOSS] as readonly MusicTrack[],
  final: [TRACKS.jefeFinal, ...FINAL] as readonly MusicTrack[],
  tienda: SHOP as readonly MusicTrack[],
  santuario: REST as readonly MusicTrack[],
  tdMenu: TD_MENU as readonly MusicTrack[],
  tdJefe: TD_CHIEF as readonly MusicTrack[],
};

/** Exploración de un bioma en un modo: la pista hecha a mano, las 3 nuevas y las extra del modo. */
export function calmPlaylist(biomeId: string, mode = ''): Playlist {
  const b = biomeKey(biomeId);
  const m = MODE_EXTRA[mode] ? mode : '';
  const key = `calma:${b}:${m}`;
  let list = calmCache.get(key);
  if (!list) {
    list = [TRACKS[b] ?? TRACKS.bosque, ...CALM[b], ...(MODE_EXTRA[m] ?? [])];
    calmCache.set(key, list);
  }
  return { key, tracks: list };
}

/** Combate en un bioma: sus 3 pistas y la de combate de siempre. */
export function combatPlaylist(biomeId: string): Playlist {
  const b = biomeKey(biomeId);
  let list = combatCache.get(b);
  if (!list) {
    list = [...combatFor(b), TRACKS.combate];
    combatCache.set(b, list);
  }
  return { key: `combate:${b}`, tracks: list };
}

export interface RunMusic {
  mood: MusicMood;
  biomeId: string;
  mode?: string;
  room?: RoomMusic | null;
}

/** Lista que toca en la partida según la situación, el bioma, el modo y la sala. */
export function runPlaylist(r: RunMusic): Playlist {
  if (r.mood === 'final') return { key: 'final', tracks: PLAYLISTS.final };
  if (r.mood === 'boss') return { key: 'jefe', tracks: PLAYLISTS.jefe };
  if (r.mood === 'mini') return { key: 'minijefe', tracks: PLAYLISTS.minijefe };
  if (r.mood === 'combat') return combatPlaylist(r.biomeId);
  if (r.room) return { key: `sala:${r.room}`, tracks: PLAYLISTS[r.room] };
  return calmPlaylist(r.biomeId, r.mode);
}

export const menuPlaylist = (): Playlist => ({ key: 'menu', tracks: PLAYLISTS.menu });

const tdCache = new Map<string, MusicTrack[]>();
/** Defensa de torres: dos pistas del tipo tema del nivel (las 18 fases suenan distinto). */
export function tdTypePlaylist(type: string): Playlist {
  const t = TD_TYPE_FAMILY[type] ? type : 'normal';
  let list = tdCache.get(t);
  if (!list) {
    list = tdTypeTracks(t);
    tdCache.set(t, list);
  }
  return { key: `td:${t}`, tracks: list };
}
export const tdMenuPlaylist = (): Playlist => ({ key: 'td-menu', tracks: PLAYLISTS.tdMenu });
export const tdChiefPlaylist = (): Playlist => ({ key: 'td-jefe', tracks: PLAYLISTS.tdJefe });

/** Qué música toca según lo que pasa en la sala (primera pista de cada lista; compatibilidad). */
export type { MusicMood } from '../audio/musicState.ts';
export function trackForMood(mood: MusicMood, biomeId: string): MusicTrack {
  if (mood === 'final') return TRACKS.jefeFinal;
  if (mood === 'boss' || mood === 'mini') return TRACKS.jefe;
  if (mood === 'combat') return TRACKS.combate;
  return trackForBiome(biomeId);
}

/** Pista hecha a mano de cada bioma (por id de src/level/biomes.ts); si no hay, la del bosque. */
export const trackForBiome = (biomeId: string): MusicTrack => TRACKS[biomeId] ?? TRACKS.bosque;
