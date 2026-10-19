// Animaciones de combate (supervisor): chispas al golpear, números de daño, Pokémon que se debilitan, explosión
// final de los jefes, caída del jugador y pequeños detalles (fogonazo al disparar, chispa contra la pared).
// Todo es visual: nunca toca cuerpos físicos ni la lógica. Coordenadas del mundo (cámara de la sala).
import Phaser from 'phaser';
import { FONT } from '../theme';

const SPARK = 'cfx-spark';
const DUST = 'cfx-dust';
const STAR = 'cfx-star';

/** Crea (una vez) las texturas pixel de las partículas. Llamar en create(). */
export function bakeCombatFx(scene: Phaser.Scene) {
  const make = (key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({}, false);
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  };
  // Chispa: rombo alargado de 3 px de grosor (se tiñe)
  make(SPARK, 12, 4, (g) => {
    g.fillStyle(0xffffff, 1).fillRect(2, 1, 8, 2).fillRect(0, 1.5, 12, 1);
  });
  // Polvo: bola pixel con borde más oscuro
  make(DUST, 10, 10, (g) => {
    g.fillStyle(0x9a9080, 1).fillRect(2, 0, 6, 10).fillRect(0, 2, 10, 6);
    g.fillStyle(0xe8e0d0, 1).fillRect(2, 2, 6, 6);
    g.fillStyle(0xffffff, 1).fillRect(3, 2, 2, 2);
  });
  // Estrella de 9x9
  make(STAR, 9, 9, (g) => {
    g.fillStyle(0xffffff, 1).fillRect(4, 0, 1, 9).fillRect(0, 4, 9, 1).fillRect(3, 2, 3, 5).fillRect(2, 3, 5, 3);
  });
}

/** Chispas en abanico y un aro que se abre, donde golpea algo. */
export function hitSpark(scene: Phaser.Scene, x: number, y: number, color = 0xffffff, count = 6, scale = 1, depth = 8) {
  const ring = scene.add.circle(x, y, 6 * scale).setStrokeStyle(3, 0xffffff, 0.9).setDepth(depth);
  scene.tweens.add({ targets: ring, radius: 22 * scale, alpha: 0, duration: 200, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.6;
    const s = scene.add.image(x, y, SPARK).setTint(i % 2 ? color : 0xffffff).setRotation(a).setScale(scale * (1.4 + Math.random() * 0.6)).setDepth(depth);
    const d = (22 + Math.random() * 18) * scale;
    scene.tweens.add({
      targets: s, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, scaleX: 0.2, alpha: 0,
      duration: 180 + Math.random() * 90, ease: 'Cubic.easeOut', onComplete: () => s.destroy(),
    });
  }
}

/**
 * Número de daño que salta y cae en arco, como en los RPG. Crítico: más grande, amarillo y con "!".
 * `heal` en verde con "+".
 */
export function damageNumber(scene: Phaser.Scene, x: number, y: number, amount: number, o: { crit?: boolean; color?: string; heal?: boolean; depth?: number } = {}) {
  const n = Math.max(1, Math.round(amount));
  const text = o.heal ? `+${n}` : o.crit ? `${n}!` : `${n}`;
  const color = o.color ?? (o.heal ? '#7cf07a' : o.crit ? '#ffd34d' : '#ffffff');
  const size = o.crit ? 26 : 18;
  const t = scene.add
    .text(x + Phaser.Math.Between(-8, 8), y, text, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color })
    .setOrigin(0.5)
    .setStroke('#101828', o.crit ? 6 : 5)
    .setDepth(o.depth ?? 16)
    .setScale(o.crit ? 1.8 : 1.4);
  const dx = Phaser.Math.Between(-26, 26);
  // Golpe de escala, sube en arco y cae un poco mientras se apaga
  scene.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: t, x: t.x + dx, duration: 620, ease: 'Linear' });
  scene.tweens.add({
    targets: t, y: y - (o.crit ? 46 : 34), duration: 300, ease: 'Quad.easeOut',
    onComplete: () => scene.tweens.add({ targets: t, y: t.y + 14, alpha: 0, duration: 320, ease: 'Quad.easeIn', onComplete: () => t.destroy() }),
  });
}

