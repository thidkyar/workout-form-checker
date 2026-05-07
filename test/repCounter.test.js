import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRepCounter } from '../src/repCounter.js';

test('counts a single rep on down→up transition', () => {
  const c = createRepCounter({ downBelow: 100, upAbove: 160 });
  c.update(170);  // up
  c.update(120);  // transition (no state change)
  c.update(95);   // down
  c.update(80);   // still down
  c.update(120);  // transition (no state change yet — < upAbove)
  const r = c.update(165); // up — rep!
  assert.equal(r.count, 1);
  assert.equal(r.repCompleted, true);
});

test('hysteresis prevents double-counting near threshold', () => {
  const c = createRepCounter({ downBelow: 100, upAbove: 160 });
  c.update(170);
  c.update(99);   // enters down
  c.update(105);  // does NOT exit (still <= 160)
  c.update(99);   // already down, no change
  c.update(165);  // exits up, rep counts
  assert.equal(c.getCount(), 1);
});

test('tracks bottom angle per rep', () => {
  const c = createRepCounter({ downBelow: 100, upAbove: 160 });
  c.update(170);
  c.update(95);
  c.update(85);
  c.update(80);   // bottom of rep
  c.update(90);
  const r = c.update(165);
  assert.equal(r.bottom, 80);
  assert.deepEqual(c.getBottoms(), [80]);
});

test('multiple reps accumulate', () => {
  const c = createRepCounter({ downBelow: 100, upAbove: 160 });
  for (let rep = 0; rep < 3; rep++) {
    c.update(170);
    c.update(80);
    c.update(165);
  }
  assert.equal(c.getCount(), 3);
});

test('NaN / non-finite inputs are ignored', () => {
  const c = createRepCounter({ downBelow: 100, upAbove: 160 });
  c.update(170);
  c.update(NaN);
  c.update(Infinity);
  const r = c.update(80);
  assert.equal(r.phase, 'down');
});

test('throws if hysteresis bounds inverted', () => {
  assert.throws(() => createRepCounter({ downBelow: 160, upAbove: 100 }));
});

test('reset clears state', () => {
  const c = createRepCounter({ downBelow: 100, upAbove: 160 });
  c.update(170);
  c.update(80);
  c.update(165);
  c.reset();
  assert.equal(c.getCount(), 0);
  assert.equal(c.getPhase(), 'up');
  assert.deepEqual(c.getBottoms(), []);
});
