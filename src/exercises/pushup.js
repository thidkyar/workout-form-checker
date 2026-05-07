import {
  angleAt,
  toDegrees,
  SIDE_INDICES,
  verticalOffsetFromLine,
} from '../geometry.js';

const thresholds = {
  downBelow: 100,
  upAbove: 160,
  shallowDepth: 110,
  hipSagBelow: 160,
  hipPikeAbove: 190,
};

function angle(landmarks, side) {
  const s = SIDE_INDICES[side];
  return toDegrees(angleAt(landmarks[s.shoulder], landmarks[s.elbow], landmarks[s.wrist]));
}

export default {
  name: 'pushup',
  type: 'reps',
  thresholds,
  primaryAngleLabel: 'Elbow',

  requiredLandmarks(side) {
    const s = SIDE_INDICES[side];
    return [s.shoulder, s.elbow, s.wrist, s.hip, s.ankle];
  },

  primaryAngle(landmarks, side) {
    return angle(landmarks, side);
  },

  repPhase(landmarks, side) {
    const a = angle(landmarks, side);
    if (!Number.isFinite(a)) return 'transition';
    if (a < thresholds.downBelow) return 'down';
    if (a > thresholds.upAbove) return 'up';
    return 'transition';
  },

  score(landmarks, side) {
    const s = SIDE_INDICES[side];
    const sh = landmarks[s.shoulder];
    const el = landmarks[s.elbow];
    const wr = landmarks[s.wrist];
    const hip = landmarks[s.hip];
    const ankle = landmarks[s.ankle];
    if (!sh || !el || !wr || !hip || !ankle) {
      return { overall: 0, issues: ['low-confidence'], primaryAngle: NaN };
    }

    const elbowAngle = toDegrees(angleAt(sh, el, wr));
    const hipAngleInterior = toDegrees(angleAt(sh, hip, ankle));
    const issues = [];

    // Body line breaks when interior shoulder-hip-ankle angle drops below 160°.
    // Direction (sag vs pike) is disambiguated by which side of the
    // shoulder→ankle line the hip sits on. In normalized image coords
    // y grows downward, so hip below the line = sag.
    if (hipAngleInterior < thresholds.hipSagBelow) {
      const offset = verticalOffsetFromLine(sh, ankle, hip);
      if (offset > 0) issues.push('hip-sag');
      else issues.push('hip-pike');
    }

    const overall = Math.max(0, 1 - issues.length * 0.3);
    return {
      overall,
      issues,
      primaryAngle: elbowAngle,
      hipAngle: hipAngleInterior,
    };
  },
};
