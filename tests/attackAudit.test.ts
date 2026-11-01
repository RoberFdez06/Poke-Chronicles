// Ejecutar con `npm test`. Auditoría de TODOS los ataques del jugador y de TODAS las fusiones (01/11):
// datos válidos (sin undefined ni NaN), sin ids duplicados ni huérfanos, textos en español y firmas visuales distintas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FAMOUS_IDS, TYPE_STYLES, BASIC_SHOTS, FOE_STYLES, normName, styleByName, type Pattern } from '../src/data/movePatterns.ts';
import {
  allStyles, COMBO_MOTIF, LAYOUT_OF, legacyGroups, MOTIF_IDS, MOTIFS, motifFor, motifTone, STYLE_MOTIF, TYPE_MOTIF, visualKey,
} from '../src/data/moveSignatures.ts';
import { ALL_PAIR_KEYS, recipeFor, COMBO_IDS, FUSION_COMBOS, FUSION_IMPACTS, FUSION_MOTIONS, FUSION_SHAPES, FUSION_TRAILS, FUSION_TYPES, fusePowers, fusionParts, patternLabel, recipeByKey } from '../src/data/fusion.ts';
import { toMovePower } from '../src/data/items.ts';
import { TYPE_COLORS } from '../src/data/types.ts';
import { debugFusionMove, debugStyleMove, debugStyleList, resolveType } from '../src/data/moveDebug.ts';

const KINDS = Object.keys(LAYOUT_OF);

/** Recorre un objeto y falla si hay undefined, null o números no finitos. */
function assertClean(v: unknown, where: string) {
  if (v === undefined || v === null) assert.fail(`${where}: vacío`);
  if (typeof v === 'number') assert.ok(Number.isFinite(v), `${where}: número no válido (${v})`);
  if (typeof v === 'object') for (const [k, x] of Object.entries(v as object)) assertClean(x, `${where}.${k}`);
}

/** Números del patrón dentro de rangos con sentido. */
function assertPattern(p: Pattern, where: string) {
  assert.ok(KINDS.includes(p.k), `${where}: forma desconocida ${p.k}`);
  assertClean(p, where);
  for (const [k, x] of Object.entries(p)) {
    if (typeof x !== 'number') continue;
    if (k === 'spread' || k === 'dist') assert.ok(x >= 0, `${where}.${k} < 0`);
    else assert.ok(x > 0, `${where}.${k} debe ser > 0`);
  }
}

// Palabras inglesas típicas que no deben colarse en textos del jugador
const ENGLISH = /\b(the|of|and|shot|beam|fire|water|attack|ball|punch|kick|wave|blast|storm|super|power|fusion|style|bomb|rain|wind|claw|slash)\b/i;
const SPANISH_CHARS = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .,()+\-«»'¡!¿?]+$/;
const assertSpanish = (s: string, where: string) => {
  assert.ok(s.trim().length > 0, `${where}: texto vacío`);
  assert.ok(SPANISH_CHARS.test(s), `${where}: caracteres raros en «${s}»`);
  assert.ok(!ENGLISH.test(s), `${where}: parece inglés «${s}»`);
};

test('los 18 tipos tienen estilos, disparo básico, de enemigo y motivo', () => {
  for (const t of Object.keys(TYPE_COLORS)) {
    assert.ok(TYPE_STYLES[t]?.length, `${t}: sin estilos`);
    assert.ok(BASIC_SHOTS[t] && FOE_STYLES[t], `${t}: sin básico o enemigo`);
    assert.ok(TYPE_MOTIF[t], `${t}: sin motivo`);
    assertClean(BASIC_SHOTS[t], `básico ${t}`);
    assertPattern(FOE_STYLES[t], `enemigo ${t}`);
  }
  assert.deepEqual(Object.keys(TYPE_STYLES).sort(), Object.keys(TYPE_COLORS).sort(), 'tipos de más o de menos en el catálogo');
});

test('cada ataque del jugador tiene datos válidos: forma, daño, recarga, motivo y colocación', () => {
  const all = allStyles();
  assert.ok(all.length >= 100, `solo ${all.length} ataques`);
  for (const { type, style } of all) {
    const w = `${type}/${style.id}`;
    assertPattern(style.pattern, w);
    assert.ok(Number.isFinite(style.mul) && style.mul > 0 && style.mul <= 2, `${w}: daño ${style.mul}`);
    assert.ok(Number.isFinite(style.cd) && style.cd >= 1 && style.cd <= 2, `${w}: recarga ${style.cd}`);
    assert.ok(MOTIF_IDS.includes(motifFor(style.id, type)), `${w}: sin motivo`);
    assert.ok(LAYOUT_OF[style.pattern.k], `${w}: sin colocación`);
    assertSpanish(style.id, w);
  }
});

test('sin ids duplicados (ni dentro de un tipo ni entre tipos) y sin huérfanos', () => {
  const seen = new Map<string, string>();
  for (const { type, style } of allStyles()) {
    const n = normName(style.id);
    assert.ok(!seen.has(n), `«${style.id}» repetido en ${type} y ${seen.get(n)}`);
    seen.set(n, type);
  }
  // Los movimientos famosos apuntan a un estilo que existe en algún tipo
  for (const [id, name] of Object.entries(FAMOUS_IDS)) {
    assert.ok(seen.has(normName(name)), `id ${id} → «${name}» no existe`);
    assert.ok(styleByName(seen.get(normName(name))!, name), `id ${id} → «${name}» no se encuentra`);
  }
  // Excepciones de motivo de estilos que ya no existen
  for (const k of Object.keys(STYLE_MOTIF)) assert.ok(seen.has(normName(k)), `motivo huérfano: ${k}`);
});

