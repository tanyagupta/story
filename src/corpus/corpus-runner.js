#!/usr/bin/env node
const path = require("path");
const fs = require("fs");
const {
  ingestSource,
  extractPassages,
  buildCandidate,
  extractFacts,
  normalizeEntities,
  normalizeEvents,
  buildMythRecord,
  validateCorpus,
  writeJson,
  uniqueReviewItems
} = require("./corpus-core");
const { resolveIf, printResult, runCli } = require("./cli");

function cleanGenerated(dir) {
  ["passages", "candidates", "extracted", "normalized", "review"].forEach((name) => {
    fs.mkdirSync(path.join(dir, name), { recursive: true });
  });
}

runCli(async (args) => {
  const fixtureRoot = resolveIf(args.fixtures) || path.resolve(process.cwd(), "tests/fixtures/corpus");
  const outRoot = resolveIf(args.out) || path.resolve(process.cwd(), "corpus");
  const registry = resolveIf(args.registry) || path.join(outRoot, "normalized/entity-registry.json");
  const vocabulary = resolveIf(args.vocabulary) || path.join(outRoot, "normalized/action-vocabulary.json");
  cleanGenerated(outRoot);
  const sourceNames = args.sources ? String(args.sources).split(",") : ["prose", "verse", "ambiguous", "variant-a", "variant-b"];
  const files = { manifests: [], passages: [], candidates: [], extracted: [], myths: [], review: [] };
  sourceNames.forEach((name, index) => {
    const manifest = path.join(fixtureRoot, "manifests", `${name}.json`);
    const raw = path.join(fixtureRoot, "raw", `${name}.xml`);
    const ingestedManifest = path.join(outRoot, "manifests", `${name}.json`);
    const passages = path.join(outRoot, "passages", `${name}.passages.json`);
    const candidate = path.join(outRoot, "candidates", `${name}.candidate.json`);
    const extracted = path.join(outRoot, "extracted", `${name}.facts.json`);
    const entityFacts = path.join(outRoot, "extracted", `${name}.entities-normalized.json`);
    const eventFacts = path.join(outRoot, "extracted", `${name}.events-normalized.json`);
    const myth = path.join(outRoot, "normalized", `${name}.myth.json`);
    const ingested = ingestSource({ manifest, source: raw, out: ingestedManifest, dryRun: args["dry-run"] });
    const passageDoc = extractPassages({ manifest: ingestedManifest, source: raw, out: passages, dryRun: args["dry-run"] });
    const candidateDoc = buildCandidate({
      passages,
      out: candidate,
      candidateId: `${name}-candidate`,
      title: name.indexOf("variant") === 0 ? "Conflicting Apple Theft Variant" : "Fixture Myth Episode",
      status: "awaiting_extraction",
      noOverwrite: false,
      dryRun: args["dry-run"]
    });
    const facts = extractFacts({ candidate, passages, registry, vocabulary, out: extracted, noOverwrite: false, dryRun: args["dry-run"] });
    const normalizedEntities = normalizeEntities({ facts: extracted, registry, out: entityFacts, noOverwrite: false, dryRun: args["dry-run"] });
    const normalizedEvents = normalizeEvents({ facts: entityFacts, registry, vocabulary, out: eventFacts, noOverwrite: false, dryRun: args["dry-run"] });
    const mythDoc = buildMythRecord({
      candidate,
      normalizedFacts: eventFacts,
      registry,
      out: myth,
      mythId: `myth-fixture-${String(index + 1).padStart(4, "0")}`,
      mythFamilyId: name.indexOf("variant") === 0 ? "conflicting-apple-theft" : "fixture-myth-episode",
      variantId: `${ingested.sourceId}-variant`,
      noOverwrite: false,
      dryRun: args["dry-run"]
    });
    const reviewFile = path.join(outRoot, "review", `${name}.review.json`);
    writeJson(reviewFile, { items: uniqueReviewItems(mythDoc.normalizationWarnings.concat(normalizedEvents.review || normalizedEntities.review || facts.review || [])) }, { dryRun: args["dry-run"] });
    files.manifests.push(ingestedManifest);
    files.passages.push(passages);
    files.candidates.push(candidate);
    files.extracted.push(extracted);
    files.myths.push(myth);
    files.review.push(reviewFile);
    void passageDoc;
    void candidateDoc;
  });
  const reportFile = path.join(outRoot, "review", "validation-report.json");
  const report = validateCorpus(Object.assign({}, files, {
    registries: [registry],
    out: reportFile,
    dryRun: args["dry-run"]
  }));
  printResult({ valid: report.valid, outRoot, report: reportFile, sources: sourceNames.length });
  if (!report.valid) process.exitCode = 1;
});
