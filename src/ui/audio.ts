// Sonido del juego con Web Audio: efectos y música generados (ver data/sounds.ts) y gritos de PokeAPI.
// El navegador no deja sonar nada hasta el primer clic o tecla: el contexto se crea y se reanuda entonces.
import { MUSIC, SFX, midiToFreq, stepSeconds, type AudioSettings, type SfxName, type Tone } from '../data/sounds';
import { loadAudio, saveAudio } from '../data/save';
import { fetchCryUrl } from '../data/pokeapi';

let ctx: AudioContext | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let noise: AudioBuffer | null = null;
let settings: AudioSettings = loadAudio();
let musicWanted = false;
let musicTimer: number | undefined;
let nextStepAt = 0;
let step = 0;

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

/** Llamar una vez al arrancar: el primer clic, tecla o botón del mando desbloquea el audio. */
export function initAudio() {
  const unlock = () => {
    const c = ensure();
    if (c && c.state === 'suspended') void c.resume();
    if (musicWanted) startLoop();
  };
  for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) window.addEventListener(ev, unlock, { passive: true });
  window.addEventListener('gamepadconnected', unlock);
}

export const getAudioSettings = (): AudioSettings => ({ ...settings });

/** Cambia y guarda el volumen (lo usa la pantalla de Ajustes). */
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
    filter.frequency.setValueAtTime(t.freq * 8, start);
    if (t.slideTo) filter.frequency.exponentialRampToValueAtTime(t.slideTo * 8, start + t.dur);
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

/** Empieza (o sigue) la música de fondo. */
export function playMusic() {
  musicWanted = true;
  startLoop();
}

export function stopMusic() {
  musicWanted = false;
  if (musicTimer !== undefined) window.clearInterval(musicTimer);
  musicTimer = undefined;
}

function startLoop() {
  const c = ctx;
  if (!c || !musicGain || musicTimer !== undefined) return;
  nextStepAt = c.currentTime + 0.1;
  const dur = stepSeconds(MUSIC.bpm);
  musicTimer = window.setInterval(() => {
    // Programa los pasos del próximo cuarto de segundo
    while (nextStepAt < c.currentTime + 0.25) {
      const i = step % MUSIC.melody.length;
      const m = MUSIC.melody[i];
      const b = MUSIC.bass[i];
      if (settings.music > 0) {
        if (m !== null) playTone(c, musicGain!, { freq: midiToFreq(m), dur: dur * 0.9, wave: 'square', gain: 0.18 }, nextStepAt);
        if (b !== null) playTone(c, musicGain!, { freq: midiToFreq(b), dur: dur * 1.8, wave: 'triangle', gain: 0.35 }, nextStepAt);
      }
      nextStepAt += dur;
      step++;
    }
  }, 100);
}
