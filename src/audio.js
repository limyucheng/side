import { HawkerVoices } from "./voices.js";

// Original eight-bar café groove. All instruments are synthesized locally;
// no audio downloads, external playback service, or autoplay are needed.
const CHORDS = [
  { bass: 36, keys: [60, 64, 67, 71] },
  { bass: 36, keys: [60, 64, 67, 71] },
  { bass: 33, keys: [57, 60, 64, 67] },
  { bass: 33, keys: [57, 60, 64, 67] },
  { bass: 38, keys: [60, 62, 65, 69] },
  { bass: 38, keys: [60, 62, 65, 69] },
  { bass: 31, keys: [59, 64, 65, 69] },
  { bass: 31, keys: [59, 64, 65, 69] },
];
const MELODY = [
  { 2: 76, 6: 79, 10: 81, 14: 79 },
  { 2: 76, 6: 74, 10: 72 },
  { 0: 72, 4: 76, 7: 79, 10: 76, 14: 74 },
  { 2: 72, 6: 71, 10: 69 },
  { 2: 74, 6: 77, 10: 81, 14: 79 },
  { 2: 77, 6: 76, 10: 74 },
  { 0: 71, 4: 74, 7: 76, 10: 74, 14: 71 },
  { 2: 69, 6: 71, 10: 72 },
];
const STEP = 60 / 96 / 4;

