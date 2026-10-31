// Cinemáticas cortas del resto de formas de poder del jugador (Teracristal, Dinamax/Gigamax y Movimiento Z): tiempos,
// fases y valores de cada instante (lógica pura, sin Phaser). Mismo lenguaje que megaCinematic.ts (mundo congelado,
// zoom hacia el Pokémon, temblor, destello y vuelta de la cámara con megaCamRestore), pero cada una con su guion:
//  · Tera: el cristal crece desde el suelo y encierra al Pokémon, brilla, estalla en esquirlas y deja la corona.
//  · Dinamax: la nube roja sube y crece, el Pokémon se agranda a golpes (con rebote) y ruge con la onda roja.
//  · Z: pose agachado, el Cristal Z sube sobre la cabeza y concentra la energía del tipo, y se libera de un estirón.
// GameScene la conduce con formCineFrame() y la pinta con drawFormCine (ui/art/formCineFx.ts).

export type FormCineKind = 'tera' | 'max' | 'z';

export const FORM_CINE_PHASES = {
  tera: ['zoom', 'crystal', 'shine', 'shatter', 'release'],
  max: ['zoom', 'storm', 'grow', 'roar', 'release'],
  z: ['zoom', 'pose', 'charge', 'unleash', 'release'],
} as const;

export type FormCinePhase<K extends FormCineKind = FormCineKind> = (typeof FORM_CINE_PHASES)[K][number] | 'done';

export interface FormCinePlan {
  kind: FormCineKind;
  /** Duración total (ms). */
  total: number;
  /** Fin de cada fase (ms desde el inicio), en el orden de FORM_CINE_PHASES[kind]. */
  ends: number[];
  /** Zoom extra máximo sobre el de la sala (1 = nada). */
  zoomPeak: number;
  /** Temblor máximo (fracción de la vista, como camera.shake). */
  shakePeak: number;
}

/** Fines de fase (ms) completos y con efectos bajos. Todas entre 1,5 y 2 s; reducidas, menos de 1 s. */
const ENDS: Record<FormCineKind, { full: number[]; low: number[]; zoom: [number, number]; shake: [number, number] }> = {
  tera: { full: [280, 1000, 1300, 1520, 1800], low: [100, 420, 560, 680, 800], zoom: [1.4, 1.06], shake: [0.008, 0.003] },
  max: { full: [260, 820, 1420, 1650, 1950], low: [100, 340, 600, 720, 850], zoom: [1.3, 1.04], shake: [0.016, 0.005] },
  z: { full: [220, 800, 1260, 1460, 1700], low: [80, 300, 520, 640, 750], zoom: [1.5, 1.08], shake: [0.012, 0.004] },
};

export function formCinePlan(kind: FormCineKind, low: boolean): FormCinePlan {
  const d = ENDS[kind];
  const ends = (low ? d.low : d.full).slice();
  return { kind, total: ends[ends.length - 1], ends, zoomPeak: d.zoom[low ? 1 : 0], shakePeak: d.shake[low ? 1 : 0] };
}

