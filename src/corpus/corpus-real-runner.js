#!/usr/bin/env node
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
  writeJson,
  readJson,
  reviewItem,
  uniqueReviewItems
} = require("./corpus-core");
const { resolveIf, printResult, runCli } = require("./cli");

const REAL_SOURCES = [
  {
    sourceId: "perseus-homeric-hymn-23-zeus-grc",
    manifest: "corpus/manifests/perseus-homeric-hymn-23-zeus-grc.json",
    raw: "corpus/sources/raw/perseus-homeric-hymn-23-zeus-grc.xml",
    passages: "corpus/passages/perseus-homeric-hymn-23-zeus-grc.passages.json"
  },
  {
    sourceId: "perseus-homeric-hymn-23-zeus-eng",
    manifest: "corpus/manifests/perseus-homeric-hymn-23-zeus-eng.json",
    raw: "corpus/sources/raw/perseus-homeric-hymn-23-zeus-eng.xml",
    passages: "corpus/passages/perseus-homeric-hymn-23-zeus-eng.passages.json"
  },
  {
    sourceId: "perseus-homeric-hymn-7-dionysus-grc",
    manifest: "corpus/manifests/perseus-homeric-hymn-7-dionysus-grc.json",
    raw: "corpus/sources/raw/perseus-homeric-hymn-7-dionysus-grc.xml",
    passages: "corpus/passages/perseus-homeric-hymn-7-dionysus-grc.passages.json"
  },
  {
    sourceId: "perseus-homeric-hymn-7-dionysus-eng",
    manifest: "corpus/manifests/perseus-homeric-hymn-7-dionysus-eng.json",
    raw: "corpus/sources/raw/perseus-homeric-hymn-7-dionysus-eng.xml",
    passages: "corpus/passages/perseus-homeric-hymn-7-dionysus-eng.passages.json"
  }
];

const REAL_RECORDS = [
  {
    key: "homeric-hymn-23-zeus",
    candidateId: "homeric-hymn-23-zeus",
    title: "Hymn 23 Zeus Invocation",
    mythId: "myth-homeric-hymn-23-zeus",
    mythFamilyId: "hymn-to-zeus",
    variantId: "perseus-homeric-hymn-23-zeus-variant",
    greekSourceId: "perseus-homeric-hymn-23-zeus-grc",
    englishSourceId: "perseus-homeric-hymn-23-zeus-eng",
    facts: buildZeusFacts
  },
  {
    key: "homeric-hymn-7-dionysus",
    candidateId: "homeric-hymn-7-dionysus",
    title: "Dionysus And The Tyrsenian Pirates",
    mythId: "myth-homeric-hymn-7-dionysus",
    mythFamilyId: "dionysus-and-the-pirates",
    variantId: "perseus-homeric-hymn-7-dionysus-variant",
    greekSourceId: "perseus-homeric-hymn-7-dionysus-grc",
    englishSourceId: "perseus-homeric-hymn-7-dionysus-eng",
    facts: buildDionysusFacts
  }
];

function bySource(items) {
  const map = {};
  items.forEach((item) => {
    map[item.sourceId] = item;
  });
  return map;
}

function passageByStart(doc, start) {
  const found = doc.passages.find((passage) => passage.citation.start === String(start));
  if (!found) throw new Error(`Missing passage ${doc.sourceId}:${start}`);
  return found.passageId;
}

function evidence(greekDoc, englishDoc, greekStart, englishStart) {
  const items = [];
  if (greekStart) items.push({ passageId: passageByStart(greekDoc, greekStart), sourceRole: "original-language" });
  if (englishStart) items.push({ passageId: passageByStart(englishDoc, englishStart), sourceRole: "translation" });
  return items;
}

function entity(sourceName, entityType, ev, role, confidence) {
  return {
    sourceName,
    entityType,
    roleInEpisode: role || "mentioned",
    evidence: ev,
    confidence: confidence || 0.86,
    reviewStatus: confidence && confidence < 0.6 ? "open" : "awaiting_review"
  };
}

