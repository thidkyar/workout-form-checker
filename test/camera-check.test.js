import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCameraCheck } from '../src/camera-check.js';

function poseWithVis(side, vis) {
  const pose = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0.05 }));
  const idxs = side === 'left'
    ? [11, 13, 15, 23, 25, 27, 31, 7]
    : [12, 14, 16, 24, 26, 28, 32, 8];
  for (const i of idxs) pose[i].visibility = vis;
  return pose;
}

test('does not pass before holdMs has elapsed', () => {
  let now = 1000;
  const cc = createCameraCheck({ holdMs: 2000, now: () => now });
  const pose = poseWithVis('left', 0.95);
  const r1 = cc.update(pose);
  assert.equal(r1.passed, false);
  now += 1500;
  const r2 = cc.update(pose);
  assert.equal(r2.passed, false);
});

test('passes after 2s of good visibility', () => {
  let now = 1000;
  const cc = createCameraCheck({ holdMs: 2000, now: () => now });
  const pose = poseWithVis('left', 0.95);
  cc.update(pose);
  now += 2100;
  const r = cc.update(pose);
  assert.equal(r.passed, true);
  assert.equal(r.side, 'left');
});

test('low visibility resets the hold timer', () => {
  let now = 1000;
  const cc = createCameraCheck({ holdMs: 2000, now: () => now });
  const good = poseWithVis('left', 0.95);
  const bad = poseWithVis('left', 0.3);
  cc.update(good);
  now += 1500;
  cc.update(bad);   // resets
  now += 1000;
  const r = cc.update(good);
  assert.equal(r.passed, false); // only 1s since restart
});

test('side flip restarts the hold timer', () => {
  let now = 1000;
  const cc = createCameraCheck({ holdMs: 2000, now: () => now });
  cc.update(poseWithVis('left', 0.95));
  now += 1500;
  cc.update(poseWithVis('right', 0.95)); // flip
  now += 1000;
  const r = cc.update(poseWithVis('right', 0.95));
  assert.equal(r.passed, false);
});

test('reset clears state', () => {
  let now = 1000;
  const cc = createCameraCheck({ holdMs: 2000, now: () => now });
  const pose = poseWithVis('left', 0.95);
  cc.update(pose);
  now += 5000;
  cc.reset();
  const r = cc.update(pose);
  // After reset, timer starts again from this update.
  assert.equal(r.passed, false);
});
