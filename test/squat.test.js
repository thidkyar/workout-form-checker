import { test } from 'node:test';
import assert from 'node:assert/strict';
import squat from '../src/exercises/squat.js';
import { squatPose } from './fixtures.js';

test('repPhase: standing tall is "up"', () => {
  const pose = squatPose({ kneeAngleDeg: 175 });
  assert.equal(squat.repPhase(pose, 'left'), 'up');
});

test('repPhase: deep squat is "down"', () => {
  const pose = squatPose({ kneeAngleDeg: 80 });
  assert.equal(squat.repPhase(pose, 'left'), 'down');
});

test('repPhase: parallel (~90°) is "down"', () => {
  const pose = squatPose({ kneeAngleDeg: 90 });
  assert.equal(squat.repPhase(pose, 'left'), 'down');
});

test('repPhase: mid-rep is "transition"', () => {
  const pose = squatPose({ kneeAngleDeg: 120 });
  assert.equal(squat.repPhase(pose, 'left'), 'transition');
});

test('score: clean deep squat has no issues', () => {
  const pose = squatPose({ kneeAngleDeg: 80, kneeForward: false });
  const r = squat.score(pose, 'left');
  assert.deepEqual(r.issues, []);
  assert.equal(r.overall, 1);
});

test('score: knees-forward flagged when knee drifts past toe', () => {
  const pose = squatPose({ kneeAngleDeg: 80, kneeForward: true });
  const r = squat.score(pose, 'left');
  assert.ok(r.issues.includes('knees-forward'));
});

test('score: asymmetry only flagged when other side is visible', () => {
  // Without other-side visibility, no asymmetry flag even if angles diverge.
  const noOther = squatPose({ kneeAngleDeg: 80 });
  const r1 = squat.score(noOther, 'left');
  assert.ok(!r1.issues.includes('asymmetry'));

  // With other side visible AND >10° divergence, flag.
  const withOther = squatPose({ kneeAngleDeg: 80, asymmetricRightDeg: 110 });
  const r2 = squat.score(withOther, 'left');
  assert.ok(r2.issues.includes('asymmetry'));
});

test('primaryAngle: round-trips degrees within 0.5°', () => {
  for (const deg of [80, 95, 130, 160, 175]) {
    const pose = squatPose({ kneeAngleDeg: deg });
    const measured = squat.primaryAngle(pose, 'left');
    assert.ok(Math.abs(measured - deg) < 0.5, `expected ~${deg}, got ${measured}`);
  }
});

test('low-confidence when key landmarks missing', () => {
  // Empty pose has all zeros; foot landmark is at (0,0,vis=0) which
  // technically exists but low visibility. Score should not crash.
  const pose = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
  const r = squat.score(pose, 'left');
  // With degenerate geometry the angle math returns NaN — shouldn't throw.
  assert.ok(typeof r === 'object');
});
