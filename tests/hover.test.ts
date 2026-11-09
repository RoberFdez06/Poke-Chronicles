// Ratón sobre tarjetas dibujadas desde la esquina, pulsaciones breves de teclado y filtros de audio (rama `hover`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { containerHit, containerHitRect } from '../src/data/menuPointer.ts';
import { keepJustDown } from '../src/data/keyHold.ts';
import { filterFreq } from '../src/audio/musicState.ts';

// Tarjeta de modos: 212 × 212 dibujada de (0, 0) a (w, h) respecto a la posición del contenedor
const W = 212, H = 212;
const mesh = (f: (x: number, y: number) => boolean) => {
  const fails: string[] = [];
  for (const fx of [0, 0.02, 0.25, 0.5, 0.75, 0.98, 1]) for (const fy of [0, 0.02, 0.25, 0.5, 0.75, 0.98, 1]) {
    if (!f(fx * W, fy * H)) fails.push(`${fx},${fy}`);
  }
  return fails;
};

test('contenedor dibujado desde la esquina: toda la tarjeta (esquinas, bordes y centro) da en ella', () => {
  const hit = containerHitRect(W, H, 'corner');
  assert.deepEqual(mesh((x, y) => containerHit(hit, W, H, x, y)), []);
  // y nada fuera de ella (la tarjeta de la izquierda o de arriba no se la queda)
  for (const [x, y] of [[-2, H / 2], [W / 2, -2], [W + 2, H / 2], [W / 2, H + 2], [-W / 2, -H / 2]]) {
    assert.equal(containerHit(hit, W, H, x, y), false, `${x},${y}`);
  }
});

test('regresión: el rectángulo (0, 0, w, h) en un contenedor dibujado desde la esquina perdía tres cuartos de la tarjeta', () => {
  const old = { x: 0, y: 0, w: W, h: H };
  const fails = mesh((x, y) => containerHit(old, W, H, x, y));
  assert.ok(fails.includes('0.75,0.75') && fails.includes('0.98,0.5') && fails.includes('0.5,0.98'), 'la mitad derecha y la de abajo no daban');
  assert.equal(containerHit(old, W, H, -W / 2, -H / 2), true, 'y se quedaba un trozo de la tarjeta de arriba a la izquierda');
});

test('contenedor dibujado centrado: (0, 0, w, h) cubre de −w/2 a +w/2', () => {
  const hit = containerHitRect(W, H, 'center');
  assert.deepEqual(mesh((x, y) => containerHit(hit, W, H, x - W / 2, y - H / 2)), []);
  assert.equal(containerHit(hit, W, H, W / 2 + 2, 0), false);
});

test('teclado: una pulsación breve (keydown y keyup en el mismo fotograma) no pierde el JustDown', () => {
  assert.equal(keepJustDown(true, 10, 10), true, 'Enter sintético: se procesan los dos en el fotograma 10');
  assert.equal(keepJustDown(true, 9, 10), false, 'pulsada antes y nadie la leyó: no vale como pulsación nueva al soltar');
  assert.equal(keepJustDown(false, 10, 10), false, 'ya leída (o repetición): nada que conservar');
});

test('audio: la frecuencia del filtro no pasa de la mitad de la frecuencia de muestreo', () => {
  assert.equal(filterFreq(6000 * 8, 48000), 24000);
  assert.equal(filterFreq(6000 * 8, 44100), 22050);
  assert.equal(filterFreq(600 * 8, 48000), 4800, 'lo que ya cabía no cambia (suena igual)');
  assert.equal(filterFreq(-5, 48000), 0);
});
