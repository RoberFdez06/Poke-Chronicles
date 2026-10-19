// Misiones diarias y logros (T24). Lógica pura: la partida manda "sucesos" (enemigo vencido, cofre abierto…),
// aquí se cuenta el progreso, se ve qué se ha completado y qué premio da. El guardado está en save.ts.

import { mulberry32 } from '../level/floorGen.ts';

/** Lo que pasa en una partida y puede contar para una misión o un logro. */
export type MissionEvent =
  | { kind: 'defeat'; types: readonly string[] }
  | { kind: 'boss' }
  | { kind: 'chest' }
  | { kind: 'coins'; amount: number }
  | { kind: 'room' }
  | { kind: 'item' }
  | { kind: 'shiny' }
  /** Has llegado a un piso; `healed` = te has curado en algún momento de la partida. */
  | { kind: 'floor'; floor: number; healed: boolean }
  /** Has completado todos los pisos. */
  | { kind: 'win' };

export interface Reward {
  tickets: number;
  /** Pokémon que se desbloquea (id de Pokédex). */
  pokemon?: number;
  /** Su nombre, para el aviso (Eevee y Dratini se llaman igual en español). */
  pokemonName?: string;
  /** Objeto pasivo que pasa a salir en el suelo y en la tienda. */
  item?: string;
}

/** Cuánto suma un suceso a una misión o un logro (0 = no cuenta). */
type Counter = (e: MissionEvent) => number;

export interface DailyMission {
  id: string;
  text: string;
  goal: number;
  reward: Reward;
  count: Counter;
}

export interface Achievement {
  id: string;
  name: string;
  text: string;
  goal: number;
  reward: Reward;
  count: Counter;
}

/** Tipos de las misiones de "vence enemigos de tipo X" (los más comunes en los pisos). */
export const MISSION_TYPES: readonly [string, string][] = [
  ['water', 'Agua'], ['fire', 'Fuego'], ['grass', 'Planta'], ['normal', 'Normal'], ['bug', 'Bicho'],
  ['poison', 'Veneno'], ['flying', 'Volador'], ['electric', 'Eléctrico'], ['ground', 'Tierra'], ['rock', 'Roca'],
];

/** Mayor piso alcanzado sin curarse que cuenta como "1" si llega al objetivo. */
const reachedNoHeal = (floor: number): Counter => (e) => (e.kind === 'floor' && !e.healed && e.floor >= floor ? 1 : 0);
const each = (kind: MissionEvent['kind']): Counter => (e) => (e.kind === kind ? 1 : 0);

/** Plantillas de misión diaria: cada una se concreta con un número al azar (con la semilla del día). */
const DAILY_TEMPLATES: ((rng: () => number) => DailyMission)[] = [
  (rng) => {
    const [type, name] = MISSION_TYPES[Math.floor(rng() * MISSION_TYPES.length)];
    const goal = 8 + Math.floor(rng() * 3) * 2;
    return {
      id: `tipo-${type}`,
      text: `Vence a ${goal} enemigos de tipo ${name}`,
      goal,
      reward: { tickets: 4 },
      count: (e) => (e.kind === 'defeat' && e.types.includes(type) ? 1 : 0),
    };
  },
  (rng) => {
    const goal = 2 + Math.floor(rng() * 2);
    return { id: 'sin-curar', text: `Llega al piso ${goal} sin curarte`, goal: 1, reward: { tickets: 5 }, count: reachedNoHeal(goal) };
  },
  (rng) => {
    const goal = 2 + Math.floor(rng() * 2);
    return { id: 'cofres', text: `Abre ${goal} cofres`, goal, reward: { tickets: 4 }, count: each('chest') };
  },
  (rng) => {
    const goal = 30 + Math.floor(rng() * 3) * 10;
    return { id: 'monedas', text: `Recoge ${goal} monedas`, goal, reward: { tickets: 3 }, count: (e) => (e.kind === 'coins' ? e.amount : 0) };
  },
  (rng) => {
    const goal = 1 + Math.floor(rng() * 2);
    return { id: 'jefes', text: goal === 1 ? 'Derrota a un jefe' : `Derrota a ${goal} jefes`, goal, reward: { tickets: 5 }, count: each('boss') };
  },
  (rng) => {
    const goal = 8 + Math.floor(rng() * 3) * 2;
    return { id: 'salas', text: `Limpia ${goal} salas`, goal, reward: { tickets: 3 }, count: each('room') };
  },
  (rng) => {
    const goal = 3 + Math.floor(rng() * 2);
    return { id: 'objetos', text: `Coge ${goal} objetos`, goal, reward: { tickets: 3 }, count: each('item') };
  },
  (rng) => {
    const goal = 25 + Math.floor(rng() * 3) * 5;
    return { id: 'enemigos', text: `Vence a ${goal} enemigos`, goal, reward: { tickets: 3 }, count: each('defeat') };
  },
];

export const DAILY_COUNT = 3;

/** Las 3 misiones de un día (número de día local, ver gacha.ts `dayNumber`): siempre las mismas ese día. */
export function dailyMissions(day: number): DailyMission[] {
  const rng = mulberry32((Math.imul(day, 2654435761) ^ 0x6d15) >>> 0);
  const pool = [...DAILY_TEMPLATES];
  const out: DailyMission[] = [];
  while (out.length < DAILY_COUNT && pool.length > 0) {
    const [tpl] = pool.splice(Math.floor(rng() * pool.length), 1);
    out.push(tpl(rng));
  }
  return out;
}