function event(actorSourceName, sourceAction, ev, fields) {
  return Object.assign({
    actorSourceName: actorSourceName || null,
    sourceAction,
    objectSourceName: null,
    targetSourceName: null,
    recipientSourceName: null,
    locationSourceName: null,
    causedBy: [],
    causes: [],
    evidence: ev,
    confidence: 0.86,
    reviewStatus: "awaiting_review"
  }, fields || {});
}

function state(subject, predicate, object, ev) {
  return { subject, predicate, object, evidence: ev.map((item) => item.passageId) };
}

function buildZeusFacts(record, greekDoc, englishDoc) {
  const line1 = evidence(greekDoc, englishDoc, "1", "1");
  const line2 = evidence(greekDoc, englishDoc, "2", "1");
  const line4 = evidence(greekDoc, englishDoc, "4", "1");
  return {
    candidateId: record.candidateId,
    extractionSourceId: record.englishSourceId,
    entities: [
      entity("Zeus", "deity", line1, "invoked"),
      entity("Ζῆνα", "deity", evidence(greekDoc, englishDoc, "1", null), "invoked"),
      entity("Themis", "deity", line2, "recipient"),
      entity("Θέμιστι", "deity", evidence(greekDoc, englishDoc, "2", null), "recipient"),
      entity("Cronos", "deity", line4, "ancestor")
    ],
    relationships: [
      {
        subjectSourceName: "Zeus",
        sourceRelation: "Son of Cronos",
        objectSourceName: "Cronos",
        evidence: line4,
        confidence: 0.83,
        reviewStatus: "awaiting_review"
      }
    ],
    goals: [],
    events: [
      event("hymn speaker", "will sing", line1, { objectSourceName: "Zeus" }),
      event("Zeus", "whispers", line2, { recipientSourceName: "Themis" }),
      event("hymn speaker", "be gracious", line4, { targetSourceName: "Zeus" })
    ],
    initialState: [
      state("Zeus", "is described as", "chiefest among the gods and greatest", line1),
      state("Themis", "sits leaning toward", "Zeus", line2)
    ],
    finalState: [
      state("hymn speaker", "invokes", "Zeus", line4)
    ],
    causalLinks: [],
    reviewStatus: "awaiting_review",
    review: []
  };
}

