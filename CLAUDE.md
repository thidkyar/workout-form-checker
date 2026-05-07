# Workout Form Checker

A browser-based form coach that uses the webcam + Handsfree.js pose tracking to check the user's exercise form in real time. v1 supports **squat**, **pushup**, and **plank**. The app counts reps, scores form against reference angles, and gives audio + visual cues when something's off. All processing stays in the browser.

## Tech stack

- **Vanilla HTML / CSS / ES modules.** No framework, no bundler.
- **Handsfree.js v8.5.1** — MediaPipe Pose model in **full-body mode** (we need the lower body for squats, so the lighter upper-body mode used in other apps does not apply here).
- **Web Audio API** for rep beeps and corrective tones (no audio assets to ship).
- **Web Speech API (`SpeechSynthesis`)** for spoken corrections like "go deeper" or "drop your hips." This matters because the user is rarely looking at the screen during reps — the camera is to their side, the screen is in their peripheral vision at best.
- **localStorage** for the last-used exercise and a lightweight session log (no accounts, no cloud).

Self-host the Handsfree models. Eject from the npm package into `public/assets` and set `assetsPath: '/public/assets'`. Do not load from Unpkg on every page load.

## The camera-angle problem (read this first)

Squat, pushup, and plank all need a **side-on camera view** to measure the angles that matter. A front-facing webcam gives you almost nothing useful for these movements. Every other design decision in this doc flows from that constraint:

- The app must verify camera setup before counting reps. Don't trust the user to do it right.
- The user's screen is not in their primary view during reps. Audio feedback is the primary channel; visual is secondary.
- Choose which side of the body to score by comparing landmark visibility scores between left and right. The side with the higher mean visibility (`landmark.visibility` from MediaPipe) is camera-facing; use those landmarks for angle math.

The calibration step (`src/camera-check.js`) should require the user to stand in the frame and verify that hip, knee, ankle, shoulder, elbow, and wrist on the camera-facing side all return visibility > 0.7 for at least 2 consecutive seconds. If not, show a clear setup hint ("Place phone/laptop on the floor a few feet to your side") and refuse to start the workout.

## Architecture

State machine with these states:

- `idle` — exercise menu visible.
- `setup-camera` — calibration as described above.
- `ready` — camera verified, big "Start Set" button.
- `working` — counting reps / timing the hold.
- `resting` — auto-entered after ~5 s with no rep activity. Pauses counting.
- `summary` — end-of-set stats.

The Handsfree per-frame plugin is the heartbeat. Each frame: pull landmarks → pass to the active exercise's `score()` and `repPhase()` → update rep counter / hold timer → emit feedback events.

## Exercise modules

Each exercise lives in `src/exercises/<name>.js` and exports a uniform shape:

```js
export default {
  name: 'squat',
  requiredLandmarks: [11, 23, 25, 27, 31],   // by index
  thresholds: { /* see below */ },
  repPhase(landmarks)  { /* returns 'up' | 'down' | 'transition' */ },
  score(landmarks)     { /* returns { overall: 0..1, issues: [...] } */ },
}
```

Keep these modules pure. Input: landmarks. Output: numbers and string codes. The UI layer is responsible for translating issue codes into spoken phrases or icons.

### Squat

Primary measurement is the **knee angle** (hip-knee-ankle). Use landmarks `23 → 25 → 27` on the camera-facing side.

- Standing: knee angle ≈ 170°.
- Parallel: ≈ 90°.
- Deep: < 90°.

Rep state uses hysteresis to avoid double-counting near thresholds:
- Transition to `down` when knee angle drops below **100°**.
- Transition to `up` when it rises back above **160°**.
- A rep counts on the `down → up` transition.

Form checks (issue codes the UI may surface):
- `knees-forward` — knee X position (landmark 25) more than ~5% of frame width past the toe (landmark 31). Common cause of knee pain.
- `asymmetry` — left vs right knee angles differ by > 10°. (Requires both sides visible, which is rare in side view; only check this if both have visibility > 0.6.)
- `shallow-depth` — bottom of rep does not reach < 100°. Surface as "go deeper" *only* if it happens 2+ reps in a row, not on every single shallow rep.

### Pushup

Primary measurement is the **elbow angle** (shoulder-elbow-wrist), landmarks `11 → 13 → 15`.

- Top: ≈ 170°.
- Bottom (chest near floor): ≈ 70–90°.

Rep state:
- `down` when elbow angle drops below **100°**.
- `up` when it rises back above **160°**.

Form checks:
- `hip-sag` — angle at hip (shoulder-hip-ankle, landmarks `11 → 23 → 27`) drops below **160°**. Body line is breaking downward.
- `hip-pike` — same angle exceeds **190°** when measured directionally. Body line is breaking upward.
- `shallow-depth` — bottom of rep doesn't reach < 110°. Same "2+ reps in a row" rule before announcing.

### Plank

No reps. Hold timer. Two checks run continuously:

- **Body line** — shoulder-hip-ankle angle within `[165°, 195°]`.
- **Head position** — ear-shoulder horizontal offset within ~10% of shoulder width (no neck craning).

