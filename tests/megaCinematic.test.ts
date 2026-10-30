import { test } from 'node:test';
import assert from 'node:assert/strict';
import { megaCamRestore, megaCineFrame, megaCinePhaseAt, megaCinePlan, megaTypeStyle } from '../src/scenes/megaCinematic.ts';

test('megaCinePlan: fases en orden, total ~2 s y reducido más corto', () => {
  for (const low of [false, true]) {
    const p = megaCinePlan(low);
    const ends = [p.ends.zoom, p.ends.charge, p.ends.morph, p.ends.burst, p.ends.release];
    for (let i = 1; i < ends.length; i++) assert.ok(ends[i] > ends[i - 1]);
    assert.equal(p.ends.release, p.total);
    assert.ok(p.swapAt > p.ends.charge && p.swapAt < p.ends.morph, 'el cambio de sprite cae dentro del destello');
  }
  assert.ok(megaCinePlan(false).total >= 1800 && megaCinePlan(false).total <= 2500);
  assert.ok(megaCinePlan(true).total < megaCinePlan(false).total);
  assert.ok(megaCinePlan(true).shakePeak < megaCinePlan(false).shakePeak);
});

test('megaCinePhaseAt recorre zoom → carga → transformación → onda → vuelta → fin', () => {
  const p = megaCinePlan(false);
  assert.equal(megaCinePhaseAt(p, 0), 'zoom');
  assert.equal(megaCinePhaseAt(p, p.ends.zoom), 'charge');
  assert.equal(megaCinePhaseAt(p, p.ends.charge + 1), 'morph');
  assert.equal(megaCinePhaseAt(p, p.ends.morph + 1), 'burst');
  assert.equal(megaCinePhaseAt(p, p.ends.burst + 1), 'release');
  assert.equal(megaCinePhaseAt(p, p.total), 'done');
  assert.equal(megaCinePhaseAt(p, p.total + 9999), 'done');
});

test('megaCineFrame: empieza y acaba con la cámara en su sitio, temblor creciente en la carga', () => {
  const p = megaCinePlan(false);
  const a = megaCineFrame(p, 0);
  assert.equal(a.zoom, 1);
  assert.equal(a.morph, 0);
  const z = megaCineFrame(p, p.total);
  assert.equal(z.phase, 'done');
  assert.equal(z.zoom, 1);
  assert.equal(z.shake, 0);
  assert.equal(z.white, 0);
  assert.equal(z.morph, 1);
  assert.equal(z.pulse, 1);
  const c1 = megaCineFrame(p, p.ends.zoom + 50).shake;
  const c2 = megaCineFrame(p, p.ends.charge - 50).shake;
  assert.ok(c2 > c1);
  // Silueta blanca entera durante la transformación y zoom al máximo
  const m = megaCineFrame(p, (p.ends.charge + p.ends.morph) / 2);
  assert.equal(m.white, 1);
  assert.equal(m.zoom, p.zoomPeak);
  // Nunca pasa del pico ni baja de 1
  for (let t = -100; t <= p.total + 100; t += 25) {
    const f = megaCineFrame(p, t);
    assert.ok(f.zoom >= 1 && f.zoom <= p.zoomPeak + 1e-9, `zoom en ${t}`);
    assert.ok(f.shake >= 0 && f.shake <= p.shakePeak + 1e-9);
    assert.ok(f.morph >= 0 && f.morph <= 1);
  }
});

test('megaCineFrame: la mezcla base → mega es gradual y monótona alrededor del cambio', () => {
  const p = megaCinePlan(false);
  let prev = -1;
  let partial = false;
  for (let t = 0; t <= p.total; t += 20) {
    const m = megaCineFrame(p, t).morph;
    assert.ok(m >= prev);
    if (m > 0 && m < 1) partial = true;
    prev = m;
  }
  assert.ok(partial, 'hay fotogramas a medio fundido');
  assert.ok(megaCineFrame(p, p.swapAt).morph > 0.3 && megaCineFrame(p, p.swapAt).morph < 0.7);
});

test('megaCamRestore: zoom de la sala, scroll fijo solo en sala normal y deshielo solo si lo heló ella', () => {
  const home = { zoom: 1.5, scrollX: 100, scrollY: 50, follows: false };
  assert.deepEqual(megaCamRestore(home, { frozeWorld: true, roomChanged: false, ended: false }), { zoom: 1.5, scroll: { x: 100, y: 50 }, resetShake: true, thaw: true });
  assert.equal(megaCamRestore({ ...home, follows: true }, { frozeWorld: true, roomChanged: false, ended: false }).scroll, null);
  assert.equal(megaCamRestore(home, { frozeWorld: true, roomChanged: true, ended: false }).scroll, null);
  assert.equal(megaCamRestore(home, { frozeWorld: false, roomChanged: false, ended: false }).thaw, false);
  assert.equal(megaCamRestore(home, { frozeWorld: true, roomChanged: false, ended: true }).thaw, false);
});

test('megaTypeStyle: cada tipo con sus partículas y uno por defecto', () => {
  assert.equal(megaTypeStyle('fire'), 'embers');
  assert.equal(megaTypeStyle('water'), 'drops');
  assert.equal(megaTypeStyle('electric'), 'sparks');
  assert.equal(megaTypeStyle('dragon'), 'scales');
  assert.equal(megaTypeStyle('fairy'), 'stars');
  assert.equal(megaTypeStyle('???'), 'stars');
});
