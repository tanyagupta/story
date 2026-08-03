#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { validateWithSchema, readJson, portableReportValue, writeJson } = require("./corpus-core");

const ROOT = path.resolve(__dirname, "../..");
const VERIFIED_DIR = path.join(ROOT, "corpus/normalized/bulk/verified");
const PRODUCTION_DIR = path.join(ROOT, "corpus/production/myths");
const CATALOG_DIR = path.join(ROOT, "corpus/production/catalog");
const REVIEW_DIR = path.join(ROOT, "corpus/production/review");
const SCHEMA_DIR = path.join(ROOT, "schemas");
const AUDIT_FILE = path.join(REVIEW_DIR, "verified-phase1-phase2-mapping-audit.json");

function exists(file) {
  return fs.existsSync(file);
}

function listJson(dir) {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir).filter((file) => file.endsWith(".json")).sort();
}

function add(errors, type, message, details) {
  errors.push(Object.assign({ type, message }, details || {}));
}

function collectAllowedRefs(verified) {
  return new Set([
    ...(verified.entities && verified.entities.characters ? verified.entities.characters : []),
    ...(verified.entities && verified.entities.creatures ? verified.entities.creatures : []),
    ...(verified.entities && verified.entities.objects ? verified.entities.objects : []),
    ...(verified.entities && verified.entities.locations ? verified.entities.locations : [])
  ]);
}

