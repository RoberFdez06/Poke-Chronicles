// Sonido del juego con Web Audio: efectos y música generados (ver data/sounds.ts) y gritos de PokeAPI.
// El navegador no deja sonar nada hasta el primer clic o tecla: el contexto se crea y se reanuda entonces.
import { SFX, midiToFreq, stepSeconds, type AudioSettings, type SfxName, type Tone, type Wave } from '../data/sounds';
import { loadAudio, saveAudio } from '../data/save';
import { fetchCryUrl } from '../data/pokeapi';
import {
  TRACKS, menuPlaylist, roomMusicFor, runPlaylist, tdChiefPlaylist, tdMenuPlaylist, tdTypePlaylist, type MusicTrack, type Playlist, type RunMusic,
} from '../data/music';
import { CROSSFADE_S, RESUME_WINDOW_MS, crossfadeGains, filterFreq, needsResume, resumeStep, type MusicMood } from '../audio/musicState.ts';
import { MusicShuffle, loopsFor } from '../audio/playlist.ts';

let ctx: AudioContext | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let noise: AudioBuffer | null = null;
let settings: AudioSettings = loadAudio();
let musicWanted = false;
let musicTimer: number | undefined;
let tempoMul = 1;
/** Pista que suena: la del menú por defecto; playTrack() la cambia (biomas y jefe, ver data/music.ts). */
let track: MusicTrack = TRACKS.menu;
/** Lista que suena (la mezcla elige la pista; ver audio/playlist.ts). */
let playlist: Playlist | null = null;
const shuffle = new MusicShuffle((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0);

/** Crea el contexto de audio (solo tras un gesto del jugador) y aplica el volumen guardado. */
function ensure(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    return null;
  }
  ctx.onstatechange = () => {
    if (ctx && ctx.state === 'running' && musicWanted) startLoop();
  };
  sfxGain = ctx.createGain();
  musicGain = ctx.createGain();
  sfxGain.connect(ctx.destination);
  musicGain.connect(ctx.destination);
  applyVolume();
  // Ruido blanco para golpes
  noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

function applyVolume() {
  if (sfxGain) sfxGain.gain.value = settings.sfx;
  // La música va bastante más baja que los efectos
  if (musicGain) musicGain.gain.value = settings.music * 0.35;
}

/**
 * Llamar una vez al arrancar. Android e iOS solo aceptan reanudar el audio dentro de un gesto que *termina*
 * (`touchend`, `pointerup`, `click`), no con `touchstart` ni `pointerdown`: por eso se escuchan todos. Además se
 * reanuda al volver a la pestaña o de la ventana de Google, porque el sistema lo corta al irse a segundo plano.
 */
export function initAudio() {
  // iPhone: sin esto el interruptor de silencio apaga el audio web (Safari 16.4+ lo entiende)
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = 'playback';
  } catch {
    // no disponible
  }
  const unlock = () => {
    const c = ensure();
    if (c && needsResume(c.state)) void c.resume().catch(() => undefined);
    if (musicWanted) startLoop();
  };
  for (const ev of ['pointerdown', 'pointerup', 'keydown', 'touchstart', 'touchend', 'click'] as const) {
    window.addEventListener(ev, unlock, { passive: true });
  }
  window.addEventListener('gamepadconnected', unlock);
  // Volver a la pestaña, de otra app o de la ventana de Google: si el audio quedó parado, se reanuda en cuanto se pueda
  const back = () => {
    if (document.visibilityState === 'hidden') return;
    const c = ctx;
    if (c && needsResume(c.state)) void c.resume().catch(() => undefined);
  };
  document.addEventListener('visibilitychange', back);
  window.addEventListener('pageshow', back);
  window.addEventListener('focus', back);
}

export const getAudioSettings = (): AudioSettings => ({ ...settings });

/** Cambia y guarda el volumen (lo usa la pantalla de Ajustes). */
/** Vuelve a leer el volumen guardado (al cambiar de almacenamiento al arrancar, T45). */
export function reloadAudioSettings() {
  settings = loadAudio();
  applyVolume();
}

