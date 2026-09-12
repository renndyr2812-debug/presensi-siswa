// Zero-Asset Web Audio Chime & Web Vibration API (Mobile UI/UX Pro Max Standard)
const AudioHaptics = {
  audioCtx: null,

  initAudio() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
  },

  // Play synthesized dual-tone pleasant chime (520Hz -> 880Hz)
  playSuccessChime() {
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.14); // A5

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.38);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.38);
    } catch (e) {
      console.warn('Audio chime skipped:', e);
    }
  },

  // Play warning / error low chime
  playErrorChime() {
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.setValueAtTime(220, now + 0.15);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {
      console.warn('Audio chime skipped:', e);
    }
  },

  // Haptic feedback patterns
  vibrateQRDetected() {
    if (navigator.vibrate) {
      navigator.vibrate([30]);
    }
  },

  vibrateSuccess() {
    if (navigator.vibrate) {
      navigator.vibrate([50, 60, 90]);
    }
  },

  vibrateError() {
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
  }
};

window.AudioHaptics = AudioHaptics;
