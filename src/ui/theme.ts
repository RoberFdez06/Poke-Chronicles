// Tema visual al estilo de los juegos de Pokémon: fuente pixel, colores, cuadros de texto con borde doble,
// barras de PS, fichas de tipo y transiciones. Todas las escenas sacan de aquí fuente y colores.
// Solo tipos de Phaser (sin importar el motor), así hpTier se puede testear con node --test.
import type Phaser from 'phaser';
import type { Rarity } from '../data/gacha.ts';

/** Fuente pixel con licencia libre (OFL): public/fonts/PixelifySans.ttf. Si no está, se usa la del sistema. */
export const FONT_FAMILY = 'Pixelify Sans';
export const FONT = `"${FONT_FAMILY}", system-ui, sans-serif`;
export const FONT_URL = 'fonts/PixelifySans.ttf';
/** Números 0-9 pixel hechos para el juego (public/fonts/PokeIsaacDigits.ttf), más claros que los de Pixelify. */
export const DIGITS_URL = 'fonts/PokeIsaacDigits.ttf';

export const COLORS = {
  /** Fondo de las pantallas. */
  bg: 0x172036,
  /** Borde exterior de los cuadros y texto principal. */
  navy: 0x2b3a67,
  /** Línea interior del borde doble. */
  frame: 0x8fa6d8,
  /** Relleno de los cuadros de texto (crema, como en los juegos). */
  panel: 0xf8f8f0,
  /** Opción seleccionada. */
  gold: 0xffd34d,
  goldSoft: 0xfff1b8,
  hpGreen: 0x3fc35a,
  hpYellow: 0xf2c12e,
  hpRed: 0xe0453a,
  hpTrack: 0x404a5c,
} as const;

export const HEX = {
  text: '#2b3a67',
  textSoft: '#4a5578',
  white: '#ffffff',
  gold: '#ffd34d',
  muted: '#9aa5b1',
} as const;

export const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

/** Estilo de texto con la fuente del tema. */
export function textStyle(size: number, color: string = HEX.text, extra: Phaser.Types.GameObjects.Text.TextStyle = {}) {
  return { fontFamily: FONT, fontSize: `${size}px`, color, ...extra };
}

/** Flecha de selección, como en los menús de los juegos. */
export const ARROW = '▶';

/**
 * Carga la fuente antes de crear el juego (Phaser dibuja el texto en un canvas y no espera a las fuentes).
 * Si no está o tarda, se sigue con la del sistema.
 */
export async function loadThemeFont(timeoutMs = 2500): Promise<boolean> {
  try {
    const face = new FontFace(FONT_FAMILY, `url(${import.meta.env.BASE_URL}${FONT_URL})`);
    // El tipo FontFaceSet de esta versión de TypeScript no declara add()
    (document.fonts as unknown as { add(f: FontFace): void }).add(face);
    // Los números de Pixelify Sans (2 y 5) parecen una S: van con una fuente pixel propia, solo para 0-9
    const digits = new FontFace(FONT_FAMILY, `url(${import.meta.env.BASE_URL}${DIGITS_URL})`, { unicodeRange: 'U+0030-0039' });
    (document.fonts as unknown as { add(f: FontFace): void }).add(digits);
    void digits.load().catch(() => undefined);
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('tiempo')), timeoutMs));
    await Promise.race([face.load(), timeout]);
    await document.fonts.load(`16px "${FONT_FAMILY}"`, 'Aa0123456789');
    return true;
  } catch {
    return false;
  }
}

export interface BoxOptions {
  fill?: number;
  fillAlpha?: number;
  /** Seleccionado: relleno dorado. */
  selected?: boolean;
  radius?: number;
  /** Color del borde exterior (por defecto azul marino). */
  border?: number;
}

/**
 * Cuadro de texto al estilo GBA: borde doble hecho de "píxeles" de 4x4 con las esquinas recortadas
 * (escalonadas), como los menús de Rojo Fuego o Esmeralda. (x, y) es la esquina superior izquierda.
 * `radius` se mantiene por compatibilidad: con 0 las esquinas quedan rectas.
 */
