const fs = require("fs");
const path = require("path");

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

function normalizeSettings(storyboard, mode) {
  const settings = storyboard.settings || {};
  const resolution = storyboard.resolution || [settings.width, settings.height];
  const sourceWidth = resolution[0] || DEFAULT_WIDTH;
  const sourceHeight = resolution[1] || DEFAULT_HEIGHT;
  const preview = mode === "preview";
  const width = preview ? 960 : sourceWidth;
  const height = preview ? 540 : sourceHeight;

  return {
    width,
    height,
    sourceWidth,
    sourceHeight,
    scaleX: width / sourceWidth,
    scaleY: height / sourceHeight,
    layerScale: Math.min(width / sourceWidth, height / sourceHeight),
    fps: storyboard.fps || settings.fps || DEFAULT_FPS,
    defaultDuration: settings.defaultDuration || DEFAULT_DURATION,
    fontFile: resolveFontFile(settings),
    mode
  };
}

function sceneDuration(scene, settings) {
  return scene.duration || settings.defaultDuration;
}

function transitionDuration(scene) {
  if (!scene.transition || scene.transition.type === "cut") {
    return 0;
  }

  return numberOr(scene.transition.duration, 0.5);
}

function totalTimelineDuration(storyboard, settings) {
  return storyboard.scenes.reduce((total, scene, index) => {
    const duration = sceneDuration(scene, settings);
    return total + duration - (index > 0 ? transitionDuration(storyboard.scenes[index - 1]) : 0);
  }, 0);
}

function sceneStartTimes(storyboard, settings) {
  const starts = [];
  let cursor = 0;
  storyboard.scenes.forEach((scene, index) => {
    if (index > 0) {
      cursor -= transitionDuration(storyboard.scenes[index - 1]);
    }
    starts.push(cursor);
    cursor += sceneDuration(scene, settings);
  });
  return starts;
}

function clampExpression(value) {
  return `min(max(${value},0),1)`;
}

function progressExpression(start, duration, easing) {
  const linear = clampExpression(`(t-${start})/${duration || 1}`);
  if (easing === "ease_in") {
    return `pow(${linear},2)`;
  }
  if (easing === "ease_out") {
    return `(1-pow(1-${linear},2))`;
  }
  if (easing === "ease_in_out") {
    return `if(lt(${linear},0.5),2*pow(${linear},2),1-pow(-2*${linear}+2,2)/2)`;
  }
  return linear;
}

function interpolateExpression(startValue, endValue, start, duration, easing) {
  const progress = progressExpression(start, duration, easing);
  return `(${startValue}+(${endValue}-${startValue})*${progress})`;
}