Hold timer logic:
- Starts when both checks pass for 2 consecutive seconds.
- Pauses when either check fails for more than 2 consecutive seconds (brief wobbles are OK).
- Speaks the elapsed time at 30 s, 60 s, then every 30 s thereafter.

## Reference: shared utilities

- **`src/geometry.js`** — pure helpers: `angleAt(a, b, c)` (returns the interior angle at point `b` in radians), `distance(a, b)`, `pickCameraSide(landmarks)`.
- **`src/repCounter.js`** — generic up/down hysteresis state machine. Squat and pushup both use it; only the threshold values differ.
- **`src/smoothing.js`** — 5-frame moving average over the angle stream. Raw MediaPipe output is jittery enough to false-trigger rep transitions without smoothing.

All angle math is done in **radians** internally. Convert to degrees only at the display/threshold-comparison layer to keep the math clean.

## Feedback design

- **Rep beep.** Short 880 Hz tone (~80 ms) on each rep completion.
- **Spoken corrections.** Use SpeechSynthesis. Throttle to one correction per 3 seconds — never overlap or queue them. The user is breathing hard; clarity beats volume of feedback.
- **Visual HUD.** Big rep counter, small live form-score color bar (green/yellow/red), current angle reading in degrees for the primary measurement. Keep it readable at 6+ feet.
- **End-of-set summary.** Reps completed, average depth, count of each issue type, and a 30-second timeline strip showing form score over the set. Save to localStorage as the last session.

## File structure

```
workout-form-checker/
├── index.html
├── style.css
├── public/assets/             # Ejected Handsfree models (gitignored)
├── src/
│   ├── main.js                # Entry, state machine, wiring
│   ├── exercises/
│   │   ├── squat.js           # Pure: thresholds, score(), repPhase()
│   │   ├── pushup.js
│   │   ├── plank.js
│   │   └── index.js           # Registry { squat, pushup, plank }
│   ├── geometry.js            # Pure helpers (angle, distance, side picker)
│   ├── repCounter.js          # Generic hysteresis rep state machine
│   ├── smoothing.js           # 5-frame moving average
│   ├── camera-check.js        # Side-view verification
│   ├── feedback.js            # Audio beeps + SpeechSynthesis throttling
│   └── ui.js                  # Exercise picker, HUD, summary screen
├── scripts/eject.sh           # Copy Handsfree models from node_modules
└── README.md
```

## Gotchas

- **Smoothing or you'll double-count.** Without the 5-frame moving average on the angle stream, MediaPipe jitter will cross the rep threshold multiple times near the bottom of a rep. Smooth before passing to `repCounter`.
- **Loose clothing.** Hoodies and sweatpants drop landmark confidence. Surface a "low confidence — try tighter clothing or better lighting" banner when mean visibility of required landmarks drops below 0.6 for more than 2 seconds.
- **Mirror the preview, not the math.** `transform: scaleX(-1)` on the `<video>` element only. Landmarks should be processed in their native coordinates.
- **`pickCameraSide` returns a side.** Don't average left and right — for a side-on view, one side is occluded and its landmarks are extrapolated nonsense. Pick one side and stay with it for the duration of a set.
- **Speech permission and autoplay.** Some browsers require a user gesture before `SpeechSynthesis.speak()` will fire. Trigger one silent `speak('')` on the "Start Set" button click to unlock it for the session.
- **Frame rate variance.** Don't compute durations by counting frames. Use `Date.now()` deltas. Background tabs and slow CPUs will distort frame-based timers.
- **Privacy.** No network calls, no analytics. State this in the README.

## Coding conventions

- ES modules, native imports, no bundler.
- 2-space indent, single quotes, semicolons.
- `geometry.js`, `smoothing.js`, `repCounter.js`, and every file under `exercises/` must be pure. Run unit tests with Node's built-in `node --test` — these are exactly the modules where regressions are easy to introduce and easy to catch.
- DOM access is confined to `main.js` and `ui.js`.
- One `currentExercise` reference at the top of `main.js`. Switching exercises = swapping that reference + resetting `repCounter`.

## Out of scope for v1

- Other exercises (deadlift, lunge, overhead press). The exercise-module shape is designed to make these easy adds — but ship the three first.
- Prescribed workouts ("3 sets of 10").
- User accounts, cloud sync, leaderboards.
- Mobile / phone camera UI (different orientation handling, different viewport).
- Multi-person tracking (MediaPipe Pose is single-person anyway).

## Definition of done for v1

1. User picks an exercise, completes camera setup, and starts a set within 30 seconds of opening the app.
2. Squat and pushup rep counts are accurate to within ±1 over a set of 10 reps for a typical user in good lighting.
3. Plank hold time matches a stopwatch within 2 seconds, pauses correctly when form breaks.
4. Form corrections fire only on real issues — no more than one false positive per minute of normal-form work.
5. Audio cues are intelligible from 6 feet away with the screen out of view.
6. End-of-set summary persists to localStorage and is readable on next launch.
