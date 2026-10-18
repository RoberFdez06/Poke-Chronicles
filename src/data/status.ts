// Estados que aplican los poderes según su tipo: quemar, congelar, paralizar, envenenar, drenar…
// Lógica pura, sin Phaser ni red, para poder testearla. Los tiempos van en milisegundos.

export type StatusKind =
  | 'burn'
  | 'freeze'
  | 'paralysis'
  | 'poison'
  | 'drain'
  | 'knockback'
  | 'confuse'
  | 'soak'
  | 'gust'
  | 'fury'
  | 'fear'
  | 'pierce'
  | 'weaken'
  | 'stun';

export interface StatusEffect {
  kind: StatusKind;
  /** Nombre que sale sobre el enemigo al aplicarlo. */
  label: string;
  /** Tinte del enemigo mientras dura. */
  color: number;
  duration: number;
  /** Daño por segundo, como fracción del daño del golpe que lo aplicó. */
  dpsFraction: number;
  /** Multiplicador de velocidad mientras dura (1 = normal). */
  slow: number;
}

export const STATUS_EFFECTS: Readonly<Record<StatusKind, StatusEffect>> = {
  burn: { kind: 'burn', label: '¡Quemado!', color: 0xff7f27, duration: 3000, dpsFraction: 0.25, slow: 1 },
  poison: { kind: 'poison', label: '¡Envenenado!', color: 0xb05ad8, duration: 5000, dpsFraction: 0.15, slow: 1 },
  freeze: { kind: 'freeze', label: '¡Congelado!', color: 0x9be7ff, duration: 2500, dpsFraction: 0, slow: 0.4 },
  paralysis: { kind: 'paralysis', label: '¡Paralizado!', color: 0xffe14d, duration: 3000, dpsFraction: 0, slow: 0.8 },
  soak: { kind: 'soak', label: '¡Empapado!', color: 0x7aa7ff, duration: 2500, dpsFraction: 0, slow: 0.7 },
  confuse: { kind: 'confuse', label: '¡Confuso!', color: 0xff8fc7, duration: 2500, dpsFraction: 0, slow: 1 },
  fear: { kind: 'fear', label: '¡Asustado!', color: 0x8a6f9e, duration: 1500, dpsFraction: 0, slow: 1 },
  weaken: { kind: 'weaken', label: '¡Debilitado!', color: 0xf4a6d0, duration: 4000, dpsFraction: 0, slow: 1 },
  stun: { kind: 'stun', label: '¡Aturdido!', color: 0xd8d8c0, duration: 300, dpsFraction: 0, slow: 0 },
  // Instantáneos: drenar cura al jugador y empujar aparta al enemigo; no se quedan en la lista
  drain: { kind: 'drain', label: '¡Drenado!', color: 0x7ac74c, duration: 0, dpsFraction: 0, slow: 1 },
  knockback: { kind: 'knockback', label: '¡Empujado!', color: 0xc8a165, duration: 0, dpsFraction: 0, slow: 1 },
  gust: { kind: 'gust', label: '¡Ráfaga!', color: 0xb9a6f5, duration: 0, dpsFraction: 0, slow: 1 },
  // Estos dos actúan al disparar o golpear (ver hitDamageMul y extraPierce), no sobre el enemigo
  fury: { kind: 'fury', label: '¡Furia!', color: 0x7b4dff, duration: 0, dpsFraction: 0, slow: 1 },
  pierce: { kind: 'pierce', label: '¡Atraviesa!', color: 0xb7b7ce, duration: 0, dpsFraction: 0, slow: 1 },
};

/** Qué estado aplica cada tipo (los que no salen aquí no aplican ninguno). */
export const STATUS_BY_TYPE: Readonly<Partial<Record<string, StatusKind>>> = {
  fire: 'burn',
  ice: 'freeze',
  electric: 'paralysis',
  poison: 'poison',
  grass: 'drain',
  bug: 'drain',
  water: 'soak',
  fighting: 'knockback',
  rock: 'knockback',
  ground: 'knockback',
  psychic: 'confuse',
  ghost: 'confuse',
  flying: 'gust',
  dragon: 'fury',
  dark: 'fear',
  steel: 'pierce',
  fairy: 'weaken',
  normal: 'stun',
};

/** Dragón: los poderes hacen un 25 % más de daño. */
export const FURY_BONUS = 1.25;
export const hitDamageMul = (type: string): number => (STATUS_BY_TYPE[type] === 'fury' ? FURY_BONUS : 1);

/** Acero: los poderes atraviesan un enemigo más. */
export const extraPierce = (type: string): number => (STATUS_BY_TYPE[type] === 'pierce' ? 1 : 0);

