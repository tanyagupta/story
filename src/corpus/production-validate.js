const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const Ajv = require("ajv");

const ROOT = path.resolve(__dirname, "..", "..");
const PRODUCTION_ROOT = path.join(ROOT, "corpus", "production");
const MYTH_DIR = path.join(PRODUCTION_ROOT, "myths");
const PLAN_FILE = path.join(PRODUCTION_ROOT, "plans", "production-myth-plan.json");
const CATALOG_FILE = path.join(PRODUCTION_ROOT, "catalog", "production-myths.json");
const FAMILY_FILE = path.join(PRODUCTION_ROOT, "catalog", "production-myth-families.json");
const SOURCE_LINK_FILE = path.join(PRODUCTION_ROOT, "catalog", "production-source-links.json");
const SUMMARY_FILE = path.join(PRODUCTION_ROOT, "review", "production-corpus-summary.json");
const DUPLICATE_FILE = path.join(PRODUCTION_ROOT, "review", "duplicate-review.json");
const QUALITY_FILE = path.join(PRODUCTION_ROOT, "review", "quality-review.json");
const REPAIR_REVIEW_FILE = path.join(PRODUCTION_ROOT, "review", "production-repair-01.json");
const SCHEMA_FILE = path.join(ROOT, "schemas", "production-myth.schema.json");
const SOURCE_AUDITED_BASE = "294068699a3151c0abdcc3f672a52807db1319bc";
const PR14_PLACEHOLDER_BASE = "21f7dc2655a8d82be4e6079e6dd16cbf50b16203";
const REPAIRED_START = 1;
const REPAIRED_END = 50;
const TARGET_COUNT = 200;

const FORBIDDEN_PHRASES = [
  "in a focused situation rather than a full-cycle summary",
  "the confront action named by the episode",
  "performs the decisive action associated with",
  "changes the condition of",
  "suitable for future adaptation without claiming source verification",
  "a charged exchange between",
  "a closing line that clarifies the changed mythic condition",
  "the central pressure is the",
  "rather than a full-cycle summary"
];

const GENERIC_ACTIONS = new Set(["establish", "challenge", "confront", "resolve"]);
const ALLOWED_RELATIONSHIPS = new Set([
  "parent-of",
  "child-of",
  "sibling-of",
  "spouse-of",
  "ally-of",
  "enemy-of",
  "ruler-of",
  "captor-of",
  "rescuer-of",
  "guide-of",
  "protects",
  "pursues",
  "transforms",
  "punishes",
  "serves"
]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function requireString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function recordNumber(id) {
  const match = /^production-myth-(\d{4})$/.exec(id || "");
  return match ? Number(match[1]) : null;
}

function isRepairedRecord(record) {
  const number = recordNumber(record.id);
  return number >= REPAIRED_START && number <= REPAIRED_END;
}

function flattenStrings(value, out) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => flattenStrings(item, out));
  else if (value && typeof value === "object") Object.keys(value).forEach((key) => flattenStrings(value[key], out));
  return out;
}

function sentences(record) {
  return flattenStrings({
    title: record.title,
    variant: record.variant,
    narrative: record.narrative,
    events: (record.events || []).map((event) => event.consequence),
    themes: record.themes,
    adaptation: record.adaptation
  }, [])
    .flatMap((text) => text.split(/(?<=[.!?])\s+/))
    .map((text) => text.trim())
    .filter((text) => text.split(/\s+/).length >= 8);
}

function eightWordSequences(text) {
  const words = text.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/).filter(Boolean);
  const result = [];
  for (let index = 0; index <= words.length - 8; index += 1) {
    result.push(words.slice(index, index + 8).join(" "));
  }
  return result;
}

function changedSourceAuditedFiles() {
  const out = execFileSync("git", [
    "diff",
    "--name-only",
    SOURCE_AUDITED_BASE,
    "--",
    "corpus/normalized/bulk/verified"
  ], { cwd: ROOT, encoding: "utf8" });
  return out.trim().split("\n").filter(Boolean);
}

