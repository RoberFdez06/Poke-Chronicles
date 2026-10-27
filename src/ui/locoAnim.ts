// Pone la pose de data/locomotion.ts a un sprite de Pokémon: subida y vaivén moviendo el origen (el cuerpo físico,
// si lo tiene, se compensa para que no se mueva), ángulo y, solo en los que no tienen cuerpo físico, aplastar y
// estirar (en los que sí, cambiar la escala cambiaría su caja de choque).
import Phaser from 'phaser';
import { locoPose, locomotionOf, sheetHover, type LocoPose } from '../data/locomotion';

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
  const pose = poseFor(s, types, species, t, moving, !!s.getData('pmd'));
  applyPose(s, pose);
  return pose.shadow;
}
