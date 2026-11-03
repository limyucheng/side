import { HAWKER_CHATTER } from "./dialogue.js";

// Pre-generated neural voices are local assets: no microphone, API key or
// browser-dependent speech voices are needed during play.
export class HawkerVoices {
  constructor(onSpeaking = () => {}) {
    this.onSpeaking = onSpeaking;
    this.cache = new Map();
    this.sounds = new Set();
    this.queue = [];
    this.epoch = 0;
    this.chatterIndex = 0;
  }
  connect(context, destination) {
    this.context = context;
    this.destination = destination;
  }
  setState({ active, enabled, muted }) {
    const playing = !!(this.context && active && enabled && !muted);
    if (playing === this.playing) return;
    this.playing = playing;
    if (playing) {
      this.nextChatter = this.context.currentTime + 1.6;
      this.timer = setInterval(() => this.update(), 250);
    } else {
      clearInterval(this.timer);
      this.epoch++;
      this.queue = [];
      this.pending = false;
      for (const sound of this.sounds) this.stop(sound);
      this.current = null;
      this.onSpeaking(false);
    }
  }
  async load(path) {
    if (!this.cache.has(path))
      this.cache.set(
        path,
        fetch(path)
          .then((response) => {
            if (!response.ok) throw new Error("Voice unavailable");
            return response.arrayBuffer();
          })
          .then((data) => this.context.decodeAudioData(data))
          .catch(() => null),
      );
    return this.cache.get(path);
  }
  speak(dialogue, { orderId, pan = 0 } = {}) {
    if (!this.playing) return;
    this.queue = this.queue.filter((line) => line.orderId !== orderId);
    if (this.pendingLine?.orderId === orderId)
      this.pendingLine.cancelled = true;
    const line = {
      ...dialogue,
      orderId,
      pan,
      expires: this.context.currentTime + 4,
    };
    if (line.urgent) {
      this.queue.unshift(line);
      if (this.current?.orderId === orderId) this.stop(this.current);
    } else this.queue.push(line);
    this.queue = this.queue.slice(0, 3);
    this.update();
  }
  cancelOrder(orderId) {
    if (this.pendingLine?.orderId === orderId)
      this.pendingLine.cancelled = true;
    this.queue = this.queue.filter((line) => line.orderId !== orderId);
    if (this.current?.orderId === orderId) this.stop(this.current);
  }
  async update() {
    if (!this.playing) return;
    const epoch = this.epoch;
    if (!this.current && !this.pending && this.queue.length) {
      const line = this.queue.shift();
      if (line.expires < this.context.currentTime) return;
      this.pending = true;
      this.pendingLine = line;
      const buffer = await this.load(line.clip);
      if (epoch !== this.epoch || !this.playing) return;
      this.pending = false;
      this.pendingLine = null;
      if (
        buffer &&
        !line.cancelled &&
        line.expires >= this.context.currentTime
      ) {
        this.current = this.play(buffer, { ...line, volume: 0.76 });
        this.onSpeaking(true);
        for (const sound of this.sounds)
          if (sound.ambient)
            sound.gain.gain.setTargetAtTime(
              0.018,
              this.context.currentTime,
              0.08,
            );
      }
    }
    if (this.context.currentTime < this.nextChatter) return;
    this.nextChatter = this.context.currentTime + 2.8 + Math.random() * 1.6;
    const index = this.chatterIndex++ % HAWKER_CHATTER.length;
    const clip = HAWKER_CHATTER[index].clip;
    const buffer = await this.load(clip);
    if (buffer && this.playing && epoch === this.epoch)
      this.play(buffer, {
        ambient: true,
        pan: index % 2 ? 0.65 : -0.65,
        volume: this.current ? 0.018 : 0.09,
      });
  }
  play(buffer, { volume, pan = 0, ambient = false, orderId, urgent }) {
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    const position = this.context.createStereoPanner();
    const distance = this.context.createBiquadFilter();
    source.buffer = buffer;
    gain.gain.value = volume;
    position.pan.value = pan;
    distance.type = "lowpass";
    distance.frequency.value = ambient ? 1900 : 8500;
    source.connect(gain);
    gain.connect(distance);
    distance.connect(position);
    position.connect(this.destination);
    const sound = { source, gain, ambient, orderId, urgent };
    this.sounds.add(sound);
    source.onended = () => {
      this.sounds.delete(sound);
      source.disconnect();
      gain.disconnect();
      distance.disconnect();
      position.disconnect();
      if (this.current === sound) {
        this.current = null;
        this.onSpeaking(false);
        for (const other of this.sounds)
          if (other.ambient)
            other.gain.gain.setTargetAtTime(
              0.09,
              this.context.currentTime,
              0.2,
            );
      }
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
