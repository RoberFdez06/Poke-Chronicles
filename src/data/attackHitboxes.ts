// Catálogo de hitboxes de los ataques (sin Phaser). Cada ataque tiene DOS formas hechas con los mismos números:
// `drawn` (lo que se ve: aviso, zona marcada, rayo, onda) y `hit` (lo que daña; la usa la partida para golpear).
// Regla: `hit` ⊆ `drawn` (tests/hitbox.test.ts) y el daño nunca empieza antes de que acabe el aviso.
// Las funciones *Hit son las que llama GameScene/attacks.ts: si se cambia un dibujo, se cambia aquí y el test avisa.
import { capsule, circle, ellipse, floorZone, ray, type Shape } from './hitbox.ts';
import { allStyles } from './moveSignatures.ts';
import { FOE_STYLES, type Pattern } from './movePatterns.ts';
import { hazardSpec, laserSpec, megaBlastSpec, shockwaveSpec, MEGA_BLAST_WIDTH, TELEGRAPH_MS } from './bossPatterns.ts';
import { bounceSpec, crossSpec, dashSpec, gridSpec, meteorSpec, miasmaSpec, wallSpec } from './bossBlitz.ts';
import { JUDGMENT_BAND, NOVA } from './finalePhases.ts';
import { MINE_RADIUS } from './enemies.ts';

/** Tamaño del píxel del arte (PX de ui/art/pixelFx.ts, que no se puede importar aquí porque usa Phaser). */
export const ART_PX = 6;
/** drawPixBeam: el ancho late entre el 65 % y el 105 %; de media, el 85 %. Lo que daña es el núcleo (80 %). */
export const BEAM_DRAW = 0.85;
export const BEAM_CORE = 0.8;
/** Ancho mínimo con que se dibuja el rayo de los patrones (attacks.ts, 'beam'). */
export const beamDrawWidth = (width: number): number => Math.max(ART_PX * 3, width);
/** Medio ancho que daña de un rayo dibujado con drawPixBeam de ancho total `w`. */
export const beamHalf = (w: number): number => (w * BEAM_CORE) / 2;

/** Rayo de patrón (enemigos, jefes y tuyo): cápsula del núcleo. */
export const patternBeamHit = (x: number, y: number, a: number, len: number, width: number): Shape => ray(x, y, a, len, beamHalf(beamDrawWidth(width)));
/** Láser giratorio del jefe (drawBossLaser: drawPixBeam de 22). */
export const BOSS_LASER_DRAW = 22;
export const bossLaserHit = (x: number, y: number, a: number, len: number): Shape => ray(x, y, a, len, beamHalf(BOSS_LASER_DRAW));
/** Estallido mega: aviso de 2 × MEGA_BLAST_WIDTH y golpe con drawPixBeam del mismo ancho. */
export const megaBlastHit = (x: number, y: number, a: number, len: number): Shape => ray(x, y, a, len, beamHalf(MEGA_BLAST_WIDTH * 2));
/** Zonas del suelo de los patrones (lluvia, bomba, erupción, terremoto): la marca pixMarker, achatada. */
export const markerHit = (x: number, y: number, r: number): Shape => floorZone(x, y, r);
/** Mina de patrón (trapFx: elipse de r × 0,6 r). Se arma al tocar el 70 % de la runa. */
export const TRAP_FLAT = 0.6;
export const trapHit = (x: number, y: number, r: number): Shape => ellipse(x, y, r, r * TRAP_FLAT);
export const trapTrigger = (x: number, y: number, r: number): Shape => ellipse(x, y, r * 0.7, r * 0.7 * TRAP_FLAT);
/** Remolino: daña en la sombra del suelo (elipse de 0,85 R × 0,275 R, strokeEllipse del remolino). */
export const vortexHit = (x: number, y: number, R: number): Shape => ellipse(x, y, R * 0.85, R * 0.275);
/** Onda del jefe (drawShockRing: bolas de 9 px de radio en r): daña el anillo de ±6 px fuera del hueco. */
export const shockHit = (x: number, y: number, r: number, gapAt: number, gap: number): Shape => ({ k: 'ring', x, y, r, w: 6, gapAt, gap });
/** Nova desesperada (drawNovaWave: banda de r − 12 a r + 11). */
export const novaHit = shockHit;
/** Meteoro: el aviso es una elipse R × 0,6 R (meteorWarn). */
export const METEOR_FLAT = 0.6;
export const meteorHit = (x: number, y: number, R: number): Shape => ellipse(x, y, R, R * METEOR_FLAT);
/** Miasma: las nubes de drawMiasma cubren ~0,9 R; daña el 75 % central. */
export const miasmaHit = (x: number, y: number, R: number): Shape => circle(x, y, R * 0.75);
/** Embestida del jefe: el carril avisado mide `width`; daña el cuerpo del jefe (medio carril). */
export const dashHit = (x: number, y: number, width: number): Shape => circle(x, y, width / 2);
/** Emerger de un enemigo que cava: solo el cuerpo que sale (antes eran 70 px alrededor). */
export const emergeHit = (x: number, y: number, size: number): Shape => circle(x, y, size * 0.35);
/** Proyectil con textura proj-*: cuerpo 13,3 px de textura escalados; la forma dibujada mide 16 (+ borde). */
export const PROJ_SCALE = 2.4 * 0.75;
export const projHitR = (size: number): number => (10 / 0.75 / 2) * PROJ_SCALE * size;
export const projDrawR = (size: number): number => 8 * PROJ_SCALE * size;

