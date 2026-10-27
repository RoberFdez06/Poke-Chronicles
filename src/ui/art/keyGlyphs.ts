// Glifos pixel art de teclas, botones del mando, ratón y táctil, y frases con glifos incrustados.
// En vez de escribir «Q», «LB» o «Clic derecho», se dibuja la tecla con su borde y relieve, el botón del mando con
// su color, o el ratón con el botón que toca resaltado. Todo con rectángulos (sin emojis ni imágenes).
import Phaser from 'phaser';
import { FONT } from '../theme';
import { currentInput } from '../inputMode';
import { tokenizeGlyphs, type GlyphDevice } from '../../data/glyphTokens';

const INK = 0x18202c;
const CAP = 0xf4f6fb;
const CAP_SIDE = 0xa9b4cc;
const NAVY = '#2b3a67';
const HILITE = 0xffd34d;

/** Colores de los botones de cara de un mando genérico. */
const FACE: Record<string, number> = { A: 0x3fae49, B: 0xd9483a, X: 0x3a7bd5, Y: 0xe2b021 };

type G = Phaser.GameObjects.Graphics;

/** Rectángulo con las esquinas «comidas» (un píxel), como los marcos de GBA. */
function chunky(g: G, x: number, y: number, w: number, h: number, color: number, u: number) {
  g.fillStyle(color, 1).fillRect(x + u, y, w - 2 * u, h).fillRect(x, y + u, w, h - 2 * u);
}

/** Círculo pixelado (por filas). */
function pixCircle(g: G, cx: number, cy: number, r: number, color: number, u: number) {
  g.fillStyle(color, 1);
  for (let y = -r; y < r; y += u) {
    const yy = y + u / 2;
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - yy * yy)) / u) * u;
    if (half > 0) g.fillRect(cx - half, cy + y, half * 2, u);
  }
}

/** Flecha pixelada dentro de un cuadro de lado s, centrada en (cx, cy). */
function pixArrow(g: G, cx: number, cy: number, dir: '↑' | '↓' | '←' | '→', u: number, color: number) {
  g.fillStyle(color, 1);
  const rows = [1, 3, 5];
  rows.forEach((w, i) => {
    const off = (i - 1) * u;
    if (dir === '↑') g.fillRect(cx - (w * u) / 2, cy + off - u / 2, w * u, u);
    if (dir === '↓') g.fillRect(cx - (w * u) / 2, cy - off - u / 2, w * u, u);
    if (dir === '←') g.fillRect(cx + off - u / 2, cy - (w * u) / 2, u, w * u);
    if (dir === '→') g.fillRect(cx - off - u / 2, cy - (w * u) / 2, u, w * u);
  });
}

function label(scene: Phaser.Scene, x: number, y: number, s: string, size: number, color: string, stroke?: string) {
  const t = scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color }).setOrigin(0.5);
  if (stroke) t.setStroke(stroke, Math.max(2, Math.round(size / 5)));
  return t;
}

/** Tecla con borde, cara clara y lado oscuro (relieve). (0, 0) es su esquina superior izquierda. */
function keyCap(scene: Phaser.Scene, c: Phaser.GameObjects.Container, h: number, text: string, u: number): number {
  const g = scene.add.graphics();
  c.add(g);
  const arrow = ['↑', '↓', '←', '→'].includes(text);
  const size = Math.max(8, Math.round(h * (text.length > 2 ? 0.48 : 0.6)));
  let w = h;
  let t: Phaser.GameObjects.Text | undefined;
  if (!arrow) {
    t = label(scene, 0, 0, text, size, NAVY);
    w = Math.max(h, Math.ceil(t.width + 4 * u + 2));
  }
  chunky(g, 0, 0, w, h, INK, u);
  g.fillStyle(CAP_SIDE, 1).fillRect(u, u, w - 2 * u, h - 2 * u);
  g.fillStyle(CAP, 1).fillRect(u, u, w - 2 * u, h - 4 * u);
  g.fillStyle(0xffffff, 1).fillRect(2 * u, u, w - 4 * u, u);
  const faceCy = u + (h - 5 * u) / 2;
  if (arrow) pixArrow(g, w / 2, faceCy + u / 2, text as '↑', Math.max(1, Math.round(h / 9)), 0x2b3a67);
  else if (t) {
    t.setPosition(w / 2, faceCy + u / 2);
    c.add(t);
  }
  return w;
}

