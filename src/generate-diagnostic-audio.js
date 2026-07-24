const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");

function runFfmpeg(args, label) {
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
        reject(new Error(`${label} failed with ${code}\n${stderr}`));
      }
    });
  });
}

async function generateDiagnosticAudio(outputDir, options) {
  const seconds = (options && options.seconds) || 5;
  fs.mkdirSync(outputDir, { recursive: true });
  const music = path.join(outputDir, "human_music.wav");
  const beepOne = path.join(outputDir, "human_notification.wav");
  const beepTwo = path.join(outputDir, "human_typing_click.wav");
  const mix = path.join(outputDir, "human_figure_proof_audio.wav");

  await runFfmpeg([
    "-y",
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=294:duration=${seconds}`,
    "-af",
    `volume=0.32,tremolo=f=4.5:d=0.35,afade=t=in:st=0:d=0.5,afade=t=out:st=${Math.max(seconds - 0.8, 0)}:d=0.8`,
    "-ar",
    "48000",
    "-ac",
    "2",
    music
  ], "generate music");

  await runFfmpeg([
    "-y",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=1046:duration=0.35",
    "-af",
    "volume=0.62,afade=t=out:st=0.22:d=0.12",
    "-ar",
    "48000",
    "-ac",
    "2",
    beepOne
  ], "generate first beep");

  await runFfmpeg([
    "-y",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=1760:duration=0.08",
    "-af",
    "volume=0.5,afade=t=out:st=0.04:d=0.04",
    "-ar",
    "48000",
    "-ac",
    "2",
    beepTwo
  ], "generate second beep");

  await runFfmpeg([
    "-y",
    "-i",
    music,
    "-i",
    beepOne,
    "-i",
    beepTwo,
    "-filter_complex",
    "[1:a]adelay=3900:all=1[b1];[2:a]adelay=900|1080:all=0[b2];[0:a][b1][b2]amix=inputs=3:duration=longest:normalize=0,alimiter=limit=0.95[outa]",
    "-map",
    "[outa]",
    "-ar",
    "48000",
    "-ac",
    "2",
    mix
  ], "mix diagnostic audio");

  return { music, beepOne, beepTwo, mix };
}

if (require.main === module) {
  generateDiagnosticAudio(path.resolve(process.argv[2] || "output/blender-audio"))
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = {
  generateDiagnosticAudio
};
