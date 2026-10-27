// Ajustes de rendimiento (T41): efectos visuales altos o bajos y contador de FPS. Lógica pura; el guardado está
// en save.ts (`pokeisaac.fx`). Como el volumen, son ajustes del aparato: no se borran con "Borrar progreso".

export interface FxSettings {
  /** Efectos bajos: sin partículas decorativas, temblores de cámara ni clima animado. */
  low: boolean;
  /** Contador de FPS en una esquina durante la partida. */
  showFps: boolean;
  /** Textos en pantalla (avisos flotantes sobre el juego): completos, reducidos (iconos + cifras) o mínimos. */
  texts: TextsLevel;
}

export type TextsLevel = 'full' | 'reduced' | 'minimal';
export const TEXTS_LEVELS: readonly TextsLevel[] = ['full', 'reduced', 'minimal'];
export const TEXTS_LABEL: Record<TextsLevel, string> = { full: 'Completos', reduced: 'Reducidos', minimal: 'Mínimos' };
/** Siguiente nivel (para el botón de Ajustes). */
export const nextTexts = (t: TextsLevel, d = 1): TextsLevel => TEXTS_LEVELS[(TEXTS_LEVELS.indexOf(t) + d + 3) % 3];

export const DEFAULT_FX: Readonly<FxSettings> = { low: false, showFps: false, texts: 'reduced' };

export function parseFx(raw: string | null): FxSettings {
  const out: FxSettings = { ...DEFAULT_FX };
  if (!raw) return out;
  try {
    const d = JSON.parse(raw) as Partial<FxSettings> | null;
    if (d && typeof d === 'object') {
      if (typeof d.low === 'boolean') out.low = d.low;
      if (typeof d.showFps === 'boolean') out.showFps = d.showFps;
      if (typeof d.texts === 'string' && (TEXTS_LEVELS as readonly string[]).includes(d.texts)) out.texts = d.texts;
    }
  } catch {
    // corrupto: lo de por defecto
  }
  return out;
}

/**
 * Tope de efectos de partículas (chispas, estallidos, estelas…): como mucho `max` cada `windowMs`. Con muchos
 * enemigos y disparos a la vez, el resto se salta. Con efectos bajos no sale ninguno.
 */
export class FxBudget {
  private used = 0;
  private windowStart = 0;
  readonly low: boolean;
  private max: number;
  private windowMs: number;

  // Sin propiedades en el constructor: node --test (solo quita tipos) no las admite
  constructor(low = false, max = 14, windowMs = 100) {
    this.low = low;
    this.max = max;
    this.windowMs = windowMs;
  }

  /** ¿Se puede lanzar un efecto ahora? (`now` en ms). */
  take(now: number): boolean {
    if (this.low) return false;
    if (now - this.windowStart >= this.windowMs) {
      this.windowStart = now;
      this.used = 0;
    }
    if (this.used >= this.max) return false;
    this.used++;
    return true;
  }
}
