// Modos de juego: Normal, Oleadas, Infinito, Rush de jefes y Torre (T72). Récords y reglas de cada modo.
// Lógica pura, sin Phaser ni red, para poder testearla.
import type { Floor, RoomKind } from '../level/floorGen.ts';
import { bossArenaFloor } from '../level/floorGen.ts';
import { FLOOR_COUNT } from '../level/progression.ts';
// Constante copiada aquí (y comprobada en tests/tower.test.ts) para no importar tower.ts, que arrastra biomes.ts y crearía un ciclo
export const TOWER_FLOORS = 100;

export const MODES = ['normal', 'waves', 'endless', 'bossrush', 'tower', 'towerdef'] as const;
export type GameMode = (typeof MODES)[number];

/** Modos que se juegan en GameScene (la Defensa de torres tiene su propia escena). */
export const RUN_MODES = MODES.filter((m) => m !== 'towerdef');
export const isRunMode = (m: unknown): m is GameMode => isMode(m) && m !== 'towerdef';

export const isMode = (m: unknown): m is GameMode => typeof m === 'string' && (MODES as readonly string[]).includes(m);

export const MODE_LABEL: Record<GameMode, string> = {
  normal: 'Normal',
  waves: 'Oleadas',
  endless: 'Infinito',
  bossrush: 'Rush de jefes',
  tower: 'Torre',
  towerdef: 'Defensa de torres',
};

// Función (y no constante) porque save.ts importa este módulo y progression.ts importa save.ts:
// así FLOOR_COUNT nunca se lee mientras se cargan los módulos
export function modeDesc(mode: GameMode): string {
  switch (mode) {
    case 'normal':
      return `${FLOOR_COUNT} pisos con salas, objetos y un jefe legendario en cada uno.`;
    case 'waves':
      return 'Una sola sala y rondas de enemigos cada vez más duras. Cae un objeto cada 3 rondas.';
    case 'endless':
      return 'Pisos sin fin, cada vez más difíciles, hasta que caigas.';
    case 'bossrush':
      return 'Solo jefes legendarios, uno detrás de otro. Un objeto entre jefe y jefe.';
    case 'tower':
      return `${TOWER_FLOORS} pisos de una sola sala: minijefe cada 5, jefe y descanso cada 10.`;
    case 'towerdef':
      return 'Coloca y mejora a los Pokémon de tu colección como torres para frenar las oleadas en 16 mapas.';
  }
}

/** Qué cuenta el número `floor` de la partida en cada modo (el piso, la ronda o el jefe por el que vas). */
export const PROGRESS_LABEL: Record<GameMode, string> = {
  normal: 'Piso',
  waves: 'Ronda',
  endless: 'Piso',
  bossrush: 'Jefe',
  tower: 'Piso',
  towerdef: 'Oleada',
};

/** Texto de progreso para el HUD, la pausa y los huecos. */
export function progressText(mode: GameMode, n: number): string {
  if (mode === 'normal' && n > FLOOR_COUNT) return 'Reto final';
  if (mode === 'tower') return `Piso ${n}/${TOWER_FLOORS}`;
  return mode === 'normal' ? `Piso ${n}/${FLOOR_COUNT}` : `${PROGRESS_LABEL[mode]} ${n}`;
}

/** Normal y Torre acaban al completar el último piso; el resto, solo al caer. */
export const isLastStage = (mode: GameMode, n: number): boolean =>
  (mode === 'normal' && n >= FLOOR_COUNT) || (mode === 'tower' && n >= TOWER_FLOORS);

// --- Oleadas ---

/** Cada cuántas rondas cae un objeto. */
export const WAVE_ITEM_EVERY = 3;

export interface WaveSpec {
  /** Nivel de dificultad (como el número de piso): sube cada 3 rondas. */
  level: number;
  /** Enemigos de la ronda. */
  count: number;
}

export function waveSpec(round: number): WaveSpec {
  const r = Math.max(1, Math.floor(round));
  return { level: 1 + Math.floor((r - 1) / WAVE_ITEM_EVERY), count: Math.min(12, 2 + Math.ceil(r * 0.8)) };
}

/** Al completar la ronda `round`, ¿cae un objeto? */
export const waveDropsItem = (round: number): boolean => round > 0 && round % WAVE_ITEM_EVERY === 0;

/** Tickets por ronda completada en Oleadas (menos que una sala, porque son más seguidas). */
export const waveTickets = (round: number): number => 1 + Math.floor(Math.max(0, Math.floor(round)) / 5);

// --- Sala única para Oleadas y Rush de jefes ---

/** "Piso" de una sola sala, sin puertas: arena de combate (Oleadas) o del jefe (Rush). */
export function arenaFloor(seed: number, kind: Extract<RoomKind, 'combat' | 'boss'>): Floor {
  // Toda arena de jefe es una sala grande de 4 a 9 casillas
  if (kind === 'boss') return bossArenaFloor(seed);
  return {
    seed,
    cols: 1,
    rows: 1,
    rooms: [{ id: 0, gx: 0, gy: 0, kind, depth: 0, doors: {} }],
    startId: 0,
    itemId: 0,
    bossId: 0,
  };
}

// --- Récords ---

/** Récord de cada modo: pisos completados (Normal, Infinito), rondas superadas (Oleadas) o jefes vencidos (Rush). */
export type Records = Record<GameMode, number>;

export const emptyRecords = (): Records => ({ normal: 0, waves: 0, endless: 0, bossrush: 0, tower: 0, towerdef: 0 });

export function parseRecords(raw: string | null): Records {
  const out = emptyRecords();
  if (!raw) return out;
  try {
    const d: unknown = JSON.parse(raw);
    if (d && typeof d === 'object') {
      for (const m of MODES) {
        const v = (d as Record<string, unknown>)[m];
        if (typeof v === 'number' && Number.isInteger(v) && v > 0) out[m] = v;
      }
    }
  } catch {
    // corrupto: récords a 0
  }
  return out;
}

/** Récords con el nuevo resultado (solo sube). */
export function withRecord(r: Records, mode: GameMode, value: number): { records: Records; improved: boolean } {
  const v = Number.isInteger(value) && value > 0 ? value : 0;
  if (v <= r[mode]) return { records: r, improved: false };
  return { records: { ...r, [mode]: v }, improved: true };
}

export function recordText(mode: GameMode, value: number): string {
  if (value <= 0) return 'Sin récord';
  switch (mode) {
    case 'normal':
      return value >= FLOOR_COUNT ? `Récord: ¡completado!` : `Récord: ${value}/${FLOOR_COUNT} pisos`;
    case 'endless':
      return `Récord: ${value} ${value === 1 ? 'piso' : 'pisos'}`;
    case 'waves':
      return `Récord: ${value} ${value === 1 ? 'ronda' : 'rondas'}`;
    case 'bossrush':
      return `Récord: ${value} ${value === 1 ? 'jefe' : 'jefes'}`;
    case 'tower':
      return value >= TOWER_FLOORS ? '¡Torre completada!' : `Récord: piso ${value}/${TOWER_FLOORS}`;
    case 'towerdef':
      return `Récord: ${value} ${value === 1 ? 'estrella' : 'estrellas'}`;
  }
}
