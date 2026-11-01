// Reparto de una tabla de dos columnas (etiqueta | descripción) en un ancho fijo, a partir de la medida real de los
// textos (en móvil, main.ts agranda las letras y las etiquetas largas pisaban la descripción). Lógica pura: se prueba
// con node --test (tests/columns.test.ts).

export interface ColumnSplit {
  /** Ancho para la etiqueta (izquierda). */
  labelW: number;
  /** X de la descripción, relativa al inicio de la tabla. */
  descX: number;
  /** Ancho para la descripción (derecha). */
  descW: number;
}

/**
 * Reparte `total` entre etiqueta y descripción con `gap` en medio. Si las dos columnas más largas caben, la etiqueta
 * lleva justo lo suyo y la descripción el resto; si no, el ancho se reparte en proporción a lo que pide cada una,
 * con la etiqueta entre `minFrac` y `maxFrac` del total (lo que no quepa se encoge o se ajusta luego).
 */
export function splitColumns(labelMax: number, descMax: number, total: number, gap = 16, minFrac = 0.28, maxFrac = 0.5): ColumnSplit {
  const room = Math.max(0, total - gap);
  const lw = Math.max(0, labelMax);
  const dw = Math.max(0, descMax);
  let labelW: number;
  if (lw + dw <= room) labelW = lw;
  else {
    const want = lw + dw > 0 ? (room * lw) / (lw + dw) : room / 2;
    labelW = Math.min(room * maxFrac, Math.max(room * minFrac, want));
    // Si la etiqueta pide menos que su parte mínima, no se le reserva hueco de más
    labelW = Math.min(labelW, Math.max(lw, room * minFrac));
  }
  labelW = Math.round(Math.min(labelW, room));
  return { labelW, descX: labelW + gap, descW: Math.max(0, Math.round(room - labelW)) };
}

/** Paso vertical entre filas: `count` filas entre `top` y `bottom`, como mucho `maxStep` y como poco `minStep`. */
export function rowStep(count: number, top: number, bottom: number, maxStep: number, minStep = 12): number {
  if (count <= 0) return maxStep;
  return Math.max(minStep, Math.min(maxStep, Math.floor((bottom - top) / count)));
}

/** Letra que cabe en una fila de `step` px (≈ 0,8 del paso), sin pasar de `size` ni bajar de `minPx`. */
export const fontForStep = (step: number, size: number, minPx = 10): number => Math.max(minPx, Math.min(size, Math.floor(step * 0.8)));

/** Factor para encoger algo de ancho `w` a `maxW` (1 si ya cabe). */
export const shrinkTo = (w: number, maxW: number): number => (w > maxW && w > 0 ? maxW / w : 1);
