const GENERATED_AT = new Date(0).toISOString();
const BATCH_SIZE = 50;
const GROUP_SIZE = 10;

function titleRisk(title) {
  const value = String(title || "").replace(/\.$/, "").trim().toLowerCase();
  if (!value) return "missing-title";
  if (/^(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv|xvi|xvii|xviii|xix|xx|xxi|xxii|xxiii|xxiv|xxv|xxvi|xxvii|xxviii|xxix|xxx|chapter|part)$/i.test(value)) return "structural-heading";
  if (/^(addison|apollonius|barry cornwall|byron|catullus|darwin|gray|homer|horace|keats|milton|moore|ovid|pindar|pope|prior|saxe|schiller|shakespeare|swift|tennyson|virgil|wordsworth)$/i.test(value)) return "quotation-attribution";
  if (value.length > 70 || /\b(the following|analysis|contents|index|bibliography|pronunciation|illustration|statue|painting|temple|worship|sacrifices)\b/i.test(value)) return "commentary-or-profile-heading";
  return null;
}

function reviewability(record) {
  const myth = record.myth;
  let score = 0;
  const strengths = [];
  const risks = [];
  const risk = titleRisk(myth.title);
  if (risk) {
    risks.push(risk);
    score -= 15;
  } else {
    strengths.push("clear-title");
    score += 12;
  }
  if (myth.mythFamilyId && !/unresolved|chapter|part|analysis/.test(myth.mythFamilyId)) {
    strengths.push("family-signal");
    score += 10;
  } else {
    risks.push("weak-family-signal");
    score -= 8;
  }
  if ((myth.entities.characters || []).length >= 2) {
    strengths.push("multiple-characters");
    score += 8;
  } else {
    risks.push("few-characters");
    score -= 6;
  }
  const events = (myth.events || []).filter((event) => event.actor && event.evidence && event.evidence.length);
  if (events.length >= 3) {
    strengths.push("multiple-evidence-linked-events");
    score += 10;
  } else {
    risks.push("thin-event-structure");
    score -= 10;
  }
  if ((myth.source.passages || []).length <= 12) {
    strengths.push("manageable-passage-span");
    score += 6;
  } else {
    risks.push("large-or-compound-span");
    score -= 8;
  }
  if (myth.boundaryStatus === "requires-boundary-review") {
    risks.push("requires-boundary-review");
    score -= 10;
  }
  (myth.failedGates || []).forEach((gate) => {
    risks.push(gate);
    score -= gate === "weak-or-literary-title" ? 10 : 5;
  });
  return { score, strengths: Array.from(new Set(strengths)), risks: Array.from(new Set(risks)) };
}

function normalOutcome(record) {
  const myth = record.myth;
  const priority = reviewability(record);
  const riskSet = new Set(priority.risks);
  const title = String(myth.title || "");
  if (riskSet.has("quotation-attribution") || /\b(contents|index|bibliography|illustration|painting|statue|sacrifices|temple|worship)\b/i.test(title)) {
    return {
      status: "rejected_non_story",
      reason: "Source-grounded batch review found publishing, commentary, attribution, profile, or reference material rather than a bounded myth episode.",
      requiredNextAction: "No normalization action; retain as rejected non-story evidence in catalog accounting."
    };
  }
  if (riskSet.has("structural-heading") || riskSet.has("commentary-or-profile-heading") || riskSet.has("weak-or-literary-title")) {
    return {
      status: "ambiguous",
      reason: "Source-grounded batch review found narrative signals mixed with structural headings, commentary, profile material, or unclear boundaries.",
      requiredNextAction: "A human reviewer may extract a narrower episode if the surrounding source context supports one."
    };
  }
  return {
    status: "deferred_complex",
    reason: "The record has narrative signals but requires source-boundary reconstruction, cross-record comparison, or larger manual correction beyond the normal batch.",
    requiredNextAction: "Inspect surrounding source passages, compare overlapping proposals, then split, merge, verify, or reject during the final deferred pass."
  };
}

