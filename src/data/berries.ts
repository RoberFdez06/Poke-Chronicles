// T85: huerto de bayas. En el menú principal hay parcelas donde plantas semillas de baya (salen en cofres y tiendas);
// crecen por partidas jugadas (no por reloj) y al recogerlas van a la cesta. Al empezar una partida te llevas
// algunas de la cesta y se usan solas en el momento justo: curan, dan escudo o llenan la adrenalina.
// Lógica pura, sin Phaser. El guardado está en save.ts (GARDEN_KEY).

export type GardenBerryId = 'aranja' | 'gonlan' | 'aslac';
export type GardenEffect = 'heal' | 'shield' | 'adrenaline';

export interface GardenBerry {
  id: GardenBerryId;
  name: string;
  effect: GardenEffect;
  /** Partidas que tarda en madurar desde que se planta. */
  growRuns: number;
  /** Bayas que da al recogerla. */
  yield: number;
  /** Cuándo se usa sola en la partida y qué hace (para el huerto). */
  description: string;
  /** Color liso de la baya y su parcela (TODO(supervisor): arte). */
  color: number;
}

export const GARDEN_BERRIES: Readonly<Record<GardenBerryId, GardenBerry>> = {
  aranja: { id: 'aranja', name: 'Baya Aranja', effect: 'heal', growRuns: 1, yield: 2, color: 0x4f8fe0,
    description: 'Cura 25 PS sola cuando te quedan pocos.' },
  gonlan: { id: 'gonlan', name: 'Baya Gonlan', effect: 'shield', growRuns: 2, yield: 2, color: 0x8e7cc3,
    description: 'Al entrar en la sala del jefe, escudo que para 2 golpes.' },
  aslac: { id: 'aslac', name: 'Baya Aslac', effect: 'adrenaline', growRuns: 3, yield: 2, color: 0x6ab04c,
    description: 'Al entrar en la sala del jefe, llena la adrenalina.' },
};

export const GARDEN_BERRY_IDS: readonly GardenBerryId[] = ['aranja', 'gonlan', 'aslac'];
export const isGardenBerry = (id: unknown): id is GardenBerryId => typeof id === 'string' && (GARDEN_BERRY_IDS as readonly string[]).includes(id);

/** Parcelas del huerto. */
export const GARDEN_PLOTS = 4;
/** Bayas de la cesta que te llevas a cada partida. */
export const GARDEN_CARRY = 3;
/** Curación de la Baya Aranja del huerto y golpes que para la Baya Gonlan. */
export const GARDEN_HEAL = 25;
export const GARDEN_SHIELD = 2;
/** La Aranja se come sola al bajar de esta fracción de PS. */
export const GARDEN_HEAL_AT = 0.35;

export interface Plot {
  berry: GardenBerryId;
  /** Partidas jugadas desde que se plantó. */
  runs: number;
}

export interface GardenState {
  v: 1;
  plots: (Plot | null)[];
  /** Semillas por plantar. */
  seeds: Record<GardenBerryId, number>;
  /** Bayas recogidas que esperan a la siguiente partida. */
  basket: Record<GardenBerryId, number>;
}

const zero = (): Record<GardenBerryId, number> => ({ aranja: 0, gonlan: 0, aslac: 0 });

/** Huerto nuevo: vacío y con una semilla de Aranja para empezar. */
export const emptyGarden = (): GardenState => ({ v: 1, plots: Array(GARDEN_PLOTS).fill(null), seeds: { ...zero(), aranja: 1 }, basket: zero() });

const count = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.min(999, Math.floor(n)) : 0);

function counts(raw: unknown): Record<GardenBerryId, number> {
  const out = zero();
  if (raw && typeof raw === 'object') for (const id of GARDEN_BERRY_IDS) out[id] = count((raw as Record<string, unknown>)[id]);
  return out;
}

