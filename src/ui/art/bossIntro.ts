// Intro de cine de los jefes (pedido por Roberto, 27/10): al entrar en la sala del jefe, bandas de cine, la cámara se
// acerca al jefe, rugido y destello, y su nombre con un título en grande. El reto final, más larga y en dorado.
// Saltable con teclado, ratón y mando. Con pocos efectos, versión corta sin cámara.
import Phaser from 'phaser';
import { FONT } from '../theme';
import { GAME_VIEW } from '../layout';
import { darkOf, lightOf, pixRing } from './pixelFx';
import { starBurst } from './combatFx';

/** Títulos propios de los legendarios más conocidos (Pokédex nacional). */
const SPECIES_TITLE: Readonly<Record<number, string>> = {
  144: 'Ave del Hielo Eterno', 145: 'Ave del Trueno', 146: 'Ave de las Llamas', 150: 'El Pokémon Genético', 151: 'Origen de Todo',
  243: 'Bestia del Rayo', 244: 'Bestia Volcánica', 245: 'Bestia de la Aurora', 249: 'Guardián de los Mares', 250: 'Fénix del Arcoíris',
  251: 'Viajero del Tiempo', 377: 'Coloso de Roca', 378: 'Coloso de Hielo', 379: 'Coloso de Acero', 380: 'Eon del Cielo', 381: 'Eon del Viento',
  382: 'Señor de los Océanos', 383: 'Señor de la Tierra', 384: 'Señor del Firmamento', 385: 'Estrella de los Deseos', 386: 'Visitante del Espacio',
  480: 'Guardián del Saber', 481: 'Guardiana de las Emociones', 482: 'Guardián de la Voluntad', 483: 'Señor del Tiempo', 484: 'Señor del Espacio',
  485: 'Corazón de Magma', 486: 'Titán Colosal', 487: 'Señor de la Distorsión', 488: 'Cisne de la Luna', 491: 'Señor de las Pesadillas',
  492: 'Mensajero de las Flores', 493: 'Dios de la Creación', 494: 'Pokémon de la Victoria',
  638: 'Espada de Hierro', 639: 'Espada de Roca', 640: 'Espada del Bosque', 641: 'Señor del Torbellino', 642: 'Señor del Relámpago',
  643: 'Dragón de la Verdad', 644: 'Dragón de los Ideales', 645: 'Señor de la Fertilidad', 646: 'Dragón del Vacío',
  716: 'Árbol de la Vida', 717: 'Ave de la Destrucción', 718: 'Guardián del Orden', 785: 'Espíritu del Trueno', 786: 'Espíritu de la Mente',
  787: 'Espíritu del Bosque', 788: 'Espíritu del Mar', 791: 'Encarnación del Sol', 792: 'Encarnación de la Luna', 800: 'Devorador de Luz',
  888: 'Héroe de la Espada', 889: 'Héroe del Escudo', 890: 'Calamidad Infinita', 898: 'Rey de la Abundancia',
  1001: 'Tesoro del Bosque', 1002: 'Tesoro del Hielo', 1003: 'Tesoro de la Tierra', 1007: 'Leyenda del Pasado', 1008: 'Leyenda del Futuro',
  1024: 'Corona del Terapozo',
};
/** Respaldo por tipo. */
const TYPE_TITLE: Readonly<Record<string, string>> = {
  normal: 'Señor de lo Absoluto', fire: 'Señor de las Llamas', water: 'Señor de las Mareas', grass: 'Señor del Bosque', electric: 'Señor del Trueno',
  ice: 'Señor del Hielo', fighting: 'Maestro del Combate', poison: 'Señor de la Ponzoña', ground: 'Señor de la Tierra', flying: 'Señor de los Cielos',
  psychic: 'Señor de la Mente', bug: 'Rey del Enjambre', rock: 'Coloso de Piedra', ghost: 'Señor de las Sombras', dragon: 'Dragón Ancestral',
  dark: 'Señor de la Noche', steel: 'Coloso de Acero', fairy: 'Señor de la Luz Feérica',
};

/** Título del jefe: el de su especie si tiene; si no, el de su primer tipo. */
export function bossTitle(speciesId: number | undefined, types: readonly string[]): string {
  return (speciesId !== undefined ? SPECIES_TITLE[speciesId] : undefined) ?? TYPE_TITLE[types[0] ?? 'normal'] ?? 'Jefe legendario';
}

export interface BossCinematic {
  /** El jefe (o el primero del trío); `others`, el resto de jefes a los que también enfoca. */
  boss: Phaser.GameObjects.Sprite;
  others?: Phaser.GameObjects.Sprite[];
  name: string;
  title: string;
  color: number;
  final?: boolean;
  low?: boolean;
  /** Mete un objeto en la capa del HUD (cámara sin zoom, coordenadas reales de pantalla). */
  hud: <T extends Phaser.GameObjects.GameObject>(o: T) => T;
  /** Zoom normal de la cámara del juego y a quién vuelve a seguir. */
  zoom: number;
  follow: Phaser.GameObjects.GameObject;
  roar: () => void;
  onDone: () => void;
}

