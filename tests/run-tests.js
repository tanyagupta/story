const assert = require("assert");
const { buildFfmpegArgs, validateStoryboard } = require("../src");
const { escapeDrawtext, normalizeSettings } = require("../src/render");

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
    fn();
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
});

test("escapes FFmpeg drawtext-sensitive characters", () => {
  assert.strictEqual(escapeDrawtext("Plan: 'A' [v1]"), "Plan\\: \\'A\\' \\[v1\\]");
});

test("builds an FFmpeg concat graph", () => {
  const args = buildFfmpegArgs(validStoryboard, "out.mp4");
  const graphIndex = args.indexOf("-filter_complex") + 1;
  assert.ok(graphIndex > 0);
  assert.ok(args[graphIndex].includes("drawbox=x=0:y=0:w=100:h=80"));
  assert.ok(args[graphIndex].includes("fontfile="));
  assert.ok(args[graphIndex].includes("concat=n=1:v=1:a=0[outv]"));
  assert.ok(args.includes("out.mp4"));
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
