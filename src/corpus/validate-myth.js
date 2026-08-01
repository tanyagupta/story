#!/usr/bin/env node
const path = require("path");
const { validateCorpus } = require("./corpus-core");
const { resolveIf, listArg, printResult, runCli } = require("./cli");

runCli(async (args) => {
  const report = validateCorpus({
    schemaDir: resolveIf(args.schemas) || path.resolve(process.cwd(), "schemas"),
    manifests: listArg(args.manifests || args.manifest).map(resolveIf),
    passages: listArg(args.passages).map(resolveIf),
    candidates: listArg(args.candidates || args.candidate).map(resolveIf),
    registries: listArg(args.registries || args.registry).map(resolveIf),
    extracted: listArg(args.extracted || args.facts).map(resolveIf),
    myths: listArg(args.myths || args.myth).map(resolveIf),
    review: listArg(args.review).map(resolveIf),
    out: resolveIf(args.out || args.report),
    dryRun: args["dry-run"]
  });
  console.log(report.valid ? "Corpus validation passed" : "Corpus validation failed");
  console.log(`${report.errors.length} errors, ${report.warnings.length} warnings`);
  if (report.errors.length) {
    report.errors.slice(0, 10).forEach((error) => console.log(`- ${error.type}: ${error.message} (${error.file})`));
  }
  if (args.json) printResult(report);
  if (!report.valid) process.exitCode = 1;
});
