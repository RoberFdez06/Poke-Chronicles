import { test } from 'node:test';
import assert from 'node:assert/strict';
import { locomotionOf, locomotionProfile } from '../src/data/locomotion.ts';

test('cada tipo se mueve a su manera', () => {
  assert.equal(locomotionOf(['normal', 'flying']), 'fly');
  assert.equal(locomotionOf(['ghost']), 'float');
  assert.equal(locomotionOf(['water']), 'swim');
  assert.equal(locomotionOf(['fire']), 'walk');
  assert.equal(locomotionOf([]), 'walk');
});

test('los que vuelan no saltan: ondulan y siguen planeando quietos', () => {
  const fly = locomotionProfile(['flying']);
  assert.equal(fly.bounce, false);
  assert.ok(fly.idleLift > 0);
  assert.equal(locomotionProfile(['grass']).bounce, true);
});

import { locoPose, sheetHover, LOCOMOTION_PROFILES, type Locomotion } from '../src/data/locomotion.ts';

test('la especie manda sobre el tipo', () => {
  assert.equal(locomotionOf(['poison'], 23), 'slither'); // Ekans
  assert.equal(locomotionOf(['rock', 'ground'], 95), 'slither'); // Onix
  assert.equal(locomotionOf(['water'], 129), 'swim'); // Magikarp
  assert.equal(locomotionOf(['water'], 7), 'walk'); // Squirtle anda
  assert.equal(locomotionOf(['normal', 'flying'], 84), 'walk'); // Doduo corre
  assert.equal(locomotionOf(['bug', 'flying'], 12), 'fly');
  assert.equal(locomotionOf(['psychic'], 150), 'walk'); // Mewtwo anda (Roberto)
  assert.equal(locomotionOf(['psychic'], 63), 'walk'); // Abra
  assert.equal(locomotionOf(['electric'], 100), 'roll'); // Voltorb
  assert.equal(locomotionOf(['normal', 'fairy'], 39), 'hop'); // Jigglypuff
  assert.equal(locomotionOf(['poison'], 109), 'float'); // Koffing
});

test('al moverse ninguna forma de moverse se queda quieta (no se desliza)', () => {
  const kinds = Object.keys(LOCOMOTION_PROFILES) as Locomotion[];
  for (const k of kinds) {
    const poses = Array.from({ length: 40 }, (_, i) => locoPose(k, i * 23, true, 0.3));
    const spread = (f: (p: (typeof poses)[number]) => number) => Math.max(...poses.map(f)) - Math.min(...poses.map(f));
    const motion = spread((p) => p.lift) + spread((p) => p.angle) / 10 + spread((p) => p.sx) * 10 + spread((p) => p.dx);
    assert.ok(motion > 0.5, `${k} se mueve`);
  }
});

test('andar: aplastado al pisar, estirado arriba; volar: la sombra se encoge', () => {
  const ground = locoPose('walk', 0, true, 0);
  assert.equal(ground.lift, 0);
  assert.ok(ground.sy < 1 && ground.sx > 1);
  const top = locoPose('walk', (Math.PI / 2) * LOCOMOTION_PROFILES.walk.slow, true, 0);
  assert.ok(top.sy > 1 && top.lift > 2);
  const fly = locoPose('fly', 500, true, 0);
  assert.ok(fly.shadow < 1 && fly.lift > 0);
  const still = locoPose('walk', 1000, false, 0);
  assert.equal(still.lift, 0);
});

test('con hoja animada solo los que vuelan o flotan van por el aire', () => {
  assert.equal(sheetHover('walk', 100, true).lift, 0);
  assert.ok(sheetHover('fly', 100, true).lift >= 6);
  assert.ok(sheetHover('float', 100, false).shadow < 1);
});

test('Mewtwo (y sus megas) y otros con patas que estaban en «flotan» andan', async () => {
  const { locomotionOf } = await import('../src/data/locomotion.ts');
  for (const id of [150, 10043, 10044, 492, 649, 772, 802, 870, 888, 889, 1000]) assert.equal(locomotionOf(['psychic'], id), 'walk', String(id));
  for (const id of [151, 251, 385, 480, 488, 491]) assert.equal(locomotionOf(['psychic'], id), 'float', String(id));
  assert.equal(locomotionOf(['ghost', 'ground'], 769), 'slither');
});
