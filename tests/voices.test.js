import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { HawkerVoices } from "../src/voices.js";
import {
  COMPLAINTS,
  HAWKER_CHATTER,
  impatientDialogue,
} from "../src/dialogue.js";

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
function setup(t) {
  const sources = [],
    speaking = [];
  const node = () => ({
    connect() {},
    disconnect() {},
    gain: {
      value: 0,
      setTargetAtTime(value) {
        this.value = value;
      },
    },
    pan: {},
    frequency: {},
  });
  const context = {
    currentTime: 0,
    createGain: node,
    createBiquadFilter: node,
    createStereoPanner: node,
    createBufferSource() {
      const source = {
        ...node(),
        start() {
          this.started = true;
        },
        stop() {
          this.stopped = true;
          queueMicrotask(() => this.onended?.());
        },
      };
      sources.push(source);
      return source;
    },
  };
  const voices = new HawkerVoices((value) => speaking.push(value));
  voices.connect(context, {});
  voices.load = async (path) => ({ path });
  voices.setState({ active: true, enabled: true, muted: false });
  t.after(() => voices.dispose());
  return { voices, context, sources, speaking };
}
const line = (urgent = false) => impatientDialogue("office", urgent);
test("voice assets cover every bubble and background call, with matching transcripts", async () => {
  const root = new URL("../public/audio/voices/", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("manifest.json", root)));
  assert.equal(manifest.clips.length, 20);
  for (const clip of manifest.clips)
    assert.ok((await stat(new URL(clip.file, root))).size > 1000);
  for (const [speaker, phases] of Object.entries(COMPLAINTS))
    for (const [phase, texts] of Object.entries(phases))
      texts.forEach((text, index) => {
        const dialogue = impatientDialogue(
          speaker,
          phase === "critical",
          index,
        );
        assert.equal(
          manifest.clips.find((c) => dialogue.clip.endsWith(c.file)).text,
          text,
        );
      });
  for (const chatter of HAWKER_CHATTER)
    assert.ok(
      manifest.clips.some(
        (c) => chatter.clip.endsWith(c.file) && c.text === chatter.text,
      ),
    );
});
test("pausing stops dialogue and crowd clips and clears queued lines", async (t) => {
  const { voices, context, sources } = setup(t);
  voices.speak(line(), { orderId: 1 });
  await flush();
  context.currentTime = 2;
  await voices.update();
  assert.equal(sources.length, 2);
  voices.speak(line(), { orderId: 2 });
  voices.setState({ active: false, enabled: true, muted: false });
  await flush();
  assert.ok(sources.every((source) => source.stopped));
  assert.equal(voices.queue.length, 0);
  assert.equal(voices.current, null);
});
test("an audio download finishing after pause cannot begin playback", async (t) => {
  const { voices, sources } = setup(t);
  let resolve;
  voices.load = () =>
    new Promise((done) => {
      resolve = done;
    });
  voices.speak(line(), { orderId: 1 });
  voices.setState({ active: false, enabled: true, muted: false });
  resolve({});
  await flush();
  assert.equal(sources.length, 0);
});
test("serving or losing a customer cancels their pending voice before it starts", async (t) => {
  const { voices, sources } = setup(t);
  let resolve;
  voices.load = () =>
    new Promise((done) => {
      resolve = done;
    });
  voices.speak(line(), { orderId: 1 });
  voices.cancelOrder(1);
  resolve({});
  await flush();
  assert.equal(sources.length, 0);
});
test("urgent speech replaces that customer's earlier line and voices never stack", async (t) => {
  const { voices, sources } = setup(t);
  voices.speak(line(), { orderId: 1 });
  await flush();
  voices.speak(line(), { orderId: 2 });
  await flush();
  assert.equal(sources.length, 1);
  voices.speak(line(true), { orderId: 1 });
  await flush();
  assert.equal(sources[0].stopped, true);
  await voices.update();
  assert.equal(sources.length, 2);
  assert.ok(sources[1].buffer.path.includes("critical"));
});
test("voice toggle and master mute stop audio and suppress further speech", async (t) => {
  const { voices, sources } = setup(t);
  for (const state of [
    { active: true, enabled: false, muted: false },
    { active: true, enabled: true, muted: true },
  ]) {
    voices.setState(state);
    voices.speak(line(), { orderId: 1 });
    await voices.update();
    assert.equal(sources.length, 0);
  }
});
