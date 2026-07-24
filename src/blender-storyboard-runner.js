const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const { readStoryboard } = require("./index");
const { buildSpeechPlan, generateZeusSpeechMix } = require("./zeus-speech");
const { verify } = require("../scripts/verify-media");

const ROOT = path.resolve(__dirname, "..");
const BLENDER_FALLBACK = "/Applications/Blender.app/Contents/MacOS/Blender";
const OUTPUT_DIR = path.join(ROOT, "output");
const DEFAULT_STORYBOARD = path.join(ROOT, "storyboard-zeus.json");
const DEFAULT_OUTPUT = path.join(OUTPUT_DIR, "zeus-story-speech-v2.mp4");
const PREVIEW_OUTPUT = path.join(OUTPUT_DIR, "zeus-story-speech-preview-v2.mp4");
const FRAME_DIR = path.join(OUTPUT_DIR, "zeus-storyboard-frames");
const AUDIO_DIR = path.join(OUTPUT_DIR, "zeus-story-speech-v2-audio");
const SUBTITLE_DIR = path.join(OUTPUT_DIR, "zeus-story-speech-v2-subtitles");
const PLAN_PATH = path.join(OUTPUT_DIR, "zeus-story-speech-v2-plan.json");
const RESOLVED_STORYBOARD_PATH = path.join(OUTPUT_DIR, "zeus-story-speech-v2.storyboard.resolved.json");
const BLENDER_SCRIPT = path.join(ROOT, "blender", "storyboard_scene.py");
const FONT_FILE = "/System/Library/Fonts/Supplemental/Arial.ttf";

