const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { readStoryboard } = require("../index");
const { buildSpeechPlan, generateZeusSpeechMix } = require("../zeus-speech");
const { verify } = require("../../scripts/verify-media");
const { parseStoryboardToSceneObjects } = require("../storyboard/scene-objects");
const { PromptBuilder } = require("./prompt-builder");
const { createProvider } = require("./providers");
const { cleanDir, conformClipDuration, concatClips, muxVideoWithAudioAndSubtitles } = require("../editor/ffmpeg-editor");

dotenv.config({ quiet: true });

const ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_CONFIG = path.join(ROOT, "ai-renderer.config.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function totalDuration(storyboard) {
  return storyboard.scenes.reduce((sum, scene) => sum + Number(scene.duration || 0), 0);
}

function loadConfig(configPath) {
  const configFile = path.resolve(configPath || DEFAULT_CONFIG);
  const config = readJson(configFile);
  return {
    configFile,
    config
  };
}

async function chooseProvider(config) {
  const requested = createProvider(config.provider || "runway", config);
  const requestedAvailability = await requested.isAvailable();
  if (requestedAvailability.ok) {
    return {
      provider: requested,
      requestedProvider: requested.name,
      fallbackReason: null,
      availability: requestedAvailability
    };
  }

  if (requested.name === "runway") {
    const status = requestedAvailability.statusCode ? ` HTTP ${requestedAvailability.statusCode}.` : "";
    const message = requestedAvailability.errorMessage ? ` ${requestedAvailability.errorMessage}` : "";
    throw new Error(`Runway provider unavailable.${status}${message}`);
  }

  const fallbackName = config.fallbackProvider || "mock";
  const fallback = createProvider(fallbackName, config);
  const fallbackAvailability = await fallback.isAvailable();
  if (!fallbackAvailability.ok) {
    throw new Error(
      `Requested provider ${requested.name} unavailable: ${requestedAvailability.reason}. Fallback ${fallback.name} unavailable: ${fallbackAvailability.reason}`
    );
  }
  return {
    provider: fallback,
    requestedProvider: requested.name,
    fallbackReason: requestedAvailability.reason,
    availability: fallbackAvailability
  };
}

function resolveOutput(config, preview) {
  return path.resolve(ROOT, preview ? config.previewOutput : config.renderOutput);
}

