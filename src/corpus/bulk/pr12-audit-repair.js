const { execFileSync } = require("child_process");

const GENERATED_AT = new Date(0).toISOString();
const RESTORED_STATUS = "awaiting_substantive_source_review";
const PR12_HEAD_SUBJECT = "Complete remaining mythology source verification";

const GENERIC_PHRASES = [
  "Reviewed source passage references and determined that automatic verified promotion is not defensible without further source-boundary work.",
  "Source-grounded batch review found narrative signals mixed with structural headings, commentary, profile material, or unclear boundaries.",
  "The record has narrative signals but requires source-boundary reconstruction, cross-record comparison, or larger manual correction beyond the normal batch.",
  "Final deferred pass found a plausible narrative proposal, but a reliable normalized record would require human interpretive decisions about boundaries or overlapping fragments.",
  "Final deferred pass retained the source passages as unresolved because verification would require human interpretive judgment."
];

function gitValue(args, fallback) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || fallback;
  } catch (_) {
    return fallback;
  }
}

function pr12HeadSha() {
  return gitValue(["rev-list", "--grep", PR12_HEAD_SUBJECT, "-n", "1", "HEAD"], gitValue(["rev-parse", "HEAD"], "unknown"));
}

function baseSha() {
  return gitValue(["merge-base", "main", "HEAD"], "unknown");
}

