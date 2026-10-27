// Cómo se mueve cada Pokémon cuando solo tiene dibujo fijo (sin hoja de animación de SpriteCollab): en vez del mismo
// saltito para todos, anda, vuela, flota o nada según su tipo. Pura (sin Phaser) para poder probarla.

export type Locomotion = 'walk' | 'fly' | 'swim' | 'float';

export interface LocomotionProfile {
  /** Cuánto sube el dibujo (px) al moverse; `bounce` = |sin| (pasos) y si no, sin (ondulación suave). */
  lift: number;
  bounce: boolean;
  /** Velocidad de la fase (más alto = más lento). */
  slow: number;
  /** Balanceo al moverse (grados) y en reposo. */
  tilt: number;
  idleTilt: number;
  /** Subida/bajada continua también en reposo (volar, flotar): px. */
  idleLift: number;
}

export function locomotionOf(types: readonly string[]): Locomotion {
  if (types.includes('flying')) return 'fly';
  if (types.includes('ghost') || types.includes('psychic')) return 'float';
  if (types.includes('water')) return 'swim';
  return 'walk';
}

export const LOCOMOTION_PROFILES: Readonly<Record<Locomotion, LocomotionProfile>> = {
  // Andar: pasitos cortos con balanceo de lado a lado (cada pie).
  walk: { lift: 1.6, bounce: true, slow: 70, tilt: 6, idleTilt: 1.6, idleLift: 0 },
  // Volar: aleteo suave, sube y baja sin golpes y casi no se inclina; en reposo sigue planeando.
  fly: { lift: 3.2, bounce: false, slow: 120, tilt: 3, idleTilt: 1, idleLift: 2.2 },
  // Nadar: ondula de lado a lado como si remara, sin saltar.
  swim: { lift: 0.8, bounce: false, slow: 95, tilt: 9, idleTilt: 2.4, idleLift: 0.8 },
  // Flotar: deriva despacio arriba y abajo, sin inclinarse.
  float: { lift: 2.6, bounce: false, slow: 150, tilt: 1.5, idleTilt: 0.6, idleLift: 2.6 },
};

export function locomotionProfile(types: readonly string[]): LocomotionProfile {
  return LOCOMOTION_PROFILES[locomotionOf(types)];
}
