// Audio + speech feedback. Beeps via Web Audio API, corrections via
// SpeechSynthesis. Spoken corrections are throttled to one per 3 s and
// never queued — clarity beats volume when the user is breathing hard.

const ISSUE_PHRASES = {
  'knees-forward': "Don't let your knees go past your toes",
  'asymmetry': 'Even out your sides',
  'shallow-depth': 'Go deeper',
  'hip-sag': "Don't let your hips sag",
  'hip-pike': 'Lower your hips',
  'neck-craning': 'Keep your neck neutral',
  'low-confidence': 'Move into the frame',
};

export function createFeedback({
  speakIntervalMs = 3000,
  now = () => Date.now(),
} = {}) {
  let audioCtx = null;
  let lastSpokeAt = 0;
  let unlocked = false;

  function getAudio() {
    if (!audioCtx) {
      const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Ctor) return null;
      audioCtx = new Ctor();
    }
    return audioCtx;
  }

  function tone(freq, durMs, gain = 0.15) {
    const ctx = getAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g).connect(ctx.destination);
    const t0 = ctx.currentTime;
    osc.start(t0);
    osc.stop(t0 + durMs / 1000);
  }

  return {
    // Trigger once on a user gesture (Start Set click) to satisfy autoplay
    // and SpeechSynthesis-must-follow-gesture rules.
    unlockSpeech() {
      if (unlocked) return;
      unlocked = true;
      const synth = globalThis.speechSynthesis;
      if (synth) {
        const u = new SpeechSynthesisUtterance('');
        u.volume = 0;
        try { synth.speak(u); } catch (_) {}
      }
      // also resume audio context if it was created suspended
      const ctx = getAudio();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume?.();
      }
    },

    repBeep() {
      tone(880, 80);
    },

    correctionTone() {
      tone(220, 120, 0.1);
    },

    holdMilestoneBeep() {
      tone(660, 120, 0.12);
    },

    speak(text) {
      if (!text) return;
      const t = now();
      if (t - lastSpokeAt < speakIntervalMs) return;
      const synth = globalThis.speechSynthesis;
      if (!synth) return;
      // Never queue — cancel anything in flight.
      try { synth.cancel(); } catch (_) {}
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      u.pitch = 1.0;
      try { synth.speak(u); } catch (_) {}
      lastSpokeAt = t;
    },

    speakIssue(code) {
      const phrase = ISSUE_PHRASES[code];
      if (phrase) this.speak(phrase);
    },

    speakHoldTime(seconds) {
      this.speak(`${seconds} seconds`);
    },
  };
}

export { ISSUE_PHRASES };
