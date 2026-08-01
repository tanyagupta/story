#!/usr/bin/env node

const { renderAiStoryboard } = require("./ai/ai-renderer");

function parseArgs(argv) {
  const args = argv.slice(2);
  const outIndex = args.indexOf("--out");
  const configIndex = args.indexOf("--config");
  const providerIndex = args.indexOf("--provider");
  const optionValueIndexes = new Set(
    [outIndex, configIndex, providerIndex].filter((index) => index >= 0).map((index) => index + 1)
  );
  const storyboard = args.find((arg, index) => !arg.startsWith("-") && !optionValueIndexes.has(index));
  return {
    preview: args.includes("--preview"),
    storyboard,
    output: outIndex >= 0 ? args[outIndex + 1] : undefined,
    configPath: configIndex >= 0 ? args[configIndex + 1] : undefined,
    provider: providerIndex >= 0 ? args[providerIndex + 1] : undefined
  };
}

if (require.main === module) {
  renderAiStoryboard(parseArgs(process.argv)).catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