export interface HitboxEntry {
  id: string;
  /** Qué es, en español, para la tabla de la bitácora. */
  label: string;
  drawn: Shape;
  hit: Shape;
  /** ms de aviso (lo dibujado antes del golpe) y cuándo empieza a dañar. */
  warnMs: number;
  hitFromMs: number;
}

const patternEntries = (who: string, p: Pattern, foe: boolean): HitboxEntry[] => {
  const warn = foe ? 600 : 90;
  switch (p.k) {
    case 'beam': {
      const len = p.length;
      return [{
        id: `${who}:beam`, label: 'rayo', warnMs: warn, hitFromMs: warn,
        drawn: ray(0, 0, 0, len, (beamDrawWidth(p.width) * BEAM_DRAW) / 2),
        hit: patternBeamHit(0, 0, 0, len, p.width),
      }];
    }
    case 'quake':
      return [{ id: `${who}:quake`, label: 'terremoto', warnMs: foe ? 500 : 0, hitFromMs: foe ? 500 : 0, drawn: floorZone(0, 0, p.radius), hit: markerHit(0, 0, p.radius) }];
    case 'rain':
      return [{ id: `${who}:rain`, label: 'lluvia', warnMs: p.delay, hitFromMs: p.delay, drawn: floorZone(0, 0, p.radius), hit: markerHit(0, 0, p.radius) }];
    case 'lob':
      return foe ? [{ id: `${who}:lob`, label: 'bomba', warnMs: 900, hitFromMs: 900, drawn: floorZone(0, 0, p.radius), hit: markerHit(0, 0, p.radius) }] : [];
    case 'eruption':
      return foe ? [{ id: `${who}:eruption`, label: 'erupción', warnMs: 450, hitFromMs: 450, drawn: floorZone(0, 0, p.radius), hit: markerHit(0, 0, p.radius) }] : [];
    case 'mine':
      return foe ? [{ id: `${who}:mine`, label: 'mina', warnMs: 90, hitFromMs: 90, drawn: ellipse(0, 0, p.radius, p.radius * TRAP_FLAT), hit: trapHit(0, 0, p.radius) }] : [];
    case 'vortex':
      return [{ id: `${who}:vortex`, label: 'remolino', warnMs: 0, hitFromMs: 0, drawn: ellipse(0, 0, p.radius * 0.85, p.radius * 0.275), hit: vortexHit(0, 0, p.radius) }];
    case 'shot':
    case 'nova':
    case 'wall':
    case 'orbit':
    case 'stream':
      return [{ id: `${who}:${p.k}`, label: 'proyectil', warnMs: 0, hitFromMs: 0, drawn: circle(0, 0, projDrawR(p.size)), hit: circle(0, 0, projHitR(p.size)) }];
    default:
      return [];
  }
};