function validateLinkedProduction() {
  const errors = [];
  const warnings = [];
  const verifiedFiles = listJson(VERIFIED_DIR);
  const productionFiles = listJson(PRODUCTION_DIR);

  if (verifiedFiles.length !== 32) {
    add(errors, "verified-count", `Expected 32 verified Phase 1 records, found ${verifiedFiles.length}`);
  }
  if (productionFiles.length !== 32) {
    add(errors, "production-count", `Expected 32 linked Phase 2 production records, found ${productionFiles.length}`);
  }

  const verifiedById = new Map();
  verifiedFiles.forEach((file) => {
    const record = readJson(path.join(VERIFIED_DIR, file));
    verifiedById.set(record.mythId, { file, record });
    if (record.reviewStatus !== "verified_by_source_audit") {
      add(errors, "phase1-status", `${record.mythId} is not verified_by_source_audit`, { file });
    }
  });

  const productionById = new Map();
  productionFiles.forEach((file) => {
    const fullPath = path.join(PRODUCTION_DIR, file);
    const record = readJson(fullPath);
    if (productionById.has(record.id)) {
      add(errors, "duplicate-production-id", `Duplicate production ID ${record.id}`, { file });
    }
    productionById.set(record.id, { file, record });

    const schema = validateWithSchema(SCHEMA_DIR, "production-myth.schema.json", record);
    if (!schema.valid) {
      add(errors, "production-schema", `${record.id} does not match production schema`, { file, schemaErrors: schema.errors });
    }
    if (record.status !== "ai_constructed_production") {
      add(errors, "production-status", `${record.id} has invalid status ${record.status}`, { file });
    }
    if (JSON.stringify(record).includes("verified_by_source_audit") || JSON.stringify(record).includes("human_approved") || JSON.stringify(record).includes("scholarly_approved")) {
      add(errors, "false-production-verification", `${record.id} contains a false verification or approval claim`, { file });
    }

    const linkedIds = record.referenceLinks && record.referenceLinks.sourceAuditedRecordIds ? record.referenceLinks.sourceAuditedRecordIds : [];
    if (linkedIds.length !== 1 || !verifiedById.has(linkedIds[0])) {
      add(errors, "missing-source-link", `${record.id} must link to exactly one verified Phase 1 record`, { file, linkedIds });
      return;
    }

    const verified = verifiedById.get(linkedIds[0]).record;
    const allowed = collectAllowedRefs(verified);
    const characterIds = new Set((record.characters || []).map((character) => character.id));
    const factIds = new Set((record.coreFacts || []).map((fact) => fact.factId));

    if (record.title !== verified.title) {
      add(errors, "title-mismatch", `${record.id} title does not match linked Phase 1 title`, { file, phase1Title: verified.title, phase2Title: record.title });
    }
    if (record.mythFamily !== verified.mythFamilyId) {
      add(errors, "family-mismatch", `${record.id} myth family does not match linked Phase 1 family`, { file });
    }

    const verifiedPassages = JSON.stringify((verified.scope && verified.scope.includedPassages) || (verified.source && verified.source.passages) || []);
    const productionPassages = JSON.stringify((record.scope && record.scope.includedPassages) || []);
    if (verifiedPassages !== productionPassages) {
      add(errors, "boundary-mismatch", `${record.id} does not preserve the linked Phase 1 included passage boundary`, { file });
    }

    (record.characters || []).forEach((character) => {
      if (!allowed.has(character.id)) {
        add(errors, "unsupported-character", `${record.id} includes ${character.id}, which is not in the linked Phase 1 entities`, { file });
      }
    });

    (record.events || []).forEach((event, index) => {
      if (event.sequence !== index + 1) {
        add(errors, "event-sequence", `${record.id} has non-contiguous event sequence`, { file, sequence: event.sequence });
      }
      (event.factIds || []).forEach((factId) => {
        if (!factIds.has(factId)) {
          add(errors, "unknown-fact", `${record.id} event references unknown fact ${factId}`, { file });
        }
      });
      ["actor", "target", "object", "recipient", "location"].forEach((field) => {
        const value = event[field];
        if (value && !allowed.has(value)) {
          add(errors, "unsupported-event-reference", `${record.id} event ${event.sequence} ${field} ${value} is not in linked Phase 1 entities`, { file });
        }
      });
      if (event.actor && !characterIds.has(event.actor)) {
        add(errors, "event-actor-not-character", `${record.id} event ${event.sequence} actor ${event.actor} is missing from characters`, { file });
      }
    });

    factIds.forEach((factId) => {
      if (!(record.events || []).some((event) => (event.factIds || []).includes(factId))) {
        add(errors, "unused-fact", `${record.id} core fact ${factId} is not used by an event`, { file });
      }
    });

    (record.relationships || []).forEach((relationship) => {
      if (!characterIds.has(relationship.source) || !characterIds.has(relationship.target)) {
        add(errors, "relationship-endpoint", `${record.id} relationship ${relationship.id} endpoint is not a production character`, { file });
      }
    });
  });

  if (!exists(AUDIT_FILE)) {
    add(errors, "missing-audit", "Missing verified Phase 1 to Phase 2 mapping audit");
  } else {
    const audit = readJson(AUDIT_FILE);
    if (audit.phase1VerifiedRecordCount !== 32 || audit.phase2MappedRecordCount !== 32) {
      add(errors, "audit-count", "Mapping audit does not report complete 32-record coverage");
    }
    if ((audit.unresolvedMappings || []).length > 0) {
      add(errors, "unresolved-mapping", "Mapping audit contains unresolved mappings", { unresolvedMappings: audit.unresolvedMappings });
    }
    (audit.records || []).forEach((mapping) => {
      if (!verifiedById.has(mapping.phase1Id)) {
        add(errors, "audit-phase1-path", `Audit references missing Phase 1 record ${mapping.phase1Id}`);
      }
      if (!productionById.has(mapping.phase2Id)) {
        add(errors, "audit-phase2-path", `Audit references missing Phase 2 record ${mapping.phase2Id}`);
      }
    });
  }

  ["production-myths.json", "production-myth-families.json", "production-source-links.json"].forEach((file) => {
    if (!exists(path.join(CATALOG_DIR, file))) add(errors, "missing-production-catalog", `Missing ${file}`);
  });

  const report = portableReportValue({
    valid: errors.length === 0,
    verifiedPhase1Records: verifiedFiles.length,
    linkedProductionRecords: productionFiles.length,
    errors,
    warnings
  }, ROOT);
  writeJson(path.join(REVIEW_DIR, "linked-production-validation-report.json"), report);
  return report;
}

if (require.main === module) {
  const report = validateLinkedProduction();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.valid ? 0 : 1);
}

module.exports = { validateLinkedProduction };