/** Duración de la intro (ms) sin saltar. */
export const cinematicMs = (final: boolean, low: boolean) => (low ? 900 : final ? 3200 : 2100);

/**
 * Lanza la intro de cine. No para la escena: quien llama congela el combate mientras dura. Llama a `onDone` una vez
 * (al acabar o al saltarla con tecla, clic o botón del mando).
 */
export function bossCinematic(sc: Phaser.Scene, o: BossCinematic) {
  const final = !!o.final;
  const low = !!o.low;
  const ms = cinematicMs(final, low);
  const V = GAME_VIEW;
  const cam = sc.cameras.main;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const keep = <T extends Phaser.GameObjects.GameObject>(g: T): T => (objs.push(g), o.hud(g));
  const gold = 0xffd34d;
  const accent = final ? gold : o.color;
  let done = false;

  // Bandas de cine (en el HUD, dentro de la vista del juego)
  const bar = Math.round(V.h * (final ? 0.13 : 0.1));
  const top = keep(sc.add.rectangle(V.x + V.w / 2, V.y - bar / 2, V.w, bar, 0x000000, 1).setDepth(80));
  const bot = keep(sc.add.rectangle(V.x + V.w / 2, V.y + V.h + bar / 2, V.w, bar, 0x000000, 1).setDepth(80));
  sc.tweens.add({ targets: top, y: V.y + bar / 2, duration: low ? 1 : 320, ease: 'Cubic.easeOut' });
  sc.tweens.add({ targets: bot, y: V.y + V.h - bar / 2, duration: low ? 1 : 320, ease: 'Cubic.easeOut' });
  // Filo de color en el borde de las bandas (animado: brilla a pulsos)
  const edge = keep(sc.add.graphics().setDepth(81));
  const paintEdge = (t: number) => {
    edge.clear();
    const a = low ? 0.8 : 0.55 + 0.35 * Math.sin(t / 140);
    edge.fillStyle(accent, a).fillRect(V.x, top.y + bar / 2, V.w, 4).fillRect(V.x, bot.y - bar / 2 - 4, V.w, 4);
    edge.fillStyle(lightOf(accent), a * 0.6).fillRect(V.x, top.y + bar / 2 + 4, V.w, 2).fillRect(V.x, bot.y - bar / 2 - 6, V.w, 2);
  };

  // Nombre y título en grande, abajo (en la banda y sobre la sala)
  const ty = V.y + V.h - bar - (final ? 120 : 96);
  const nameSize = final ? 92 : 76;
  const name = keep(
    sc.add.text(V.x + V.w / 2, ty, o.name.toUpperCase(), { fontFamily: FONT, fontSize: `${nameSize}px`, fontStyle: 'bold', color: final ? '#ffe680' : '#ffffff' })
      .setOrigin(0.5).setStroke('#' + darkOf(accent).toString(16).padStart(6, '0'), 12).setShadow(0, 6, '#000000', 0, true, true).setDepth(82),
  );
  const title = keep(
    sc.add.text(V.x + V.w / 2, ty + nameSize * 0.72, `— ${o.title} —`, { fontFamily: FONT, fontSize: `${final ? 40 : 32}px`, fontStyle: 'bold', color: final ? '#ffd34d' : '#' + lightOf(o.color).toString(16).padStart(6, '0') })
      .setOrigin(0.5).setStroke('#101828', 8).setDepth(82),
  );
  const tag = final
    ? keep(sc.add.text(V.x + V.w / 2, V.y + bar + 40, '✦ RETO FINAL ✦', { fontFamily: FONT, fontSize: '44px', fontStyle: 'bold', color: '#ffd34d' }).setOrigin(0.5).setStroke('#3a2400', 10).setDepth(82))
    : undefined;
  const hint = keep(sc.add.text(V.x + V.w - 24, V.y + V.h - bar / 2, 'Saltar ▶', { fontFamily: FONT, fontSize: '22px', color: '#c8d0e8' }).setOrigin(1, 0.5).setDepth(83).setAlpha(0.8));
  // Raya de luz detrás del nombre que se abre de lado a lado
  const streak = keep(sc.add.graphics().setDepth(81));
  const paintStreak = (k: number) => {
    streak.clear();
    const w = V.w * Math.min(1, k * 1.6);
    const cx = V.x + V.w / 2;
    streak.fillStyle(0x000000, 0.45).fillRect(cx - w / 2, ty - nameSize * 0.6, w, nameSize * 1.75);
    streak.fillStyle(accent, 0.9).fillRect(cx - w / 2, ty - nameSize * 0.6, w, 4).fillRect(cx - w / 2, ty + nameSize * 1.15 - 4, w, 4);
    // Píxeles de brillo que corren por la raya
    for (let i = 0; i < 14; i++) {
      const px = cx - w / 2 + ((i * 97 + k * 900) % Math.max(1, w));
      streak.fillStyle(i % 3 ? lightOf(accent) : 0xffffff, 0.8).fillRect(Math.round(px / 6) * 6, ty - nameSize * 0.6 + (i % 2 ? -6 : nameSize * 1.75), 6, 6);
    }
  };
  if (!low) {
    name.setScale(2.4).setAlpha(0);
    title.setAlpha(0).setY(title.y + 30);
    tag?.setAlpha(0).setScale(0.6);
  }

  // Cámara: deja de seguir al jugador, se acerca al jefe y vuelve
  const t0 = sc.time.now;
  const reveal = low ? 0 : final ? 900 : 600;
  if (!low) {
    cam.stopFollow();
    const focus = o.others && o.others.length ? [o.boss, ...o.others] : [o.boss];
    const fx = focus.reduce((a, s) => a + s.x, 0) / focus.length;
    const fy = focus.reduce((a, s) => a + s.y, 0) / focus.length;
    cam.pan(fx, fy, reveal, 'Sine.easeInOut', true);
    cam.zoomTo(o.zoom * (final ? 1.3 : 1.22), reveal, 'Sine.easeInOut', true);
    sc.time.delayedCall(reveal, () => {
      if (done) return;
      o.roar();
      cam.flash(final ? 380 : 240, 255, 255, 255);
      cam.shake(final ? 700 : 400, final ? 0.012 : 0.008);
      for (const s of focus) {
        if (!s.active) continue;
        pixRing(sc, s.x, s.y + s.displayHeight * 0.3, s.displayWidth * 0.9, accent, 520, 9);
        starBurst(sc, s.x, s.y - s.displayHeight * 0.2, accent, final ? 9 : 6, final ? 1.6 : 1.2);
        sc.tweens.add({ targets: s, scaleX: s.scaleX * 1.12, scaleY: s.scaleY * 1.12, duration: 140, yoyo: true, repeat: 1, ease: 'Quad.easeOut' });
      }
      sc.tweens.add({ targets: name, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
      sc.tweens.add({ targets: title, alpha: 1, y: title.y - 30, duration: 320, delay: 160, ease: 'Cubic.easeOut' });
      if (tag) sc.tweens.add({ targets: tag, alpha: 1, scale: 1, duration: 320, ease: 'Back.easeOut' });
      if (final) {
        // Segundo latido: destello dorado y anillo enorme
        sc.time.delayedCall(700, () => {
          if (done) return;
          cam.flash(260, 255, 211, 77);
          pixRing(sc, o.boss.x, o.boss.y, o.boss.displayWidth * 1.8, gold, 700, 9);
        });
      }
    });
  } else {
    o.roar();
  }
  const ticker = sc.time.addEvent({
    delay: 50, loop: true,
    callback: () => {
      const t = sc.time.now - t0;
      paintEdge(t);
      paintStreak(low ? 1 : Math.max(0, (t - reveal) / 500));
      hint.setAlpha(0.5 + 0.4 * Math.sin(t / 200));
      if (final && tag && !low) tag.setScale(1 + 0.05 * Math.sin(t / 180));
    },
  });
  ticker.callback?.();

  const finish = () => {
    if (done) return;
    done = true;
    ticker.remove();
    off();
    if (!low) {
      const f = o.follow as unknown as { x: number; y: number };
      cam.pan(f.x, f.y, 300, 'Sine.easeInOut', true);
      cam.zoomTo(o.zoom, 300, 'Sine.easeInOut', true);
      sc.time.delayedCall(320, () => cam.startFollow(o.follow, true, 0.12, 0.12));
    }
    sc.tweens.add({ targets: top, y: V.y - bar / 2, duration: 260, ease: 'Cubic.easeIn' });
    sc.tweens.add({ targets: bot, y: V.y + V.h + bar / 2, duration: 260, ease: 'Cubic.easeIn' });
    const fade = objs.filter((g) => g !== top && g !== bot);
    sc.tweens.add({ targets: fade, alpha: 0, duration: 240 });
    sc.time.delayedCall(300, () => objs.forEach((g) => g.destroy()));
    o.onDone();
  };
  // Saltar: teclado, ratón/táctil y mando (cada uno por su lado). Armado tras 250 ms para que el gesto que te trajo a
  // la sala no la salte nada más empezar.
  let armed = false;
  sc.time.delayedCall(250, () => (armed = true));
  const onKey = (e: KeyboardEvent) => armed && ['Enter', ' ', 'Escape', 'Backspace', 'x', 'X', 'z', 'Z'].includes(e.key) && finish();
  const onPointer = () => armed && finish();
  const onPad = () => armed && finish();
  sc.input.keyboard?.on('keydown', onKey);
  sc.input.on('pointerdown', onPointer);
  sc.input.gamepad?.on('down', onPad);
  function off() {
    sc.input.keyboard?.off('keydown', onKey);
    sc.input.off('pointerdown', onPointer);
    sc.input.gamepad?.off('down', onPad);
  }
  sc.time.delayedCall(ms, finish);
  sc.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { off(); ticker.remove(); });
  return { skip: finish };
}
