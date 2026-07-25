const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const ffmpegPath = require("ffmpeg-static");

const FONT_FILE = "/System/Library/Fonts/Supplemental/Arial.ttf";

function run(command, args, label) {
  console.log(`+ ${[command].concat(args).join(" ")}`);
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

function cleanDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function wrapSubtitle(text, maxWidth) {
  const words = String(text || "").split(/\s+/);
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
  return String(value || "").replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

function writeSubtitles(entries, subtitleDir) {
  cleanDir(subtitleDir);
  return entries.map((entry, index) => {
    const file = path.join(subtitleDir, `subtitle_${String(index + 1).padStart(2, "0")}.txt`);
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

function concatClips(clipPaths, outputPath, workDir) {
  fs.mkdirSync(workDir, { recursive: true });
  const concatPath = path.join(workDir, "clips.ffconcat");
  const content = ["ffconcat version 1.0"]
    .concat(clipPaths.map((clipPath) => `file '${clipPath.replace(/'/g, "'\\''")}'`))
    .join("\n");
  fs.writeFileSync(concatPath, `${content}\n`);
  run(ffmpegPath, [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatPath,
    "-c",
    "copy",
    outputPath
  ], "concatenating AI scene clips");
  return outputPath;
}

function muxVideoWithAudioAndSubtitles(options) {
  const subtitleEntries = writeSubtitles(options.speechEntries || [], options.subtitleDir);
  const args = [
    "-y",
    "-i",
    options.videoPath,
    "-i",
    options.audioPath,
    "-filter_complex",
    `[0:v]${subtitleVideoFilter(subtitleEntries)}`,
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
    options.outputPath
  ];
  run(ffmpegPath, args, "muxing video, speech, music, and subtitles");
  return {
    ffmpegCommand: [ffmpegPath].concat(args).join(" "),
    subtitleEntries
  };
}

module.exports = {
  cleanDir,
  concatClips,
  muxVideoWithAudioAndSubtitles,
  subtitleVideoFilter,
  writeSubtitles
};
