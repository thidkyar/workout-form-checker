import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  angleAt,
  distance,
  pickCameraSide,
  toDegrees,
  toRadians,
  verticalOffsetFromLine,
  meanVisibility,
} from '../src/geometry.js';

test('angleAt: right angle is π/2', () => {
  const a = { x: 0, y: 1 };
  const b = { x: 0, y: 0 };
  const c = { x: 1, y: 0 };
  assert.ok(Math.abs(angleAt(a, b, c) - Math.PI / 2) < 1e-9);
});

test('angleAt: straight line is π', () => {
  const a = { x: -1, y: 0 };
  const b = { x: 0, y: 0 };
  const c = { x: 1, y: 0 };
  assert.ok(Math.abs(angleAt(a, b, c) - Math.PI) < 1e-9);
});

test('angleAt: degenerate when zero-length leg', () => {
  const a = { x: 0, y: 0 };
  const b = { x: 0, y: 0 };
  const c = { x: 1, y: 0 };
  assert.ok(Number.isNaN(angleAt(a, b, c)));
});

test('angleAt: returns NaN on missing input', () => {
  assert.ok(Number.isNaN(angleAt(null, { x: 0, y: 0 }, { x: 1, y: 0 })));
});

test('distance: pythagoras', () => {
  assert.equal(distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
});

test('toDegrees / toRadians round-trip', () => {
  assert.ok(Math.abs(toDegrees(Math.PI) - 180) < 1e-9);
  assert.ok(Math.abs(toRadians(180) - Math.PI) < 1e-9);
});

test('pickCameraSide: chooses higher-visibility side', () => {
  // make 33-element array (MediaPipe pose has 33 landmarks)
  const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0.1 }));
  // left indices used by pickCameraSide: 11, 13, 15, 23, 25, 27, 31, 7
  for (const i of [11, 13, 15, 23, 25, 27, 31, 7]) lm[i].visibility = 0.95;
  // right: 12, 14, 16, 24, 26, 28, 32, 8
  for (const i of [12, 14, 16, 24, 26, 28, 32, 8]) lm[i].visibility = 0.2;
  assert.equal(pickCameraSide(lm), 'left');
});

test('pickCameraSide: chooses right when right side has higher visibility', () => {
  const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0.1 }));
  for (const i of [11, 13, 15, 23, 25, 27, 31, 7]) lm[i].visibility = 0.2;
  for (const i of [12, 14, 16, 24, 26, 28, 32, 8]) lm[i].visibility = 0.9;
  assert.equal(pickCameraSide(lm), 'right');
});

test('verticalOffsetFromLine: hip below shoulder→ankle line is positive', () => {
  // shoulder at (0, 0), ankle at (1, 0) — horizontal line at y=0.
  // hip at (0.5, 0.1) is below in image coords (y grows down).
  const offset = verticalOffsetFromLine(
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0.5, y: 0.1 },
  );
  assert.ok(offset > 0);
});

test('verticalOffsetFromLine: hip above the line is negative', () => {
  const offset = verticalOffsetFromLine(
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0.5, y: -0.1 },
  );
  assert.ok(offset < 0);
});

test('meanVisibility: averages and skips missing', () => {
  const lm = [
    { x: 0, y: 0, visibility: 1 },
    { x: 0, y: 0, visibility: 0.5 },
    null,
  ];
  assert.equal(meanVisibility(lm, [0, 1]), 0.75);
});
