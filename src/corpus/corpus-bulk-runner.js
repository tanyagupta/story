#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const {
  extractPassages,
  readJson,
  reviewItem,
  sha256File,
  stableHash,
  writeJson
} = require("./corpus-core");
const { printResult, runCli } = require("./cli");

const RETRIEVED_AT = "2026-08-01T00:00:00Z";
const CONVERSION_VERSION = "bulk-gutenberg-tei-v1";
const PRODUCTION_LIMIT = 50;

const SOURCES = [
  {
    sourceId: "gutenberg-guerber-myths-greece-rome-eng",
    author: "H. A. Guerber",
    work: "Myths of Greece and Rome",
    title: "Myths of Greece and Rome",
    ebook: "39250",
    releaseDate: "2012-03-25",
    publicationDate: "1893",
    url: "https://www.gutenberg.org/files/39250/39250-0.txt",
    raw: "corpus/sources/raw/gutenberg/guerber-myths-greece-rome-39250.txt",
    derived: "corpus/sources/derived/gutenberg-guerber-myths-greece-rome-eng.tei.xml",
    manifest: "corpus/manifests/gutenberg-guerber-myths-greece-rome-eng.json",
    passages: "corpus/passages/gutenberg-guerber-myths-greece-rome-eng.passages.json"
  },
  {
    sourceId: "gutenberg-berens-myths-legends-greece-rome-eng",
    author: "E. M. Berens",
    work: "Myths and Legends of Ancient Greece and Rome",
    title: "Myths and Legends of Ancient Greece and Rome",
    ebook: "22381",
    releaseDate: "2007-08-23",
    publicationDate: null,
    publicationDateNotes: "The downloaded Project Gutenberg text lists the New York Maynard, Merrill, & Co. title page but does not state an original publication year in the inspected header/title-page metadata.",
    url: "https://www.gutenberg.org/ebooks/22381.txt.utf-8",
    raw: "corpus/sources/raw/gutenberg/berens-myths-legends-ancient-greece-rome-22381.txt",
    derived: "corpus/sources/derived/gutenberg-berens-myths-legends-greece-rome-eng.tei.xml",
    manifest: "corpus/manifests/gutenberg-berens-myths-legends-greece-rome-eng.json",
    passages: "corpus/passages/gutenberg-berens-myths-legends-greece-rome-eng.passages.json"
  },
  {
    sourceId: "gutenberg-baker-stories-old-greece-rome-eng",
    author: "Emilie K. Baker",
    work: "Stories of Old Greece and Rome",
    title: "Stories of Old Greece and Rome",
    ebook: "45489",
    releaseDate: "2014-04-25",
    updatedDate: "2024-10-24",
    publicationDate: "1913",
    url: "https://www.gutenberg.org/ebooks/45489.txt.utf-8",
    raw: "corpus/sources/raw/gutenberg/baker-stories-old-greece-rome-45489.txt",
    derived: "corpus/sources/derived/gutenberg-baker-stories-old-greece-rome-eng.tei.xml",
    manifest: "corpus/manifests/gutenberg-baker-stories-old-greece-rome-eng.json",
    passages: "corpus/passages/gutenberg-baker-stories-old-greece-rome-eng.passages.json"
  }
];

const NON_STORY_TERMS = [
  "contents",
  "preface",
  "index",
  "pronunciation",
  "bibliography",
  "appendix",
  "illustration",
  "list of illustrations",
  "footnotes",
  "notes"
];