function presetLayerAnimation(layer, settings, sceneLength) {
  const animation = layer.animation || {};
  const start = numberOr(animation.start, 0);
  const duration = numberOr(animation.duration, Math.max(sceneLength - start, 0.1));
  const easing = animation.easing || "linear";
  const position = layer.position || [numberOr(layer.x, 0), numberOr(layer.y, 0)];
  const depth = numberOr(layer.depth, numberOr(layer.z_index, 0) / 20);
  const parallax = numberOr(layer.parallax, depth * 10);
  let startX = numberOr(animation.start_x, position[0]) * settings.scaleX;
  let endX = numberOr(animation.end_x, position[0]) * settings.scaleX;
  let startY = numberOr(animation.start_y, position[1]) * settings.scaleY;
  let endY = numberOr(animation.end_y, position[1]) * settings.scaleY;
  let startScale = numberOr(animation.start_scale, numberOr(layer.scale, 1)) * settings.layerScale;
  let endScale = numberOr(animation.end_scale, numberOr(layer.scale, 1)) * settings.layerScale;
  let startRotation = numberOr(animation.start_rotation, numberOr(layer.rotation, 0));
  let endRotation = numberOr(animation.end_rotation, startRotation);
  let startOpacity = numberOr(animation.start_opacity, numberOr(layer.opacity, 1));
  let endOpacity = numberOr(animation.end_opacity, startOpacity);

  if (animation.type === "slow_zoom_in") {
    endScale = numberOr(animation.end_scale, numberOr(layer.scale, 1) * 1.08) * settings.layerScale;
  } else if (animation.type === "slow_zoom_out") {
    startScale = numberOr(animation.start_scale, numberOr(layer.scale, 1) * 1.08) * settings.layerScale;
  } else if (animation.type === "pan_left") {
    endX = numberOr(animation.end_x, position[0] - 240 - parallax) * settings.scaleX;
  } else if (animation.type === "pan_right") {
    endX = numberOr(animation.end_x, position[0] + 240 + parallax) * settings.scaleX;
  } else if (animation.type === "pan_up") {
    endY = numberOr(animation.end_y, position[1] - 180 - parallax) * settings.scaleY;
  } else if (animation.type === "pan_down") {
    endY = numberOr(animation.end_y, position[1] + 180 + parallax) * settings.scaleY;
  } else if (animation.type === "fade_in") {
    startOpacity = numberOr(animation.start_opacity, 0);
    endOpacity = numberOr(animation.end_opacity, numberOr(layer.opacity, 1));
  } else if (animation.type === "fade_out") {
    startOpacity = numberOr(animation.start_opacity, numberOr(layer.opacity, 1));
    endOpacity = numberOr(animation.end_opacity, 0);
  } else if (animation.type === "slide_in") {
    const from = animation.from || "left";
    if (from === "right") startX = settings.width;
    if (from === "left") startX = -settings.width / 2;
    if (from === "top") startY = -settings.height / 2;
    if (from === "bottom") startY = settings.height;
  } else if (animation.type === "slide_out") {
    const to = animation.to || "right";
    if (to === "right") endX = settings.width;
    if (to === "left") endX = -settings.width / 2;
    if (to === "top") endY = -settings.height / 2;
    if (to === "bottom") endY = settings.height;
  }

  return { start, duration, easing, startX, endX, startY, endY, startScale, endScale, startOpacity, endOpacity, startRotation, endRotation };
}

function layerInputArgs(layer, sceneLength) {
  return ["-loop", "1", "-t", String(sceneLength), "-i", layer.file];
}

function layerFilter(inputIndex, outputIndex, layer, settings, sceneLength) {
  const animation = presetLayerAnimation(layer, settings, sceneLength);
  const scaleExpr = interpolateExpression(animation.startScale, animation.endScale, animation.start, animation.duration, animation.easing);
  const rotationExpr = interpolateExpression(animation.startRotation, animation.endRotation, animation.start, animation.duration, animation.easing);
  const opacity = Math.max(0, Math.min(1, animation.endOpacity));
  const fadeIn = animation.startOpacity < animation.endOpacity ? `,fade=t=in:st=${animation.start}:d=${animation.duration}:alpha=1` : "";
  const fadeOut = animation.startOpacity > animation.endOpacity ? `,fade=t=out:st=${animation.start}:d=${animation.duration}:alpha=1` : "";
  const xExpr = interpolateExpression(animation.startX, animation.endX, animation.start, animation.duration, animation.easing);
  const yExpr = interpolateExpression(animation.startY, animation.endY, animation.start, animation.duration, animation.easing);

  return {
    prep: `[${inputIndex}:v]format=rgba,scale=w='iw*${scaleExpr}':h='ih*${scaleExpr}':eval=frame,rotate='${rotationExpr}':c=none:ow=rotw(iw):oh=roth(ih),colorchannelmixer=aa=${opacity}${fadeIn}${fadeOut}[layer${outputIndex}]`,
    overlay: `overlay=x='${xExpr}':y='${yExpr}':eval=frame:enable='between(t,${numberOr(layer.start, 0)},${numberOr(layer.end, sceneLength)})'`
  };
}

