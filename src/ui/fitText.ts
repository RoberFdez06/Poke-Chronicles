// Ajuste de textos a su hueco (sobre todo en móvil, donde main.ts agranda las letras pequeñas): primero baja la letra
// hasta `minPx` y, si aun así no cabe, recorta palabras del final y pone «…». En escritorio, con los textos de
// siempre, normalmente no cambia nada (ya caben).
import type Phaser from 'phaser';

const px = (t: Phaser.GameObjects.Text): number => parseFloat(String(t.style.fontSize)) || 14;

/** Encaja `t` (con ajuste de línea propio) en `maxW` × `maxH`. */
export function fitTextBox(t: Phaser.GameObjects.Text, maxW: number, maxH: number, minPx = 10): Phaser.GameObjects.Text {
  const full = t.text;
  t.setWordWrapWidth(maxW, true);
  let size = px(t);
  while ((t.height > maxH || t.width > maxW) && size > minPx) {
    size -= 1;
    t.setFontSize(size);
  }
  if (t.height <= maxH && t.width <= maxW) return t;
  const words = full.split(/\s+/);
  for (let n = words.length - 1; n > 0; n--) {
    t.setText(words.slice(0, n).join(' ').replace(/[\s,.;:·]+$/, '') + '…');
    if (t.height <= maxH && t.width <= maxW) return t;
  }
  return t;
}

/** Encaja un texto de una sola línea en `maxW` bajando la letra (hasta `minPx`) y, si no, encogiéndolo. */
export function fitTextLine(t: Phaser.GameObjects.Text, maxW: number, minPx = 10): Phaser.GameObjects.Text {
  t.setScale(1);
  let size = px(t);
  while (t.width > maxW && size > minPx) {
    size -= 1;
    t.setFontSize(size);
  }
  if (t.width > maxW) t.setScale(maxW / t.width);
  return t;
}

/**
 * Cambia el texto de una línea que se actualiza (saldos, contadores) y lo encaja en `maxW`: parte siempre del tamaño
 * de letra con el que se creó (el del modo móvil incluido), así no se queda pequeño cuando la cifra vuelve a caber.
 */
export function setFitLine(t: Phaser.GameObjects.Text, text: string, maxW: number, minPx = 10): Phaser.GameObjects.Text {
  let base = t.getData('fitBasePx') as number | undefined;
  if (base === undefined) {
    base = px(t);
    t.setData('fitBasePx', base);
  }
  t.setFontSize(base).setText(text);
  return fitTextLine(t, maxW, minPx);
}
