const assert = require("assert");
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
  readJson
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
