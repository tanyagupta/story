#!/usr/bin/env node
const { ingestSource } = require("./corpus-core");
const { required, resolveIf, printResult, runCli } = require("./cli");

runCli(async (args) => {
  required(args, ["manifest", "source"]);
  const result = ingestSource({
    manifest: resolveIf(args.manifest),
    source: resolveIf(args.source),
    out: resolveIf(args.out || args.manifest),
    dryRun: args["dry-run"]
  });
  printResult(result);
});
