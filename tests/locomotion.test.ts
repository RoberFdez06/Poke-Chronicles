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
