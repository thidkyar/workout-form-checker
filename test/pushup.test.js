import { test } from 'node:test';
import assert from 'node:assert/strict';
import pushup from '../src/exercises/pushup.js';
import { pushupPose } from './fixtures.js';

test('repPhase: arms locked out is "up"', () => {
  const pose = pushupPose({ elbowAngleDeg: 175 });
  assert.equal(pushup.repPhase(pose, 'left'), 'up');
});

test('repPhase: chest near floor is "down"', () => {
  const pose = pushupPose({ elbowAngleDeg: 80 });
  assert.equal(pushup.repPhase(pose, 'left'), 'down');
});

test('repPhase: mid-rep is "transition"', () => {
  const pose = pushupPose({ elbowAngleDeg: 130 });
  assert.equal(pushup.repPhase(pose, 'left'), 'transition');
});

test('score: clean pushup has no issues', () => {
  const pose = pushupPose({ elbowAngleDeg: 80, hipState: 'flat' });
  const r = pushup.score(pose, 'left');
  assert.deepEqual(r.issues, []);
  assert.equal(r.overall, 1);
});

test('score: hip-sag flagged when hip drops below body line', () => {
  const pose = pushupPose({ elbowAngleDeg: 80, hipState: 'sag' });
  const r = pushup.score(pose, 'left');
  assert.ok(r.issues.includes('hip-sag'));
});

test('score: hip-pike flagged when hip rises above body line', () => {
  const pose = pushupPose({ elbowAngleDeg: 80, hipState: 'pike' });
  const r = pushup.score(pose, 'left');
  assert.ok(r.issues.includes('hip-pike'));
});

test('primaryAngle: round-trips elbow angle', () => {
  for (const deg of [70, 90, 130, 160, 175]) {
    const pose = pushupPose({ elbowAngleDeg: deg });
    const measured = pushup.primaryAngle(pose, 'left');
    assert.ok(Math.abs(measured - deg) < 0.5, `expected ~${deg}, got ${measured}`);
  }
});
