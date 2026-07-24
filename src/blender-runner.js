const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const { verify } = require("../scripts/verify-media");
const { generateDiagnosticAudio } = require("./generate-diagnostic-audio");

const ROOT = path.resolve(__dirname, "..");
const BLENDER_FALLBACK = "/Applications/Blender.app/Contents/MacOS/Blender";
const OUTPUT_DIR = path.join(ROOT, "output");
const FRAME_DIR = path.join(OUTPUT_DIR, "human-face-proof-v2-frames");
const AUDIO_DIR = path.join(OUTPUT_DIR, "human-face-proof-v2-audio");
const FACE_VERIFY_DIR = path.join(OUTPUT_DIR, "face-verification");
const VIDEO_PATH = path.join(OUTPUT_DIR, "human-face-proof-v2.mp4");
const BLENDER_SCENE = path.join(ROOT, "blender", "face_proof_scene.py");
const FPS = 30;
const SECONDS = 8;

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

function runSync(command, args, options) {
  console.log(`+ ${[command].concat(args).join(" ")}`);
  const result = spawnSync(command, args, Object.assign({ encoding: "utf8" }, options || {}));
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    throw new Error(`${command} exited with ${result.status}`);
  }
  return result;
}

function extractFaceVerificationFrames() {
  cleanDir(FACE_VERIFY_DIR);
  const times = [2.5, 3.5, 4.5, 5.5];
  const framePaths = times.map((time) => {
    const file = path.join(FACE_VERIFY_DIR, `face_${String(time).replace(".", "_")}.png`);
    runSync(ffmpegPath, [
      "-y",
      "-ss",
      String(time),
      "-i",
      VIDEO_PATH,
      "-frames:v",
      "1",
      file
    ]);
    return file;
  });

  const contactSheet = path.join(FACE_VERIFY_DIR, "contact-sheet.png");
  runSync(ffmpegPath, [
    "-y",
    "-i",
    framePaths[0],
    "-i",
    framePaths[1],
    "-i",
    framePaths[2],
    "-i",
    framePaths[3],
    "-filter_complex",
    "[0:v][1:v][2:v][3:v]xstack=inputs=4:layout=0_0|w0_0|w0+w1_0|w0+w1+w2_0[v]",
    "-map",
    "[v]",
    contactSheet
  ]);

  return { framePaths, contactSheet };
}

function compareFaceFrames(framePaths) {
  const script = `
import json
import sys
from PIL import Image, ImageChops, ImageStat

paths = sys.argv[1:]
images = [Image.open(path).convert("RGB") for path in paths]
width, height = images[0].size
crop = (int(width * 0.32), int(height * 0.20), int(width * 0.68), int(height * 0.78))
results = []
for index in range(len(images) - 1):
    a = images[index].crop(crop)
    b = images[index + 1].crop(crop)
    diff = ImageChops.difference(a, b)
    stat = ImageStat.Stat(diff)
    mean_abs = sum(stat.mean) / len(stat.mean)
    gray = diff.convert("L")
    extrema = gray.getextrema()
    pixels = gray.get_flattened_data() if hasattr(gray, "get_flattened_data") else gray.getdata()
    changed = sum(1 for value in pixels if value > 12)
    changed_ratio = changed / (diff.size[0] * diff.size[1])
    results.append({
        "pair": [paths[index], paths[index + 1]],
        "mean_abs": mean_abs,
        "max_abs": extrema[1],
        "changed_ratio": changed_ratio,
    })
ok = all(item["mean_abs"] > 0.35 and item["changed_ratio"] > 0.001 for item in results)
print(json.dumps({"ok": ok, "crop": crop, "comparisons": results}, indent=2))
sys.exit(0 if ok else 1)
`;
  const result = runSync("python3", ["-c", script].concat(framePaths));
  return JSON.parse(result.stdout);
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
    BLENDER_SCENE
  ];
  const blenderEnv = Object.assign({}, process.env, {
    BLENDER_PROOF_FRAME_DIR: FRAME_DIR,
    BLENDER_PROOF_FPS: String(FPS),
    BLENDER_PROOF_SECONDS: String(SECONDS)
  });

  console.log(`Blender executable: ${blender}`);
  console.log(`Blender scene: ${BLENDER_SCENE}`);
  console.log(`Output video: ${VIDEO_PATH}`);
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
    prefix: "human-face-proof-v2",
    times: [1.0, 4.0, 7.5]
  });

  const faceVerification = extractFaceVerificationFrames();
  const faceComparison = compareFaceFrames(faceVerification.framePaths);

  await run("open", [VIDEO_PATH]);
  await run("open", [faceVerification.contactSheet]);

  return {
    blenderCommand: [blender].concat(blenderArgs).join(" "),
    ffmpegCommand: [ffmpegPath].concat(ffmpegArgs).join(" "),
    sourceScript: BLENDER_SCENE,
    videoPath: VIDEO_PATH,
    videoMtime: stat.mtime.toISOString(),
    faceFrames: faceVerification.framePaths,
    contactSheet: faceVerification.contactSheet,
    faceComparison
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