export interface FormCineFrame {
  phase: FormCinePhase;
  /** Índice de la fase (0-4; 5 = fin). */
  index: number;
  /** Avance dentro de la fase (0-1) y total (0-1). */
  k: number;
  total: number;
  /** Multiplicador de zoom sobre el de la sala y temblor de este instante. */
  zoom: number;
  shake: number;
  /** Cuánto se ha formado el efecto principal (cristal, nube, energía): 0-1. */
  build: number;
  /** Destello blanco sobre el sprite (0-1). */
  white: number;
  /** Escala del sprite: Dinamax, de 1/sizeMul (tamaño normal) a 1 (gigante) con rebote; el resto, pulso cerca de 1. */
  grow: number;
  /** Aplastar/estirar vertical del sprite (1 = normal): la pose Z se agacha y se estira al liberarse. */
  squash: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeInOut = (v: number) => (v < 0.5 ? 2 * v * v : 1 - (-2 * v + 2) ** 2 / 2);
/** Sale de 0 y llega a 1 pasándose un poco (muelle) y volviendo. */
const easeOutBack = (v: number) => {
  const c1 = 1.9, c3 = c1 + 1;
  return 1 + c3 * (v - 1) ** 3 + c1 * (v - 1) ** 2;
};

export function formCinePhaseIndex(plan: FormCinePlan, ms: number): number {
  for (let i = 0; i < plan.ends.length; i++) if (ms < plan.ends[i]) return i;
  return plan.ends.length;
}

export function formCinePhaseAt(plan: FormCinePlan, ms: number): FormCinePhase {
  const i = formCinePhaseIndex(plan, ms);
  return i >= plan.ends.length ? 'done' : (FORM_CINE_PHASES[plan.kind][i] as FormCinePhase);
}

/**
 * Estado en el instante `ms`. `sizeMul` (solo Dinamax) es cuánto más grande es la forma gigante: el sprite empieza
 * a su tamaño normal (grow = 1/sizeMul) y acaba en 1, a tirones (tres golpes de crecimiento con rebote).
 */
export function formCineFrame(plan: FormCinePlan, ms: number, sizeMul = 1): FormCineFrame {
  const t = Math.max(0, ms);
  const index = formCinePhaseIndex(plan, t);
  const phase = formCinePhaseAt(plan, t);
  const start = index === 0 ? 0 : plan.ends[Math.min(index, plan.ends.length) - 1];
  const end = index >= plan.ends.length ? plan.total : plan.ends[index];
  const k = index >= plan.ends.length ? 1 : clamp01((t - start) / Math.max(1, end - start));
  const extra = plan.zoomPeak - 1;
  const sp = plan.shakePeak;
  const small = 1 / Math.max(1, sizeMul);
  const f: FormCineFrame = { phase, index, k, total: clamp01(t / plan.total), zoom: 1, shake: 0, build: 0, white: 0, grow: plan.kind === 'max' ? small : 1, squash: 1 };
  if (index === 0) {
    f.zoom = 1 + extra * easeInOut(k) * 0.85;
    f.shake = sp * 0.1 * k;
    return f;
  }
  if (index >= 4) {
    // vuelta: la cámara se aleja a su sitio, todo en su tamaño final
    f.zoom = index >= 5 ? 1 : 1 + extra * 0.7 * (1 - easeInOut(k));
    f.shake = index >= 5 ? 0 : sp * 0.2 * (1 - k);
    f.build = index >= 5 ? 0 : 1 - k;
    f.grow = 1;
    return f;
  }
  switch (plan.kind) {
    case 'tera':
      if (index === 1) {
        // el cristal sube desde los pies hasta cubrirlo
        f.zoom = 1 + extra * (0.85 + 0.15 * k);
        f.build = easeInOut(k);
        f.shake = sp * 0.3 * k;
        f.white = 0.25 * k * k;
      } else if (index === 2) {
        f.zoom = plan.zoomPeak;
        f.build = 1;
        f.shake = sp * 0.5;
        f.white = 0.25 + 0.55 * Math.abs(Math.sin(k * Math.PI * 2)); // brilla a latidos
        f.grow = 1 + 0.04 * Math.sin(k * Math.PI * 4);
      } else {
        f.zoom = plan.zoomPeak - extra * 0.3 * k;
        f.build = 1 - k;
        f.shake = sp * (1 - k);
        f.white = 1 - k;
        f.grow = 1 + 0.1 * (1 - k);
      }
      break;
    case 'max': {
      // la cámara se abre mientras crece, para que se vea entero
      if (index === 1) {
        f.zoom = 1 + extra * (0.85 - 0.25 * k);
        f.build = easeInOut(k);
        f.shake = sp * 0.25 * k;
        f.white = 0.15 * k;
      } else if (index === 2) {
        f.zoom = 1 + extra * (0.6 - 0.5 * k);
        f.build = 1;
        // tres golpes de crecimiento, cada uno con su rebote
        const steps = 3;
        const s = Math.min(steps - 1, Math.floor(k * steps));
        const sk = k * steps - s;
        const from = s / steps, to = (s + 1) / steps;
        const g = from + (to - from) * easeOutBack(clamp01(sk * 1.6));
        f.grow = small + (1 - small) * g;
        f.shake = sp * (0.4 + 0.6 * (sk < 0.25 ? 1 - sk * 4 : 0)); // sacudón en cada golpe
        f.white = 0.3 * (sk < 0.3 ? 1 - sk / 0.3 : 0);
      } else {
        f.zoom = 1 + extra * 0.1;
        f.build = 1;
        f.grow = 1 + 0.05 * Math.sin(k * Math.PI);
        f.shake = sp * (1 - k * 0.6);
        f.white = 0.5 * (1 - k);
      }
      break;
    }
    case 'z':
      if (index === 1) {
        // se agacha cogiendo impulso; el cristal sube
        f.zoom = 1 + extra * (0.85 + 0.15 * k);
        f.build = easeInOut(k) * 0.5;
        f.squash = 1 - 0.12 * easeInOut(Math.min(1, k * 1.5));
        f.shake = sp * 0.15 * k;
      } else if (index === 2) {
        f.zoom = plan.zoomPeak;
        f.build = 0.5 + 0.5 * k;
        f.squash = 0.88 + 0.02 * Math.sin(k * Math.PI * 8);
        f.shake = sp * (0.2 + 0.6 * k * k);
        f.white = 0.5 * k * k;
      } else {
        // estirón hacia arriba y suelta la energía
        f.zoom = plan.zoomPeak - extra * 0.3 * k;
        f.build = 1;
        f.squash = 1 + 0.18 * Math.sin(Math.min(1, k * 1.3) * Math.PI);
        f.shake = sp;
        f.white = 1 - k;
      }
      break;
  }
  return f;
}

/** Momento en que la forma cambia de verdad (sprite gigante, tipo Tera, golpe Z): al entrar en la fase 3. */
export const formCineSwapAt = (plan: FormCinePlan): number => plan.ends[2];
