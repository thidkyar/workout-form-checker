// Entry point: state machine, Handsfree wiring, per-frame heartbeat.
// All DOM access lives in ui.js — this file only orchestrates.

import exercises from './exercises/index.js';
import { meanVisibility, SIDE_INDICES } from './geometry.js';
import { createSmoother } from './smoothing.js';
import { createRepCounter } from './repCounter.js';
import { createCameraCheck } from './camera-check.js';
import { createFeedback } from './feedback.js';
import { createUI } from './ui.js';

const STORAGE_KEY = 'wfc.lastSession';
const LAST_EXERCISE_KEY = 'wfc.lastExercise';
const BUILD_TAG = 'v4-tdz-fix';

// On-page diagnostic log. iOS Safari has no devtools, so we render every
// noteworthy step into a fixed log overlay the user can read.
function diag(msg) {
  console.log('[diag]', msg);
  const el = document.querySelector('#debug-log');
  if (!el) return;
  const ts = new Date().toISOString().slice(11, 19);
  el.textContent += `[${ts}] ${msg}\n`;
  el.scrollTop = el.scrollHeight;
}
diag(`build ${BUILD_TAG}`);
diag(`baseURI ${document.baseURI}`);
diag(`Handsfree global: ${typeof globalThis.Handsfree}`);
diag(`mediaDevices: ${typeof navigator.mediaDevices}`);
diag(`getUserMedia: ${typeof navigator.mediaDevices?.getUserMedia}`);
window.addEventListener('error', (e) => diag(`window error: ${e.message}`));
window.addEventListener('unhandledrejection', (e) => diag(`unhandled: ${e.reason?.message || e.reason}`));

// Probe whether handsfree.js was actually deployed (HEAD request).
fetch(new URL('./public/handsfree.js', document.baseURI), { method: 'HEAD' })
  .then((r) => diag(`fetch public/handsfree.js: HTTP ${r.status}`))
  .catch((e) => diag(`fetch public/handsfree.js failed: ${e.message}`));
const REST_AFTER_MS = 5000;
const LOW_CONF_HOLD_MS = 2000;
const LOW_CONF_THRESHOLD = 0.6;

const ui = createUI();
const feedback = createFeedback();

// Single mutable reference; switching exercises = swap + reset.
let currentExercise = null;
let chosenSide = null;
let smoother = null;
let repCounter = null;
let cameraCheck = createCameraCheck();
let session = null;
let plankState = null;
let state = 'idle';
let lastIssueAt = {}; // per-issue throttling timestamps
let lowConfSince = null;

const lastExercise = localStorage.getItem(LAST_EXERCISE_KEY);
if (lastExercise && exercises[lastExercise]) {
  // pre-highlight in UI; user still has to click.
  document.querySelector(`[data-exercise="${lastExercise}"]`)?.classList.add('last-used');
}

let handsfreeStarted = false;

// iOS Safari requires the getUserMedia call to be in the same call stack as
// the user gesture. Handsfree.js loads its model scripts async first, so by
// the time IT calls getUserMedia, Safari has discarded the gesture and silently
// fails. We pre-warm permission with a direct getUserMedia call inside the
// click handler — once granted, Handsfree's later getUserMedia just works.
async function preWarmCameraPermission() {
  diag('preWarm: requesting camera...');
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Webcam API not available. HTTPS is required.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user' },
    audio: false,
  });
  diag('preWarm: granted; releasing test stream');
  stream.getTracks().forEach((t) => t.stop());
}

ui.onSelectExercise(async (name) => {
  diag(`click: ${name}`);
  if (!exercises[name]) { diag(`unknown exercise: ${name}`); return; }
  currentExercise = exercises[name];
  localStorage.setItem(LAST_EXERCISE_KEY, name);
  cameraCheck.reset();
  ui.setExerciseLabel(name, currentExercise.primaryAngleLabel);
  ui.clearError();
  setState('setup-camera');

  if (!handsfreeStarted) {
    try {
      await preWarmCameraPermission();
    } catch (err) {
      const msg = `Camera permission failed: ${err?.name || ''} ${err?.message || err}`.trim();
      diag(msg);
      ui.showError(msg + '\nIn Safari: aA → Website Settings → Camera → Allow.');
      setState('idle');
      return;
    }
    try {
      diag('handsfree.start()...');
      await handsfree.start();
      handsfreeStarted = true;
      diag('handsfree.start: ok');
    } catch (err) {
      const msg = `Pose model failed to start: ${err?.message || err}`;
      diag(msg);
      ui.showError(msg);
      setState('idle');
    }
  } else {
    diag('handsfree already started');
  }
});