/** Nube de polvo a ras de suelo (al debilitarse, al caer, al aterrizar). */
export function dustBurst(scene: Phaser.Scene, x: number, y: number, scale = 1, count = 8, depth = 6) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const d = scene.add.image(x, y, DUST).setScale(scale * (1.6 + Math.random())).setDepth(depth).setAlpha(0.95);
    scene.tweens.add({
      targets: d, x: x + Math.cos(a) * 34 * scale, y: y + Math.sin(a) * 12 * scale - 6 * scale, scale: 0.4 * scale, alpha: 0,
      duration: 420 + Math.random() * 160, ease: 'Cubic.easeOut', onComplete: () => d.destroy(),
    });
  }
}

/** Estrellitas que suben girando (al debilitar a un enemigo, al ganar). */
export function starBurst(scene: Phaser.Scene, x: number, y: number, color = 0xffe066, count = 5, scale = 1, depth = 9) {
  for (let i = 0; i < count; i++) {
    const s = scene.add.image(x, y, STAR).setTint(i % 2 ? color : 0xffffff).setScale(scale * 2).setDepth(depth);
    const a = -Math.PI / 2 + (i - (count - 1) / 2) * 0.45;
    const d = (40 + Math.random() * 20) * scale;
    scene.tweens.add({
      targets: s, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, angle: 180, scale: 0.6 * scale, alpha: 0,
      duration: 560 + Math.random() * 160, ease: 'Cubic.easeOut', onComplete: () => s.destroy(),
    });
  }
}

/** Copia solo visual de un sprite (textura, frame, volteo, escala, ángulo) para animarlo tras destruir el real. */
function ghostOf(scene: Phaser.Scene, s: Phaser.GameObjects.Sprite) {
  const g = scene.add.sprite(s.x, s.y, s.texture.key, s.frame.name);
  g.setOrigin(s.originX, s.originY).setFlipX(s.flipX).setScale(s.scaleX, s.scaleY).setAngle(s.angle).setDepth(s.depth);
  if (s.isTinted && !s.tintFill) g.setTint(s.tintTopLeft);
  return g;
}

/** Sombra que se encoge con el que cae. */
function fadingShadow(scene: Phaser.Scene, x: number, y: number, w: number, ms: number) {
  const sh = scene.add.ellipse(x, y, w, w * 0.34, 0x000000, 0.28).setDepth(0.5);
  scene.tweens.add({ targets: sh, scaleX: 0.2, scaleY: 0.2, alpha: 0, duration: ms, ease: 'Quad.easeIn', onComplete: () => sh.destroy() });
}

/**
 * Un enemigo se debilita: destello blanco, se encoge contra el suelo con polvo y suelta estrellas. Se llama justo
 * antes de destruir el sprite real (esta copia es solo dibujo). `feetY` es donde estaban sus pies.
 */
export function faintEnemy(scene: Phaser.Scene, s: Phaser.GameObjects.Sprite, feetY: number, color: number) {
  const g = ghostOf(scene, s);
  const w = s.displayWidth;
  fadingShadow(scene, s.x, feetY, Math.max(18, w * 0.5), 520);
  g.setTintFill(0xffffff);
  const sx = g.scaleX;
  const sy = g.scaleY;
  // 1) golpe: crece un pelín en blanco  2) parpadea  3) se aplasta contra el suelo y se desvanece
  scene.tweens.add({ targets: g, scaleX: sx * 1.15, scaleY: sy * 1.15, duration: 70, yoyo: true });
  scene.time.delayedCall(90, () => g.active && g.clearTint().setTint(0xff9a8a));
  scene.time.delayedCall(150, () => g.active && g.setTintFill(0xffffff));
  scene.time.delayedCall(210, () => {
    if (!g.active) return;
    g.clearTint().setTint(0xc8c8d8);
    dustBurst(scene, s.x, feetY, Math.max(0.7, w / 70));
    starBurst(scene, s.x, s.y - s.displayHeight * 0.2, color, 4, Math.max(0.7, w / 80));
    // Origen en los pies para aplastarse hacia abajo
    const dy = feetY - g.y;
    g.setOrigin(g.originX, g.originY + dy / Math.max(1, g.displayHeight));
    g.y = feetY;
    scene.tweens.add({
      targets: g, scaleY: sy * 0.08, scaleX: sx * 1.35, alpha: 0, duration: 300, ease: 'Back.easeIn', onComplete: () => g.destroy(),
    });
  });
}

