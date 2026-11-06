// Ejecutar con `npm test`. Hitboxes por forma (src/data/hitbox.ts) y catálogo de ataques (src/data/attackHitboxes.ts):
// cada hitbox queda dentro de su dibujo y ningún ataque daña antes de que acabe su aviso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capsule, circle, containsPoint, ellipse, escapePoint, floorZone, hitsPlayer, outline, PLAYER_HURT_R, ray, shapeDist, type Shape } from '../src/data/hitbox.ts';
import { hitboxCatalog, markerHit, patternBeamHit, shockHit, vortexHit } from '../src/data/attackHitboxes.ts';

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);

test('círculo: distancia y contacto con la hitbox del jugador', () => {
  const c = circle(0, 0, 50);
  near(shapeDist(c, 30, 0), 0);
  near(shapeDist(c, 80, 0), 30);
  assert.ok(hitsPlayer(c, { x: 50 + PLAYER_HURT_R, y: 0 }));
  assert.ok(!hitsPlayer(c, { x: 50 + PLAYER_HURT_R + 1, y: 0 }));
});

test('elipse del suelo: arriba y abajo llega mucho menos que a los lados', () => {
  const z = floorZone(0, 0, 100);
  assert.ok(containsPoint(z, 99, 0));
  assert.ok(!containsPoint(z, 0, 70));
  near(shapeDist(z, 0, 85), 20, 1e-6);
  // Antes (círculo r + 22 al centro del dibujo) daba a 120 px por encima; ahora no
  assert.ok(!hitsPlayer(z, { x: 0, y: 100 }));
  assert.ok(hitsPlayer(z, { x: 0, y: 65 + PLAYER_HURT_R }));
});

test('rectángulo rotado', () => {
  const r: Shape = { k: 'rect', x: 0, y: 0, w: 100, h: 20, rot: Math.PI / 2 };
  assert.ok(containsPoint(r, 0, 45));
  assert.ok(!containsPoint(r, 45, 0));
  near(shapeDist(r, 20, 0), 10);
});

test('cápsula/rayo: distancia al segmento menos el medio ancho', () => {
  const b = ray(0, 0, 0, 200, 10);
  near(shapeDist(b, 100, 25), 15);
  near(shapeDist(b, 215, 0), 5);
  near(shapeDist(b, -30, 0), 20);
  const c = capsule(0, 0, 0, 0, 5);
  near(shapeDist(c, 8, 0), 3);
});

test('sector/cono', () => {
  const s: Shape = { k: 'sector', x: 0, y: 0, r: 100, a: 0, half: Math.PI / 6 };
  assert.ok(containsPoint(s, 50, 10));
  assert.ok(!containsPoint(s, 0, 50));
  assert.ok(!containsPoint(s, 120, 0));
  assert.ok(shapeDist(s, 50, 50) > 0);
});

test('anillo con hueco: no daña dentro del hueco', () => {
  const r = shockHit(0, 0, 200, 0, Math.PI / 3);
  assert.ok(!containsPoint(r, 200, 0), 'en el hueco');
  assert.ok(containsPoint(r, -200, 0));
  assert.ok(!containsPoint(r, -230, 0));
  assert.ok(!hitsPlayer(r, { x: 0, y: 0 }));
});

test('el contorno de depuración está sobre el borde de la forma', () => {
  for (const s of [circle(5, 5, 40), ellipse(0, 0, 60, 30), ray(0, 0, 0.5, 120, 12), { k: 'rect', x: 0, y: 0, w: 40, h: 20, rot: 0.3 } as Shape]) {
    for (const line of outline(s)) for (const p of line) assert.ok(shapeDist(s, p.x, p.y) < 0.5, `${s.k}: punto fuera del borde`);
  }
});

test('catálogo: cada hitbox queda dentro de su dibujo (tolerancia 2 px)', () => {
  const all = hitboxCatalog();
  assert.ok(all.length > 150, `solo ${all.length} ataques`);
  for (const e of all) {
    const out = escapePoint(e.hit, e.drawn, 2, 4);
    assert.equal(out, null, `${e.id} (${e.label}): daña en (${out?.x.toFixed(0)}, ${out?.y.toFixed(0)}), fuera de lo dibujado`);
  }
});

test('catálogo: ningún ataque daña antes de que acabe su aviso', () => {
  for (const e of hitboxCatalog()) assert.ok(e.hitFromMs >= e.warnMs, `${e.id}: daña a ${e.hitFromMs} ms con ${e.warnMs} ms de aviso`);
});

test('arreglos: zonas del suelo, rayos y remolinos ya no dan fuera de su dibujo', () => {
  // Zona de 60 px: el jugador a 75 px por encima (antes r + 22 = 82, le daba) ya no recibe daño
  assert.ok(!hitsPlayer(markerHit(0, 0, 60), { x: 0, y: 75 }));
  // Rayo de 26 px: a 25 px del eje (antes 13 + 18 = 31, le daba) ya no
  assert.ok(!hitsPlayer(patternBeamHit(0, 0, 0, 400, 26), { x: 200, y: 25 }));
  assert.ok(hitsPlayer(patternBeamHit(0, 0, 0, 400, 26), { x: 200, y: 15 }));
  // Remolino de 70: 60 px por debajo (antes daba hasta 92) ya no
  assert.ok(!hitsPlayer(vortexHit(0, 0, 70), { x: 0, y: 60 }));
});

test('la capa de depuración de hitboxes solo en desarrollo o admin, y pedida', async () => {
  const { hitboxDebugEnabled, bodyCircle } = await import('../src/data/hitbox.ts');
  assert.equal(hitboxDebugEnabled('?hitboxes', '1', false), false);
  assert.equal(hitboxDebugEnabled('', null, true), false);
  assert.equal(hitboxDebugEnabled('?hitboxes', null, true), true);
  assert.equal(hitboxDebugEnabled('', '1', true), true);
  assert.deepEqual(bodyCircle({ center: { x: 5, y: 6 }, width: 40, height: 30 }), { x: 5, y: 6, r: 15 });
});