/** Hada: el enemigo debilitado hace un 30 % menos de daño. */
export const WEAKEN_FACTOR = 0.7;

/** Fuerza del empujón: Lucha, Roca y Tierra empujan; Volador, con viento, más lejos. */
export const KNOCKBACK_FORCE: Partial<Record<StatusKind, number>> = { knockback: 520, gust: 760 };

export function statusForType(type: string): StatusEffect | null {
  const k = STATUS_BY_TYPE[type];
  return k ? STATUS_EFFECTS[k] : null;
}

/** Fracción del daño que recupera el jugador con un golpe que drena. */
export const DRAIN_FRACTION = 0.3;
export const drainHeal = (damage: number): number => Math.max(1, Math.round(damage * DRAIN_FRACTION));

/** Cada cuánto hacen daño quemar y envenenar. */
export const TICK_MS = 500;
/** Paralizado: cada PARALYSIS_PERIOD ms se queda quieto durante PARALYSIS_STUN ms. */
export const PARALYSIS_PERIOD = 1000;
export const PARALYSIS_STUN = 400;
/** Los jefes resisten: nunca van más lentos que esto ni se quedan paralizados del todo. */
export const BOSS_MIN_SPEED = 0.7;

export interface ActiveStatus {
  kind: StatusKind;
  /** Cuándo empezó y cuándo acaba. */
  since: number;
  until: number;
  /** Daño por segundo (0 si no hace daño). */
  dps: number;
  nextTick: number;
}

/** Aplica un estado: los instantáneos no se guardan; uno que ya tenía se renueva (con el daño mayor). */
export function applyStatus(list: readonly ActiveStatus[], effect: StatusEffect, now: number, hitDamage: number): ActiveStatus[] {
  if (effect.duration <= 0) return [...list];
  const dps = effect.dpsFraction * hitDamage;
  const prev = list.find((s) => s.kind === effect.kind);
  const next: ActiveStatus = {
    kind: effect.kind,
    since: prev ? prev.since : now,
    until: now + effect.duration,
    dps: Math.max(dps, prev?.dps ?? 0),
    nextTick: prev ? prev.nextTick : now + TICK_MS,
  };
  return [...list.filter((s) => s.kind !== effect.kind), next];
}

/**
 * Avanza el tiempo: devuelve el daño que toca hacer ahora (quemar, envenenar) y la lista sin los
 * estados que han acabado.
 */
export function tickStatuses(list: readonly ActiveStatus[], now: number): { damage: number; list: ActiveStatus[] } {
  let damage = 0;
  const out: ActiveStatus[] = [];
  for (const s of list) {
    let { nextTick } = s;
    while (s.dps > 0 && nextTick <= now && nextTick <= s.until) {
      damage += (s.dps * TICK_MS) / 1000;
      nextTick += TICK_MS;
    }
    if (now < s.until) out.push({ ...s, nextTick });
  }
  return { damage, list: out };
}

const active = (list: readonly ActiveStatus[], now: number) => list.filter((s) => now < s.until);

/** Multiplicador de velocidad del enemigo con sus estados (el más fuerte manda; paralizado, a ratos 0). */
export function speedMultiplier(list: readonly ActiveStatus[], now: number, boss = false): number {
  let m = 1;
  for (const s of active(list, now)) {
    m = Math.min(m, STATUS_EFFECTS[s.kind].slow);
    if (s.kind === 'paralysis' && (now - s.since) % PARALYSIS_PERIOD < PARALYSIS_STUN) m = 0;
  }
  return boss ? Math.max(BOSS_MIN_SPEED, m) : m;
}

export const isConfused = (list: readonly ActiveStatus[], now: number): boolean =>
  active(list, now).some((s) => s.kind === 'confuse');

/** Siniestro: asustado, el enemigo huye de ti. */
export const isFeared = (list: readonly ActiveStatus[], now: number): boolean => active(list, now).some((s) => s.kind === 'fear');

/** Multiplicador del daño que hace el enemigo (debilitado por Hada: ×0,7). */
export const enemyDamageMul = (list: readonly ActiveStatus[], now: number): number =>
  active(list, now).some((s) => s.kind === 'weaken') ? WEAKEN_FACTOR : 1;

/** Tinte del enemigo: el del último estado aplicado que siga activo, o null. */
export function statusTint(list: readonly ActiveStatus[], now: number): number | null {
  const a = active(list, now);
  return a.length > 0 ? STATUS_EFFECTS[a[a.length - 1].kind].color : null;
}
