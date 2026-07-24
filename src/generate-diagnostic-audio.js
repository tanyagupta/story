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

async function generateDiagnosticAudio(outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const music = path.join(outputDir, "blender_music.wav");
  const beepOne = path.join(outputDir, "blender_beep_one.wav");
  const beepTwo = path.join(outputDir, "blender_beep_two.wav");
  const mix = path.join(outputDir, "blender_proof_audio.wav");

  await runFfmpeg([
    "-y",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=262:duration=5",
    "-af",
    "volume=0.35,tremolo=f=5:d=0.45,afade=t=in:st=0:d=0.5,afade=t=out:st=4.3:d=0.7",
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
    "sine=frequency=880:duration=0.28",
    "-af",
    "volume=0.6,afade=t=out:st=0.18:d=0.1",
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
    "sine=frequency=1320:duration=0.28",
    "-af",
    "volume=0.6,afade=t=out:st=0.18:d=0.1",
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
    "[1:a]adelay=1200:all=1[b1];[2:a]adelay=3200:all=1[b2];[0:a][b1][b2]amix=inputs=3:duration=longest:normalize=0,alimiter=limit=0.95[outa]",
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
