import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSmoother } from '../src/smoothing.js';

test('moving average: window of 5', () => {
  const s = createSmoother(5);
  s.push(1);
  s.push(2);
  s.push(3);
  s.push(4);
  s.push(5);
  assert.equal(s.value(), 3);
});

test('moving average: drops oldest when full', () => {
  const s = createSmoother(3);
  s.push(10);
  s.push(20);
  s.push(30);
  assert.equal(s.value(), 20);
  s.push(60);
  // window now [20, 30, 60]
  assert.equal(s.value(), (20 + 30 + 60) / 3);
});

test('skips non-finite inputs', () => {
  const s = createSmoother(5);
  s.push(10);
  s.push(NaN);
  s.push(Infinity);
  s.push(20);
  assert.equal(s.size(), 2);
  assert.equal(s.value(), 15);
});

test('value() with no inputs is NaN', () => {
  const s = createSmoother(5);
  assert.ok(Number.isNaN(s.value()));
});

test('reset() clears the buffer', () => {
  const s = createSmoother(3);
  s.push(1);
  s.push(2);
  s.reset();
  assert.equal(s.size(), 0);
  assert.ok(Number.isNaN(s.value()));
});

test('rep-style angle stream is smoothed past micro-jitter', () => {
  // Simulated sequence near the bottom of a rep — would cross 100°
  // multiple times without smoothing.
  const s = createSmoother(5);
  const stream = [101, 99, 102, 98, 101, 99, 100];
  const smoothed = stream.map((v) => s.push(v));
  // Once the buffer fills, the average sits very close to 100 and won't
  // oscillate aggressively across the 100 threshold.
  for (let i = 4; i < smoothed.length; i++) {
    assert.ok(Math.abs(smoothed[i] - 100) < 2);
  }
});
