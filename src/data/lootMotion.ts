// T54: Lluvia de botín. Las monedas, bayas, llaves, bombas y pociones salen despedidas con un salto, rebotan un par
// de veces y se quedan quietas; si te acercas, vuelan hacia ti. Lógica pura, sin Phaser: la escena solo dibuja el
// sprite en (x, y - z) y le pasa la posición del jugador.
//
// El desplazamiento por el suelo no es una velocidad libre sino un acercamiento a un punto de destino (`tx`, `ty`)
// que la escena elige libre de rocas y agujeros. Así el salto queda vistoso pero el botín acaba siempre en un sitio
// donde se puede coger, y además se recorta a los límites de la sala (como los activos de T49): nunca sale de ella.

/** Gravedad del salto (px/s²) y velocidad vertical al salir (px/s, con algo de azar). */
export const LOOT_GRAVITY = 900;
export const LOOT_LAUNCH_VZ = 280;
export const LOOT_LAUNCH_VZ_RANDOM = 80;
/** Lo que conserva cada bote (fracción de la velocidad vertical) y por debajo de cuánto deja de botar. */
export const LOOT_BOUNCE = 0.45;
export const LOOT_REST_VZ = 60;
/** Rapidez con la que se acerca a su destino por el suelo (1/s): con 4, a los 0,7 s del primer bote ya casi ha llegado. */
export const LOOT_SLIDE_RATE = 4;
/** Distancia a la que sale despedido desde donde cae (px). */
export const LOOT_SCATTER_MIN = 18;
export const LOOT_SCATTER_MAX = 56;
/** Radio de atracción sin objetos (px, pequeño: hay que acercarse) y velocidad de vuelo hacia el jugador (px/s). */
export const LOOT_MAGNET_BASE = 70;
export const LOOT_PULL_MIN = 180;
export const LOOT_PULL_MAX = 560;

export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface LootBody {
  /** Posición en el suelo y destino al que se acerca. */
  x: number;
  y: number;
  tx: number;
  ty: number;
  /** Altura sobre el suelo (px) y su velocidad (px/s, positiva hacia arriba). */
  z: number;
  vz: number;
  /** Ya tocó el suelo una vez (desde entonces se puede atraer: el primer salto siempre se ve). */
  landed: boolean;
  /** Quieto en el suelo: ya no bota (la escena le pone el balanceo de siempre). */
  resting: boolean;
  /** Límites de su sala (con margen), para no salir nunca de ella. */
  bounds: Bounds;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Recorta un punto a los límites. */
export const clampToBounds = (x: number, y: number, b: Bounds): { x: number; y: number } => ({
  x: clamp(x, b.x0, b.x1),
  y: clamp(y, b.y0, b.y1),
});

/** Punto al que sale despedido desde (x, y): una dirección y distancia al azar, dentro de la sala. */
export function scatterTarget(x: number, y: number, rng: () => number, b: Bounds): { x: number; y: number } {
  const a = rng() * Math.PI * 2;
  const d = LOOT_SCATTER_MIN + rng() * (LOOT_SCATTER_MAX - LOOT_SCATTER_MIN);
  return clampToBounds(x + Math.cos(a) * d, y + Math.sin(a) * d, b);
}

/** Botín que acaba de caer en (x, y) y sale despedido hacia (tx, ty). */
export function launchLoot(x: number, y: number, tx: number, ty: number, rng: () => number, bounds: Bounds): LootBody {
  const p = clampToBounds(x, y, bounds);
  const t = clampToBounds(tx, ty, bounds);
  return { x: p.x, y: p.y, tx: t.x, ty: t.y, z: 0, vz: LOOT_LAUNCH_VZ + rng() * LOOT_LAUNCH_VZ_RANDOM, landed: false, resting: false, bounds };
}

/** Botín que ya estaba en el suelo (al volver a una sala o al continuar la partida): quieto desde el principio. */
export function restingLoot(x: number, y: number, bounds: Bounds): LootBody {
  const p = clampToBounds(x, y, bounds);
  return { x: p.x, y: p.y, tx: p.x, ty: p.y, z: 0, vz: 0, landed: true, resting: true, bounds };
}

/** Radio de atracción con el bonus de los objetos (Zahorí). */
export const magnetRadius = (bonus: number): number => LOOT_MAGNET_BASE + Math.max(0, bonus);

/** A quién atraer: posición del jugador, radio y si puede cogerlo (una baya con la vida llena no vuela hacia ti). */
export interface Pull {
  x: number;
  y: number;
  radius: number;
  wanted: boolean;
}

/**
 * Avanza `dt` segundos. Devuelve true si este paso lo está atrayendo el jugador (la escena quita entonces el
 * balanceo para que no tiemble mientras vuela).
 */
export function stepLoot(b: LootBody, dt: number, pull?: Pull): boolean {
  // Salto y botes: gravedad sobre la altura; al tocar el suelo rebota con menos fuerza hasta quedarse quieto
  if (!b.resting || b.z > 0) {
    b.vz -= LOOT_GRAVITY * dt;
    b.z += b.vz * dt;
    if (b.z <= 0) {
      b.z = 0;
      b.landed = true;
      const up = -b.vz * LOOT_BOUNCE;
      if (up > LOOT_REST_VZ) b.vz = up;
      else {
        b.vz = 0;
        b.resting = true;
      }
    }
  }
  let pulled = false;
  if (pull && pull.wanted && b.landed) {
    const dx = pull.x - b.x;
    const dy = pull.y - b.y;
    const d = Math.hypot(dx, dy);
    if (d < pull.radius) {
      pulled = true;
      // Más rápido cuanto más cerca, como si lo absorbiera; el destino pasa a ser donde está ahora
      const speed = LOOT_PULL_MIN + (1 - d / pull.radius) * (LOOT_PULL_MAX - LOOT_PULL_MIN);
      const step = Math.min(d, speed * dt);
      if (d > 0) {
        b.x += (dx / d) * step;
        b.y += (dy / d) * step;
      }
      b.tx = b.x;
      b.ty = b.y;
    }
  }
  if (!pulled) {
    // Desliza hacia el destino (exponencial: no se pasa y no depende de los fotogramas por segundo)
    const k = 1 - Math.exp(-LOOT_SLIDE_RATE * dt);
    b.x += (b.tx - b.x) * k;
    b.y += (b.ty - b.y) * k;
  }
  const c = clampToBounds(b.x, b.y, b.bounds);
  b.x = c.x;
  b.y = c.y;
  return pulled;
}
