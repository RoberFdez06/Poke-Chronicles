import { test } from 'node:test';
import assert from 'node:assert/strict';
import { debugEnabled } from '../src/data/debugFlags.ts';

test('debug solo con ?debug, localStorage o dev', () => {
  assert.equal(debugEnabled('', null, false), false);
  assert.equal(debugEnabled('?debug', null, false), true);
  assert.equal(debugEnabled('?seed=1&debug=1', null, false), true);
  assert.equal(debugEnabled('', '1', false), true);
  assert.equal(debugEnabled('', '0', false), false);
  assert.equal(debugEnabled('', null, true), true);
});
