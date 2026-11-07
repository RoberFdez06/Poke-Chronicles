import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MUSIC_BIOMES, PLAYLISTS, TD_TYPE_FAMILY, TRACKS, calmPlaylist, combatPlaylist, menuPlaylist, runPlaylist, roomMusicFor,
  tdChiefPlaylist, tdMenuPlaylist, tdTypePlaylist, type MusicTrack,
} from '../src/data/music.ts';
import { BASS_RANGE, MELODY_RANGE, HARMONY_RANGE, rngFrom } from '../src/data/musicGen.ts';
import { MIN_DWELL_MS, MusicShuffle, loopsFor, pickNext } from '../src/audio/playlist.ts';
import { ALL_TYPES, levelTheme } from '../src/data/towerDefense/themes.ts';
import { TD_MAPS } from '../src/data/towerDefense/maps.ts';

function allTracks(): MusicTrack[] {
  const s = new Set<MusicTrack>();
  const add = (l: readonly MusicTrack[]) => l.forEach((t) => s.add(t));
  for (const b of MUSIC_BIOMES) for (const m of ['', 'tower', 'endless', 'waves']) add(calmPlaylist(b, m).tracks);
  for (const b of MUSIC_BIOMES) add(combatPlaylist(b).tracks);
  for (const l of Object.values(PLAYLISTS)) add(l);
  for (const t of ALL_TYPES) add(tdTypePlaylist(t).tracks);
  return [...s];
}

test('pickNext nunca repite la misma pista seguida', () => {
  const rng = rngFrom(7);
  for (let n = 2; n <= 6; n++) {
    let last: number | null = null;
    for (let i = 0; i < 500; i++) {
      const k = pickNext(n, last, rng);
      assert.ok(k >= 0 && k < n);
      assert.notEqual(k, last);
      last = k;
    }
  }
  assert.equal(pickNext(1, 0, rng), 0);
});

test('mezcla: reproducible con semilla, sin repetir, todas suenan', () => {
  const seq = (seed: number) => {
    const s = new MusicShuffle(seed);
    const out = [s.choose('calma:bosque:', 4, 0).index];
    for (let i = 1; i < 200; i++) out.push(s.next(4, i * 1000)!.index);
    return out;
  };
  const a = seq(42);
  assert.deepEqual(a, seq(42));
  assert.notDeepEqual(a, seq(43));
  for (let i = 1; i < a.length; i++) assert.notEqual(a[i], a[i - 1]);
  assert.equal(new Set(a).size, 4);
});

test('mezcla: misma lista no cambia; otra lista sí; al volver, no repite la última que sonó en ella', () => {
  const s = new MusicShuffle(1);
  const c1 = s.choose('calma', 4, 0);
  assert.equal(s.choose('calma', 4, 100).changed, false);
  const f = s.choose('combate', 4, 200);
  assert.ok(f.changed);
  const c2 = s.choose('calma', 4, 300);
  assert.notEqual(c2.index, c1.index);
});

test('mezcla: al cambiar de sala solo cambia si la pista ya lleva un rato', () => {
  const s = new MusicShuffle(3);
  const c = s.choose('calma', 4, 0);
  assert.equal(s.room(4, MIN_DWELL_MS - 1), null);
  const r = s.room(4, MIN_DWELL_MS);
  assert.ok(r && r.changed && r.index !== c.index);
});

test('cada pista dura ~1 minuto o más antes de pasar a otra', () => {
  for (const t of allTracks()) {
    const secs = loopsFor(t.melody.length, t.bpm) * t.melody.length * (60 / t.bpm / 2);
    assert.ok(secs >= 30 && secs <= 120, `${t.name}: ${secs.toFixed(1)} s`);
  }
});

