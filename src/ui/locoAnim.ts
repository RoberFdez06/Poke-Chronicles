// Pone la pose de data/locomotion.ts a un sprite de Pokémon: subida y vaivén moviendo el origen (el cuerpo físico,
// si lo tiene, se compensa para que no se mueva), ángulo y, solo en los que no tienen cuerpo físico, aplastar y
// estirar (en los que sí, cambiar la escala cambiaría su caja de choque).
import Phaser from 'phaser';
import { locoPose, locomotionOf, sheetHover, type Locomotion, type LocoPose } from '../data/locomotion';
import { PROC_FRAMES, procFrameAt, procFrames } from '../data/procLoco';

type Sprite = Phaser.GameObjects.Sprite;
type Body = Phaser.Physics.Arcade.Body;

/** Sube el dibujo `lift` px y lo desplaza `dx` px sin mover el cuerpo físico. */
export function liftSprite(s: Sprite, lift: number, dx = 0): void {
  const body = s.body as Body | null;
  const l = lift / Math.max(0.01, Math.abs(s.scaleY));
  const x = dx / Math.max(0.01, Math.abs(s.scaleX));
  const dl = l - ((s.getData('lift') as number | undefined) ?? 0);
  if (Math.abs(dl) > 0.01 && s.height > 0) {
    s.setOrigin(s.originX, s.originY + dl / s.height);
    if (body) body.offset.y += dl;
    s.setData('lift', l);
  }
  const dX = x - ((s.getData('liftX') as number | undefined) ?? 0);
  if (Math.abs(dX) > 0.01 && s.width > 0) {
    s.setOrigin(s.originX + dX / s.width, s.originY);
    if (body) body.offset.x += dX;
    s.setData('liftX', x);
  }
}

/** Deshace la subida y el vaivén (antes de cambiar de textura o de tamaño). */
export function resetLift(s: Sprite): void {
  liftSprite(s, 0, 0);
  unsquash(s);
}

/** Quita el aplastado/estirado de la escala. */
export function unsquash(s: Sprite): void {
  const m = s.getData('poseMul') as [number, number] | undefined;
  const base = s.getData('poseBase') as [number, number] | undefined;
  if (m && base && Math.abs(s.scaleX - base[0] * m[0]) < 1e-4 && Math.abs(s.scaleY - base[1] * m[1]) < 1e-4) s.setScale(base[0], base[1]);
  s.setData('poseMul', undefined).setData('poseBase', undefined);
}

/**
 * Pone la pose entera. `angle` se suaviza (0,35 por fotograma); `squash` solo en sprites sin cuerpo físico.
 * Si alguien ha cambiado la escala por su cuenta (setDisplaySize) se nota porque ya no cuadra con la guardada.
 */
export function applyPose(s: Sprite, pose: LocoPose, opts: { angle?: boolean; squash?: boolean } = {}): void {
  liftSprite(s, pose.lift, pose.dx);
  if (opts.squash ?? !s.body) {
    const m = s.getData('poseMul') as [number, number] | undefined;
    const base = s.getData('poseBase') as [number, number] | undefined;
    // Escala de base: la actual sin el multiplicador anterior (si nadie la ha tocado desde entonces)
    let bx = s.scaleX, by = s.scaleY;
    if (m && base && Math.abs(s.scaleX - base[0] * m[0]) < 1e-4 && Math.abs(s.scaleY - base[1] * m[1]) < 1e-4) {
      bx = base[0];
      by = base[1];
    }
    s.setScale(bx * pose.sx, by * pose.sy);
    s.setData('poseMul', [pose.sx, pose.sy]).setData('poseBase', [bx, by]);
  }
  if (opts.angle ?? true) s.setAngle(Phaser.Math.Linear(s.angle, pose.angle, 0.35));
}

/** Semilla de fase por sprite (para que no anden todos a la vez). */
export function stepSeed(s: Sprite): number {
  let v = s.getData('stepSeed') as number | undefined;
  if (v === undefined) {
    v = Math.random() * 6;
    s.setData('stepSeed', v);
  }
  return v;
}

/**
 * Pose de un fotograma según cómo se mueve el Pokémon. Con hoja de SpriteCollab (`pmd`) las patas ya se mueven: solo
 * se le añade un balanceo suave y, si vuela o flota, que vaya por el aire; sin hoja, la animación procedural entera.
 */