function buildDionysusFacts(record, greekDoc, englishDoc) {
  const e1 = evidence(greekDoc, englishDoc, "1", "1");
  const e5 = evidence(greekDoc, englishDoc, "6", "5");
  const e10 = evidence(greekDoc, englishDoc, "10", "10");
  const e12 = evidence(greekDoc, englishDoc, "12", "10");
  const e15 = evidence(greekDoc, englishDoc, "15", "15");
  const e20 = evidence(greekDoc, englishDoc, "20", "20");
  const e25 = evidence(greekDoc, englishDoc, "25", "25");
  const e30 = evidence(greekDoc, englishDoc, "32", "30");
  const e35 = evidence(greekDoc, englishDoc, "35", "35");
  const e40 = evidence(greekDoc, englishDoc, "40", "40");
  const e45 = evidence(greekDoc, englishDoc, "44", "40");
  const e46 = evidence(greekDoc, englishDoc, "46", "45");
  const e50 = evidence(greekDoc, englishDoc, "50", "45");
  const e51 = evidence(greekDoc, englishDoc, "51", "50");
  const e52 = evidence(greekDoc, englishDoc, "52", "50");
  const e53 = evidence(greekDoc, englishDoc, "53", "50");
  const e54 = evidence(greekDoc, englishDoc, "54", "50");
  const e55 = evidence(greekDoc, englishDoc, "55", "55");
  const e56 = evidence(greekDoc, englishDoc, "56", "55");
  return {
    candidateId: record.candidateId,
    extractionSourceId: record.englishSourceId,
    entities: [
      entity("Dionysus", "deity", e1, "protagonist"),
      entity("Διώνυσον", "deity", evidence(greekDoc, englishDoc, "1", null), "protagonist"),
      entity("Semele", "mortal", e1, "parent"),
      entity("Zeus", "deity", e56, "parent"),
      entity("Tyrsenian pirates", "character", e5, "actor", 0.58),
      entity("sailors", "character", e52, "actor"),
      entity("helmsman", "character", e15, "advisor"),
      entity("master", "character", e25, "actor"),
      entity("ship", "object", e5, "setting"),
      entity("sea", "place", e1, "setting"),
      entity("shore", "place", e1, "setting"),
      entity("bonds", "object", e12, "object"),
      entity("sail", "object", e30, "object"),
      entity("wine", "object", e35, "manifestation"),
      entity("vine", "object", e35, "manifestation"),
      entity("ivy", "object", e40, "manifestation"),
      entity("lion", "creature", e45, "manifestation"),
      entity("bear", "creature", e46, "manifestation"),
      entity("dolphins", "creature", e53, "transformed-form"),
      entity("Apollo", "deity", e15, "possible-identity"),
      entity("Poseidon", "deity", e20, "possible-identity"),
      entity("Olympus", "place", e20, "divine-location"),
      entity("Egypt", "place", e25, "hypothetical-destination"),
      entity("Cyprus", "place", e25, "hypothetical-destination")
    ],
    relationships: [
      {
        subjectSourceName: "Dionysus",
        sourceRelation: "son of Semele",
        objectSourceName: "Semele",
        evidence: e1,
        confidence: 0.9,
        reviewStatus: "awaiting_review"
      },
      {
        subjectSourceName: "Dionysus",
        sourceRelation: "born of union with Zeus",
        objectSourceName: "Zeus",
        evidence: e56,
        confidence: 0.9,
        reviewStatus: "awaiting_review"
      }
    ],
    goals: [
      {
        subjectSourceName: "helmsman",
        sourceGoal: "set Dionysus free on shore",
        evidence: e20,
        confidence: 0.84,
        reviewStatus: "awaiting_review"
      },
      {
        subjectSourceName: "master",
        sourceGoal: "carry Dionysus away for gain",
        evidence: e25,
        confidence: 0.8,
        reviewStatus: "awaiting_review"
      }
    ],
    events: [
      event("Dionysus", "appeared", e1, { locationSourceName: "shore" }),
      event("Tyrsenian pirates", "seizing", e5, { objectSourceName: "Dionysus", locationSourceName: "shore" }),
      event("Tyrsenian pirates", "put him on board", e10, { objectSourceName: "Dionysus", locationSourceName: "ship" }),
      event("Tyrsenian pirates", "sought to bind", e12, { objectSourceName: "Dionysus" }),
      event("bonds", "would not hold", e12, { targetSourceName: "Dionysus" }),
      event("helmsman", "cried out", e15, { recipientSourceName: "Tyrsenian pirates" }),
      event("helmsman", "let us set him free", e20, { objectSourceName: "Dionysus", locationSourceName: "shore" }),
      event("master", "chid", e25, { targetSourceName: "helmsman" }),
      event("master", "mark the wind", e25, { recipientSourceName: "helmsman" }),
      event("master", "hoisted", e30, { objectSourceName: "sail", locationSourceName: "ship" }),
      event("wine", "ran streaming", e35, { locationSourceName: "ship" }),
      event("vine", "spread out", e35, { locationSourceName: "ship" }),
      event("ivy", "twined", e40, { objectSourceName: "sail", locationSourceName: "ship" }),
      event("Tyrsenian pirates", "put the ship to land", e40, { recipientSourceName: "helmsman", objectSourceName: "ship" }),
      event("Dionysus", "changed into a dreadful lion", e45, { objectSourceName: "lion", locationSourceName: "ship" }),
      event("Dionysus", "created", e46, { objectSourceName: "bear", locationSourceName: "ship" }),
      event("sailors", "fled", e50, { locationSourceName: "ship" }),
      event("lion", "sprang upon", e51, { targetSourceName: "master" }),
      event("sailors", "leapt out overboard", e52, { locationSourceName: "sea" }),
      event("sailors", "were changed into", e53, { objectSourceName: "dolphins", locationSourceName: "sea" }),
      event("Dionysus", "had mercy", e54, { targetSourceName: "helmsman" }),
      event("Dionysus", "I am loud-crying Dionysus", e56, { recipientSourceName: "helmsman" })
    ],
    initialState: [
      state("Dionysus", "appears as", "a young man by the sea", e1),
      state("Tyrsenian pirates", "are aboard", "ship", e5)
    ],
    finalState: [
      state("sailors", "become", "dolphins", e53),
      state("helmsman", "is spared by", "Dionysus", e54),
      state("Dionysus", "reveals identity as", "Dionysus", e56)
    ],
    causalLinks: [],
    reviewStatus: "awaiting_review",
    review: [
      reviewItem("entity", `${record.candidateId}:entity:tyrsenian-pirates`, "ambiguous-normalization", "Tyrsenian pirates", ["tyrsenian-pirates"], e5.map((item) => item.passageId)),
      reviewItem("entity", `${record.candidateId}:entity:gap-address`, "uncertain-source-text", "good <gap>", [], e55.map((item) => item.passageId))
    ]
  };
}