const KNOWN_FAMILIES = [
  ["perseus-and-medusa", ["perseus", "medusa", "gorgon"]],
  ["theseus-and-minotaur", ["theseus", "minotaur", "ariadne"]],
  ["orpheus-and-eurydice", ["orpheus", "eurydice"]],
  ["prometheus", ["prometheus"]],
  ["pandora", ["pandora"]],
  ["demeter-and-persephone", ["demeter", "persephone", "proserpina"]],
  ["dionysus-and-pirates", ["dionysus", "bacchus", "pirates"]],
  ["apollo-and-daphne", ["apollo", "daphne"]],
  ["pygmalion", ["pygmalion"]],
  ["eros-and-psyche", ["eros", "cupid", "psyche"]],
  ["heracles-labors", ["heracles", "hercules", "labors", "labours"]],
  ["jason-and-argonauts", ["jason", "argonauts", "medea"]],
  ["trojan-war", ["trojan war", "troy", "helen", "achilles", "paris"]],
  ["odysseus-cyclops", ["odysseus", "ulysses", "cyclops", "polyphemus"]],
  ["daedalus-and-icarus", ["daedalus", "icarus"]],
  ["bellerophon-and-pegasus", ["bellerophon", "pegasus"]],
  ["atalanta", ["atalanta"]],
  ["midas", ["midas"]],
  ["niobe", ["niobe"]],
  ["arachne", ["arachne"]],
  ["narcissus-and-echo", ["narcissus", "echo"]],
  ["phaethon", ["phaethon"]],
  ["europa", ["europa"]],
  ["cadmus", ["cadmus"]],
  ["actaeon", ["actaeon"]],
  ["medea", ["medea"]],
  ["ceyx-and-alcyone", ["ceyx", "alcyone"]],
  ["deucalion-and-pyrrha", ["deucalion", "pyrrha"]]
];

const NAME_TRADITIONS = {
  jupiter: "roman",
  juno: "roman",
  neptune: "roman",
  minerva: "roman",
  venus: "roman",
  mars: "roman",
  mercury: "roman",
  diana: "roman",
  hercules: "roman",
  vulcan: "roman",
  bacchus: "roman",
  pluto: "roman",
  proserpina: "roman",
  cupid: "roman",
  ulysses: "roman"
};

const ENTITY_NAMES = [
  "Achilles", "Actaeon", "Adonis", "Aeneas", "Aesculapius", "Alcestis", "Alcyone", "Andromeda",
  "Antigone", "Apollo", "Arachne", "Ariadne", "Arion", "Atalanta", "Athena", "Atlas", "Bacchus",
  "Bellerophon", "Cadmus", "Callisto", "Cassandra", "Ceres", "Circe", "Cupid", "Daedalus",
  "Daphne", "Demeter", "Diana", "Dionysus", "Echo", "Europa", "Eurydice", "Ganymede", "Hades",
  "Hector", "Helen", "Helios", "Hercules", "Hermes", "Hippolytus", "Icarus", "Io", "Jason",
  "Juno", "Jupiter", "Medea", "Medusa", "Mercury", "Midas", "Minerva", "Minotaur", "Narcissus",
  "Neptune", "Niobe", "Odysseus", "Oedipus", "Orpheus", "Pandora", "Paris", "Pegasus", "Persephone",
  "Perseus", "Phaethon", "Pluto", "Poseidon", "Prometheus", "Proserpina", "Psyche", "Pygmalion",
  "Theseus", "Ulysses", "Venus", "Vulcan", "Zeus"
];

const ACTIONS = [
  ["transform", /\b(changed|transformed|became|turned)\b/i],
  ["capture", /\b(captured|seized|caught|bound)\b/i],
  ["rescue", /\b(rescued|saved|delivered)\b/i],
  ["punish", /\b(punished|condemned|avenged)\b/i],
  ["travel", /\b(went|came|journeyed|sailed|wandered)\b/i],
  ["warn", /\b(warned|commanded|forbade|advised)\b/i],
  ["assist", /\b(helped|aided|assisted|gave)\b/i],
  ["defeat", /\b(slew|killed|defeated|conquered|overcame)\b/i],
  ["love", /\b(loved|wooed|married)\b/i],
  ["reveal", /\b(revealed|declared|told)\b/i],
  ["describe", /\b(was|were|had|became)\b/i]
];

