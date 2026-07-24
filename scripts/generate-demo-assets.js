#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const { resolveFontFile } = require("../src/render");

const root = path.resolve(__dirname, "..");
const assetRoot = path.join(root, "assets", "demo");
const imageRoot = path.join(assetRoot, "scenes");
const audioRoot = path.join(assetRoot, "audio");
const fontFile = resolveFontFile({});

function run(args) {
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
        reject(new Error(`FFmpeg asset generation failed with ${code}\n${stderr.trim()}`));
      }
    });
  });
}

function fontOption() {
  return fontFile ? `:fontfile='${fontFile.replace(/:/g, "\\:")}'` : "";
}

async function png(file, size, filters) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await run([
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=0x00000000:s=${size}:d=1,format=rgba,${filters.join(",")}`,
    "-frames:v",
    "1",
    file
  ]);
}

async function wav(file, source, filters) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await run(["-y", "-f", "lavfi", "-i", source, "-af", filters.join(","), "-ar", "48000", "-ac", "2", file]);
}

async function main() {
  fs.mkdirSync(imageRoot, { recursive: true });
  fs.mkdirSync(audioRoot, { recursive: true });

  await png(path.join(imageRoot, "olympus-bg.png"), "1280x720", [
    "drawbox=x=0:y=0:w=1280:h=720:color=0x17233aff:t=fill",
    "drawbox=x=90:y=115:w=1100:h=92:color=0xf2f0e6ff:t=fill",
    "drawbox=x=170:y=245:w=160:h=320:color=0xd8d3c2ff:t=fill",
    "drawbox=x=560:y=245:w=160:h=320:color=0xd8d3c2ff:t=fill",
    "drawbox=x=950:y=245:w=160:h=320:color=0xd8d3c2ff:t=fill",
    `drawtext=text='OLYMPUS':x=455:y=140:fontsize=52:fontcolor=0x17233aff${fontOption()}`
  ]);
  await png(path.join(imageRoot, "fire.png"), "300x260", [
    "drawbox=x=95:y=95:w=110:h=130:color=0xffb347dd:t=fill",
    "drawbox=x=125:y=35:w=56:h=95:color=0xff7043ee:t=fill",
    "drawbox=x=145:y=0:w=32:h=80:color=0xf7d154ff:t=fill"
  ]);
  await png(path.join(imageRoot, "prometheus.png"), "310x430", [
    "drawbox=x=75:y=78:w=160:h=300:color=0xb9c7d9ff:t=fill",
    "drawbox=x=105:y=30:w=100:h=80:color=0xf0cfb4ff:t=fill",
    `drawtext=text='PROMETHEUS':x=24:y=365:fontsize=28:fontcolor=0xffffffff${fontOption()}`
  ]);
  await png(path.join(imageRoot, "earth-bg.png"), "1280x720", [
    "drawbox=x=0:y=0:w=1280:h=720:color=0x102033ff:t=fill",
    "drawbox=x=0:y=520:w=1280:h=200:color=0x35583eff:t=fill",
    "drawbox=x=130:y=390:w=165:h=130:color=0x8c5a3cff:t=fill",
    "drawbox=x=920:y=400:w=190:h=120:color=0x8c5a3cff:t=fill"
  ]);
  await png(path.join(imageRoot, "spark.png"), "200x200", [
    "drawbox=x=65:y=58:w=70:h=104:color=0xff7043ee:t=fill",
    "drawbox=x=88:y=18:w=34:h=70:color=0xf7d154ff:t=fill"
  ]);
  await png(path.join(imageRoot, "zeus.png"), "360x410", [
    "drawbox=x=78:y=80:w=204:h=260:color=0xf2f0e6ff:t=fill",
    "drawbox=x=115:y=28:w=130:h=86:color=0xdfe8f7ff:t=fill",
    "drawbox=x=238:y=158:w=64:h=190:color=0xf6c445ff:t=fill",
    `drawtext=text='ZEUS':x=117:y=185:fontsize=54:fontcolor=0x18202bff${fontOption()}`
  ]);
  await png(path.join(imageRoot, "lightning.png"), "240x240", [
    "drawbox=x=90:y=15:w=58:h=120:color=0xf6c445ff:t=fill",
    "drawbox=x=60:y=110:w=115:h=48:color=0xf6c445ff:t=fill",
    "drawbox=x=105:y=150:w=48:h=75:color=0xf6c445ff:t=fill"
  ]);

  await wav(path.join(audioRoot, "music.wav"), "sine=frequency=220:duration=22", ["volume=0.3", "afade=t=in:st=0:d=1.5", "afade=t=out:st=19:d=2"]);
  await wav(path.join(audioRoot, "ambient.wav"), "anoisesrc=color=brown:duration=22:amplitude=0.12", ["volume=0.22"]);
  await wav(path.join(audioRoot, "narration-1.wav"), "sine=frequency=420:duration=3.6", ["volume=0.45", "afade=t=in:st=0:d=0.1", "afade=t=out:st=3.3:d=0.3"]);
  await wav(path.join(audioRoot, "narration-2.wav"), "sine=frequency=470:duration=3.8", ["volume=0.45", "afade=t=in:st=0:d=0.1", "afade=t=out:st=3.5:d=0.3"]);
  await wav(path.join(audioRoot, "narration-3.wav"), "sine=frequency=380:duration=3.5", ["volume=0.45", "afade=t=in:st=0:d=0.1", "afade=t=out:st=3.2:d=0.3"]);
  await wav(path.join(audioRoot, "spark.wav"), "sine=frequency=900:duration=0.6", ["volume=0.55", "afade=t=out:st=0.35:d=0.25"]);
  await wav(path.join(audioRoot, "thunder.wav"), "anoisesrc=color=white:duration=1.2:amplitude=0.5", ["lowpass=f=260", "volume=0.65", "afade=t=out:st=0.4:d=0.8"]);

  console.log(`Generated demo assets in ${assetRoot}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
