// Ejecutar con `npm test`. Catálogo de ataques (supervisor).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TYPE_STYLES, styleForMove, styleByName, basicShotFor, foeStyleFor, bossStyles, BASIC_SHOTS, FOE_STYLES } from '../src/data/movePatterns.ts';

const TYPES = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'];

test('cada tipo tiene al menos 6 estilos con 4 formas distintas, y daño y recarga razonables', () => {
  for (const t of TYPES) {
    const list = TYPE_STYLES[t];
    assert.ok(list && list.length >= 6, t);
    assert.ok(new Set(list.map((s) => s.pattern.k)).size >= 4, `${t}: pocas formas distintas`);
    for (const s of list) {
      assert.ok(s.mul > 0 && s.mul <= 2, `${t}/${s.id} mul`);
      assert.ok(s.cd >= 1 && s.cd <= 2, `${t}/${s.id} cd`);
    }
    assert.ok(BASIC_SHOTS[t], `básico de ${t}`);
    assert.ok(FOE_STYLES[t], `enemigo de ${t}`);
  }
});

test('los movimientos famosos tienen su estilo (por id o por nombre)', () => {
  assert.equal(styleForMove({ id: 53, name: 'Lanzallamas', type: 'fire', power: 90 }).pattern.k, 'stream');
  assert.equal(styleForMove({ id: 89, name: 'Terremoto', type: 'ground', power: 100 }).pattern.k, 'quake');
  assert.equal(styleForMove({ id: 85, name: 'Rayo', type: 'electric', power: 90 }).pattern.k, 'chain');
  assert.equal(styleForMove({ id: 999999, name: 'Hidrobomba', type: 'water', power: 110 }).id, 'Hidrobomba');
  assert.equal(styleByName('fire', 'llamarada')?.id, 'Llamarada');
});

test('los demás reparten estilos de su tipo y no salen todos iguales', () => {
  const seen = new Set<string>();
  for (let id = 1000; id < 1080; id++) {
    const s = styleForMove({ id, name: 'x' + id, type: 'fire', power: id % 2 ? 40 : 100 });
    assert.ok(TYPE_STYLES.fire.includes(s));
    seen.add(s.id);
  }
  assert.ok(seen.size >= 5, `solo ${seen.size} estilos`);
  const a = styleForMove({ id: 1234, name: 'x', type: 'grass', power: 60 });
  assert.equal(styleForMove({ id: 1234, name: 'x', type: 'grass', power: 60 }), a);
});

test('tipos raros caen en normal; jefes con 1-4 movimientos sin embestidas ni cadenas', () => {
  assert.ok(basicShotFor('???'));
  assert.ok(foeStyleFor('???'));
  for (const t of TYPES) {
    const b = bossStyles([t], 7);
    assert.ok(b.length >= 1 && b.length <= 4, t);
    for (const s of b) assert.ok(!['dash', 'chain', 'orbit', 'mine'].includes(s.pattern.k), `${t}: ${s.id}`);
  }
  assert.ok(bossStyles(['fire', 'flying'], 3).length >= 3);
});
