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
const SCHEMA_FILE = path.join(ROOT, "schemas", "production-myth.schema.json");
const SOURCE_AUDITED_BASE = "294068699a3151c0abdcc3f672a52807db1319bc";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function requireString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasFalseVerificationClaim(record) {
  const serialized = JSON.stringify(record);
  return (
    record.status !== "ai_constructed_production" ||
    serialized.includes("verified_by_source_audit") ||
    serialized.includes("human_approved") ||
    serialized.includes("scholarly_approved") ||
    serialized.includes("source_verified") ||
    record.provenance.specificSourceVerified !== false
  );
}

function changedSourceAuditedFiles() {
  try {
    const out = execFileSync(
      "git",
      [
        "diff",
        "--name-only",
        SOURCE_AUDITED_BASE,
        "--",
        "corpus/normalized/bulk/verified"
      ],
      { cwd: ROOT, encoding: "utf8" }
    );
    return out.trim().split("\n").filter(Boolean);
  } catch (error) {
    return [`source-audited diff check failed: ${error.message}`];
  }
}

function validateProductionCorpus() {
  const errors = [];
  const warnings = [];
  const mythFiles = fs.existsSync(MYTH_DIR)
    ? fs.readdirSync(MYTH_DIR).filter((file) => file.endsWith(".json")).sort()
    : [];
  if (mythFiles.length !== 200) {
    errors.push(`expected 200 production myth files, found ${mythFiles.length}`);
  }
  const expectedNames = Array.from({ length: 200 }, (_, index) => {
    return `production-myth-${String(index + 1).padStart(4, "0")}.json`;
  });
  for (const expected of expectedNames) {
    if (!mythFiles.includes(expected)) errors.push(`missing ${expected}`);
  }

  const plan = readJson(PLAN_FILE);
  if (!Array.isArray(plan.records) || plan.records.length !== 200) {
    errors.push("production plan must contain exactly 200 records");
  }
  const catalog = readJson(CATALOG_FILE);
  if (!Array.isArray(catalog.records) || catalog.records.length !== 200) {
    errors.push("production catalog must contain exactly 200 records");
  }

  const records = mythFiles.map((file) => readJson(path.join(MYTH_DIR, file)));
  const ajv = new Ajv({ allErrors: true });
  const validateSchema = ajv.compile(readJson(SCHEMA_FILE));
  const ids = new Set();
  const titles = new Set();
  const planIds = new Set();
  const sourceAuditedFiles = new Set(
    fs.readdirSync(path.join(ROOT, "corpus", "normalized", "bulk", "verified"))
      .filter((file) => file.endsWith(".myth.json"))
      .map((file) => file.replace(".myth.json", ""))
  );

  for (const item of plan.records || []) {
    if (!requireString(item.planId)) errors.push("plan item missing planId");
    if (planIds.has(item.planId)) errors.push(`duplicate planId ${item.planId}`);
    planIds.add(item.planId);
    if (!requireString(item.workingTitle)) errors.push(`${item.planId} missing workingTitle`);
    if (!requireString(item.beginning) || !requireString(item.ending)) {
      errors.push(`${item.planId} missing boundary fields`);
    }
  }

  for (const record of records) {
    if (!validateSchema(record)) {
      errors.push(`${record.id || "unknown production record"} schema errors: ${ajv.errorsText(validateSchema.errors)}`);
    }
    if (!requireString(record.id)) errors.push(`${rel(MYTH_DIR)} record missing id`);
    if (ids.has(record.id)) errors.push(`duplicate production id ${record.id}`);
    ids.add(record.id);
    if (!requireString(record.title)) errors.push(`${record.id} missing title`);
    if (titles.has(record.title)) errors.push(`duplicate production title ${record.title}`);
    titles.add(record.title);
    if (hasFalseVerificationClaim(record)) {
      errors.push(`${record.id} contains a false source/human/scholarly verification claim`);
    }
    if (!record.provenance || record.provenance.type !== "ai_constructed") {
      errors.push(`${record.id} missing ai_constructed provenance`);
    }
    if (!record.scope || record.scope.type !== "complete-episode" || !requireString(record.scope.boundaryRationale)) {
      errors.push(`${record.id} missing complete-episode boundary`);
    }
    for (const key of ["synopsis", "openingSituation", "centralConflict", "resolution", "outcome"]) {
      if (!record.narrative || !requireString(record.narrative[key])) {
        errors.push(`${record.id} missing narrative.${key}`);
      }
    }
    if (!Array.isArray(record.narrative && record.narrative.storyline) || record.narrative.storyline.length < 4) {
      errors.push(`${record.id} needs at least four storyline beats`);
    }
    const characterIds = new Set([]
      .concat(record.mainCharacters || [], record.supportingCharacters || [])
      .map((character) => character.id));
    if (characterIds.size === 0) errors.push(`${record.id} has no characters`);
    for (const relationship of record.relationships || []) {
      if (!characterIds.has(relationship.source)) errors.push(`${record.id} relationship source does not resolve`);
      if (!characterIds.has(relationship.target)) errors.push(`${record.id} relationship target does not resolve`);
    }
    const locationIds = new Set((record.locations || []).map((location) => location.id));
    for (const event of record.events || []) {
      if (!characterIds.has(event.actor)) errors.push(`${record.id} event actor does not resolve`);
      if (event.target && !characterIds.has(event.target)) errors.push(`${record.id} event target does not resolve`);
      if (event.location && !locationIds.has(event.location)) errors.push(`${record.id} event location does not resolve`);
      if (event.sourceText) errors.push(`${record.id} event includes sourceText quotation`);
    }
    if (!record.events || record.events.length < 4) errors.push(`${record.id} needs at least four events`);
    if (!record.adaptation || !record.adaptation.recommendedSceneCount) errors.push(`${record.id} missing production notes`);
    if (!record.qualityReview || Object.keys(record.qualityReview).some((key) => key.endsWith("Passed") && record.qualityReview[key] !== true)) {
      errors.push(`${record.id} has incomplete quality review`);
    }
    for (const linked of (record.referenceLinks && record.referenceLinks.sourceAuditedRecordIds) || []) {
      if (!sourceAuditedFiles.has(linked)) errors.push(`${record.id} links unknown source-audited record ${linked}`);
    }
  }

  for (const catalogRecord of catalog.records || []) {
    if (!ids.has(catalogRecord.id)) errors.push(`catalog references missing record ${catalogRecord.id}`);
    if (!fs.existsSync(path.join(ROOT, catalogRecord.file))) errors.push(`catalog file does not exist: ${catalogRecord.file}`);
  }
  readJson(FAMILY_FILE);
  readJson(SOURCE_LINK_FILE);
  readJson(SUMMARY_FILE);
  readJson(DUPLICATE_FILE);
  readJson(QUALITY_FILE);

  const changed = changedSourceAuditedFiles();
  if (changed.length) {
    errors.push(`source-audited verified files changed: ${changed.join(", ")}`);
  }

  return {
    valid: errors.length === 0,
    productionRecords: records.length,
    planRecords: (plan.records || []).length,
    catalogRecords: (catalog.records || []).length,
    sourceAuditedReferenceRecords: sourceAuditedFiles.size,
    linkedProductionRecords: records.filter((record) => {
      return record.referenceLinks && record.referenceLinks.sourceAuditedRecordIds.length;
    }).length,
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
