import {
  angleAt,
  distance,
  toDegrees,
  SIDE_INDICES,
  meanVisibility,
} from '../geometry.js';

const thresholds = {
  downBelow: 100,
  upAbove: 160,
  shallowDepth: 100,
  kneeForwardRatio: 0.05,
  asymmetryDeg: 10,
  bothSidesVisibility: 0.6,
};

function angle(landmarks, side) {
  const s = SIDE_INDICES[side];
  return toDegrees(angleAt(landmarks[s.hip], landmarks[s.knee], landmarks[s.ankle]));
}

export default {
  name: 'squat',
  type: 'reps',
  thresholds,
  primaryAngleLabel: 'Knee',

  requiredLandmarks(side) {
    const s = SIDE_INDICES[side];
    return [s.shoulder, s.hip, s.knee, s.ankle, s.foot];
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
    const hip = landmarks[s.hip];
    const knee = landmarks[s.knee];
    const ankle = landmarks[s.ankle];
    const foot = landmarks[s.foot];
    if (!hip || !knee || !ankle || !foot) {
      return { overall: 0, issues: ['low-confidence'], primaryAngle: NaN };
    }

    const kneeAngle = toDegrees(angleAt(hip, knee, ankle));
    const issues = [];

    // knees-forward: knee X position past the toe X by > 5% of frame width.
    // "Past the toe" depends on which way the body is facing — for the
    // camera-facing side, toes typically point away from the camera-side hip.
    const past =
      side === 'left' ? knee.x > foot.x : knee.x < foot.x;
    if (past && Math.abs(knee.x - foot.x) > thresholds.kneeForwardRatio) {
      issues.push('knees-forward');
    }

    // asymmetry: only check when the OFF-camera side is also confidently
    // visible. In a true side-on view this almost never triggers.
    const otherSide = side === 'left' ? 'right' : 'left';
    const o = SIDE_INDICES[otherSide];
    const otherIdxs = [o.hip, o.knee, o.ankle];
    const otherVis = meanVisibility(landmarks, otherIdxs);
    if (otherVis > thresholds.bothSidesVisibility) {
      const otherAngle = toDegrees(
        angleAt(landmarks[o.hip], landmarks[o.knee], landmarks[o.ankle]),
      );
      if (
        Number.isFinite(otherAngle) &&
        Math.abs(otherAngle - kneeAngle) > thresholds.asymmetryDeg
      ) {
        issues.push('asymmetry');
      }
    }

    // shallow-depth is decided by the rep's bottom angle, not per-frame.
    // The caller has access to the rep's bottom from repCounter, so we
    // do not emit it from per-frame score().

    const overall = Math.max(0, 1 - issues.length * 0.3);
    return { overall, issues, primaryAngle: kneeAngle };
  },
};
