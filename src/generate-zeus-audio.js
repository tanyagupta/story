const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const ffmpegPath = require("ffmpeg-static");

function run(args, label) {
  console.log(`+ ${ffmpegPath} ${args.join(" ")}`);
  const result = spawnSync(ffmpegPath, args, { encoding: "utf8" });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`FFmpeg failed while ${label}`);
  }
}

function generateZeusAudio(outputDir, seconds) {
  fs.mkdirSync(outputDir, { recursive: true });
  const out = path.join(outputDir, "zeus_mix.wav");
  if (fs.existsSync(out)) fs.rmSync(out);

  const sources = [
    `sine=frequency=146:duration=${seconds}:sample_rate=48000`,
    `sine=frequency=220:duration=${seconds}:sample_rate=48000`,
    `sine=frequency=330:duration=${seconds}:sample_rate=48000`,
    `anoisesrc=color=brown:duration=${seconds}:sample_rate=48000:amplitude=0.12`,
    "sine=frequency=740:duration=0.35:sample_rate=48000",
    "anoisesrc=color=white:duration=1.2:sample_rate=48000:amplitude=0.7",
    "sine=frequency=980:duration=0.55:sample_rate=48000",
    "sine=frequency=980:duration=0.55:sample_rate=48000",
    "sine=frequency=520:duration=1.1:sample_rate=48000",
    "sine=frequency=740:duration=0.35:sample_rate=48000"
  ];
  const inputArgs = [];
  sources.forEach((source) => {
    inputArgs.push("-f", "lavfi", "-i", source);
  });

  const filter = [
    "[0:a]volume=0.13,tremolo=f=5:d=0.25[a0]",
    "[1:a]volume=0.08,afade=t=in:st=0:d=1.2[a1]",
    "[2:a]volume=0.05,adelay=6000:all=1[a2]",
    "[3:a]lowpass=f=900,volume=0.15[a3]",
    "[4:a]volume=0.55,adelay=4000:all=1[a4]",
    "[5:a]lowpass=f=240,volume=0.65,adelay=15500:all=1[a5]",
    "[6:a]volume=0.55,tremolo=f=16:d=0.8,adelay=18700:all=1[a6]",
    "[7:a]volume=0.5,tremolo=f=22:d=0.8,adelay=24500:all=1[a7]",
    "[8:a]volume=0.5,afade=t=in:st=0:d=0.2,adelay=30500:all=1[a8]",
    "[9:a]volume=0.65,adelay=33000:all=1[a9]",
    "[a0][a1][a2][a3][a4][a5][a6][a7][a8][a9]amix=inputs=10:duration=longest:normalize=0,dynaudnorm=f=150:g=9,alimiter=limit=0.95[out]"
  ].join(";");

  run([
    "-y",
    ...inputArgs,
    "-filter_complex",
    filter,
    "-map",
    "[out]",
    "-t",
    String(seconds),
    "-ar",
    "48000",
    "-ac",
    "2",
    out
  ], "generating Zeus storyboard audio");

  return out;
}

if (require.main === module) {
  const outputDir = path.resolve(process.argv[2] || "output/zeus-storyboard-audio");
  const seconds = Number(process.argv[3] || 42);
  generateZeusAudio(outputDir, seconds);
}

module.exports = {
  generateZeusAudio
};