/** Las cuatro flechas (dos filas de teclas pequeñas). */
function arrowCluster(scene: Phaser.Scene, c: Phaser.GameObjects.Container, h: number, u: number): number {
  const s = Math.round(h / 2);
  const g = scene.add.graphics();
  c.add(g);
  const one = (x: number, y: number, d: '↑' | '↓' | '←' | '→') => {
    chunky(g, x, y, s, s, INK, u);
    g.fillStyle(CAP_SIDE, 1).fillRect(x + u, y + u, s - 2 * u, s - 2 * u);
    g.fillStyle(CAP, 1).fillRect(x + u, y + u, s - 2 * u, s - 3 * u);
    pixArrow(g, x + s / 2, y + s / 2 - u / 2, d, Math.max(1, Math.round(s / 8)), 0x2b3a67);
  };
  one(s, 0, '↑');
  one(0, s, '←');
  one(s, s, '↓');
  one(2 * s, s, '→');
  return 3 * s;
}

/** Botón redondo de cara del mando (A verde, B rojo, X azul, Y amarillo). */
function faceButton(scene: Phaser.Scene, c: Phaser.GameObjects.Container, h: number, b: string, u: number): number {
  const g = scene.add.graphics();
  c.add(g);
  const r = h / 2;
  pixCircle(g, r, r, r, INK, u);
  pixCircle(g, r, r, r - u, FACE[b], u);
  // Brillo arriba a la izquierda y sombra abajo
  g.fillStyle(0xffffff, 0.35).fillRect(r - r / 2, u * 2, r / 2, u);
  g.fillStyle(0x000000, 0.25).fillRect(r - r / 2, h - 3 * u, r, u);
  c.add(label(scene, r, r, b, Math.round(h * 0.6), '#ffffff', '#18202c'));
  return h;
}

/** Gatillos y bumpers: LB/RB planos y anchos, LT/RT altos con la parte de arriba redondeada. */
function shoulder(scene: Phaser.Scene, c: Phaser.GameObjects.Container, h: number, b: string, u: number): number {
  const g = scene.add.graphics();
  c.add(g);
  const trigger = b.endsWith('T');
  const w = Math.round(h * 1.5);
  const left = b.startsWith('L');
  chunky(g, 0, 0, w, h, INK, u);
  g.fillStyle(0x5a6684, 1).fillRect(u, u, w - 2 * u, h - 2 * u);
  g.fillStyle(0x3a4560, 1).fillRect(u, h - 3 * u, w - 2 * u, 2 * u);
  if (trigger) {
    // Esquina de arriba en curva hacia fuera (como un gatillo)
    g.fillStyle(INK, 1).fillRect(left ? u : w - 3 * u, u, 2 * u, u).fillRect(left ? u : w - 2 * u, 2 * u, u, u);
  } else {
    g.fillStyle(0x8c98b6, 1).fillRect(2 * u, u, w - 4 * u, u);
  }
  c.add(label(scene, w / 2, h / 2 - u / 2, b, Math.round(h * 0.5), '#ffffff'));
  return w;
}

/** Start/Select: botón pequeño alargado con su símbolo. */
function menuButton(scene: Phaser.Scene, c: Phaser.GameObjects.Container, h: number, b: string, u: number): number {
  const g = scene.add.graphics();
  c.add(g);
  const w = Math.round(h * 1.3);
  const y0 = Math.round(h * 0.18);
  const bh = h - 2 * y0;
  chunky(g, 0, y0, w, bh, INK, u);
  g.fillStyle(0x5a6684, 1).fillRect(u, y0 + u, w - 2 * u, bh - 2 * u);
  g.fillStyle(0xffffff, 1);
  const cx = w / 2;
  const cy = h / 2;
  const s = Math.max(u, Math.round(h / 10));
  if (b === 'Start') for (let i = -1; i <= 1; i++) g.fillRect(cx - 2.5 * s, cy + i * 2 * s - s / 2, 5 * s, s);
  else g.fillRect(cx - 2.5 * s, cy - 2 * s, 3 * s, 3 * s).fillRect(cx - 0.5 * s, cy - 0.5 * s, 3 * s, 3 * s);
  return w;
}

/** Cruceta (con una dirección resaltada si toca). */
function dpad(scene: Phaser.Scene, c: Phaser.GameObjects.Container, h: number, dir: string | undefined, u: number): number {
  const g = scene.add.graphics();
  c.add(g);
  const k = Math.floor(h / 3);
  const s = k * 3;
  const y0 = (h - s) / 2;
  g.fillStyle(INK, 1).fillRect(k - u, y0, k + 2 * u, s).fillRect(0, y0 + k - u, s, k + 2 * u);
  g.fillStyle(0x5a6684, 1).fillRect(k, y0 + u, k, s - 2 * u).fillRect(u, y0 + k, s - 2 * u, k);
  g.fillStyle(0x3a4560, 1).fillRect(k + u, y0 + k + u, k - 2 * u, k - 2 * u);
  if (dir === 'up') g.fillStyle(HILITE, 1).fillRect(k, y0 + u, k, k - u);
  return s;
}