export function setAudioSettings(next: AudioSettings) {
  settings = { ...next };
  saveAudio(settings);
  applyVolume();
}

function playTone(c: AudioContext, out: AudioNode, t: Tone, at: number) {
  const start = at + (t.delay ?? 0);
  const env = c.createGain();
  env.gain.setValueAtTime(t.gain, start);
  env.gain.exponentialRampToValueAtTime(0.001, start + t.dur);
  env.connect(out);
  if (t.wave === 'noise') {
    const src = c.createBufferSource();
    src.buffer = noise;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    // Ruido: filtro a 8 × la nota, sin pasar de Nyquist (6000 × 8 = 48 kHz avisaba en consola en cada golpe de platillo)
    filter.frequency.setValueAtTime(filterFreq(t.freq * 8, c.sampleRate), start);
    if (t.slideTo) filter.frequency.exponentialRampToValueAtTime(Math.max(1, filterFreq(t.slideTo * 8, c.sampleRate)), start + t.dur);
    src.connect(filter).connect(env);
    src.start(start);
    src.stop(start + t.dur);
    return;
  }
  const osc = c.createOscillator();
  osc.type = t.wave;
  osc.frequency.setValueAtTime(t.freq, start);
  if (t.slideTo) osc.frequency.exponentialRampToValueAtTime(t.slideTo, start + t.dur);
  osc.connect(env);
  osc.start(start);
  osc.stop(start + t.dur + 0.02);
}

/** Efecto de sonido. Sin audio desbloqueado o con el volumen a 0, no hace nada. */
export function sfx(name: SfxName) {
  const c = ctx;
  if (!c || !sfxGain || settings.sfx <= 0 || c.state !== 'running') return;
  for (const t of SFX[name]) playTone(c, sfxGain, t, c.currentTime);
}

/** Efecto con el tono subido o bajado `semis` semitonos (poderes fusionados: cada receta suena distinta). */
export function sfxShift(name: SfxName, semis: number) {
  const c = ctx;
  if (!c || !sfxGain || settings.sfx <= 0 || c.state !== 'running') return;
  const k = Math.pow(2, semis / 12);
  for (const t of SFX[name]) playTone(c, sfxGain, { ...t, freq: t.freq * k, slideTo: t.slideTo ? t.slideTo * k : undefined }, c.currentTime);
}

/** Grito del Pokémon (PokeAPI `cries.latest`), con el volumen de los efectos. Si falla, silencio. */
export async function cry(id: number) {
  if (settings.sfx <= 0) return;
  try {
    const url = await fetchCryUrl(id);
    if (!url) return;
    const a = new Audio(url);
    a.volume = Math.min(1, settings.sfx * 0.6);
    await a.play();
  } catch {
    // sin red, sin permiso para sonar o sin grito: no pasa nada
  }
}

// --- Música: bucle programado por adelantado (melodía + bajo) ---
// Cada pista suena por su propio "carril" (GainNode). Cambiar de pista hace un crossfade entre carriles y el que sale
// recuerda por dónde iba: si vuelve en pocos segundos se reanuda en vez de empezar de cero (lógica en audio/musicState.ts).

interface Lane {
  track: MusicTrack;
  gain: GainNode;
  step: number;
  nextStepAt: number;
  /** Se está programando (suena o se está apagando en el crossfade). */
  playing: boolean;
  /** Desde cuándo (performance.now) no es la pista activa. */
  silentSince: number;
  stopTimer?: number;
  /** Paso en el que la pista termina (tras sus vueltas) y la mezcla pasa a otra. */
  endStep: number;
}
const lanes = new Map<MusicTrack, Lane>();

function laneFor(c: AudioContext, t: MusicTrack): Lane {
  let l = lanes.get(t);
  if (!l) {
    const gain = c.createGain();
    gain.gain.value = 0;
    gain.connect(musicGain!);
    l = { track: t, gain, step: 0, nextStepAt: 0, playing: false, silentSince: -Infinity, endStep: 0 };
    lanes.set(t, l);
  }
  return l;
}

