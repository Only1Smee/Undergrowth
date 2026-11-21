'use strict';
/* =========================================================
   UNDERGROWTH - synthesised sound (no audio files)
   ========================================================= */
const Sfx = {
  ctx: null, master: null, sfxBus: null, ambBus: null, noiseBuf: null, timer: null, drumAcc: 0,
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = 0.85; this.master.connect(c.destination);
    const comp = c.createDynamicsCompressor(); comp.connect(this.master);
    this.sfxBus = c.createGain(); this.sfxBus.connect(comp);
    this.ambBus = c.createGain(); this.ambBus.connect(comp);
    const n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = b;
    // constant beds: insects/wind and rain
    const bed = (freq, q, type) => { const s = c.createBufferSource(); s.buffer = b; s.loop = true; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(this.ambBus); s.start(); return { g, f }; };
    this.insects = bed(4200, 6, 'bandpass'); this.wind = bed(380, 0.6, 'lowpass'); this.rainBed = bed(1800, 0.4, 'highpass');
    this.apply();
    this.timer = setInterval(() => this.tick(), 120);
  },
  apply() {
    if (!this.ctx) return; const s = Game.settings || { sfx: true, music: true };
    this.sfxBus.gain.value = s.sfx ? 1 : 0;
    this.ambBus.gain.setTargetAtTime(s.music ? 0.7 : 0, this.ctx.currentTime, 0.3);
  },
  ambient(on) { this.ambOn = on; },
  rain(on) { this.raining = on; },
  tone(f, dur, type, vol, t0, slide, bus) {
    const c = this.ctx; if (!c) return; t0 = t0 || c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(bus || this.sfxBus); o.start(t0); o.stop(t0 + dur + 0.05);
  },
  noise(dur, vol, freq, q, t0, type, bus) {
    const c = this.ctx; if (!c) return; t0 = t0 || c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq || 2000; f.Q.value = q || 0.7;
    const g = c.createGain(); g.gain.setValueAtTime(vol || 0.3, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(bus || this.sfxBus); s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
  },
  play(name, v) {
    const c = this.ctx; if (!c) return; const t = c.currentTime; v = v === undefined ? 1 : v;
    switch (name) {
      case 'click': this.tone(900, 0.05, 'square', 0.04 * v); break;
      case 'step': this.noise(0.07, 0.05 * v, 500 + Math.random() * 300, 1); break;
      case 'splash': this.noise(0.25, 0.12 * v, 1200, 0.8, t, 'bandpass'); break;
      case 'pick': this.tone(520, 0.06, 'triangle', 0.12 * v); this.tone(780, 0.08, 'triangle', 0.1 * v, t + 0.05); break;
      case 'rustle': this.noise(0.3, 0.14 * v, 3000, 0.6, t, 'highpass'); break;
      case 'open': this.noise(0.18, 0.14, 700, 1.4, t, 'bandpass'); this.tone(180, 0.15, 'triangle', 0.1); break;
      case 'craft': for (let i = 0; i < 3; i++) this.noise(0.06, 0.2, 1500, 2, t + i * 0.09, 'bandpass'); this.tone(660, 0.18, 'triangle', 0.1, t + 0.28); break;
      case 'equip': this.noise(0.08, 0.12, 2200, 1, t, 'bandpass'); break;
      case 'swing': this.noise(0.18, 0.12 * v, 900, 0.8, t, 'bandpass'); break;
      case 'hit': this.noise(0.1, 0.3 * v, 600, 1); this.tone(110, 0.12, 'square', 0.12 * v, t, 60); break;
      case 'chop': this.noise(0.09, 0.3 * v, 900, 3, t, 'bandpass'); this.tone(220, 0.08, 'triangle', 0.12 * v, t, 140); break;
      case 'fall': this.noise(1.2, 0.35, 300, 0.7); this.tone(70, 0.9, 'sine', 0.3, t + 0.3, 40); break;
      case 'break': this.noise(0.3, 0.3, 1800, 1, t, 'bandpass'); break;
      case 'hurt': this.noise(0.2, 0.25, 400, 1); this.tone(180, 0.2, 'sawtooth', 0.12, t, 90); break;
      case 'eat': for (let i = 0; i < 3; i++) this.noise(0.07, 0.15, 900, 2, t + i * 0.13, 'bandpass'); break;
      case 'drink': for (let i = 0; i < 3; i++) this.tone(300 + i * 40, 0.09, 'sine', 0.14, t + i * 0.14, 500); break;
      case 'heal': this.tone(440, 0.2, 'sine', 0.12); this.tone(660, 0.3, 'sine', 0.1, t + 0.12); break;
      case 'fuel': this.noise(0.6, 0.25, 900, 0.6); this.noise(0.3, 0.15, 3000, 1, t + 0.1, 'highpass'); break;
      case 'sizzle': this.noise(1.0, 0.18, 5000, 0.8, t, 'highpass'); break;
      case 'upgrade': [392, 523, 659].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.12, t + i * 0.1)); this.noise(0.8, 0.2, 700); break;
      case 'douse': this.noise(1.2, 0.2, 2500, 0.5, t, 'highpass'); break;
      case 'place': this.noise(0.12, 0.2, 500, 1); this.tone(150, 0.15, 'triangle', 0.15); break;
      case 'build': this.noise(0.1, 0.3, 700, 2, t, 'bandpass'); this.noise(0.1, 0.3, 700, 2, t + 0.14, 'bandpass'); break;
      case 'deny': this.tone(160, 0.15, 'square', 0.08); break;
      case 'page': this.noise(0.25, 0.12, 4000, 0.6, t, 'highpass'); this.tone(523, 0.5, 'sine', 0.08, t + 0.1); break;
      case 'part': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.1, t + i * 0.08)); break;
      case 'rescue': [392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.6, 'sine', 0.12, t + i * 0.15)); break;
      case 'radio': this.noise(1.5, 0.15, 2500, 4, t, 'bandpass'); [440, 554, 659].forEach((f, i) => this.tone(f, 0.25, 'square', 0.04, t + 1 + i * 0.15)); break;
      case 'bow': this.tone(260, 0.15, 'triangle', 0.15 * v, t, 120); this.noise(0.15, 0.1 * v, 2500, 1, t, 'highpass'); break;
      case 'flare': this.noise(2.5, 0.2, 3500, 0.6, t, 'highpass'); this.tone(90, 0.4, 'sawtooth', 0.1); break;
      case 'trap': this.noise(0.15, 0.35, 900, 2, t, 'bandpass'); this.tone(140, 0.2, 'square', 0.15, t, 70); break;
      case 'grunt': this.tone(110 + Math.random() * 30, 0.25, 'sawtooth', 0.12 * v, t, 70); break;
      case 'growl': this.tone(70, 0.8, 'sawtooth', 0.18, t, 55); this.noise(0.8, 0.12, 300, 2, t, 'bandpass'); break;
      case 'hiss': this.noise(0.6, 0.18, 6000, 1, t, 'highpass'); break;
      case 'shout': this.tone(240 + Math.random() * 60, 0.3, 'sawtooth', 0.08, t, 320); this.tone(300, 0.25, 'sawtooth', 0.06, t + 0.25, 200); break;
      case 'die': this.tone(220, 0.6, 'sawtooth', 0.12, t, 80); break;
      case 'animaldie': this.tone(160, 0.5, 'sawtooth', 0.12, t, 60); break;
      case 'shriek': this.tone(1400, 0.9, 'sawtooth', 0.12, t, 600); this.tone(1900, 0.7, 'square', 0.05, t + 0.05, 900); this.noise(0.9, 0.18, 3000, 3, t, 'bandpass'); break;
      case 'beat': this.tone(55, 0.12, 'sine', 0.4); this.tone(50, 0.12, 'sine', 0.3, t + 0.17); break;
      case 'dusk': [196, 185, 147].forEach((f, i) => this.tone(f, 1.6, 'sine', 0.12, t + i * 0.6)); break;
      case 'dawn': [262, 330, 392, 523].forEach((f, i) => this.tone(f, 1.2, 'sine', 0.08, t + i * 0.3)); break;
      case 'death': this.tone(110, 2, 'sawtooth', 0.15, t, 40); this.noise(2, 0.15, 200); break;
      case 'heli': for (let i = 0; i < 30; i++) this.noise(0.08, 0.18, 200, 1, t + i * 0.11); break;
      case 'win': [262, 330, 392, 523, 659, 784].forEach((f, i) => this.tone(f, 1.0, 'triangle', 0.1, t + i * 0.18)); break;
    }
  },
  drums(dt) {
    if (!this.ctx) return; this.drumAcc -= dt;
    if (this.drumAcc <= 0) { this.drumAcc = 0.6; const t = this.ctx.currentTime; this.tone(80, 0.25, 'sine', 0.22, t, 50); this.tone(80, 0.18, 'sine', 0.14, t + 0.3, 50); this.noise(0.08, 0.06, 900, 2, t + 0.45, 'bandpass'); }
  },
  tick() {
    const c = this.ctx; if (!c) return; const t = c.currentTime;
    const playing = Game.mode === 'play' && !Game.paused;
    const dk = playing ? Game.darkness() : 0.2, rain = playing && Game.S && Game.S.rain > 0;
    this.insects.g.gain.setTargetAtTime(playing ? (dk > 0.5 ? 0.012 : 0.02) : 0.01, t, 0.5);
    this.insects.f.frequency.setTargetAtTime(dk > 0.5 ? 5200 : 3800, t, 1);
    this.wind.g.gain.setTargetAtTime(playing ? 0.05 + dk * 0.04 : 0.04, t, 0.8);
    this.rainBed.g.gain.setTargetAtTime(rain ? 0.12 : 0, t, 1.2);
    if (!playing) return;
    if (dk < 0.5 && Math.random() < 0.08) { const f = 1800 + Math.random() * 1600; for (let i = 0; i < 2 + (Math.random() * 3 | 0); i++) this.tone(f + Math.random() * 300, 0.07, 'sine', 0.025, t + i * 0.1, f * 1.3, this.ambBus); }
    if (dk < 0.5 && Math.random() < 0.012) this.tone(420, 0.5, 'sine', 0.03, t, 300, this.ambBus);
    if (dk > 0.5 && Math.random() < 0.3) for (let i = 0; i < 3; i++) this.tone(4300 + Math.random() * 200, 0.03, 'square', 0.008, t + i * 0.05, null, this.ambBus);
    if (dk > 0.5 && Math.random() < 0.01) this.tone(320, 0.9, 'sine', 0.02, t, 250, this.ambBus);
    if (dk > 0.6 && Math.random() < 0.006) { this.tone(65, 4, 'sine', 0.05, t, 50, this.ambBus); }
  }
};