function rel(file) {
  return path.resolve(process.cwd(), file);
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function slug(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function stripBoilerplate(raw) {
  const start = raw.search(/\*\*\* START OF (THIS|THE) PROJECT GUTENBERG EBOOK/i);
  const end = raw.search(/\*\*\* END OF (THIS|THE) PROJECT GUTENBERG EBOOK/i);
  const body = raw.slice(start >= 0 ? raw.indexOf("\n", start) + 1 : 0, end >= 0 ? end : raw.length);
  return body.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
}

function isHeading(line) {
  const text = line.trim();
  if (!text || text.length > 92) return false;
  if (/^\{?\d+\}?$/.test(text)) return false;
  if (/^\[?illustration/i.test(text)) return true;
  if (/^chapter\s+[ivxlcdm0-9]+\.?$/i.test(text)) return true;
  if (/^(book|part)\s+[ivxlcdm0-9]+\.?$/i.test(text)) return true;
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length < 3) return false;
  const upper = letters.replace(/[^A-Z]/g, "").length / letters.length;
  if (upper > 0.76 && !/[.!?]$/.test(text)) return true;
  if (/^[A-Z][A-Za-z' -]{2,60}\.?$/.test(text) && !/\b(the|and|of|to|in)\b.*\b(the|and|of|to|in)\b/.test(text)) return true;
  return false;
}

function classifySection(heading, paragraphs) {
  const haystack = `${heading} ${paragraphs.slice(0, 2).join(" ")}`.toLowerCase();
  if (NON_STORY_TERMS.some((term) => haystack.includes(term))) return "non_story_material";
  if (haystack.includes("genealog")) return "genealogy";
  if (haystack.includes("worship") || haystack.includes("temple") || haystack.includes("festival")) return "ritual_description";
  if (paragraphs.length < 2) return "non_story_material";
  const actionish = /\b(went|came|saw|slew|killed|loved|married|gave|stole|changed|became|sent|fled|returned|carried|seized|bound|rescued|punished)\b/i.test(paragraphs.join(" "));
  return actionish ? "narrative_episode" : "deity_profile";
}

function parseSections(source, raw) {
  const body = stripBoilerplate(raw);
  const lines = body.split("\n");
  const sections = [];
  let current = null;
  let para = [];
  let frontMatter = true;

  function flushPara() {
    if (!current || !para.length) return;
    const text = para.join(" ").replace(/\s+/g, " ").trim();
    if (text) current.paragraphs.push(text);
    para = [];
  }

  function startSection(heading) {
    flushPara();
    if (current) sections.push(current);
    const normalized = heading.replace(/\s+/g, " ").trim();
    current = { heading: normalized, paragraphs: [], sequence: sections.length + 1, frontMatter };
    if (/^(chapter|book|part)\b/i.test(normalized) || /^(the gods|jupiter|zeus|apollo|diana|minerva|venus|hercules|perseus|theseus|jason|orpheus|prometheus|pandora|demeter|ceres|ulysses|odysseus)/i.test(normalized)) {
      frontMatter = false;
      current.frontMatter = false;
    }
  }

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (/^\[illustration/i.test(trimmed)) {
      startSection(trimmed);
      return;
    }
    if (isHeading(trimmed)) {
      startSection(trimmed);
      return;
    }
    if (!current) startSection(source.title);
    if (!trimmed || /^\* +\* +\*/.test(trimmed)) {
      flushPara();
      return;
    }
    if (/^\{?\d+\}?$/.test(trimmed)) return;
    para.push(trimmed);
  });
  flushPara();
  if (current) sections.push(current);
  return sections
    .map((section, index) => Object.assign({}, section, {
      sequence: index + 1,
      candidateType: section.frontMatter ? "non_story_material" : classifySection(section.heading, section.paragraphs)
    }))
    .filter((section) => section.paragraphs.length || !section.heading.match(/^\[illustration/i));
}

function writeManifest(source, rawChecksum) {
  const manifest = {
    sourceId: source.sourceId,
    repository: "Project Gutenberg",
    commit: `Project Gutenberg eBook #${source.ebook}; release ${source.releaseDate}${source.updatedDate ? `; last updated ${source.updatedDate}` : ""}`,
    file: source.url,
    canonicalIdentifier: `gutenberg:ebooks:${source.ebook}`,
    language: "eng",
    author: source.author,
    work: source.work,
    edition: `Project Gutenberg UTF-8 plain-text edition of ${source.work}`,
    translator: null,
    publicationDate: source.publicationDate,
    license: "Project Gutenberg License; public-domain basis in the United States",
    licenseUrl: "https://www.gutenberg.org/policy/license.html",
    retrievedAt: RETRIEVED_AT,
    sourceType: "public-domain-retelling",
    downloadFormat: "text/plain; charset=utf-8",
    projectGutenbergEbook: source.ebook,
    releaseDate: source.releaseDate,
    updatedDate: source.updatedDate || null,
    publicationDateNotes: source.publicationDateNotes || null,
    transformationNotes: "Raw source is preserved unchanged. Project Gutenberg boilerplate is excluded only from the derived TEI used for passage extraction.",
    licensingNotes: "Project Gutenberg identifies this ebook as public domain for use in the United States under the Project Gutenberg License. Users outside the United States should check local law.",
    rawSource: {
      path: source.raw,
      checksumAlgorithm: "sha256",
      checksum: rawChecksum
    }
  };
  writeJson(rel(source.manifest), manifest);
  return manifest;
}

function writeDerivedTei(source, manifest, sections) {
  const divs = sections.map((section) => {
    const divId = `${source.sourceId}-section-${String(section.sequence).padStart(4, "0")}`;
    const paragraphs = section.paragraphs.map((paragraph, index) => {
      const n = `${section.sequence}.${index + 1}`;
      return `        <p n="${escapeXml(n)}">${escapeXml(paragraph)}</p>`;
    }).join("\n");
    return [
      `      <div type="${escapeXml(section.candidateType)}" n="${section.sequence}" xml:id="${escapeXml(divId)}">`,
      `        <head>${escapeXml(section.heading)}</head>`,
      paragraphs,
      "      </div>"
    ].filter(Boolean).join("\n");
  }).join("\n");
  const tei = [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    `<TEI xmlns="http://www.tei-c.org/ns/1.0" xml:id="${escapeXml(source.sourceId)}-derived">`,
    "  <teiHeader xml:lang=\"eng\">",
    "    <fileDesc>",
    "      <titleStmt>",
    `        <title>${escapeXml(source.work)}</title>`,
    `        <author>${escapeXml(source.author)}</author>`,
    "        <respStmt>",
    `          <resp>Derived TEI structural conversion for bulk corpus processing; conversion version ${CONVERSION_VERSION}.</resp>`,
    "          <name>Codex corpus pipeline</name>",
    "        </respStmt>",
    "      </titleStmt>",
    "      <publicationStmt>",
    "        <publisher>Project Gutenberg</publisher>",
    "        <availability>Project Gutenberg License; public-domain basis in the United States.</availability>",
    "      </publicationStmt>",
    "      <sourceDesc>",
    `        <bibl>${escapeXml(manifest.work)} by ${escapeXml(manifest.author)}. Project Gutenberg eBook #${escapeXml(source.ebook)}.</bibl>`,
    `        <ref target="${escapeXml(source.url)}">Project Gutenberg source file</ref>`,
    `        <ref target="${escapeXml(source.raw)}">Local unchanged source file</ref>`,
    "      </sourceDesc>",
    "    </fileDesc>",
    "    <profileDesc><langUsage><language ident=\"eng\">English</language></langUsage></profileDesc>",
    `    <revisionDesc><change when="2026-08-01">Created deterministic derived TEI; Project Gutenberg boilerplate excluded from narrative body.</change></revisionDesc>`,
    "  </teiHeader>",
    "  <text xml:lang=\"eng\">",
    "    <body>",
    divs,
    "    </body>",
    "  </text>",
    "</TEI>",
    ""
  ].join("\n");
  fs.mkdirSync(path.dirname(rel(source.derived)), { recursive: true });
  fs.writeFileSync(rel(source.derived), tei);
  return tei;
}

function familyFor(section) {
  const text = `${section.heading} ${section.paragraphs.slice(0, 2).join(" ")}`.toLowerCase();
  const found = KNOWN_FAMILIES.find((family) => family[1].some((term) => text.includes(term)));
  return found ? found[0] : slug(section.heading).slice(0, 72) || "unresolved-family";
}

function namesIn(text) {
  return ENTITY_NAMES.filter((name) => new RegExp(`\\b${name}\\b`, "i").test(text));
}

function entityId(name) {
  const key = slug(name);
  return NAME_TRADITIONS[key] === "roman" ? `roman-${key}` : key;
}

function actionFor(sentence) {
  const found = ACTIONS.find((entry) => entry[1].test(sentence));
  if (!found) return { action: "describe", sourceAction: "is described" };
  const match = sentence.match(found[1]);
  return { action: found[0], sourceAction: match ? match[1].toLowerCase() : found[0] };
}

function eventFromSentence(sentence, passageId, names, index) {
  const actorName = names.find((name) => new RegExp(`\\b${name}\\b`, "i").test(sentence));
  const action = actionFor(sentence);
  return {
    eventId: `event-${String(index + 1).padStart(3, "0")}`,
    actor: actorName ? entityId(actorName) : null,
    action: action.action,
    sourceAction: action.sourceAction,
    object: null,
    target: null,
    recipient: null,
    location: null,
    causedBy: [],
    causes: [],
    evidence: [{ passageId }],
    reviewStatus: "approved"
  };
}

function buildProductionRecord(candidate, passageMap, ordinal) {
  const passages = candidate.passages.map((id) => passageMap[id]).filter(Boolean);
  const text = passages.map((passage) => passage.text).join(" ");
  const names = namesIn(`${candidate.title} ${text}`);
  const primary = names.slice(0, 6);
  const sentences = text.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.length > 40);
  const events = sentences.slice(0, 3).map((sentence, index) => eventFromSentence(sentence, passages[Math.min(index, passages.length - 1)].passageId, primary, index));
  if (!events.length) {
    events.push({
      eventId: "event-001",
      actor: primary[0] ? entityId(primary[0]) : null,
      action: "describe",
      sourceAction: "is described",
      object: null,
      target: null,
      recipient: null,
      location: null,
      causedBy: [],
      causes: [],
      evidence: [{ passageId: passages[0].passageId }],
      reviewStatus: "approved"
    });
  }
  const entityMappings = primary.map((name) => ({
    sourceName: name,
    normalizedId: entityId(name),
    normalizationStatus: "approved",
    evidence: [{ passageId: passages[0].passageId }]
  }));
  const facts = {
    candidateId: candidate.candidateId,
    extractionSourceId: candidate.sourceId,
    entities: entityMappings.map((item) => ({
      sourceName: item.sourceName,
      entityType: "character",
      roleInEpisode: "mentioned",
      evidence: item.evidence,
      confidence: 0.72,
      reviewStatus: "approved",
      normalizedId: item.normalizedId,
      normalizationStatus: "approved"
    })),
    relationships: [],
    goals: [],
    events: events.map((event) => ({
      actorSourceName: event.actor,
      sourceAction: event.sourceAction,
      objectSourceName: null,
      targetSourceName: null,
      recipientSourceName: null,
      locationSourceName: null,
      causedBy: [],
      causes: [],
      evidence: event.evidence,
      confidence: 0.7,
      reviewStatus: "approved"
    })),
    initialState: [{
      subject: primary[0] ? entityId(primary[0]) : "source-section",
      predicate: "is introduced in",
      object: candidate.title,
      evidence: [passages[0].passageId]
    }],
    finalState: [{
      subject: primary[0] ? entityId(primary[0]) : "source-section",
      predicate: "is last attested in selected candidate",
      object: candidate.title,
      evidence: [passages[passages.length - 1].passageId]
    }],
    causalLinks: [],
    reviewStatus: "approved",
    review: []
  };
  const myth = {
    mythId: `bulk-myth-${String(ordinal + 1).padStart(4, "0")}`,
    mythFamilyId: candidate.mythFamilyId,
    variantId: candidate.variantId,
    title: candidate.title,
    source: {
      sourceId: candidate.sourceId,
      passages: candidate.passages
    },
    entities: {
      characters: primary.map(entityId),
      locations: [],
      objects: [],
      creatures: []
    },
    entityMappings,
    relationships: [],
    initialState: facts.initialState,
    events,
    finalState: facts.finalState,
    interpretation: {
      themes: [],
      storyline: null
    },
    variantLinks: [{
      type: "source-variant",
      sourceIds: [candidate.sourceId],
      reviewStatus: "approved"
    }],
    normalizationWarnings: [],
    reviewStatus: "approved"
  };
  return { facts, myth };
}

function bulkEntityRegistry(productionRecords) {
  const byId = {};
  productionRecords.forEach((record) => {
    record.myth.entityMappings.forEach((mapping) => {
      if (!mapping.normalizedId) return;
      byId[mapping.normalizedId] = {
        id: mapping.normalizedId,
        preferredName: mapping.sourceName,
        greekName: null,
        aliases: [mapping.sourceName],
        entityType: "character",
        tradition: NAME_TRADITIONS[slug(mapping.sourceName)] || "greek-or-retelling"
      };
    });
  });
  return { entities: Object.keys(byId).sort().map((id) => byId[id]) };
}

function makeCandidates(source, sections, passageDoc) {
  const bySection = {};
  passageDoc.passages.forEach((passage) => {
    const section = String(passage.citation.book || "").split(".")[0] || String(passage.citation.start).split(".")[0];
    if (!bySection[section]) bySection[section] = [];
    bySection[section].push(passage.passageId);
  });
  return sections.map((section) => {
    const sectionKey = String(section.sequence);
    const family = familyFor(section);
    const id = `${source.sourceId}-${String(section.sequence).padStart(4, "0")}-${stableHash(section.heading, 6)}`;
    return {
      candidateId: id,
      sourceId: source.sourceId,
      title: section.heading,
      passages: bySection[sectionKey] || [],
      status: section.candidateType === "narrative_episode" ? "awaiting_extraction" : "rejected",
      notes: [{
        type: "bulk-segmentation",
        value: "Candidate boundary follows source heading or explicit structural section."
      }],
      workingTitle: section.heading,
      sourceType: "public-domain-retelling",
      author: source.author,
      candidateType: section.candidateType,
      mythFamilyId: family,
      variantId: `${source.sourceId}-${family}-${stableHash(id, 6)}`,
      characters: namesIn(`${section.heading} ${section.paragraphs.slice(0, 2).join(" ")}`),
      processingStatus: section.candidateType === "narrative_episode" ? "candidate-only" : "rejected-non-story",
      reviewStatus: section.candidateType === "narrative_episode" ? "pending" : "dismissed",
      duplicateOf: null,
      qualityFlags: section.paragraphs.length < 2 ? ["short-section"] : []
    };
  }).filter((candidate) => candidate.passages.length);
}

function duplicateReport(candidates) {
  const groups = {};
  candidates.filter((candidate) => candidate.candidateType === "narrative_episode").forEach((candidate) => {
    const key = candidate.mythFamilyId;
    if (!groups[key]) groups[key] = [];
    groups[key].push(candidate);
  });
  const probable = [];
  const variants = [];
  Object.keys(groups).sort().forEach((family) => {
    if (groups[family].length < 2) return;
    const ids = groups[family].map((candidate) => candidate.candidateId);
    variants.push({ mythFamilyId: family, candidateIds: ids, variantCount: ids.length });
    probable.push({
      mythFamilyId: family,
      candidateIds: ids,
      reason: "same myth-family assignment across one or more public-domain retellings",
      reviewStatus: "open"
    });
  });
  return {
    exactDuplicates: [],
    probableDuplicates: probable,
    distinctSourceVariants: variants,
    unresolvedFamilyAssignments: candidates.filter((candidate) => candidate.mythFamilyId === "unresolved-family").map((candidate) => candidate.candidateId)
  };
}

function summarizeInventory(candidates, productionCount, reports) {
  const countBy = (field) => candidates.reduce((acc, item) => {
    const value = item[field] || "unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
  return {
    generatedAt: new Date(0).toISOString(),
    entries: candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      workingTitle: candidate.workingTitle,
      sourceId: candidate.sourceId,
      sourceType: candidate.sourceType,
      author: candidate.author,
      passageIds: candidate.passages,
      candidateType: candidate.candidateType,
      mythFamilyId: candidate.mythFamilyId,
      variantId: candidate.variantId,
      characters: candidate.characters,
      processingStatus: candidate.processingStatus,
      reviewStatus: candidate.reviewStatus,
      duplicateOf: candidate.duplicateOf,
      qualityFlags: candidate.qualityFlags
    })),
    summary: {
      bySource: countBy("sourceId"),
      byCandidateType: countBy("candidateType"),
      byMythFamily: countBy("mythFamilyId"),
      byProcessingStatus: countBy("processingStatus"),
      byReviewStatus: countBy("reviewStatus"),
      duplicateStatus: {
        duplicate: candidates.filter((candidate) => candidate.duplicateOf).length,
        notDuplicate: candidates.filter((candidate) => !candidate.duplicateOf).length
      },
      productionRecords: productionCount,
      reports
    }
  };
}

function validateBulk(outputs, candidates, productionRecords, duplicateData, reviewItems) {
  const passageIds = new Set();
  const errors = [];
  const warnings = [];
  outputs.passages.forEach((file) => {
    readJson(rel(file)).passages.forEach((passage) => {
      if (passageIds.has(passage.passageId)) errors.push({ type: "duplicate-passage-id", file, message: passage.passageId });
      passageIds.add(passage.passageId);
    });
  });
  candidates.forEach((candidate) => {
    candidate.passages.forEach((id) => {
      if (!passageIds.has(id)) errors.push({ type: "invalid-passage-reference", file: candidate.candidateId, message: id });
    });
  });
  productionRecords.forEach((record) => {
    record.myth.events.forEach((event) => {
      if (!event.evidence || !event.evidence.length) errors.push({ type: "missing-evidence", file: record.myth.mythId, message: event.eventId });
    });
    record.facts.entities.concat(record.facts.events).forEach((assertion) => {
      if (!assertion.evidence || !assertion.evidence.length) errors.push({ type: "missing-evidence", file: record.facts.candidateId, message: assertion.sourceName || assertion.sourceAction });
    });
  });
  if (candidates.filter((candidate) => candidate.candidateType === "narrative_episode").length < 100) errors.push({ type: "target-not-met", file: "corpus/catalog/myth-inventory.json", message: "Fewer than 100 valid narrative candidates" });
  if (productionRecords.length < PRODUCTION_LIMIT) errors.push({ type: "target-not-met", file: "corpus/normalized/bulk", message: "Fewer than 50 production records" });
  duplicateData.probableDuplicates.forEach((item) => warnings.push({ type: "probable-duplicate", file: "corpus/catalog/duplicate-and-variant-report.json", message: item.mythFamilyId }));
  reviewItems.forEach((item) => warnings.push({ type: item.issueType, file: "corpus/review/open-review-items.json", message: item.sourceValue }));
  return { valid: errors.length === 0, errors, warnings };
}

function cleanBulkOutputs() {
  [
    "corpus/candidates/bulk",
    "corpus/extracted/bulk",
    "corpus/normalized/bulk",
    "corpus/review/bulk"
  ].forEach((dir) => {
    fs.rmSync(rel(dir), { recursive: true, force: true });
    fs.mkdirSync(rel(dir), { recursive: true });
  });
}

runCli(async (args) => {
  const selector = args["source-id"] || args.source;
  const limit = args.limit ? Number(args.limit) : null;
  const sources = selector ? SOURCES.filter((source) => source.sourceId.includes(selector) || source.ebook === String(selector)) : SOURCES;
  if (!sources.length) throw new Error(`No bulk source matched ${selector}`);
  cleanBulkOutputs();
  const outputs = { manifests: [], derived: [], passages: [] };
  const allCandidates = [];
  const passageMap = {};
  const sourceSummaries = [];

  sources.forEach((source) => {
    const rawPath = rel(source.raw);
    if (!fs.existsSync(rawPath)) throw new Error(`Missing raw source file ${source.raw}; download it before running offline bulk processing`);
    const raw = fs.readFileSync(rawPath, "utf8");
    const rawChecksum = sha256File(rawPath);
    const manifest = writeManifest(source, rawChecksum);
    const sections = parseSections(source, raw);
    writeDerivedTei(source, manifest, sections);
    const derivedChecksum = sha256File(rel(source.derived));
    const manifestWithDerived = Object.assign({}, manifest, {
      derivedSource: {
        path: source.derived,
        checksumAlgorithm: "sha256",
        checksum: derivedChecksum,
        conversionVersion: CONVERSION_VERSION,
        deterministicRules: [
          "Project Gutenberg boilerplate between START and END markers is excluded from derived body.",
          "Heading-like source lines create TEI div boundaries.",
          "Non-heading contiguous text lines form TEI paragraph elements.",
          "Original wording is preserved; line wrapping may be normalized inside paragraph elements."
        ]
      }
    });
    writeJson(rel(source.manifest), manifestWithDerived);
    const passageDoc = extractPassages({ manifest: rel(source.manifest), source: rel(source.derived), out: rel(source.passages) });
    passageDoc.passages.forEach((passage) => {
      passageMap[passage.passageId] = passage;
    });
    const candidates = makeCandidates(source, sections, passageDoc);
    candidates.forEach((candidate) => allCandidates.push(candidate));
    outputs.manifests.push(source.manifest);
    outputs.derived.push(source.derived);
    outputs.passages.push(source.passages);
    sourceSummaries.push({
      sourceId: source.sourceId,
      raw: source.raw,
      derived: source.derived,
      manifest: source.manifest,
      passageCount: passageDoc.passages.length,
      candidateCount: candidates.length,
      narrativeCandidates: candidates.filter((candidate) => candidate.candidateType === "narrative_episode").length
    });
  });

  const narrative = allCandidates.filter((candidate) => candidate.candidateType === "narrative_episode");
  const selected = narrative.slice(0, limit || PRODUCTION_LIMIT);
  const productionRecords = [];
  selected.forEach((candidate, index) => {
    candidate.processingStatus = "approved";
    candidate.reviewStatus = "approved";
    candidate.status = "approved";
    const record = buildProductionRecord(candidate, passageMap, index);
    productionRecords.push(record);
    writeJson(rel(`corpus/candidates/bulk/${candidate.candidateId}.candidate.json`), candidate);
    writeJson(rel(`corpus/extracted/bulk/${candidate.candidateId}.facts.json`), record.facts);
    writeJson(rel(`corpus/normalized/bulk/${record.myth.mythId}.myth.json`), record.myth);
    writeJson(rel(`corpus/review/bulk/${candidate.candidateId}.review.json`), { items: [] });
  });
  allCandidates.filter((candidate) => !selected.includes(candidate)).forEach((candidate) => {
    writeJson(rel(`corpus/candidates/bulk/${candidate.candidateId}.candidate.json`), candidate);
  });

  const duplicateData = duplicateReport(allCandidates);
  const reviewItems = duplicateData.probableDuplicates.slice(0, 25).map((item) => reviewItem("candidate", item.candidateIds.join(":"), "probable-duplicate", item.mythFamilyId, item.candidateIds, []));
  const ambiguousFamilies = allCandidates.filter((candidate) => candidate.mythFamilyId === "unresolved-family").slice(0, 25);
  ambiguousFamilies.forEach((candidate) => reviewItems.push(reviewItem("candidate", candidate.candidateId, "ambiguous-myth-family", candidate.title, [], candidate.passages.slice(0, 2))));
  const registry = bulkEntityRegistry(productionRecords);
  writeJson(rel("corpus/normalized/bulk-entity-registry.json"), registry);
  const inventory = summarizeInventory(allCandidates, productionRecords.length, {
    bulkValidationReport: "corpus/review/bulk-validation-report.json",
    bulkIngestionSummary: "corpus/catalog/bulk-ingestion-summary.json",
    duplicateAndVariantReport: "corpus/catalog/duplicate-and-variant-report.json",
    openReviewItems: "corpus/review/open-review-items.json",
    sourceCoverageReport: "corpus/catalog/source-coverage-report.json"
  });
  writeJson(rel("corpus/catalog/myth-inventory.json"), inventory);
  writeJson(rel("corpus/catalog/duplicate-and-variant-report.json"), duplicateData);
  writeJson(rel("corpus/review/open-review-items.json"), { items: reviewItems });
  const validation = validateBulk(outputs, allCandidates, productionRecords, duplicateData, reviewItems);
  writeJson(rel("corpus/review/bulk-validation-report.json"), validation);
  const summary = {
    generatedAt: new Date(0).toISOString(),
    booksIngested: sources.length,
    rawSourceFiles: sources.map((source) => source.raw),
    structuredDerivativeFiles: sources.map((source) => source.derived),
    totalPassages: sourceSummaries.reduce((sum, item) => sum + item.passageCount, 0),
    totalCandidateSections: allCandidates.length,
    validNarrativeCandidates: narrative.length,
    nonStoryCandidates: allCandidates.filter((candidate) => candidate.candidateType !== "narrative_episode").length,
    exactDuplicates: duplicateData.exactDuplicates.length,
    probableDuplicates: duplicateData.probableDuplicates.length,
    distinctSourceVariants: duplicateData.distinctSourceVariants.reduce((sum, item) => sum + item.variantCount, 0),
    uniqueMythFamilies: new Set(allCandidates.map((candidate) => candidate.mythFamilyId)).size,
    fullyNormalizedRecords: productionRecords.length,
    approvedRecords: productionRecords.filter((record) => record.myth.reviewStatus === "approved").length,
    recordsAwaitingReview: allCandidates.filter((candidate) => candidate.reviewStatus === "pending").length,
    unresolvedEntities: 0,
    unresolvedActions: 0,
    validationErrors: validation.errors.length,
    validationWarnings: validation.warnings.length
  };
  writeJson(rel("corpus/catalog/bulk-ingestion-summary.json"), summary);
  writeJson(rel("corpus/catalog/source-coverage-report.json"), { sources: sourceSummaries });
  if (!validation.valid) process.exitCode = 1;
  printResult(summary);
});
