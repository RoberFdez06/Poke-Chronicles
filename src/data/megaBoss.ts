// T66: megaevolución de los jefes (y «forma furia» para los legendarios que no tienen megaevolución en los juegos).
// Lógica pura, sin Phaser, para poder testearla. GameScene solo pregunta aquí cuándo, cuánto y cómo se llama.
import { megaFormName } from './powerForm.ts';

/**
 * Legendarios y singulares que sí tienen megaevolución en los juegos (Mewtwo X/Y, Latias, Latios, Kyogre y Groudon
 * primigenios, Rayquaza, Diancie) y las de Leyendas Z-A (Zygarde, Zeraora, Darkrai, Magearna, Marshadow…).
 * Los demás jefes usan la «forma furia»: misma lógica, otro nombre.
 */
export const MEGA_BOSS_IDS: ReadonlySet<number> = new Set([150, 380, 381, 382, 383, 384, 491, 718, 719, 801, 802, 807]);

/** Por debajo de este porcentaje de vida el jefe cambia de forma (coincide con la fase 2 de bossPatterns.ts). */
export const MEGA_AT = 0.5;
/** Aviso previo (y tiempo en que el jefe es invulnerable mientras cambia), ms. */
export const MEGA_WARN_MS = 1500;
/** Multiplicadores desde que cambia: daño y velocidad (sobre lo que ya tenga en fase 2). */
export const MEGA_DAMAGE_MUL = 1.25;
export const MEGA_SPEED_MUL = 1.15;
/** Ayudantes extra por invocación y por encima del máximo normal. */
export const MEGA_EXTRA_HELPERS = 2;

export type MegaKind = 'mega' | 'furia';

/** Formas mega de los singulares de Leyendas Z-A que no están en MEGA_FORMS (powerForm.ts). */
const EXTRA_BOSS_FORMS: ReadonlyMap<number, string> = new Map([
  [491, 'darkrai-mega'], [801, 'magearna-mega'], [802, 'marshadow-mega'], [807, 'zeraora-mega'],
]);
/** Especies con dos megas: el jefe sortea cuál (Mewtwo X/Y, Charizard X/Y). */
const DUAL_MEGA: ReadonlyMap<number, readonly [string, string]> = new Map([
  [150, ['mewtwo-mega-x', 'mewtwo-mega-y']], [6, ['charizard-mega-x', 'charizard-mega-y']],
]);

/**
 * Megaevoluciona (en vez de forma furia) cualquier jefe cuya especie tenga mega en los juegos, no solo los
 * legendarios de MEGA_BOSS_IDS: antes un Charizard jefe entraba en «forma furia».
 */
export const megaKind = (speciesId: number): MegaKind =>
  MEGA_BOSS_IDS.has(speciesId) || megaFormName(speciesId) !== null ? 'mega' : 'furia';

/** Forma mega en PokeAPI para el jefe (sprite), o null si es forma furia. Con dos megas, sortea con `rng`. */
export function bossMegaForm(speciesId: number, rng: () => number = Math.random): string | null {
  const dual = DUAL_MEGA.get(speciesId);
  if (dual) return dual[rng() < 0.5 ? 0 : 1];
  return megaFormName(speciesId) ?? EXTRA_BOSS_FORMS.get(speciesId) ?? null;
}

/**
 * Legendario de la cacería (T88): no es «jefe» para la IA, así que nunca pasaba por shouldMegaEvolve (por eso un
 * Mewtwo de la cacería no megaevolucionaba). Megaevoluciona al pasar a la fase 2 si su especie tiene mega.
 */
export const legendMegaAtPhase = (speciesId: number, phase: number): boolean => phase === 1 && megaKind(speciesId) === 'mega';

/** Nombre de la forma nueva para el aviso: «Mega Rayquaza» o «Zekrom (forma furia)». */
export function megaName(speciesId: number, name: string): string {
  return megaKind(speciesId) === 'mega' ? `Mega ${name}` : `${name} (forma furia)`;
}

/** Texto del aviso previo (fuera del centro). */
export function megaWarning(speciesId: number, name: string): string {
  return megaKind(speciesId) === 'mega' ? `¡${name} va a megaevolucionar!` : `¡${name} entra en forma furia!`;
}

export interface MegaState {
  /** Ya ha cambiado (o está cambiando): solo una vez por jefe. */
  done: boolean;
}

export interface MegaCandidate {
  boss: boolean;
  miniboss: boolean;
  /** Ayudantes invocados por un jefe: nunca megaevolucionan. */
  helper: boolean;
}

/** ¿Toca megaevolucionar ahora? Solo jefes (no minijefes ni ayudantes), al bajar de MEGA_AT y una sola vez. */
export function shouldMegaEvolve(state: MegaState, who: MegaCandidate, hpRatio: number): boolean {
  if (state.done || !who.boss || who.miniboss || who.helper) return false;
  return hpRatio > 0 && hpRatio < MEGA_AT;
}

/** ¿Es invulnerable ahora? Mientras dura el aviso del cambio. */
export const megaInvulnerable = (startedAt: number | undefined, now: number): boolean =>
  startedAt !== undefined && now >= startedAt && now < startedAt + MEGA_WARN_MS;

/** Ayudantes que invoca: los normales más los extra de la megaevolución, sin pasar del máximo ampliado. */
export function megaHelpersToSummon(base: number, maxHelpers: number, alive: number, mega: boolean): number {
  if (!mega) return Math.max(0, Math.min(base, maxHelpers - alive));
  return Math.max(0, Math.min(base + MEGA_EXTRA_HELPERS, maxHelpers + MEGA_EXTRA_HELPERS - alive));
}
