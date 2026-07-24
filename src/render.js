const fs = require("fs");

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const DEFAULT_FPS = 30;
const DEFAULT_DURATION = 3;
const FONT_CANDIDATES = [
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/System/Library/Fonts/Helvetica.ttc",
  "/Library/Fonts/Arial.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
];

function shellColor(color, fallback) {
  return (color || fallback).replace(/^#/, "0x");
}

function escapeDrawtext(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\n/g, " ");
}

function escapeFilterPath(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/:/g, "\\:");
}

function resolveFontFile(settings) {
  if (settings.fontFile) {
    return settings.fontFile;
  }

  return FONT_CANDIDATES.find((candidate) => fs.existsSync(candidate)) || null;
}

function numberOr(value, fallback) {
  return typeof value === "number" ? value : fallback;
}

function addTextFilter(filters, shape, settings, defaults) {
  const x = numberOr(shape.x, defaults.x);
  const y = numberOr(shape.y, defaults.y);
  const size = numberOr(shape.size, defaults.size);
  const color = shellColor(shape.color, defaults.color);
  const text = escapeDrawtext(shape.text || "");
  const box = shape.type === "caption";
  const boxOptions = box
    ? ":box=1:boxcolor=0x00000088:boxborderw=24:line_spacing=8"
    : "";
  const fontOption = settings.fontFile ? `fontfile='${escapeFilterPath(settings.fontFile)}':` : "";

  filters.push(
    `drawtext=${fontOption}text='${text}':x=${x}:y=${y}:fontsize=${size}:fontcolor=${color}${boxOptions}`
  );
}

function addShapeFilter(filters, shape, settings) {
  if (shape.type === "rect") {
    filters.push(
      `drawbox=x=${numberOr(shape.x, 0)}:y=${numberOr(shape.y, 0)}:w=${numberOr(shape.width, 100)}:h=${numberOr(shape.height, 100)}:color=${shellColor(shape.color, "#ffffff")}:t=fill`
    );
    return;
  }

  if (shape.type === "text") {
    addTextFilter(filters, shape, settings, {
      x: 80,
      y: 100,
      size: 42,
      color: "#ffffff"
    });
    return;
  }

  if (shape.type === "caption") {
    addTextFilter(filters, shape, settings, {
      x: 80,
      y: settings.height - 130,
      size: 30,
      color: "#ffffff"
    });
  }
}

function buildSceneFilter(scene, index, settings) {
  const filters = [];
  const title = scene.title || scene.id || `Scene ${index + 1}`;
  const narration = scene.narration || "";

  filters.push("format=rgba");
  const fontOption = settings.fontFile ? `fontfile='${escapeFilterPath(settings.fontFile)}':` : "";
  filters.push(
    `drawtext=${fontOption}text='${escapeDrawtext(title)}':x=72:y=54:fontsize=48:fontcolor=0xffffffff`
  );

  if (narration) {
    filters.push(
      `drawtext=${fontOption}text='${escapeDrawtext(narration)}':x=72:y=${settings.height - 78}:fontsize=26:fontcolor=0xffffffcc:box=1:boxcolor=0x00000066:boxborderw=18`
    );
  }

  scene.shapes.forEach((shape) => addShapeFilter(filters, shape, settings));
  filters.push("format=yuv420p");

  return `[${index}:v]${filters.join(",")}[v${index}]`;
}

function normalizeSettings(storyboard) {
  const settings = storyboard.settings || {};
  return {
    width: settings.width || DEFAULT_WIDTH,
    height: settings.height || DEFAULT_HEIGHT,
    fps: settings.fps || DEFAULT_FPS,
    defaultDuration: settings.defaultDuration || DEFAULT_DURATION,
    fontFile: resolveFontFile(settings)
  };
}

function buildFfmpegArgs(storyboard, outputPath) {
  const settings = normalizeSettings(storyboard);
  const args = ["-y"];

  storyboard.scenes.forEach((scene) => {
    const duration = scene.duration || settings.defaultDuration;
    args.push(
      "-f",
      "lavfi",
      "-t",
      String(duration),
      "-i",
      `color=c=${shellColor(scene.background, "#18202b")}:s=${settings.width}x${settings.height}:r=${settings.fps}`
    );
  });

  const sceneFilters = storyboard.scenes.map((scene, index) => buildSceneFilter(scene, index, settings));
  const concatInputs = storyboard.scenes.map((_, index) => `[v${index}]`).join("");
  const filterGraph = `${sceneFilters.join(";")};${concatInputs}concat=n=${storyboard.scenes.length}:v=1:a=0[outv]`;

  args.push(
    "-filter_complex",
    filterGraph,
    "-map",
    "[outv]",
    "-r",
    String(settings.fps),
    "-movflags",
    "+faststart",
    outputPath
  );

  return args;
}

module.exports = {
  buildFfmpegArgs,
  escapeDrawtext,
  resolveFontFile,
  normalizeSettings
};
