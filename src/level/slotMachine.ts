// T68: sala de juegos. Una tragaperras que se juega con las monedas de la partida (nunca tickets ni caramelos).
// Lógica pura, sin Phaser: apuestas fijas, tres rodillos, premios por combinación y un pequeño azar de objeto.

/** Apuestas posibles, en monedas. */
export const SLOT_BETS = [3, 6, 12] as const;
export type SlotBet = (typeof SLOT_BETS)[number];

/** Tiradas máximas por sala: así no se convierte en una forma de pasar el rato (ni de vaciar la cartera). */
export const SLOT_MAX_SPINS = 8;
/** Probabilidad de que una tirada, además, dé un objeto. */
export const SLOT_ITEM_CHANCE = 0.05;

/** Símbolos y su peso en cada rodillo; el último es el de la suerte. */
export const SLOT_SYMBOLS = ['bola', 'baya', 'moneda', 'estrella', 'siete'] as const;
export type SlotSymbol = (typeof SLOT_SYMBOLS)[number];
export const SLOT_WEIGHTS: Record<SlotSymbol, number> = { bola: 28, baya: 24, moneda: 20, estrella: 16, siete: 12 };
export const LUCKY_SYMBOL: SlotSymbol = 'siete';

export type SlotOutcome = 'none' | 'pair' | 'trio' | 'lucky';

/** Lo que se devuelve por cada moneda apostada (la apuesta ya está pagada: «par» solo la recupera). */
export const SLOT_PAYOUT_MUL: Record<SlotOutcome, number> = { none: 0, pair: 1, trio: 5, lucky: 20 };

export const SLOT_OUTCOME_LABEL: Record<SlotOutcome, string> = {
  none: 'Nada',
  pair: 'Pareja: recuperas la apuesta',
  trio: 'Trío',
  lucky: '¡Trío de la suerte!',
};

export interface SlotResult {
  reels: [SlotSymbol, SlotSymbol, SlotSymbol];
  outcome: SlotOutcome;
  /** Monedas que devuelve la máquina (0 si no hay premio; incluye la apuesta en la pareja). */
  payout: number;
  /** Si además sale un objeto. */
  item: boolean;
}

const TOTAL_WEIGHT = SLOT_SYMBOLS.reduce((a, s) => a + SLOT_WEIGHTS[s], 0);

/** Un símbolo según los pesos; `x` en [0, 1). */
export function pickSymbol(x: number): SlotSymbol {
  let r = Math.min(0.999999, Math.max(0, x)) * TOTAL_WEIGHT;
  for (const s of SLOT_SYMBOLS) {
    if (r < SLOT_WEIGHTS[s]) return s;
    r -= SLOT_WEIGHTS[s];
  }
  return SLOT_SYMBOLS[0];
}

/** Combinación de tres rodillos. */
export function slotOutcome(reels: readonly SlotSymbol[]): SlotOutcome {
  const [a, b, c] = reels;
  if (a === b && b === c) return a === LUCKY_SYMBOL ? 'lucky' : 'trio';
  if (a === b || b === c || a === c) return 'pair';
  return 'none';
}

export const slotPayout = (outcome: SlotOutcome, bet: number): number => SLOT_PAYOUT_MUL[outcome] * bet;

/** Una tirada: siempre consume cuatro valores de `rng` (tres rodillos y el objeto). */
export function spinSlot(bet: number, rng: () => number): SlotResult {
  const reels: [SlotSymbol, SlotSymbol, SlotSymbol] = [pickSymbol(rng()), pickSymbol(rng()), pickSymbol(rng())];
  const outcome = slotOutcome(reels);
  return { reels, outcome, payout: slotPayout(outcome, bet), item: rng() < SLOT_ITEM_CHANCE };
}

/** Se puede jugar: apuesta válida, monedas suficientes y quedan tiradas. */
export function canSpin(coins: number, bet: number, spinsDone: number): boolean {
  return (SLOT_BETS as readonly number[]).includes(bet) && coins >= bet && spinsDone < SLOT_MAX_SPINS;
}

/** Valor esperado en monedas por moneda apostada (sin contar el objeto); tiene que ser menor que 1. */
export function slotExpectedReturn(): number {
  const p = (s: SlotSymbol) => SLOT_WEIGHTS[s] / TOTAL_WEIGHT;
  let ev = 0;
  for (const a of SLOT_SYMBOLS) for (const b of SLOT_SYMBOLS) for (const c of SLOT_SYMBOLS) {
    ev += p(a) * p(b) * p(c) * SLOT_PAYOUT_MUL[slotOutcome([a, b, c])];
  }
  return ev;
}