function drawCaptionFilters(caption, settings) {
  if (!caption || !caption.text) {
    return [];
  }

  const start = numberOr(caption.start, 0);
  const duration = numberOr(caption.duration, 3);
  const x = numberOr(caption.x, 80) * settings.scaleX;
  const y = numberOr(caption.y, settings.sourceHeight - 130) * settings.scaleY;
  const size = numberOr(caption.size, 34) * settings.layerScale;
  const fontOption = settings.fontFile ? `fontfile='${escapeFilterPath(settings.fontFile)}':` : "";
  const base = `x=${x}:y=${y}:fontsize=${size}:fontcolor=0xffffffff:box=1:boxcolor=0x00000088:boxborderw=22`;

  if (caption.animation === "progressive" || caption.animation === "typewriter") {
    const steps = [];
    const text = caption.text;
    for (let index = 1; index <= text.length; index += 1) {
      const stepStart = start + (duration * (index - 1)) / text.length;
      const stepEnd = index === text.length ? start + duration : start + (duration * index) / text.length;
      steps.push(`drawtext=${fontOption}text='${escapeDrawtext(text.slice(0, index))}':${base}:enable='between(t,${stepStart},${stepEnd})'`);
    }
    return steps;
  }

  const fade = caption.animation === "fade" ? `:alpha='${clampExpression(`min((t-${start})/0.4,(${start + duration}-t)/0.4)`)}'` : "";

  return [`drawtext=${fontOption}text='${escapeDrawtext(caption.text)}':${base}:enable='between(t,${start},${start + duration})'${fade}`];
}

function addLegacyShapeFilters(filters, scene, settings) {
  const title = scene.title || scene.id;
  const fontOption = settings.fontFile ? `fontfile='${escapeFilterPath(settings.fontFile)}':` : "";
  if (title) {
    filters.push(`drawtext=${fontOption}text='${escapeDrawtext(title)}':x=72:y=54:fontsize=48:fontcolor=0xffffffff`);
  }

  if (typeof scene.narration === "string" && scene.narration) {
    filters.push(`drawtext=${fontOption}text='${escapeDrawtext(scene.narration)}':x=72:y=${settings.height - 78}:fontsize=26:fontcolor=0xffffffcc:box=1:boxcolor=0x00000066:boxborderw=18`);
  }

  (scene.shapes || []).forEach((shape) => {
    if (shape.type === "rect") {
      filters.push(`drawbox=x=${numberOr(shape.x, 0) * settings.scaleX}:y=${numberOr(shape.y, 0) * settings.scaleY}:w=${numberOr(shape.width, 100) * settings.scaleX}:h=${numberOr(shape.height, 100) * settings.scaleY}:color=${shellColor(shape.color, "#ffffff")}:t=fill`);
    } else if (shape.type === "text" || shape.type === "caption") {
      const x = numberOr(shape.x, 80);
      const y = numberOr(shape.y, shape.type === "caption" ? settings.height - 130 : 100);
      const box = shape.type === "caption" ? ":box=1:boxcolor=0x00000088:boxborderw=24" : "";
      filters.push(`drawtext=${fontOption}text='${escapeDrawtext(shape.text || "")}':x=${x * settings.scaleX}:y=${y * settings.scaleY}:fontsize=${numberOr(shape.size, 36) * settings.layerScale}:fontcolor=${shellColor(shape.color, "#ffffff")}${box}`);
    }
  });
}

function buildSceneRenderArgs(storyboard, scene, index, settings, outputPath) {
  const duration = sceneDuration(scene, settings);
  const args = ["-y", "-f", "lavfi", "-t", String(duration), "-i", `color=c=${shellColor(scene.background, "#18202b")}:s=${settings.width}x${settings.height}:r=${settings.fps}`];
  const layers = (scene.layers || []).slice().sort((a, b) => numberOr(a.z_index, 0) - numberOr(b.z_index, 0));

  layers.forEach((layer) => {
    args.push(...layerInputArgs(layer, duration));
  });

  const filterParts = ["[0:v]format=rgba[base0]"];
  let current = "base0";
  layers.forEach((layer, layerIndex) => {
    const filters = layerFilter(layerIndex + 1, layerIndex, layer, settings, duration);
    const next = `base${layerIndex + 1}`;
    filterParts.push(filters.prep);
    filterParts.push(`[${current}][layer${layerIndex}]${filters.overlay}[${next}]`);
    current = next;
  });

  const frameFilters = [];
  addLegacyShapeFilters(frameFilters, scene, settings);
  frameFilters.push(...drawCaptionFilters(scene.caption, settings));

  filterParts.push(`[${current}]${frameFilters.concat(["format=yuv420p"]).join(",")}[outv]`);

  args.push(
    "-filter_complex",
    filterParts.join(";"),
    "-map",
    "[outv]",
    "-an",
    "-r",
    String(settings.fps),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    outputPath
  );

  return args;
}