export function parseGarden(raw: string | null): GardenState {
  try {
    const d = raw ? JSON.parse(raw) : null;
    if (!d || d.v !== 1) return emptyGarden();
    const plots = Array.from({ length: GARDEN_PLOTS }, (_, k): Plot | null => {
      const p = Array.isArray(d.plots) ? d.plots[k] : null;
      const berry: unknown = p?.berry;
      if (!isGardenBerry(berry)) return null;
      return { berry, runs: Math.min(GARDEN_BERRIES[berry].growRuns, count(p.runs)) };
    });
    return { v: 1, plots, seeds: counts(d.seeds), basket: counts(d.basket) };
  } catch {
    return emptyGarden();
  }
}

export const isRipe = (p: Plot | null): boolean => !!p && p.runs >= GARDEN_BERRIES[p.berry].growRuns;

/** Partidas que le faltan a una parcela (0 = lista para recoger). */
export const runsLeft = (p: Plot): number => Math.max(0, GARDEN_BERRIES[p.berry].growRuns - p.runs);

/** Planta una semilla en una parcela vacía. null si no se puede (parcela ocupada o sin semillas). */
export function plant(state: GardenState, plot: number, berry: GardenBerryId): GardenState | null {
  if (plot < 0 || plot >= state.plots.length || state.plots[plot] || state.seeds[berry] <= 0) return null;
  const plots = [...state.plots];
  plots[plot] = { berry, runs: 0 };
  return { ...state, plots, seeds: { ...state.seeds, [berry]: state.seeds[berry] - 1 } };
}

/** Ha terminado una partida: todo lo plantado crece un paso (sin pasarse de maduro). */
export function growGarden(state: GardenState): GardenState {
  return {
    ...state,
    plots: state.plots.map((p) => (p ? { ...p, runs: Math.min(GARDEN_BERRIES[p.berry].growRuns, p.runs + 1) } : null)),
  };
}

/** Recoge una parcela madura: sus bayas van a la cesta y la parcela queda libre. */
export function harvest(state: GardenState, plot: number): { state: GardenState; berry: GardenBerryId; amount: number } | null {
  const p = state.plots[plot];
  if (!p || !isRipe(p)) return null;
  const plots = [...state.plots];
  plots[plot] = null;
  const amount = GARDEN_BERRIES[p.berry].yield;
  return { state: { ...state, plots, basket: { ...state.basket, [p.berry]: state.basket[p.berry] + amount } }, berry: p.berry, amount };
}

/** Semilla conseguida en un cofre o una tienda. */
export const addSeed = (state: GardenState, berry: GardenBerryId, n = 1): GardenState =>
  ({ ...state, seeds: { ...state.seeds, [berry]: Math.min(999, state.seeds[berry] + n) } });

/** Semilla al azar: la Aranja es la más común. */
export function rollSeed(rng: () => number): GardenBerryId {
  const r = rng();
  return r < 0.5 ? 'aranja' : r < 0.8 ? 'gonlan' : 'aslac';
}

/** Probabilidad de semilla al abrir un cofre y al comprar en la tienda. */
export const SEED_CHANCE = { chest: 0.4, shop: 0.3 } as const;

/** Al empezar una partida: saca de la cesta hasta GARDEN_CARRY bayas, una de cada tipo por turnos. */
export function takeBasket(state: GardenState, max = GARDEN_CARRY): { state: GardenState; berries: GardenBerryId[] } {
  const basket = { ...state.basket };
  const berries: GardenBerryId[] = [];
  let any = true;
  while (berries.length < max && any) {
    any = false;
    for (const id of GARDEN_BERRY_IDS) {
      if (berries.length >= max) break;
      if (basket[id] > 0) {
        basket[id]--;
        berries.push(id);
        any = true;
      }
    }
  }
  return { state: { ...state, basket }, berries };
}

/** Quita una baya de la lista que llevas (la primera de ese tipo). Devuelve la lista nueva o null si no la llevas. */
export function useCarried(list: readonly GardenBerryId[], berry: GardenBerryId): GardenBerryId[] | null {
  const k = list.indexOf(berry);
  if (k < 0) return null;
  return [...list.slice(0, k), ...list.slice(k + 1)];
}

/** ¿Toca comerse la Aranja? Con pocos PS (y sin estar a tope). */
export const shouldAutoHeal = (hp: number, maxHp: number): boolean => hp > 0 && hp <= maxHp * GARDEN_HEAL_AT;
