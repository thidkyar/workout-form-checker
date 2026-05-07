// 5-frame moving average over a stream of scalar values.
// MediaPipe's per-frame angle output is jittery; without this we
// false-trigger rep transitions near the bottom of a rep.

export function createSmoother(windowSize = 5) {
  const buf = [];
  return {
    push(value) {
      if (Number.isFinite(value)) {
        buf.push(value);
        if (buf.length > windowSize) buf.shift();
      }
      return this.value();
    },
    value() {
      if (buf.length === 0) return NaN;
      let sum = 0;
      for (const v of buf) sum += v;
      return sum / buf.length;
    },
    size() {
      return buf.length;
    },
    reset() {
      buf.length = 0;
    },
  };
}
