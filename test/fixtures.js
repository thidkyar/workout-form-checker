// Helpers for building synthetic MediaPipe pose landmark arrays
// for use in unit tests of the exercise modules.

export function emptyPose() {
  return Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
}

export function setLm(pose, idx, x, y, visibility = 0.9) {
  pose[idx] = { x, y, visibility };
  return pose;
}

// Build a side-view squat pose (camera-facing left). Angle is the
// hip-knee-ankle interior angle in degrees that we want to encode.
//   - Place hip at (0, 0)
//   - knee at (0, 1)
//   - ankle at distance 1 from knee, oriented so the interior angle at
//     knee equals the requested degrees.
// Coordinates are in arbitrary normalized units; only the geometry
// relative to the joint matters for angle math.
export function squatPose({
  kneeAngleDeg = 170,
  kneeForward = false,
  asymmetricRightDeg = null,
  side = 'left',
} = {}) {
  const pose = emptyPose();
  const rad = (kneeAngleDeg * Math.PI) / 180;

  // hip-knee vector points "up" the leg (from knee to hip).
  // We'll make it (0, -1) — i.e., hip is above knee in image y.
  const hip = { x: 0, y: -1 };
  const knee = { x: 0, y: 0 };
  // ankle direction from knee: rotate (0, 1) — i.e., straight down — by
  // (180° - kneeAngleDeg) so the angle at knee equals kneeAngleDeg.
  // For 180°, ankle should be directly below knee.
  const rot = Math.PI - rad;
  const ankle = { x: Math.sin(rot), y: Math.cos(rot) };

  // Toe convention: toes point toward positive x. With knee at x=0,
  // foot.x > 0 = good form. kneeForward=true means knee has drifted
  // forward of the toe — encoded by placing foot behind the knee in x.
  const foot = {
    x: kneeForward ? -0.1 : ankle.x + 0.1,
    y: ankle.y,
  };

  const idx = side === 'left'
    ? { hip: 23, knee: 25, ankle: 27, foot: 31, shoulder: 11 }
    : { hip: 24, knee: 26, ankle: 28, foot: 32, shoulder: 12 };

  setLm(pose, idx.shoulder, hip.x, hip.y - 0.5);
  setLm(pose, idx.hip, hip.x, hip.y);
  setLm(pose, idx.knee, knee.x, knee.y);
  setLm(pose, idx.ankle, ankle.x, ankle.y);
  setLm(pose, idx.foot, foot.x, foot.y);

  if (asymmetricRightDeg !== null) {
    // Build the same geometry on the off-camera side at the requested angle.
    const otherRad = (asymmetricRightDeg * Math.PI) / 180;
    const otherRot = Math.PI - otherRad;
    const otherAnkle = { x: Math.sin(otherRot), y: Math.cos(otherRot) };
    const otherIdx = side === 'left'
      ? { hip: 24, knee: 26, ankle: 28 }
      : { hip: 23, knee: 25, ankle: 27 };
    setLm(pose, otherIdx.hip, 0.05, -1, 0.85);
    setLm(pose, otherIdx.knee, 0.05, 0, 0.85);
    setLm(pose, otherIdx.ankle, 0.05 + otherAnkle.x, otherAnkle.y, 0.85);
  }

  return pose;
}

// Build a side-view pushup pose. elbowAngleDeg controls the
// shoulder-elbow-wrist angle. hipState 'flat' | 'sag' | 'pike' shifts
// the hip vertically off the shoulder→ankle line.
export function pushupPose({
  elbowAngleDeg = 170,
  hipState = 'flat',
  side = 'left',
} = {}) {
  const pose = emptyPose();
  const idx = side === 'left'
    ? { shoulder: 11, elbow: 13, wrist: 15, hip: 23, ankle: 27 }
    : { shoulder: 12, elbow: 14, wrist: 16, hip: 24, ankle: 28 };

  // shoulder at (0, 0); elbow straight down at (0, 1); wrist further
  // along, rotated to encode the requested elbow angle.
  const shoulder = { x: 0, y: 0 };
  const elbow = { x: 0, y: 1 };
  const rad = (elbowAngleDeg * Math.PI) / 180;
  // direction from elbow to wrist: rotate elbow→shoulder direction
  // (which is (0, -1)) by (elbowAngleDeg) so the interior angle at elbow
  // matches.
  const wrist = {
    x: elbow.x + Math.sin(rad),
    y: elbow.y - Math.cos(rad),
  };
  // body line: shoulder at (0,0), ankle at (3, 0). Hip on the line at (1.5, 0)
  // by default. sag: hip below (y > 0). pike: hip above (y < 0).
  const ankle = { x: 3, y: 0 };
  let hip = { x: 1.5, y: 0 };
  if (hipState === 'sag') hip = { x: 1.5, y: 0.3 };
  if (hipState === 'pike') hip = { x: 1.5, y: -0.3 };

  setLm(pose, idx.shoulder, shoulder.x, shoulder.y);
  setLm(pose, idx.elbow, elbow.x, elbow.y);
  setLm(pose, idx.wrist, wrist.x, wrist.y);
  setLm(pose, idx.hip, hip.x, hip.y);
  setLm(pose, idx.ankle, ankle.x, ankle.y);

  return pose;
}

export function plankPose({ hipState = 'flat', neck = 'neutral', side = 'left' } = {}) {
  const pose = emptyPose();
  const idx = side === 'left'
    ? { shoulder: 11, hip: 23, ankle: 27, ear: 7 }
    : { shoulder: 12, hip: 24, ankle: 28, ear: 8 };

  let hipY = 0;
  if (hipState === 'sag') hipY = 0.3;
  if (hipState === 'pike') hipY = -0.3;

  let earX = 0;
  if (neck === 'craned') earX = 0.5; // way past shoulder

  setLm(pose, idx.shoulder, 0, 0);
  setLm(pose, idx.hip, 1.5, hipY);
  setLm(pose, idx.ankle, 3, 0);
  setLm(pose, idx.ear, earX, -0.3);
  return pose;
}
