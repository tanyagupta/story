const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const { AiProvider } = require("./ai-provider");

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

function colorForScene(index) {
  const colors = ["#17243d", "#21395a", "#273144", "#362b54", "#244750", "#385342"];
  return colors[index % colors.length];
}

function escapeDrawtext(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

function fontOption() {
  return fs.existsSync(FONT_FILE) ? `fontfile='${FONT_FILE}'` : "font=Arial";
}

class MockProvider extends AiProvider {
  get name() {
    return "mock";
  }

  async isAvailable() {
    return { ok: true, reason: "Mock provider renders deterministic local FFmpeg clips." };
  }

  async renderScene(request) {
    fs.mkdirSync(path.dirname(request.outputPath), { recursive: true });
    if (fs.existsSync(request.outputPath)) fs.rmSync(request.outputPath);

    const scene = request.scene;
    const duration = Number(scene.duration || 5);
    const title = `${scene.number}. ${scene.title}`;
    const promptFile = request.promptFile;
    fs.writeFileSync(promptFile, `${request.prompt}\n`);

    const draw = [
      `drawtext=${fontOption()}:text='${escapeDrawtext("MOCK AI RENDERER")}':fontcolor=white:fontsize=38:x=56:y=44:box=1:boxcolor=black@0.35:boxborderw=12`,
      `drawtext=${fontOption()}:text='${escapeDrawtext(title)}':fontcolor=white:fontsize=34:x=56:y=112:box=1:boxcolor=black@0.35:boxborderw=12`,
      `drawtext=${fontOption()}:text='${escapeDrawtext(scene.environment)}':fontcolor=#ffe8a3:fontsize=28:x=56:y=174`,
      "drawbox=x='80+mod(t*180,1040)':y='300+90*sin(t*2)':w=120:h=120:color=#f7c948@0.95:t=fill",
      "drawbox=x='980-240*sin(t*0.7)':y='230+65*cos(t*1.4)':w=80:h=180:color=#7dd3fc@0.88:t=fill",
      "drawbox=x='140+90*sin(t*1.2)':y='480+28*cos(t*4)':w=1000:h=12:color=#ffffff@0.28:t=fill",
      `drawtext=${fontOption()}:textfile='${escapeDrawtext(promptFile)}':fontcolor=#f4f6fb:fontsize=18:line_spacing=6:x=56:y=540:box=1:boxcolor=black@0.42:boxborderw=10`
    ].join(",");

    run(ffmpegPath, [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=${colorForScene(scene.index)}:s=${request.width}x${request.height}:r=${request.fps}:d=${duration}`,
      "-vf",
      `${draw},format=yuv420p`,
      "-t",
      String(duration),
      "-an",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      request.outputPath
    ], `mock render for ${scene.id}`);

    return Object.assign({}, request, {
      provider: this.name,
      outputPath: request.outputPath
    });
  }
}

module.exports = {
  MockProvider
};
