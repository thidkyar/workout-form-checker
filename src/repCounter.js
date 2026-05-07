// Generic up/down hysteresis state machine used by squat and pushup.
// A rep is counted on the down → up transition.
//
// Both exercises measure a primary joint angle that is HIGH at the top
// (knee/elbow extended) and LOW at the bottom. So:
//   - phase becomes 'down' once angle drops below `downBelow`
//   - phase becomes 'up' once angle rises back above `upAbove`
//   - rep counts on down → up

export function createRepCounter({ downBelow, upAbove }) {
  if (!(downBelow < upAbove)) {
    throw new Error('repCounter: downBelow must be < upAbove for hysteresis');
  }
  let phase = 'up';
  let count = 0;
  let bottomAngle = Infinity;
  const bottoms = [];

  return {
    update(angle) {
      if (!Number.isFinite(angle)) {
        return { phase, count, repCompleted: false, bottom: null };
      }
      let repCompleted = false;
      let bottom = null;
      if (phase === 'up' && angle < downBelow) {
        phase = 'down';
        bottomAngle = angle;
      } else if (phase === 'down') {
        if (angle < bottomAngle) bottomAngle = angle;
        if (angle > upAbove) {
          phase = 'up';
          count += 1;
          repCompleted = true;
          bottom = bottomAngle;
          bottoms.push(bottomAngle);
          bottomAngle = Infinity;
        }
      }
      return { phase, count, repCompleted, bottom };
    },
    getCount() { return count; },
    getPhase() { return phase; },
    getBottoms() { return bottoms.slice(); },
    reset() {
      phase = 'up';
      count = 0;
      bottomAngle = Infinity;
      bottoms.length = 0;
    },
  };
}