export function drawBox(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, o: BoxOptions = {}) {
  const u = 4;
  const cut = (o.radius ?? 14) > 0 ? u : 0;
  x = Math.round(x / 2) * 2;
  y = Math.round(y / 2) * 2;
  // Rectángulo con esquinas escalonadas: dos rectángulos cruzados
  const block = (inset: number, color: number, alpha = 1) => {
    g.fillStyle(color, alpha);
    g.fillRect(x + inset + cut, y + inset, w - 2 * (inset + cut), h - 2 * inset);
    g.fillRect(x + inset, y + inset + cut, w - 2 * inset, h - 2 * (inset + cut));
  };
  block(0, o.border ?? COLORS.navy);
  block(u, o.selected ? 0xc99a1e : COLORS.frame);
  block(u * 2, o.selected ? COLORS.gold : (o.fill ?? COLORS.panel), o.fillAlpha ?? 1);
  // Brillo de la esquina superior, como el relieve de los cuadros de la GBA
  g.fillStyle(0xffffff, o.selected ? 0.35 : 0.6).fillRect(x + u * 3, y + u * 2, w - u * 6, 2);
  return g;
}

/** Marco de selección pixelado (borde de `t` px con esquinas escalonadas), en lugar de un contorno redondeado. */
export function strokePixelFrame(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, t = 6) {
  const u = 4;
  g.fillStyle(color, 1);
  g.fillRect(x + u, y, w - 2 * u, t).fillRect(x + u, y + h - t, w - 2 * u, t);
  g.fillRect(x, y + u, t, h - 2 * u).fillRect(x + w - t, y + u, t, h - 2 * u);
  // Esquinas escalonadas
  g.fillRect(x + t - 2, y + t - 2, u, u).fillRect(x + w - t - 2, y + t - 2, u, u);
  g.fillRect(x + t - 2, y + h - t - 2, u, u).fillRect(x + w - t - 2, y + h - t - 2, u, u);
  return g;
}

/** Igual que drawBox pero centrado en (cx, cy). */
export const drawBoxCentered = (g: Phaser.GameObjects.Graphics, cx: number, cy: number, w: number, h: number, o: BoxOptions = {}) =>
  drawBox(g, cx - w / 2, cy - h / 2, w, h, o);

/** Tramo de color de la barra de PS: verde por encima de la mitad, amarillo hasta un quinto, rojo por debajo. */
export function hpTier(ratio: number): 'green' | 'yellow' | 'red' {
  if (ratio > 0.5) return 'green';
  if (ratio > 0.2) return 'yellow';
  return 'red';
}

export const hpColor = (ratio: number): number =>
  ({ green: COLORS.hpGreen, yellow: COLORS.hpYellow, red: COLORS.hpRed })[hpTier(ratio)];

/** Barra de PS con su etiqueta "PS", como en los combates. (x, y) es la esquina superior izquierda. */
export function addHpBar(scene: Phaser.Scene, x: number, y: number, w: number, h = 12) {
  const label = scene.add.text(x, y + h / 2, 'PS', textStyle(h + 4, '#f2a33a', { fontStyle: 'bold' })).setOrigin(0, 0.5);
  label.setStroke('#2b3a67', 4);
  const bx = x + label.width + 6;
  const bw = w - label.width - 6;
  const g = scene.add.graphics();
  const set = (ratio: number) => {
    const r = Math.max(0, Math.min(1, ratio));
    g.clear();
    g.fillStyle(COLORS.navy, 1).fillRoundedRect(bx - 3, y - 3, bw + 6, h + 6, (h + 6) / 2);
    g.fillStyle(COLORS.hpTrack, 1).fillRoundedRect(bx, y, bw, h, h / 2);
    if (r > 0) g.fillStyle(hpColor(r), 1).fillRoundedRect(bx, y, Math.max(h, bw * r), h, h / 2);
  };
  set(1);
  return { label, g, set, objects: [g, label] as Phaser.GameObjects.GameObject[] };
}

