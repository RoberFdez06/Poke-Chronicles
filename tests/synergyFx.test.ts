// Sinergias que transforman: recetas, efectos sumados, descubrimiento, pistas y guardado. Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMBO_SYNERGIES, SYNERGIES, TRANSFORMATIONS, applySynergies, synergyActive } from '../src/data/synergies.ts';
import {
  FX_CAPS, bookEntries, bookProgress, emptyFx, hasAnyFx, hintText, missingPieces, nearSynergies, newDiscoveries,
  parseSynergiesFound, recipeSize, recipeText, serializeSynergiesFound, synergiesBrokenBy, synergiesCompletedBy, synergyFxFor,
} from '../src/data/synergyFx.ts';
import { computeStats, passiveById } from '../src/data/items.ts';
import { addSynergiesFound, loadSynergiesFound, PROGRESS_KEYS, SYNERGIES_KEY } from '../src/data/save.ts';
import { markCheatRun, clearCheatRun } from '../src/data/admin.ts';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};

test('hay entre 12 y 16 sinergias nuevas y 3 transformaciones, con ids y nombres únicos', () => {
  assert.ok(COMBO_SYNERGIES.length >= 12 && COMBO_SYNERGIES.length <= 16, `${COMBO_SYNERGIES.length}`);
  assert.equal(TRANSFORMATIONS.length, 3);
  assert.equal(new Set(SYNERGIES.map((s) => s.id)).size, SYNERGIES.length);
  assert.equal(new Set(SYNERGIES.map((s) => s.name)).size, SYNERGIES.length);
});

test('todas las piezas existen y cada sinergia nueva tiene un efecto especial distinto', () => {
  for (const s of [...COMBO_SYNERGIES, ...TRANSFORMATIONS]) {
    for (const id of s.all ?? []) assert.ok(passiveById(id), `${s.id}: ${id}`);
    assert.ok((s.fx ?? []).length > 0, s.id);
    assert.ok(recipeSize(s) >= 2, s.id);
  }
  for (const t of TRANSFORMATIONS) assert.equal(recipeSize(t), 3, t.id);
  // Cada sinergia de dos piezas trae un tipo de efecto distinto (salvo el rastro, que tiene fuego y hielo)
  const kinds = COMBO_SYNERGIES.map((s) => s.fx![0].kind + (s.fx![0].kind === 'trail' ? (s.fx![0] as { element: string }).element : ''));
  assert.equal(new Set(kinds).size, kinds.length);
});

test('las recetas se reconocen y piden todas sus piezas', () => {
  const rueda = SYNERGIES.find((s) => s.id === 'rueda-fuego')!;
  assert.ok(!synergyActive(rueda, ['carbon'], []));
  assert.ok(synergyActive(rueda, ['carbon', 'pluma-ligera'], []));
  const giga = SYNERGIES.find((s) => s.id === 'gigadrenado')!;
  assert.ok(!synergyActive(giga, ['semilla-milagro'], ['fire']));
  assert.ok(synergyActive(giga, ['semilla-milagro'], ['grass']));
  const fuego = TRANSFORMATIONS.find((s) => s.id === 'fuego-sagrado')!;
  assert.ok(!synergyActive(fuego, ['carbon', 'concha-campana'], []));
  assert.ok(synergyActive(fuego, ['carbon', 'concha-campana', 'orbe-vital'], []));
});

test('los efectos especiales se suman con topes', () => {
  assert.deepEqual(synergyFxFor([]), emptyFx());
  assert.ok(!hasAnyFx(synergyFxFor([])));
  const a = synergyFxFor(['danza-lunar']);
  assert.equal(a.orbitals?.count, 2);
  const both = synergyFxFor(['danza-lunar', 'tormenta-eterna', 'velo-espectral']);
  assert.equal(both.orbitals?.count, FX_CAPS.orbitals);
  const refl = synergyFxFor(['capa-magica', 'velo-espectral']);
  assert.ok(refl.reflect > 0.45 && refl.reflect <= FX_CAPS.chance);
  const trail = synergyFxFor(['rueda-fuego', 'pista-helada']);
  assert.ok(trail.trail.fire > 0 && trail.trail.ice > 0);
  assert.equal(synergyFxFor(['rebote-eterno']).ricochet, 2);
  assert.equal(synergyFxFor(['dia-de-pago']).extraDrop, 0.25);
  assert.ok(synergyFxFor(['gigadrenado', 'fuego-sagrado']).healOnKill <= FX_CAPS.healOnKill);
  // La transformación da su aspecto
  assert.equal(synergyFxFor(['fuego-sagrado']).transform?.id, 'fuego-sagrado');
  assert.equal(synergyFxFor(['rueda-fuego']).transform, null);
});

