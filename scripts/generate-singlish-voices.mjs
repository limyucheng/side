// Accent-directed fictional voices. --local uses Apple Silicon; otherwise the
// public model demo is used. Publish only a complete set of matching assets.
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { HAWKER_CHATTER } from "../src/dialogue.js";
import { VOICE_PROFILES } from "./voice-profiles.mjs";
const endpoint = "https://qwen-qwen3-tts.hf.space";
const model = "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign";
const stage = join(tmpdir(), "hawker-singlish-v2");
const destination = fileURLToPath(
  new URL("../public/audio/voices/", import.meta.url),
);
await mkdir(stage, { recursive: true });
const tasks = [];
for (const line of HAWKER_CHATTER) {
  const profile = line.profile;
  tasks.push({
    id: `chatter-${line.id}`,
    text: line.text,
    profile,
    instruct: VOICE_PROFILES[profile],
  });
}
for (const task of tasks) {
  task.key = createHash("sha256")
    .update(JSON.stringify({ model, ...task }))
    .digest("hex");
  task.file = `${task.id}-sg2.mp3`;
}
function run(command, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: [input ? "pipe" : "inherit", "inherit", "inherit"],
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)),
    );
    if (input) child.stdin.end(input);
  });
}
async function request(url, options) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(180000),
  });
  if (!response.ok)
    throw new Error(`${response.status}: ${await response.text()}`);
  return response;
}
const ffmpeg = process.env.HAWKER_FFMPEG || "ffmpeg";
if (process.argv.includes("--local")) {
  await run(
    process.env.HAWKER_PYTHON || "python3",
    [fileURLToPath(new URL("./render-singlish-voices.py", import.meta.url))],
    JSON.stringify({
      tasks,
      stage,
      model,
      model_path:
        process.env.HAWKER_QWEN_MODEL || "/private/tmp/hawker-qwen-sg",
      ffmpeg,
    }),
  );
} else
  for (const task of tasks) {
    const output = join(stage, task.file),
      metadata = output + ".json";
    let saved;
    try {
      saved = JSON.parse(await readFile(metadata, "utf8"));
    } catch {}
    if (saved?.key === task.key) {
      console.log(`Cached ${task.id}`);
      continue;
    }
    console.log(`Generating ${task.id}`);
    const job = await (
      await request(endpoint + "/gradio_api/call/generate_voice_design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [task.text, "English", task.instruct] }),
      })
    ).json();
    const events = await (
      await request(
        endpoint + "/gradio_api/call/generate_voice_design/" + job.event_id,
      )
    ).text();
    const complete = events.match(/event: complete\r?\ndata: (.+)/);
    if (!complete) throw new Error(`${task.id}: ${events.slice(-1500)}`);
    const result = JSON.parse(complete[1]);
    if (!result[0]?.url)
      throw new Error(`${task.id}: ${JSON.stringify(result)}`);
    const wav = join(stage, task.id + ".wav");
    await writeFile(
      wav,
      new Uint8Array(await (await request(result[0].url)).arrayBuffer()),
    );
    await run(ffmpeg, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      wav,
      "-af",
      "loudnorm=I=-19:TP=-2:LRA=7",
      "-ar",
      "24000",
      "-ac",
      "1",
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "96k",
      output,
    ]);
    await writeFile(
      metadata,
      JSON.stringify({
        ...task,
        voice: task.profile,
        model,
        runtime: "Qwen hosted demo",
      }),
    );
    console.log(`Generated ${task.id}`);
  }
const clips = [];
for (const task of tasks) {
  const { key: _, ...clip } = JSON.parse(
    await readFile(join(stage, task.file + ".json"), "utf8"),
  );
  clips.push(clip);
}
await mkdir(destination, { recursive: true });
for (const clip of clips)
  await copyFile(join(stage, clip.file), join(destination, clip.file));
await writeFile(
  join(destination, "manifest.json"),
  JSON.stringify(
    {
      generator: model,
      disclosure:
        "AI-generated fictional voices, directed for colloquial Singapore English. No real speaker was cloned.",
      clips,
    },
    null,
    2,
  ) + "\n",
);
console.log(`Published ${clips.length} accent-directed clips.`);
