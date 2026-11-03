import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { HawkerAmbience } from "../src/ambience.js";
import { HAWKER_CHATTER, impatientDialogue } from "../src/dialogue.js";
import { rushIntensity } from "../src/game.js";

function setup(t, intensity = 0.18) {
  const sources = [];
  const parameter = () => ({
    value: 0,
    setTargetAtTime(value) {
      this.value = value;
    },
  });
  const node = () => ({
    connect() {},
    disconnect() {},
    gain: parameter(),
    pan: parameter(),
    frequency: parameter(),
  });
  const context = {
    currentTime: 0,
    createGain: node,
    createStereoPanner: node,
    createBiquadFilter: node,
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
  const ambience = new HawkerAmbience({ random: () => 0.5 });
  ambience.connect(context, {});
  ambience.load = async (path) => ({ path, duration: 5 });
  ambience.setRush(intensity);
  ambience.setState({ active: true, enabled: true, muted: false });
  t.after(() => ambience.dispose());
  return { ambience, context, sources };
}
test("only background chatter is bundled; NPC speech has no playable asset or API", async () => {
  const root = new URL("../public/audio/voices/", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("manifest.json", root)));
  const audioFiles = (await readdir(root)).filter((file) =>
    file.endsWith(".mp3"),
  );
  assert.equal(manifest.clips.length, 8);
  assert.equal(audioFiles.length, 8);
  for (const line of HAWKER_CHATTER) {
    const clip = manifest.clips.find((c) => line.clip.endsWith(c.file));
    assert.equal(clip.text, line.text);
    assert.ok((await stat(new URL(clip.file, root))).size > 1000);
    assert.ok(clip.file.startsWith("chatter-"));
  }
  assert.equal(impatientDialogue("office", true).clip, undefined);
  assert.equal(typeof new HawkerAmbience().speak, "undefined");
});
test("peak chatter has more overlapping voices and stronger levels than opening or closing", async (t) => {
  const quiet = setup(t, rushIntensity(0));
  const busy = setup(t, rushIntensity(120));
  for (const fixture of [quiet, busy])
    for (const time of [2, 4, 6, 8]) {
      fixture.context.currentTime = time;
      await fixture.ambience.update();
    }
  assert.equal(quiet.sources.length, 1);
  assert.equal(busy.sources.length, 3);
  assert.ok(
    [...busy.ambience.sounds][0].gain.gain.value >
      [...quiet.ambience.sounds][0].gain.gain.value * 2,
  );
  busy.ambience.setRush(rushIntensity(240));
  assert.ok(
    [...busy.ambience.sounds][0].gain.gain.value < 0.05,
    "existing chatter eases down at closing",
  );
});
test("important game sounds briefly duck the background crowd, then it recovers", async (t) => {
  const { ambience, context } = setup(t, 1);
  context.currentTime = 2;
  await ambience.update();
  const sound = [...ambience.sounds][0],
    before = sound.gain.gain.value;
  ambience.duck();
  assert.ok(sound.gain.gain.value < before / 2);
  context.currentTime = 3;
  ambience.updateLevels();
  assert.equal(sound.gain.gain.value, before);
});
test("pausing stops all layers and disables playback until resumed", async (t) => {
  const { ambience, context, sources } = setup(t, 1);
  context.currentTime = 2;
  await ambience.update();
  ambience.setState({ active: false, enabled: true, muted: false });
  await Promise.resolve();
  assert.ok(sources.every((source) => source.stopped));
  assert.equal(ambience.sounds.size, 0);
  context.currentTime = 20;
  await ambience.update();
  assert.equal(sources.length, 1);
});
test("a download finishing after pause cannot start a stray background voice", async (t) => {
  const { ambience, context, sources } = setup(t);
  let resolve;
  ambience.load = () => new Promise((done) => (resolve = done));
  context.currentTime = 2;
  const pending = ambience.update();
  ambience.setState({ active: false, enabled: true, muted: false });
  resolve({});
  await pending;
  assert.equal(sources.length, 0);
});
test("the chatter toggle and master mute suppress background voices independently of music", async (t) => {
  const { ambience, context, sources } = setup(t);
  context.currentTime = 20;
  for (const state of [
    { active: true, enabled: false, muted: false },
    { active: true, enabled: true, muted: true },
  ]) {
    ambience.setState(state);
    await ambience.update();
    assert.equal(sources.length, 0);
  }
});