/**
 * Final del jefe: tiembla echando chispas con explosiones encadenadas, destello blanco y se desvanece. Las
 * explosiones usan `burst(x, y)` (p. ej. el estallido de su tipo).
 */
export function faintBoss(scene: Phaser.Scene, s: Phaser.GameObjects.Sprite, feetY: number, color: number, burst: (x: number, y: number) => void) {
  const g = ghostOf(scene, s);
  const w = s.displayWidth;
  const h = s.displayHeight;
  const cam = scene.cameras.main;
  const x0 = g.x;
  fadingShadow(scene, s.x, feetY, w * 0.5, 1500);
  // Tiembla de lado a lado mientras explota
  scene.tweens.add({ targets: g, x: x0 + 6, duration: 40, yoyo: true, repeat: 14 });
  for (let i = 0; i < 7; i++) {
    scene.time.delayedCall(i * 130, () => {
      if (!g.active) return;
      const px = s.x + Phaser.Math.Between(-w * 0.35, w * 0.35);
      const py = s.y + Phaser.Math.Between(-h * 0.3, h * 0.3);
      burst(px, py);
      hitSpark(scene, px, py, color, 8, 1.4);
      g.setTintFill(i % 2 ? 0xffffff : color);
      scene.time.delayedCall(60, () => g.active && g.clearTint());
      cam.shake(120, 0.006);
    });
  }
  scene.time.delayedCall(950, () => {
    if (!g.active) return;
    cam.flash(260, 255, 255, 255);
    cam.shake(380, 0.012);
    g.setTintFill(0xffffff);
    dustBurst(scene, s.x, feetY, 2.2, 14);
    starBurst(scene, s.x, s.y - h * 0.2, color, 9, 1.6);
    const ring = scene.add.circle(s.x, s.y, 20).setStrokeStyle(8, 0xffffff, 1).setDepth(9);
    scene.tweens.add({ targets: ring, radius: w * 1.1, alpha: 0, duration: 520, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    scene.tweens.add({ targets: g, alpha: 0, scaleX: g.scaleX * 1.3, scaleY: g.scaleY * 0.1, duration: 520, ease: 'Back.easeIn', onComplete: () => g.destroy() });
  });
}

/**
 * El jugador cae: parpadea en blanco, gira y se queda tumbado y apagado, con polvo. La cámara se acerca un poco.
 * El sprite real se queda (la partida está parada).
 */
export function faintPlayer(scene: Phaser.Scene, s: Phaser.GameObjects.Sprite, feetY: number, zoom: number) {
  s.anims.pause();
  const cam = scene.cameras.main;
  cam.shake(300, 0.01);
  cam.pan(s.x, s.y, 700, 'Sine.easeInOut', true);
  cam.zoomTo(zoom * 1.25, 900, 'Sine.easeInOut', true);
  let k = 0;
  scene.time.addEvent({
    delay: 90, repeat: 5,
    callback: () => (++k % 2 ? s.setTintFill(0xffffff) : s.clearTint()),
  });
  scene.time.delayedCall(600, () => {
    if (!s.active) return;
    s.clearTint().setTint(0x8890a8).setAlpha(1);
    dustBurst(scene, s.x, feetY, 1.4, 10);
    scene.tweens.add({ targets: s, angle: s.flipX ? -90 : 90, y: s.y + s.displayHeight * 0.18, duration: 360, ease: 'Bounce.easeOut' });
  });
}

/** Victoria: el jugador da dos saltitos de alegría entre estrellas. */
export function cheerPlayer(scene: Phaser.Scene, s: Phaser.GameObjects.Sprite) {
  const y0 = s.y;
  scene.tweens.add({ targets: s, y: y0 - 26, duration: 180, yoyo: true, repeat: 1, ease: 'Quad.easeOut', repeatDelay: 80 });
  starBurst(scene, s.x, s.y - 30, 0xffe066, 7, 1.3);
  scene.time.delayedCall(400, () => starBurst(scene, s.x, s.y - 30, 0x7cf07a, 7, 1.3));
}

/** Fogonazo pequeño al disparar, en la dirección del tiro. */
export function muzzle(scene: Phaser.Scene, x: number, y: number, dx: number, dy: number, color: number, depth = 6) {
  const len = Math.hypot(dx, dy) || 1;
  const c = scene.add.circle(x + (dx / len) * 26, y + (dy / len) * 26, 7, color, 0.9).setDepth(depth);
  c.setStrokeStyle(2, 0xffffff, 0.9);
  scene.tweens.add({ targets: c, radius: 14, alpha: 0, duration: 120, ease: 'Quad.easeOut', onComplete: () => c.destroy() });
}

/** Un disparo se rompe contra la pared o una roca. */
export function wallPop(scene: Phaser.Scene, x: number, y: number, color: number) {
  hitSpark(scene, x, y, color, 4, 0.6, 7);
}

/** Zarpazo: tres arañazos en diagonal que se dibujan de golpe y se apagan (golpes cuerpo a cuerpo). */
export function clawMarks(scene: Phaser.Scene, x: number, y: number, color: number, angle: number, depth = 9) {
  const g = scene.add.graphics({ x, y }).setDepth(depth).setRotation(angle + Math.PI / 4);
  for (let i = -1; i <= 1; i++) {
    g.lineStyle(9, 0x101828, 0.8).lineBetween(-26, i * 12 - 6, 26, i * 12 + 6);
    g.lineStyle(5, color, 1).lineBetween(-26, i * 12 - 6, 26, i * 12 + 6);
    g.lineStyle(2, 0xffffff, 0.9).lineBetween(-20, i * 12 - 5, 20, i * 12 + 4);
  }
  g.setScale(0.3, 1);
  scene.tweens.add({ targets: g, scaleX: 1, duration: 70, ease: 'Quad.easeOut' });
  scene.tweens.add({ targets: g, alpha: 0, delay: 160, duration: 220, onComplete: () => g.destroy() });
}

/** Onda de choque: anillos de color que se expanden (cuando un jefe cambia de fase). */
export function phaseShock(scene: Phaser.Scene, x: number, y: number, color: number, scale = 1, depth = 7) {
  for (let i = 0; i < 3; i++) {
    const ring = scene.add.ellipse(x, y, 40 * scale, 24 * scale).setStrokeStyle(4 - i, i === 0 ? 0xffffff : color, 1).setFillStyle(color, i === 0 ? 0.25 : 0).setDepth(depth);
    scene.tweens.add({
      targets: ring, scaleX: 9 + i * 2, scaleY: 9 + i * 2, alpha: 0, duration: 650 + i * 160, delay: i * 130, ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
  }
  starBurst(scene, x, y - 20 * scale, color, 8, scale * 1.2, depth + 2);
  dustBurst(scene, x, y + 10 * scale, scale * 1.6, 14, depth);
}

/**
 * Aura de furia: un óvalo palpitante del color del jefe bajo sus pies y brasas que suben mientras esté vivo.
 * Se encarga sola de desaparecer cuando el jefe deja de estar activo.
 */
export function bossAura(scene: Phaser.Scene, boss: Phaser.GameObjects.Sprite, color: number, feet: () => number, depth = 3) {
  const aura = scene.add.ellipse(boss.x, feet(), boss.displayWidth * 1.3, boss.displayWidth * 0.5).setFillStyle(color, 0.28).setStrokeStyle(2, color, 0.9).setDepth(depth);
  let nextEmber = 0;
  const tick = (time: number) => {
    if (!boss.active) {
      scene.events.off('update', tick);
      aura.destroy();
      return;
    }
    const pulse = 1 + Math.sin(time / 130) * 0.08;
    aura.setPosition(boss.x, feet()).setScale(pulse, pulse).setAlpha(0.75 + Math.sin(time / 90) * 0.25);
    if (time >= nextEmber) {
      nextEmber = time + 110;
      const e = scene.add.image(boss.x + (Math.random() - 0.5) * boss.displayWidth * 0.9, feet() - 4, DUST).setTint(color).setScale(1.2).setDepth(depth + 6).setAlpha(0.9);
      scene.tweens.add({ targets: e, y: e.y - 40 - Math.random() * 40, alpha: 0, scale: 0.3, duration: 650, onComplete: () => e.destroy() });
    }
  };
  scene.events.on('update', tick);
  scene.events.once('shutdown', () => scene.events.off('update', tick));
  return aura;
}
