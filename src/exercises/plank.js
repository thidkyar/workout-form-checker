import {
  angleAt,
  distance,
  toDegrees,
  SIDE_INDICES,
  verticalOffsetFromLine,
} from '../geometry.js';

const thresholds = {
  bodyLineMin: 165,
  bodyLineMax: 195,
  headOffsetRatio: 0.10,
  startGraceMs: 2000,
  failGraceMs: 2000,
  speakAtSeconds: [30, 60],
  speakEverySecondsAfter: 30,
};

export default {
  name: 'plank',
  type: 'hold',
  thresholds,
  primaryAngleLabel: 'Body line',

  requiredLandmarks(side) {
    const s = SIDE_INDICES[side];
    return [s.shoulder, s.hip, s.ankle, s.ear];
  },

  primaryAngle(landmarks, side) {
    const s = SIDE_INDICES[side];
    return toDegrees(angleAt(landmarks[s.shoulder], landmarks[s.hip], landmarks[s.ankle]));
  },

  // No reps for plank — caller drives a hold timer instead. We still
  // return 'hold' here to satisfy the uniform module shape.
  repPhase() {
    return 'hold';
  },

  score(landmarks, side) {
    const s = SIDE_INDICES[side];
    const sh = landmarks[s.shoulder];
    const hip = landmarks[s.hip];
    const ankle = landmarks[s.ankle];
    const ear = landmarks[s.ear];
    if (!sh || !hip || !ankle || !ear) {
      return { overall: 0, issues: ['low-confidence'], primaryAngle: NaN, formOk: false };
    }

    const issues = [];
    const bodyAngle = toDegrees(angleAt(sh, hip, ankle));

    // body-line: interior angle below 165° = broken. Resolve direction.
    if (bodyAngle < thresholds.bodyLineMin) {
      const offset = verticalOffsetFromLine(sh, ankle, hip);
      if (offset > 0) issues.push('hip-sag');
      else issues.push('hip-pike');
    }

    // head position: ear-shoulder horizontal offset within ~10% of
    // shoulder width. In a side view the off-camera shoulder is occluded,
    // so we use shoulder→hip distance as a stable proxy for body scale.
    const scale = distance(sh, hip);
    if (Number.isFinite(scale) && scale > 0) {
      const earOffset = Math.abs(ear.x - sh.x);
      if (earOffset > thresholds.headOffsetRatio * scale) {
        issues.push('neck-craning');
      }
    }

    const formOk = issues.length === 0;
    const overall = formOk ? 1 : Math.max(0, 1 - issues.length * 0.4);
    return { overall, issues, primaryAngle: bodyAngle, formOk };
  },
};
