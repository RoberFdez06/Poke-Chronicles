// Fotogramas de locomoción dibujados por código para los Pokémon que no tienen hoja de andar de SpriteCollab (especies
// sin sprite allí, megas/formas con el dibujo fijo de PokeAPI, Dinamax/Gigamax/Tera, oscuros, shiny sin hoja…).
// A partir del dibujo fijo se hacen 4 fotogramas en pixel art (se mueven píxeles enteros, sin suavizar):
//  - andar: levanta y adelanta un pie y luego el otro (mitad izquierda / derecha de la franja de los pies);
//  - volar: las alas (columnas de los lados) suben y bajan;
//  - flotar: ondulación suave por columnas (como una medusa o un fantasma);
//  - reptar / nadar: onda lateral que recorre el cuerpo fila a fila;
//  - botar / rodar: se aplasta y se estira apoyado en el suelo.
// Así nunca se deslizan rígidos. Pura (sin Phaser) para poder probarla.
import type { Locomotion } from './locomotion.ts';

export const PROC_FRAMES = 4;

/** Duración de cada fotograma (ms) según cómo se mueve. */
export const PROC_FRAME_MS: Readonly<Record<Locomotion, number>> = {
  walk: 120,
  fly: 85,
  float: 170,
  swim: 130,
  slither: 120,
  hop: 120,
  roll: 95,
};

/** Fotograma que toca en el instante `t` (ms). Parado, el 0 (dibujo original). */
export function procFrameAt(loco: Locomotion, t: number, moving: boolean, seed = 0): number {
  if (!moving) return 0;
  const n = Math.floor(t / PROC_FRAME_MS[loco] + seed * 3);
  return ((n % PROC_FRAMES) + PROC_FRAMES) % PROC_FRAMES;
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Caja de los píxeles visibles (alfa > 40), o null si está vacío. */
export function alphaBox(src: ArrayLike<number>, w: number, h: number): Box | null {
  let left = w, right = -1, top = h, bottom = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (src[(y * w + x) * 4 + 3] > 40) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
  return right < 0 ? null : { left, right, top, bottom };
}

type Map2 = (x: number, y: number) => [number, number];

/** Copia hacia delante: cada píxel de origen va a map(x, y) (desplazamientos enteros, sin huecos dentro de una fila/columna). */
function forward(src: ArrayLike<number>, w: number, h: number, map: Map2): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] === 0) continue;
      const [nx, ny] = map(x, y);
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const o = (ny * w + nx) * 4;
      out[o] = src[i];
      out[o + 1] = src[i + 1];
      out[o + 2] = src[i + 2];
      out[o + 3] = src[i + 3];
    }
  return out;
}

/** Copia hacia atrás: cada píxel de destino toma el de origen inv(x, y) (escalados sin huecos). */
function inverse(src: ArrayLike<number>, w: number, h: number, inv: Map2): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [sx, sy] = inv(x, y);
      const rx = Math.round(sx), ry = Math.round(sy);
      if (rx < 0 || ry < 0 || rx >= w || ry >= h) continue;
      const i = (ry * w + rx) * 4, o = (y * w + x) * 4;
      out[o] = src[i];
      out[o + 1] = src[i + 1];
      out[o + 2] = src[i + 2];
      out[o + 3] = src[i + 3];
    }
  return out;
}

/** Los 4 fotogramas (RGBA, mismo tamaño que el original) del ciclo de `loco`. El 0 es el dibujo tal cual. */
export function procFrames(src: ArrayLike<number>, w: number, h: number, loco: Locomotion): Uint8ClampedArray[] {
  const copy = () => Uint8ClampedArray.from(src as ArrayLike<number>);
  const b = alphaBox(src, w, h);
  if (!b) return Array.from({ length: PROC_FRAMES }, copy);
  const bw = b.right - b.left + 1;
  const bh = b.bottom - b.top + 1;
  const cx = (b.left + b.right) / 2;
  const frames: Uint8ClampedArray[] = [copy()];
  for (let k = 1; k < PROC_FRAMES; k++) {
    if (loco === 'walk') {
      // 1: pie izquierdo arriba y adelante; 2: los dos en el suelo y el cuerpo un píxel abajo; 3: el derecho
      const step = Math.max(1, Math.round(bh * 0.06));
      const feetTop = b.bottom - Math.max(2, Math.round(bh * 0.24));
      frames.push(
        forward(src, w, h, (x, y) => {
          if (y < feetTop) return [x, y + (k === 2 ? 1 : 0)];
          const leftFoot = x < cx;
          if (k === 2) return [x, y];
          if ((k === 1 && leftFoot) || (k === 3 && !leftFoot)) return [x + (leftFoot ? -1 : 1), y - step];
          return [x, y];
        }),
      );
    } else if (loco === 'fly') {
      // Alas: los lados suben (1), quedan a medias (2) y bajan (3); el centro apenas se mueve
      const amp = Math.max(1, Math.round(bh * 0.09));
      const s = [0, -1, 0.35, 1][k];
      frames.push(
        forward(src, w, h, (x, y) => {
          const d = Math.abs(x - cx) / Math.max(1, bw / 2);
          const wing = Math.max(0, (d - 0.3) / 0.7);
          return [x, y + Math.round(s * amp * wing) + (k === 1 ? 1 : 0)];
        }),
      );
    } else if (loco === 'float') {
      const amp = Math.max(1, Math.round(bh * 0.04));
      frames.push(forward(src, w, h, (x, y) => [x, y + Math.round(amp * Math.sin(((x - b.left) / bw) * Math.PI * 2 + (k * Math.PI) / 2))]));
    } else if (loco === 'slither' || loco === 'swim') {
      const amp = Math.max(1, Math.round(bw * (loco === 'slither' ? 0.05 : 0.035)));
      const waves = loco === 'slither' ? 1.5 : 1;
      frames.push(forward(src, w, h, (x, y) => [x + Math.round(amp * Math.sin(((y - b.top) / bh) * Math.PI * 2 * waves + (k * Math.PI) / 2)), y]));
    } else {
      // Botar / rodar: aplastado contra el suelo, normal y estirado (apoyado siempre por abajo)
      const ky = (loco === 'hop' ? [1, 0.84, 1, 1.12] : [1, 0.92, 1, 1.05])[k];
      const kx = 1 / Math.sqrt(ky);
      frames.push(inverse(src, w, h, (x, y) => [cx + (x - cx) / kx, b.bottom - (b.bottom - y) / ky]));
    }
  }
  return frames;
}
