// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIR8, animDataUrl, animSheetUrl, dir8Row, parseAnimData, pmdScale, spriteCollabId, ticksToMs } from '../src/data/pmdAnim.ts';

test('la dirección más cercana de las 8', () => {
  const row = (x: number, y: number) => DIR8[dir8Row(x, y)];
  assert.equal(row(0, 1), 'down');
  assert.equal(row(1, 1), 'down-right');
  assert.equal(row(1, 0), 'right');
  assert.equal(row(1, -1), 'up-right');
  assert.equal(row(0, -1), 'up');
  assert.equal(row(-1, -1), 'up-left');
  assert.equal(row(-1, 0), 'left');
  assert.equal(row(-1, 1), 'down-left');
  // Casi a la derecha, un poco hacia abajo: sigue siendo derecha
  assert.equal(row(1, 0.3), 'right');
  assert.equal(dir8Row(0, 0), 0);
  assert.equal(dir8Row(0, 0, 4), 4);
});

const XML = `<?xml version="1.0" ?>
<AnimData>
  <ShadowSize>1</ShadowSize>
  <Anims>
    <Anim><Name>Walk</Name><Index>0</Index><FrameWidth>32</FrameWidth><FrameHeight>40</FrameHeight>
      <Durations><Duration>6</Duration><Duration>8</Duration><Duration>6</Duration><Duration>8</Duration></Durations></Anim>
    <Anim><Name>Idle</Name><Index>7</Index><FrameWidth>24</FrameWidth><FrameHeight>40</FrameHeight>
      <Durations><Duration>40</Duration><Duration>10</Duration></Durations></Anim>
    <Anim><Name>Shoot</Name><Index>3</Index><CopyOf>Walk</CopyOf></Anim>
    <Anim><Name>Rara</Name><Index>9</Index><CopyOf>NoExiste</CopyOf></Anim>
  </Anims>
</AnimData>`;

test('lee AnimData.xml con sus copias', () => {
  const a = parseAnimData(XML);
  assert.deepEqual(a.Walk, { frameWidth: 32, frameHeight: 40, durations: [6, 8, 6, 8] });
  assert.deepEqual(a.Idle, { frameWidth: 24, frameHeight: 40, durations: [40, 10] });
  assert.deepEqual(a.Shoot, a.Walk);
  assert.equal(a.Rara, undefined);
  assert.deepEqual(parseAnimData('basura'), {});
});

test('rutas, ticks y escala', () => {
  assert.equal(spriteCollabId(4), '0004');
  assert.equal(spriteCollabId(1025), '1025');
  assert.equal(animDataUrl(25), 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/0025/AnimData.xml');
  assert.ok(animSheetUrl(25, 'Walk').endsWith('/0025/Walk-Anim.png'));
  assert.ok(Math.abs(ticksToMs(6) - 100) < 1e-9);
  assert.ok(pmdScale(84) > pmdScale(60));
});
