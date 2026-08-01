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
  assert.ok(summary.fullyNormalizedRecords >= 50);
  assert.strictEqual(summary.approvedRecords, 50);
  assert.ok(inventory.entries.some((entry) => entry.candidateType === "non_story_material"));
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
  const mythFiles = fs.readdirSync(path.join(root, "corpus/normalized/bulk")).filter((file) => file.endsWith(".myth.json")).sort();
  assert.ok(mythFiles.length >= 50);
  mythFiles.slice(0, 50).forEach((file) => {
    const myth = readJson(path.join(root, "corpus/normalized/bulk", file));
    assert.strictEqual(myth.reviewStatus, "approved");
    assert.ok(myth.events.every((event) => event.evidence && event.evidence.length));
    assert.deepStrictEqual(myth.events.map((event) => event.eventId), myth.events.map((event, index) => `event-${String(index + 1).padStart(3, "0")}`));
  });
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