/** Todos los ataques con su dibujo y su hitbox (pisos 1, 10 y 25; fases 1 y 2). */
export function hitboxCatalog(): HitboxEntry[] {
  const out: HitboxEntry[] = [];
  for (const { type, style } of allStyles()) {
    out.push(...patternEntries(`tuyo/jefe ${type}/${style.id}`, style.pattern, false));
    out.push(...patternEntries(`jefe ${type}/${style.id}`, style.pattern, true));
  }
  for (const [type, p] of Object.entries(FOE_STYLES)) out.push(...patternEntries(`enemigo ${type}`, p, true));
  out.push({ id: 'disparo enemigo', label: 'proyectil', warnMs: 0, hitFromMs: 0, drawn: circle(0, 0, 9), hit: circle(0, 0, 9) });
  for (const floor of [1, 10, 25]) {
    for (const ph of [1, 2] as const) {
      const f = `piso ${floor} f${ph}`;
      const ls = laserSpec(floor, ph);
      out.push({ id: `láser ${f}`, label: 'láser giratorio', warnMs: TELEGRAPH_MS, hitFromMs: TELEGRAPH_MS, drawn: ray(0, 0, 0.7, ls.length, (BOSS_LASER_DRAW * BEAM_DRAW) / 2), hit: bossLaserHit(0, 0, 0.7, ls.length) });
      const mb = megaBlastSpec(floor);
      out.push({ id: `estallido mega ${f}`, label: 'estallido mega', warnMs: mb.warnMs, hitFromMs: mb.warnMs, drawn: ray(0, 0, 1.2, mb.length, MEGA_BLAST_WIDTH * BEAM_DRAW), hit: megaBlastHit(0, 0, 1.2, mb.length) });
      const sw = shockwaveSpec(floor, ph);
      for (const r of [60, 200, sw.maxRadius]) out.push({ id: `onda r${r} ${f}`, label: 'onda', warnMs: TELEGRAPH_MS, hitFromMs: TELEGRAPH_MS, drawn: { k: 'ring', x: 0, y: 0, r, w: 9, gapAt: 1, gap: sw.gap }, hit: shockHit(0, 0, r, 1, sw.gap) });
      const hz = hazardSpec(floor, ph);
      out.push({ id: `zona de peligro ${f}`, label: 'zona de peligro', warnMs: TELEGRAPH_MS + hz.warnMs, hitFromMs: TELEGRAPH_MS + hz.warnMs, drawn: circle(0, 0, hz.radius), hit: circle(0, 0, hz.radius) });
      const me = meteorSpec(floor, ph);
      out.push({ id: `meteoro ${f}`, label: 'meteoro', warnMs: me.warnMs, hitFromMs: me.warnMs, drawn: ellipse(0, 0, me.radius, me.radius * METEOR_FLAT), hit: meteorHit(0, 0, me.radius) });
      const mi = miasmaSpec(floor, ph);
      out.push({ id: `miasma ${f}`, label: 'miasma', warnMs: mi.warnMs, hitFromMs: mi.warnMs, drawn: circle(0, 0, mi.radius * 0.9), hit: miasmaHit(0, 0, mi.radius) });
      const bo = bounceSpec(floor, ph);
      out.push({ id: `orbes ${f}`, label: 'orbes que rebotan', warnMs: bo.warnMs, hitFromMs: bo.warnMs, drawn: circle(0, 0, bo.radius), hit: circle(0, 0, bo.radius) });
      const cr = crossSpec(floor, ph);
      out.push({ id: `minas en cruz ${f}`, label: 'minas en cruz', warnMs: cr.fuseMs, hitFromMs: cr.fuseMs, drawn: ray(0, 0, 0, cr.length, (cr.width * BEAM_DRAW) / 2), hit: ray(0, 0, 0, cr.length, beamHalf(cr.width)) });
      const gr = gridSpec(floor, ph);
      out.push({ id: `rejilla ${f}`, label: 'rejilla de rayos', warnMs: gr.warnMs, hitFromMs: gr.warnMs, drawn: { k: 'rect', x: 0, y: 0, w: gr.width * BEAM_DRAW, h: 600 }, hit: { k: 'rect', x: 0, y: 0, w: beamHalf(gr.width) * 2, h: 600 } });
      const wa = wallSpec(floor, ph);
      out.push({ id: `muro ${f}`, label: 'muro con hueco', warnMs: wa.warnMs, hitFromMs: wa.warnMs, drawn: { k: 'rect', x: 0, y: 0, w: wa.thick, h: 600 }, hit: { k: 'rect', x: 0, y: 0, w: wa.thick, h: 600 } });
      const da = dashSpec(floor, ph);
      out.push({ id: `embestida ${f}`, label: 'embestida marcada', warnMs: da.warnMs, hitFromMs: da.warnMs, drawn: capsule(0, 0, 400, 0, da.width / 2), hit: dashHit(200, 0, da.width) });
    }
  }
  out.push({ id: 'nova desesperada', label: 'nova desesperada', warnMs: NOVA.warnMs, hitFromMs: NOVA.warnMs, drawn: { k: 'ring', x: 0, y: 0, r: 200, w: 8, gapAt: 0, gap: NOVA.gap }, hit: novaHit(0, 0, 200, 0, NOVA.gap) });
  out.push({ id: 'cruz del juicio', label: 'cruz del juicio', warnMs: 900, hitFromMs: 900, drawn: { k: 'rect', x: 0, y: 0, w: JUDGMENT_BAND, h: 600 }, hit: { k: 'rect', x: 0, y: 0, w: JUDGMENT_BAND, h: 600 } });
  out.push({ id: 'lluvia del jefe', label: 'lluvia del jefe', warnMs: TELEGRAPH_MS + 150, hitFromMs: TELEGRAPH_MS + 150, drawn: circle(0, 0, 56), hit: circle(0, 0, 56) });
  out.push({ id: 'enemigo mina', label: 'enemigo mina', warnMs: 600, hitFromMs: 600, drawn: circle(0, 0, MINE_RADIUS), hit: circle(0, 0, MINE_RADIUS) });
  for (const size of [60, 90]) out.push({ id: `emerger ${size}`, label: 'enemigo que cava', warnMs: 0, hitFromMs: 0, drawn: circle(0, 0, size * 0.42), hit: emergeHit(0, 0, size) });
  return out;
}
