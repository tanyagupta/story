#!/usr/bin/env node
const { normalizeEntities } = require("./corpus-core");
const { required, resolveIf, printResult, runCli } = require("./cli");

runCli(async (args) => {
  required(args, ["facts", "registry", "out"]);
  const result = normalizeEntities({
    facts: resolveIf(args.facts),
    registry: resolveIf(args.registry),
    out: resolveIf(args.out),
    dryRun: args["dry-run"],
    noOverwrite: !args.force
  });
  printResult({ candidateId: result.candidateId, unresolvedCount: result.entities.filter((entity) => entity.normalizationStatus === "unresolved").length, reviewCount: result.review.length });
});
