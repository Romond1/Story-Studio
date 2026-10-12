// Dependency-free game feel: synthesized sound effects, gentle background music,
// and a lightweight canvas confetti system. Everything is created lazily so the
// module is safe to import in a non-browser (test) environment.

let ctx = null;
let masterGain = null;
let soundEnabled = true;

function audio() {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) {
    ctx = new AudioCtx();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.9;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function setSoundEnabled(value) {
  soundEnabled = value;
}
export function isSoundEnabled() {
  return soundEnabled;
}

// Play a single shaped tone. Slides pitch from freq -> (slideTo || freq).
function tone({ freq = 440, dur = 0.18, type = "sine", vol = 0.22, when = 0, slideTo = null, attack = 0.008 }) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// Short noise burst for crunchy / impact sounds.
function noise({ dur = 0.2, vol = 0.25, when = 0, type = "lowpass", freq = 1200 }) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const frames = Math.floor(ac.sampleRate * dur);
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  src.start(t0);
  src.stop(t0 + dur);
}

const SOUNDS = {
  eat() {
    tone({ freq: 520, slideTo: 880, dur: 0.12, type: "triangle", vol: 0.22 });
    tone({ freq: 260, slideTo: 440, dur: 0.12, type: "sine", vol: 0.12 });
  },
  move() {
    tone({ freq: 320, slideTo: 380, dur: 0.06, type: "sine", vol: 0.08 });
  },
  correct() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone({ freq: f, dur: 0.18, type: "triangle", vol: 0.2, when: i * 0.09 }));
  },
  wrong() {
    tone({ freq: 300, slideTo: 150, dur: 0.32, type: "sawtooth", vol: 0.18 });
    tone({ freq: 200, slideTo: 90, dur: 0.34, type: "square", vol: 0.1 });
  },
  crash() {
    noise({ dur: 0.4, vol: 0.35, freq: 800 });
    tone({ freq: 180, slideTo: 60, dur: 0.4, type: "sawtooth", vol: 0.22 });
  },
  crown() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone({ freq: f, dur: 0.22, type: "triangle", vol: 0.2, when: i * 0.08 }));
  },
  win() {
    const melody = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5];
    melody.forEach((f, i) => {
      tone({ freq: f, dur: 0.26, type: "triangle", vol: 0.22, when: i * 0.14 });
      tone({ freq: f / 2, dur: 0.26, type: "sine", vol: 0.1, when: i * 0.14 });
    });
  },
  congrats() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone({ freq: f, dur: 0.3, type: "triangle", vol: 0.22, when: i * 0.12 }));
  },
  cheer() {
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone({ freq: f, dur: 0.24, type: "triangle", vol: 0.18, when: i * 0.06 }));
    noise({ dur: 0.5, vol: 0.1, freq: 3500, type: "highpass" });
  },
  confetti() {
    [880, 1244, 1660].forEach((f, i) => tone({ freq: f, dur: 0.12, type: "triangle", vol: 0.12, when: i * 0.04 }));
  },
  villain() {
    tone({ freq: 170, slideTo: 70, dur: 0.5, type: "sawtooth", vol: 0.22 });
    tone({ freq: 95, slideTo: 48, dur: 0.5, type: "square", vol: 0.12 });
  },
};

// Custom uploaded samples override the synth for a given name.
const customSounds = {};
export function setCustomSound(name, url) { if (url) customSounds[name] = url; else delete customSounds[name]; }
export function clearCustomSound(name) { delete customSounds[name]; }
export function hasCustomSound(name) { return Boolean(customSounds[name]); }

export function playSound(name) {
  if (!soundEnabled) return;
  if (customSounds[name]) {
    try { const a = new Audio(customSounds[name]); a.volume = 0.9; a.play().catch(() => {}); } catch { /* ignore */ }
    return;
  }
  const fn = SOUNDS[name];
  if (fn) {
    try { fn(); } catch { /* ignore audio errors */ }
  }
}

// ---- Gentle looping background music (soft arpeggio pad, or an uploaded track) ----
let musicTimer = null;
let musicGain = null;
let musicStep = 0;
let customMusicUrl = null;
let musicAudio = null;