/** Rampa de volumen de un carril con curva de potencia constante (ver crossfadeGains). */
function fadeLane(c: AudioContext, l: Lane, to: 0 | 1, secs: number) {
  const from = Math.max(0, Math.min(1, l.gain.gain.value));
  const n = 24;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const g = crossfadeGains((i / (n - 1)) * secs, secs);
    curve[i] = to === 1 ? from + (1 - from) * g.inGain : from * g.outGain;
  }
  const p = l.gain.gain;
  p.cancelScheduledValues(c.currentTime);
  p.setValueAtTime(from, c.currentTime);
  p.setValueCurveAtTime(curve, c.currentTime, secs);
}

/** Pone un carril como el que suena: si no estaba programándose, arranca (reanudando si salió hace poco). */
function activateLane(c: AudioContext, l: Lane, secs: number) {
  if (l.stopTimer !== undefined) {
    window.clearTimeout(l.stopTimer);
    l.stopTimer = undefined;
  }
  if (!l.playing) {
    l.step = resumeStep(l.step, performance.now() - l.silentSince, l.track.melody.length);
    l.nextStepAt = c.currentTime + 0.05;
    l.playing = true;
    const len = l.track.melody.length;
    l.endStep = l.step + loopsFor(len, l.track.bpm) * len;
  } else if (l.step >= l.endStep) {
    // Vuelve mientras se apagaba ya al final: se le da otra tanda de vueltas
    l.endStep = l.step + loopsFor(l.track.melody.length, l.track.bpm) * l.track.melody.length;
  }
  if (secs > 0) fadeLane(c, l, 1, secs);
  else {
    l.gain.gain.cancelScheduledValues(c.currentTime);
    l.gain.gain.setValueAtTime(1, c.currentTime);
  }
}

function deactivateLane(c: AudioContext, l: Lane, secs: number) {
  l.silentSince = performance.now();
  fadeLane(c, l, 0, secs);
  if (l.stopTimer !== undefined) window.clearTimeout(l.stopTimer);
  l.stopTimer = window.setTimeout(() => {
    l.playing = false;
    l.stopTimer = undefined;
  }, secs * 1000 + 150);
}

/** Cambia la música a otra pista (bioma, combate, jefe…) con crossfade; la que ya suena no se toca. */
export function playTrack(next: MusicTrack, keepTempo = false) {
  if (track === next) return;
  const prev = track;
  track = next;
  if (!keepTempo) tempoMul = 1;
  const c = ctx;
  if (c && musicGain && musicTimer !== undefined) {
    const pl = lanes.get(prev);
    if (pl) deactivateLane(c, pl, CROSSFADE_S);
    activateLane(c, laneFor(c, next), CROSSFADE_S);
  }
  playMusic();
}

/** Ritmo de la pista que suena (1 = normal). La fase 2 del jefe la acelera; cambiar de pista lo devuelve a 1. */
export function setMusicTempo(mul: number) {
  tempoMul = Math.max(0.5, Math.min(2, mul));
}

// --- Listas y mezcla aleatoria ---

/** Toca una lista: si es otra (o `force`), la mezcla elige una pista distinta de la última; si es la misma, sigue. */
function playPlaylist(pl: Playlist, force = false) {
  if (pl.tracks.length === 0) return;
  const keepTempo = playlist?.key === pl.key;
  playlist = pl;
  const ch = shuffle.choose(pl.key, pl.tracks.length, performance.now(), force);
  playTrack(pl.tracks[ch.index], keepTempo);
}

/** La pista ha dado sus vueltas: otra al azar de la misma lista (nunca la misma). */
function advancePlaylist() {
  const pl = playlist;
  if (!pl || pl.tracks.length < 2) {
    const l = lanes.get(track);
    if (l) l.endStep += loopsFor(track.melody.length, track.bpm) * track.melody.length;
    return;
  }
  const ch = shuffle.next(pl.tracks.length, performance.now());
  if (ch) playTrack(pl.tracks[ch.index], true);
}

/** Lista que suena ahora (para saber de quién es la música; ver releaseMusic). */
export const musicKey = (): string | null => playlist?.key ?? null;

/** Vuelve a la música del menú (mezcla de sus pistas). */
export const playMenuMusic = () => playPlaylist(menuPlaylist());

