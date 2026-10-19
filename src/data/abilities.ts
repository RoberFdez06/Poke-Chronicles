// Habilidades de PokeAPI (T27): tu Pokémon juega con su habilidad real y un efecto pasivo sencillo.
// Lógica pura: qué habilidad toca, su nombre en español y su efecto. Las que no tienen efecto propio dan una
// pequeña mejora genérica.
import type { PlayerStats } from './items.ts';

export interface AbilityEffect {
  /** Nombre en español (el de los juegos). */
  name: string;
  description: string;
  /** Cambios en las estadísticas (como un objeto pasivo). */
  apply?: (s: PlayerStats) => void;
  /** Mar Llamas y compañía: con poca vida, más daño con los ataques de ese tipo. */
  pinch?: { type: string; mul: number };
  /** Levitación: cruzas los agujeros. */
  levitate?: boolean;
}

/** Por debajo de esta fracción de PS se activan Mar Llamas, Espesura, Torrente y Enjambre (como en los juegos). */
export const PINCH_AT = 1 / 3;

const pinch = (name: string, type: string, typeEs: string): AbilityEffect => ({
  name,
  description: `Con menos de 1/3 de PS, +50 % de daño de tipo ${typeEs}.`,
  pinch: { type, mul: 1.5 },
});

/** Habilidades con efecto propio, por su nombre en PokeAPI. */
export const ABILITY_EFFECTS: Readonly<Record<string, AbilityEffect>> = {
  blaze: pinch('Mar Llamas', 'fire', 'Fuego'),
  overgrow: pinch('Espesura', 'grass', 'Planta'),
  torrent: pinch('Torrente', 'water', 'Agua'),
  swarm: pinch('Enjambre', 'bug', 'Bicho'),
  intimidate: { name: 'Intimidación', description: 'Los enemigos te hacen un 15 % menos de daño.', apply: (s) => void (s.damageTaken *= 0.85) },
  levitate: { name: 'Levitación', description: 'Flotas: cruzas los agujeros.', levitate: true },
  'sand-veil': { name: 'Velo Arena', description: 'Un 10 % de esquivar los golpes.', apply: (s) => void (s.dodge = Math.min(0.5, s.dodge + 0.1)) },
  'snow-cloak': { name: 'Manto Níveo', description: 'Un 10 % de esquivar los golpes.', apply: (s) => void (s.dodge = Math.min(0.5, s.dodge + 0.1)) },
  'cute-charm': { name: 'Gran Encanto', description: 'Un 6 % de esquivar los golpes.', apply: (s) => void (s.dodge = Math.min(0.5, s.dodge + 0.06)) },
  static: { name: 'Elec. Estática', description: 'Quien te toca recibe 15 de daño.', apply: (s) => void (s.thorns += 15) },
  'flame-body': { name: 'Cuerpo Llama', description: 'Quien te toca recibe 15 de daño.', apply: (s) => void (s.thorns += 15) },
  'poison-point': { name: 'Punto Tóxico', description: 'Quien te toca recibe 15 de daño.', apply: (s) => void (s.thorns += 15) },
  'effect-spore': { name: 'Efecto Espora', description: 'Quien te toca recibe 15 de daño.', apply: (s) => void (s.thorns += 15) },
  'rough-skin': { name: 'Piel Tosca', description: 'Quien te toca recibe 25 de daño.', apply: (s) => void (s.thorns += 25) },
  'iron-barbs': { name: 'Punta Acero', description: 'Quien te toca recibe 25 de daño.', apply: (s) => void (s.thorns += 25) },
  'keen-eye': { name: 'Vista Lince', description: 'Tus disparos llegan un 20 % más lejos.', apply: (s) => void (s.range *= 1.2) },
  'compound-eyes': { name: 'Ojo Compuesto', description: 'Más alcance y un 5 % de golpes críticos.', apply: (s) => void ((s.range *= 1.1), (s.critChance += 0.05)) },
  'super-luck': { name: 'Afortunado', description: '+10 % de probabilidad de crítico.', apply: (s) => void (s.critChance += 0.1) },
  sniper: { name: 'Francotirador', description: 'Tus críticos hacen más daño.', apply: (s) => void (s.critMul += 0.5) },
  'run-away': { name: 'Fuga', description: 'Te mueves un 10 % más rápido.', apply: (s) => void (s.speed *= 1.1) },
  'speed-boost': { name: 'Impulso', description: 'Te mueves un 15 % más rápido.', apply: (s) => void (s.speed *= 1.15) },
  chlorophyll: { name: 'Clorofila', description: 'Te mueves un 12 % más rápido.', apply: (s) => void (s.speed *= 1.12) },
  'swift-swim': { name: 'Nado Rápido', description: 'Te mueves un 12 % más rápido.', apply: (s) => void (s.speed *= 1.12) },
  'huge-power': { name: 'Potencia', description: 'Tus disparos hacen un 40 % más de daño.', apply: (s) => void (s.damage *= 1.4) },
  'pure-power': { name: 'Energía Pura', description: 'Tus disparos hacen un 40 % más de daño.', apply: (s) => void (s.damage *= 1.4) },
  guts: { name: 'Agallas', description: 'Tus disparos hacen un 15 % más de daño.', apply: (s) => void (s.damage *= 1.15) },
  hustle: { name: 'Entusiasmo', description: '+25 % de daño, pero disparas algo más lento.', apply: (s) => void ((s.damage *= 1.25), (s.fireDelay *= 1.08)) },
  technician: { name: 'Experto', description: 'Tus poderes hacen un 15 % más de daño.', apply: (s) => void (s.powerMul *= 1.15) },
  adaptability: { name: 'Adaptable', description: 'Tus poderes hacen un 25 % más de daño.', apply: (s) => void (s.powerMul *= 1.25) },
  'skill-link': { name: 'Encadenado', description: 'Tus disparos rebotan una vez en las paredes.', apply: (s) => void (s.bounces += 1) },
  sturdy: { name: 'Robustez', description: 'Una vez por piso aguantas con 1 PS un golpe mortal.', apply: (s) => void (s.focusBand += 1) },
  'thick-fat': { name: 'Sebo', description: 'Recibes un 10 % menos de daño.', apply: (s) => void (s.damageTaken *= 0.9) },
  'shell-armor': { name: 'Caparazón', description: 'Recibes un 10 % menos de daño.', apply: (s) => void (s.damageTaken *= 0.9) },
  'battle-armor': { name: 'Armadura Batalla', description: 'Recibes un 10 % menos de daño.', apply: (s) => void (s.damageTaken *= 0.9) },
  'shield-dust': { name: 'Polvo Escudo', description: 'Recibes un 8 % menos de daño.', apply: (s) => void (s.damageTaken *= 0.92) },
  'natural-cure': { name: 'Cura Natural', description: 'Recuperas 5 PS al limpiar una sala.', apply: (s) => void (s.healOnClear += 5) },
  'rain-dish': { name: 'Cura Lluvia', description: 'Recuperas 5 PS al limpiar una sala.', apply: (s) => void (s.healOnClear += 5) },
  regenerator: { name: 'Regeneración', description: 'Recuperas 8 PS al limpiar una sala.', apply: (s) => void (s.healOnClear += 8) },
  pickup: { name: 'Recogida', description: 'Las monedas valen un 50 % más.', apply: (s) => void (s.coinMul *= 1.5) },
};