/** Stick: círculo con el capuchón y la letra L o R. */
function stick(scene: Phaser.Scene, c: Phaser.GameObjects.Container, h: number, side: string, u: number, press: boolean): number {
  const g = scene.add.graphics();
  c.add(g);
  const r = h / 2;
  pixCircle(g, r, r, r, INK, u);
  pixCircle(g, r, r, r - u, 0x3a4560, u);
  pixCircle(g, r, r - u, r - 3 * u, press ? HILITE : 0x8c98b6, u);
  c.add(label(scene, r, r - u, press ? `${side}3` : side, Math.round(h * (press ? 0.42 : 0.5)), press ? NAVY : '#ffffff'));
  return h;
}

/** Ratón con el botón que toca en amarillo (izquierdo, derecho, rueda, lateral o moverlo). */
function mouse(scene: Phaser.Scene, c: Phaser.GameObjects.Container, h: number, part: string, u: number): number {
  const g = scene.add.graphics();
  c.add(g);
  const w = Math.max(6 * u, Math.round(h * 0.72 / u) * u);
  chunky(g, 0, 0, w, h, INK, u);
  chunky(g, u, u, w - 2 * u, h - 2 * u, CAP, u);
  g.fillStyle(CAP_SIDE, 1).fillRect(2 * u, h - 3 * u, w - 4 * u, u);
  const top = Math.round(h * 0.45);
  const mid = Math.round(w / 2 / u) * u;
  // Raya entre botones y bajo los botones
  g.fillStyle(INK, 1).fillRect(mid - u / 2, u, u, top - u).fillRect(u, top, w - 2 * u, u);
  if (part === 'left') g.fillStyle(HILITE, 1).fillRect(2 * u, 2 * u, mid - 2.5 * u, top - 2 * u);
  if (part === 'right') g.fillStyle(HILITE, 1).fillRect(mid + u / 2, 2 * u, mid - 2.5 * u, top - 2 * u);
  // Rueda
  g.fillStyle(part === 'middle' ? HILITE : 0x5a6684, 1).fillRect(mid - u, 2 * u, 2 * u, top - 3 * u);
  if (part === 'side') g.fillStyle(HILITE, 1).fillRect(0, top + 2 * u, 2 * u, 3 * u);
  if (part === 'move') {
    g.fillStyle(HILITE, 1);
    g.fillRect(w + u, h / 2 - u / 2, 2 * u, u).fillRect(-3 * u, h / 2 - u / 2, 2 * u, u);
    return w + 3 * u;
  }
  return w;
}

/** Dedo que toca (con su onda). */
function finger(scene: Phaser.Scene, c: Phaser.GameObjects.Container, h: number, u: number): number {
  const g = scene.add.graphics();
  c.add(g);
  const w = Math.round(h * 0.8);
  const fx = Math.round(w * 0.45);
  // Onda
  g.lineStyle(u, HILITE, 1).strokeRect(fx - 2 * u, u, 5 * u, 4 * u);
  // Dedo y mano
  g.fillStyle(INK, 1).fillRect(fx - u, 2 * u, 3 * u, h * 0.55).fillRect(fx - 3 * u, h * 0.5, w - fx + 3 * u, h * 0.5 - u);
  g.fillStyle(0xf6d2b0, 1).fillRect(fx, 3 * u, u, h * 0.55).fillRect(fx - 2 * u, h * 0.5 + u, w - fx + u, h * 0.5 - 3 * u);
  return w;
}

/**
 * Dibuja el glifo `name` («key:Q», «key:arrows», «pad:A», «pad:LB», «pad:dpad», «pad:stickL», «mouse:right»,
 * «touch:tap»…) con alto `h`. Devuelve un contenedor con (0, 0) arriba a la izquierda y su ancho en `width`.
 */
export function drawKeyGlyph(scene: Phaser.Scene, x: number, y: number, name: string, h = 20): Phaser.GameObjects.Container & { glyphW: number } {
  const c = scene.add.container(x, y) as Phaser.GameObjects.Container & { glyphW: number };
  const u = Math.max(1, Math.round(h / 12));
  const [kind, rawArg] = name.includes(':') ? (name.split(/:(.*)/s) as [string, string]) : ['key', name];
  const arg = rawArg ?? '';
  let w = h;
  if (kind === 'pad') {
    if (FACE[arg]) w = faceButton(scene, c, h, arg, u);
    else if (/^[LR][BT]$/.test(arg)) w = shoulder(scene, c, h, arg, u);
    else if (arg === 'Start' || arg === 'Select') w = menuButton(scene, c, h, arg, u);
    else if (arg.startsWith('dpad')) w = dpad(scene, c, h, arg.split('-')[1], u);
    else if (arg === 'stickL' || arg === 'stickR') w = stick(scene, c, h, arg.slice(-1), u, false);
    else if (arg === 'L3' || arg === 'R3') w = stick(scene, c, h, arg[0], u, true);
    else w = keyCap(scene, c, h, arg, u);
  } else if (kind === 'mouse') w = mouse(scene, c, h, arg, u);
  else if (kind === 'touch') w = finger(scene, c, h, u);
  else if (arg === 'arrows') w = arrowCluster(scene, c, h, u);
  else w = keyCap(scene, c, h, arg, u);
  c.glyphW = w;
  c.setSize(w, h);
  return c;
}

