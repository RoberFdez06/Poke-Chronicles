// Ejecutar con `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_AUDIO,
  MUSIC,
  SFX,
  SFX_NAMES,
  midiToFreq,
  parseAudio,
  sfxLength,
  stepSeconds,
  stepVolume,
} from '../src/data/sounds.ts';
import { AUDIO_KEY, loadAudio, saveAudio, type StorageLike } from '../src/data/save.ts';

function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

test('todos los efectos son cortos y no saturan', () => {
  for (const name of SFX_NAMES) {
    const tones = SFX[name];
    assert.ok(tones.length > 0, name);
    for (const t of tones) {
      assert.ok(t.freq > 20 && t.freq < 8000, name);
      assert.ok(t.dur > 0 && t.gain > 0 && t.gain <= 0.5, name);
    }
    assert.ok(sfxLength(tones) <= 1, name);
  }
});

test('notas y tempo', () => {
  assert.equal(midiToFreq(69), 440);
  assert.ok(Math.abs(midiToFreq(81) - 880) < 1e-9);
  assert.equal(MUSIC.melody.length, MUSIC.bass.length);
  assert.ok(Math.abs(stepSeconds(120) - 0.25) < 1e-9);
});

test('el volumen se guarda y se lee, siempre entre 0 y 1', () => {
  assert.deepEqual(parseAudio(null), DEFAULT_AUDIO);
  assert.deepEqual(parseAudio('{'), DEFAULT_AUDIO);
  assert.deepEqual(parseAudio('{"music": 3, "sfx": -1}'), { music: 1, sfx: 0 });
  assert.deepEqual(parseAudio('{"music": 0.2}'), { music: 0.2, sfx: DEFAULT_AUDIO.sfx });
  const s = fakeStorage();
  assert.deepEqual(loadAudio(s), DEFAULT_AUDIO);
  saveAudio({ music: 0, sfx: 0.3 }, s);
  assert.deepEqual(loadAudio(s), { music: 0, sfx: 0.3 });
  assert.ok(s.data.has(AUDIO_KEY));
  assert.equal(stepVolume(0.5, 1), 0.6);
  assert.equal(stepVolume(1, 1), 1);
  assert.equal(stepVolume(0.1, -1), 0);
  assert.equal(stepVolume(0, -1), 0);
});
