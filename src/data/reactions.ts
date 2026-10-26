// Reacciones de tipo (T76): un estado ya puesto + un golpe de otro tipo = reacción.
// Lógica pura, sin Phaser, para poder testearla. Los tiempos van en milisegundos.
import type { ActiveStatus, StatusKind } from './status.ts';

export type ReactionId = 'descarga' | 'ultrafrio' | 'vapor' | 'toxica' | 'deshielo' | 'anicos' | 'tomaTierra' | 'pesadilla';

export interface Reaction {
  id: ReactionId;
  /** Aviso corto sobre el enemigo. */
  name: string;
  /** Estado que debe tener ya el enemigo. */
  status: StatusKind;
  /** Tipo del ataque que la dispara. */
  attackType: string;
  /** Daño extra como fracción del daño del golpe. */
  damageMul: number;
  /** Radio del daño en área (0 = solo el enemigo golpeado). */
  radius: number;
  /** Enemigos cercanos a los que salta (descarga). */
  chain: number;
  /** Aturdimiento en ms (0 = nada). */
  stunMs: number;
  /** Estado que deja puesto tras la reacción. */
  applies?: StatusKind;
  /** Si gasta el estado que la provocó. */
  consumes: boolean;
  color: number;
  /** Qué hace, para la pausa. */
  description: string;
}

export const REACTIONS: readonly Reaction[] = [
  { id: 'descarga', name: '¡Descarga!', status: 'soak', attackType: 'electric', damageMul: 0.6, radius: 0, chain: 3, stunMs: 0, consumes: true, color: 0xffe14d, description: 'Empapado + Eléctrico: salta a enemigos cercanos' },
  { id: 'ultrafrio', name: '¡Ultrafrío!', status: 'soak', attackType: 'ice', damageMul: 0.3, radius: 0, chain: 0, stunMs: 0, applies: 'freeze', consumes: true, color: 0x9be7ff, description: 'Empapado + Hielo: congela al momento' },
  { id: 'vapor', name: '¡Vapor!', status: 'burn', attackType: 'water', damageMul: 0.4, radius: 0, chain: 0, stunMs: 700, consumes: true, color: 0xe0e8f0, description: 'Quemado + Agua: aturde un momento' },
  { id: 'toxica', name: '¡Explosión tóxica!', status: 'poison', attackType: 'fire', damageMul: 0.8, radius: 110, chain: 0, stunMs: 0, consumes: true, color: 0xb05ad8, description: 'Envenenado + Fuego: explota en área' },
  { id: 'deshielo', name: '¡Deshielo!', status: 'freeze', attackType: 'fire', damageMul: 1.2, radius: 0, chain: 0, stunMs: 0, consumes: true, color: 0xff7f27, description: 'Congelado + Fuego: derrite con daño extra' },
  { id: 'anicos', name: '¡Añicos!', status: 'freeze', attackType: 'rock', damageMul: 1, radius: 70, chain: 0, stunMs: 0, consumes: true, color: 0xc8a165, description: 'Congelado + Roca/Lucha: rompe el hielo en esquirlas' },
  { id: 'tomaTierra', name: '¡Toma de tierra!', status: 'paralysis', attackType: 'ground', damageMul: 0.9, radius: 0, chain: 0, stunMs: 400, consumes: true, color: 0xd9b45a, description: 'Paralizado + Tierra: descarga a tierra con daño' },
  { id: 'pesadilla', name: '¡Pesadilla!', status: 'confuse', attackType: 'dark', damageMul: 0.7, radius: 0, chain: 0, stunMs: 0, applies: 'fear', consumes: true, color: 0x8a6f9e, description: 'Confuso + Siniestro/Hada: asusta y hace daño' },
];

/** Tipos que cuentan como otro para las reacciones (Lucha rompe hielo como Roca; Hada, como Siniestro). */
const ALIAS: Readonly<Record<string, string>> = { fighting: 'rock', fairy: 'dark' };

/** No más de una reacción por enemigo cada este tiempo. */
export const REACTION_COOLDOWN = 1500;
/** Los jefes aguantan la mitad del daño de las reacciones. */
export const BOSS_REACTION_FACTOR = 0.5;

export const reactionById = (id: string): Reaction | undefined => REACTIONS.find((r) => r.id === id);

/** Reacción que provoca un golpe del tipo dado sobre un enemigo con esos estados (o null). */
export function findReaction(list: readonly ActiveStatus[], attackType: string, now: number): Reaction | null {
  const t = ALIAS[attackType] ?? attackType;
  for (const r of REACTIONS) {
    if (r.attackType === t && list.some((s) => s.kind === r.status && now < s.until)) return r;
  }
  return null;
}

/** ¿Puede reaccionar ya este enemigo? (`lastAt` = última reacción, o undefined). */
export const canReact = (lastAt: number | undefined, now: number): boolean => lastAt === undefined || now - lastAt >= REACTION_COOLDOWN;

/** Daño de la reacción (al menos 1), a la mitad contra jefes. */
export function reactionDamage(r: Reaction, hitDamage: number, boss: boolean): number {
  const d = Math.max(1, hitDamage * r.damageMul);
  return boss ? d * BOSS_REACTION_FACTOR : d;
}

/** Quita el estado gastado por la reacción. */
export function consumeStatus(list: readonly ActiveStatus[], r: Reaction): ActiveStatus[] {
  return r.consumes ? list.filter((s) => s.kind !== r.status) : [...list];
}

/** Añade una reacción a las descubiertas (sin repetir, en el orden de la tabla). */
export function discover(found: readonly ReactionId[], id: ReactionId): ReactionId[] {
  if (found.includes(id)) return [...found];
  const set = new Set([...found, id]);
  return REACTIONS.map((r) => r.id).filter((x) => set.has(x));
}

/** Línea para la pausa con las reacciones descubiertas. */
export function discoveredLine(found: readonly ReactionId[]): string {
  if (found.length === 0) return 'Reacciones: ninguna todavía';
  return `Reacciones (${found.length}/${REACTIONS.length}): ` + found.map((id) => reactionById(id)!.name.replace(/[¡!]/g, '')).join(' · ');
}
