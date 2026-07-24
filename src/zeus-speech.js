const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const ffprobe = require("ffprobe-static");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_VOICE_DIR = path.join(ROOT, "assets", "generated", "voices", "zeus");

function run(command, args, label, options) {
  console.log(`+ ${[command].concat(args).join(" ")}`);
  const result = spawnSync(command, args, Object.assign({ encoding: "utf8" }, options || {}));
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
  return result;
}

function commandExists(command) {
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

function listSayVoices() {
  if (!commandExists("say")) {
    throw new Error("macOS say command was not found; cannot generate local speech.");
  }
  const result = run("say", ["-v", "?"], "listing local macOS voices");
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.match(/^(.+?)\s{2,}[a-z]{2}_[A-Z]{2}\s+#/)?.[1].trim())
    .filter(Boolean);
}

function chooseVoice(available, preferred) {
  for (const name of preferred) {
    if (available.includes(name)) return name;
  }
  const simplified = available.find((name) => !name.includes("("));
  if (simplified) return simplified;
  throw new Error(`No usable macOS say voice found. Available voices: ${available.join(", ")}`);
}

function resolveVoiceConfig(storyboard) {
  const available = listSayVoices();
  const configured = storyboard.voices || {};
  const voice = (role, preferred, fallbackRate) => {
    const entry = configured[role] || {};
    const name = entry.name && available.includes(entry.name) ? entry.name : chooseVoice(available, preferred);
    return {
      name,
      rate: Number(entry.rate || fallbackRate)
    };
  };
  return {
    narrator: voice("narrator", ["Samantha", "Ava", "Allison", "Karen", "Alex"], 168),
    zeus: voice("zeus", ["Daniel", "Ralph", "Alex", "Fred"], 145),
    hermes: voice("hermes", ["Alex", "Fred", "Junior", "Samantha"], 176)
  };
}

function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 42) || "line";
}

function stableName(sceneIndex, speaker, lineIndex, text, voice, rate) {
  const hash = crypto
    .createHash("sha1")
    .update(JSON.stringify({ text, voice, rate }))
    .digest("hex")
    .slice(0, 10);
  return `scene${String(sceneIndex).padStart(2, "0")}_${speaker}_${String(lineIndex).padStart(2, "0")}_${slug(text)}_${hash}`;
}

