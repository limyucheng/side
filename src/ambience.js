import { HAWKER_CHATTER } from "./dialogue.js";

export function crowdMix(intensity) {
  const level = Math.max(0, Math.min(1, intensity));
  return {
    gap: 7.5 - level * 5.5,
    volume: 0.025 + level * 0.07,
    layers: level > 0.7 ? 3 : level > 0.4 ? 2 : 1,
    cutoff: 1500 + level * 1000,
  };
}

// Background voices only. NPC dialogue has no audio playback path.
export class HawkerAmbience {
  constructor({ random = Math.random } = {}) {
    this.random = random;
    this.intensity = 0.18;
    this.cache = new Map();
    this.sounds = new Set();
    this.epoch = 0;
    this.chatterIndex = 0;
  }
  connect(context, destination) {
    this.context = context;
    this.destination = destination;
  }
  setRush(intensity) {
    this.intensity = Math.max(0, Math.min(1, intensity));
    this.updateLevels();
  }
  updateLevels() {
    if (!this.context) return;
    const mix = crowdMix(this.intensity);
    const duck = this.context.currentTime < (this.duckUntil || 0) ? 0.3 : 1;
    for (const sound of this.sounds) {
      sound.gain.gain.setTargetAtTime(
        mix.volume * duck,
        this.context.currentTime,
        0.3,
      );
      sound.distance.frequency.setTargetAtTime(
        mix.cutoff,
        this.context.currentTime,
        0.3,
      );
    }
  }
  duck(seconds = 0.85) {
    if (!this.context) return;
    this.duckUntil = this.context.currentTime + seconds;
    this.updateLevels();
  }
  setState({ active, enabled, muted }) {
    const playing = !!(this.context && active && enabled && !muted);
    if (playing === this.playing) return;
    this.playing = playing;
    if (playing) {
      this.nextChatter = this.context.currentTime + 1.3;
      this.timer = setInterval(() => this.update(), 250);
    } else {
      clearInterval(this.timer);
      this.epoch++;
      for (const sound of this.sounds) this.stop(sound);
    }
  }
  async load(path) {
    if (!this.cache.has(path))
      this.cache.set(
        path,
        fetch(path)
          .then((response) => {
            if (!response.ok) throw new Error("Chatter unavailable");
            return response.arrayBuffer();
          })
          .then((data) => this.context.decodeAudioData(data))
          .catch(() => null),
      );
    return this.cache.get(path);
  }
  async update() {
    if (!this.playing) return;
    this.updateLevels();
    const mix = crowdMix(this.intensity);
    if (
      this.context.currentTime < this.nextChatter ||
      this.sounds.size >= mix.layers
    )
      return;
    this.nextChatter =
      this.context.currentTime + mix.gap * (0.9 + this.random() * 0.2);
    const epoch = this.epoch;
    const index = this.chatterIndex++ % HAWKER_CHATTER.length;
    const buffer = await this.load(HAWKER_CHATTER[index].clip);
    if (
      !buffer ||
      !this.playing ||
      epoch !== this.epoch ||
      this.sounds.size >= crowdMix(this.intensity).layers
    )
      return;
    this.play(buffer, index % 2 ? 0.65 : -0.65);
  }
  play(buffer, pan) {
    const source = this.context.createBufferSource(),
      gain = this.context.createGain();
    const position = this.context.createStereoPanner(),
      distance = this.context.createBiquadFilter();
    const mix = crowdMix(this.intensity);
    source.buffer = buffer;
    gain.gain.value = mix.volume;
    position.pan.value = pan;
    distance.type = "lowpass";
    distance.frequency.value = mix.cutoff;
    source.connect(gain);
    gain.connect(distance);
    distance.connect(position);
    position.connect(this.destination);
    const sound = { source, gain, distance };
    this.sounds.add(sound);
    this.updateLevels();
    source.onended = () => {
      this.sounds.delete(sound);
      source.disconnect();
      gain.disconnect();
      position.disconnect();
      distance.disconnect();
    };
    source.start();
    return sound;
  }
  stop(sound) {
    sound.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.012);
    try {
      sound.source.stop(this.context.currentTime + 0.06);
    } catch {
      /* Already ended. */
    }
  }
  dispose() {
    this.setState({ active: false, enabled: false, muted: true });
    this.cache.clear();
  }
}