export class GameAudio {
  constructor({ muted = false, music = true, voices = true } = {}) {
    this.muted = muted;
    this.musicEnabled = music;
    this.active = false;
    this.buffers = new Map();
    this.voices = new Set();
    this.step = 0;
    this.timer = null;
    this.disposed = false;
    this.cueVoices = new Set();
    this.lastCues = new Map();
    this.voicesEnabled = voices;
    this.speech = new HawkerVoices((speaking) => {
      this.speaking = speaking;
      if (
        this.music &&
        this.active &&
        this.musicEnabled &&
        !this.muted &&
        !this.disposed
      )
        this.fade(this.music, speaking ? 0.075 : 0.24);
    });
  }
  unlock() {
    if (this.disposed) return;
    try {
      if (!this.context) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        this.context = new Audio();
        this.master = this.context.createGain();
        this.master.gain.value = this.muted ? 0 : 0.8;
        this.master.connect(this.context.destination);
        this.speech.connect(this.context, this.master);
        this.music = this.context.createGain();
        this.music.gain.value = 0;
        const warmth = this.context.createBiquadFilter();
        warmth.type = "lowpass";
        warmth.frequency.value = 4200;
        warmth.connect(this.music);
        this.music.connect(this.master);
        this.instrumentBus = warmth;
        const room = this.context.createDelay(0.5),
          feedback = this.context.createGain();
        room.delayTime.value = 0.19;
        feedback.gain.value = 0.1;
        warmth.connect(room);
        room.connect(feedback);
        feedback.connect(room);
        feedback.connect(this.music);
      }
      if (this.context.state === "suspended")
        this.context.resume().catch(() => {});
      this.sync();
    } catch {
      /* Silent play still works on browsers without Web Audio. */
    }
  }
  setMuted(value) {
    this.muted = value;
    if (this.master) this.fade(this.master, value ? 0 : 0.8);
    this.sync();
  }
  setMusicEnabled(value) {
    this.musicEnabled = value;
    this.sync();
  }
  setVoicesEnabled(value) {
    this.voicesEnabled = value;
    this.sync();
  }
  speak(dialogue, options) {
    this.speech.speak(dialogue, options);
  }
  cancelOrder(orderId) {
    this.speech.cancelOrder(orderId);
  }
  setActive(value) {
    if (this.active && !value) {
      for (const voice of this.cueVoices) voice.stop();
      clearTimeout(this.duckTimer);
    }
    this.active = value;
    this.sync();
  }
  fade(node, value) {
    const now = this.context.currentTime;
    node.gain.cancelScheduledValues(now);
    node.gain.setTargetAtTime(value, now, 0.045);
  }
  sync() {
    if (!this.context || this.disposed) return;
    this.speech.setState({
      active: this.active,
      enabled: this.voicesEnabled,
      muted: this.muted,
    });
    const playing = this.active && this.musicEnabled && !this.muted;
    if (playing && this.timer === null) {
      this.nextTime = this.context.currentTime + 0.06;
      this.fade(this.music, this.speaking ? 0.075 : 0.24);
      this.schedule();
      this.timer = setInterval(() => this.schedule(), 70);
    } else if (!playing && this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
      this.fade(this.music, 0);
      for (const voice of this.voices) {
        // Fade tails naturally, but cancel queued notes so resume cannot stack loops.
        if (voice.when > this.context.currentTime) voice.source.stop();
      }
      this.step = Math.ceil(this.step / 16) * 16;
    }
  }
  schedule() {
    const now = this.context.currentTime;
    if (this.nextTime < now - 0.1) this.nextTime = now + 0.03;
    while (this.nextTime < now + 0.18) {
      const bar = Math.floor(this.step / 16) % CHORDS.length,
        beat = this.step % 16;
      const chord = CHORDS[bar],
        when = this.nextTime + (beat % 2 ? 0.012 : 0);
      if ([0, 6, 8, 14].includes(beat))
        this.note(
          "bass",
          chord.bass + (beat % 8 === 6 ? 7 : 0),
          when,
          0.19,
          -0.12,
        );
      if ([0, 3, 6, 10, 14].includes(beat))
        chord.keys.forEach((note, i) =>
          this.note(
            "keys",
            note,
            when + i * 0.009,
            beat === 0 ? 0.065 : 0.047,
            (i - 1.5) * 0.12,
          ),
        );
      if (MELODY[bar][beat])
        this.note("mallet", MELODY[bar][beat], when, 0.11, 0.16);
      if (beat % 2 === 0)
        this.note("brush", 0, when, beat % 4 === 2 ? 0.032 : 0.021, 0.32);
      if ([0, 8].includes(beat)) this.note("kick", 0, when, 0.17, 0);
      if ([4, 12].includes(beat)) this.note("rim", 0, when, 0.05, -0.25);
      this.nextTime += STEP;
      this.step++;
    }
  }
  buffer(instrument, midi) {
    const key = `${instrument}:${midi}`;
    if (this.buffers.has(key)) return this.buffers.get(key);
    const rate = 22050,
      duration =
        instrument === "keys"
          ? 1.7
          : instrument === "bass"
            ? 0.55
            : instrument === "mallet"
              ? 1.05
              : 0.22;
    const buffer = this.context.createBuffer(
        1,
        Math.ceil(rate * duration),
        rate,
      ),
      data = buffer.getChannelData(0);
    const hz = 440 * 2 ** ((midi - 69) / 12);
    let seed = 5489;
    for (let i = 0; i < data.length; i++) {
      const t = i / rate,
        phase = 2 * Math.PI * hz * t;
      const attack = Math.min(1, t / 0.005),
        release = Math.min(1, (duration - t) / 0.05);
      let value;
      if (instrument === "keys")
        value =
          (Math.sin(phase) +
            0.22 * Math.sin(phase * 2.003) * Math.exp(-t * 5) +
            0.06 * Math.sin(phase * 3)) *
          Math.exp(-t * 3.4) *
          0.7;
      else if (instrument === "bass")
        value =
          (Math.sin(phase) + 0.17 * Math.sin(phase * 2)) * Math.exp(-t * 6);
      else if (instrument === "mallet")
        value =
          (Math.sin(phase) * Math.exp(-t * 5) +
            0.23 * Math.sin(phase * 4) * Math.exp(-t * 22)) *
          0.7;
      else if (instrument === "kick")
        value =
          Math.sin(2 * Math.PI * (46 * t + 4 * (1 - Math.exp(-t * 28)))) *
          Math.exp(-t * 24);
      else if (instrument === "rim")
        value =
          (Math.sin(2 * Math.PI * 920 * t) +
            0.4 * Math.sin(2 * Math.PI * 1430 * t)) *
          Math.exp(-t * 90);
      else {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        value = (seed / 2147483648 - 1) * Math.exp(-t * 35) * 0.55;
      }
      data[i] = value * attack * release;
    }
    this.buffers.set(key, buffer);
    return buffer;
  }
  note(instrument, midi, when, volume, pan) {
    const source = this.context.createBufferSource(),
      gain = this.context.createGain(),
      position = this.context.createStereoPanner();
    source.buffer = this.buffer(instrument, midi);
    gain.gain.value = volume;
    position.pan.value = pan;
    source.connect(gain);
    gain.connect(position);
    position.connect(this.instrumentBus);
    const voice = { source, when };
    this.voices.add(voice);
    source.onended = () => {
      this.voices.delete(voice);
      source.disconnect();
      gain.disconnect();
      position.disconnect();
    };
    source.start(when);
  }
  effect(success = false) {
    if (this.muted || this.disposed) return;
    this.unlock();
    if (!this.context) return;
    const osc = this.context.createOscillator(),
      gain = this.context.createGain(),
      now = this.context.currentTime;
    osc.connect(gain);
    gain.connect(this.master);
    osc.frequency.setValueAtTime(success ? 740 : 360, now);
    osc.frequency.exponentialRampToValueAtTime(
      success ? 1100 : 450,
      now + 0.12,
    );
    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    osc.start();
    osc.stop(now + 0.23);
  }
  cue(type, { streak = 1, urgent = false } = {}) {
    if (this.muted || this.disposed) return;
    this.unlock();
    if (!this.context) return;
    const now = this.context.currentTime;
    const cooldown =
      type === "customer-warning"
        ? 0.65
        : type === "cook-warning"
          ? 0.3
          : type === "serve-rejected"
            ? 0.15
            : 0.08;
    if (now - (this.lastCues.get(type) ?? -100) < cooldown) return;
    this.lastCues.set(type, now);
    const tone = (
      hz,
      delay,
      duration = 0.13,
      volume = 0.045,
      end = hz,
      shape = "sine",
    ) => {
      const osc = this.context.createOscillator(),
        gain = this.context.createGain(),
        at = now + delay;
      osc.type = shape;
      osc.frequency.setValueAtTime(hz, at);
      osc.frequency.exponentialRampToValueAtTime(end, at + duration);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(volume, at + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      osc.connect(gain);
      gain.connect(this.master);
      this.cueVoices.add(osc);
      osc.onended = () => {
        this.cueVoices.delete(osc);
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(at);
      osc.stop(at + duration + 0.015);
    };
    if (type === "cook-ready") {
      tone(880, 0);
      tone(1175, 0.12, 0.18);
    } else if (type === "cook-warning") {
      tone(1400, 0, 0.065, 0.04, 1100, "triangle");
      tone(1400, 0.11, 0.065, 0.04, 1100, "triangle");
    } else if (type === "cook-burnt") {
      tone(230, 0, 0.21, 0.045, 145, "triangle");
    } else if (type === "customer-warning") {
      tone(660, 0, 0.14, 0.045);
      tone(523, 0.17, 0.16, 0.045);
      if (urgent) tone(660, 0.36, 0.11, 0.045);
    } else if (type === "serve-rejected") {
      tone(230, 0, 0.13, 0.065, 150, "triangle");
      tone(150, 0.12, 0.17, 0.05, 105, "triangle");
    } else if (type === "customer-left") {
      tone(392, 0, 0.22);
      tone(294, 0.17, 0.23);
      tone(196, 0.34, 0.3);
    } else if (type === "prep-chop") {
      tone(165, 0, 0.065, 0.065, 90, "triangle");
      tone(1100, 0.01, 0.035, 0.018, 600, "triangle");
    } else if (type === "recipe-step") {
      tone(480, 0, 0.09, 0.028, 600);
      tone(720, 0.075, 0.12, 0.022);
    } else if (type === "dish-served" || type === "order-served") {
      const pitch = 2 ** (Math.min(Math.max(0, streak - 1), 6) / 12);
      tone(1318 * pitch, 0, 0.1, 0.045);
      tone(1760 * pitch, 0.075, 0.18, 0.045);
      if (type === "order-served") {
        [659, 784, 988, 1318].forEach((hz, i) =>
          tone(hz * pitch, 0.18 + i * 0.07, 0.22, 0.04),
        );
        [659, 988, 1318].forEach((hz) => tone(hz * pitch, 0.48, 0.35, 0.024));
      }
    }
    // Keep the music behind important game information, rather than adding volume.
    clearTimeout(this.duckTimer);
    if (this.active && this.musicEnabled) {
      this.fade(this.music, 0.09);
      this.duckTimer = setTimeout(() => {
        if (this.active && this.musicEnabled && !this.muted && !this.disposed)
          this.fade(this.music, this.speaking ? 0.075 : 0.24);
      }, 850);
    }
  }
  dispose() {
    this.speech.dispose();
    this.disposed = true;
    clearInterval(this.timer);
    clearTimeout(this.duckTimer);
    for (const voice of this.cueVoices) voice.stop();
    this.timer = null;
    for (const { source } of this.voices) source.stop();
    this.buffers.clear();
    this.context?.close().catch(() => {});
  }
}