ui.onStartSet(() => {
  feedback.unlockSpeech();
  startWorking();
});

ui.onEndSet(() => {
  finishSet();
});

ui.onRestart(() => {
  setState('idle');
});

// (state defaults to 'idle'; screen-idle is the only visible section in HTML,
// so no need to call setState('idle') here — and doing so would TDZ-error
// because setState now references wakeLock declared further down.)

// ---------- Handsfree setup ----------

// Use a relative path so the app works whether served from `/` (local dev)
// or from `/<repo>/` (GitHub Pages project sites).
if (!globalThis.Handsfree) {
  document.querySelector('#error-banner').textContent =
    'Handsfree.js failed to load. Check public/handsfree.js exists at the deployed URL.';
  document.querySelector('#error-banner').hidden = false;
  throw new Error('Handsfree library not loaded');
}

const handsfree = new globalThis.Handsfree({
  showDebug: false,
  pose: { enabled: true, modelComplexity: 1, smoothLandmarks: true },
  assetsPath: new URL('./public/assets', document.baseURI).toString(),
});

handsfree.use('formCheck', {
  onFrame(data) {
    const lm = data?.pose?.[0]?.poseLandmarks;
    if (!lm) return;
    handleFrame(lm);
  },
});

// ---------- State machine ----------

// Screen Wake Lock — keep the phone screen on while a set is in progress.
let wakeLock = null;
async function acquireWakeLock() {
  if (wakeLock || !('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (_) { /* user denied or unsupported */ }
}
function releaseWakeLock() {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}
// Phones drop the wake lock when the page is backgrounded; re-acquire on return.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && (state === 'working' || state === 'resting')) {
    acquireWakeLock();
  }
});

function setState(s) {
  state = s;
  ui.setState(s);
  if (s === 'working' || s === 'resting') acquireWakeLock();
  else releaseWakeLock();
}

function handleFrame(landmarks) {
  if (state === 'setup-camera') {
    const r = cameraCheck.update(landmarks);
    ui.setSetupProgress(r);
    if (r.passed) {
      chosenSide = r.side;
      setState('ready');
    }
    return;
  }

  if (state === 'working' || state === 'resting') {
    handleWorkingFrame(landmarks);
  }
}

function startWorking() {
  if (!currentExercise || !chosenSide) return;
  smoother = createSmoother(5);
  if (currentExercise.type === 'reps') {
    repCounter = createRepCounter({
      downBelow: currentExercise.thresholds.downBelow,
      upAbove: currentExercise.thresholds.upAbove,
    });
  } else {
    repCounter = null;
  }
  plankState = currentExercise.type === 'hold'
    ? { phase: 'pre-start', goodSince: null, badSince: null, holdMs: 0, lastTickAt: null, spokenAtSec: -Infinity, lastSpokenSec: 0 }
    : null;
  session = {
    exercise: currentExercise.name,
    type: currentExercise.type,
    startedAt: Date.now(),
    reps: 0,
    holdMs: 0,
    bottoms: [],
    issues: {},
    timeline: [],
    consecutiveShallow: 0,
    lastRepAt: Date.now(),
  };
  lastIssueAt = {};
  lowConfSince = null;
  ui.updateReps(0);
  ui.updateHoldTimer(0);
  setState('working');
}

