// Cómo se mueve cada Pokémon cuando solo tiene dibujo fijo (sin hoja de animación de SpriteCollab): en vez del mismo
// saltito para todos, anda, vuela, nada, repta, bota, rueda o flota según la especie (listas de abajo) y, si no está
// en ninguna, según su tipo. `locoPose` da la pose de cada fotograma (subida, giro, estiramiento y sombra) para que
// nunca parezca que se desliza. Pura (sin Phaser) para poder probarla.

export type Locomotion = 'walk' | 'fly' | 'swim' | 'float' | 'slither' | 'hop' | 'roll';

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
  /** Aplastar y estirar en cada paso (0 = nada, 0,1 = un 10 %). */
  squash: number;
  /** Vaivén lateral (px) al moverse: reptar y nadar. */
  sway: number;
}

const ids = (...n: number[]): ReadonlySet<number> => new Set(n);

/** Vuelan aunque no sean de tipo volador (alas, levitan con alas, insectos voladores…). */
export const FLYING_SPECIES = ids(
  12, 15, 49, 123, 165, 166, 193, 267, 269, 291, 313, 314, 329, 330, 380, 381, 384, 414, 416, 469, 545, 637, 666, 715,
  743, 795, 796, 845, 873, 1006, 10, 166,
);
/** Tienen tipo volador pero andan (aves corredoras, etc.). */
export const WALKING_FLIERS = ids(84, 85, 83, 865, 10166, 701, 441, 627, 628, 933, 931, 396);
/** Flotan en el aire sin alas (gas, imanes, piedras, espíritus…). */
export const FLOATING_SPECIES = ids(
  81, 82, 92, 93, 109, 110, 10167, 120, 121, 137, 200, 201, 337, 338, 343, 344, 355, 358, 374, 375, 376, 385, 386,
  433, 436, 437, 442, 462, 474, 479, 480, 481, 482, 487, 488, 489, 490, 491, 492, 494, 562, 563, 10179, 592, 593,
  599, 600, 601, 605, 606, 615, 622, 649, 669, 670, 671, 677, 708, 710, 711, 769, 770, 772, 774, 781, 789, 790, 791,
  792, 800, 802, 854, 855, 870, 880, 881, 882, 883, 888, 889, 890, 905, 999, 1000, 251, 151, 150,
);
/** Nadan (peces y otros acuáticos sin patas). */
export const SWIMMING_SPECIES = ids(
  72, 73, 90, 91, 116, 117, 118, 119, 129, 130, 131, 138, 139, 140, 141, 170, 171, 211, 222, 10173, 223, 224, 226,
  230, 318, 319, 320, 321, 339, 340, 341, 342, 349, 350, 366, 367, 368, 369, 370, 382, 456, 457, 458, 489, 490, 550,
  592, 593, 594, 690, 691, 746, 747, 748, 779, 846, 847, 882, 883, 977, 963, 964,
);
/** Reptan (serpientes, gusanos y dragones serpiente). */
export const SLITHERING_SPECIES = ids(
  23, 24, 95, 147, 148, 206, 208, 336, 350, 384, 495, 496, 497, 559, 602, 603, 604, 718, 843, 844, 840, 841, 842,
  10, 13, 265, 266, 290, 401, 543, 736, 767, 951, 966, 967, 968, 1024,
);
/** Botan como pelotas o masas blandas. */
export const HOPPING_SPECIES = ids(
  39, 40, 132, 174, 183, 184, 187, 188, 189, 202, 298, 325, 326, 360, 363, 438, 527, 577, 578, 579, 682, 685, 702, 778,
  60, 61, 194, 54, 79, 10164, 316, 317, 351, 439, 868, 869, 931,
);
/** Ruedan (bolas sin patas). */
export const ROLLING_SPECIES = ids(100, 101, 10109, 74, 204, 205, 213, 299, 327, 524, 557, 568, 616, 751, 835, 837);

export function locomotionOf(types: readonly string[], species?: number): Locomotion {
  if (species !== undefined) {
    if (ROLLING_SPECIES.has(species)) return 'roll';
    if (SLITHERING_SPECIES.has(species)) return 'slither';
    if (HOPPING_SPECIES.has(species)) return 'hop';
    if (SWIMMING_SPECIES.has(species)) return 'swim';
    if (FLOATING_SPECIES.has(species)) return 'float';
    if (FLYING_SPECIES.has(species)) return 'fly';
    if (WALKING_FLIERS.has(species)) return 'walk';
  }
  if (types.includes('flying')) return 'fly';
  if (types.includes('ghost')) return 'float';
  // Sin especie (o sin estar en las listas) el agua nada; con especie conocida, los de agua con patas andan
  if (types.includes('water') && species === undefined) return 'swim';
  return 'walk';
}