/** Ficha de tipo: píldora del color del tipo con el nombre en blanco. Devuelve los dos objetos. */
export function addTypeChip(scene: Phaser.Scene, cx: number, cy: number, label: string, color: number, w = 84, h = 26) {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.navy, 1).fillRoundedRect(cx - w / 2 - 2, cy - h / 2 - 2, w + 4, h + 4, (h + 4) / 2);
  g.fillStyle(color, 1).fillRoundedRect(cx - w / 2, cy - h / 2, w, h, h / 2);
  const t = scene.add
    .text(cx, cy, label.toUpperCase(), textStyle(14, HEX.white, { fontStyle: 'bold' }))
    .setOrigin(0.5)
    .setShadow(1, 1, '#00000088', 0);
  return [g, t] as Phaser.GameObjects.GameObject[];
}

/** Duración de las transiciones entre pantallas. */
export const FADE_MS = 220;

/** Entrada de pantalla: fundido desde negro. Llamar al principio de create(). */
/**
 * Efectos bajos (N21): con ellos, los cambios de pantalla van sin fundido y el fondo de los menús no se anima.
 * main.ts conecta aquí la lectura del ajuste (así este módulo no depende del guardado).
 */
let lowFxProbe: () => boolean = () => false;
export function setLowFxProbe(fn: () => boolean) {
  lowFxProbe = fn;
}
export const lowFx = (): boolean => {
  try {
    return lowFxProbe();
  } catch {
    return false;
  }
};

export function fadeIn(scene: Phaser.Scene, ms = FADE_MS) {
  // Los datos de la escena sobreviven a scene.restart: se permite volver a salir
  scene.data?.set('leaving', false);
  if (!lowFx()) scene.cameras.main.fadeIn(ms, 0, 0, 0);
}

/**
 * Cambia de pantalla con fundido a negro. Si la escena está en pausa (su cámara no avanzaría) o ya se está
 * yendo, cambia sin fundido. Devuelve false si ya había un cambio en marcha.
 */
export function goTo(scene: Phaser.Scene, key: string, data?: object, ms = FADE_MS): boolean {
  const cam = scene.cameras.main;
  if (scene.data?.get('leaving')) return false;
  scene.data?.set('leaving', true);
  // Los datos de la escena sobreviven a scene.restart (y a stop + start): al cerrarse se borra la marca, así una
  // escena que se reinicia a sí misma («Reiniciar nivel») o que vuelve más tarde no se queda sin poder salir
  scene.events?.once?.('shutdown', () => scene.data?.set('leaving', false));
  if (scene.scene.isPaused() || !cam || lowFx()) {
    scene.scene.start(key, data);
    return true;
  }
  cam.fadeOut(ms, 0, 0, 0);
  // El fundido va en tiempo de juego: si el juego va a pocos FPS (o la pestaña estuvo en segundo plano) puede
  // tardar mucho, y parecía que Esc/Enter no hacían nada. Pasado su tiempo real, se cambia de pantalla igualmente.
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    scene.scene.start(key, data);
  };
  cam.once('camerafadeoutcomplete', go);
  window.setTimeout(() => {
    if (scene.sys.isActive() || scene.sys.isVisible()) go();
  }, ms + 120);
  return true;
}

/** Color de cada rareza (de menos a más valiosa; el dorado queda para los legendarios). */
export const RARITY_COLORS: Record<Rarity, number> = {
  common: 0x5f6b7a,
  rare: 0x2e86de,
  epic: 0x8e44ad,
  ultra: 0xe84393,
  legendary: 0xd4a017,
};

/** Recorta un texto largo con "…" para que quepa en un cuadro (nombres de poderes, por ejemplo). */
export const shorten = (s: string, max: number): string => (s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s);