/** Mejora pequeña para las habilidades sin efecto propio. */
export const GENERIC_EFFECT = { description: 'Tus disparos hacen un 5 % más de daño.', apply: (s: PlayerStats) => void (s.damage *= 1.05) };

/** Habilidad que se usa: la primera que no es oculta (como un Pokémon normal de los juegos). */
export function pickAbility(list: readonly { name: string; hidden: boolean; slot: number }[]): string | null {
  const visible = list.filter((a) => !a.hidden).sort((a, b) => a.slot - b.slot);
  return (visible[0] ?? [...list].sort((a, b) => a.slot - b.slot)[0])?.name ?? null;
}

export interface Ability extends AbilityEffect {
  /** Nombre en PokeAPI (p. ej. "blaze"). */
  id: string;
}

/** La habilidad con su efecto; `nameEs` es el nombre en español de PokeAPI para las que no están en la tabla. */
export function abilityFor(id: string, nameEs?: string): Ability {
  const known = ABILITY_EFFECTS[id];
  if (known) return { id, ...known };
  const pretty = id.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
  return { id, name: nameEs && nameEs !== id ? nameEs : pretty, ...GENERIC_EFFECT };
}

/** Multiplicador de daño de un ataque de `type` con estos PS (Mar Llamas…). */
export function pinchMul(a: Ability | null | undefined, type: string, hp: number, maxHp: number): number {
  return a?.pinch && a.pinch.type === type && hp < maxHp * PINCH_AT ? a.pinch.mul : 1;
}
