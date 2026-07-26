/* 音效系统：WebAudio 程序化合成，无外部音频资源 */
const AudioSys = (() => {
  let ctx = null;
  let master = null;
  let enabled = true;

  function ensure() {
    if (!enabled) return false;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { enabled = false; return false; }
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.45;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  let noiseBuf = null;
  function getNoise() {
    if (!noiseBuf) {
      const len = ctx.sampleRate * 1.2;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  // 基础音色单元 ---------------------------------------------------------
  function tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0, attack = 0.005 } = {}) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function noise(dur, { vol = 0.3, freq = 1000, q = 1, type = 'bandpass', delay = 0, slide = 0 } = {}) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = getNoise();
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.05);
  }

  // 具体音效 -------------------------------------------------------------
  const api = {
    unlock() { ensure(); },
    setEnabled(v) { enabled = v; if (v) ensure(); },
    isEnabled() { return enabled; },

    click() { tone(660, 0.07, { type: 'square', vol: 0.12 }); tone(880, 0.06, { type: 'square', vol: 0.1, delay: 0.05 }); },

    stretch() { noise(0.08, { vol: 0.05, freq: 500, q: 2 }); },

    shoot() {
      noise(0.25, { vol: 0.28, freq: 900, slide: -700, q: 0.8 });
      tone(300, 0.18, { type: 'triangle', vol: 0.2, slide: 260 });
    },

    flap() { noise(0.06, { vol: 0.08, freq: 1600, q: 3 }); },

    hit(strength = 1) {
      const v = Math.min(0.35, 0.1 + strength * 0.05);
      noise(0.09, { vol: v, freq: 300, q: 0.7, type: 'lowpass' });
      tone(90, 0.1, { type: 'sine', vol: v * 0.8, slide: -40 });
    },

    woodBreak() {
      noise(0.16, { vol: 0.3, freq: 1100, q: 1.2 });
      noise(0.1, { vol: 0.2, freq: 500, q: 1, delay: 0.03 });
      tone(180, 0.1, { type: 'triangle', vol: 0.15, slide: -80 });
    },

    iceBreak() {
      noise(0.2, { vol: 0.26, freq: 4200, q: 1.5, slide: -1500 });
      tone(2200, 0.1, { type: 'sine', vol: 0.1, slide: -600 });
      tone(3100, 0.08, { type: 'sine', vol: 0.08, delay: 0.03, slide: -900 });
    },

    stoneBreak() {
      noise(0.25, { vol: 0.32, freq: 220, q: 0.6, type: 'lowpass' });
      noise(0.14, { vol: 0.2, freq: 800, q: 1 });
      tone(70, 0.2, { type: 'sine', vol: 0.28, slide: -30 });
    },

    pigPop() {
      tone(500, 0.12, { type: 'square', vol: 0.16, slide: 350 });
      tone(260, 0.16, { type: 'triangle', vol: 0.16, slide: -140, delay: 0.05 });
      noise(0.1, { vol: 0.1, freq: 1500, q: 2, delay: 0.02 });
    },

    boom() {
      noise(0.5, { vol: 0.42, freq: 150, q: 0.4, type: 'lowpass', slide: -80 });
      noise(0.25, { vol: 0.25, freq: 900, q: 0.6, slide: -600 });
      tone(55, 0.4, { type: 'sine', vol: 0.4, slide: -25 });
    },

    ability() {
      tone(520, 0.1, { type: 'square', vol: 0.14, slide: 400 });
      tone(780, 0.12, { type: 'square', vol: 0.12, delay: 0.06, slide: 500 });
    },

    eggDrop() { tone(900, 0.15, { type: 'sine', vol: 0.15, slide: -500 }); },

    score() { tone(1200, 0.07, { type: 'sine', vol: 0.08 }); },

    win() {
      const seq = [523, 659, 784, 1047];
      seq.forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.2, delay: i * 0.13 }));
      tone(1319, 0.5, { type: 'triangle', vol: 0.22, delay: seq.length * 0.13 });
    },

    lose() {
      const seq = [392, 330, 262];
      seq.forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.18, delay: i * 0.22 }));
      tone(196, 0.7, { type: 'sawtooth', vol: 0.1, delay: 3 * 0.22 });
    },
  };

  return api;
})();
