#!/usr/bin/env node
const { normalizeEvents, buildMythRecord, writeJson } = require("./corpus-core");
const { required, resolveIf, printResult, runCli } = require("./cli");

runCli(async (args) => {
  required(args, ["facts", "registry", "vocabulary", "candidate", "out"]);
  const normalized = normalizeEvents({
    facts: resolveIf(args.facts),
    registry: resolveIf(args.registry),
    vocabulary: resolveIf(args.vocabulary),
    dryRun: args["dry-run"]
  });
  const mythOut = resolveIf(args.out);
  const tempFacts = args["normalized-facts"] ? resolveIf(args["normalized-facts"]) : mythOut.replace(/\.json$/i, ".events-normalized.json");
  writeJson(tempFacts, normalized, { dryRun: args["dry-run"], noOverwrite: !args.force });
  const myth = buildMythRecord({
    candidate: resolveIf(args.candidate),
    normalizedFacts: tempFacts,
    registry: resolveIf(args.registry),
    out: mythOut,
    mythId: args["myth-id"],
    mythFamilyId: args["myth-family-id"],
    variantId: args["variant-id"],
    title: args.title,
    dryRun: args["dry-run"],
    noOverwrite: !args.force
  });
  printResult({ mythId: myth.mythId, eventCount: myth.events.length, reviewStatus: myth.reviewStatus });
});
