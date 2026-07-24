#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const ffprobe = require("ffprobe-static");

function run(command, args, options) {
  const result = spawnSync(command, args, Object.assign({ encoding: "utf8" }, options || {}));
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stderr || result.stdout}`);
  }
  return result;
}

function ffprobeJson(file) {
  const result = run(ffprobe.path, ["-v", "error", "-show_streams", "-show_format", "-of", "json", file]);
  return JSON.parse(result.stdout);
}

function extractFrame(file, time, output) {
  run(ffmpegPath, ["-y", "-ss", String(time), "-i", file, "-frames:v", "1", output]);
}

function volumedetect(file) {
  const result = run(ffmpegPath, ["-hide_banner", "-i", file, "-af", "volumedetect", "-vn", "-sn", "-dn", "-f", "null", "-"]);
  const text = result.stderr;
  const mean = Number((text.match(/mean_volume:\s*(-?\d+(?:\.\d+)?) dB/) || [])[1]);
  const max = Number((text.match(/max_volume:\s*(-?\d+(?:\.\d+)?) dB/) || [])[1]);
  if (!Number.isFinite(mean) || !Number.isFinite(max)) {
    throw new Error(`Could not parse volumedetect output for ${file}\n${text}`);
  }
  return { mean, max, text };
}

function compareFrames(paths, mode) {
  const script = `
from PIL import Image, ImageChops
import json, sys
paths = sys.argv[1:4]
mode = sys.argv[4]
imgs = [Image.open(p).convert("RGBA") for p in paths]
diffs = []
for a,b in [(0,1),(1,2),(0,2)]:
    diff = ImageChops.difference(imgs[a], imgs[b])
    hist = diff.convert("L").histogram()
    pixels = imgs[a].size[0] * imgs[a].size[1]
    changed = sum(count for value, count in enumerate(hist) if value > 8)
    mean = sum(value * count for value, count in enumerate(hist)) / pixels
    diffs.append({"pair": [a,b], "changed_ratio": changed / pixels, "mean_abs": mean})

red_centers = []
if mode == "diagnostic":
    for img in imgs:
        pixels = img.load()
        xs = []
        ys = []
        w,h = img.size
        for y in range(h):
            for x in range(w):
                r,g,b,a = pixels[x,y]
                if r > 180 and g < 90 and b < 90 and a > 150:
                    xs.append(x)
                    ys.append(y)
        if not xs:
            red_centers.append(None)
        else:
            red_centers.append({"x": sum(xs)/len(xs), "y": sum(ys)/len(ys), "count": len(xs), "bbox": [min(xs), min(ys), max(xs), max(ys)]})
print(json.dumps({"diffs": diffs, "red_centers": red_centers}))
`;
  const result = run("python3", ["-c", script, ...paths, mode]);
  const data = JSON.parse(result.stdout);
  const enoughFrameDiff = data.diffs.some((diff) => diff.changed_ratio > 0.015 && diff.mean_abs > 1.5);
  if (!enoughFrameDiff) {
    throw new Error(`Frame comparison failed for ${paths.join(", ")}: ${JSON.stringify(data)}`);
  }
  if (mode === "diagnostic") {
    const centers = data.red_centers;
    if (centers.some((center) => !center)) {
      throw new Error(`Diagnostic red square not found in all frames: ${JSON.stringify(data)}`);
    }
    const travel = Math.abs(centers[2].x - centers[0].x);
    if (travel < 500) {
      throw new Error(`Diagnostic square did not move far enough: ${JSON.stringify(data)}`);
    }
  }
  return data;
}

function verify(file, options) {
  const absolute = path.resolve(file);
  const prefix = options.prefix || path.basename(file, ".mp4");
  const outputDir = path.resolve("output");
  const mode = options.mode || "storyboard";
  if (!fs.existsSync(absolute)) {
    throw new Error(`Missing MP4: ${absolute}`);
  }

  const probe = ffprobeJson(absolute);
  const video = probe.streams.find((stream) => stream.codec_type === "video");
  const audio = probe.streams.find((stream) => stream.codec_type === "audio");
  if (!video) throw new Error(`${absolute} has no video stream`);
  if (!audio) throw new Error(`${absolute} has no audio stream`);
  if (audio.codec_name !== "aac") throw new Error(`${absolute} audio codec is ${audio.codec_name}, expected aac`);

  const framePaths = [
    path.join(outputDir, `${prefix}_frame_start.png`),
    path.join(outputDir, `${prefix}_frame_middle.png`),
    path.join(outputDir, `${prefix}_frame_end.png`)
  ];
  const duration = Number(probe.format.duration);
  const times = options.times || [0.8, Math.min(2.5, Math.max(duration / 2, 1)), Math.min(4.4, Math.max(duration - 0.5, 0.5))];
  times.forEach((time, index) => extractFrame(absolute, time, framePaths[index]));
  const frameComparison = compareFrames(framePaths, mode);

  const audioWav = path.join(outputDir, `${prefix}_audio.wav`);
  run(ffmpegPath, ["-y", "-i", absolute, "-map", "0:a:0", "-c:a", "pcm_s16le", audioWav]);
  const volume = volumedetect(absolute);
  if (volume.max < -45) {
    throw new Error(`${absolute} audio is effectively silent: ${JSON.stringify(volume)}`);
  }

  const summary = {
    file: absolute,
    video_streams: probe.streams.filter((stream) => stream.codec_type === "video").length,
    audio_streams: probe.streams.filter((stream) => stream.codec_type === "audio").length,
    video_codec: video.codec_name,
    audio_codec: audio.codec_name,
    video_duration: video.duration || probe.format.duration,
    audio_duration: audio.duration || probe.format.duration,
    frame_rate: video.avg_frame_rate,
    audio_sample_rate: audio.sample_rate,
    audio_channels: audio.channels,
    volume,
    frames: framePaths,
    frameComparison
  };
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

function main() {
  const args = process.argv.slice(2);
  const file = args[0];
  if (!file) {
    console.error("Usage: node scripts/verify-media.js <mp4> [--diagnostic] [--prefix name]");
    process.exitCode = 1;
    return;
  }
  const prefixIndex = args.indexOf("--prefix");
  verify(file, {
    mode: args.includes("--diagnostic") ? "diagnostic" : "storyboard",
    prefix: prefixIndex >= 0 ? args[prefixIndex + 1] : undefined,
    times: args.includes("--diagnostic") ? [0.5, 4, 7.5] : undefined
  });
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  verify
};
