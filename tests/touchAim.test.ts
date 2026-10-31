import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickAimTarget, touchAimDir } from '../src/data/touchAim.ts';

const near = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9, `${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
};

test('elige el enemigo más cercano', () => {
  const t = pickAimTarget({ x: 0, y: 0 }, [{ x: 100, y: 0 }, { x: 0, y: -30 }, { x: -50, y: 50 }]);
  assert.deepEqual(t, { x: 0, y: -30 });
});

test('ignora los no válidos y respeta el alcance', () => {
  assert.equal(pickAimTarget({ x: 0, y: 0 }, [{ x: 1, y: 1, ok: false }]), null);
  assert.equal(pickAimTarget({ x: 0, y: 0 }, [{ x: 500, y: 0 }], 100), null);
  assert.equal(pickAimTarget({ x: 0, y: 0 }, [{ x: NaN, y: 0 }, { x: 3, y: 4 }])?.x, 3);
  assert.equal(pickAimTarget({ x: 0, y: 0 }, []), null);
});

test('con enemigo, apunta a él aunque se empuje el joystick', () => {
  near(touchAimDir({ x: 10, y: 10 }, [{ x: 10, y: 60 }], { x: 1, y: 0 }, { x: -1, y: 0 }), { x: 0, y: 1 });
});

test('sin enemigos, usa el joystick de apuntar', () => {
  near(touchAimDir({ x: 0, y: 0 }, [], { x: 0, y: -0.5 }, { x: 1, y: 0 }), { x: 0, y: -1 });
});

test('sin enemigos ni joystick, la última dirección de disparo', () => {
  near(touchAimDir({ x: 0, y: 0 }, [], null, { x: 3, y: 4 }), { x: 0.6, y: 0.8 });
  // joystick casi en el centro: no cuenta
  near(touchAimDir({ x: 0, y: 0 }, [], { x: 0.1, y: 0.1 }, { x: -2, y: 0 }), { x: -1, y: 0 });
});

test('enemigo encima del jugador o todo a cero: nunca da NaN', () => {
  near(touchAimDir({ x: 5, y: 5 }, [{ x: 5, y: 5 }], null, { x: 0, y: 0 }), { x: 0, y: 1 });
});
