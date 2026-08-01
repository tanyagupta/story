const assert = require("assert");
const { buildFfmpegArgs, validateStoryboard } = require("../src");
const { escapeDrawtext, normalizeSettings } = require("../src/render");
const { parseStoryboardToSceneObjects } = require("../src/storyboard/scene-objects");
const { PromptBuilder } = require("../src/ai/prompt-builder");
const { createProvider } = require("../src/ai/providers");
const pendingTests = [];

const validStoryboard = {
  settings: {
    width: 640,
    height: 360,
    fps: 24,
    defaultDuration: 2,
    fontFile: "/tmp/TestSans.ttf"
  },
  scenes: [
    {
      id: "one",
      title: "One",
      background: "#112233",
      shapes: [
        {
          type: "rect",
          x: 0,
          y: 0,
          width: 100,
          height: 80,
          color: "#abcdef"
        },
        {
          type: "text",
          x: 24,
          y: 32,
          text: "Hello",
          color: "#ffffff"
        }
      ]
    }
  ]
};

function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === "function") {
      pendingTests.push(
        result
          .then(() => {
            console.log(`ok - ${name}`);
          })
          .catch((error) => {
            console.error(`not ok - ${name}`);
            console.error(error.stack);
            process.exitCode = 1;
          })
      );
      return;
    }
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error.stack);
    process.exitCode = 1;
  }
}

test("validates a complete storyboard", () => {
  assert.strictEqual(validateStoryboard(validStoryboard), validStoryboard);
});

test("rejects invalid colors", () => {
  assert.throws(
    () => validateStoryboard({ scenes: [{ background: "blue", shapes: [] }] }),
    /background must be a #RRGGBB color/
  );
});

test("rejects missing text on text shapes", () => {
  assert.throws(
    () => validateStoryboard({ scenes: [{ shapes: [{ type: "text" }] }] }),
    /text is required/
  );
});

test("normalizes render settings", () => {
  const settings = normalizeSettings(validStoryboard);
  assert.strictEqual(settings.width, 640);
  assert.strictEqual(settings.height, 360);
  assert.strictEqual(settings.fps, 24);
  assert.strictEqual(settings.defaultDuration, 2);
  assert.strictEqual(settings.fontFile, "/tmp/TestSans.ttf");
  assert.strictEqual(settings.mode, undefined);
});

test("escapes FFmpeg drawtext-sensitive characters", () => {
  assert.strictEqual(escapeDrawtext("Plan: 'A' [v1]"), "Plan\\: \\'A\\' \\[v1\\]");
});

test("builds FFmpeg scene render arguments for legacy shapes", () => {
  const args = buildFfmpegArgs(validStoryboard, "out.mp4");
  const graphIndex = args.indexOf("-filter_complex") + 1;
  assert.ok(graphIndex > 0);
  assert.ok(args[graphIndex].includes("drawbox=x=0:y=0:w=100:h=80"));
  assert.ok(args[graphIndex].includes("fontfile="));
  assert.ok(args[graphIndex].includes("format=yuv420p"));
  assert.ok(args.includes("out.mp4"));
});

test("validates layered animated storyboards", () => {
  const layered = {
    resolution: [1920, 1080],
    fps: 30,
    background_music: {
      file: "music.wav",
      volume: 0.2,
      loop: true,
      duck_under_narration: true,
      duck_volume: 0.06
    },
    scenes: [
      {
        duration: 4,
        transition: { type: "crossfade", duration: 0.5 },
        layers: [
          {
            file: "background.png",
            z_index: 0,
            position: [0, 0],
            animation: {
              type: "slow_zoom_in",
              start_scale: 1,
              end_scale: 1.05,
              easing: "ease_in_out"
            }
          }
        ],
        caption: {
          text: "The spark arrives.",
          start: 1,
          duration: 2,
          animation: "progressive"
        },
        narration: {
          file: "voice.wav",
          start: 0.2,
          volume: 1
        },
        sound_effects: [{ file: "spark.wav", start: 1.4, volume: 0.7 }]
      }
    ]
  };

  assert.strictEqual(validateStoryboard(layered), layered);
});

