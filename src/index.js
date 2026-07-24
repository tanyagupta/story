const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const { buildFfmpegArgs } = require("./render");
const { validateStoryboard } = require("./schema");

function readStoryboard(filePath) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Could not read storyboard JSON at ${filePath}: ${error.message}`);
  }

  return validateStoryboard(parsed);
}

function runFfmpeg(args) {
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
        reject(new Error(`FFmpeg exited with code ${code}\n${stderr.trim()}`));
      }
    });
  });
}

async function renderStoryboardFile(inputPath, outputPath) {
  const storyboard = readStoryboard(inputPath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const args = buildFfmpegArgs(storyboard, outputPath);
  await runFfmpeg(args);

  return {
    output: outputPath,
    sceneCount: storyboard.scenes.length
  };
}

module.exports = {
  buildFfmpegArgs,
  readStoryboard,
  renderStoryboardFile,
  validateStoryboard
};
