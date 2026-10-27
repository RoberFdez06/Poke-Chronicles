// Recorre TODAS las especies con mega (jugador y jefes) y comprueba forma, sprite (nombre PokeAPI) y condición.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MEGA_FORMS, MEGA_STONE_ID, megaBlock, megaOffered, newPowerFormState } from '../src/data/powerForm.ts';
import { MEGA_BOSS_IDS, bossMegaForm, legendMegaAtPhase, megaKind, shouldMegaEvolve } from '../src/data/megaBoss.ts';
import { nextBossEvent } from '../src/level/arenaPhase.ts';

test('jugador: cada especie con mega puede megaevolucionar con piedra y adrenalina llena', () => {
  for (const [id, form] of MEGA_FORMS) {
    assert.match(form, /^[a-z-]+-(mega(-[xy])?|primal)$/, `forma de ${id}`);
    const ctx = { speciesId: id, passives: [MEGA_STONE_ID], adrenalineFull: true };
    assert.ok(megaOffered(ctx), `${id} ofrecida`);
    assert.equal(megaBlock(newPowerFormState(), ctx), null, `${id} sin bloqueo`);
    assert.equal(megaBlock(newPowerFormState(), { ...ctx, adrenalineFull: false }), 'adrenaline');
  }
});

test('jefes: toda especie con mega (y los legendarios de MEGA_BOSS_IDS) megaevoluciona con forma y sprite', () => {
  const ids = new Set([...MEGA_FORMS.keys(), ...MEGA_BOSS_IDS]);
  for (const id of ids) {
    assert.equal(megaKind(id), 'mega', `${id}`);
    assert.ok(bossMegaForm(id, () => 0), `${id} sin forma`);
    assert.ok(legendMegaAtPhase(id, 1), `${id} en la cacería`);
  }
  // Condición alcanzable para un jefe: al bajar del 50 % (tras la fase 1 de arena) el suceso es la mega
  const jefe = { boss: true, miniboss: false, helper: false };
  assert.ok(shouldMegaEvolve({ done: false }, jefe, 0.45));
  assert.equal(nextBossEvent({ ratio: 0.45, arenaDone: 1, megaDone: false, arena: true, mega: true, now: 10000, busyUntil: 0 }), 'mega');
});

test('Mewtwo: mega X o Y y megaevoluciona como jefe y como legendario de la cacería', () => {
  assert.equal(bossMegaForm(150, () => 0.1), 'mewtwo-mega-x');
  assert.equal(bossMegaForm(150, () => 0.9), 'mewtwo-mega-y');
  assert.equal(megaKind(150), 'mega');
  assert.ok(legendMegaAtPhase(150, 1));
  assert.ok(!legendMegaAtPhase(150, 2));
  assert.equal(megaKind(644), 'furia', 'Zekrom: forma furia');
});
