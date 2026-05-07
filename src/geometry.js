// Pure geometry helpers. All angles returned in radians.

export const SIDE_INDICES = {
  left:  { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27, foot: 31, ear: 7 },
  right: { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28, foot: 32, ear: 8 },
};

const SIDE_LANDMARK_LIST = {
  left:  [11, 13, 15, 23, 25, 27, 31, 7],
  right: [12, 14, 16, 24, 26, 28, 32, 8],
};

export function angleAt(a, b, c) {
  if (!a || !b || !c) return NaN;
  const abx = a.x - b.x, aby = a.y - b.y;
  const cbx = c.x - b.x, cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const magAb = Math.hypot(abx, aby);
  const magCb = Math.hypot(cbx, cby);
  if (magAb === 0 || magCb === 0) return NaN;
  const cos = Math.max(-1, Math.min(1, dot / (magAb * magCb)));
  return Math.acos(cos);
}

export function distance(a, b) {
  if (!a || !b) return NaN;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Returns 'left' or 'right' — whichever side has higher mean visibility
// across the body landmarks we care about. Ties go to left.
export function pickCameraSide(landmarks) {
  const meanVis = (idxs) => {
    let sum = 0, n = 0;
    for (const i of idxs) {
      const lm = landmarks[i];
      if (lm && typeof lm.visibility === 'number') {
        sum += lm.visibility;
        n++;
      }
    }
    return n ? sum / n : 0;
  };
  const l = meanVis(SIDE_LANDMARK_LIST.left);
  const r = meanVis(SIDE_LANDMARK_LIST.right);
  return r > l ? 'right' : 'left';
}

export function meanVisibility(landmarks, idxs) {
  let sum = 0, n = 0;
  for (const i of idxs) {
    const lm = landmarks[i];
    if (lm && typeof lm.visibility === 'number') {
      sum += lm.visibility;
      n++;
    }
  }
  return n ? sum / n : 0;
}

export function toDegrees(rad) {
  return rad * 180 / Math.PI;
}

export function toRadians(deg) {
  return deg * Math.PI / 180;
}

// Signed vertical offset of point p from the line segment a→c, evaluated at p.x.
// Positive = p is below the line (image-space y grows downward).
export function verticalOffsetFromLine(a, c, p) {
  const dx = c.x - a.x;
  if (Math.abs(dx) < 1e-9) return p.y - a.y;
  const t = (p.x - a.x) / dx;
  const expectedY = a.y + t * (c.y - a.y);
  return p.y - expectedY;
}