function ffprobeDuration(file) {
  const result = run(ffprobe.path, ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file], `probing duration for ${file}`);
  const duration = Number(result.stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Generated speech has invalid duration: ${file}`);
  }
  return duration;
}

function synthesizeSpeech(line, voiceDir) {
  fs.mkdirSync(voiceDir, { recursive: true });
  const base = stableName(line.sceneIndex, line.speaker, line.lineIndex, line.text, line.voice, line.rate);
  const aiff = path.join(voiceDir, `${base}.aiff`);
  const wav = path.join(voiceDir, `${base}.wav`);
  const meta = path.join(voiceDir, `${base}.json`);
  const metadata = {
    provider: "macos_say",
    text: line.text,
    voice: line.voice,
    rate: line.rate,
    speaker: line.speaker,
    scene_id: line.sceneId
  };

  let cached = false;
  if (fs.existsSync(wav) && fs.existsSync(meta)) {
    try {
      const existing = JSON.parse(fs.readFileSync(meta, "utf8"));
      cached = JSON.stringify(existing) === JSON.stringify(metadata) && fs.statSync(wav).size > 0;
    } catch (_) {
      cached = false;
    }
  }

  if (!cached) {
    if (fs.existsSync(aiff)) fs.rmSync(aiff);
    if (fs.existsSync(wav)) fs.rmSync(wav);
    run("say", ["-v", line.voice, "-r", String(line.rate), "-o", aiff, "--", line.text], `generating speech for ${line.speaker}`);
    run(ffmpegPath, ["-y", "-i", aiff, "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", wav], `converting speech to WAV for ${line.speaker}`);
    fs.writeFileSync(meta, `${JSON.stringify(metadata, null, 2)}\n`);
  }

  const duration = ffprobeDuration(wav);
  return {
    file: wav,
    duration,
    cached
  };
}

function collectSpeechLines(storyboard, voices) {
  const lines = [];
  storyboard.scenes.forEach((scene, sceneOffset) => {
    const sceneIndex = sceneOffset + 1;
    let lineIndex = 0;
    if (typeof scene.narration === "string" && scene.narration.trim()) {
      lines.push({
        sceneIndex,
        sceneId: scene.id || `scene_${sceneIndex}`,
        lineIndex: lineIndex++,
        speaker: "narrator",
        character: null,
        text: scene.narration.trim(),
        preferredStart: Number(scene.narration_start ?? 0.55),
        voice: voices.narrator.name,
        rate: voices.narrator.rate
      });
    }
    (scene.dialogue || []).forEach((line) => {
      const speaker = String(line.character || "narrator").toLowerCase();
      const voice = voices[speaker] || voices.narrator;
      lines.push({
        sceneIndex,
        sceneId: scene.id || `scene_${sceneIndex}`,
        lineIndex: lineIndex++,
        speaker,
        character: speaker === "narrator" ? null : speaker,
        text: String(line.text || "").trim(),
        preferredStart: Number(line.start ?? 0.55),
        voice: voice.name,
        rate: voice.rate
      });
    });
  });
  return lines.filter((line) => line.text);
}

function buildSpeechPlan(storyboard, options) {
  const voiceDir = options.voiceDir || DEFAULT_VOICE_DIR;
  const voices = resolveVoiceConfig(storyboard);
  const lines = collectSpeechLines(storyboard, voices).map((line) => {
    const generated = synthesizeSpeech(line, voiceDir);
    return Object.assign({}, line, generated);
  });

  const resolvedScenes = storyboard.scenes.map((scene) => Object.assign({}, scene));
  const entries = [];
  let sceneStart = 0;
  for (let sceneIndex = 1; sceneIndex <= resolvedScenes.length; sceneIndex += 1) {
    const scene = resolvedScenes[sceneIndex - 1];
    const sceneLines = lines
      .filter((line) => line.sceneIndex === sceneIndex)
      .sort((a, b) => a.preferredStart - b.preferredStart || a.lineIndex - b.lineIndex);
    let cursor = 0.35;
    let sceneDuration = Number(scene.duration);
    sceneLines.forEach((line) => {
      const relativeStart = Math.max(line.preferredStart, cursor);
      const relativeEnd = relativeStart + line.duration;
      cursor = relativeEnd + 0.32;
      sceneDuration = Math.max(sceneDuration, relativeEnd + 0.65);
      entries.push(Object.assign({}, line, {
        relativeStart,
        relativeEnd,
        absoluteStart: sceneStart + relativeStart,
        absoluteEnd: sceneStart + relativeEnd,
        subtitleStart: sceneStart + Math.max(0, relativeStart - 0.05),
        subtitleEnd: sceneStart + relativeEnd + 0.2
      }));
    });
    scene.duration = Math.ceil(sceneDuration * 10) / 10;
    sceneStart += scene.duration;
  }

  const resolvedStoryboard = Object.assign({}, storyboard, {
    scenes: resolvedScenes,
    background_music: Object.assign({}, storyboard.background_music || {}, {
      file: options.audioPath || "output/zeus-story-speech-v2-audio/zeus_speech_mix.wav"
    })
  });
  return {
    voices,
    entries,
    storyboard: resolvedStoryboard,
    totalDuration: sceneStart
  };
}

function duckExpression(entries) {
  if (!entries.length) return "0.12";
  const terms = entries.map((entry) => `between(t\\,${entry.absoluteStart.toFixed(3)}\\,${entry.absoluteEnd.toFixed(3)})`);
  return `if(${terms.join("+")}\\,0.035\\,0.12)`;
}

function generateZeusSpeechMix(outputDir, totalSeconds, speechEntries) {
  fs.mkdirSync(outputDir, { recursive: true });
  const out = path.join(outputDir, "zeus_speech_mix.wav");
  if (fs.existsSync(out)) fs.rmSync(out);

  const sources = [
    `sine=frequency=146:duration=${totalSeconds}:sample_rate=48000`,
    `sine=frequency=220:duration=${totalSeconds}:sample_rate=48000`,
    `sine=frequency=330:duration=${totalSeconds}:sample_rate=48000`,
    `anoisesrc=color=brown:duration=${totalSeconds}:sample_rate=48000:amplitude=0.12`,
    "sine=frequency=740:duration=0.35:sample_rate=48000",
    "anoisesrc=color=white:duration=1.2:sample_rate=48000:amplitude=0.7",
    "sine=frequency=980:duration=0.55:sample_rate=48000",
    "sine=frequency=980:duration=0.55:sample_rate=48000",
    "sine=frequency=520:duration=1.1:sample_rate=48000",
    "sine=frequency=740:duration=0.35:sample_rate=48000"
  ];
  const inputArgs = [];
  sources.forEach((source) => inputArgs.push("-f", "lavfi", "-i", source));
  speechEntries.forEach((entry) => inputArgs.push("-i", entry.file));

  const filters = [
    `[0:a]volume='${duckExpression(speechEntries)}':eval=frame,tremolo=f=5:d=0.25[a0]`,
    "[1:a]volume=0.07,afade=t=in:st=0:d=1.2[a1]",
    "[2:a]volume=0.045,adelay=6000:all=1[a2]",
    "[3:a]lowpass=f=900,volume=0.11[a3]",
    "[4:a]volume=0.38,adelay=4000:all=1[a4]",
    "[5:a]lowpass=f=240,volume=0.42,adelay=15500:all=1[a5]",
    "[6:a]volume=0.34,tremolo=f=16:d=0.8,adelay=18700:all=1[a6]",
    "[7:a]volume=0.3,tremolo=f=22:d=0.8,adelay=24500:all=1[a7]",
    "[8:a]volume=0.32,afade=t=in:st=0:d=0.2,adelay=30500:all=1[a8]",
    "[9:a]volume=0.38,adelay=33000:all=1[a9]"
  ];
  const labels = ["[a0]", "[a1]", "[a2]", "[a3]", "[a4]", "[a5]", "[a6]", "[a7]", "[a8]", "[a9]"];
  speechEntries.forEach((entry, index) => {
    const label = `[sp${index}]`;
    const delay = Math.round(entry.absoluteStart * 1000);
    filters.push(`[${10 + index}:a]aresample=48000,aformat=channel_layouts=stereo,volume=1.12,adelay=${delay}:all=1${label}`);
    labels.push(label);
  });
  filters.push(`${labels.join("")}amix=inputs=${labels.length}:duration=longest:normalize=0,dynaudnorm=f=120:g=8,alimiter=limit=0.96[out]`);

  run(ffmpegPath, [
    "-y",
    ...inputArgs,
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[out]",
    "-t",
    String(totalSeconds),
    "-ar",
    "48000",
    "-ac",
    "2",
    out
  ], "mixing Zeus speech, music, and effects");

  return out;
}

module.exports = {
  buildSpeechPlan,
  generateZeusSpeechMix,
  listSayVoices,
  DEFAULT_VOICE_DIR
};
