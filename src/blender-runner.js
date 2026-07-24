const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const { verify } = require("../scripts/verify-media");
const { generateDiagnosticAudio } = require("./generate-diagnostic-audio");

const ROOT = path.resolve(__dirname, "..");
const BLENDER_FALLBACK = "/Applications/Blender.app/Contents/MacOS/Blender";
const OUTPUT_DIR = path.join(ROOT, "output");
const FRAME_DIR = path.join(OUTPUT_DIR, "human-figure-proof-frames");
const AUDIO_DIR = path.join(OUTPUT_DIR, "human-figure-proof-audio");
const VIDEO_PATH = path.join(OUTPUT_DIR, "human-figure-proof.mp4");
const FPS = 30;
const SECONDS = 7;

function run(command, args, options) {
  console.log(`+ ${[command].concat(args).join(" ")}`);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, Object.assign({ stdio: "inherit" }, options || {}));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with ${code}`));
      }
    });
  });
}

function commandExists(command) {
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

function blenderCommand() {
  const fromPath = commandExists("blender");
  if (fromPath) {
    return fromPath;
  }
  if (fs.existsSync(BLENDER_FALLBACK)) {
    return BLENDER_FALLBACK;
  }
  throw new Error(`Blender executable not found. Install Blender or place it at ${BLENDER_FALLBACK}.`);
}

function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

async function renderBlenderProof() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  cleanDir(FRAME_DIR);
  cleanDir(AUDIO_DIR);
  if (fs.existsSync(VIDEO_PATH)) {
    fs.rmSync(VIDEO_PATH);
  }

  const blender = blenderCommand();
  const audio = await generateDiagnosticAudio(AUDIO_DIR, { seconds: SECONDS });
  const blenderArgs = [
    "--background",
    "--factory-startup",
    "--python",
    path.join(ROOT, "blender", "diagnostic_scene.py")
  ];
  const blenderEnv = Object.assign({}, process.env, {
    BLENDER_PROOF_FRAME_DIR: FRAME_DIR,
    BLENDER_PROOF_FPS: String(FPS),
    BLENDER_PROOF_SECONDS: String(SECONDS)
  });

  await run(blender, blenderArgs, { env: blenderEnv });

  const frames = fs.readdirSync(FRAME_DIR).filter((file) => file.endsWith(".png")).sort();
  if (frames.length < FPS * SECONDS) {
    throw new Error(`Expected at least ${FPS * SECONDS} Blender frames, found ${frames.length}`);
  }

  const ffmpegArgs = [
    "-y",
    "-framerate",
    String(FPS),
    "-i",
    path.join(FRAME_DIR, "frame_%04d.png"),
    "-i",
    audio.mix,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-shortest",
    VIDEO_PATH
  ];
  await run(ffmpegPath, ffmpegArgs);

  const stat = fs.statSync(VIDEO_PATH);
  console.log(`Created ${VIDEO_PATH} (${stat.size} bytes, mtime ${stat.mtime.toISOString()})`);

  verify(VIDEO_PATH, {
    prefix: "human-figure-proof",
    times: [1.0, 3.5, 6.5]
  });

  await run("open", [VIDEO_PATH]);

  return {
    blenderCommand: [blender].concat(blenderArgs).join(" "),
    ffmpegCommand: [ffmpegPath].concat(ffmpegArgs).join(" "),
    videoPath: VIDEO_PATH
  };
}

if (require.main === module) {
  renderBlenderProof()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = {
  renderBlenderProof
};
