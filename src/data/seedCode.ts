// T81: código de semilla. Un código corto (PKI-XXXX-XXXX-XXXX) con la semilla, el modo, la dificultad y el Pokémon
// inicial; quien lo escribe juega la misma partida (mismos pisos, salas, jefes y objetos, ver seedFloorSeed y seedRng
// en daily.ts). Esa partida no cuenta para récords, desafío diario, misiones ni registro de combate, pero se guarda
// su mejor resultado por código. Lógica pura, sin Phaser, para poder testearla.
import { MODES, recordText, type GameMode } from './modes.ts';
import { DIFFICULTIES, type Difficulty } from './difficulty.ts';

/** Versión del formato. Un código de otra versión se rechaza (si cambia lo que genera los pisos, se sube). */
export const SEED_CODE_VERSION = 1;
export const SEED_CODE_PREFIX = 'PKI';
/** Letras del código: Crockford base 32 (sin I, L, O ni U para que no se confundan). */
export const SEED_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** Caracteres del código sin prefijo ni guiones: 10 de datos y 2 de suma de control. */
export const SEED_CODE_CHARS = 12;
const DATA_CHARS = 10;
const MAX_STARTER = 2047;
const MAX_SEED = 0x7fffffff;

export interface SeedInfo {
  seed: number;
  mode: GameMode;
  difficulty: Difficulty;
  starterId: number;
}

/** Datos de una partida con semilla, para guardarlos en la partida (runSave.ts). */
export interface SeedRun {
  seed: number;
  /** La partida se empezó escribiendo un código: no cuenta para récords, diario, misiones ni registro de combate. */
  fromCode: boolean;
}

export type SeedError = 'vacio' | 'formato' | 'suma' | 'version' | 'datos';
export type DecodeResult = { ok: true; info: SeedInfo } | { ok: false; error: SeedError };

export const SEED_ERROR_TEXT: Record<SeedError, string> = {
  vacio: 'Escribe un código',
  formato: 'Al código le faltan o le sobran letras',
  suma: 'Código mal escrito: revisa las letras',
  version: 'Código de otra versión del juego',
  datos: 'Código no válido',
};

/** Semilla nueva para una partida (31 bits, nunca 0). */
export const newSeed = (rand: () => number = Math.random): number => 1 + Math.floor(rand() * MAX_SEED) % MAX_SEED;

// Campos y bits: versión 3, modo 3, dificultad 2, inicial 11, semilla 31 = 50 bits = 10 caracteres
const FIELDS = [3, 3, 2, 11, 31] as const;

function toBits(values: number[]): number[] {
  const bits: number[] = [];
  values.forEach((v, i) => {
    for (let b = FIELDS[i] - 1; b >= 0; b--) bits.push(Math.floor(v / 2 ** b) % 2);
  });
  return bits;
}

function fromBits(bits: number[]): number[] {
  let k = 0;
  return FIELDS.map((n) => {
    let v = 0;
    for (let b = 0; b < n; b++) v = v * 2 + bits[k++];
    return v;
  });
}

/** Suma de control (0..1020): con el primo 1021 detecta cualquier letra cambiada y dos letras seguidas cambiadas de sitio. */
function checksum(digits: number[]): number {
  let h = 0;
  for (const d of digits) h = (h * 31 + d + 7) % 1021;
  return h;
}

/** Código bonito: PKI-XXXX-XXXX-XXXX. */
export function formatCode(chars: string): string {
  const c = chars.toUpperCase();
  return `${SEED_CODE_PREFIX}-${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}`;
}

export function encodeSeed(info: SeedInfo): string {
  const mode = MODES.indexOf(info.mode);
  const diff = DIFFICULTIES.indexOf(info.difficulty);
  if (mode < 0 || diff < 0 || info.mode === 'towerdef') throw new Error('Modo o dificultad desconocidos');
  if (!Number.isInteger(info.starterId) || info.starterId < 1 || info.starterId > MAX_STARTER) throw new Error('Inicial fuera de rango');
  if (!Number.isInteger(info.seed) || info.seed < 0 || info.seed > MAX_SEED) throw new Error('Semilla fuera de rango');
  const bits = toBits([SEED_CODE_VERSION, mode, diff, info.starterId, info.seed]);
  const digits: number[] = [];
  for (let i = 0; i < DATA_CHARS; i++) digits.push(bits.slice(i * 5, i * 5 + 5).reduce((v, b) => v * 2 + b, 0));
  const sum = checksum(digits);
  digits.push(Math.floor(sum / 32), sum % 32);
  return formatCode(digits.map((d) => SEED_ALPHABET[d]).join(''));
}