test('motivos pixel: mapas 7×7 con caracteres válidos, nombres en español y tono acotado', () => {
  for (const m of MOTIF_IDS) {
    const rows = MOTIFS[m];
    assert.equal(rows.length, 7, `${m}: filas`);
    for (const r of rows) assert.match(r, /^[.o#+\-w]{7}$/, `${m}: fila «${r}»`);
    assert.ok(rows.join('').replace(/[.o]/g, '').length >= 4, `${m}: casi vacío`);
    assertSpanish(m.replace(/-/g, ' '), `motivo ${m}`);
    assert.ok(Math.abs(motifTone(m)) <= 5);
  }
  assert.equal(new Set(MOTIF_IDS.map((m) => MOTIFS[m].join('/'))).size, MOTIF_IDS.length, 'dos motivos con el mismo dibujo');
});

test('ya no hay ataques repetitivos: ninguna pareja comparte forma, rasgos y motivo', () => {
  assert.ok(legacyGroups().size > 0, 'la auditoría debería detectar los grupos de antes');
  const seen = new Map<string, string>();
  for (const { type, style } of allStyles()) {
    const k = visualKey(style, type);
    assert.ok(!seen.has(k), `${style.id} (${type}) se ve igual que ${seen.get(k)}: ${k}`);
    seen.set(k, `${style.id} (${type})`);
  }
});

test('todas las fusiones (171 parejas): receta, nombre en español, partes válidas y motivo de combinación', () => {
  for (const c of COMBO_IDS) {
    assert.ok(COMBO_MOTIF[c], `combinación ${c} sin motivo`);
    assertSpanish(FUSION_COMBOS[c].label, `combo ${c}`);
    for (const [i, p] of FUSION_COMBOS[c].parts.entries()) assertPattern(p.pattern, `${c}[${i}]`);
  }
  assert.equal(new Set(COMBO_IDS.map((c) => COMBO_MOTIF[c])).size, COMBO_IDS.length, 'dos combinaciones con el mismo motivo');
  for (const k of Object.keys(COMBO_MOTIF)) assert.ok((COMBO_IDS as string[]).includes(k), `motivo de combinación huérfano: ${k}`);
  for (const list of [FUSION_SHAPES, FUSION_TRAILS, FUSION_IMPACTS, FUSION_MOTIONS]) for (const x of list) assertSpanish(x.replace(/-/g, ' '), `pieza ${x}`);
  const names = new Set<string>();
  assert.equal(ALL_PAIR_KEYS.length, 171);
  for (const pk of ALL_PAIR_KEYS) {
    const [a, b] = pk.split('+');
    const { key, recipe: r } = recipeFor(a, b, a);
    assert.equal(recipeByKey(key).name, r.name, `${pk}: la clave guardada no da la misma receta`);
    assert.notEqual(r.name, 'Fusión', `${pk}: receta sin nombre (cae en la de respaldo)`);
    assertSpanish(r.name, `fusión ${key}`);
    assert.ok(!names.has(r.name), `nombre de fusión repetido: ${r.name}`);
    names.add(r.name);
    assert.ok(COMBO_IDS.includes(r.combo), `${key}: combinación ${r.combo}`);
    assertClean(r.style, `${key}.style`);
    const m = fusePowers(toMovePower({ id: 1, name: TYPE_STYLES[a][0].id, type: a, power: 90 }), toMovePower({ id: 2, name: TYPE_STYLES[b][0].id, type: b, power: 60 }));
    assertClean(m, `${key}.poder`);
    assert.ok(m.power > 0 && m.cooldown > 0, `${key}: potencia o recarga`);
    const parts = fusionParts(m);
    assert.ok(parts.length >= 2, `${key}: partes`);
    for (const [i, p] of parts.entries()) {
      assertPattern(p.pattern, `${key}[${i}]`);
      assert.ok(p.mul > 0 && p.delay >= 0 && FUSION_TYPES.includes(p.type), `${key}[${i}]: daño, retraso o tipo`);
    }
    assertSpanish(patternLabel(m), `${key}: etiqueta`);
  }
});

test('consola de pruebas: lanza cualquier estilo y cualquier fusión, con errores en español', () => {
  assert.equal(resolveType('Fuego'), 'fire');
  assert.equal(resolveType('fire'), 'fire');
  for (const { type, style } of allStyles()) {
    const m = debugStyleMove(type, style.id);
    assert.ok(typeof m !== 'string', `${type}/${style.id}: ${m}`);
  }
  assert.match(debugStyleMove('fuego', 'Nada') as string, /no es un estilo/);
  assert.match(debugStyleMove('xx', 'Nada') as string, /Tipo desconocido/);
  const f = debugFusionMove('fuego', 'agua');
  assert.ok(typeof f !== 'string' && f.fusion);
  assert.match(debugStyleList('fuego'), /^fire: Ascuas/);
});