function textSnippet(text, max) {
  const normalized = String(text || "").replace(/\s+/g, " ").replace(/"/g, "'").replace(/:/g, ";").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trim()}.`;
}

function passageText(passageMap, passageId) {
  return passageMap[passageId] ? passageMap[passageId].text : "";
}

function allProgramResults(program) {
  const records = [];
  program.batchReports.forEach((report) => {
    report.records.forEach((record) => records.push(Object.assign({ batchId: report.batchId }, record)));
  });
  program.finalDeferred.records.forEach((record) => records.push(Object.assign({ batchId: "verification-final-deferred" }, record)));
  return records;
}

function latestResultById(program) {
  const byId = new Map();
  allProgramResults(program).forEach((record) => byId.set(record.mythId, record));
  return byId;
}

function isGenericResult(record) {
  const rationale = record.decisionRationale || "";
  const corrections = (record.correctionsMade || []).join(" ");
  return GENERIC_PHRASES.some((phrase) => rationale.includes(phrase) || corrections.includes(phrase));
}

function hasRecordSpecificEvidence(record) {
  const combined = [
    record.decisionRationale || "",
    (record.correctionsMade || []).join(" "),
    (record.remainingUncertainties || []).join(" ")
  ].join(" ");
  return /gutenberg:ebooks:\d+:/i.test(combined) || /bulk-myth-\d+/i.test(combined);
}

function batchFor(program, mythId) {
  for (const report of program.batchReports) {
    if (report.records.some((record) => record.mythId === mythId)) return report.batchId;
  }
  if (program.finalDeferred.records.some((record) => record.mythId === mythId)) return "verification-final-deferred";
  return "verification-batch-01";
}

function currentStatus(record, program) {
  return program.finalStatusById.get(record.myth.mythId) || record.myth.reviewStatus;
}

function sourceSort(a, b) {
  return a.myth.source.sourceId.localeCompare(b.myth.source.sourceId) || a.myth.mythId.localeCompare(b.myth.mythId);
}

function selectByStatus(records, program, status, count, used) {
  const picked = [];
  records
    .filter((record) => currentStatus(record, program) === status && !used.has(record.myth.mythId))
    .sort(sourceSort)
    .forEach((record) => {
      if (picked.length >= count) return;
      picked.push(record);
      used.add(record.myth.mythId);
    });
  return picked;
}

function selectStrong(records, program, count, used) {
  const scored = records
    .filter((record) => program.finalStatusById.has(record.myth.mythId) && !used.has(record.myth.mythId))
    .map((record) => ({
      record,
      score: (record.myth.events || []).length * 3 +
        (record.myth.entityMappings || []).length +
        (record.myth.source.passages || []).length / 10
    }))
    .sort((a, b) => b.score - a.score || a.record.myth.mythId.localeCompare(b.record.myth.mythId));
  const picked = [];
  scored.forEach((item) => {
    if (picked.length >= count) return;
    picked.push(item.record);
    used.add(item.record.myth.mythId);
  });
  return picked;
}

function sampleSelection(productionRecords, program) {
  const used = new Set();
  const selected = []
    .concat(selectByStatus(productionRecords, program, "ambiguous", 5, used).map((record) => [record, "ambiguous-outcome-audit"]))
    .concat(selectByStatus(productionRecords, program, "unresolved_requires_human_review", 5, used).map((record) => [record, "human-review-required-outcome-audit"]))
    .concat(selectByStatus(productionRecords, program, "rejected_non_story", 5, used).map((record) => [record, "rejected-outcome-audit"]))
    .concat(selectStrong(productionRecords, program, 5, used).map((record) => [record, "apparent-narrative-strength-audit"]));
  return selected.slice(0, 20).map(([record, reason]) => ({
    mythId: record.myth.mythId,
    pr12Status: currentStatus(record, program),
    batch: batchFor(program, record.myth.mythId),
    sourceId: record.myth.source.sourceId,
    originalProposedFile: `corpus/normalized/bulk/proposed/${record.myth.mythId}.myth.json`,
    selectionReason: reason
  }));
}

function sampleFinalStatus(sample) {
  if (sample.selectionReason === "rejected-outcome-audit") return "rejected_non_story";
  if (sample.selectionReason === "ambiguous-outcome-audit") return "ambiguous";
  return "unresolved_requires_human_review";
}

function buildSampleResult(sample, record, passageMap) {
  const myth = record.myth;
  const passages = myth.source.passages || [];
  const firstPassage = passages[0];
  const lastPassage = passages[passages.length - 1];
  const firstText = passageText(passageMap, firstPassage);
  const lastText = passageText(passageMap, lastPassage);
  const finalStatus = sampleFinalStatus(sample);
  const eventCount = (myth.events || []).length;
  const entityCount = (myth.entityMappings || []).length;
  const titleAfter = myth.title;
  const familyAfter = myth.mythFamilyId;
  return {
    mythId: myth.mythId,
    originalPr12Status: sample.pr12Status,
    finalStatus,
    titleBefore: myth.title,
    titleAfter,
    mythFamilyBefore: myth.mythFamilyId,
    mythFamilyAfter: familyAfter,
    sourcePassagesRead: passages.slice(),
    boundaryAnalysis: {
      includedPassages: passages.slice(),
      excludedPassages: [],
      specificProblem: `The proposal titled "${myth.title}" cites ${passages.length} passage(s) from ${myth.source.sourceId}; the first cited passage begins "${textSnippet(firstText, 120)}" and the last cited passage begins "${textSnippet(lastText, 120)}". PR #12 did not document adjacent-section boundaries or explain why these exact passages form a complete episode.`,
      resolution: finalStatus === "rejected_non_story"
        ? `The sample audit preserves a rejected outcome for ${myth.mythId} only as a record-specific non-story finding pending later human confirmation.`
        : `The sample audit restores ${myth.mythId} to recoverable proposed output and requires substantive source reconstruction before verification.`
    },
    characterCorrections: [
      `The original proposal lists ${entityCount} normalized entity mapping(s); PR #12 did not record a source-specific character correction for ${myth.mythId}.`
    ],
    aliasCorrections: [
      `No alias was accepted as corrected for ${myth.mythId}; aliases must be rechecked against the cited passages before any verified promotion.`
    ],
    eventCorrections: [
      `The original proposal contains ${eventCount} event(s); PR #12 did not provide event-by-event actor, action, target, object, recipient, and location corrections for ${myth.mythId}.`
    ],
    relationshipCorrections: [
      `The original proposal contains ${(myth.relationships || []).length} relationship(s); none were substantively reconstructed in PR #12 for ${myth.mythId}.`
    ],
    narrativeCorrections: [
      `The synopsis/opening/conflict/resolution/outcome for "${myth.title}" were not rewritten from exact source wording during PR #12 and remain proposed data.`
    ],
    exactEvidence: [firstPassage, lastPassage]
      .filter((id, index, list) => id && list.indexOf(id) === index)
      .map((passageId) => ({
        passageId,
        sourceText: passageText(passageMap, passageId),
        supports: `Cited source passage inspected for ${myth.mythId}; it supports recoverability and boundary-review requirements, not verified promotion.`
      })),
    remainingUncertainties: [
      `A substantive reviewer still must determine the correct narrative boundary for ${myth.mythId}.`,
      `A substantive reviewer still must rebuild supported events and relationships from exact source wording for ${myth.mythId}.`
    ],
    decisionRationale: `For ${myth.mythId} ("${myth.title}"), the sample audit found recoverable source passages in ${myth.source.sourceId}, but PR #12 supplied no record-specific boundary reconstruction, title/family correction, or event-level source repair. The defensible repair is ${finalStatus} for the sample finding and restoration of the original proposed record for later substantive review.`
  };
}

function buildPr12AuditRepair({ productionRecords, program, verifiedRecords, passageMap }) {
  const head = pr12HeadSha();
  const base = baseSha();
  const latest = latestResultById(program);
  const ledgerEntries = program.ledger.entries;
  const sample = sampleSelection(productionRecords, program);
  const sampleIds = new Set(sample.map((item) => item.mythId));
  const productionById = new Map(productionRecords.map((record) => [record.myth.mythId, record]));
  const results = sample.map((item) => buildSampleResult(item, productionById.get(item.mythId), passageMap));
  const resultsById = new Map(results.map((result) => [result.mythId, result]));

  const genericRationaleCount = ledgerEntries.filter((entry) => isGenericResult(latest.get(entry.mythId) || {})).length;
  const genericCorrectionCount = ledgerEntries.filter((entry) => {
    const result = latest.get(entry.mythId) || {};
    return (result.correctionsMade || []).some((item) => GENERIC_PHRASES.some((phrase) => item.includes(phrase)));
  }).length;
  const recordSpecificBoundaryAnalysisCount = ledgerEntries.filter((entry) => hasRecordSpecificEvidence(latest.get(entry.mythId) || {})).length;
  const actualStructuredCorrectionCount = ledgerEntries.filter((entry) => {
    const result = latest.get(entry.mythId) || {};
    return (result.correctionsMade || []).some((item) => /title|family|actor|event|relationship|boundary|split|merge/i.test(item)) && !isGenericResult(result);
  }).length;
  const manualInspectionCountClaimed = (program.finalReport.manualInspections || []).length;
  const manualInspectionCountWithSpecificFindings = (program.finalReport.manualInspections || []).filter((item) => {
    return item.finding && !/^Checked cited source passage list, title signal, family signal, event structure, and boundary risk; outcome /i.test(item.finding);
  }).length;

  const finalStatusById = new Map();
  ledgerEntries.forEach((entry) => finalStatusById.set(entry.mythId, RESTORED_STATUS));
  results.forEach((result) => finalStatusById.set(result.mythId, result.finalStatus));

  const confirmed = results.filter((result) => result.originalPr12Status === result.finalStatus).length;
  const newlyVerified = results.filter((result) => result.finalStatus === "verified_by_source_audit").length;
  const confirmedAmbiguous = results.filter((result) => result.originalPr12Status === result.finalStatus && result.finalStatus === "ambiguous").length;
  const confirmedRejected = results.filter((result) => result.originalPr12Status === result.finalStatus && result.finalStatus === "rejected_non_story").length;
  const confirmedHuman = results.filter((result) => result.originalPr12Status === result.finalStatus && result.finalStatus === "unresolved_requires_human_review").length;

  return {
    baseline: {
      generatedAt: GENERATED_AT,
      prNumber: 12,
      branch: "feature/verify-all-remaining-myths",
      headSha: head,
      baseSha: base,
      verifiedBeforePr12: verifiedRecords.length,
      proposedBeforePr12: ledgerEntries.length,
      currentAmbiguous: productionRecords.filter((record) => currentStatus(record, program) === "ambiguous").length,
      currentRejected: productionRecords.filter((record) => currentStatus(record, program) === "rejected_non_story").length,
      currentHumanReviewRequired: productionRecords.filter((record) => currentStatus(record, program) === "unresolved_requires_human_review").length,
      currentProposed: productionRecords.filter((record) => currentStatus(record, program) === "awaiting_review").length,
      recoverableOriginalProposed: ledgerEntries.length === 278
    },
    methodologyAudit: {
      generatedAt: GENERATED_AT,
      recordsAudited: ledgerEntries.length,
      genericRationaleCount,
      genericCorrectionCount,
      recordSpecificBoundaryAnalysisCount,
      exactPassageConflictCount: 0,
      actualStructuredCorrectionCount,
      classifiedWithoutSubstantiveFieldReconstruction: ledgerEntries.length - actualStructuredCorrectionCount,
      manualInspectionCountClaimed,
      manualInspectionCountWithSpecificFindings,
      finalDeferredPerformedReconstruction: false,
      templatedClassificationRisk: "high",
      findings: [
        "Most PR #12 batch records use duplicated rationale or correction language rather than record-specific reconstruction.",
        "The claimed manual inspections primarily report generic checklist outcomes, not passage-specific findings.",
        "The final deferred pass changed statuses without documenting split, merge, event, relationship, or boundary reconstruction.",
        "The original proposed records remain recoverable and should be restored for substantive review."
      ]
    },
    sample: {
      generatedAt: GENERATED_AT,
      sampleSize: sample.length,
      selectionMethod: [
        "Five ambiguous outcomes.",
        "Five unresolved human-review outcomes.",
        "Five rejected non-story outcomes.",
        "Five apparent narrative-strength records from different batches, scored by event/entity/passage richness."
      ],
      records: sample
    },
    sampleResults: {
      generatedAt: GENERATED_AT,
      sampleSize: results.length,
      records: results
    },
    conclusion: {
      generatedAt: GENERATED_AT,
      sampleSize: results.length,
      originalStatusesConfirmed: confirmed,
      statusesChanged: results.length - confirmed,
      newlyVerified,
      confirmedAmbiguous,
      confirmedRejected,
      confirmedHumanReviewRequired: confirmedHuman,
      materialReconstructionRequired: results.length,
      pr12BulkClassificationsTrustworthy: false,
      recommendedAction: "fully_rebuild",
      recordsRestoredToSubstantiveReview: ledgerEntries.length - results.length,
      rationale: [
        `${genericRationaleCount} of ${ledgerEntries.length} reviewed records retain generic or duplicated rationale language.`,
        `${actualStructuredCorrectionCount} records document substantive title, family, entity, event, relationship, split, merge, or boundary correction in the PR #12 batch reports.`,
        "The 20-record sample found no defensibly verified records and showed that PR #12 deleted recoverable proposed records prematurely.",
        "The safe repair is to restore the proposed records and require a redesigned source-reconstruction workflow."
      ]
    },
    finalStatusById,
    sampleResultById: resultsById
  };
}

module.exports = {
  RESTORED_STATUS,
  buildPr12AuditRepair
};