function ffconcatContent(files) {
  return files.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n") + "\n";
}

function xfadeTransitionName(transition) {
  if (!transition) return "fade";
  if (transition.type === "dip_to_black") return "fadeblack";
  if (transition.type === "slide") return transition.direction === "right" ? "slideright" : "slideleft";
  return transition.type === "fade" || transition.type === "crossfade" ? "fade" : "fade";
}

function buildVideoCombineArgs(storyboard, settings, sceneFiles, outputPath, concatPath) {
  const hasTransitions = storyboard.scenes.some((scene) => transitionDuration(scene) > 0);

  if (!hasTransitions) {
    fs.writeFileSync(concatPath, ffconcatContent(sceneFiles));
    return ["-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-c", "copy", outputPath];
  }

  const args = ["-y"];
  sceneFiles.forEach((file) => args.push("-i", file));

  const parts = [];
  let last = "0:v";
  let offset = sceneDuration(storyboard.scenes[0], settings);
  for (let i = 1; i < sceneFiles.length; i += 1) {
    const previousTransition = storyboard.scenes[i - 1].transition || {};
    const duration = transitionDuration(storyboard.scenes[i - 1]) || 0.001;
    offset -= duration;
    const out = i === sceneFiles.length - 1 ? "outv" : `vxf${i}`;
    parts.push(`[${last}][${i}:v]xfade=transition=${xfadeTransitionName(previousTransition)}:duration=${duration}:offset=${offset}[${out}]`);
    last = out;
    offset += sceneDuration(storyboard.scenes[i], settings);
  }

  args.push(
    "-filter_complex",
    parts.join(";"),
    "-map",
    "[outv]",
    "-an",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(settings.fps),
    outputPath
  );
  return args;
}

function normalizeAudioItem(item, sceneStart) {
  return {
    file: item.file,
    start: sceneStart + numberOr(item.start, numberOr(item.offset, numberOr(item.delay, 0))),
    volume: numberOr(item.volume, 1),
    fadeIn: numberOr(item.fade_in, numberOr(item.fadeIn, 0)),
    fadeOut: numberOr(item.fade_out, numberOr(item.fadeOut, 0)),
    loop: Boolean(item.loop),
    trimStart: numberOr(item.trim_start, numberOr(item.trimStart, 0)),
    trimDuration: item.trim_duration || item.trimDuration || item.duration || null,
    optional: item.optional === true,
    role: item.role || "audio"
  };
}

function collectAudioItems(storyboard, settings, rootDir) {
  const starts = sceneStartTimes(storyboard, settings);
  const items = [];
  const narrationIntervals = [];

  function add(item, sceneStart, role) {
    if (!item || !item.file) return;
    const audio = normalizeAudioItem(Object.assign({}, item, { role }), sceneStart);
    audio.file = path.resolve(rootDir, audio.file);
    if (!fs.existsSync(audio.file)) {
      if (audio.optional) {
        return;
      }
      throw new Error(`Missing required audio asset: ${audio.file}`);
    }
    items.push(audio);
    if (role === "narration" || role === "full_narration") {
      narrationIntervals.push([audio.start, audio.start + numberOr(audio.trimDuration, item.duration || 4)]);
    }
  }

  add(storyboard.full_narration, 0, "full_narration");
  add(storyboard.background_music, 0, "music");
  add(storyboard.ambient_audio, 0, "ambient");
  storyboard.scenes.forEach((scene, index) => {
    const sceneStart = starts[index];
    if (scene.narration && typeof scene.narration === "object") {
      add(scene.narration, sceneStart, "narration");
    }
    (scene.sound_effects || []).forEach((effect) => add(effect, sceneStart, "sfx"));
    (scene.ambient_audio || []).forEach((ambient) => add(ambient, sceneStart, "ambient"));
  });

  return { items, narrationIntervals };
}

