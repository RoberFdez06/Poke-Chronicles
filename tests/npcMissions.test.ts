import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMissionEvent, emptyMissions, NPC_MAX_ACTIVE, NPC_MISSIONS, npcMissionById, offerNpcMission, parseMissions } from '../src/data/missions.ts';
import { acceptNpcMission, loadMissions, loadTickets, MISSIONS_KEY, recordMissionEvent } from '../src/data/save.ts';
import { MemoryStorage } from '../src/data/storage.ts';

const withNpc = (id: string, runsLeft?: number) => {
  const def = npcMissionById(id)!;
  return { ...emptyMissions(1), npc: [{ id, n: 0, runsLeft: runsLeft ?? def.runs }] };
};

test('los encargos de NPC tienen texto en español, objetivo, diálogo y caducidad', () => {
  assert.ok(NPC_MISSIONS.length >= NPC_MAX_ACTIVE + 2);
  assert.equal(new Set(NPC_MISSIONS.map((m) => m.id)).size, NPC_MISSIONS.length);
  for (const m of NPC_MISSIONS) {
    assert.ok(m.npc && m.dialog && m.text);
    assert.ok(m.goal >= 1 && m.runs >= 1 && m.reward.tickets > 0);
  }
});

test('se ofrecen como mucho 3 a la vez y nunca uno repetido; la oferta depende de la semilla', () => {
  let s = emptyMissions(1);
  for (let k = 0; k < NPC_MAX_ACTIVE; k++) {
    const r = offerNpcMission(s, 100 + k);
    assert.ok(r);
    s = r.state;
  }
  assert.equal(s.npc.length, NPC_MAX_ACTIVE);
  assert.equal(new Set(s.npc.map((a) => a.id)).size, NPC_MAX_ACTIVE);
  assert.equal(offerNpcMission(s, 7), null);
  assert.equal(offerNpcMission(emptyMissions(1), 42)!.mission.id, offerNpcMission(emptyMissions(1), 42)!.mission.id);
});

test('progreso: derrota 3 de agua cuenta solo los de agua y se completa con premio', () => {
  let s = withNpc('npc-agua');
  s = applyMissionEvent(s, { kind: 'defeat', types: ['fire'] }, 1).state;
  assert.equal(s.npc[0].n, 0);
  s = applyMissionEvent(s, { kind: 'defeat', types: ['water'] }, 1).state;
  s = applyMissionEvent(s, { kind: 'defeat', types: ['water', 'ground'] }, 1).state;
  assert.equal(s.npc[0].n, 2);
  const r = applyMissionEvent(s, { kind: 'defeat', types: ['water'] }, 1);
  assert.deepEqual(r.completed.map((c) => [c.kind, c.id]), [['npc', 'npc-agua']]);
  assert.equal(r.state.npc.length, 0, 'cumplido deja hueco');
});

test('progreso: piso 8 sin curarte y entregar una baya', () => {
  let s = withNpc('npc-piso8');
  s = applyMissionEvent(s, { kind: 'floor', floor: 8, healed: true }, 1).state;
  assert.equal(s.npc.length, 1);
  assert.equal(applyMissionEvent(s, { kind: 'floor', floor: 8, healed: false }, 1).completed[0]?.id, 'npc-piso8');
  assert.equal(applyMissionEvent(withNpc('npc-baya'), { kind: 'berry' }, 1).completed.some((c) => c.id === 'npc-baya'), true);
});

test('caducidad: cada partida terminada resta una y al llegar a 0 se va sin premio', () => {
  let s = withNpc('npc-cofres', 2);
  let r = applyMissionEvent(s, { kind: 'runEnd' }, 1);
  assert.equal(r.state.npc[0].runsLeft, 1);
  assert.equal(r.expired.length, 0);
  r = applyMissionEvent(r.state, { kind: 'runEnd' }, 1);
  assert.equal(r.state.npc.length, 0);
  assert.deepEqual(r.expired.map((m) => m.id), ['npc-cofres']);
  assert.equal(r.completed.length, 0);
});

test('cambiar de día no borra los encargos de NPC', () => {
  const s = applyMissionEvent(withNpc('npc-jefe'), { kind: 'room' }, 2).state;
  assert.equal(s.npc.length, 1);
});

test('guardado: se leen saneados y los antiguos sin encargos valen', () => {
  assert.deepEqual(parseMissions(JSON.stringify({ v: 1, day: 1, daily: [0, 0, 0], achievements: {} }), 1).npc, []);
  const raw = JSON.stringify({
    v: 1, day: 1, daily: [], achievements: {},
    npc: [{ id: 'npc-agua', n: 99, runsLeft: 50 }, { id: 'npc-agua', n: 0, runsLeft: 1 }, { id: 'nada', n: 0, runsLeft: 1 }, { id: 'npc-baya', n: 0, runsLeft: 0 }],
  });
  assert.deepEqual(parseMissions(raw, 1).npc, [{ id: 'npc-agua', n: 2, runsLeft: 2 }]);
});

test('acceptNpcMission guarda y recordMissionEvent da los tickets al cumplir', () => {
  const st = new MemoryStorage();
  const m = acceptNpcMission(5, 1, st)!;
  assert.ok(m);
  assert.equal(loadMissions(1, st).npc.length, 1);
  assert.ok(st.getItem(MISSIONS_KEY));
  const before = loadTickets(st);
  const forced = { ...loadMissions(1, st), npc: [{ id: 'npc-baya', n: 0, runsLeft: 3 }] };
  st.setItem(MISSIONS_KEY, JSON.stringify(forced));
  const r = recordMissionEvent({ kind: 'berry' }, 1, st);
  assert.equal(r.completed.length, 1);
  assert.equal(loadTickets(st), before + npcMissionById('npc-baya')!.reward.tickets);
});