/** Una escena que sale vuelve al menú solo si la música que suena aún es la suya (otra escena puede haberla cambiado ya). */
export function releaseMusic(owns: (key: string) => boolean) {
  const k = musicKey();
  if (k !== null && owns(k)) playMenuMusic();
}

let run: RunMusic = { mood: 'calm', biomeId: 'bosque' };

/** Empieza la música de un piso: exploración del bioma (y del modo), con una pista nueva en cada piso. */
export function startRunMusic(biomeId: string, mode: string, _floor: number) {
  run = { mood: 'calm', biomeId, mode, room: null };
  playPlaylist(runPlaylist(run), true);
}

/** Cambia la situación (combate, minijefe, jefe, jefe final o calma): cada vez que entra, otra pista de su lista. */
export function setMusicMood(mood: MusicMood) {
  run = { ...run, mood };
  playPlaylist(runPlaylist(run));
}

/**
 * Se entra en otra sala: tienda y salas tranquilas tienen su lista; en las demás, la del bioma. Si la lista no cambia y
 * la pista ya lleva un rato, pasa a otra. `fight`: la sala va a cerrarse con enemigos (lo decide el combate).
 */
export function musicRoom(kind: string, fight: boolean) {
  run = { ...run, room: fight ? null : roomMusicFor(kind) };
  if (fight || run.mood !== 'calm') return;
  const pl = runPlaylist(run);
  if (pl.key !== playlist?.key) playPlaylist(pl);
  else {
    const ch = shuffle.room(pl.tracks.length, performance.now());
    if (ch?.changed) playTrack(pl.tracks[ch.index]);
  }
}

/** Defensa de torres: la del tipo tema del nivel. */
export const playTdMusic = (type: string) => playPlaylist(tdTypePlaylist(type), true);
/** Defensa de torres: oleada con minijefe o jefe (true) o vuelta a la del tipo (false). */
export function playTdChief(on: boolean, type: string) {
  playPlaylist(on ? tdChiefPlaylist() : tdTypePlaylist(type));
}
/** Menú de la Defensa de torres. */
export const playTdMenuMusic = () => playPlaylist(tdMenuPlaylist());

/** Empieza (o sigue) la música de fondo. */
export function playMusic() {
  musicWanted = true;
  startLoop();
}

const ARP_MAJOR = [24, 28, 31, 36];
/** Volumen de cada onda: las suaves (triángulo, seno) más altas que las ásperas, para que todas las pistas suenen parejas. */
const waveGain = (w: Wave, soft: number, harsh: number): number => (w === 'triangle' || w === 'sine' ? soft : harsh);

function scheduleLane(c: AudioContext, l: Lane) {
  const t = l.track;
  const mul = t === track ? tempoMul : 1;
  while (l.nextStepAt < c.currentTime + 0.25) {
    const dur = stepSeconds(t.bpm * mul);
    const i = l.step % t.melody.length;
    const m = t.melody[i];
    const b = t.bass[i % t.bass.length];
    const d = t.drums ? t.drums[i % t.drums.length] : 0;
    const at = l.nextStepAt;
    const out = l.gain;
    if (settings.music > 0) {
      if (m !== null) {
        const g = waveGain(t.lead, 0.3, 0.16);
        playTone(c, out, { freq: midiToFreq(m), dur: dur * 0.9, wave: t.lead, gain: g }, at);
        // Eco suave medio paso después (pistas tranquilas)
        if (t.echo) playTone(c, out, { freq: midiToFreq(m), dur: dur * 0.8, wave: t.lead, gain: g * 0.3, delay: dur * 1.5 }, at);
      }
      if (d === 1) playTone(c, out, { freq: 90, slideTo: 40, dur: 0.12, wave: 'sine', gain: 0.5 }, at);
      if (d === 2) playTone(c, out, { freq: 1200, dur: 0.08, wave: 'noise', gain: 0.18 }, at);
      if (b !== null) {
        const bw = t.bassWave ?? 'triangle';
        playTone(c, out, { freq: midiToFreq(b), dur: dur * 1.8, wave: bw, gain: waveGain(bw, 0.35, 0.11) }, at);
      }
      // Capas de los temas de combate y de jefe: charles, timbal, segunda voz y arpegio
      if (d === 3) playTone(c, out, { freq: 6000, dur: 0.03, wave: 'noise', gain: 0.07 }, at);
      if (d === 5) playTone(c, out, { freq: 5000, dur: 0.12, wave: 'noise', gain: 0.06 }, at);
      if (d === 4) playTone(c, out, { freq: 160, slideTo: 90, dur: 0.14, wave: 'triangle', gain: 0.35 }, at);
      const hm = t.harmony ? t.harmony[i % t.harmony.length] : null;
      if (hm !== null && hm !== undefined) {
        const hw = t.harmonyWave ?? 'square';
        playTone(c, out, { freq: midiToFreq(hm), dur: dur * 3.5, wave: hw, gain: waveGain(hw, 0.13, 0.07) }, at);
      }
      if (t.arp) {
        const root = t.bass[(i - (i % 4) + t.bass.length) % t.bass.length] ?? b ?? 48;
        const steps = t.arpSteps ?? ARP_MAJOR;
        playTone(c, out, { freq: midiToFreq((root ?? 48) + steps[i % steps.length]), dur: dur * 0.45, wave: 'square', gain: 0.05 }, at);
      }
    }
    l.nextStepAt += dur;
    l.step++;
  }
}

