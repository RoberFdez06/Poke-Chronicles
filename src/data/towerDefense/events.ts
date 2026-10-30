// Defensa de torres: eventos aleatorios de oleada (niebla, tormenta, desvío, oleada doble, veloces, lluvia de monedas).
// Los fija la semilla del mapa (id + nivel + oleada): la misma partida trae siempre los mismos y así se puede
// probar. La escena los avisa arriba durante la preparación y enseña lo que les queda. Lógica pura, sin Phaser.
import { hashStr } from './chiefs.ts';

export const WAVE_EVENTS = ['niebla', 'tormenta', 'desvio', 'doble', 'veloces', 'monedas'] as const;
export type WaveEventId = (typeof WAVE_EVENTS)[number];

export interface WaveEventInfo {
  name: string;
  desc: string;
  /** Segundos que dura desde que empieza la oleada (Infinity: toda la oleada). */
  duration: number;
  color: number;
}

export const WAVE_EVENT_INFO: Readonly<Record<WaveEventId, WaveEventInfo>> = {
  niebla: { name: 'Niebla', desc: 'Alcance de las torres −30 %', duration: 30, color: 0xb8c0cc },
  tormenta: { name: 'Tormenta', desc: 'Caen rayos en casillas marcadas: dañan enemigos y aturden torres', duration: 30, color: 0xffd34d },
  desvio: { name: 'Camino desviado', desc: 'Todos entran por la misma entrada', duration: Infinity, color: 0xff9a4a },
  doble: { name: 'Oleada doble', desc: 'El doble de enemigos (más débiles) y +50 % de premio', duration: Infinity, color: 0xe53935 },
  veloces: { name: 'Enemigos veloces', desc: 'Van un 35 % más rápido; +25 % de dinero por baja', duration: 25, color: 0x8fe39a },
  monedas: { name: 'Lluvia de monedas', desc: '+60 % de dinero por cada baja', duration: 25, color: 0xffd34d },
};

export const FOG_RANGE = 0.7;
export const FAST_MUL = 1.35;
export const FAST_BOUNTY = 1.25;
export const COIN_BOUNTY = 1.6;
export const DOUBLE_HP = 0.6;
export const DOUBLE_BONUS = 1.5;
/** Tormenta: un rayo cada X s, avisado Y s antes, en un radio de Z casillas. */
export const STORM_EVERY = 3.2;
export const STORM_WARN = 1.3;
export const STORM_RADIUS = 1.1;
export const STORM_STUN = 2.5;
export const stormDamage = (wave: number): number => Math.round(40 + 14 * wave);
/** Probabilidad de evento en una oleada normal (no en la 1 ni en las de jefe). */
export const EVENT_CHANCE = 0.38;

/**
 * Evento de una oleada, o null. `paths`: caminos del mapa (el desvío solo con 2 o más). `bossy`: oleada de jefe
 * (sin eventos, para que el jefe sea el protagonista).
 */
export function waveEventFor(mapId: string, level: number, wave: number, paths: number, bossy: boolean): WaveEventId | null {
  if (wave < 2 || bossy) return null;
  const h = hashStr(`${mapId}|${level}|${wave}|evento`);
  if ((h % 1000) / 1000 >= EVENT_CHANCE) return null;
  const pool = WAVE_EVENTS.filter((e) => e !== 'desvio' || paths >= 2);
  return pool[(h >>> 10) % pool.length];
}

/** Entrada por la que va todo el mundo en el desvío. */
export const detourPath = (mapId: string, wave: number, paths: number): number => hashStr(`${mapId}|${wave}|desvio`) % Math.max(1, paths);