export const LOCOMOTION_PROFILES: Readonly<Record<Locomotion, LocomotionProfile>> = {
  // Andar: pasitos cortos con balanceo de lado a lado (cada pie) y un poco de aplastar/estirar al pisar.
  walk: { lift: 2.2, bounce: true, slow: 70, tilt: 6, idleTilt: 1.6, idleLift: 0, squash: 0.07, sway: 0 },
  // Volar: aleteo (sube y baja deprisa con estiramiento), casi no se inclina; en reposo sigue planeando.
  fly: { lift: 3.4, bounce: false, slow: 55, tilt: 3, idleTilt: 1, idleLift: 3, squash: 0.06, sway: 0 },
  // Nadar: ondula de lado a lado como si remara, sin saltar.
  swim: { lift: 0.8, bounce: false, slow: 95, tilt: 9, idleTilt: 2.4, idleLift: 0.8, squash: 0.04, sway: 1.5 },
  // Flotar: deriva despacio arriba y abajo, sin inclinarse.
  float: { lift: 2.6, bounce: false, slow: 150, tilt: 1.5, idleTilt: 0.6, idleLift: 2.6, squash: 0.03, sway: 0.8 },
  // Reptar: se estira y se encoge a ras de suelo con vaivén lateral.
  slither: { lift: 0.3, bounce: false, slow: 80, tilt: 5, idleTilt: 1.2, idleLift: 0, squash: 0.1, sway: 2.4 },
  // Botar: saltos altos, se aplasta al caer y se estira al subir.
  hop: { lift: 5, bounce: true, slow: 95, tilt: 2, idleTilt: 0.8, idleLift: 0, squash: 0.14, sway: 0 },
  // Rodar: gira sobre sí mismo (tilt = grados por fase) con un botecito.
  roll: { lift: 0.8, bounce: true, slow: 60, tilt: 0, idleTilt: 0.6, idleLift: 0, squash: 0.03, sway: 0 },
};

export function locomotionProfile(types: readonly string[], species?: number): LocomotionProfile {
  return LOCOMOTION_PROFILES[locomotionOf(types, species)];
}

export interface LocoPose {
  /** Subida del dibujo (px). */
  lift: number;
  /** Ángulo (grados). */
  angle: number;
  /** Multiplicadores de escala (aplastar/estirar). */
  sx: number;
  sy: number;
  /** Desplazamiento lateral (px). */
  dx: number;
  /** Escala de la sombra (1 = normal; menor si está en el aire). */
  shadow: number;
}

/**
 * Pose de un fotograma. `t` en ms, `seed` desfasa a cada Pokémon, `dir` (-1/1) da el sentido de giro al rodar.
 * Andar: dos pasos por ciclo (|sin|), al tocar el suelo se aplasta y en lo alto se estira; el cuerpo se balancea
 * hacia el pie que pisa. Volar: aleteo (sin) con estiramiento al subir y sombra que se encoge. Nadar y reptar: ondula
 * de lado. Flotar: deriva lenta. Botar: saltos con aplastado. Rodar: gira.
 */
export function locoPose(loco: Locomotion, t: number, moving: boolean, seed = 0, dir = 1): LocoPose {
  const p = LOCOMOTION_PROFILES[loco];
  const ph = t / p.slow + seed;
  const idle = { lift: 0, angle: 0, sx: 1, sy: 1, dx: 0, shadow: 1 };
  if (!moving) {
    const breathe = Math.sin(t / 420 + seed);
    const glide = p.idleLift > 0 ? ((Math.sin(t / 380 + seed) + 1) / 2) * p.idleLift : 0;
    return {
      ...idle,
      lift: glide,
      angle: breathe * p.idleTilt,
      // Respira: se hincha un poquito
      sx: 1 + breathe * 0.012,
      sy: 1 - breathe * 0.012,
      shadow: 1 - glide * 0.04,
    };
  }
  const s = Math.sin(ph);
  if (p.bounce) {
    const up = Math.abs(s); // 0 en el suelo, 1 arriba
    const contact = 1 - up;
    const st = (up - contact) * p.squash; // arriba se estira, en el suelo se aplasta
    return {
      lift: up * p.lift,
      angle: loco === 'roll' ? ((ph * 57) % 360) * dir : s * p.tilt,
      sx: 1 - st * 0.8,
      sy: 1 + st,
      dx: 0,
      shadow: 1 - up * Math.min(0.35, p.lift * 0.05),
    };
  }
  const wave = (s + 1) / 2;
  const flap = loco === 'fly' ? Math.sin(ph * 2) : s; // las alas baten el doble de rápido que sube y baja
  return {
    lift: wave * p.lift + (loco === 'fly' || loco === 'float' ? p.idleLift : 0),
    angle: Math.sin(ph + Math.PI / 2) * p.tilt,
    sx: 1 + flap * p.squash * (loco === 'slither' ? 1 : -0.6),
    sy: 1 - flap * p.squash * (loco === 'slither' ? 0.6 : -1),
    dx: Math.sin(ph + Math.PI / 2) * p.sway,
    shadow: loco === 'fly' || loco === 'float' ? 0.7 - wave * 0.15 : 1,
  };
}

/** Para los que sí tienen hoja animada: vuelo y flotación por encima de la hoja (que a veces apenas se mueve). */
export function sheetHover(loco: Locomotion, t: number, moving: boolean, seed = 0): { lift: number; shadow: number } {
  if (loco !== 'fly' && loco !== 'float') return { lift: 0, shadow: 1 };
  const base = loco === 'fly' ? 6 : 4;
  const amp = loco === 'fly' ? (moving ? 3 : 2.2) : 2;
  const wave = (Math.sin(t / (loco === 'fly' ? (moving ? 160 : 260) : 380) + seed) + 1) / 2;
  const lift = base + wave * amp;
  return { lift, shadow: Math.max(0.55, 0.8 - wave * 0.15) };
}
