const assert = require("assert");
const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  ingestSource,
  extractPassages,
  buildCandidate,
  extractFacts,
  normalizeEntities,
  normalizeEvents,
  buildMythRecord,
  validateCorpus,
  sha256File,
  writeJson,
  readJson,
  portablePath,
  portableReportValue
} = require("../../src/corpus/corpus-core");
const { validateProductionCorpus } = require("../../src/corpus/production-validate");

const root = path.resolve(__dirname, "../..");
const fixtureRoot = path.join(root, "tests/fixtures/corpus");
const tempRoot = path.join(root, "tests/tmp/corpus");
const registry = path.join(root, "corpus/normalized/entity-registry.json");
const vocabulary = path.join(root, "corpus/normalized/action-vocabulary.json");
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function fixture(name, kind) {
  return path.join(fixtureRoot, kind, `${name}.${kind === "raw" ? "xml" : "json"}`);
}

function prepare(name) {
  const dir = path.join(tempRoot, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function runOne(name) {
  const dir = prepare(name);
  const manifest = path.join(dir, `${name}.manifest.json`);
  const passages = path.join(dir, `${name}.passages.json`);
  const candidate = path.join(dir, `${name}.candidate.json`);
  const facts = path.join(dir, `${name}.facts.json`);
  const entityFacts = path.join(dir, `${name}.entities.json`);
  const eventFacts = path.join(dir, `${name}.events.json`);
  const myth = path.join(dir, `${name}.myth.json`);
  ingestSource({ manifest: fixture(name, "manifests"), source: fixture(name, "raw"), out: manifest });
  extractPassages({ manifest, source: fixture(name, "raw"), out: passages });
  buildCandidate({ passages, out: candidate, candidateId: `${name}-candidate`, title: "Fixture Myth Episode", noOverwrite: false });
  extractFacts({ candidate, passages, registry, vocabulary, out: facts, noOverwrite: false });
  normalizeEntities({ facts, registry, out: entityFacts, noOverwrite: false });
  normalizeEvents({ facts: entityFacts, registry, vocabulary, out: eventFacts, noOverwrite: false });
  buildMythRecord({ candidate, normalizedFacts: eventFacts, registry, out: myth, mythId: `test-${name}`, mythFamilyId: name.indexOf("variant") === 0 ? "conflicting-apple-theft" : "fixture-family", variantId: `${name}-variant`, noOverwrite: false });
  return { dir, manifest, passages, candidate, facts, entityFacts, eventFacts, myth };
}

function hashFile(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function stringify(value) {
  return JSON.stringify(value, null, 2);
}

function runRealSources() {
  childProcess.execFileSync(process.execPath, [path.join(root, "src/corpus/corpus-real-runner.js")], { cwd: root, stdio: "pipe" });
}

function runBulkSources() {
  childProcess.execFileSync(process.execPath, [path.join(root, "src/corpus/corpus-bulk-runner.js")], { cwd: root, stdio: "pipe" });
}

function bulkMyths() {
  const base = path.join(root, "corpus/normalized/bulk");
  const files = [];
  function visit(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      if (entry.isFile() && entry.name.endsWith(".myth.json")) files.push(file);
    });
  }
  visit(base);
  return files.sort().map((file) => readJson(file));
}

function verifiedMyth(title) {
  const found = bulkMyths().find((myth) => myth.reviewStatus === "verified_by_source_audit" && myth.title === title);
  assert.ok(found, `Missing verified myth ${title}`);
  return found;
}

function assertNoSentenceFragments(myth) {
  const bad = /\b(and|when|to|of|the)\.$|,\.$/i;
  ["synopsis", "openingSituation", "centralConflict", "resolution", "outcome"].forEach((field) => {
    const value = myth.narrative && myth.narrative[field];
    assert.ok(!bad.test(String(value || "")), `${myth.title} has fragment in ${field}: ${value}`);
  });
  (myth.narrative.storyline || []).forEach((line) => assert.ok(!bad.test(line), `${myth.title} has fragment storyline: ${line}`));
}

test("extracts TEI metadata, checksum, and prose passages", () => {
  const files = runOne("prose");
  const manifest = readJson(files.manifest);
  const passages = readJson(files.passages);
  assert.strictEqual(manifest.rawSource.checksum, sha256File(fixture("prose", "raw")));
  assert.strictEqual(passages.passages.length, 2);
  assert.strictEqual(passages.passages[0].sourcePointers.xmlId, "p1");
  assert.strictEqual(passages.passages[0].text, "Zeus holds the thunderbolt on Olympus.");
});

test("extracts poetic lines in source order", () => {
  const files = runOne("verse");
  const passages = readJson(files.passages).passages;
  assert.strictEqual(passages.length, 2);
  assert.strictEqual(passages[0].citation.start, "1");
  assert.strictEqual(passages[1].citation.start, "2");
  assert.ok(passages[0].text.includes("Ζεύς"));
});

test("TEI header metadata does not generate irrelevant passage warnings", () => {
  const dir = prepare("tei-header-warnings");
  const manifest = path.join(dir, "hymn23.manifest.json");
  ingestSource({ manifest: path.join(root, "corpus/manifests/perseus-homeric-hymn-23-zeus-grc.json"), source: path.join(root, "corpus/sources/raw/perseus-homeric-hymn-23-zeus-grc.xml"), out: manifest });
  const result = extractPassages({ manifest, source: path.join(root, "corpus/sources/raw/perseus-homeric-hymn-23-zeus-grc.xml") });
  assert.strictEqual(result.passages.length, 4);
  assert.strictEqual(result.warnings.filter((warning) => warning.type === "unsupported-text-element").length, 0);
});

test("genuine unsupported body text still generates a warning", () => {
  const dir = prepare("unsupported-body");
  const raw = path.join(dir, "unsupported.xml");
  const manifest = path.join(dir, "unsupported.manifest.json");
  fs.writeFileSync(raw, "<TEI><text><body><div n=\"1\"><ab n=\"1\">Body text in an unsupported element.</ab></div></body></text></TEI>\n");
  writeJson(manifest, {
    sourceId: "unsupported-body-fixture",
    repository: "local-fixtures/story",
    commit: "0000000000000000000000000000000000000999",
    file: "unsupported.xml",
    canonicalIdentifier: "urn:cts:fixture:unsupported",
    language: "eng",
    author: "Fixture Author",
    work: "Unsupported Body Fixture",
    edition: "Local fixture",
    translator: null,
    license: "CC0-1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    retrievedAt: "2026-08-01T00:00:00.000Z"
  });
  ingestSource({ manifest, source: raw, out: manifest });
  const result = extractPassages({ manifest, source: raw });
  assert.ok(result.warnings.some((warning) => warning.type === "unsupported-text-element" && warning.path.includes("/ab[1]")));
});

test("generates deterministic passage IDs", () => {
  const a = runOne("prose");
  const b = runOne("prose");
  assert.deepStrictEqual(readJson(a.passages).passages.map((p) => p.passageId), readJson(b.passages).passages.map((p) => p.passageId));
});

test("rejects manifests without explicit licenses", () => {
  const dir = prepare("bad-license");
  const bad = Object.assign({}, readJson(fixture("prose", "manifests")));
  delete bad.license;
  const badFile = path.join(dir, "bad.json");
  writeJson(badFile, bad);
  assert.throws(() => ingestSource({ manifest: badFile, source: fixture("prose", "raw"), out: path.join(dir, "out.json") }), /license/);
});

test("detects source checksum changes", () => {
  const files = runOne("prose");
  const dir = files.dir;
  const changed = path.join(dir, "changed.xml");
  fs.copyFileSync(fixture("prose", "raw"), changed);
  fs.appendFileSync(changed, "\n<!-- changed -->\n");
  assert.throws(() => extractPassages({ manifest: files.manifest, source: changed, out: path.join(dir, "bad.passages.json") }), /checksum changed/);
});

test("validates candidate passage references", () => {
  const files = runOne("prose");
  assert.throws(() => buildCandidate({ passages: files.passages, selected: ["missing"], out: path.join(files.dir, "bad.candidate.json") }), /unknown passage/);
});

test("requires evidence for extracted assertions", () => {
  const files = runOne("prose");
  const facts = readJson(files.facts);
  facts.events[0].evidence = [];
  writeJson(path.join(files.dir, "bad.facts.json"), facts);
  const report = validateCorpus({ schemaDir: path.join(root, "schemas"), extracted: [path.join(files.dir, "bad.facts.json")] });
  assert.strictEqual(report.valid, false);
  assert.ok(report.errors.some((error) => error.type === "schema" || error.type === "missing-evidence"));
});

test("normalizes Greek and transliterated names", () => {
  const verse = runOne("verse");
  const prose = runOne("prose");
  const verseEntities = readJson(verse.entityFacts).entities;
  const proseEntities = readJson(prose.entityFacts).entities;
  assert.ok(verseEntities.some((entity) => entity.sourceName === "Ζεύς" && entity.normalizedId === "zeus"));
  assert.ok(proseEntities.some((entity) => entity.sourceName === "Apollo" && entity.normalizedId === "apollo"));
});

test("queues ambiguous and unknown entities instead of guessing", () => {
  const files = runOne("ambiguous");
  const myth = readJson(files.myth);
  assert.strictEqual(myth.reviewStatus, "awaiting_review");
  assert.ok(myth.normalizationWarnings.some((item) => item.issueType === "unresolved-person-name"));
  assert.ok(myth.normalizationWarnings.some((item) => item.sourceValue === "Phoibos"));
});

test("reports alias collisions", () => {
  const dir = prepare("alias-collision");
  const collision = readJson(registry);
  collision.entities.push({ id: "fake-zeus", preferredName: "Fake Zeus", greekName: null, aliases: ["Zeus"], entityType: "deity", tradition: "greek" });
  const collisionFile = path.join(dir, "registry.json");
  writeJson(collisionFile, collision);
  const report = validateCorpus({ schemaDir: path.join(root, "schemas"), registries: [collisionFile] });
  assert.strictEqual(report.valid, false);
  assert.ok(report.errors.some((error) => error.type === "alias-collision"));
});

test("normalizes controlled actions and queues unresolved actions", () => {
  const files = runOne("prose");
  const myth = readJson(files.myth);
  assert.ok(myth.events.some((event) => event.sourceAction === "takes" && event.action === "take"));
  const facts = readJson(files.entityFacts);
  facts.events.push({ actorSourceName: "Zeus", sourceAction: "glimmers", evidence: [{ passageId: readJson(files.passages).passages[0].passageId }] });
  const customFacts = path.join(files.dir, "custom.events.json");
  writeJson(customFacts, facts);
  const normalized = normalizeEvents({ facts: customFacts, registry, vocabulary });
  assert.ok(normalized.review.some((item) => item.issueType === "unsupported-action"));
});

test("preserves event ordering and rejects invalid causal references", () => {
  const files = runOne("prose");
  const myth = readJson(files.myth);
  assert.deepStrictEqual(myth.events.map((event) => event.eventId), ["event-001", "event-002"]);
  myth.events[0].causes = ["event-999"];
  const badMyth = path.join(files.dir, "bad.myth.json");
  writeJson(badMyth, myth);
  const report = validateCorpus({ schemaDir: path.join(root, "schemas"), passages: [files.passages], registries: [registry], myths: [badMyth] });
  assert.strictEqual(report.valid, false);
  assert.ok(report.errors.some((error) => error.type === "invalid-event-reference"));
});

test("preserves conflicting variants as separate records", () => {
  const a = runOne("variant-a");
  const b = runOne("variant-b");
  const mythA = readJson(a.myth);
  const mythB = readJson(b.myth);
  assert.strictEqual(mythA.mythFamilyId, "conflicting-apple-theft");
  assert.strictEqual(mythB.mythFamilyId, "conflicting-apple-theft");
  assert.notStrictEqual(mythA.variantId, mythB.variantId);
  assert.notDeepStrictEqual(mythA.events.map((event) => event.actor), mythB.events.map((event) => event.actor));
});

test("validates schemas and detects duplicate myth IDs", () => {
  const a = runOne("variant-a");
  const b = runOne("variant-b");
  const mythB = readJson(b.myth);
  mythB.mythId = readJson(a.myth).mythId;
  writeJson(b.myth, mythB);
  const report = validateCorpus({ schemaDir: path.join(root, "schemas"), passages: [a.passages, b.passages], registries: [registry], myths: [a.myth, b.myth] });
  assert.strictEqual(report.valid, false);
  assert.ok(report.errors.some((error) => error.type === "duplicate-myth-id"));
});

test("validation report paths are deterministic and portable", () => {
  const files = runOne("prose");
  const facts = readJson(files.facts);
  facts.events[0].evidence = [];
  const badFacts = path.join(files.dir, "bad.facts.json");
  writeJson(badFacts, facts);
  const report = validateCorpus({ schemaDir: path.join(root, "schemas"), extracted: [badFacts] });
  const serialized = stringify(report);
  assert.ok(!serialized.includes(root));
  assert.ok(!serialized.includes("/Users/"));
  assert.ok(!serialized.includes("/workspaces/"));
  assert.ok(!/[A-Za-z]:\\/.test(serialized));
  report.errors.forEach((error) => {
    assert.ok(!error.file.includes("\\"));
  });
});

test("portable report conversion is stable across checkout roots", () => {
  const macReport = {
    warnings: [
      {
        type: "ambiguous-normalization",
        file: "/Users/tanyagupta/story/corpus/normalized/homeric-hymn-7-dionysus.myth.json",
        sourcePath: "/Users/tanyagupta/story/corpus/review/homeric-hymn-7-dionysus.review.json",
        details: [{ file: "/Users/tanyagupta/story/corpus/passages/example.passages.json", path: "/events/0/evidence" }]
      }
    ]
  };
  const codespacesReport = {
    warnings: [
      {
        type: "ambiguous-normalization",
        file: "/workspaces/story/corpus/normalized/homeric-hymn-7-dionysus.myth.json",
        sourcePath: "/workspaces/story/corpus/review/homeric-hymn-7-dionysus.review.json",
        details: [{ file: "/workspaces/story/corpus/passages/example.passages.json", path: "/events/0/evidence" }]
      }
    ]
  };
  const portableMac = portableReportValue(macReport, "/Users/tanyagupta/story");
  const portableCodespaces = portableReportValue(codespacesReport, "/workspaces/story");
  assert.deepStrictEqual(portableMac, portableCodespaces);
  assert.strictEqual(portableMac.warnings[0].file, "corpus/normalized/homeric-hymn-7-dionysus.myth.json");
  assert.strictEqual(portableMac.warnings[0].sourcePath, "corpus/review/homeric-hymn-7-dionysus.review.json");
  assert.strictEqual(portableMac.warnings[0].details[0].path, "/events/0/evidence");
  assert.strictEqual(portablePath("C:\\workspaces\\story\\corpus\\review\\report.json", "C:\\workspaces\\story"), "corpus/review/report.json");
});

test("runs an end-to-end fixture pipeline with valid report", () => {
  const files = runOne("prose");
  const report = validateCorpus({
    schemaDir: path.join(root, "schemas"),
    manifests: [files.manifest],
    passages: [files.passages],
    candidates: [files.candidate],
    registries: [registry],
    extracted: [files.facts],
    myths: [files.myth]
  });
  assert.strictEqual(report.valid, true);
  assert.ok(readJson(files.myth).events.every((event) => event.evidence.length > 0));
});

test("real Hymn 23 extracts exactly four deterministic Greek passages", () => {
  runRealSources();
  const passages = readJson(path.join(root, "corpus/passages/perseus-homeric-hymn-23-zeus-grc.passages.json"));
  const before = passages.passages.map((passage) => passage.passageId);
  runRealSources();
  const after = readJson(path.join(root, "corpus/passages/perseus-homeric-hymn-23-zeus-grc.passages.json")).passages.map((passage) => passage.passageId);
  assert.strictEqual(passages.passages.length, 4);
  assert.deepStrictEqual(before, after);
  assert.strictEqual(passages.warnings.length, 0);
});

test("real Hymn 23 candidate, facts, and normalized record are valid", () => {
  runRealSources();
  const candidate = readJson(path.join(root, "corpus/candidates/homeric-hymn-23-zeus.candidate.json"));
  const facts = readJson(path.join(root, "corpus/extracted/homeric-hymn-23-zeus.facts.json"));
  const myth = readJson(path.join(root, "corpus/normalized/homeric-hymn-23-zeus.myth.json"));
  const report = readJson(path.join(root, "corpus/review/homeric-hymn-23-zeus.validation-report.json"));
  assert.strictEqual(candidate.candidateId, "homeric-hymn-23-zeus");
  assert.strictEqual(candidate.passages.length, 4);
  assert.ok(facts.entities.every((item) => item.evidence && item.evidence.length));
  assert.ok(facts.events.every((item) => item.evidence && item.evidence.length));
  assert.strictEqual(report.valid, true);
  assert.ok(myth.events.every((item) => item.evidence && item.evidence.length));
});

test("real narrative source has complete candidate and evidence-backed facts", () => {
  runRealSources();
  const greek = readJson(path.join(root, "corpus/passages/perseus-homeric-hymn-7-dionysus-grc.passages.json"));
  const english = readJson(path.join(root, "corpus/passages/gutenberg-homeric-hymn-7-dionysus-eng-derived.passages.json"));
  const candidate = readJson(path.join(root, "corpus/candidates/homeric-hymn-7-dionysus.candidate.json"));
  const facts = readJson(path.join(root, "corpus/extracted/homeric-hymn-7-dionysus.facts.json"));
  assert.strictEqual(greek.passages.length, 59);
  assert.strictEqual(english.passages.length, 6);
  assert.strictEqual(candidate.passages.length, greek.passages.length);
  assert.ok(facts.entities.length > 0);
  assert.ok(facts.events.length > 0);
  assert.ok(facts.entities.every((item) => item.evidence && item.evidence.length));
  assert.ok(facts.events.every((item) => item.evidence && item.evidence.length));
});

test("Greek and English real-source witnesses remain separate with translation provenance", () => {
  runRealSources();
  const greek = readJson(path.join(root, "corpus/manifests/perseus-homeric-hymn-7-dionysus-grc.json"));
  const english = readJson(path.join(root, "corpus/manifests/gutenberg-homeric-hymn-7-dionysus-eng-derived.json"));
  const compilation = readJson(path.join(root, "corpus/manifests/gutenberg-hesiod-homeric-hymns-homerica-eng.json"));
  const myth = readJson(path.join(root, "corpus/normalized/homeric-hymn-7-dionysus.myth.json"));
  assert.strictEqual(greek.language, "grc");
  assert.strictEqual(english.language, "eng");
  assert.strictEqual(english.translator, "Hugh G. Evelyn-White");
  assert.strictEqual(english.publicationDate, "1914");
  assert.strictEqual(english.derivedTei, true);
  assert.strictEqual(english.originalSource.sourceId, compilation.sourceId);
  assert.strictEqual(compilation.rawSource.path, "corpus/sources/raw/gutenberg-hesiod-homeric-hymns-homerica-348.txt");
  assert.notStrictEqual(greek.sourceId, english.sourceId);
  assert.deepStrictEqual(myth.source.witnessSourceIds, [greek.sourceId, english.sourceId]);
});

test("derived Gutenberg TEI preserves selected source text", () => {
  runRealSources();
  const original = fs.readFileSync(path.join(root, "corpus/sources/raw/gutenberg-hesiod-homeric-hymns-homerica-348.txt"), "utf8");
  const derived = fs.readFileSync(path.join(root, "corpus/sources/raw/gutenberg-homeric-hymn-7-dionysus-eng-derived.tei.xml"), "utf8");
  const passage = readJson(path.join(root, "corpus/passages/gutenberg-homeric-hymn-7-dionysus-eng-derived.passages.json")).passages[0];
  const phrase = "I will tell of Dionysus, the son of glorious Semele";
  assert.ok(original.includes(phrase));
  assert.ok(derived.includes(phrase));
  assert.ok(passage.text.includes(phrase));
});

test("real-source review queue preserves ambiguous and uncertain items", () => {
  runRealSources();
  const review = readJson(path.join(root, "corpus/review/homeric-hymn-7-dionysus.review.json"));
  assert.ok(review.items.some((item) => item.issueType === "ambiguous-normalization"));
  assert.ok(review.items.some((item) => item.issueType === "uncertain-source-text"));
});

test("real-source controlled actions and event order are preserved", () => {
  runRealSources();
  const myth = readJson(path.join(root, "corpus/normalized/homeric-hymn-7-dionysus.myth.json"));
  assert.deepStrictEqual(myth.events.map((event) => event.eventId), myth.events.map((event, index) => `event-${String(index + 1).padStart(3, "0")}`));
  assert.ok(myth.events.some((event) => event.sourceAction === "changed into a dreadful lion" && event.action === "transform"));
  assert.ok(myth.events.some((event) => event.sourceAction === "were changed into" && event.action === "become"));
});

test("complete real-source runner succeeds offline and is deterministic", () => {
  runRealSources();
  const files = [
    "corpus/passages/perseus-homeric-hymn-23-zeus-grc.passages.json",
    "corpus/passages/perseus-homeric-hymn-7-dionysus-grc.passages.json",
    "corpus/passages/gutenberg-homeric-hymn-7-dionysus-eng-derived.passages.json",
    "corpus/extracted/homeric-hymn-7-dionysus.facts.json",
    "corpus/normalized/homeric-hymn-7-dionysus.myth.json",
    "corpus/review/real-sources.validation-report.json"
  ].map((file) => path.join(root, file));
  const before = files.map(hashFile);
  runRealSources();
  const after = files.map(hashFile);
  assert.deepStrictEqual(before, after);
  assert.strictEqual(readJson(path.join(root, "corpus/review/real-sources.validation-report.json")).valid, true);
});

test("real-source validation reports use portable paths without changing warning counts", () => {
  runRealSources();
  const report = readJson(path.join(root, "corpus/review/real-sources.validation-report.json"));
  const serialized = stringify(report);
  assert.ok(!serialized.includes(root));
  assert.ok(!serialized.includes("/Users/"));
  assert.ok(!serialized.includes("/workspaces/"));
  assert.ok(!/[A-Za-z]:\\/.test(serialized));
  assert.strictEqual(report.warnings.length, 1);
  assert.ok(report.warnings.some((warning) => warning.file === "corpus/normalized/homeric-hymn-7-dionysus.myth.json"));
  report.errors.concat(report.warnings).forEach((item) => {
    if (item.file) assert.ok(!item.file.includes("\\"));
  });
});

test("bulk Project Gutenberg runner preserves raw sources and excludes boilerplate", () => {
  const rawFile = path.join(root, "corpus/sources/raw/gutenberg/guerber-myths-greece-rome-39250.txt");
  const before = hashFile(rawFile);
  runBulkSources();
  const after = hashFile(rawFile);
  const passages = readJson(path.join(root, "corpus/passages/gutenberg-guerber-myths-greece-rome-eng.passages.json"));
  const joined = passages.passages.slice(0, 20).map((passage) => passage.text).join(" ");
  assert.strictEqual(before, after);
  assert.ok(passages.passages.length > 0);
  assert.ok(!joined.includes("Project Gutenberg License"));
  assert.ok(!joined.includes("START OF THIS PROJECT GUTENBERG"));
});

test("bulk derived TEI preserves source wording and is deterministic", () => {
  runBulkSources();
  const derivedFile = path.join(root, "corpus/sources/derived/gutenberg-baker-stories-old-greece-rome-eng.tei.xml");
  const before = hashFile(derivedFile);
  const derived = fs.readFileSync(derivedFile, "utf8");
  assert.ok(derived.includes("STORIES OF OLD GREECE AND ROME"));
  runBulkSources();
  const after = hashFile(derivedFile);
  assert.strictEqual(before, after);
});

test("bulk inventory meets candidate and production targets", () => {
  runBulkSources();
  const inventory = readJson(path.join(root, "corpus/catalog/myth-inventory.json"));
  const summary = readJson(path.join(root, "corpus/catalog/bulk-ingestion-summary.json"));
  const validation = readJson(path.join(root, "corpus/review/bulk-validation-report.json"));
  assert.strictEqual(validation.valid, true);
  assert.ok(summary.validNarrativeCandidates >= 100);
  assert.strictEqual(summary.narrativeCandidates, 291);
  assert.strictEqual(summary.fullyNormalizedRecords, 248);
  assert.strictEqual(summary.approvedRecords, 0);
  assert.strictEqual(summary.humanApprovedRecords, 0);
  assert.strictEqual(summary.verifiedBySourceAudit, 32);
  assert.strictEqual(summary.machineProposedRecords, 248);
  assert.strictEqual(summary.recordsAwaitingReview, 248);
  assert.strictEqual(summary.awaitingSubstantiveSourceReviewRecords, 248);
  assert.strictEqual(summary.unresolvedRequiresHumanReviewRecords, 10);
  assert.ok(inventory.entries.some((entry) => entry.candidateType === "non_story_material"));
  assert.ok(inventory.entries.some((entry) => entry.candidateType === "biographical_material"));
  assert.ok(inventory.entries.every((entry) => entry.semanticQuality));
  assert.ok(inventory.entries.every((entry) => entry.passageIds.length > 0));
});

test("bulk variants remain separate and probable duplicates are queued", () => {
  runBulkSources();
  const duplicates = readJson(path.join(root, "corpus/catalog/duplicate-and-variant-report.json"));
  const review = readJson(path.join(root, "corpus/review/open-review-items.json"));
  assert.ok(duplicates.distinctSourceVariants.length > 0);
  assert.ok(duplicates.probableDuplicates.length > 0);
  assert.ok(review.items.some((item) => item.issueType === "probable-duplicate"));
});

test("bulk production records have evidence and preserve event order", () => {
  runBulkSources();
  const myths = bulkMyths();
  assert.strictEqual(myths.length, 300);
  myths.filter((myth) => myth.reviewStatus === "verified_by_source_audit").forEach((myth) => {
    assert.ok(myth.events.every((event) => event.evidence && event.evidence.length));
    assert.deepStrictEqual(myth.events.map((event) => event.eventId), myth.events.map((event, index) => `event-${String(index + 1).padStart(3, "0")}`));
  });
});

test("bulk semantic gates prevent placeholder approvals", () => {
  runBulkSources();
  const myths = bulkMyths();
  const proposed = myths.filter((myth) => myth.reviewStatus === "awaiting_review");
  const restored = myths.filter((myth) => myth.reviewStatus === "awaiting_substantive_source_review");
  const verified = myths.filter((myth) => myth.reviewStatus === "verified_by_source_audit");
  assert.strictEqual(proposed.length, 0);
  assert.strictEqual(restored.length, 248);
  assert.strictEqual(verified.length, 32);
  assert.strictEqual(myths.filter((myth) => myth.reviewStatus === "approved").length, 0);
  verified.forEach((myth) => {
    assert.ok(myth.entities.characters.length > 0);
    assert.ok(myth.events.every((event) => event.actor && event.confidence >= 0.85));
    assert.ok(myth.narrative.synopsis);
    assert.ok(myth.narrative.openingSituation);
    assert.ok(myth.narrative.centralConflict);
    assert.ok(myth.narrative.outcome);
    assert.ok(Array.isArray(myth.narrative.storyline) && myth.narrative.storyline.length > 0);
    assert.ok(myth.evidenceSummary && myth.evidenceSummary.length > 0);
    assert.ok(!(myth.initialState || []).some((state) => state.subject === "source-section"));
    assert.strictEqual(myth.semanticQuality.passed, true);
    assert.strictEqual(myth.semanticQuality.verificationLevel, "source_audited");
    assert.ok(!Object.prototype.hasOwnProperty.call(myth.semanticQuality, "score"));
    assert.ok((myth.semanticQuality.limitations || []).some((item) => /not human scholarly approval/i.test(item)));
    assertNoSentenceFragments(myth);
  });
});

test("bulk non-story and weak narrative candidates are not approved", () => {
  runBulkSources();
  const approvedCatalog = readJson(path.join(root, "corpus/catalog/approved-myths.json"));
  const verifiedCatalog = readJson(path.join(root, "corpus/catalog/verified-myths.json"));
  const proposedCatalog = readJson(path.join(root, "corpus/catalog/proposed-myths.json"));
  const rejectedCatalog = readJson(path.join(root, "corpus/catalog/rejected-candidates.json"));
  const awaiting = readJson(path.join(root, "corpus/catalog/myths-awaiting-review.json"));
  const ambiguous = readJson(path.join(root, "corpus/catalog/ambiguous-myths.json"));
  const humanReview = readJson(path.join(root, "corpus/catalog/human-review-required.json"));
  assert.strictEqual(approvedCatalog.entries.length, 0);
  assert.strictEqual(verifiedCatalog.entries.length, 32);
  assert.ok(verifiedCatalog.entries.every((entry) => entry.reviewStatus === "verified_by_source_audit"));
  assert.ok(verifiedCatalog.entries.every((entry) => entry.file.startsWith("corpus/normalized/bulk/verified/") && fs.existsSync(path.join(root, entry.file))));
  assert.ok(proposedCatalog.entries.every((entry) => entry.file.startsWith("corpus/normalized/bulk/proposed/") && fs.existsSync(path.join(root, entry.file))));
  assert.ok(verifiedCatalog.entries.every((entry) => !proposedCatalog.entries.some((proposed) => proposed.mythId === entry.mythId)));
  assert.ok(!approvedCatalog.entries.some((entry) => entry.title === "Pindar."));
  assert.ok(rejectedCatalog.entries.some((entry) => entry.title === "Pindar." && entry.processingStatus === "rejected-non-story"));
  assert.strictEqual(rejectedCatalog.entries.filter((entry) => entry.processingStatus === "rejected-non-story-source-audit").length, 5);
  assert.strictEqual(proposedCatalog.entries.length, 268);
  assert.strictEqual(awaiting.entries.length, 248);
  assert.ok(awaiting.entries.every((entry) => entry.reviewStatus === "awaiting_substantive_source_review"));
  assert.strictEqual(ambiguous.entries.length, 9);
  assert.strictEqual(humanReview.entries.length, 10);
  assert.ok(humanReview.entries.every((entry) => entry.reviewStatus === "unresolved_requires_human_review"));
});

test("bulk semantic report and review workflow are populated", () => {
  runBulkSources();
  const semantic = readJson(path.join(root, "corpus/review/semantic-quality-report.json"));
  const structureCheck = readJson(path.join(root, "corpus/review/automated-structure-check.json"));
  const verification = readJson(path.join(root, "corpus/review/codex-source-verification.json"));
  const audit = readJson(path.join(root, "corpus/review/source-text-audit-report.json"));
  const progress = readJson(path.join(root, "corpus/review/verification-progress.json"));
  const sampleReview = fs.readdirSync(path.join(root, "corpus/review/bulk")).find((file) => file.endsWith(".review.json"));
  const review = readJson(path.join(root, "corpus/review/bulk", sampleReview));
  assert.strictEqual(semantic.approvedRecords, 0);
  assert.strictEqual(semantic.verifiedBySourceAudit, 32);
  assert.strictEqual(semantic.humanApprovedRecords, 0);
  assert.strictEqual(semantic.awaitingReview, 248);
  assert.strictEqual(progress.baseline.verified, 15);
  assert.strictEqual(progress.baseline.awaitingReview, 278);
  assert.strictEqual(progress.neverReviewedRemaining, 0);
  assert.strictEqual(progress.deferredComplex, 0);
  assert.strictEqual(progress.unresolvedRequiresHumanReview, 10);
  assert.strictEqual(progress.awaitingSubstantiveSourceReview, 248);
  assert.strictEqual(progress.programComplete, false);
  assert.ok(Object.keys(semantic.failedQualityGates).length > 0);
  assert.strictEqual(structureCheck.reviewType, "automated-structure-check");
  assert.ok(structureCheck.note.includes("not a semantic review"));
  assert.strictEqual(verification.reviewType, "Codex source-grounded implementation review");
  assert.ok(verification.checkedRecords.every((entry) => entry.passagesRead.length && entry.claimsChecked.length && entry.correctionsMade.length));
  assert.strictEqual(audit.valid, true);
  [
    "exactSourceTextFailures",
    "truncatedExcerptFailures",
    "entityEvidenceFailures",
    "unsupportedSupportsFailures",
    "aliasDuplicationFailures",
    "boundaryFailures",
    "crossFieldConsistencyFailures",
    "eventReferenceFailures",
    "relationshipFailures",
    "statusConsistencyFailures",
    "misleadingScoreFailures",
    "unresolvedUncertaintyFailures",
    "duplicateOutputFailures",
    "catalogConsistencyFailures",
    "ledgerConsistencyFailures"
  ].forEach((field) => assert.strictEqual(audit[field].length, 0, field));
  assert.ok(review.reviewType);
  assert.ok(review.semanticQuality);
});

test("verification batch 01 ranking, selection, and outcomes are deterministic", () => {
  runBulkSources();
  const priority = readJson(path.join(root, "corpus/review/verification-priority.json"));
  const selection = readJson(path.join(root, "corpus/review/verification-batch-01.json"));
  const results = readJson(path.join(root, "corpus/review/verification-batch-01-results.json"));
  assert.strictEqual(priority.totalProposed, 291);
  assert.strictEqual(priority.generatedAt, "1970-01-01T00:00:00.000Z");
  assert.strictEqual(selection.selectedCount, 20);
  assert.strictEqual(selection.selectedRecords.length, 20);
  assert.strictEqual(results.reviewedCount, 20);
  assert.strictEqual(results.reviewedRecords.length, 20);
  const validStatuses = new Set(["awaiting_review", "verified_by_source_audit", "ambiguous", "rejected_non_story"]);
  assert.ok(results.reviewedRecords.every((record) => validStatuses.has(record.finalStatus)));
  assert.strictEqual(results.reviewedRecords.filter((record) => record.finalStatus === "verified_by_source_audit").length, 9);
  assert.strictEqual(results.reviewedRecords.filter((record) => record.finalStatus === "awaiting_review").length, 7);
  assert.strictEqual(results.reviewedRecords.filter((record) => record.finalStatus === "ambiguous").length, 4);
  assert.strictEqual(results.manualInspections.length, 5);
  assert.ok(results.newlyVerifiedRecords.every((record) => record.file.startsWith("corpus/normalized/bulk/verified/") && fs.existsSync(path.join(root, record.file))));
});

test("verification batch 01 reconciles catalogs and removes promoted proposed files", () => {
  runBulkSources();
  const results = readJson(path.join(root, "corpus/review/verification-batch-01-results.json"));
  const batch02 = readJson(path.join(root, "corpus/review/reconstruction-batch-02-results.json"));
  const verifiedCatalog = readJson(path.join(root, "corpus/catalog/verified-myths.json"));
  const proposedCatalog = readJson(path.join(root, "corpus/catalog/proposed-myths.json"));
  const approvedCatalog = readJson(path.join(root, "corpus/catalog/approved-myths.json"));
  const verifiedIds = new Set(verifiedCatalog.entries.map((entry) => entry.mythId));
  const proposedIds = new Set(proposedCatalog.entries.map((entry) => entry.mythId));
  const supersededLater = new Set(batch02.records.map((record) => record.mythId));
  assert.strictEqual(approvedCatalog.entries.length, 0);
  results.newlyVerifiedRecords.forEach((record) => {
    assert.ok(verifiedIds.has(record.mythId));
    assert.ok(!proposedIds.has(record.mythId));
    assert.ok(!fs.existsSync(path.join(root, `corpus/normalized/bulk/proposed/${record.mythId}.myth.json`)));
  });
  results.reviewedRecords
    .filter((record) => record.finalStatus === "ambiguous")
    .forEach((record) => assert.ok(!proposedIds.has(record.mythId)));
  results.reviewedRecords
    .filter((record) => record.finalStatus === "awaiting_review")
    .forEach((record) => {
      if (supersededLater.has(record.mythId)) {
        assert.ok(!proposedIds.has(record.mythId));
      } else {
        assert.ok(proposedIds.has(record.mythId));
      }
    });
});

test("remaining verification program reviews every unverified record once", () => {
  runBulkSources();
  const ledger = readJson(path.join(root, "corpus/review/verification-ledger.json"));
  const progress = readJson(path.join(root, "corpus/review/verification-progress.json"));
  const archiveRoot = path.join(root, "corpus/review/archive/failed-bulk-review");
  const archivedDeferred = readJson(path.join(archiveRoot, "deferred-complex-records.json"));
  const archivedFinalDeferred = readJson(path.join(archiveRoot, "verification-final-deferred-results.json"));
  assert.strictEqual(ledger.entries.length, 295);
  assert.strictEqual(new Set(ledger.entries.map((entry) => entry.mythId)).size, 295);
  assert.strictEqual(ledger.entries.filter((entry) => entry.firstReviewedInBatch === "verification-batch-01").length, 7);
  assert.strictEqual(ledger.entries.filter((entry) => /^bulk-myth-/.test(entry.mythId)).length, 278);
  assert.strictEqual(ledger.entries.filter((entry) => entry.reviewDepth === "derived_source_audited_record").length, 17);
  assert.ok(ledger.entries.every((entry) => entry.classification_reviewed === true));
  assert.strictEqual(ledger.entries.filter((entry) => entry.substantive_reconstruction_complete === true).length, 27);
  assert.strictEqual(ledger.entries.filter((entry) => entry.currentStatus === "awaiting_substantive_source_review").length, 248);
  assert.strictEqual(ledger.entries.filter((entry) => entry.superseded === true).length, 10);
  assert.strictEqual(progress.programComplete, false);
  assert.strictEqual(progress.neverReviewedRemaining, 0);
  assert.strictEqual(progress.deferredComplex, 0);
  assert.strictEqual(progress.awaitingSubstantiveSourceReview, 248);
  assert.ok(!fs.existsSync(path.join(root, "corpus/review/verification-final-deferred-results.json")));
  assert.ok(!fs.existsSync(path.join(root, "corpus/review/verification-program-final-report.json")));
  assert.ok(!fs.existsSync(path.join(root, "corpus/review/verification-batch-02-results.json")));
  assert.strictEqual(archivedDeferred.authoritative, false);
  assert.strictEqual(archivedDeferred.doNotUseForCorpusDecisions, true);
  assert.strictEqual(archivedFinalDeferred.authoritative, false);
  assert.strictEqual(archivedFinalDeferred.reviewedCount, 83);
  assert.ok(ledger.entries.every((entry) => entry.currentStatus !== "deferred_complex"));
});

test("PR12 audit restores proposed records and documents a record-specific sample", () => {
  runBulkSources();
  const baseline = readJson(path.join(root, "corpus/review/pr12-audit-baseline.json"));
  const methodology = readJson(path.join(root, "corpus/review/pr12-methodology-audit.json"));
  const sample = readJson(path.join(root, "corpus/review/pr12-reconstruction-sample.json"));
  const sampleResults = readJson(path.join(root, "corpus/review/pr12-reconstruction-sample-results.json"));
  const conclusion = readJson(path.join(root, "corpus/review/pr12-audit-conclusion.json"));
  const safeguards = readJson(path.join(root, "corpus/review/pr12-templated-review-safeguards.json"));
  const proposedCatalog = readJson(path.join(root, "corpus/catalog/proposed-myths.json"));
  assert.strictEqual(baseline.prNumber, 12);
  assert.strictEqual(baseline.proposedBeforePr12, 278);
  assert.strictEqual(baseline.currentProposed, 0);
  assert.strictEqual(baseline.recoverableOriginalProposed, true);
  assert.strictEqual(methodology.recordsAudited, 278);
  assert.strictEqual(methodology.genericRationaleCount, 278);
  assert.strictEqual(methodology.genericCorrectionCount, 278);
  assert.strictEqual(methodology.actualStructuredCorrectionCount, 0);
  assert.strictEqual(methodology.templatedClassificationRisk, "high");
  assert.strictEqual(sample.records.length, 20);
  assert.strictEqual(new Set(sample.records.map((record) => record.mythId)).size, 20);
  assert.strictEqual(sampleResults.records.length, 20);
  const generic = /Reviewed source passage references|Source-grounded batch review found narrative signals|Final deferred pass retained/;
  sampleResults.records.forEach((record) => {
    assert.ok(record.decisionRationale.includes(record.mythId));
    assert.ok(record.boundaryAnalysis.specificProblem.includes(record.titleBefore));
    assert.ok(record.exactEvidence.length > 0);
    record.exactEvidence.forEach((evidence) => assert.ok(evidence.passageId && evidence.sourceText));
    assert.ok(!generic.test(record.decisionRationale));
  });
  assert.strictEqual(conclusion.sampleSize, 20);
  assert.strictEqual(conclusion.newlyVerified, 0);
  assert.strictEqual(conclusion.materialReconstructionRequired, 20);
  assert.strictEqual(conclusion.pr12BulkClassificationsTrustworthy, false);
  assert.strictEqual(conclusion.recommendedAction, "fully_rebuild");
  assert.strictEqual(conclusion.recordsRestoredToSubstantiveReview, 258);
  assert.strictEqual(safeguards.valid, true);
  assert.ok(safeguards.substantiveReconstructionRequiredFields.includes("boundaryAnalysis"));
  assert.ok(safeguards.substantiveReconstructionRequiredFields.includes("exactPassageEvidence"));
  assert.ok(safeguards.rules.some((rule) => /Proposed records cannot be removed/.test(rule)));
  assert.strictEqual(proposedCatalog.entries.length, 268);
  assert.ok(proposedCatalog.entries.every((entry) => entry.file && fs.existsSync(path.join(root, entry.file))));
});

test("reconstruction batch 02 processes exactly ten records with substantive outcomes", () => {
  runBulkSources();
  const selection = readJson(path.join(root, "corpus/review/reconstruction-batch-02-selection.json"));
  const results = readJson(path.join(root, "corpus/review/reconstruction-batch-02-results.json"));
  const derived = readJson(path.join(root, "corpus/review/reconstruction-batch-02-derived-records.json"));
  const inspections = readJson(path.join(root, "corpus/review/reconstruction-batch-02-manual-inspection.json"));
  const ledger = readJson(path.join(root, "corpus/review/verification-ledger.json"));
  const proposedCatalog = readJson(path.join(root, "corpus/catalog/proposed-myths.json"));
  const awaiting = readJson(path.join(root, "corpus/catalog/myths-awaiting-review.json"));
  const verifiedCatalog = readJson(path.join(root, "corpus/catalog/verified-myths.json"));
  const selectedIds = selection.selectedRecords.map((record) => record.mythId);
  const resultIds = results.records.map((record) => record.mythId);
  const generic = /Automatic verified promotion is not defensible|The record contains unclear boundaries|Reviewed source passage references|Source-grounded batch review found narrative signals/;
  assert.strictEqual(selection.selectedCount, 10);
  assert.strictEqual(selection.selectedRecords.length, 10);
  assert.strictEqual(new Set(selectedIds).size, 10);
  assert.deepStrictEqual(resultIds, selectedIds);
  assert.strictEqual(results.verifiedCount, 1);
  assert.strictEqual(results.splitCount, 8);
  assert.strictEqual(results.mergedCount, 1);
  assert.strictEqual(results.ambiguousCount, 0);
  assert.strictEqual(results.rejectedCount, 0);
  assert.strictEqual(results.humanReviewRequiredCount, 0);
  assert.strictEqual(results.derivedVerifiedCount, 17);
  assert.strictEqual(results.supersededProposalCount, 10);
  assert.strictEqual(derived.originalProposalCount, 10);
  assert.strictEqual(derived.derivedRecordCount, 20);
  assert.ok(derived.records.every((record) => record.derivedFromProposalIds.length > 0));
  derived.records
    .filter((record) => record.recordId.startsWith("bulk-verified-00") && !["bulk-verified-0002", "bulk-verified-0004", "bulk-verified-0005"].includes(record.recordId))
    .forEach((record) => assert.ok(fs.existsSync(path.join(root, `corpus/normalized/bulk/verified/${record.recordId}.myth.json`))));
  assert.strictEqual(inspections.inspectedCount, 10);
  assert.strictEqual(inspections.inspections.length, 10);
  results.records.forEach((record) => {
    assert.notStrictEqual(record.finalStatus, "awaiting_substantive_source_review");
    assert.ok(["verified", "split", "merged"].includes(record.finalDisposition));
    assert.ok(record.derivedRecordIds.length > 0);
    assert.ok(record.boundaryAnalysis.specificProblems.length > 0);
    assert.ok(record.exactEvidence.length > 0);
    assert.ok(record.characterCorrections.length > 0);
    assert.ok(record.aliasCorrections.length > 0);
    assert.ok(record.eventCorrections.length > 0);
    assert.ok(record.relationshipCorrections.length > 0);
    assert.ok(record.narrativeCorrections.length > 0);
    assert.ok(record.decisionRationale.includes(record.mythId));
    assert.ok(!generic.test(record.decisionRationale));
    record.exactEvidence.forEach((item) => assert.ok(item.passageId && item.sourceText && item.supports.includes(record.mythId)));
  });
  selectedIds.forEach((mythId) => {
    const entry = ledger.entries.find((item) => item.mythId === mythId);
    assert.ok(entry, mythId);
    assert.strictEqual(entry.reconstructionBatch, "reconstruction-batch-02");
    assert.strictEqual(entry.substantive_reconstruction_complete, true);
    assert.strictEqual(entry.substantive_reconstruction_incomplete, false);
  });
  assert.ok(!awaiting.entries.some((entry) => selectedIds.includes(entry.mythId)));
  assert.ok(!proposedCatalog.entries.some((entry) => selectedIds.includes(entry.mythId)));
  assert.ok(!proposedCatalog.entries.some((entry) => entry.mythId === "bulk-myth-0044"));
  assert.ok(verifiedCatalog.entries.some((entry) => entry.mythId === "bulk-verified-0016" && entry.file === "corpus/normalized/bulk/verified/bulk-verified-0016.myth.json"));
  assert.ok(verifiedCatalog.entries.some((entry) => entry.mythId === "bulk-verified-0032" && entry.file === "corpus/normalized/bulk/verified/bulk-verified-0032.myth.json"));
  assert.ok(fs.existsSync(path.join(root, "corpus/normalized/bulk/verified/bulk-verified-0016.myth.json")));
});

test("bulk runner removes stale generated normalized files", () => {
  const stale = path.join(root, "corpus/normalized/bulk/stale-placeholder.myth.json");
  const staleDuplicate = path.join(root, "corpus/normalized/bulk/bulk-myth-0001.myth.json");
  writeJson(stale, { stale: true });
  writeJson(staleDuplicate, { stale: true });
  runBulkSources();
  assert.ok(!fs.existsSync(stale));
  assert.ok(!fs.existsSync(staleDuplicate));
  assert.strictEqual(fs.readdirSync(path.join(root, "corpus/normalized/bulk")).filter((file) => /^bulk-myth-.*\.myth\.json$/.test(file)).length, 0);
});

test("bulk semantic reports are portable and deterministic", () => {
  runBulkSources();
  const files = [
    "corpus/review/semantic-quality-report.json",
    "corpus/catalog/approved-myths.json",
    "corpus/catalog/verified-myths.json",
    "corpus/catalog/proposed-myths.json",
    "corpus/catalog/myths-awaiting-review.json",
    "corpus/catalog/ambiguous-myths.json",
    "corpus/catalog/human-review-required.json",
    "corpus/catalog/rejected-candidates.json",
    "corpus/review/automated-structure-check.json",
    "corpus/review/codex-source-verification.json",
    "corpus/review/source-text-audit-report.json",
    "corpus/review/verification-priority.json",
    "corpus/review/verification-batch-01.json",
    "corpus/review/verification-batch-01-results.json",
    "corpus/review/verification-progress.json",
    "corpus/review/verification-ledger.json",
    "corpus/review/archive/failed-bulk-review/README.md",
    "corpus/review/archive/failed-bulk-review/deferred-complex-records.json",
    "corpus/review/archive/failed-bulk-review/verification-final-deferred-results.json",
    "corpus/review/archive/failed-bulk-review/verification-program-final-report.json",
    "corpus/review/archive/failed-bulk-review/verification-batch-02-results.json",
    "corpus/review/pr12-audit-baseline.json",
    "corpus/review/pr12-methodology-audit.json",
    "corpus/review/pr12-reconstruction-sample.json",
    "corpus/review/pr12-reconstruction-sample-results.json",
    "corpus/review/pr12-audit-conclusion.json",
    "corpus/review/pr12-templated-review-safeguards.json",
    "corpus/review/reconstruction-batch-02-selection.json",
    "corpus/review/reconstruction-batch-02-results.json",
    "corpus/review/reconstruction-batch-02-derived-records.json",
    "corpus/review/reconstruction-batch-02-manual-inspection.json"
  ].map((file) => path.join(root, file));
  const before = files.map(hashFile);
  runBulkSources();
  const after = files.map(hashFile);
  assert.deepStrictEqual(before, after);
  const serialized = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  assert.ok(!serialized.includes("/Users/"));
  assert.ok(!serialized.includes("/workspaces/"));
  assert.ok(!/[A-Za-z]:\\/.test(serialized));
});

test("bulk verified Proserpina corrects aliases, actors, and outcome", () => {
  runBulkSources();
  const myth = verifiedMyth("The Story of Proserpina");
  assert.ok(myth.entities.characters.includes("persephone"));
  assert.ok(myth.entities.characters.includes("demeter"));
  assert.ok(myth.entities.characters.includes("hades"));
  assert.ok(!myth.entities.characters.includes("roman-pluto"));
  assert.ok(/abducts|seizes|abduction/i.test(myth.narrative.centralConflict));
  assert.ok(!/Ceres wandering/i.test(myth.narrative.outcome));
  assert.ok(myth.events.some((event) => event.actor === "hades" && event.action === "capture" && event.target === "persephone"));
  assert.ok(myth.events.some((event) => event.actor === "hades" && event.sourceText.includes("Pluto had seized her") && event.normalizedStatement.includes("Proserpina")));
  assert.ok(!myth.events.some((event) => event.actor === "demeter" && event.target === "hades"));
  assert.ok(myth.events.some((event) => event.actor === "zeus" && event.action === "imprison" && event.target === "giants"));
  assert.ok(!myth.entities.characters.includes("pluto"));
  assert.strictEqual(myth.scope.type, "partial-section");
});

test("bulk verified Golden Fleece opening keeps participants and boundary accurate", () => {
  runBulkSources();
  const myth = verifiedMyth("Phryxus, Helle, and the Golden Fleece");
  ["athamas", "nephele", "helle", "phryxus"].forEach((id) => assert.ok(myth.entities.characters.includes(id), id));
  assert.notStrictEqual(myth.initialState[0].subject, "achilles");
  assert.ok(!myth.events.some((event) => event.actor === "hermes" && event.action === "capture"));
  assert.ok(myth.events.some((event) => event.actor === "phryxus" && event.action === "travel" && event.location === "colchis"));
  assert.ok(myth.events.some((event) => event.actor === "ino" && event.normalizedStatement.includes("Helle and Phryxus")));
  assert.ok(myth.events.some((event) => event.actor === "nephele" && event.action === "rescue"));
  assert.strictEqual(myth.scope.type, "coherent-subepisode");
  assert.ok(!/join Jason/i.test(myth.narrative.outcome));
});

test("bulk verified Heraclidae corrects family and actor assignments", () => {
  runBulkSources();
  const myth = verifiedMyth("The Heraclidae");
  assert.strictEqual(myth.mythFamilyId, "heraclidae");
  assert.ok(!myth.mainCharacters.some((item) => item.entityId === "theseus"));
  ["hyllus", "iolaus", "eurystheus", "heraclidae"].forEach((id) => assert.ok(myth.entities.characters.includes(id), id));
  assert.ok(myth.events.some((event) => event.actor === "iolaus" && event.sourceAction === "borrowed" && event.object === "chariot"));
  assert.ok(!myth.events.some((event) => event.actor === "zeus" && event.action === "fight"));
  assert.notStrictEqual(myth.initialState[0].subject, "theseus");
});

test("bulk proposed extraction records actor resolution confidence and family rules", () => {
  runBulkSources();
  const proposed = bulkMyths().filter((myth) => myth.reviewStatus === "awaiting_substantive_source_review");
  const ledger = readJson(path.join(root, "corpus/review/verification-ledger.json"));
  assert.strictEqual(proposed.length, 248);
  assert.ok(ledger.entries.some((entry) => entry.mythId === "bulk-myth-0018"));
  assert.ok(ledger.entries.every((entry) => entry.currentStatus !== "awaiting_review"));
  assert.ok(ledger.entries.some((entry) => entry.currentStatus === "awaiting_substantive_source_review"));
});

test("bulk verified records use exact sourceText and targeted entity evidence", () => {
  runBulkSources();
  const passageDocs = {};
  [
    "corpus/passages/gutenberg-guerber-myths-greece-rome-eng.passages.json",
    "corpus/passages/gutenberg-berens-myths-legends-greece-rome-eng.passages.json",
    "corpus/passages/gutenberg-baker-stories-old-greece-rome-eng.passages.json"
  ].forEach((file) => {
    readJson(path.join(root, file)).passages.forEach((passage) => {
      passageDocs[passage.passageId] = passage.text;
    });
  });
  bulkMyths().filter((myth) => myth.reviewStatus === "verified_by_source_audit").forEach((myth) => {
    myth.events.forEach((event) => {
      assert.ok(event.sourceText);
      assert.ok(event.normalizedStatement);
      event.evidence.forEach((item) => assert.ok(passageDocs[item.passageId].includes(event.sourceText), `${myth.title} ${event.eventId}`));
      assert.ok(!event.sourceSentence);
      assert.ok(!event.sourceClause);
    });
    myth.evidenceSummary.forEach((item) => {
      assert.ok(passageDocs[item.passageId].includes(item.sourceText));
      assert.ok(/[.!?]"?$/.test(item.sourceText));
      assert.ok(item.supports.every((support) => support.evidenceType && support.rationale));
    });
    myth.entityMappings.forEach((mapping) => {
      mapping.evidence.forEach((item) => {
        assert.ok(passageDocs[item.passageId].includes(item.sourceText));
        assert.ok(item.sourceText.includes(mapping.sourceName) || item.coreferenceNote);
      });
    });
  });
});

test("AI production mythology corpus is separate, complete, and internally valid", () => {
  const report = validateProductionCorpus();
  assert.strictEqual(report.valid, true, report.errors.join("\n"));
  assert.strictEqual(report.productionRecords, 200);
  assert.strictEqual(report.planRecords, 200);
  assert.strictEqual(report.catalogRecords, 200);
  assert.strictEqual(report.sourceAuditedReferenceRecords, 32);
  assert.strictEqual(report.substantivelyRepaired, 25);
  assert.strictEqual(report.remainingPlaceholders, 175);
  assert.strictEqual(report.placeholderSelfCertifiedQualityCount, 175);

  const productionCatalog = readJson(path.join(root, "corpus/production/catalog/production-myths.json"));
  assert.strictEqual(productionCatalog.records.length, 200);
  assert.ok(productionCatalog.records.every((record) => record.file.startsWith("corpus/production/myths/")));

  const verifiedCatalog = readJson(path.join(root, "corpus/catalog/verified-myths.json"));
  assert.ok(!verifiedCatalog.entries.some((record) => record.file && record.file.startsWith("corpus/production/")));

  const firstRecord = readJson(path.join(root, "corpus/production/myths/production-myth-0001.json"));
  assert.strictEqual(firstRecord.status, "ai_constructed_production");
  assert.strictEqual(firstRecord.provenance.specificSourceVerified, false);
  assert.ok(!firstRecord.qualityReview);
  assert.strictEqual(firstRecord.characters[0].name, "Chaos");
  assert.ok(!JSON.stringify(firstRecord).includes("verified_by_source_audit"));
});

fs.rmSync(tempRoot, { recursive: true, force: true });
for (const item of tests) {
  try {
    item.fn();
    console.log(`ok - ${item.name}`);
  } catch (error) {
    console.error(`not ok - ${item.name}`);
    console.error(error.stack);
    process.exitCode = 1;
  }
}
