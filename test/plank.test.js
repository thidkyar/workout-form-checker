import { test } from 'node:test';
import assert from 'node:assert/strict';
import plank from '../src/exercises/plank.js';
import { plankPose } from './fixtures.js';

test('flat plank with neutral neck has no issues', () => {
  const pose = plankPose({ hipState: 'flat', neck: 'neutral' });
  const r = plank.score(pose, 'left');
  assert.deepEqual(r.issues, []);
  assert.equal(r.formOk, true);
});

test('hip-sag flagged when hips drop', () => {
  const pose = plankPose({ hipState: 'sag' });
  const r = plank.score(pose, 'left');
  assert.ok(r.issues.includes('hip-sag'));
  assert.equal(r.formOk, false);
});

test('hip-pike flagged when hips rise', () => {
  const pose = plankPose({ hipState: 'pike' });
  const r = plank.score(pose, 'left');
  assert.ok(r.issues.includes('hip-pike'));
});

test('neck-craning flagged when ear is far from shoulder x', () => {
  const pose = plankPose({ neck: 'craned' });
  const r = plank.score(pose, 'left');
  assert.ok(r.issues.includes('neck-craning'));
});

test('repPhase always "hold"', () => {
  const pose = plankPose();
  assert.equal(plank.repPhase(pose, 'left'), 'hold');
});

test('low-confidence when ear is missing', () => {
  const pose = plankPose();
  pose[7] = null;
  const r = plank.score(pose, 'left');
  assert.deepEqual(r.issues, ['low-confidence']);
});
