// Estado del altar de la Mega Piedra (lógica pura, sin Phaser).
//
// La sala de la Mega Piedra tiene SIEMPRE el altar en su sitio. Mientras el guardián vive, el altar está vacío; al
// caer, la piedra desciende sobre él y se coge de ahí; una vez cogida (o si ya la llevabas), el altar queda apagado.
// Todo sale de dos marcas que ya se guardan en `eventsDone` (así RunSave no cambia):
//   - `megaGuardianBeatenKey(sala)`: el guardián ha caído (o la sala se resolvió sin él).
//   - `megaStoneDoneKey(sala)`: la piedra ya se ha cogido (o el guardián soltó otro objeto porque ya la llevabas).

/** Base de las marcas «guardián vencido»: MEGA_STONE_DONE_BASE (100000, en roomEvents) + 50000, lejos de las de
 * «cogida» y de los ids de sala (sin importar roomEvents para que este módulo siga sin dependencias). */
export const MEGA_GUARDIAN_BEATEN_BASE = 150000;
export const megaGuardianBeatenKey = (roomId: number): number => MEGA_GUARDIAN_BEATEN_BASE + roomId;

/** `guarded`: altar vacío y guardián vivo · `stone`: piedra flotando sobre el altar · `off`: apagado. */
export type MegaAltarMode = 'guarded' | 'stone' | 'off';

export interface MegaAltarFacts {
  /** Marca megaStoneDoneKey: ya se cogió (o el guardián soltó otra cosa). */
  taken: boolean;
  /** Marca megaGuardianBeatenKey. */
  guardianBeaten: boolean;
  /** El jugador ya lleva la Mega Piedra. */
  have: boolean;
}

export function megaAltarMode(f: MegaAltarFacts): MegaAltarMode {
  if (f.taken) return 'off';
  if (!f.guardianBeaten) return 'guarded';
  return f.have ? 'off' : 'stone';
}

/** Qué hacer al caer el guardián: la piedra baja al altar o, si ya la llevas, cae un objeto (y la sala se resuelve). */
export function guardianReward(have: boolean): 'stone' | 'item' {
  return have ? 'item' : 'stone';
}

/** Duración de la bajada de la piedra (ms): haz de luz, caída y asentamiento. */
export const MEGA_DESCENT_MS = 1600;
/** Altura (px) desde la que cae la piedra sobre su sitio de flotar. */
export const MEGA_DESCENT_HEIGHT = 260;

export interface MegaDescentFrame {
  /** 0-1: intensidad del haz de luz. */
  beam: number;
  /** Desplazamiento vertical de la piedra (negativo = arriba). */
  dy: number;
  /** 0-1: opacidad de la piedra. */
  stone: number;
  /** 0-1: destello al posarse (0 si no toca). */
  flash: number;
  /** true cuando la bajada ha terminado. */
  done: boolean;
}

/** Fotograma de la bajada a `ms` de su inicio: el haz crece (0-35 %), la piedra cae (35-80 %) y destella (80-100 %). */
export function megaDescentFrame(ms: number): MegaDescentFrame {
  const k = Math.max(0, Math.min(1, ms / MEGA_DESCENT_MS));
  const beam = k < 0.35 ? k / 0.35 : k < 0.85 ? 1 : 1 - (k - 0.85) / 0.15;
  const fall = k < 0.35 ? 0 : Math.min(1, (k - 0.35) / 0.45);
  const ease = 1 - (1 - fall) * (1 - fall); // frena al llegar
  const dy = -Math.round(MEGA_DESCENT_HEIGHT * (1 - ease)) || 0; // sin -0
  const stone = k < 0.35 ? 0 : Math.min(1, (k - 0.35) / 0.12);
  const flash = k < 0.8 ? 0 : 1 - (k - 0.8) / 0.2;
  return { beam: Math.max(0, beam), dy, stone, flash: Math.max(0, flash), done: k >= 1 };
}