test('las transformaciones también tocan las estadísticas, sin romperlas', () => {
  const items = ['hechizo', 'polvo-brillo', 'cuerda-huida'];
  const base = computeStats(items);
  const { stats, active } = applySynergies(base, items, []);
  assert.ok(active.some((s) => s.id === 'velo-espectral'));
  assert.ok(stats.dodge > base.dodge && stats.dodge <= 0.6);
  const fire = ['carbon', 'concha-campana', 'orbe-vital'];
  const f = applySynergies(computeStats(fire), fire, []);
  assert.ok(f.stats.damage > computeStats(fire).damage && f.stats.damage < computeStats(fire).damage * 1.5);
});

test('pistas: qué objeto completa una sinergia y cuál la rompe', () => {
  assert.deepEqual(synergiesCompletedBy('pluma-ligera', ['carbon'], []).map((s) => s.id), ['rueda-fuego']);
  assert.deepEqual(synergiesCompletedBy('pluma-ligera', [], []), []);
  assert.deepEqual(synergiesCompletedBy('orbe-vital', ['carbon', 'concha-campana'], []).map((s) => s.id), ['fuego-sagrado']);
  assert.deepEqual(synergiesBrokenBy('carbon', ['carbon', 'pluma-ligera'], []).map((s) => s.id), ['rueda-fuego']);
  // Con dos copias, soltar una no rompe nada
  assert.deepEqual(synergiesBrokenBy('carbon', ['carbon', 'carbon', 'pluma-ligera'], []), []);
  assert.equal(hintText(synergiesCompletedBy('pluma-ligera', ['carbon'], [])), 'Sinergia: Rueda Fuego');
  assert.equal(hintText([]), undefined);
  assert.deepEqual(missingPieces(SYNERGIES.find((s) => s.id === 'gigadrenado')!, [], []), ['Semilla Milagro', 'poder de Planta']);
  const near = nearSynergies(['carbon'], [], ['rueda-fuego']);
  assert.ok(near.some((n) => n.label === 'Rueda Fuego (falta Pluma Ligera)'));
  assert.ok(nearSynergies(['iman'], [], []).some((n) => n.label.startsWith('???')));
});

test('descubrimiento y Libro de sinergias', () => {
  assert.deepEqual(newDiscoveries(['rueda-fuego'], ['rueda-fuego', 'pista-helada', 'no-existe']), ['pista-helada']);
  const book = bookEntries(['rueda-fuego']);
  assert.equal(book.length, SYNERGIES.length);
  const rueda = book.find((e) => e.id === 'rueda-fuego')!;
  assert.equal(rueda.name, 'Rueda Fuego');
  assert.equal(rueda.recipe, recipeText(SYNERGIES.find((s) => s.id === 'rueda-fuego')!));
  const hidden = book.find((e) => e.id === 'fuego-sagrado')!;
  assert.equal(hidden.name, '???');
  assert.match(hidden.recipe, /3 piezas/);
  // Las transformaciones van al final
  assert.ok(book.slice(-3).every((e) => e.transform));
  assert.deepEqual(bookProgress(['rueda-fuego', 'x']), { found: 1, total: SYNERGIES.length });
});

test('guardado de las descubiertas: versión, migración y partidas admin', () => {
  assert.deepEqual(parseSynergiesFound(null), []);
  assert.deepEqual(parseSynergiesFound('roto{'), []);
  // Formato viejo (lista suelta) y con ids que ya no existen
  assert.deepEqual(parseSynergiesFound('["rueda-fuego","borrada","rueda-fuego"]'), ['rueda-fuego']);
  assert.deepEqual(parseSynergiesFound(serializeSynergiesFound(['marea', 'vampiro'])), ['marea', 'vampiro']);
  assert.equal(JSON.parse(serializeSynergiesFound(['marea'])).v, 1);
  const st = memory();
  assert.deepEqual(addSynergiesFound(['marea', 'rueda-fuego'], st), ['marea', 'rueda-fuego']);
  assert.deepEqual(addSynergiesFound(['marea'], st), []);
  assert.deepEqual(loadSynergiesFound(st), ['marea', 'rueda-fuego']);
  assert.ok(PROGRESS_KEYS.includes(SYNERGIES_KEY));
  markCheatRun();
  assert.deepEqual(addSynergiesFound(['vampiro'], st), []);
  clearCheatRun();
  assert.deepEqual(loadSynergiesFound(st), ['marea', 'rueda-fuego']);
});