export function setMusicTrack(url) {
  customMusicUrl = url || null;
  // If music is already playing, swap immediately.
  if (musicAudio || musicTimer) { stopMusic(); startMusic(); }
}
export function hasMusicTrack() { return Boolean(customMusicUrl); }

export function startMusic() {
  if (customMusicUrl) {
    if (musicAudio) return;
    try {
      musicAudio = new Audio(customMusicUrl);
      musicAudio.loop = true;
      musicAudio.volume = 0.5;
      musicAudio.play().catch(() => {});
    } catch { musicAudio = null; }
    return;
  }
  const ac = audio();
  if (!ac || musicTimer) return;
  musicGain = ac.createGain();
  musicGain.gain.value = 0.12;
  musicGain.connect(masterGain);
  // Cmaj9 -> Amin7 -> Fmaj7 -> Gmaj feel, one note every 0.42s.
  const progression = [
    [261.63, 329.63, 392.0, 493.88],
    [220.0, 261.63, 329.63, 440.0],
    [174.61, 261.63, 349.23, 440.0],
    [196.0, 246.94, 392.0, 493.88],
  ];
  const tick = () => {
    const chord = progression[Math.floor(musicStep / 4) % progression.length];
    const note = chord[musicStep % 4];
    const t0 = ac.currentTime;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = note;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
    osc.connect(g);
    g.connect(musicGain);
    osc.start(t0);
    osc.stop(t0 + 0.95);
    musicStep += 1;
  };
  tick();
  musicTimer = window.setInterval(tick, 420);
}

export function stopMusic() {
  if (musicTimer) {
    window.clearInterval(musicTimer);
    musicTimer = null;
  }
  if (musicGain) {
    try { musicGain.disconnect(); } catch { /* noop */ }
    musicGain = null;
  }
  if (musicAudio) {
    try { musicAudio.pause(); } catch { /* noop */ }
    musicAudio = null;
  }
}

// ---- Canvas confetti ----
let confettiCanvas = null;
let confettiCtx = null;
let confettiParticles = [];
let confettiRaf = 0;

const DEFAULT_COLORS = ["#f94144", "#f3722c", "#f8961e", "#f9c74f", "#90be6d", "#43aa8b", "#577590", "#a855f7", "#ec4899", "#22d3ee"];

function ensureConfettiCanvas() {
  if (typeof document === "undefined") return null;
  if (!confettiCanvas) {
    confettiCanvas = document.createElement("canvas");
    confettiCanvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;";
    document.body.appendChild(confettiCanvas);
    confettiCtx = confettiCanvas.getContext("2d");
  }
  const dpr = window.devicePixelRatio || 1;
  confettiCanvas.width = window.innerWidth * dpr;
  confettiCanvas.height = window.innerHeight * dpr;
  confettiCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return confettiCtx;
}

function confettiFrame() {
  const c = confettiCtx;
  if (!c) return;
  c.clearRect(0, 0, window.innerWidth, window.innerHeight);
  confettiParticles = confettiParticles.filter((p) => p.life > 0 && p.y < window.innerHeight + 40);
  confettiParticles.forEach((p) => {
    p.vy += 0.18; // gravity
    p.vx *= 0.99;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life -= 1;
    c.save();
    c.translate(p.x, p.y);
    c.rotate(p.rot);
    c.globalAlpha = Math.max(0, Math.min(1, p.life / 40));
    c.fillStyle = p.color;
    c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    c.restore();
  });
  if (confettiParticles.length) {
    confettiRaf = window.requestAnimationFrame(confettiFrame);
  } else {
    confettiRaf = 0;
  }
}

export function burstConfetti({ count = 140, spread = 120, originX = 0.5, originY = 0.4, colors = DEFAULT_COLORS, power = 14 } = {}) {
  const c = ensureConfettiCanvas();
  if (!c) return;
  const cx = window.innerWidth * originX;
  const cy = window.innerHeight * originY;
  for (let i = 0; i < count; i += 1) {
    const angle = (-90 + (Math.random() - 0.5) * spread) * (Math.PI / 180);
    const speed = power * (0.5 + Math.random());
    confettiParticles.push({
      x: cx + (Math.random() - 0.5) * 40,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      size: 6 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 80 + Math.random() * 50,
    });
  }
  if (!confettiRaf) confettiRaf = window.requestAnimationFrame(confettiFrame);
}
