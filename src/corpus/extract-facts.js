#!/usr/bin/env node
const { extractFacts } = require("./corpus-core");
const { required, resolveIf, printResult, runCli } = require("./cli");

runCli(async (args) => {
  required(args, ["candidate", "passages", "registry", "vocabulary", "out"]);
  const result = extractFacts({
    candidate: resolveIf(args.candidate),
    passages: resolveIf(args.passages),
    registry: resolveIf(args.registry),
    vocabulary: resolveIf(args.vocabulary),
    out: resolveIf(args.out),
    dryRun: args["dry-run"],
    noOverwrite: !args.force
  });
  printResult({ candidateId: result.candidateId, entityCount: result.entities.length, eventCount: result.events.length, reviewCount: result.review.length });
});
