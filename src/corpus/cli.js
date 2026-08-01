const path = require("path");
const minimist = require("minimist");

function parseCommon(argv) {
  return minimist(argv.slice(2), {
    boolean: ["dry-run", "force"],
    string: ["manifest", "source", "out", "passages", "candidate", "candidate-id", "title", "source-id", "facts", "registry", "vocabulary", "normalized-facts", "myth-id", "myth-family-id", "variant-id", "report"]
  });
}

function required(args, names) {
  names.forEach((name) => {
    if (!args[name]) throw new Error(`Missing required option --${name}`);
  });
}

function resolveIf(value) {
  return value ? path.resolve(process.cwd(), value) : value;
}

function listArg(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function printResult(result) {
  console.log(JSON.stringify(result, null, 2));
}

function runCli(handler) {
  handler(parseCommon(process.argv)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { required, resolveIf, listArg, printResult, runCli };
