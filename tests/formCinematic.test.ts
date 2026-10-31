import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FORM_CINE_PHASES, formCineFrame, formCinePhaseAt, formCinePlan, formCineSwapAt, type FormCineKind } from '../src/scenes/formCinematic.ts';

const KINDS: FormCineKind[] = ['tera', 'max', 'z'];

test('formCinePlan: 5 fases en orden, 1,5-2 s y reducida por debajo de 1 s', () => {
  for (const kind of KINDS) {
    const p = formCinePlan(kind, false);
    const l = formCinePlan(kind, true);
    for (const plan of [p, l]) {
      assert.equal(plan.ends.length, FORM_CINE_PHASES[kind].length);
      for (let i = 1; i < plan.ends.length; i++) assert.ok(plan.ends[i] > plan.ends[i - 1], `${kind} orden`);
      assert.equal(plan.ends[plan.ends.length - 1], plan.total);
    }
    assert.ok(p.total >= 1500 && p.total <= 2000, `${kind} dura ${p.total}`);
    assert.ok(l.total < 1000 && l.total < p.total);
    assert.ok(l.shakePeak < p.shakePeak && l.zoomPeak < p.zoomPeak);
  }
});

test('cada cinemática recorre sus fases y acaba en done', () => {
  for (const kind of KINDS) {
    const p = formCinePlan(kind, false);
    assert.equal(formCinePhaseAt(p, 0), 'zoom');
    FORM_CINE_PHASES[kind].forEach((name, i) => assert.equal(formCinePhaseAt(p, (i ? p.ends[i - 1] : 0) + 1), name));
    assert.equal(formCinePhaseAt(p, p.total), 'done');
    assert.equal(formCinePhaseAt(p, p.total + 5000), 'done');
  }
});

test('empieza y acaba con la cámara en su sitio, sin temblor ni destello', () => {
  for (const kind of KINDS) {
    for (const low of [false, true]) {
      const p = formCinePlan(kind, low);
      const a = formCineFrame(p, 0, 1.65);
      assert.equal(a.zoom, 1);
      assert.equal(a.shake, 0);
      const z = formCineFrame(p, p.total, 1.65);
      assert.equal(z.zoom, 1);
      assert.equal(z.shake, 0);
      assert.equal(z.white, 0);
      assert.equal(z.grow, 1);
      assert.equal(z.squash, 1);
      // nunca se pasa del zoom máximo ni del temblor máximo
      for (let t = 0; t <= p.total; t += 10) {
        const f = formCineFrame(p, t, 1.65);
        assert.ok(f.zoom >= 1 - 1e-9 && f.zoom <= p.zoomPeak + 1e-9, `${kind} zoom ${f.zoom} en ${t}`);
        assert.ok(f.shake >= 0 && f.shake <= p.shakePeak + 1e-9);
        assert.ok(f.white >= 0 && f.white <= 1);
        assert.ok(f.build >= 0 && f.build <= 1 + 1e-9);
      }
    }
  }
});

test('Dinamax: el sprite empieza a su tamaño normal y crece a golpes hasta el gigante', () => {
  const p = formCinePlan('max', false);
  const mul = 1.65;
  assert.ok(Math.abs(formCineFrame(p, 0, mul).grow - 1 / mul) < 1e-9);
  assert.ok(Math.abs(formCineFrame(p, p.ends[1] - 1, mul).grow - 1 / mul) < 1e-9, 'antes de crecer, tamaño normal');
  // al final del crecimiento ya es gigante y en ningún momento se dispara
  assert.ok(Math.abs(formCineFrame(p, p.ends[2] - 1, mul).grow - 1) < 0.08);
  let max = 0;
  for (let t = p.ends[1]; t < p.ends[2]; t += 5) max = Math.max(max, formCineFrame(p, t, mul).grow);
  assert.ok(max > 1 / mul + 0.2 && max < 1.15, `crece con rebote acotado (${max})`);
});

test('Z: se agacha en la pose y se estira al liberar; Tera: el cristal se forma y estalla', () => {
  const z = formCinePlan('z', false);
  assert.ok(formCineFrame(z, z.ends[1] - 5).squash < 0.92);
  assert.ok(formCineFrame(z, (z.ends[2] + z.ends[3]) / 2).squash > 1.05);
  const t = formCinePlan('tera', false);
  assert.ok(formCineFrame(t, t.ends[0] + 10).build < 0.1);
  assert.equal(formCineFrame(t, t.ends[1] + 10).build, 1);
  assert.ok(formCineFrame(t, t.ends[3] - 5).build < 0.1);
  for (const kind of KINDS) {
    const p = formCinePlan(kind, false);
    assert.equal(formCineSwapAt(p), p.ends[2]);
  }
});