function changedOutOfRangeProductionRecords() {
  const out = execFileSync("git", [
    "diff",
    "--name-only",
    PR14_PLACEHOLDER_BASE,
    "--",
    "corpus/production/myths"
  ], { cwd: ROOT, encoding: "utf8" });
  return out.trim().split("\n").filter(Boolean).filter((file) => {
    const match = /production-myth-(\d{4})\.json$/.exec(file);
    if (!match) return true;
    const number = Number(match[1]);
    return number < REPAIRED_START || number > REPAIRED_END;
  });
}

function hasFalseVerificationClaim(record) {
  const serialized = JSON.stringify(record);
  return (
    record.status !== "ai_constructed_production" ||
    serialized.includes("human_approved") ||
    serialized.includes("scholarly_approved") ||
    serialized.includes("source_verified") ||
    record.provenance.specificSourceVerified !== false
  );
}

function validateProductionCorpus() {
  const errors = [];
  const warnings = [];
  const mythFiles = fs.readdirSync(MYTH_DIR).filter((file) => file.endsWith(".json")).sort();
  if (mythFiles.length !== TARGET_COUNT) errors.push(`expected ${TARGET_COUNT} production myth files, found ${mythFiles.length}`);

  const plan = readJson(PLAN_FILE);
  const catalog = readJson(CATALOG_FILE);
  const familyCatalog = readJson(FAMILY_FILE);
  const sourceLinks = readJson(SOURCE_LINK_FILE);
  const summary = readJson(SUMMARY_FILE);
  const duplicateReview = readJson(DUPLICATE_FILE);
  const qualityReview = readJson(QUALITY_FILE);
  const repairReviews = [
    readJson(REPAIR_REVIEW_FILE),
    readJson(path.join(PRODUCTION_ROOT, "review", "production-repair-02.json"))
  ];
  const schema = readJson(SCHEMA_FILE);
  const ajv = new Ajv({ allErrors: true });
  const validateSchema = ajv.compile(schema);
  const records = mythFiles.map((file) => readJson(path.join(MYTH_DIR, file)));
  const repairedRecords = records.filter(isRepairedRecord);
  const placeholderRecords = records.filter((record) => !isRepairedRecord(record));
  const sourceAuditedIds = new Set(
    fs.readdirSync(path.join(ROOT, "corpus", "normalized", "bulk", "verified"))
      .filter((file) => file.endsWith(".myth.json"))
      .map((file) => file.replace(".myth.json", ""))
  );

  if (!Array.isArray(plan.records) || plan.records.length !== TARGET_COUNT) errors.push("production plan must contain exactly 200 records");
  if (!Array.isArray(catalog.records) || catalog.records.length !== TARGET_COUNT) errors.push("production catalog must contain exactly 200 records");
  if (repairedRecords.length !== 50) errors.push(`expected 50 substantively repaired records, found ${repairedRecords.length}`);
  if (placeholderRecords.length !== 150) errors.push(`expected 150 remaining placeholders, found ${placeholderRecords.length}`);
  if (summary.substantivelyRepaired !== 50 || summary.remainingPlaceholders !== 150) {
    errors.push("production summary must report 50 substantively repaired and 150 remaining placeholders");
  }

  const ids = new Set();
  const titles = new Set();
  records.forEach((record) => {
    if (ids.has(record.id)) errors.push(`duplicate production id ${record.id}`);
    ids.add(record.id);
    if (titles.has(record.title)) errors.push(`duplicate production title ${record.title}`);
    titles.add(record.title);
  });

  const planByRecord = new Map((plan.records || []).map((item) => [item.productionRecordId, item]));
  const reviewByRecord = new Map();
  for (const repairReview of repairReviews) {
    const approvedReviewCount = (repairReview.records || []).filter((item) => item.approved === true).length;
    if (!/^production-repair-0[12]$/.test(repairReview.batchId)) errors.push(`unexpected repair review batchId ${repairReview.batchId}`);
    if ((repairReview.records || []).length !== 25 || approvedReviewCount !== 25) {
      errors.push(`${repairReview.batchId} must contain 25 approved repaired records`);
    }
    if (!Array.isArray(repairReview.deepInspections) || repairReview.deepInspections.length < 5) {
      errors.push(`${repairReview.batchId} must include at least five deep inspections`);
    }
    const issueCount = (repairReview.records || []).reduce((sum, item) => {
      return sum + ["accuracyIssues", "characterIssues", "boundaryIssues", "variantIssues", "templateLanguageIssues"].reduce((inner, key) => {
        return inner + ((item[key] || []).length);
      }, 0);
    }, 0);
    if (issueCount === 0 && (!repairReview.deepInspections || repairReview.deepInspections.length < 5)) {
      errors.push(`${repairReview.batchId} has empty issue arrays without specific inspection evidence`);
    }
    (repairReview.records || []).forEach((item) => reviewByRecord.set(item.recordId, item));
  }

  const sentenceOwners = new Map();
  const ngramOwners = new Map();
  for (const record of repairedRecords) {
    if (!validateSchema(record)) {
      errors.push(`${record.id} schema errors: ${ajv.errorsText(validateSchema.errors)}`);
    }
    if (record.qualityReview) errors.push(`${record.id} contains self-certified qualityReview`);
    if (hasFalseVerificationClaim(record)) errors.push(`${record.id} contains a false verification claim`);
    const allText = flattenStrings(record, []).join(" ");
    FORBIDDEN_PHRASES.forEach((phrase) => {
      if (allText.toLowerCase().includes(phrase)) errors.push(`${record.id} contains forbidden template phrase: ${phrase}`);
    });
    const planItem = planByRecord.get(record.id);
    if (!planItem) errors.push(`${record.id} has no plan item`);
    if (!planItem || !Array.isArray(planItem.coreFacts) || planItem.coreFacts.length < 4) errors.push(`${record.id} plan needs at least four coreFacts`);
    const characterIds = new Set(record.characters.map((character) => character.id));
    const characterNames = new Set(record.characters.map((character) => character.name));
    (planItem.requiredCharacters || []).forEach((name) => {
      if (!characterNames.has(name)) errors.push(`${record.id} missing required character ${name}`);
    });
    (planItem.excludedCharacters || []).forEach((name) => {
      if (characterNames.has(name)) errors.push(`${record.id} includes excluded character ${name}`);
    });
    const factIds = new Set((planItem.coreFacts || []).map((fact) => fact.factId));
    const referencedFactIds = new Set();
    record.events.forEach((event) => {
      if (!characterIds.has(event.actor)) errors.push(`${record.id} event actor does not resolve: ${event.actor}`);
      if (event.target && !characterIds.has(event.target)) errors.push(`${record.id} event target does not resolve: ${event.target}`);
      if (GENERIC_ACTIONS.has(event.action)) errors.push(`${record.id} uses generic event action ${event.action}`);
      (event.factIds || []).forEach((factId) => referencedFactIds.add(factId));
    });
    factIds.forEach((factId) => {
      if (!referencedFactIds.has(factId)) errors.push(`${record.id} plan fact ${factId} is not referenced by any event`);
    });
    record.relationships.forEach((relationship) => {
      if (!characterIds.has(relationship.source)) errors.push(`${record.id} relationship source does not resolve: ${relationship.source}`);
      if (!characterIds.has(relationship.target) && !["sky", "sea", "underworld", "delphi"].includes(relationship.target)) {
        errors.push(`${record.id} relationship target does not resolve: ${relationship.target}`);
      }
      if (relationship.relationship === "mythic-tension-with") errors.push(`${record.id} uses forbidden mythic-tension-with relationship`);
      if (!ALLOWED_RELATIONSHIPS.has(relationship.relationship)) errors.push(`${record.id} uses unsupported relationship ${relationship.relationship}`);
      if (/shape .*\\.$/.test(relationship.rationale || "")) errors.push(`${record.id} has generated title-based relationship rationale`);
    });
    if ((record.themes || []).includes("bounded myth episode")) errors.push(`${record.id} contains generic theme bounded myth episode`);
    (record.adaptation.productionNotes || []).forEach((note) => {
      if (/^Focus on /.test(note)) errors.push(`${record.id} has generic Focus on production note`);
    });
    if (/^Starts with .* Stops at /i.test(record.scope.boundaryRationale || "")) {
      errors.push(`${record.id} has mechanically restated boundary rationale`);
    }
    if (record.narrative.synopsis.split(/\s+/).length < 18) errors.push(`${record.id} synopsis is too short for myth-specific action`);
    if (!record.adaptation.visualBeats || record.adaptation.visualBeats.length < 3) errors.push(`${record.id} needs at least three visual beats`);
    record.referenceLinks.sourceAuditedRecordIds.forEach((linked) => {
      if (!sourceAuditedIds.has(linked)) errors.push(`${record.id} links unknown source-audited record ${linked}`);
    });
    const review = reviewByRecord.get(record.id);
    if (!review) errors.push(`${record.id} missing external repair review`);
    else {
      ["accuracyIssues", "characterIssues", "boundaryIssues", "variantIssues", "templateLanguageIssues"].forEach((key) => {
        if (!Array.isArray(review[key])) errors.push(`${record.id} review ${key} must be an array`);
      });
      if (!Array.isArray(review.repairsMade) || review.repairsMade.length === 0) errors.push(`${record.id} repair review lacks repairsMade`);
    }
    sentences(record).forEach((sentence) => {
      const owner = sentenceOwners.get(sentence);
      if (owner && owner !== record.id) errors.push(`identical sentence reused in ${owner} and ${record.id}: ${sentence}`);
      sentenceOwners.set(sentence, record.id);
      eightWordSequences(sentence).forEach((ngram) => {
        const owners = ngramOwners.get(ngram) || new Set();
        owners.add(record.id);
        ngramOwners.set(ngram, owners);
      });
    });
  }

  for (const [ngram, owners] of ngramOwners.entries()) {
    if (owners.size > 3) errors.push(`excessive shared eight-word sequence across repaired records: ${ngram}`);
  }

  const placeholderSelfCertifiedQualityCount = placeholderRecords.filter((record) => record.qualityReview).length;
  if (placeholderSelfCertifiedQualityCount) {
    warnings.push(`${placeholderSelfCertifiedQualityCount} unrepaired placeholder records still contain self-certified qualityReview fields`);
  }

  catalog.records.forEach((item) => {
    if (!ids.has(item.id)) errors.push(`catalog references missing production record ${item.id}`);
    if (!fs.existsSync(path.join(ROOT, item.file))) errors.push(`catalog file missing ${item.file}`);
  });
  if (duplicateReview.valid !== true || qualityReview.valid !== true) errors.push("production review summaries must remain valid");
  if (Object.keys(familyCatalog.families || {}).length === 0) errors.push("production family catalog is empty");
  if (!Array.isArray(sourceLinks.links)) errors.push("production source links catalog malformed");

  const sourceChanges = changedSourceAuditedFiles();
  if (sourceChanges.length) errors.push(`source-audited verified files changed: ${sourceChanges.join(", ")}`);
  const outOfRangeChanges = changedOutOfRangeProductionRecords();
  if (outOfRangeChanges.length) errors.push(`production records outside 0001-0050 changed: ${outOfRangeChanges.join(", ")}`);

  return {
    valid: errors.length === 0,
    productionRecords: records.length,
    planRecords: (plan.records || []).length,
    catalogRecords: (catalog.records || []).length,
    substantivelyRepaired: repairedRecords.length,
    remainingPlaceholders: placeholderRecords.length,
    placeholderSelfCertifiedQualityCount,
    sourceAuditedReferenceRecords: sourceAuditedIds.size,
    linkedProductionRecords: records.filter((record) => record.referenceLinks && record.referenceLinks.sourceAuditedRecordIds && record.referenceLinks.sourceAuditedRecordIds.length).length,
    errors,
    warnings
  };
}

if (require.main === module) {
  const report = validateProductionCorpus();
  console.log(JSON.stringify(report, null, 2));
  if (!report.valid) process.exit(1);
}

module.exports = { validateProductionCorpus };