test("rejects missing required audio during render setup", () => {
  const { buildAudioMixArgs, normalizeSettings } = require("../src/render");
  const missing = {
    resolution: [1280, 720],
    background_music: {
      file: "missing-music.wav",
      volume: 0.35
    },
    scenes: [
      {
        duration: 2,
        layers: [{ file: "placeholder.png" }]
      }
    ]
  };

  assert.throws(
    () => buildAudioMixArgs(missing, normalizeSettings(missing, "normal"), process.cwd(), "video.mp4", "out.mp4"),
    /Missing required audio asset/
  );
});

test("parses Zeus-style scenes into renderer-neutral scene objects", () => {
  const parsed = parseStoryboardToSceneObjects({
    title: "Tiny myth",
    resolution: [1280, 720],
    fps: 15,
    renderer: "blender",
    scenes: [
      {
        id: "arrival",
        title: "Arrival",
        duration: 4,
        narration: "Zeus enters.",
        dialogue: [{ character: "zeus", text: "Who took my thunder?", start: 1.2 }],
        blender_scene: {
          environment: "olympus_terrace",
          camera: "establishing_push",
          lighting: "warm_dawn",
          characters: [{ id: "zeus", expression: "concerned", actions: ["walk", "point"] }],
          props: ["empty_pedestal"]
        }
      }
    ]
  });
  assert.strictEqual(parsed.settings.width, 1280);
  assert.strictEqual(parsed.scenes[0].environment, "olympus_terrace");
  assert.strictEqual(parsed.scenes[0].characters[0].id, "zeus");
  assert.strictEqual(parsed.scenes[0].dialogue.length, 2);
});

test("builds AI prompts with character, camera, lighting, dialogue, and duration", () => {
  const parsed = parseStoryboardToSceneObjects({
    title: "Tiny myth",
    scenes: [
      {
        title: "Arrival",
        duration: 4,
        dialogue: [{ character: "hermes", text: "Look there." }],
        blender_scene: {
          environment: "rocky_valley",
          camera: "tracking_then_closeup",
          lighting: "storm_flashes",
          characters: [{ id: "hermes", actions: ["run", "point"], expression: "urgent" }]
        }
      }
    ]
  });
  const prompt = new PromptBuilder({ style: "test style" }).buildScenePrompt(parsed.scenes[0], parsed);
  assert.ok(prompt.includes("4.0 second"));
  assert.ok(prompt.includes("Hermes"));
  assert.ok(prompt.includes("tracking_then_closeup"));
  assert.ok(prompt.includes("storm_flashes"));
  assert.ok(prompt.includes("Look there."));
});

test("creates AI providers and future provider stubs", () => {
  assert.strictEqual(createProvider("mock", {}).name, "mock");
  assert.strictEqual(createProvider("runway", {}).name, "runway");
  assert.strictEqual(createProvider("veo", {}).name, "veo");
  assert.strictEqual(createProvider("kling", {}).name, "kling");
  assert.strictEqual(createProvider("luma", {}).name, "luma");
});

test("does not fall back to mock when explicit Runway authentication is unavailable", async () => {
  const { chooseProvider } = require("../src/ai/ai-renderer");
  const oldRunwayKey = process.env.RUNWAY_API_KEY;
  const oldRunwaySecret = process.env.RUNWAYML_API_SECRET;
  delete process.env.RUNWAY_API_KEY;
  delete process.env.RUNWAYML_API_SECRET;
  try {
    await assert.rejects(
      () => chooseProvider({ provider: "runway", fallbackProvider: "mock" }),
      /Runway provider unavailable/
    );
  } finally {
    if (oldRunwayKey === undefined) delete process.env.RUNWAY_API_KEY;
    else process.env.RUNWAY_API_KEY = oldRunwayKey;
    if (oldRunwaySecret === undefined) delete process.env.RUNWAYML_API_SECRET;
    else process.env.RUNWAYML_API_SECRET = oldRunwaySecret;
  }
});

Promise.all(pendingTests).then(() => {
  if (process.exitCode) {
    process.exit(process.exitCode);
  }
});