test('pistas no vacías, coherentes y con notas en rango', () => {
  const all = allTracks();
  assert.ok(all.length >= 100, `solo ${all.length} pistas`);
  for (const t of all) {
    const n = t.name ?? '?';
    assert.ok(t.melody.length >= 32 && t.melody.length % 8 === 0, n);
    assert.ok(t.melody.filter((m) => m !== null).length >= 8, `${n}: melodía casi vacía`);
    assert.ok(t.bass.some((b) => b !== null), `${n}: sin bajo`);
    assert.ok(t.bpm >= 70 && t.bpm <= 190, n);
    for (const m of t.melody) if (m !== null) assert.ok(m >= 40 && m <= 110, `${n}: ${m}`);
    for (const b of t.bass) if (b !== null) assert.ok(b >= 24 && b <= 80, `${n}: ${b}`);
    for (const d of t.drums ?? []) assert.ok([0, 1, 2, 3, 4, 5].includes(d), n);
    if (t.drums) assert.equal(t.melody.length % t.drums.length, 0, n);
    // Las compuestas: rangos estrictos y todas las capas del mismo largo
    if (Object.values(TRACKS).includes(t)) continue;
    for (const m of t.melody) if (m !== null) assert.ok(m >= MELODY_RANGE[0] && m <= MELODY_RANGE[1], `${n}: ${m}`);
    for (const b of t.bass) if (b !== null) assert.ok(b >= BASS_RANGE[0] && b <= BASS_RANGE[1], `${n}: ${b}`);
    for (const h of t.harmony ?? []) if (h !== null) assert.ok(h >= HARMONY_RANGE[0] && h <= HARMONY_RANGE[1], `${n}: ${h}`);
    assert.equal(t.bass.length, t.melody.length, n);
    if (t.harmony) assert.equal(t.harmony.length, t.melody.length, n);
  }
});

test('todas las pistas son distintas entre sí', () => {
  const sig = new Set(allTracks().map((t) => JSON.stringify([t.bpm, t.lead, t.melody])));
  assert.equal(sig.size, allTracks().length);
});

test('listas de al menos 3 pistas por bioma y por situación', () => {
  for (const b of MUSIC_BIOMES) {
    assert.ok(calmPlaylist(b).tracks.length >= 4, b);
    assert.ok(combatPlaylist(b).tracks.length >= 4, b);
  }
  for (const mood of ['mini', 'boss', 'final'] as const) assert.ok(runPlaylist({ mood, biomeId: 'bosque' }).tracks.length >= 3, mood);
  assert.ok(menuPlaylist().tracks.length >= 3);
  assert.ok(PLAYLISTS.tienda.length >= 3 && PLAYLISTS.santuario.length >= 3);
  assert.ok(tdChiefPlaylist().tracks.length >= 3);
  assert.ok(tdMenuPlaylist().tracks.length >= 2);
  // Los modos Torre e Infinito suman las suyas
  assert.ok(calmPlaylist('bosque', 'tower').tracks.length > calmPlaylist('bosque').tracks.length);
});

test('qué lista suena según situación, sala y modo', () => {
  assert.equal(runPlaylist({ mood: 'final', biomeId: 'mar' }).key, 'final');
  assert.equal(runPlaylist({ mood: 'boss', biomeId: 'mar' }).key, 'jefe');
  assert.equal(runPlaylist({ mood: 'mini', biomeId: 'mar' }).key, 'minijefe');
  assert.equal(runPlaylist({ mood: 'combat', biomeId: 'mar' }).key, 'combate:mar');
  assert.equal(runPlaylist({ mood: 'calm', biomeId: 'mar', room: 'tienda' }).key, 'sala:tienda');
  assert.equal(runPlaylist({ mood: 'calm', biomeId: 'mar', mode: 'tower' }).key, 'calma:mar:tower');
  assert.equal(runPlaylist({ mood: 'calm', biomeId: 'desconocido' }).key, 'calma:bosque:');
  assert.equal(roomMusicFor('shop'), 'tienda');
  assert.equal(roomMusicFor('center'), 'santuario');
  assert.equal(roomMusicFor('combat'), null);
  // La pista de siempre sigue en cada lista
  assert.ok(calmPlaylist('cueva').tracks.includes(TRACKS.cueva));
  assert.ok(runPlaylist({ mood: 'boss', biomeId: 'x' }).tracks.includes(TRACKS.jefe));
});

test('Defensa de torres: los 18 tipos con familia propia y las 18 fases con pista distinta', () => {
  assert.equal(Object.keys(TD_TYPE_FAMILY).length, 18);
  for (const t of ALL_TYPES) assert.ok(TD_TYPE_FAMILY[t], t);
  const firsts = ALL_TYPES.map((t) => tdTypePlaylist(t).tracks[0]);
  assert.equal(new Set(firsts.map((t) => JSON.stringify(t.melody))).size, 18);
  // Las familias se distinguen por algo más que la melodía: tempo, onda, escala o batería
  const fam = new Set(ALL_TYPES.map((t) => { const f = TD_TYPE_FAMILY[t]; return `${f.bpm}|${f.leads[0]}|${f.scales[0]}|${f.drums[0]}`; }));
  assert.equal(fam.size, 18);
  assert.equal(TD_MAPS.length, 18);
  const keys = new Set(TD_MAPS.map((m) => tdTypePlaylist(levelTheme(m, 1)).key));
  assert.equal(keys.size, 18);
});