function duckExpression(baseVolume, duckVolume, intervals) {
  if (!intervals.length) {
    return String(baseVolume);
  }

  const condition = intervals.map(([start, end]) => `between(t,${start},${end + 0.35})`).join("+");
  return `if(${condition},${duckVolume},${baseVolume})`;
}

function audioFilterForItem(item, inputIndex, outputIndex, totalDuration, narrationIntervals, duckConfig) {
  const filters = [];
  const trimDuration = item.loop ? totalDuration : item.trimDuration;
  filters.push(`[${inputIndex}:a]atrim=start=${item.trimStart}${trimDuration ? `:duration=${trimDuration}` : ""}`);
  filters.push("asetpts=PTS-STARTPTS");
  filters.push(`adelay=${Math.round(item.start * 1000)}:all=1`);

  if (item.role === "music" && duckConfig.enabled) {
    filters.push(`volume='${duckExpression(item.volume, duckConfig.duckVolume, narrationIntervals)}':eval=frame`);
  } else {
    filters.push(`volume=${item.volume}`);
  }

  if (item.fadeIn > 0) {
    filters.push(`afade=t=in:st=${item.start}:d=${item.fadeIn}`);
  }

  if (item.fadeOut > 0) {
    filters.push(`afade=t=out:st=${Math.max(totalDuration - item.fadeOut, 0)}:d=${item.fadeOut}`);
  }

  filters.push(`aformat=sample_rates=48000:channel_layouts=stereo[a${outputIndex}]`);
  return filters.join(",");
}

function buildAudioMixArgs(storyboard, settings, rootDir, videoInput, outputPath) {
  const totalDuration = totalTimelineDuration(storyboard, settings);
  const { items, narrationIntervals } = collectAudioItems(storyboard, settings, rootDir);

  if (!items.length) {
    return ["-y", "-i", videoInput, "-f", "lavfi", "-t", String(totalDuration), "-i", "anullsrc=r=48000:cl=stereo", "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-shortest", outputPath];
  }

  const args = ["-y", "-i", videoInput];
  items.forEach((item) => {
    if (item.loop) {
      args.push("-stream_loop", "-1");
    }
    args.push("-i", item.file);
  });

  const music = storyboard.background_music || {};
  const duckConfig = {
    enabled: Boolean(music.duck_under_narration),
    duckVolume: numberOr(music.duck_volume, 0.06)
  };
  const audioFilters = items.map((item, index) => audioFilterForItem(item, index + 1, index, totalDuration, narrationIntervals, duckConfig));
  const mixInputs = items.map((_, index) => `[a${index}]`).join("");
  audioFilters.push(`${mixInputs}amix=inputs=${items.length}:duration=longest:normalize=0,dynaudnorm=f=150:g=9,alimiter=limit=0.95[outa]`);

  args.push(
    "-filter_complex",
    audioFilters.join(";"),
    "-map",
    "0:v",
    "-map",
    "[outa]",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-shortest",
    outputPath
  );

  return args;
}

function buildFfmpegArgs(storyboard, outputPath) {
  const settings = normalizeSettings(storyboard, "normal");
  return buildSceneRenderArgs(storyboard, storyboard.scenes[0], 0, settings, outputPath);
}

module.exports = {
  buildAudioMixArgs,
  buildFfmpegArgs,
  buildSceneRenderArgs,
  buildVideoCombineArgs,
  escapeDrawtext,
  normalizeSettings,
  resolveFontFile,
  sceneStartTimes,
  totalTimelineDuration,
  transitionDuration
};
