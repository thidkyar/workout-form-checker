// Side-view calibration. The user must stand in frame and have all
// camera-facing-side landmarks return visibility > 0.7 for at least
// 2 consecutive seconds before we'll start a workout.

import { pickCameraSide, SIDE_INDICES } from './geometry.js';

const REQUIRED_PER_SIDE = (side) => {
  const s = SIDE_INDICES[side];
  // hip, knee, ankle, shoulder, elbow, wrist as called out in CLAUDE.md
  return [s.shoulder, s.elbow, s.wrist, s.hip, s.knee, s.ankle];
};

export function createCameraCheck({
  visibilityThreshold = 0.7,
  holdMs = 2000,
  now = () => Date.now(),
} = {}) {
  let goodSince = null;
  let lastSide = null;

  return {
    update(landmarks) {
      const side = pickCameraSide(landmarks);
      const required = REQUIRED_PER_SIDE(side);
      const visibilities = required.map((i) => landmarks?.[i]?.visibility ?? 0);
      const minVis = visibilities.length ? Math.min(...visibilities) : 0;
      const allGood = minVis >= visibilityThreshold;

      // If side flipped during calibration, restart the hold timer.
      if (side !== lastSide) {
        goodSince = null;
        lastSide = side;
      }

      const t = now();
      if (allGood) {
        if (goodSince === null) goodSince = t;
      } else {
        goodSince = null;
      }

      const heldMs = goodSince === null ? 0 : t - goodSince;
      const passed = allGood && heldMs >= holdMs;

      return {
        side,
        passed,
        allGood,
        minVis,
        heldMs,
        progress: Math.min(1, heldMs / holdMs),
        // Hint to surface in UI when calibration is failing.
        hint: allGood
          ? 'Hold still…'
          : 'Place phone/laptop on the floor a few feet to your side, full body in frame.',
      };
    },
    reset() {
      goodSince = null;
      lastSide = null;
    },
  };
}
