function extractSentences(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function buildPassageAccess(passageMap) {
  const ordered = Object.values(passageMap).sort((a, b) => a.sequence - b.sequence || a.passageId.localeCompare(b.passageId));
  const byId = Object.assign({}, passageMap);
  return {
    get(passageId) {
      const passage = byId[passageId];
      if (!passage) throw new Error(`Unknown passage ${passageId}`);
      return {
        passageId: passage.passageId,
        sourceId: passage.sourceId,
        section: String((passage.citation && passage.citation.book) || ""),
        paragraph: String((passage.citation && passage.citation.start) || ""),
        text: passage.text
      };
    },
    ordered(ids) {
      const wanted = new Set(ids);
      return ordered.filter((passage) => wanted.has(passage.passageId));
    },
    contains(passageId, sourceText) {
      return this.get(passageId).text.includes(sourceText);
    },
    sentenceContaining(passageId, needle) {
      const passage = this.get(passageId);
      const found = extractSentences(passage.text).find((sentence) => sentence.includes(needle));
      if (!found) throw new Error(`No complete sentence containing "${needle}" in ${passageId}`);
      return found;
    },
    clause(passageId, sourceText) {
      if (!this.contains(passageId, sourceText)) throw new Error(`Source text is not in ${passageId}: ${sourceText}`);
      return sourceText;
    },
    contiguous(ids) {
      const positions = ids.map((id) => ordered.findIndex((passage) => passage.passageId === id));
      if (positions.some((index) => index < 0)) return false;
      const sorted = positions.slice().sort((a, b) => a - b);
      return sorted.every((position, index) => index === 0 || position === sorted[index - 1] + 1);
    }
  };
}

function isCompleteSentenceText(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (!/[\w)"']+[.!?]"?$/.test(text)) return false;
  if (/,\.$/.test(text)) return false;
  if (/\b(and|when|to|of|the|their|causing)\.$/i.test(text)) return false;
  return true;
}

function hasAliasDuplicate(record, aliasGroups) {
  const ids = new Set(record.entities.characters || []);
  return aliasGroups.some((group) => group.filter((id) => ids.has(id)).length > 1);
}

function evidenceList(record) {
  const items = [];
  (record.entityMappings || []).forEach((mapping) => {
    (mapping.evidence || []).forEach((evidence) => items.push({ kind: "entity", recordId: mapping.normalizedId, sourceName: mapping.sourceName, evidence }));
  });
  (record.relationships || []).forEach((relationship) => {
    items.push({ kind: "relationship", recordId: relationship.relationship, evidence: relationship.evidence });
  });
  (record.events || []).forEach((event) => {
    (event.evidence || []).forEach((evidence) => items.push({ kind: "event", recordId: event.eventId, evidence: Object.assign({}, evidence, { sourceText: event.sourceText }) }));
  });
  (record.evidenceSummary || []).forEach((summary) => {
    items.push({ kind: "evidenceSummary", recordId: summary.passageId, evidence: summary });
  });
  return items;
}

function validateVerifiedRecords(records, passageMap) {
  const access = buildPassageAccess(passageMap);
  const report = {
    generatedAt: new Date(0).toISOString(),
    verifiedRecordsChecked: records.length,
    exactSourceTextFailures: [],
    truncatedExcerptFailures: [],
    entityEvidenceFailures: [],
    unsupportedSupportsFailures: [],
    aliasDuplicationFailures: [],
    boundaryFailures: [],
    crossFieldConsistencyFailures: [],
    eventReferenceFailures: [],
    relationshipFailures: [],
    statusConsistencyFailures: [],
    misleadingScoreFailures: [],
    duplicateOutputFailures: []
  };
  const aliasGroups = [
    ["hades", "pluto", "roman-pluto"],
    ["zeus", "jupiter", "roman-jupiter"],
    ["demeter", "ceres", "roman-ceres"],
    ["persephone", "proserpina", "roman-proserpina"],
    ["hermes", "mercury", "roman-mercury"],
    ["athena", "minerva", "roman-minerva"]
  ];

  records.forEach((record) => {
    const registry = new Set([]
      .concat(record.entities.characters || [])
      .concat(record.entities.locations || [])
      .concat(record.entities.objects || [])
      .concat(record.entities.creatures || []));
    if (record.reviewStatus !== "verified_by_source_audit") {
      report.statusConsistencyFailures.push({ mythId: record.mythId, field: "reviewStatus", value: record.reviewStatus });
    }
    (record.variantLinks || []).forEach((link, index) => {
      if (link.reviewStatus && link.reviewStatus !== "verified_by_source_audit") {
        report.statusConsistencyFailures.push({ mythId: record.mythId, field: `variantLinks.${index}.reviewStatus`, value: link.reviewStatus });
      }
    });
    if (record.reviewStatus === "approved") {
      report.crossFieldConsistencyFailures.push({ mythId: record.mythId, issue: "verified-record-marked-approved" });
    }
    if (record.semanticQuality && Object.prototype.hasOwnProperty.call(record.semanticQuality, "score")) {
      report.misleadingScoreFailures.push({ mythId: record.mythId, field: "semanticQuality.score" });
    }
    if (!record.semanticQuality || record.semanticQuality.passed !== true || record.semanticQuality.verificationLevel !== "source_audited") {
      report.crossFieldConsistencyFailures.push({ mythId: record.mythId, issue: "invalid-source-audit-semantic-quality" });
    }
    if (!record.scope || !Array.isArray(record.scope.includedPassages)) {
      report.boundaryFailures.push({ mythId: record.mythId, issue: "missing-structured-scope" });
    } else {
      record.scope.includedPassages.forEach((passageId) => {
        try { access.get(passageId); } catch (error) { report.boundaryFailures.push({ mythId: record.mythId, passageId, issue: error.message }); }
      });
      if (record.scope.type === "complete-section" && !access.contiguous(record.scope.includedPassages)) {
        report.boundaryFailures.push({ mythId: record.mythId, issue: "complete-section-not-contiguous" });
      }
    }
    if (hasAliasDuplicate(record, aliasGroups)) {
      report.aliasDuplicationFailures.push({ mythId: record.mythId, issue: "alias-duplicates-present" });
    }
    evidenceList(record).forEach((item) => {
      const evidence = item.evidence || {};
      if (!evidence.passageId) {
        report.exactSourceTextFailures.push({ mythId: record.mythId, kind: item.kind, recordId: item.recordId, issue: "missing-passage-id" });
        return;
      }
      let passage;
      try {
        passage = access.get(evidence.passageId);
      } catch (error) {
        report.exactSourceTextFailures.push({ mythId: record.mythId, kind: item.kind, recordId: item.recordId, issue: error.message });
        return;
      }
      if (evidence.sourceText && !passage.text.includes(evidence.sourceText)) {
        report.exactSourceTextFailures.push({ mythId: record.mythId, kind: item.kind, recordId: item.recordId, passageId: evidence.passageId, sourceText: evidence.sourceText });
      }
      if ((item.kind === "evidenceSummary" || item.kind === "event") && evidence.sourceText && !isCompleteSentenceText(evidence.sourceText)) {
        report.truncatedExcerptFailures.push({ mythId: record.mythId, kind: item.kind, recordId: item.recordId, passageId: evidence.passageId, sourceText: evidence.sourceText });
      }
      if (item.kind === "entity") {
        const name = String(item.sourceName || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const coreference = evidence.coreferenceNote || "";
        if (evidence.sourceText && !new RegExp(`\\b${name}\\b`).test(evidence.sourceText) && !coreference) {
          report.entityEvidenceFailures.push({ mythId: record.mythId, recordId: item.recordId, sourceName: item.sourceName, passageId: evidence.passageId });
        }
      }
      if (item.kind === "evidenceSummary") {
        (item.evidence.supports || []).forEach((support) => {
          if (!support.field || !support.evidenceType || !support.rationale) {
            report.unsupportedSupportsFailures.push({ mythId: record.mythId, passageId: evidence.passageId, issue: "support-lacks-rationale" });
          }
        });
      }
    });
    (record.events || []).forEach((event) => {
      if (!registry.has(event.actor)) report.eventReferenceFailures.push({ mythId: record.mythId, eventId: event.eventId, field: "actor", value: event.actor });
      ["target", "object", "recipient", "location"].forEach((field) => {
        if (event[field] && !registry.has(event[field])) report.eventReferenceFailures.push({ mythId: record.mythId, eventId: event.eventId, field, value: event[field] });
      });
      if (!event.sourceText || !event.normalizedStatement) report.eventReferenceFailures.push({ mythId: record.mythId, eventId: event.eventId, issue: "missing-sourceText-or-normalizedStatement" });
      if (event.reviewStatus !== "verified_by_source_audit") {
        report.statusConsistencyFailures.push({ mythId: record.mythId, eventId: event.eventId, field: "events.reviewStatus", value: event.reviewStatus });
      }
    });
    (record.relationships || []).forEach((relationship) => {
      if (!registry.has(relationship.source) || !registry.has(relationship.target)) {
        report.relationshipFailures.push({ mythId: record.mythId, relationship: relationship.relationship, source: relationship.source, target: relationship.target });
      }
      if (relationship.reviewStatus !== "verified_by_source_audit") {
        report.statusConsistencyFailures.push({ mythId: record.mythId, relationship: relationship.relationship, field: "relationships.reviewStatus", value: relationship.reviewStatus });
      }
    });
    (record.entityMappings || []).forEach((mapping) => {
      if (mapping.normalizationStatus !== "verified_by_source_audit") {
        report.statusConsistencyFailures.push({ mythId: record.mythId, entity: mapping.normalizedId, field: "entityMappings.normalizationStatus", value: mapping.normalizationStatus });
      }
    });
    if (!record.verification || record.verification.status !== "verified_by_source_audit") {
      report.crossFieldConsistencyFailures.push({ mythId: record.mythId, issue: "missing-source-audit-verification" });
    }
    if (record.verification && (!(record.verification.claimsChecked || []).length || !(record.verification.correctionsMade || []).length)) {
      report.crossFieldConsistencyFailures.push({ mythId: record.mythId, issue: "verification-report-not-substantive" });
    }
  });

  report.valid = [
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
    "duplicateOutputFailures"
  ].every((field) => report[field].length === 0);
  return report;
}

module.exports = {
  buildPassageAccess,
  extractSentences,
  isCompleteSentenceText,
  validateVerifiedRecords
};
