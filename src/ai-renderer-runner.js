#!/usr/bin/env node

const { renderAiStoryboard } = require("./ai/ai-renderer");

function parseArgs(argv) {
  const args = argv.slice(2);
  const outIndex = args.indexOf("--out");
  const configIndex = args.indexOf("--config");
  const storyboard = args.find((arg) => !arg.startsWith("-"));
  return {
    preview: args.includes("--preview"),
    storyboard,
    output: outIndex >= 0 ? args[outIndex + 1] : undefined,
    configPath: configIndex >= 0 ? args[configIndex + 1] : undefined
  };
}

if (require.main === module) {
  renderAiStoryboard(parseArgs(process.argv)).catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