function startLoop() {
  const c = ctx;
  if (!c || !musicGain || musicTimer !== undefined) return;
  activateLane(c, laneFor(c, track), 0);
  musicTimer = window.setInterval(() => {
    const now = performance.now();
    let ended = false;
    for (const l of lanes.values()) {
      if (l.playing) {
        scheduleLane(c, l);
        if (l.track === track && l.step >= l.endStep) ended = true;
      } else if (l.track !== track && now - l.silentSince > RESUME_WINDOW_MS) {
        // Carril que ya no se reanudará: fuera, para no acumular nodos con tantas pistas
        l.gain.disconnect();
        lanes.delete(l.track);
      }
    }
    if (ended) advancePlaylist();
  }, 100);
}

/** ¿Se puede sonar ya? (el navegador exige un gesto del jugador antes de dejar sonar nada) */
export const audioReady = (): boolean => !!ctx && ctx.state === 'running';

/** Lo más que se espera a que el navegador deje sonar el audio antes de seguir (en silencio) tras la pantalla previa. */
const UNLOCK_WAIT_MS = 500;

/**
 * Desbloquea el audio con un gesto y avisa cuando ya suena o, como mucho, a los UNLOCK_WAIT_MS. Sin activación del
 * usuario (una tecla sintética, una política del navegador) `resume()` no se resuelve nunca y la pantalla «Pulsa una
 * tecla…» se quedaba parada; ahora sigue y el audio arranca con el siguiente gesto (initAudio).
 */
export async function unlockAudio(): Promise<void> {
  const c = ensure();
  if (c && needsResume(c.state)) {
    await Promise.race([
      c.resume().catch(() => undefined), // sin permiso: seguirá en silencio
      new Promise<void>((r) => setTimeout(r, UNLOCK_WAIT_MS)),
    ]);
  }
}

/** Música muy baja que sube poco a poco (intro del título); `restoreMusicVolume` la deja a su volumen normal. */
export function softMusicIn(ms: number, level = 0.4) {
  const c = ctx;
  if (!c || !musicGain) return;
  const full = settings.music * 0.35;
  musicGain.gain.cancelScheduledValues(c.currentTime);
  musicGain.gain.setValueAtTime(0.0001, c.currentTime);
  musicGain.gain.linearRampToValueAtTime(Math.max(0.0001, full * level), c.currentTime + ms / 1000);
}

export function restoreMusicVolume(ms = 800) {
  const c = ctx;
  if (!c || !musicGain) return;
  musicGain.gain.cancelScheduledValues(c.currentTime);
  musicGain.gain.setValueAtTime(musicGain.gain.value, c.currentTime);
  musicGain.gain.linearRampToValueAtTime(Math.max(0.0001, settings.music * 0.35), c.currentTime + ms / 1000);
}
