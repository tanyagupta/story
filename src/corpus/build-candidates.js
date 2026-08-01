#!/usr/bin/env node
const { buildCandidate } = require("./corpus-core");
const { required, resolveIf, listArg, printResult, runCli } = require("./cli");

runCli(async (args) => {
  required(args, ["passages", "out"]);
  const result = buildCandidate({
    passages: resolveIf(args.passages),
    out: resolveIf(args.out),
    selected: listArg(args._[0] || args.selected),
    candidateId: args["candidate-id"],
    sourceId: args["source-id"],
    title: args.title,
    status: args.status,
    dryRun: args["dry-run"],
    noOverwrite: !args.force
  });
  printResult(result);
});
