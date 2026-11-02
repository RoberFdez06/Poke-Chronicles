// Ejecutar con `npm test`. Tutorial de práctica contra Arceus (bossTutorial.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advance, bossHpFloor, currentStep, enterSandbox, hasTutorial, inSandbox, leaveSandbox, markPracticed, newTutorial, practiced,
  refillHp, shortCooldown, shouldOfferTutorial, skipAll, stepCounter, stepText, storageCopy, TUTORIAL_BONUS, TUTORIAL_MODES,
  tutButtons, tutorialModeFor, tutorialStats, tutorialSteps,
} from '../src/data/bossTutorial.ts';
import { activeStorage, MemoryStorage, setActiveStorage } from '../src/data/storage.ts';
import { emptyTutorial, parseTutorial } from '../src/data/tutorial.ts';

test('modos con tutorial: todos los de GameScene; el diario y el código usan el de Normal; la Defensa no', () => {
  assert.deepEqual([...TUTORIAL_MODES], ['normal', 'waves', 'endless', 'bossrush', 'tower']);
  assert.equal(tutorialModeFor('daily'), 'normal');
  assert.equal(tutorialModeFor('code'), 'normal');
  assert.equal(tutorialModeFor('tower'), 'tower');
  assert.equal(tutorialModeFor('towerdef'), null);
  assert.equal(hasTutorial('towerdef'), false);
});

test('los pasos cubren jefe, escudo, fases, frenesí, parry, esquiva, formas, fusiones, guía y el modo', () => {
  for (const m of TUTORIAL_MODES) {
    const ids = tutorialSteps(m).map((s) => s.id);
    for (const id of ['move', 'shoot', 'bars', 'phases', 'frenzy', 'parry', 'dash', 'transform', 'fusion', 'guide', 'mode', 'finish']) assert.ok(ids.includes(id), `${m}: ${id}`);
    assert.equal(new Set(ids).size, ids.length);
    const all = tutorialSteps(m).map((s) => s.text).join(' ');
    assert.match(all, /33 %/);
    assert.match(all, /Mega Piedra/);
  }
  // El paso del modo cambia según el modo
  const modeText = (m: (typeof TUTORIAL_MODES)[number]) => tutorialSteps(m).find((s) => s.id === 'mode')!.text;
  assert.equal(new Set(TUTORIAL_MODES.map(modeText)).size, TUTORIAL_MODES.length);
});

test('en táctil los pasos no hablan de teclas ni del mando', () => {
  for (const s of tutorialSteps('normal')) {
    const t = stepText(s, true);
    assert.doesNotMatch(t, /W A S D|stick|cruceta|Mayús|\bRT\b|\bF,/, s.id);
  }
  assert.doesNotMatch(Object.values(tutButtons(true)).join(' '), /R3|L3|\bT\b|\bN\b/);
  assert.match(tutButtons(false).next, /T/);
});

test('avance: los pasos de acción esperan su acción; continuar avanza cualquiera; saltar acaba', () => {
  const p = newTutorial('waves');
  assert.equal(currentStep(p)!.id, 'intro');
  assert.equal(advance(p, 'parry'), false);
  assert.equal(advance(p, 'continue'), true);
  assert.equal(currentStep(p)!.id, 'move');
  assert.equal(advance(p, 'shoot'), false);
  assert.equal(advance(p, 'move'), true);
  assert.equal(advance(p, 'shoot'), true);
  assert.equal(stepCounter(p), `Paso 4/${tutorialSteps('waves').length}`);
  while (currentStep(p)?.id !== 'parry') advance(p, 'continue');
  assert.equal(advance(p, 'dash'), false);
  assert.equal(advance(p, 'parry'), true);
  assert.equal(currentStep(p)!.id, 'dash');
  while (!p.done) advance(p, 'continue');
  assert.equal(currentStep(p), null);
  assert.equal(advance(p, 'continue'), false);
  const q = newTutorial('tower');
  skipAll(q);
  assert.ok(q.done);
});

test('el jefe no cae hasta el último paso', () => {
  const p = newTutorial('normal');
  assert.ok(bossHpFloor(p) > 0);
  while (currentStep(p)?.id !== 'finish') advance(p, 'continue');
  assert.equal(bossHpFloor(p), 0);
  skipAll(p);
  assert.equal(bossHpFloor(p), 0);
});

test('bonos: muy potenciado, recargas cortas y no se cae', () => {
  const base = { damage: 3, fireDelay: 400, speed: 200, maxHp: 6, range: 500 };
  const s = tutorialStats(base);
  assert.ok(s.damage >= base.damage * 3);
  assert.ok(s.fireDelay < base.fireDelay);
  assert.ok(s.speed > base.speed);
  assert.ok(s.maxHp >= TUTORIAL_BONUS.minHp);
  assert.equal(s.range, 500);
  assert.equal(shortCooldown(5000, 1000, 150), 1150);
  assert.equal(shortCooldown(1100, 1000, 150), 1100);
  assert.equal(refillHp(5, 40), 40);
  assert.equal(refillHp(30, 40), 30);
});

test('sandbox: lo que se guarda en el tutorial se tira; solo queda el tutorial jugado', () => {
  const prev = activeStorage();
  try {
    const real = new MemoryStorage({ 'pokeisaac.tickets': '10', 'pokeisaac.tutorial': JSON.stringify({ seen: ['move'], off: false }) });
    setActiveStorage(real);
    enterSandbox();
    assert.ok(inSandbox());
    const box = activeStorage()!;
    assert.notEqual(box, real);
    assert.equal(box.getItem('pokeisaac.tickets'), '10');
    box.setItem('pokeisaac.tickets', '9999');
    box.setItem('pokeisaac.records', '{"normal":99}');
    enterSandbox(); // segunda vez: no cambia
    assert.equal(activeStorage(), box);
    leaveSandbox('bossrush');
    assert.equal(inSandbox(), false);
    assert.equal(activeStorage(), real);
    assert.equal(real.getItem('pokeisaac.tickets'), '10');
    assert.equal(real.getItem('pokeisaac.records'), null);
    const st = parseTutorial(real.getItem('pokeisaac.tutorial'));
    assert.deepEqual(st.seen, ['move']);
    assert.ok(practiced(st, 'bossrush'));
    leaveSandbox('normal'); // fuera del sandbox: nada
    assert.equal(practiced(parseTutorial(real.getItem('pokeisaac.tutorial')), 'normal'), false);
  } finally {
    setActiveStorage(prev);
  }
});

test('copia de un almacenamiento con claves (localStorage) y oferta la primera vez', () => {
  const m = new Map([['pokeisaac.a', '1'], ['otro', '2']]);
  const ls = { get length() { return m.size; }, key: (i: number) => [...m.keys()][i] ?? null, getItem: (k: string) => m.get(k) ?? null, setItem: () => {} };
  assert.deepEqual(storageCopy(ls), { 'pokeisaac.a': '1' });
  assert.deepEqual(storageCopy(null), {});
  const s = emptyTutorial();
  assert.equal(shouldOfferTutorial(s, 'normal'), true);
  assert.equal(shouldOfferTutorial(markPracticed(s, 'normal'), 'normal'), false);
  assert.equal(shouldOfferTutorial(s, null), false);
  assert.equal(markPracticed(markPracticed(s, 'tower'), 'tower').practice.length, 1);
});
