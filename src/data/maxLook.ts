// Aspecto del Dinamax/Gigamax del jugador (lógica pura, sin Phaser): a qué tamaño se pinta para que cada píxel del
// dibujo ocupe un número entero de píxeles de pantalla (nada de píxeles de dos anchos ni bordes borrosos), con un
// tope según lo que mide de verdad el dibujo (los sprites de PokeAPI traen mucho aire alrededor; los de SpriteCollab,
// según la especie, también) y el andar pesado de gigante: pasos más lentos, más altos y que caen de golpe.

import type { LocoPose } from './locomotion.ts';

/** Píxeles de la imagen que ocupan los de los dibujos de SpriteCollab con displaySize = 1 (pmdScale = size·0,8/32). */
export const PMD_UNIT = 0.8 / 32;

export interface MaxFitInput {
  /** Lado de la textura (px de imagen): 96 en PokeAPI; en SpriteCollab se usa PMD_UNIT y no hace falta. */
  texSize: number;
  /** Tamaño de pantalla normal del jugador (84) y cuánto crece (sizeMul de la forma). */
  baseSize: number;
  sizeMul: number;
  /** Zoom de la cámara (GAME_ZOOM): la escala buena es la que da enteros en pantalla. */
  zoom: number;
  /** Alto de los píxeles visibles del dibujo (px de imagen), o null si no se sabe. */
  contentH: number | null;
  /** Alto máximo del dibujo visible en el mundo (px): que no tape media sala. */
  maxContentH: number;
}

/**
 * Tamaño (el `size` de setStaticLook/applyPmd) del gigante: el normal × sizeMul, recortado para que lo visible no
 * pase de maxContentH, y redondeado a la escala con píxeles enteros en pantalla más cercana (nunca más pequeño que
 * un paso por encima del tamaño normal, para que se note que ha crecido).
 */
export function maxFitSize(o: MaxFitInput): number {
  const want = o.baseSize * Math.max(1, o.sizeMul);
  let scale = want / o.texSize;
  if (o.contentH && o.contentH > 0) scale = Math.min(scale, o.maxContentH / o.contentH);
  const baseScreen = (o.baseSize / o.texSize) * o.zoom;
  let screen = Math.round(scale * o.zoom);
  // al menos un píxel de pantalla más por píxel de dibujo que el tamaño normal (si no, no se nota)
  screen = Math.max(screen, Math.floor(baseScreen) + 1);
  return (screen / o.zoom) * o.texSize;
}

/** Igual para las hojas de SpriteCollab: su textura «unidad» es PMD_UNIT (el size → escala de pmdScale). */
export const maxFitSizePmd = (o: Omit<MaxFitInput, 'texSize'>): number => maxFitSize({ ...o, texSize: 1 / PMD_UNIT });

/** Andar pesado: el reloj de la animación va más despacio (pasos lentos) y la hoja de SpriteCollab también. */
export const MAX_GAIT = { timeMul: 0.6, sheetRate: 0.65 } as const;

/**
 * Pose del gigante a partir de la normal: pasos más altos (lift × liftMul) y menos balanceo (un gigante no se
 * tambalea como un Pokémon pequeño). Volando o flotando solo se exagera un poco la subida y se frena el giro.
 */
export function heavyPose(p: LocoPose, sizeMul: number, grounded: boolean): LocoPose {
  const liftMul = 1 + (Math.max(1, sizeMul) - 1) * 1.6;
  if (!grounded) return { ...p, lift: p.lift * (1 + (liftMul - 1) * 0.5), angle: p.angle * 0.6 };
  return { ...p, lift: p.lift * liftMul, angle: p.angle * 0.7 };
}

/** ¿Acaba de pisar? (de subir a estar en el suelo entre dos fotogramas): para el polvo y el temblor de cada paso. */
export const stomped = (prevLift: number, lift: number, threshold = 0.6): boolean => prevLift > threshold && lift <= threshold;