/**
 * Limpia lo que se escribe: mayúsculas y minúsculas indistintas, sin espacios ni guiones, sin el prefijo PKI y con
 * las letras que se confunden cambiadas (O por 0, I y L por 1). No comprueba la suma.
 */
export function normalizeCode(raw: string): string {
  let s = raw.toUpperCase().replace(/[\s\-_.]/g, '');
  if (s.startsWith(SEED_CODE_PREFIX) && s.length > SEED_CODE_CHARS) s = s.slice(SEED_CODE_PREFIX.length);
  return s.replace(/O/g, '0').replace(/[IL]/g, '1');
}

export function decodeSeed(raw: string): DecodeResult {
  const s = normalizeCode(raw);
  if (s.length === 0) return { ok: false, error: 'vacio' };
  if (s.length !== SEED_CODE_CHARS || [...s].some((c) => !SEED_ALPHABET.includes(c))) return { ok: false, error: 'formato' };
  const digits = [...s].map((c) => SEED_ALPHABET.indexOf(c));
  const data = digits.slice(0, DATA_CHARS);
  if (digits[10] * 32 + digits[11] !== checksum(data)) return { ok: false, error: 'suma' };
  const bits: number[] = [];
  for (const d of data) for (let b = 4; b >= 0; b--) bits.push((d >> b) & 1);
  const [version, mode, diff, starterId, seed] = fromBits(bits);
  if (version !== SEED_CODE_VERSION) return { ok: false, error: 'version' };
  // La Defensa de torres no tiene partidas con código
  if (mode >= MODES.length || MODES[mode] === 'towerdef' || diff >= DIFFICULTIES.length || starterId < 1) return { ok: false, error: 'datos' };
  return { ok: true, info: { seed, mode: MODES[mode], difficulty: DIFFICULTIES[diff], starterId } };
}

// --- Escribir con el mando: selector de letras ---

/** Letra siguiente (`d` = 1) o anterior (-1) en el selector del mando; desde un hueco vacío empieza por la A o el 0. */
export function cycleChar(c: string | undefined, d: number): string {
  const n = SEED_ALPHABET.length;
  const i = c ? SEED_ALPHABET.indexOf(c.toUpperCase()) : -1;
  if (i < 0) return SEED_ALPHABET[d > 0 ? 0 : n - 1];
  return SEED_ALPHABET[(((i + d) % n) + n) % n];
}

// --- Mejor resultado por código ---

/** Mejor resultado de cada código (pisos, rondas o jefes, como los récords), con la clave sin prefijo ni guiones. */
export type SeedBests = Record<string, number>;
/** Cuántos códigos se recuerdan (los más viejos se olvidan). */
export const SEED_BESTS_MAX = 50;

export function parseSeedBests(raw: string | null): SeedBests {
  const out: SeedBests = {};
  if (!raw) return out;
  try {
    const d: unknown = JSON.parse(raw);
    if (!d || typeof d !== 'object' || Array.isArray(d)) return out;
    for (const [k, v] of Object.entries(d as Record<string, unknown>)) {
      if (decodeSeed(k).ok && typeof v === 'number' && Number.isInteger(v) && v > 0) out[normalizeCode(k)] = v;
    }
  } catch {
    // corrupto: sin resultados
  }
  return out;
}

export const seedBest = (b: SeedBests, code: string): number => b[normalizeCode(code)] ?? 0;

/** Resultados con el nuevo (solo sube). El código mejorado pasa al final; si hay demasiados se olvidan los primeros. */
export function withSeedBest(b: SeedBests, code: string, value: number): { bests: SeedBests; improved: boolean } {
  const key = normalizeCode(code);
  const v = Number.isInteger(value) && value > 0 ? value : 0;
  if (!decodeSeed(key).ok || v <= (b[key] ?? 0)) return { bests: b, improved: false };
  const entries = Object.entries(b).filter(([k]) => k !== key);
  entries.push([key, v]);
  return { bests: Object.fromEntries(entries.slice(-SEED_BESTS_MAX)), improved: true };
}

/** Texto del mejor resultado de un código. */
export function seedBestText(mode: GameMode, value: number): string {
  return value > 0 ? recordText(mode, value).replace('Récord', 'Tu mejor resultado') : 'Aún no has jugado este código';
}