function handleWorkingFrame(landmarks) {
  const now = Date.now();
  const required = currentExercise.requiredLandmarks(chosenSide);
  const meanVis = meanVisibility(landmarks, required);

  // Low-confidence banner — surfaces only after ≥2 s of poor visibility.
  if (meanVis < LOW_CONF_THRESHOLD) {
    if (lowConfSince === null) lowConfSince = now;
    if (now - lowConfSince > LOW_CONF_HOLD_MS) ui.setLowConfidence(true);
  } else {
    lowConfSince = null;
    ui.setLowConfidence(false);
  }

  const rawAngle = currentExercise.primaryAngle(landmarks, chosenSide);
  const smoothed = smoother.push(rawAngle);
  const result = currentExercise.score(landmarks, chosenSide);

  ui.updateAngle(Number.isFinite(smoothed) ? smoothed : rawAngle);
  ui.updateScoreBar(result.overall);

  session.timeline.push({ t: now - session.startedAt, score: result.overall });

  // Tally per-frame issues with light throttle on speech.
  for (const code of result.issues) {
    session.issues[code] = (session.issues[code] || 0) + 1;
    maybeAnnounceIssue(code, now);
  }

  if (currentExercise.type === 'reps') {
    handleRepFrame(smoothed, now);
  } else if (currentExercise.type === 'hold') {
    handleHoldFrame(result, now);
  }
}

function handleRepFrame(smoothedAngle, now) {
  const r = repCounter.update(smoothedAngle);

  if (r.repCompleted) {
    session.reps += 1;
    session.bottoms.push(r.bottom);
    session.lastRepAt = now;
    ui.updateReps(session.reps);
    feedback.repBeep();

    const shallow = r.bottom > currentExercise.thresholds.shallowDepth;
    if (shallow) {
      session.consecutiveShallow += 1;
      if (session.consecutiveShallow >= 2) {
        feedback.speak('Go deeper');
        session.issues['shallow-depth'] = (session.issues['shallow-depth'] || 0) + 1;
      }
    } else {
      session.consecutiveShallow = 0;
    }

    if (state === 'resting') setState('working');
  }

  // Auto-rest detection.
  if (state === 'working' && now - session.lastRepAt > REST_AFTER_MS) {
    setState('resting');
  }
}

function handleHoldFrame(result, now) {
  const ps = plankState;
  const formOk = !!result.formOk;

  // Tick the holdMs while we're in 'holding' phase.
  if (ps.phase === 'holding' && ps.lastTickAt !== null) {
    ps.holdMs += now - ps.lastTickAt;
  }
  ps.lastTickAt = now;

  if (formOk) {
    if (ps.goodSince === null) ps.goodSince = now;
    ps.badSince = null;
  } else {
    if (ps.badSince === null) ps.badSince = now;
    ps.goodSince = null;
  }

  if (ps.phase === 'pre-start' || ps.phase === 'paused') {
    if (formOk && now - ps.goodSince >= 2000) {
      ps.phase = 'holding';
    }
  } else if (ps.phase === 'holding') {
    if (!formOk && now - ps.badSince >= 2000) {
      ps.phase = 'paused';
    }
  }

  session.holdMs = ps.holdMs;
  ui.updateHoldTimer(ps.holdMs);

  // Speak elapsed time at 30s, 60s, then every 30s thereafter.
  const elapsedSec = Math.floor(ps.holdMs / 1000);
  if (
    elapsedSec >= 30 &&
    elapsedSec !== ps.lastSpokenSec &&
    elapsedSec % 30 === 0
  ) {
    feedback.speak(`${elapsedSec} seconds`);
    feedback.holdMilestoneBeep();
    ps.lastSpokenSec = elapsedSec;
  }
}

function maybeAnnounceIssue(code, now) {
  // Squat shallow-depth is decided per-rep, not per-frame.
  if (code === 'shallow-depth') return;
  // Per-issue throttle of 4 s on top of the global 3 s in feedback.js,
  // so we don't keep re-announcing the same problem on every frame.
  const last = lastIssueAt[code] || 0;
  if (now - last < 4000) return;
  feedback.speakIssue(code);
  ui.showIssueCue(code);
  lastIssueAt[code] = now;
}

function finishSet() {
  if (!session || !currentExercise) return;
  session.endedAt = Date.now();
  ui.renderSummary(session, currentExercise.name);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (_) {}
  setState('summary');
}
