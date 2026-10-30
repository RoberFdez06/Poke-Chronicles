import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  comboAlive, comboBonus, comboBonusText, comboBreak, comboHit, comboHurt, comboLevel, comboLevelIndex, comboTimeLeft, newCombo, tickCombo,
  COMBO_IDLE_RATE, COMBO_LEVELS, COMBO_MAX_STEP_MS, COMBO_WINDOW_MS,
} from '../src/data/combo.ts';

test('cada golpe suma (también varios a la vez) y rellena el tiempo entero', () => {
  const s = newCombo();
  comboHit(s);
  tickCombo(s, 80);
  tickCombo(s, 80);
  assert.ok(s.left < COMBO_WINDOW_MS);
  // Golpe de área a tres enemigos en el mismo fotograma: tres golpes
  comboHit(s, 3);
  assert.equal(s.count, 4);
  assert.equal(s.left, COMBO_WINDOW_MS);
  assert.equal(s.hits, 4);
  assert.equal(comboHit(s, 0), null);
  assert.equal(s.count, 4);
});

test('golpes de todos los tipos cuentan igual (la escena llama a comboHit con cada daño hecho)', () => {
  const kinds = ['disparo', 'area', 'quemadura', 'veneno', 'reflejo', 'ayudante', 'jefe', 'rayo', 'escudo', 'reaccion'];
  const s = newCombo();
  for (const _k of kinds) comboHit(s);
  assert.equal(s.count, kinds.length);
});

test('el tiempo solo baja con tickCombo y el paso se recorta: una pausa larga no lo corta', () => {
  const s = newCombo();
  comboHit(s);
  // Volver de una pausa de 30 s llega como un solo paso enorme: cuenta como mucho COMBO_MAX_STEP_MS
  assert.equal(tickCombo(s, 30_000), 0);
  assert.equal(s.left, COMBO_WINDOW_MS - COMBO_MAX_STEP_MS);
  assert.ok(comboAlive(s));
});

test('si pasa la ventana sin golpear, se acaba y dice cuánto era', () => {
  const s = newCombo();
  comboHit(s, 7);
  let broke = 0;
  for (let t = 0; t < COMBO_WINDOW_MS && !broke; t += 50) broke = tickCombo(s, 50);
  assert.equal(broke, 7);
  assert.ok(!comboAlive(s));
  assert.equal(s.best, 7);
  // El siguiente golpe empieza otro
  comboHit(s);
  assert.equal(s.count, 1);
});

test('sin enemigos en la sala (entre salas) baja más despacio', () => {
  const a = newCombo();
  const b = newCombo();
  comboHit(a);
  comboHit(b);
  tickCombo(a, 100, true);
  tickCombo(b, 100);
  assert.equal(COMBO_WINDOW_MS - a.left, 100 * COMBO_IDLE_RATE);
  assert.ok(a.left > b.left);
});

test('recibir daño no lo corta: le quita tiempo', () => {
  const s = newCombo();
  comboHit(s, 10);
  comboHurt(s);
  assert.ok(comboAlive(s));
  assert.equal(s.count, 10);
  assert.ok(s.left < COMBO_WINDOW_MS);
  assert.equal(comboBreak(s), 10);
  assert.equal(comboTimeLeft(s), 0);
});

test('niveles con nombre y bonificaciones que crecen', () => {
  assert.deepEqual(COMBO_LEVELS.map((l) => [l.at, l.name]), [[5, 'Racha'], [15, 'Frenesí'], [30, 'Imparable'], [60, 'Leyenda']]);
  assert.equal(comboLevel(4), null);
  assert.equal(comboLevel(5)?.name, 'Racha');
  assert.equal(comboLevel(59)?.name, 'Imparable');
  assert.equal(comboLevel(999)?.name, 'Leyenda');
  assert.equal(comboLevelIndex(3), -1);
  assert.equal(comboLevelIndex(60), 3);
  for (let i = 1; i < COMBO_LEVELS.length; i++) {
    assert.ok(COMBO_LEVELS[i].damage > COMBO_LEVELS[i - 1].damage);
    assert.ok(COMBO_LEVELS[i].meter > COMBO_LEVELS[i - 1].meter);
  }
  const s = newCombo();
  assert.deepEqual(comboBonus(s), { damage: 1, speed: 1, loot: 0, meter: 1 });
  const ups: string[] = [];
  for (let i = 0; i < 61; i++) {
    const l = comboHit(s);
    if (l) ups.push(l.name);
  }
  assert.deepEqual(ups, ['Racha', 'Frenesí', 'Imparable', 'Leyenda']);
  assert.equal(comboBonus(s).damage, COMBO_LEVELS[3].damage);
  // Golpe múltiple que salta de nivel: avisa del nivel nuevo
  const m = newCombo();
  comboHit(m, 4);
  assert.equal(comboHit(m, 12)?.name, 'Frenesí');
  assert.match(comboBonusText(COMBO_LEVELS[2]), /daño.*vel.*botín.*medidor/);
  // Con el combo acabado no hay bonificación
  comboBreak(s);
  assert.equal(comboBonus(s).damage, 1);
});