export function poseFor(s: Sprite, types: readonly string[], species: number | undefined, t: number, moving: boolean, pmd: boolean): LocoPose {
  const loco = locomotionOf(types, species);
  const seed = stepSeed(s);
  if (pmd) {
    const h = sheetHover(loco, t, moving, seed);
    return { lift: h.lift, angle: moving ? Math.sin(t / 85 + seed) * 3 : 0, sx: 1, sy: 1, dx: 0, shadow: h.shadow };
  }
  return locoPose(loco, t, moving, seed, s.flipX ? 1 : -1);
}

/** Para sprites sueltos (aliados, ayudantes, vistas del Tower Defense): calcula y pone la pose; devuelve la de la sombra. */
export function dressLoose(s: Sprite, types: readonly string[], species: number | undefined, t: number, moving: boolean): number {
  procAnimate(s, types, species, t, moving);
  const pose = poseFor(s, types, species, t, moving, !!s.getData('pmd'));
  applyPose(s, pose);
  return pose.shadow;
}

/** Sufijo de las hojas de locomoción hechas por código (data/procLoco.ts) a partir de un dibujo fijo. */
export const PROC_SUFFIX = '~loco-';
const procFailed = new Set<string>();

/** Textura de origen de un sprite (quitando la hoja procedural si ya la lleva). */
export const procBaseKey = (key: string): string => (key.includes(PROC_SUFFIX) ? key.slice(0, key.indexOf(PROC_SUFFIX)) : key);

/**
 * Crea (una vez) la hoja de 4 fotogramas de `loco` a partir del dibujo fijo `base`. Devuelve su clave, o null si no
 * se puede (textura con varios fotogramas, imagen sin permiso de lectura, vacía…).
 */
export function ensureProcSheet(scene: Phaser.Scene, base: string, loco: Locomotion): string | null {
  const key = `${base}${PROC_SUFFIX}${loco}`;
  if (scene.textures.exists(key)) return key;
  if (procFailed.has(key) || !scene.textures.exists(base) || typeof document === 'undefined') return null;
  try {
    const tex = scene.textures.get(base);
    if (tex.frameTotal > 2) throw new Error('hoja con varios fotogramas');
    const img = tex.getSourceImage() as CanvasImageSource & { width: number; height: number };
    const w = img.width, h = img.height;
    if (!w || !h) throw new Error('vacía');
    const c = document.createElement('canvas');
    c.width = w * PROC_FRAMES;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('sin 2d');
    ctx.drawImage(img, 0, 0);
    const src = ctx.getImageData(0, 0, w, h).data;
    procFrames(src, w, h, loco).forEach((px, i) => {
      const d = ctx.createImageData(w, h);
      d.data.set(px);
      ctx.putImageData(d, i * w, 0);
    });
    scene.textures.addSpriteSheet(key, c as unknown as HTMLImageElement, { frameWidth: w, frameHeight: h });
    if (!scene.textures.exists(key)) throw new Error('no se creó');
    scene.textures.get(key).setFilter(tex.source[0]?.scaleMode === Phaser.ScaleModes.NEAREST ? Phaser.Textures.FilterMode.NEAREST : Phaser.Textures.FilterMode.LINEAR);
    return key;
  } catch {
    procFailed.add(key);
    return null;
  }
}

/**
 * Sprites sin hoja de SpriteCollab (dibujo fijo de PokeAPI, megas, Dinamax, oscuros, formas sin hoja…): pone el
 * fotograma de locomoción hecho por código (pies que se levantan, alas que baten, onda al reptar…). Parado vuelve
 * al dibujo original. Devuelve si lo ha podido animar. Si otro código cambia la textura (girarse, mega…), en la
 * siguiente llamada se rehace a partir de la nueva.
 */
export function procAnimate(s: Sprite, types: readonly string[], species: number | undefined, t: number, moving: boolean): boolean {
  if (s.getData('pmd') || !s.texture) return false;
  const base = procBaseKey(s.texture.key);
  if (base === '__MISSING' || base === '__DEFAULT') return false;
  const loco = locomotionOf(types, species);
  const sheet = ensureProcSheet(s.scene, base, loco);
  if (!sheet) return false;
  const frame = procFrameAt(loco, t, moving, stepSeed(s));
  if (s.texture.key !== sheet || String(s.frame.name) !== String(frame)) s.setTexture(sheet, frame);
  return true;
}
