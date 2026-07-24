const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const {
  buildFfmpegArgs,
  buildAudioMixArgs,
  buildSceneRenderArgs,
  buildVideoCombineArgs,
  normalizeSettings
} = require("./render");
const { validateStoryboard } = require("./schema");
const { generateNarration } = require("./tts");

function readStoryboard(filePath) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Could not read storyboard JSON at ${filePath}: ${error.message}`);
  }

  return validateStoryboard(parsed);
}

function runFfmpeg(args, label, logger) {
  logger(`[ffmpeg] ${label}`);
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg failed during ${label} with code ${code}\n${stderr.trim()}`));
      }
    });
  });
}

function cleanDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

function defaultOutputPath(options) {
  const outputDir = path.resolve(process.cwd(), "output");
  return path.join(outputDir, options.preview ? "storyboard_preview.mp4" : "storyboard_video.mp4");
}

function ensureLayerAssets(storyboard, rootDir) {
  storyboard.scenes.forEach((scene, sceneIndex) => {
    (scene.layers || []).forEach((layer, layerIndex) => {
      const assetPath = path.resolve(rootDir, layer.file);
      if (!fs.existsSync(assetPath)) {
        throw new Error(`Missing required layer asset at scenes[${sceneIndex}].layers[${layerIndex}].file: ${assetPath}`);
      }
      layer.file = assetPath;
    });
  });
}

async function prepareTtsNarration(storyboard, rootDir, logger) {
  if (!storyboard.tts || storyboard.tts.enabled !== true) {
    return;
  }

  for (let index = 0; index < storyboard.scenes.length; index += 1) {
    const scene = storyboard.scenes[index];
    if (scene.narration && scene.narration.text && !scene.narration.file) {
      const file = await generateNarration(scene.narration.text, storyboard.tts, rootDir, logger);
      scene.narration.file = file;
    }
  }
}

async function renderStoryboard(storyboard, outputPath, options) {
  options = options || {};
  const logger = options.logger || console.log;
  const rootDir = options.rootDir || process.cwd();
  const settings = normalizeSettings(storyboard, options.preview ? "preview" : "normal");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "storyboard-render-"));
  const sceneFiles = [];
  const output = path.resolve(outputPath || defaultOutputPath(options));
  const startedAt = Date.now();

  fs.mkdirSync(path.dirname(output), { recursive: true });
  if (fs.existsSync(output)) {
    fs.rmSync(output);
  }
  ensureLayerAssets(storyboard, rootDir);
  await prepareTtsNarration(storyboard, rootDir, logger);

  try {
    logger(`Rendering ${storyboard.scenes.length} scenes at ${settings.width}x${settings.height} ${settings.fps}fps`);
    for (let index = 0; index < storyboard.scenes.length; index += 1) {
      const sceneOutput = path.join(tempDir, `scene-${String(index + 1).padStart(2, "0")}.mp4`);
      const args = buildSceneRenderArgs(storyboard, storyboard.scenes[index], index, settings, sceneOutput);
      await runFfmpeg(args, `scene ${index + 1}`, logger);
      sceneFiles.push(sceneOutput);
    }

    const silentVideo = path.join(tempDir, "video-only.mp4");
    const concatPath = path.join(tempDir, "scenes.ffconcat");
    await runFfmpeg(buildVideoCombineArgs(storyboard, settings, sceneFiles, silentVideo, concatPath), "video transitions", logger);

    await runFfmpeg(buildAudioMixArgs(storyboard, settings, rootDir, silentVideo, output), "audio mix and final encode", logger);
    const stat = fs.statSync(output);
    if (stat.mtimeMs < startedAt || stat.size === 0) {
      throw new Error(`Render did not create a fresh non-empty output file: ${output}`);
    }
    logger(`Verified fresh output ${output} (${stat.size} bytes, mtime ${stat.mtime.toISOString()})`);
    return {
      output,
      sceneCount: storyboard.scenes.length,
      mode: settings.mode
    };
  } finally {
    cleanDirectory(tempDir);
  }
}

async function renderStoryboardFile(inputPath, outputPath, options) {
  const storyboard = readStoryboard(inputPath);
  const rootDir = path.dirname(inputPath);
  return renderStoryboard(storyboard, outputPath, Object.assign({ rootDir }, options || {}));
}

module.exports = {
  normalizeSettings,
  buildFfmpegArgs,
  readStoryboard,
  renderStoryboard,
  renderStoryboardFile,
  runFfmpeg,
  validateStoryboard
};
