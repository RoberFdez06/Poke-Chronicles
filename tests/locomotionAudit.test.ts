// Auditoría de locomoción: todas las especies y formas del juego tienen que andar, volar, flotar, nadar, reptar,
// botar o rodar con fotogramas que cambian al moverse (con hoja de SpriteCollab o con los hechos por código).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LOCOMOTION_PROFILES, hasExplicitLocomotion, locoPose, locomotionOf, type Locomotion } from '../src/data/locomotion.ts';
import { PROC_FRAMES, alphaBox, procFrameAt, procFrames } from '../src/data/procLoco.ts';
import { REGIONAL_FORMS } from '../src/data/regionalForms.ts';
import { MEGA_PMD_FORM, PMD_MISSING, pmdAvailable } from '../src/data/pmdForms.ts';

interface Sp { id: number; name: string; types: string[] }
const index: Sp[] = JSON.parse(fs.readFileSync(new URL('../public/data/species-index.json', import.meta.url), 'utf8'));
const ALL: Sp[] = [...index, ...REGIONAL_FORMS.map((r) => ({ id: r.id, name: r.name, types: [...r.types] }))];
const KINDS = Object.keys(LOCOMOTION_PROFILES) as Locomotion[];

/** Dibujo de prueba 32×32: cuerpo redondo con dos patas y dos alas, como un Pokémon de PokeAPI en pequeño. */
function fakeSprite(): { px: Uint8ClampedArray; w: number; h: number } {
  const w = 32, h = 32;
  const px = new Uint8ClampedArray(w * h * 4);
  const put = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    px[i] = 200; px[i + 1] = 80; px[i + 2] = 40; px[i + 3] = 255;
  };
  for (let y = 6; y < 24; y++) for (let x = 8; x < 24; x++) if ((x - 16) ** 2 + (y - 15) ** 2 < 70) put(x, y);
  for (let y = 22; y < 30; y++) { put(11, y); put(12, y); put(19, y); put(20, y); } // patas
  for (let x = 2; x < 9; x++) { put(x, 12); put(31 - x, 12); } // alas
  return { px, w, h };
}
const differs = (a: ArrayLike<number>, b: ArrayLike<number>) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return true; return false; };

test('cada forma de moverse tiene 4 fotogramas distintos (nunca un dibujo rígido que se desliza)', () => {
  const { px, w, h } = fakeSprite();
  for (const k of KINDS) {
    const fr = procFrames(px, w, h, k);
    assert.equal(fr.length, PROC_FRAMES);
    assert.ok(!differs(fr[0], px), `${k}: el 0 es el dibujo original`);
    const moved = fr.slice(1).filter((f) => differs(f, px)).length;
    assert.ok(moved >= 2, `${k}: al menos 2 fotogramas cambian el dibujo (${moved})`);
    for (const f of fr) assert.ok(alphaBox(f, w, h), `${k}: ningún fotograma se queda vacío`);
  }
});

test('andar levanta un pie y luego el otro (no es un saltito del dibujo entero)', () => {
  const { px, w, h } = fakeSprite();
  const [, f1, , f3] = procFrames(px, w, h, 'walk');
  const footAt = (f: Uint8ClampedArray, x: number) => f[(29 * w + x) * 4 + 3] > 0;
  assert.ok(!footAt(f1, 11) && footAt(f1, 20), 'f1: pie izquierdo arriba, derecho apoyado');
  assert.ok(footAt(f3, 11) && !footAt(f3, 20), 'f3: pie derecho arriba, izquierdo apoyado');
});

test('volar bate las alas: los lados se mueven mucho más que el centro', () => {
  const { px, w, h } = fakeSprite();
  const [, up, , down] = procFrames(px, w, h, 'fly');
  const wingRow = (f: Uint8ClampedArray) => { for (let y = 0; y < h; y++) if (f[(y * w + 3) * 4 + 3] > 0) return y; return -1; };
  assert.ok(wingRow(up) < 12 && wingRow(down) > 12, `alas arriba (${wingRow(up)}) y abajo (${wingRow(down)})`);
});

test('el ciclo pasa por todos los fotogramas al moverse y vuelve al dibujo parado', () => {
  for (const k of KINDS) {
    const seen = new Set(Array.from({ length: 60 }, (_, i) => procFrameAt(k, i * 37, true, 0.4)));
    assert.equal(seen.size, PROC_FRAMES, k);
    assert.equal(procFrameAt(k, 1234, false, 0.4), 0);
  }
});

test('auditoría: todas las especies y formas del juego tienen locomoción animada', () => {
  const sprite = fakeSprite();
  const sinAnim: string[] = [];
  for (const s of ALL) {
    const loco = locomotionOf(s.types, s.id);
    assert.ok(KINDS.includes(loco), `${s.id} ${s.name}`);
    // Con hoja de SpriteCollab anda con la hoja; sin ella (o si falla la descarga) con los fotogramas hechos por código
    const frames = procFrames(sprite.px, sprite.w, sprite.h, loco);
    if (!frames.slice(1).some((f) => differs(f, sprite.px))) sinAnim.push(`${s.id} ${s.name}`);
    // Y además la pose (subida, giro, estiramiento, vaivén) se mueve
    const poses = Array.from({ length: 30 }, (_, i) => locoPose(loco, i * 31, true, 0.2));
    const spread = (f: (p: (typeof poses)[number]) => number) => Math.max(...poses.map(f)) - Math.min(...poses.map(f));
    assert.ok(spread((p) => p.lift) + spread((p) => p.angle) / 10 + spread((p) => p.sx) * 10 + spread((p) => p.dx) > 0.5, `${s.id} pose`);
  }
  assert.deepEqual(sinAnim, []);
  // Las especies sin hoja de SpriteCollab y las megas sin hoja dependen de los fotogramas hechos por código
  assert.ok([...PMD_MISSING].every((id) => !pmdAvailable(id)));
  assert.ok(ALL.filter((s) => !pmdAvailable(s.id)).length >= PMD_MISSING.size - 1);
  assert.ok(MEGA_PMD_FORM.size > 0);
});

test('auditoría: los que no se mueven como dice su tipo tienen su modo puesto a mano', () => {
  const want: [number, Locomotion][] = [
    [94, 'walk'], [623, 'walk'], [972, 'walk'], [10115, 'walk'], [724, 'walk'], // fantasmas / voladores con patas
    [11, 'hop'], [14, 'hop'], [268, 'hop'], // capullos
    [88, 'slither'], [10112, 'slither'], [218, 'slither'], [704, 'slither'], [960, 'slither'], [50, 'slither'], [10105, 'slither'],
    [233, 'float'], [517, 'float'], [582, 'float'], [703, 'float'], [785, 'float'], [793, 'float'],
    [86, 'swim'], [978, 'swim'], [742, 'fly'], [953, 'roll'],
    [10173, 'swim'], [10109, 'roll'], [10166, 'walk'], [10167, 'float'], // formas regionales
  ];
  for (const [id, loco] of want) {
    const s = ALL.find((x) => x.id === id);
    assert.ok(s, `${id} existe`);
    assert.equal(locomotionOf(s.types, id), loco, `${id} ${s.name}`);
    assert.ok(hasExplicitLocomotion(id), `${id} explícito`);
  }
});