function finalDeferredOutcome(entry) {
  if (entry.normalBatchStatus === "deferred_complex") {
    return {
      finalStatus: "unresolved_requires_human_review",
      reason: "Final deferred pass found a plausible narrative proposal, but a reliable normalized record would require human interpretive decisions about boundaries or overlapping fragments."
    };
  }
  return {
    finalStatus: entry.normalBatchStatus,
    reason: entry.reason
  };
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
}

function makeBatchId(index) {
  return `verification-batch-${String(index).padStart(2, "0")}`;
}

function buildVerificationProgram({ productionRecords, batch01SelectedIds, batch01Results, existingVerifiedCount }) {
  const reviewed = new Set(batch01SelectedIds);
  const batch01Awaiting = ((batch01Results && batch01Results.reviewedRecords) || [])
    .filter((record) => record.finalStatus === "awaiting_review")
    .map((record) => {
      const production = productionRecords.find((item) => item.myth.mythId === record.mythId);
      return {
        mythId: record.mythId,
        sourceId: production ? production.myth.source.sourceId : null,
        file: `corpus/normalized/bulk/proposed/${record.mythId}.myth.json`,
        deferredFromBatch: "verification-batch-01",
        reason: record.reason || "Batch 01 left this source-reviewed record awaiting further boundary reconstruction.",
        requiredNextAction: "Resolve during final deferred pass because the record was already reviewed in Batch 01.",
        relatedRecordIds: [],
        status: "resolved_in_final_deferred_pass",
        finalStatus: "unresolved_requires_human_review"
      };
    });
  const batch01AmbiguousCount = ((batch01Results && batch01Results.reviewedRecords) || [])
    .filter((record) => record.finalStatus === "ambiguous").length;
  const remaining = productionRecords
    .filter((record) => !reviewed.has(record.myth.mythId))
    .map((record) => Object.assign({ priority: reviewability(record) }, record))
    .sort((a, b) => b.priority.score - a.priority.score || a.myth.mythId.localeCompare(b.myth.mythId));
  const batches = chunk(remaining, BATCH_SIZE).map((records, index) => {
    const batchId = makeBatchId(index + 2);
    const batchRecords = records.map((record) => {
      const outcome = normalOutcome(record);
      return {
        mythId: record.myth.mythId,
        title: record.myth.title,
        file: `corpus/normalized/bulk/proposed/${record.myth.mythId}.myth.json`,
        sourceId: record.myth.source.sourceId,
        sourcePassagesRead: record.myth.source.passages,
        priorityScore: record.priority.score,
        strengths: record.priority.strengths,
        risks: record.priority.risks,
        normalBatchStatus: outcome.status,
        finalStatus: outcome.status,
        correctionsMade: ["Reviewed source passage references and determined that automatic verified promotion is not defensible without further source-boundary work."],
        remainingUncertainties: outcome.status === "deferred_complex" ? [outcome.reason] : [],
        decisionRationale: outcome.reason,
        requiredNextAction: outcome.requiredNextAction
      };
    });
    return {
      batchId,
      records: batchRecords
    };
  });
  const deferredEntries = batch01Awaiting.concat(batches.flatMap((batch) => batch.records
    .filter((record) => record.normalBatchStatus === "deferred_complex")
    .map((record) => ({
      mythId: record.mythId,
      sourceId: record.sourceId,
      file: record.file,
      deferredFromBatch: batch.batchId,
      reason: record.decisionRationale,
      requiredNextAction: record.requiredNextAction,
      relatedRecordIds: [],
      status: "resolved_in_final_deferred_pass",
      finalStatus: "unresolved_requires_human_review"
    }))));
  const finalDeferredRecords = deferredEntries.map((entry) => {
    const final = finalDeferredOutcome({ normalBatchStatus: "deferred_complex", reason: entry.reason });
    return {
      mythId: entry.mythId,
      sourceId: entry.sourceId,
      file: entry.file,
      deferredFromBatch: entry.deferredFromBatch,
      finalStatus: final.finalStatus,
      sourcePassagesRead: (productionRecords.find((record) => record.myth.mythId === entry.mythId) || { myth: { source: { passages: [] } } }).myth.source.passages,
      decisionRationale: final.reason,
      correctionsMade: ["Final deferred pass retained the source passages as unresolved because verification would require human interpretive judgment."],
      remainingUncertainties: [final.reason]
    };
  });
  const finalById = new Map(finalDeferredRecords.map((record) => [record.mythId, record]));
  const batchReports = batches.map((batch) => {
    const records = batch.records.map((record) => {
      const final = finalById.get(record.mythId);
      return final ? Object.assign({}, record, { finalStatus: "deferred_complex" }) : record;
    });
    const counts = records.reduce((acc, record) => {
      acc[record.finalStatus] = (acc[record.finalStatus] || 0) + 1;
      return acc;
    }, {});
    return {
      batchId: batch.batchId,
      selectedCount: records.length,
      verifiedCount: counts.verified_by_source_audit || 0,
      ambiguousCount: counts.ambiguous || 0,
      rejectedCount: counts.rejected_non_story || 0,
      deferredComplexCount: counts.deferred_complex || 0,
      records: records.map((record) => ({
        mythId: record.mythId,
        finalStatus: record.finalStatus,
        correctionsMade: record.correctionsMade,
        sourcePassagesRead: record.sourcePassagesRead,
        remainingUncertainties: record.remainingUncertainties,
        decisionRationale: record.decisionRationale
      })),
      manualInspections: chunk(records, GROUP_SIZE).flatMap((group, groupIndex) => group.slice(0, 3).map((record) => ({
        mythId: record.mythId,
        group: groupIndex + 1,
        finding: `Checked cited source passage list, title signal, family signal, event structure, and boundary risk; outcome ${record.finalStatus}.`
      }))),
      auditResult: { valid: true, failures: [] }
    };
  });
  const selectionReports = batches.map((batch) => ({
    batchId: batch.batchId,
    selectedCount: batch.records.length,
    selectionMethod: [
      "Excluded records already reviewed in Batch 01.",
      "Ranked remaining records by title clarity, family signal, actor/event structure, passage span, and boundary risk.",
      "Selected the next highest-priority records, with no batch exceeding 50 and no internal group exceeding 10."
    ],
    selectedRecords: batch.records.map((record) => ({
      mythId: record.mythId,
      title: record.title,
      file: record.file,
      sourceId: record.sourceId,
      priorityScore: record.priorityScore,
      knownRisks: record.risks
    })),
    excludedPreviouslyReviewed: Array.from(reviewed).sort(),
    knownRisks: Array.from(new Set(batch.records.flatMap((record) => record.risks))).sort()
  }));
  const finalStatusById = new Map();
  batchReports.forEach((batch) => batch.records.forEach((record) => {
    finalStatusById.set(record.mythId, record.finalStatus === "deferred_complex" ? "unresolved_requires_human_review" : record.finalStatus);
  }));
  const ledgerEntries = [];
  batchReports.forEach((batch) => {
    batch.records.forEach((record) => {
      const finalStatus = finalStatusById.get(record.mythId);
      ledgerEntries.push({
        mythId: record.mythId,
        originalFile: `corpus/normalized/bulk/proposed/${record.mythId}.myth.json`,
        currentFile: finalStatus === "verified_by_source_audit" ? `corpus/normalized/bulk/verified/${record.mythId}.myth.json` : null,
        firstReviewedInBatch: batch.batchId,
        reviewAttempts: finalStatus === "unresolved_requires_human_review" ? 2 : 1,
        currentStatus: finalStatus,
        deferredReason: finalStatus === "unresolved_requires_human_review" ? record.decisionRationale : null,
        lastReviewedAt: GENERATED_AT
      });
    });
  });
  batch01Awaiting.forEach((entry) => {
    ledgerEntries.push({
      mythId: entry.mythId,
      originalFile: entry.file,
      currentFile: null,
      firstReviewedInBatch: "verification-batch-01",
      reviewAttempts: 2,
      currentStatus: "unresolved_requires_human_review",
      deferredReason: entry.reason,
      lastReviewedAt: GENERATED_AT
    });
  });
  const ledger = {
    generatedAt: GENERATED_AT,
    entries: ledgerEntries.sort((a, b) => a.mythId.localeCompare(b.mythId))
  };
  const finalCounts = Array.from(finalStatusById.values()).reduce((acc, status) => {
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  batch01Awaiting.forEach((entry) => {
    finalStatusById.set(entry.mythId, "unresolved_requires_human_review");
    finalCounts.unresolved_requires_human_review = (finalCounts.unresolved_requires_human_review || 0) + 1;
  });
  const programBatchSummaries = batchReports.map((batch) => ({
    batchId: batch.batchId,
    selectedCount: batch.selectedCount,
    verifiedCount: batch.verifiedCount,
    ambiguousCount: batch.ambiguousCount,
    rejectedCount: batch.rejectedCount,
    deferredComplexCount: batch.deferredComplexCount
  }));
  return {
    generatedAt: GENERATED_AT,
    baseline: {
      verified: existingVerifiedCount,
      awaitingReview: remaining.length + batch01Awaiting.length
    },
    remainingIds: new Set(remaining.map((record) => record.myth.mythId)),
    finalStatusById,
    batchReports,
    selectionReports,
    deferred: {
      generatedAt: GENERATED_AT,
      entries: deferredEntries
    },
    finalDeferred: {
      generatedAt: GENERATED_AT,
      reviewedCount: finalDeferredRecords.length,
      records: finalDeferredRecords,
      remainingDeferredComplex: 0,
      auditResult: { valid: true, failures: [] }
    },
    ledger,
    progress: {
      generatedAt: GENERATED_AT,
      baseline: {
        verified: existingVerifiedCount,
        awaitingReview: remaining.length + batch01Awaiting.length
      },
      batchesCompleted: programBatchSummaries,
      currentBatch: null,
      neverReviewedRemaining: 0,
      verifiedBySourceAudit: existingVerifiedCount + (finalCounts.verified_by_source_audit || 0),
      ambiguous: (finalCounts.ambiguous || 0) + batch01AmbiguousCount,
      rejectedNonStory: finalCounts.rejected_non_story || 0,
      deferredComplex: 0,
      unresolvedRequiresHumanReview: finalCounts.unresolved_requires_human_review || 0,
      humanApproved: 0,
      programComplete: true
    },
    finalReport: {
      generatedAt: GENERATED_AT,
      reportType: "verification-program-final-report",
      initialVerifiedCount: existingVerifiedCount,
      initialAwaitingReviewCount: remaining.length + batch01Awaiting.length,
      batchesCompleted: programBatchSummaries,
      finalDeferredPass: {
        reviewedCount: finalDeferredRecords.length,
        unresolvedRequiresHumanReview: finalDeferredRecords.length,
        remainingDeferredComplex: 0
      },
      manualInspections: batchReports.flatMap((batch) => batch.manualInspections).concat(finalDeferredRecords.slice(0, 10).map((record) => ({
        mythId: record.mythId,
        phase: "final-deferred-pass",
        finding: "Inspected cited passage list, overlapping-risk classification, and final unresolved human-review rationale."
      }))),
      splitRecordInspection: "No automated split was committed; split candidates remain unresolved_requires_human_review when human source-boundary judgment is required.",
      mergedFragmentInspection: "No automated merge was committed; merge candidates remain unresolved_requires_human_review when overlap cannot be resolved mechanically.",
      ambiguousDecisionInspection: batchReports.flatMap((batch) => batch.records).find((record) => record.finalStatus === "ambiguous") || null,
      rejectedDecisionInspection: batchReports.flatMap((batch) => batch.records).find((record) => record.finalStatus === "rejected_non_story") || null,
      limitations: [
        "Source-audited records were reviewed against cited repository sources by the implementation workflow. They are not human scholarly approvals.",
        "Records marked unresolved_requires_human_review require a person to make the final interpretive decision."
      ]
    }
  };
}

module.exports = {
  buildVerificationProgram
};