export interface GlyphTextStyle {
  size?: number;
  color?: string;
  bold?: boolean;
  stroke?: string;
  strokeWidth?: number;
  /** 0 = (x, y) es el borde izquierdo; 0.5 = centro; 1 = borde derecho. En vertical siempre va centrado. */
  originX?: number;
  /** Reconocer teclas y botones sin llaves (por defecto sí). */
  auto?: boolean;
  /** Ancho máximo: si no cabe, se encoge. */
  maxWidth?: number;
  /** Dispositivo fijo (por defecto, el que se está usando). */
  device?: GlyphDevice;
}

/**
 * Frase con las teclas dibujadas: «Q y E: Pokémon» sale con las teclas Q y E de verdad. Se puede reescribir con
 * setText (solo rehace los trozos si cambia el texto o el dispositivo).
 */
export class GlyphText extends Phaser.GameObjects.Container {
  private style: Required<Omit<GlyphTextStyle, 'device' | 'maxWidth' | 'stroke'>> & Pick<GlyphTextStyle, 'device' | 'maxWidth' | 'stroke'>;
  private shown = '';
  private baseX: number;
  /** Ancho sin escalar. */
  textWidth = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, style: GlyphTextStyle = {}) {
    super(scene, x, y);
    this.baseX = x;
    this.style = { size: 16, color: '#ffffff', bold: true, strokeWidth: 0, originX: 0, auto: true, ...style };
    scene.add.existing(this);
    this.setText(text);
  }

  setGlyphDevice(d: GlyphDevice | undefined) {
    this.style.device = d;
    return this;
  }

  setText(text: string, device?: GlyphDevice): this {
    const dev = device ?? this.style.device ?? (currentInput() as GlyphDevice);
    const key = `${dev}|${text}`;
    if (key === this.shown) return this;
    this.shown = key;
    this.removeAll(true);
    const st = this.style;
    const gh = Math.round(st.size * 1.3);
    let x = 0;
    for (const tok of tokenizeGlyphs(text, dev, st.auto)) {
      if (tok.t === 'text') {
        const t = this.scene.add
          .text(x, 0, tok.s, { fontFamily: FONT, fontSize: `${st.size}px`, fontStyle: st.bold ? 'bold' : 'normal', color: st.color })
          .setOrigin(0, 0.5);
        if (st.stroke) t.setStroke(st.stroke, st.strokeWidth || 3);
        this.add(t);
        x += t.width;
      } else {
        const g = drawKeyGlyph(this.scene, x + 1, -gh / 2, tok.name, gh);
        this.add(g);
        x += g.glyphW + 2;
      }
    }
    this.textWidth = x;
    const k = st.maxWidth && x > st.maxWidth ? st.maxWidth / x : 1;
    this.setScale(k);
    // Origen: se desplazan los hijos (el contenedor sigue en su sitio para no romper tweens)
    const shift = -x * st.originX;
    for (const ch of this.list) (ch as unknown as { x: number }).x += shift;
    return this;
  }

  /** Como en los textos: 0 izquierda, 0.5 centro, 1 derecha (el alto siempre va centrado). */
  setOrigin(x: number, _y?: number): this {
    this.style.originX = x;
    const text = this.shown.slice(this.shown.indexOf('|') + 1);
    const dev = this.shown.slice(0, this.shown.indexOf('|')) as GlyphDevice;
    this.shown = '';
    return this.setText(text, dev || undefined);
  }

  /** Ancho en pantalla (con la escala). */
  get displayW() {
    return this.textWidth * this.scaleX;
  }

  get originalX() {
    return this.baseX;
  }
}

/** Atajo: frase con glifos. */
export const addGlyphText = (scene: Phaser.Scene, x: number, y: number, text: string, style: GlyphTextStyle = {}) =>
  new GlyphText(scene, x, y, text, style);

/** El texto que toca para el dispositivo activo (PC: teclado, salvo que lo último fuera el ratón y haya texto propio). */
export function byDevice(o: { keyboard: string; mouse?: string; gamepad: string; touch?: string }, d: GlyphDevice = currentInput() as GlyphDevice): string {
  if (d === 'gamepad') return o.gamepad;
  if (d === 'touch') return o.touch ?? o.mouse ?? o.keyboard;
  if (d === 'mouse') return o.mouse ?? o.keyboard;
  return o.keyboard;
}