async function renderAiStoryboard(options) {
  const mode = options.preview ? "preview" : "render";
  const { configFile, config } = loadConfig(options.configPath);
  const aiConfig = config.ai || {};
  if (options.provider) {
    aiConfig.provider = options.provider;
  }
  const storyboardPath = path.resolve(ROOT, options.storyboard || config.storyboard || "storyboard-zeus.json");
  const outputPath = path.resolve(ROOT, options.output || resolveOutput(aiConfig, options.preview));
  const workDir = path.resolve(ROOT, aiConfig.outputDir || "output/ai-renderer");
  const clipDir = path.join(workDir, `${mode}-clips`);
  const promptDir = path.join(workDir, `${mode}-prompts`);
  const audioDir = path.join(workDir, `${mode}-audio`);
  const subtitleDir = path.join(workDir, `${mode}-subtitles`);
  const conformedDir = path.join(workDir, `${mode}-conformed`);
  const finalSilent = path.join(workDir, `${mode}-silent.mp4`);
  const reportPath = path.join(workDir, `${mode}-report.json`);
  const startedAt = Date.now();

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  cleanDir(clipDir);
  cleanDir(promptDir);
  cleanDir(audioDir);
  cleanDir(conformedDir);
  if (fs.existsSync(finalSilent)) fs.rmSync(finalSilent);
  if (fs.existsSync(outputPath)) fs.rmSync(outputPath);

  const sourceStoryboard = readStoryboard(storyboardPath);
  const speechPlan = buildSpeechPlan(sourceStoryboard, {
    audioPath: path.join(audioDir, "zeus_speech_mix.wav")
  });
  const storyboard = speechPlan.storyboard;
  const seconds = totalDuration(storyboard);
  const sceneObjects = parseStoryboardToSceneObjects(storyboard);
  const promptBuilder = new PromptBuilder({
    aspectRatio: aiConfig.aspectRatio || "16:9",
    style: aiConfig.style
  });
  const prompts = promptBuilder.buildStoryboardPrompts(sceneObjects);
  const providerChoice = await chooseProvider(aiConfig);
  const audioPath = generateZeusSpeechMix(audioDir, seconds, speechPlan.entries);

  console.log(`AI renderer config: ${configFile}`);
  console.log(`Storyboard loaded by AI renderer: ${storyboardPath}`);
  console.log(`Requested provider: ${providerChoice.requestedProvider}`);
  console.log(`Active provider: ${providerChoice.provider.name}`);
  if (providerChoice.fallbackReason) {
    console.log(`Provider fallback: ${providerChoice.fallbackReason}`);
  }
  if (providerChoice.provider.name === "runway") {
    const auth = providerChoice.availability || {};
    console.log(`Runway authentication: success HTTP ${auth.statusCode || "unknown"}`);
    if (auth.organization) {
      const tier = auth.organization.tier || auth.organization.usageTier || auth.organization.plan || "unknown";
      console.log(`Runway organization/workspace: tier=${tier}`);
    }
  }
  sceneObjects.scenes.forEach((scene) => {
    console.log(
      `Scene ${scene.number}: ${scene.id} duration=${scene.duration}s camera=${scene.camera} characters=${scene.characters
        .map((character) => character.id)
        .join(",")}`
    );
  });

  const rendered = [];
  let activeProvider = providerChoice.provider;
  let fallbackReason = providerChoice.fallbackReason;
  for (const item of prompts) {
    const clipPath = path.join(clipDir, `scene_${String(item.scene.number).padStart(2, "0")}.mp4`);
    const promptFile = path.join(promptDir, `scene_${String(item.scene.number).padStart(2, "0")}.txt`);
    const request = {
      scene: item.scene,
      prompt: item.prompt,
      promptFile,
      outputPath: clipPath,
      width: sceneObjects.settings.width,
      height: sceneObjects.settings.height,
      fps: Number(aiConfig.fps || sceneObjects.settings.fps)
    };
    try {
      const result = await activeProvider.renderScene(request);
      if (activeProvider.name === "runway") {
        const conformedPath = path.join(conformedDir, `scene_${String(item.scene.number).padStart(2, "0")}.mp4`);
        conformClipDuration(
          result.outputPath,
          conformedPath,
          item.scene.duration,
          sceneObjects.settings.width,
          sceneObjects.settings.height,
          Number(aiConfig.fps || sceneObjects.settings.fps)
        );
        result.sourceOutputPath = result.outputPath;
        result.outputPath = conformedPath;
        result.conformedOutputPath = conformedPath;
      }
      rendered.push(result);
    } catch (error) {
      if (activeProvider.name === "mock") throw error;
      if (activeProvider.name === "runway") {
        throw new Error(`Runway render failed without mock fallback: ${error.message}`);
      }
      fallbackReason = `${activeProvider.name} render failed: ${error.message}`;
      console.log(`Provider fallback: ${fallbackReason}`);
      activeProvider = createProvider(aiConfig.fallbackProvider || "mock", aiConfig);
      cleanDir(clipDir);
      rendered.length = 0;
      for (const fallbackItem of prompts) {
        const fallbackClipPath = path.join(clipDir, `scene_${String(fallbackItem.scene.number).padStart(2, "0")}.mp4`);
        const fallbackPromptFile = path.join(promptDir, `scene_${String(fallbackItem.scene.number).padStart(2, "0")}.txt`);
        rendered.push(
          await activeProvider.renderScene({
            scene: fallbackItem.scene,
            prompt: fallbackItem.prompt,
            promptFile: fallbackPromptFile,
            outputPath: fallbackClipPath,
            width: sceneObjects.settings.width,
            height: sceneObjects.settings.height,
            fps: Number(aiConfig.fps || sceneObjects.settings.fps)
          })
        );
      }
      break;
    }
  }

  concatClips(rendered.map((item) => item.outputPath), finalSilent, workDir);
  const mux = muxVideoWithAudioAndSubtitles({
    videoPath: finalSilent,
    audioPath,
    speechEntries: speechPlan.entries,
    subtitleDir,
    outputPath
  });

  const stat = fs.statSync(outputPath);
  if (stat.mtimeMs < startedAt || stat.size === 0) {
    throw new Error(`AI renderer did not create a fresh non-empty output file: ${outputPath}`);
  }

  const verification = verify(outputPath, {
    prefix: path.basename(outputPath, ".mp4"),
    times: [1.0, Math.max(seconds / 2, 1.5), Math.max(seconds - 1.0, 1.0)]
  });
  const report = {
    mode,
    storyboardPath,
    outputPath,
    configFile,
    requestedProvider: providerChoice.requestedProvider,
    provider: activeProvider.name,
    fallbackReason,
    prompts: prompts.map((item) => ({
      scene: item.scene.id,
      prompt: item.prompt,
      promptFile: path.join(promptDir, `scene_${String(item.scene.number).padStart(2, "0")}.txt`)
    })),
    rendered,
    ffmpegCommand: mux.ffmpegCommand,
    mtime: stat.mtime.toISOString(),
    verification
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  return report;
}

module.exports = {
  renderAiStoryboard,
  loadConfig,
  chooseProvider
};
