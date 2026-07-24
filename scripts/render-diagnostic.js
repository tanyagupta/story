#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const { resolveFontFile } = require("../src/render");

const root = path.resolve(__dirname, "..");
const outputDir = path.join(root, "output");
const assetDir = path.join(outputDir, "diagnostic_assets");
const output = path.join(outputDir, "diagnostic_animation_audio.mp4");
const fontFile = resolveFontFile({});

function run(args, label) {
  console.log(`[ffmpeg] ${label}`);
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ["ignore", "inherit", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stderr);
      } else {
        reject(new Error(`${label} failed with ${code}\n${stderr}`));
      }
    });
  });
}

function fontOption() {
  return fontFile ? `:fontfile='${fontFile.replace(/:/g, "\\:")}'` : "";
}

async function main() {
  fs.mkdirSync(assetDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });
  if (fs.existsSync(output)) {
    fs.rmSync(output);
  }

  const mainTone = path.join(assetDir, "diagnostic_music.wav");
  const secondTone = path.join(assetDir, "diagnostic_second_sound.wav");
  const square = path.join(assetDir, "diagnostic_square.png");

  await run([
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=0xff2d2d:s=120x120:d=1,format=rgba,drawbox=x=28:y=28:w=44:h=44:color=0xffffffff:t=fill",
    "-frames:v",
    "1",
    square
  ], "diagnostic square png");

  await run([
    "-y",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=8",
    "-af",
    "volume=0.35,tremolo=f=6:d=0.4,afade=t=in:st=0:d=0.8,afade=t=out:st=7:d=1",
    "-ar",
    "48000",
    "-ac",
    "2",
    mainTone
  ], "diagnostic music");

  await run([
    "-y",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=880:duration=2.5",
    "-af",
    "volume=0.6,afade=t=in:st=0:d=0.1,afade=t=out:st=2:d=0.5",
    "-ar",
    "48000",
    "-ac",
    "2",
    secondTone
  ], "diagnostic second sound");

  const videoFilter = [
    "[1:v]format=rgba,scale=w='120+70*sin(t*6.28318)':h='120+70*sin(t*6.28318)':eval=frame[sq]",
    `[0:v][sq]overlay=x='40+1040*t/8':y='300+80*sin(t*3.14159)':eval=frame,drawtext=text='DIAGNOSTIC MOTION + AUDIO':x=40:y=40:fontsize=42:fontcolor=0xffffffff${fontOption()},drawtext=text='%{eif\\:t\\:d}s':x=585:y=625:fontsize=54:fontcolor=0xffffffff:box=1:boxcolor=0x00000099:boxborderw=18${fontOption()},format=yuv420p[outv]`
  ].join(";");

  const audioFilter = [
    "[2:a]adelay=0:all=1[a0]",
    "[3:a]adelay=2000:all=1[a1]",
    "[a0][a1]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.95[outa]"
  ].join(";");

  await run([
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=0x101820:s=1280x720:r=30:d=8,format=rgba",
    "-loop",
    "1",
    "-t",
    "8",
    "-i",
    square,
    "-i",
    mainTone,
    "-i",
    secondTone,
    "-filter_complex",
    `${videoFilter};${audioFilter}`,
    "-map",
    "[outv]",
    "-map",
    "[outa]",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-shortest",
    output
  ], "diagnostic final mp4");

  const stat = fs.statSync(output);
  console.log(`Created ${output} (${stat.size} bytes, mtime ${stat.mtime.toISOString()})`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