runCli(async (args) => {
  const selector = args["source-id"] || args.source;
  const sourceConfigs = selector ? REAL_SOURCES.filter((source) => source.sourceId === selector || source.sourceId.indexOf(selector) >= 0) : REAL_SOURCES;
  const selectedSourceIds = new Set(sourceConfigs.map((source) => source.sourceId));
  const selectedRecords = selector ? REAL_RECORDS.filter((record) => selectedSourceIds.has(record.greekSourceId) || selectedSourceIds.has(record.englishSourceId) || record.key === selector) : REAL_RECORDS;
  const registry = resolveIf(args.registry) || path.resolve(process.cwd(), "corpus/normalized/entity-registry.json");
  const vocabulary = resolveIf(args.vocabulary) || path.resolve(process.cwd(), "corpus/normalized/action-vocabulary.json");

  const passageDocs = {};
  const files = { manifests: [], passages: [], candidates: [], extracted: [], myths: [], review: [] };
  let passageCount = 0;
  let warningCount = 0;
  sourceConfigs.forEach((source) => {
    const manifest = resolveIf(source.manifest);
    const raw = resolveIf(source.raw);
    const passages = resolveIf(source.passages);
    ingestSource({ manifest, source: raw, out: manifest, dryRun: args["dry-run"] });
    const passageDoc = extractPassages({ manifest, source: raw, out: passages, dryRun: args["dry-run"] });
    passageDocs[source.sourceId] = passageDoc;
    files.manifests.push(manifest);
    files.passages.push(passages);
    passageCount += passageDoc.passages.length;
    warningCount += passageDoc.warnings.length;
  });

  let eventCount = 0;
  let openReviewCount = 0;
  selectedRecords.forEach((record) => {
    if (!passageDocs[record.greekSourceId]) {
      const source = REAL_SOURCES.find((item) => item.sourceId === record.greekSourceId);
      passageDocs[record.greekSourceId] = readJson(resolveIf(source.passages));
    }
    if (!passageDocs[record.englishSourceId]) {
      const source = REAL_SOURCES.find((item) => item.sourceId === record.englishSourceId);
      passageDocs[record.englishSourceId] = readJson(resolveIf(source.passages));
    }
    const candidateFile = resolveIf(`corpus/candidates/${record.key}.candidate.json`);
    const factsFile = resolveIf(`corpus/extracted/${record.key}.facts.json`);
    const entityFactsFile = resolveIf(`corpus/extracted/${record.key}.entities-normalized.json`);
    const eventFactsFile = resolveIf(`corpus/extracted/${record.key}.events-normalized.json`);
    const mythFile = resolveIf(`corpus/normalized/${record.key}.myth.json`);
    const reviewFile = resolveIf(`corpus/review/${record.key}.review.json`);
    const validationFile = resolveIf(`corpus/review/${record.key}.validation-report.json`);

    const greekSource = REAL_SOURCES.find((source) => source.sourceId === record.greekSourceId);
    const greekPassageFile = resolveIf(greekSource.passages);
    const candidate = buildCandidate({
      passages: greekPassageFile,
      out: candidateFile,
      candidateId: record.candidateId,
      title: record.title,
      sourceId: record.greekSourceId,
      extractionSourceId: record.englishSourceId,
      witnessSourceIds: [record.greekSourceId, record.englishSourceId],
      parallelSourceIds: [record.englishSourceId],
      status: "awaiting_extraction",
      noOverwrite: false,
      dryRun: args["dry-run"]
    });
    const manualFacts = record.facts(record, passageDocs[record.greekSourceId], passageDocs[record.englishSourceId]);
    const facts = extractFacts({ manualFacts, out: factsFile, noOverwrite: false, dryRun: args["dry-run"] });
    const normalizedEntities = normalizeEntities({ facts: factsFile, registry, out: entityFactsFile, noOverwrite: false, dryRun: args["dry-run"] });
    const normalizedEvents = normalizeEvents({ facts: entityFactsFile, registry, vocabulary, out: eventFactsFile, noOverwrite: false, dryRun: args["dry-run"] });
    const myth = buildMythRecord({
      candidate: candidateFile,
      normalizedFacts: eventFactsFile,
      registry,
      out: mythFile,
      mythId: record.mythId,
      mythFamilyId: record.mythFamilyId,
      variantId: record.variantId,
      title: record.title,
      variantLinks: [{ type: "parallel-witnesses", sourceIds: [record.greekSourceId, record.englishSourceId], reviewStatus: "approved" }],
      noOverwrite: false,
      dryRun: args["dry-run"]
    });
    const reviewItems = uniqueReviewItems(myth.normalizationWarnings.concat(normalizedEvents.review || normalizedEntities.review || facts.review || []));
    writeJson(reviewFile, { items: reviewItems }, { dryRun: args["dry-run"] });
    const report = validateCorpus({
      manifests: [resolveIf(REAL_SOURCES.find((source) => source.sourceId === record.greekSourceId).manifest), resolveIf(REAL_SOURCES.find((source) => source.sourceId === record.englishSourceId).manifest)],
      passages: [resolveIf(REAL_SOURCES.find((source) => source.sourceId === record.greekSourceId).passages), resolveIf(REAL_SOURCES.find((source) => source.sourceId === record.englishSourceId).passages)],
      candidates: [candidateFile],
      registries: [registry],
      extracted: [factsFile],
      myths: [mythFile],
      review: [reviewFile],
      out: validationFile,
      dryRun: args["dry-run"]
    });
    if (!report.valid) process.exitCode = 1;
    files.candidates.push(candidateFile);
    files.extracted.push(factsFile);
    files.myths.push(mythFile);
    files.review.push(reviewFile);
    eventCount += myth.events.length;
    openReviewCount += reviewItems.filter((item) => item.status === "open").length;
    void candidate;
    void normalizedEntities;
    void normalizedEvents;
  });

  const combinedReport = validateCorpus(Object.assign({}, files, {
    registries: [registry],
    out: resolveIf("corpus/review/real-sources.validation-report.json"),
    dryRun: args["dry-run"]
  }));
  if (!combinedReport.valid) process.exitCode = 1;
  printResult({
    valid: combinedReport.valid,
    sourceCount: sourceConfigs.length,
    passageCount,
    candidateCount: selectedRecords.length,
    eventCount,
    warningCount,
    openReviewCount,
    report: "corpus/review/real-sources.validation-report.json"
  });
});
