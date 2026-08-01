#!/usr/bin/env node
const { extractPassages } = require("./corpus-core");
const { required, resolveIf, printResult, runCli } = require("./cli");

runCli(async (args) => {
  required(args, ["manifest", "source", "out"]);
  const result = extractPassages({
    manifest: resolveIf(args.manifest),
    source: resolveIf(args.source),
    out: resolveIf(args.out),
    dryRun: args["dry-run"]
  });
  printResult({ sourceId: result.sourceId, passageCount: result.passages.length, warningCount: result.warnings.length, out: args.out });
});
