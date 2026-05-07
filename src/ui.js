// All DOM access for the app. Exposes a small imperative API that
// main.js calls; main.js never touches the DOM directly.

import { ISSUE_PHRASES } from './feedback.js';

const STATES = ['idle', 'setup-camera', 'ready', 'working', 'resting', 'summary'];

export function createUI() {
  const $ = (sel) => document.querySelector(sel);

  // Cached refs
  const screens = Object.fromEntries(
    STATES.map((s) => [s, $(`#screen-${s}`)]),
  );
  const exerciseButtons = document.querySelectorAll('[data-exercise]');
  const startBtn = $('#start-set-btn');
  const endButtons = document.querySelectorAll('[data-action="end-set"]');
  const restartBtn = $('#restart-btn');
  const repCountEl = $('#rep-count');
  const angleEl = $('#angle-readout');
  const angleLabelEl = $('#angle-label');
  const scoreBarEl = $('#score-bar');
  const cueEl = $('#cue');
  const setupHintEl = $('#setup-hint');
  const setupProgressEl = $('#setup-progress');
  const sideEl = $('#camera-side');
  const holdTimerEl = $('#hold-timer');
  const summaryEl = $('#summary-content');
  const lowConfidenceEl = $('#low-confidence-banner');
  const errorBannerEl = $('#error-banner');

  let listeners = {
    selectExercise: () => {},
    startSet: () => {},
    endSet: () => {},
    restart: () => {},
  };

  exerciseButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const ex = btn.dataset.exercise;
      listeners.selectExercise(ex);
    });
  });
  startBtn?.addEventListener('click', () => listeners.startSet());
  endButtons.forEach((btn) => btn.addEventListener('click', () => listeners.endSet()));
  restartBtn?.addEventListener('click', () => listeners.restart());

  function setState(s) {
    for (const name of STATES) {
      const el = screens[name];
      if (el) el.hidden = name !== s;
    }
  }

  function setExerciseLabel(name, primaryLabel) {
    const t = document.querySelector('#exercise-title');
    if (t) t.textContent = name[0].toUpperCase() + name.slice(1);
    if (angleLabelEl) angleLabelEl.textContent = primaryLabel ?? '';
    // hold timer only relevant for plank
    if (holdTimerEl) holdTimerEl.hidden = name !== 'plank';
    if (repCountEl) repCountEl.parentElement.hidden = name === 'plank';
  }

  function updateReps(n) {
    if (repCountEl) repCountEl.textContent = String(n);
  }

  function updateAngle(deg) {
    if (!angleEl) return;
    if (Number.isFinite(deg)) {
      angleEl.textContent = `${Math.round(deg)}°`;
    } else {
      angleEl.textContent = '—';
    }
  }

  function updateScoreBar(score) {
    if (!scoreBarEl) return;
    const pct = Math.max(0, Math.min(1, score)) * 100;
    scoreBarEl.style.setProperty('--score', `${pct}%`);
    let color = 'var(--good)';
    if (score < 0.4) color = 'var(--bad)';
    else if (score < 0.75) color = 'var(--warn)';
    scoreBarEl.style.setProperty('--score-color', color);
  }

  function updateHoldTimer(ms) {
    if (!holdTimerEl) return;
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    holdTimerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  }

  function showCue(text) {
    if (!cueEl) return;
    cueEl.textContent = text;
    cueEl.classList.remove('flash');
    void cueEl.offsetWidth; // restart animation
    cueEl.classList.add('flash');
  }

  function showIssueCue(code) {
    showCue(ISSUE_PHRASES[code] || code);
  }

  function setSetupProgress(result) {
    if (setupHintEl) setupHintEl.textContent = result.hint;
    if (setupProgressEl) {
      setupProgressEl.style.setProperty('--progress', `${Math.round(result.progress * 100)}%`);
    }
    if (sideEl) sideEl.textContent = `Camera-facing side: ${result.side}`;
  }

  function setLowConfidence(visible) {
    if (lowConfidenceEl) lowConfidenceEl.hidden = !visible;
  }

  function showError(text) {
    if (!errorBannerEl) return;
    errorBannerEl.textContent = text;
    errorBannerEl.hidden = false;
  }

  function clearError() {
    if (!errorBannerEl) return;
    errorBannerEl.hidden = true;
    errorBannerEl.textContent = '';
  }

  function renderSummary(session, exerciseName) {
    if (!summaryEl) return;
    const lines = [];
    lines.push(`<h2>${exerciseName} — set complete</h2>`);
    if (session.type === 'reps') {
      lines.push(`<p class="big-num">${session.reps} reps</p>`);
      if (session.bottoms.length) {
        const avg = session.bottoms.reduce((a, b) => a + b, 0) / session.bottoms.length;
        lines.push(`<p>Average depth: ${avg.toFixed(1)}°</p>`);
      }
    } else {
      const sec = Math.floor(session.holdMs / 1000);
      lines.push(`<p class="big-num">${sec}s hold</p>`);
    }
    const issueEntries = Object.entries(session.issues).filter(([_, n]) => n > 0);
    if (issueEntries.length) {
      lines.push('<h3>Form issues</h3><ul>');
      for (const [code, n] of issueEntries) {
        lines.push(`<li>${ISSUE_PHRASES[code] || code}: ${n}</li>`);
      }
      lines.push('</ul>');
    } else {
      lines.push('<p>No form issues flagged. Nice set.</p>');
    }
    lines.push('<canvas id="timeline-canvas" width="320" height="40"></canvas>');
    summaryEl.innerHTML = lines.join('');
    drawTimeline(session.timeline);
  }

  function drawTimeline(timeline) {
    const canvas = document.querySelector('#timeline-canvas');
    if (!canvas || !timeline?.length) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    // Last 30 seconds, oldest on the left.
    const tEnd = timeline[timeline.length - 1].t;
    const tStart = Math.max(0, tEnd - 30000);
    for (const point of timeline) {
      if (point.t < tStart) continue;
      const x = ((point.t - tStart) / (tEnd - tStart || 1)) * w;
      const score = Math.max(0, Math.min(1, point.score));
      ctx.fillStyle = score >= 0.75 ? '#4ade80' : score >= 0.4 ? '#facc15' : '#f87171';
      ctx.fillRect(x, 0, Math.max(1, w / timeline.length + 1), h);
    }
  }

  return {
    onSelectExercise(fn) { listeners.selectExercise = fn; },
    onStartSet(fn) { listeners.startSet = fn; },
    onEndSet(fn) { listeners.endSet = fn; },
    onRestart(fn) { listeners.restart = fn; },
    setState,
    setExerciseLabel,
    updateReps,
    updateAngle,
    updateScoreBar,
    updateHoldTimer,
    showCue,
    showIssueCue,
    setSetupProgress,
    setLowConfidence,
    showError,
    clearError,
    renderSummary,
  };
}
