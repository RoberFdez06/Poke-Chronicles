import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEGAL_DOCS, LEGAL_DOC, PRIVACY_DOC, clampScroll, docParagraphs, renderDocHtml, stepTab, ISSUES_URL } from '../src/data/legal.ts';

const all = (d: typeof LEGAL_DOC) => docParagraphs(d).map((p) => p.text).join('\n');

test('el aviso legal dice lo imprescindible', () => {
  const t = all(LEGAL_DOC);
  for (const s of ['fan game gratuito', 'sin ánimo de lucro', 'Nintendo', 'Game Freak', 'Creatures', 'The Pokémon Company', 'PMDCollab', 'PokeAPI', 'anuncios', 'se retirará', ISSUES_URL]) {
    assert.ok(t.includes(s), `falta: ${s}`);
  }
});

test('la privacidad describe lo que se guarda y cómo borrarlo', () => {
  const t = all(PRIVACY_DOC);
  for (const s of ['Firebase Authentication', 'Firestore', 'invitado', 'Borrar cuenta', 'suprimirlos', 'rectificar', 'acceder', ISSUES_URL]) {
    assert.ok(t.includes(s), `falta: ${s}`);
  }
});

test('no hay correos ni teléfonos en los textos', () => {
  for (const d of LEGAL_DOCS) {
    assert.doesNotMatch(all(d), /[\w.+-]+@[\w-]+\.[\w.]+/);
    assert.doesNotMatch(all(d), /\b\d{9}\b/);
  }
});

test('las páginas estáticas coinciden con el contenido del juego', () => {
  for (const d of LEGAL_DOCS) {
    const html = readFileSync(new URL(`../public/${d.file}`, import.meta.url), 'utf8');
    assert.equal(html, renderDocHtml(d), `${d.file} está desactualizado: node scripts/genLegal.ts`);
  }
});

test('desplazamiento y pestañas', () => {
  assert.equal(clampScroll(-5, 1000, 400), 0);
  assert.equal(clampScroll(900, 1000, 400), 600);
  assert.equal(clampScroll(50, 300, 400), 0);
  assert.equal(stepTab(0, -1), LEGAL_DOCS.length - 1);
  assert.equal(stepTab(LEGAL_DOCS.length - 1, 1), 0);
});
