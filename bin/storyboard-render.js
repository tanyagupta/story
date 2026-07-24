#!/usr/bin/env node

const path = require("path");
const { renderStoryboardFile } = require("../src");

function printUsage() {
  console.log("Usage: storyboard-render <storyboard.json> [--out <video.mp4>] [--preview]");
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const input = args.find((arg) => !arg.startsWith("-"));
  const outIndex = args.indexOf("--out");
  const output = outIndex >= 0 ? args[outIndex + 1] : null;
  const preview = args.includes("--preview");

  if (!input || (output && output.startsWith("-"))) {
    return null;
  }

  return {
    input: path.resolve(process.cwd(), input),
    output: output ? path.resolve(process.cwd(), output) : null,
    preview
  };
}

async function main() {
  const parsed = parseArgs(process.argv);
  if (!parsed) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const result = await renderStoryboardFile(parsed.input, parsed.output, { preview: parsed.preview });
  console.log(`Rendered ${result.sceneCount} scenes (${result.mode}) to ${result.output}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