/** Logros permanentes. Algunos desbloquean un Pokémon o un objeto nuevo en el sorteo. */
export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'primer-jefe', name: 'Primer legendario', text: 'Derrota a tu primer jefe', goal: 1, reward: { tickets: 5 }, count: each('boss') },
  { id: 'cazador', name: 'Cazador', text: 'Vence a 300 enemigos', goal: 300, reward: { tickets: 10, item: 'cinta-elegida' }, count: each('defeat') },
  { id: 'cofres', name: 'Buscatesoros', text: 'Abre 15 cofres', goal: 15, reward: { tickets: 8, item: 'moneda-amuleto' }, count: each('chest') },
  { id: 'intocable', name: 'Intocable', text: 'Llega al piso 3 sin curarte', goal: 1, reward: { tickets: 8, item: 'banda-focus' }, count: reachedNoHeal(3) },
  { id: 'explorador', name: 'Explorador', text: 'Llega al piso 4', goal: 1, reward: { tickets: 8, pokemon: 133, pokemonName: 'Eevee' },
    count: (e) => (e.kind === 'floor' && e.floor >= 4 ? 1 : 0) },
  { id: 'brillante', name: 'Brillo', text: 'Encuentra un Pokémon shiny', goal: 1, reward: { tickets: 10 }, count: each('shiny') },
  { id: 'matajefes', name: 'Domador de leyendas', text: 'Derrota a 10 jefes', goal: 10, reward: { tickets: 15, item: 'gafas-elegidas' }, count: each('boss') },
  { id: 'campeon', name: 'Campeón', text: 'Completa todos los pisos', goal: 1, reward: { tickets: 20, pokemon: 147, pokemonName: 'Dratini' }, count: each('win') },
  { id: 'ahorrador', name: 'Ahorrador', text: 'Recoge 1000 monedas', goal: 1000, reward: { tickets: 10 }, count: (e) => (e.kind === 'coins' ? e.amount : 0) },
];

/** Objetos que no salen hasta conseguir el logro que los da. */
export const LOCKED_ITEMS: readonly string[] = ACHIEVEMENTS.flatMap((a) => (a.reward.item ? [a.reward.item] : []));

/** Lo guardado: progreso de las diarias de un día y de los logros. */
export interface MissionState {
  v: 1;
  /** Día de las diarias guardadas; si cambia, empiezan de cero. */
  day: number;
  daily: number[];
  achievements: Record<string, number>;
}

export const emptyMissions = (day: number): MissionState => ({ v: 1, day, daily: Array(DAILY_COUNT).fill(0), achievements: {} });

export function parseMissions(raw: string | null, day: number): MissionState {
  try {
    const d = raw ? JSON.parse(raw) : null;
    if (!d || d.v !== 1 || typeof d.achievements !== 'object' || d.achievements === null) return emptyMissions(day);
    const achievements: Record<string, number> = {};
    for (const a of ACHIEVEMENTS) {
      const n = d.achievements[a.id];
      if (typeof n === 'number' && Number.isFinite(n) && n > 0) achievements[a.id] = Math.min(a.goal, n);
    }
    const sameDay = d.day === day && Array.isArray(d.daily);
    const daily = Array.from({ length: DAILY_COUNT }, (_, k) => {
      const n = sameDay ? d.daily[k] : 0;
      return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
    });
    return { v: 1, day, daily, achievements };
  } catch {
    return emptyMissions(day);
  }
}

export interface Completed {
  kind: 'daily' | 'achievement';
  id: string;
  /** Texto para el aviso en partida. */
  text: string;
  reward: Reward;
}

/**
 * Suma un suceso. Devuelve el estado nuevo (no toca el de entrada) y lo que se acaba de completar.
 * Si el día ha cambiado, las diarias empiezan de cero antes de sumar.
 */
export function applyMissionEvent(state: MissionState, e: MissionEvent, day: number): { state: MissionState; completed: Completed[] } {
  const next: MissionState =
    state.day === day
      ? { ...state, daily: [...state.daily], achievements: { ...state.achievements } }
      : { ...emptyMissions(day), achievements: { ...state.achievements } };
  const completed: Completed[] = [];
  dailyMissions(day).forEach((m, k) => {
    const before = next.daily[k] ?? 0;
    if (before >= m.goal) return;
    const after = Math.min(m.goal, before + m.count(e));
    next.daily[k] = after;
    if (after >= m.goal) completed.push({ kind: 'daily', id: m.id, text: m.text, reward: m.reward });
  });
  for (const a of ACHIEVEMENTS) {
    const before = next.achievements[a.id] ?? 0;
    if (before >= a.goal) continue;
    const n = a.count(e);
    if (n <= 0) continue;
    const after = Math.min(a.goal, before + n);
    next.achievements[a.id] = after;
    if (after >= a.goal) completed.push({ kind: 'achievement', id: a.id, text: a.name, reward: a.reward });
  }
  return { state: next, completed };
}

export const isAchieved = (state: MissionState, id: string): boolean => {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  return !!a && (state.achievements[id] ?? 0) >= a.goal;
};

/** Objetos bloqueados que aún no has desbloqueado con su logro. */
export function lockedItems(state: MissionState): Set<string> {
  return new Set(ACHIEVEMENTS.filter((a) => a.reward.item && !isAchieved(state, a.id)).map((a) => a.reward.item!));
}

/** Texto corto del premio: "+5 tickets · Eevee". */
export function rewardText(r: Reward, names: { item?: string } = {}): string {
  const parts = [`+${r.tickets} tickets`];
  if (r.pokemon) parts.push(`desbloquea ${r.pokemonName ?? `#${r.pokemon}`}`);
  if (r.item) parts.push(`nuevo objeto: ${names.item ?? r.item}`);
  return parts.join(' · ');
}