function run(command, args, options) {
  console.log(`+ ${[command].concat(args).join(" ")}`);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, Object.assign({ stdio: "inherit" }, options || {}));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code}`));
    });
  });
}

function runSync(command, args) {
  console.log(`+ ${[command].concat(args).join(" ")}`);
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`${command} exited with ${result.status}`);
  }
}

function commandExists(command) {
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

function blenderCommand() {
  const fromPath = commandExists("blender");
  if (fromPath) return fromPath;
  if (fs.existsSync(BLENDER_FALLBACK)) return BLENDER_FALLBACK;
  throw new Error(`Blender executable not found. Install Blender or place it at ${BLENDER_FALLBACK}.`);
}

function cleanDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function totalDuration(storyboard) {
  return storyboard.scenes.reduce((sum, scene) => sum + scene.duration, 0);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const input = args.find((arg) => !arg.startsWith("-")) || DEFAULT_STORYBOARD;
  const outIndex = args.indexOf("--out");
  const preview = args.includes("--preview");
  const output = outIndex >= 0 ? args[outIndex + 1] : preview ? PREVIEW_OUTPUT : DEFAULT_OUTPUT;
  return {
    input: path.resolve(process.cwd(), input),
    output: path.resolve(process.cwd(), output),
    preview
  };
}

function wrapSubtitle(text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  if (lines.length <= 2) return lines.join("\n");
  return `${lines[0]}\n${lines.slice(1).join(" ")}`;
}

function speakerLabel(speaker) {
  return speaker === "narrator" ? "Narrator" : speaker.charAt(0).toUpperCase() + speaker.slice(1);
}

function escapeFilterPath(value) {
  return value.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

function writeSubtitles(entries) {
  cleanDir(SUBTITLE_DIR);
  return entries.map((entry, index) => {
    const file = path.join(SUBTITLE_DIR, `subtitle_${String(index + 1).padStart(2, "0")}.txt`);
    fs.writeFileSync(file, `${wrapSubtitle(`${speakerLabel(entry.speaker)}: ${entry.text}`, 52)}\n`);
    return Object.assign({}, entry, { subtitleFile: file });
  });
}

function subtitleVideoFilter(entries) {
  if (!entries.length) return "format=yuv420p[v]";
  const drawFilters = entries.map((entry) => {
    const options = [
      `fontfile=${escapeFilterPath(fs.existsSync(FONT_FILE) ? FONT_FILE : "")}`,
      `textfile=${escapeFilterPath(entry.subtitleFile)}`,
      "fontcolor=white",
      "fontsize=34",
      "line_spacing=8",
      "box=1",
      "boxcolor=black@0.78",
      "boxborderw=18",
      "borderw=2",
      "bordercolor=black@0.95",
      "shadowcolor=black@0.7",
      "shadowx=2",
      "shadowy=2",
      "x=(w-text_w)/2",
      "y=h-154",
      `enable='between(t\\,${entry.subtitleStart.toFixed(3)}\\,${entry.subtitleEnd.toFixed(3)})'`
    ].join(":");
    return `drawtext=${options}`;
  });
  return `${drawFilters.join(",")},format=yuv420p[v]`;
}

async function renderBlenderStoryboard(inputPath, outputPath) {
  const storyboard = readStoryboard(inputPath);
  if (storyboard.renderer !== "blender") {
    throw new Error(`${inputPath} is not marked with "renderer": "blender"`);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  cleanDir(FRAME_DIR);
  cleanDir(AUDIO_DIR);
  if (fs.existsSync(outputPath)) fs.rmSync(outputPath);

  const speechPlan = buildSpeechPlan(storyboard, {
    audioPath: path.join(AUDIO_DIR, "zeus_speech_mix.wav")
  });
  const seconds = totalDuration(speechPlan.storyboard);
  const speechEntries = writeSubtitles(speechPlan.entries);
  const audioPath = generateZeusSpeechMix(AUDIO_DIR, seconds, speechEntries);
  fs.writeFileSync(PLAN_PATH, `${JSON.stringify(Object.assign({}, speechPlan, { entries: speechEntries }), null, 2)}\n`);
  fs.writeFileSync(RESOLVED_STORYBOARD_PATH, `${JSON.stringify(speechPlan.storyboard, null, 2)}\n`);

  const blender = blenderCommand();
  const blenderArgs = ["--background", "--factory-startup", "--python", BLENDER_SCRIPT];
  const env = Object.assign({}, process.env, {
    BLENDER_STORYBOARD_FILE: RESOLVED_STORYBOARD_PATH,
    BLENDER_STORYBOARD_FRAME_DIR: FRAME_DIR,
    BLENDER_STORYBOARD_SPEECH_PLAN: PLAN_PATH
  });

  console.log(`Storyboard: ${inputPath}`);
  console.log(`Resolved storyboard loaded by Blender: ${RESOLVED_STORYBOARD_PATH}`);
  console.log(`Speech plan: ${PLAN_PATH}`);
  console.log(`Blender script: ${BLENDER_SCRIPT}`);
  console.log(`Blender executable: ${blender}`);
  console.log(`Output video: ${outputPath}`);
  speechEntries.forEach((entry) => {
    console.log(`Speech asset: scene ${entry.sceneIndex} ${entry.speaker} ${entry.absoluteStart.toFixed(2)}-${entry.absoluteEnd.toFixed(2)}s ${entry.file}`);
  });
  await run(blender, blenderArgs, { env });

  const fps = storyboard.fps || (storyboard.settings && storyboard.settings.fps) || 30;
  const ffmpegArgs = [
    "-y",
    "-framerate",
    String(fps),
    "-i",
    path.join(FRAME_DIR, "frame_%04d.png"),
    "-i",
    audioPath,
    "-filter_complex",
    `[0:v]${subtitleVideoFilter(speechEntries)}`,
    "-map",
    "[v]",
    "-map",
    "1:a:0",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-shortest",
    outputPath
  ];
  await run(ffmpegPath, ffmpegArgs);

  verify(outputPath, {
    prefix: path.basename(outputPath, ".mp4"),
    times: [1.0, Math.max(seconds / 2, 1.5), Math.max(seconds - 1.0, 1.0)]
  });

  const stat = fs.statSync(outputPath);
  console.log(`Created ${outputPath} (${stat.size} bytes, mtime ${stat.mtime.toISOString()})`);
  runSync("open", [outputPath]);

  return {
    storyboard: inputPath,
    blenderCommand: [blender].concat(blenderArgs).join(" "),
    ffmpegCommand: [ffmpegPath].concat(ffmpegArgs).join(" "),
    outputPath,
    mtime: stat.mtime.toISOString()
  };
}

if (require.main === module) {
  const { input, output } = parseArgs(process.argv);
  renderBlenderStoryboard(input, output)
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = {
  renderBlenderStoryboard
};
