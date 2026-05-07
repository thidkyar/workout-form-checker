# Workout Form Checker

A browser-based form coach that uses your webcam + Handsfree.js pose tracking to check your exercise form in real time. v1 supports **squat**, **push-up**, and **plank**.

All processing stays in the browser — no network calls, no analytics, nothing leaves your device.

## Run it locally

```sh
npm install
npm run eject     # copies handsfree.js + models into ./public
npm run serve     # serves at http://localhost:5173
```

Open `http://localhost:5173`, pick an exercise, allow webcam access when prompted, complete camera setup, then **Start set**.

## Deploy to GitHub Pages

The repo includes a workflow at [.github/workflows/deploy.yml](.github/workflows/deploy.yml) that runs the tests, ejects the Handsfree library + models, and publishes to Pages on every push to `main`. Model binaries are NOT committed — they're produced fresh in CI.

One-time setup:

1. **Create a GitHub repo** and push:
   ```sh
   git remote add origin https://github.com/<you>/workout-form-checker.git
   git push -u origin main
   ```
2. **Enable Pages with Actions as the source.** In the repo on GitHub: Settings → Pages → *Source: GitHub Actions*.
3. The workflow will run on the next push (or trigger it manually under Actions → "Deploy to GitHub Pages" → Run workflow).
4. Your site will be live at `https://<you>.github.io/<repo>/`.

### Testing on your phone

GitHub Pages serves over HTTPS, which is required for `getUserMedia`. Open the Pages URL on your phone:

- **Place the phone on the floor a few feet to your side, in landscape**, full body in frame.
- The HUD scales the rep counter / hold timer to take up most of the screen so it's readable from a few feet away.
- The app requests a screen Wake Lock during a set — your phone won't dim mid-rep.
- iOS Safari may need the first tap to unlock audio; the **Start set** button does this for you.
- Mobile-tuned UI is informally supported here but per the v1 spec is "out of scope" — the layout works in portrait and landscape on a phone, but it's not a polished native-feeling app.

## Run the tests

```sh
npm test
```

The pure modules (`geometry`, `smoothing`, `repCounter`, every exercise, `camera-check`) have unit tests under `test/`. They run with Node's built-in `node --test` — no test framework dependency.

## Camera setup

Squat, push-up, and plank all need a **side-on camera view** to measure the angles that matter. Place your phone or laptop on the floor a few feet to your side, with your full body in frame. The app verifies this before counting reps.

The user's screen is rarely in their primary view during reps, so the app speaks corrections out loud. Audio is the primary feedback channel.

## Run the tests

```sh
npm test
```

The pure modules (`geometry`, `smoothing`, `repCounter`, every exercise) have unit tests under `test/`. They run with Node's built-in `node --test` — no test framework dependency.

## File layout

```
workout-form-checker/
├── index.html
├── style.css
├── public/                    # Ejected Handsfree library + models (gitignored, built by `npm run eject`)
├── src/
│   ├── main.js                # Entry, state machine, wiring
│   ├── exercises/
│   │   ├── squat.js
│   │   ├── pushup.js
│   │   ├── plank.js
│   │   └── index.js
│   ├── geometry.js            # angleAt, distance, pickCameraSide
│   ├── repCounter.js          # Generic up/down hysteresis
│   ├── smoothing.js           # 5-frame moving average
│   ├── camera-check.js        # Side-view verification
│   ├── feedback.js            # Audio beeps + SpeechSynthesis throttling
│   └── ui.js                  # HUD, summary screen
├── scripts/eject.sh
├── .github/workflows/deploy.yml  # Auto-deploys to GitHub Pages on push to main
└── test/
```

## Privacy

No network calls, no analytics, no accounts. The webcam stream is processed on your device and never sent anywhere. Session summaries are stored in your browser's `localStorage` and stay there.
