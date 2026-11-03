"""Local Apple Silicon renderer; invoked by generate-singlish-voices.mjs --local.
Temporary tools: pip install mlx-audio imageio-ffmpeg. Model weights stay outside
this repository. Only the finished small MP3s are included in the game.
"""
import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path

job = json.load(sys.stdin)
import mlx.core as mx
import numpy as np
import miniaudio
from mlx_audio.tts.utils import load_model
from mlx_audio.audio_io import write as audio_write

mx.set_cache_limit(128 * 1024 * 1024)
mx.set_memory_limit(4 * 1024 * 1024 * 1024)
model = None
for task in job['tasks']:
    output = Path(job['stage']) / task['file']
    metadata = Path(str(output) + '.json')
    try:
        cached = json.loads(metadata.read_text())
    except (OSError, ValueError):
        cached = {}
    if cached.get('key') == task['key'] and output.exists():
        if not cached.get('duration'):
            cached['duration'] = round(miniaudio.get_file_info(str(output)).duration, 3)
            metadata.write_text(json.dumps(cached))
        print('Cached ' + task['id'], flush=True)
        continue
    if model is None:
        print('Loading local voice-design model', flush=True)
        model = load_model(job['model_path'])
    print('Generating locally ' + task['id'], flush=True)
    started = time.monotonic()
    seed = int(hashlib.sha256(task['profile'].encode()).hexdigest()[:7], 16)
    mx.random.seed(seed)
    chunks = []
    for result in model.generate(text=task['text'], instruct=task['instruct'],
                                 lang_code='English', temperature=0.7, top_p=0.9,
                                 max_tokens=144, verbose=False):
        chunks.append(np.array(result.audio))
    audio = np.concatenate(chunks).reshape(-1)
    duration = len(audio) / model.sample_rate
    if not 0.5 < duration < 12 or not np.isfinite(audio).all() or np.sqrt(np.mean(audio**2)) < 0.002:
        raise RuntimeError(f'Invalid generated audio for {task["id"]}: {duration}s')
    wav = Path(job['stage']) / (task['id'] + '.wav')
    audio_write(str(wav), audio, model.sample_rate, format='wav')
    subprocess.run([job['ffmpeg'], '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav),
                    '-af', 'loudnorm=I=-19:TP=-2:LRA=7', '-ar', '24000', '-ac', '1',
                    '-codec:a', 'libmp3lame', '-b:a', '96k', str(output)], check=True)
    metadata.write_text(json.dumps({**task, 'voice': task['profile'],
                                    'model': job['model'], 'runtime': 'MLX 4-bit',
                                    'duration': round(duration, 3)}))
    print(f'Generated {task["id"]}: {duration:.2f}s audio in {time.monotonic()-started:.1f}s', flush=True)
    mx.clear_cache()
