# Greek Mythology Corpus Pipeline

This layer extracts and normalizes source-supported myth records.
It does not generate stories, scene plans, storyboards, or videos.

This corpus subsystem is not connected to story generation,
storyboards, Blender, AI rendering, audio, or video.

The corpus pipeline is a standalone subsystem:

```text
TEI XML source
→ source manifest
→ addressable passages
→ candidate myth episode
→ extracted facts
→ normalized entities and events
→ validated myth record
```

It currently has no adapters, imports, orchestration, or automatic handoffs into the storyboard, Blender, AI-renderer, audio, or video-generation code. A later phase may consume normalized myth records upstream of story generation, but that integration is intentionally outside this implementation.

## Layout

```text
corpus/
  manifests/       ingested source manifests with raw-file checksums
  sources/raw/     convention for local raw TEI files; not populated with corpora
  passages/        extracted addressable passages
  candidates/      human-reviewable episode groupings
  extracted/       source-supported facts and normalized intermediate facts
  normalized/      entity registry, action vocabulary, and myth records
  review/          review queues and validation reports
schemas/           JSON Schemas for every pipeline stage
src/corpus/        corpus-only CLI and processing code
tests/fixtures/    small local TEI fixtures
```

## Licensing And Provenance

Every source needs its own manifest. Do not infer licenses from a repository or from related files. Greek editions and translations should be separate source records.

Required manifest fields include `sourceId`, `repository`, `commit`, `file`, `language`, `work`, `license`, `licenseUrl`, and `retrievedAt`. Ingestion records a SHA-256 checksum for the local raw source and later extraction rejects checksum changes.

## Commands

```bash
npm run corpus:ingest -- --manifest corpus/manifests/example.json --source corpus/sources/raw/example.xml
npm run corpus:passages -- --manifest corpus/manifests/example.json --source corpus/sources/raw/example.xml --out corpus/passages/example.passages.json
npm run corpus:extract -- --candidate corpus/candidates/example.candidate.json --passages corpus/passages/example.passages.json --registry corpus/normalized/entity-registry.json --vocabulary corpus/normalized/action-vocabulary.json --out corpus/extracted/example.facts.json
npm run corpus:normalize -- --facts corpus/extracted/example.entities-normalized.json --candidate corpus/candidates/example.candidate.json --registry corpus/normalized/entity-registry.json --vocabulary corpus/normalized/action-vocabulary.json --out corpus/normalized/example.myth.json
npm run corpus:validate -- --manifests corpus/manifests/example.json --passages corpus/passages/example.passages.json --candidates corpus/candidates/example.candidate.json --registries corpus/normalized/entity-registry.json --extracted corpus/extracted/example.facts.json --myths corpus/normalized/example.myth.json --out corpus/review/example.validation.json
npm run corpus:run
npm run corpus:real
npm run corpus:bulk
npm run test:corpus
```

Derived approved records are not overwritten by stage commands unless `--force` is provided. Commands support explicit input and output paths and do not require network access. `npm run corpus:run` rebuilds the local fixture outputs under `corpus/`.

`npm run corpus:real` rebuilds the committed real-source corpus outputs from local files only. It processes the selected Homeric Hymn witnesses, verifies or records checksums, extracts passages from TEI witnesses, writes candidates, emits evidence-backed facts, normalizes entities/events, writes review queues, and creates validation reports. It accepts an optional selector:

```bash
npm run corpus:real -- --source-id perseus-homeric-hymn-7-dionysus
```

The command writes:

```text
corpus/candidates/homeric-hymn-23-zeus.candidate.json
corpus/candidates/homeric-hymn-7-dionysus.candidate.json
corpus/extracted/homeric-hymn-23-zeus.*.json
corpus/extracted/homeric-hymn-7-dionysus.*.json
corpus/normalized/homeric-hymn-23-zeus.myth.json
corpus/normalized/homeric-hymn-7-dionysus.myth.json
corpus/review/homeric-hymn-23-zeus.review.json
corpus/review/homeric-hymn-7-dionysus.review.json
corpus/review/real-sources.validation-report.json
```

`npm run corpus:bulk` rebuilds the public-domain compilation layer from locally committed Project Gutenberg text files. It verifies raw checksums, creates deterministic derived TEI files, extracts passages, segments candidate episodes from source structure, updates the inventory, writes duplicate/variant and review reports, and produces 50 conservative normalized production records. It accepts selectors and limits:

```bash
npm run corpus:bulk -- --source-id 39250
npm run corpus:bulk -- --limit 25
```

## TEI Support

The extractor handles common TEI structures including `text`, `body`, `div`, `p`, `l`, `lg`, `sp`, `speaker`, `milestone`, `pb`, `xml:id`, and `n`. It preserves source text, order, citations, deterministic passage IDs, and source pointers. Ambiguous or unsupported text-bearing structures are reported as warnings rather than silently discarded.

## Candidates

Candidate episodes group existing passage IDs. Candidate titles are working metadata, not source claims. Boundaries are intentionally human-reviewable; this implementation does not infer all episode boundaries automatically.

## Extraction And Normalization

The default fact extractor is deterministic and offline. It extracts structured facts only when supported by selected passages and requires evidence for every entity and event assertion. It does not add general mythological knowledge, infer motives, write narrative prose, or generate dialogue.

Entity normalization uses `corpus/normalized/entity-registry.json`. Source names are preserved alongside normalized IDs. Roman and Greek identities remain separate; optional reviewed links may connect them. Unknown or ambiguous names enter the review queue.

Action normalization uses `corpus/normalized/action-vocabulary.json`. Source wording is preserved in `sourceAction`, with a separate `action` field for normalized actions. Unknown actions remain unresolved and are queued for review.

## Real Sources

The first real Greek sources are short Homeric Hymns from `PerseusDL/canonical-greekLit` at commit `91595f89e15b4d3000cd93efcf8990720c8be2b9`.

The English semantic witness layer uses Project Gutenberg eBook #348, *Hesiod, The Homeric Hymns, and Homerica*, translated by Hugh G. Evelyn-White. The original downloaded UTF-8 text file is retained unchanged at `corpus/sources/raw/gutenberg-hesiod-homeric-hymns-homerica-348.txt`. Because the corpus extractor currently expects TEI, two small derived TEI wrappers are kept beside the original source file:

```text
corpus/sources/raw/gutenberg-homeric-hymn-23-zeus-eng-derived.tei.xml
corpus/sources/raw/gutenberg-homeric-hymn-7-dionysus-eng-derived.tei.xml
```

These wrappers are structural conversions for passage extraction only. They preserve the selected Project Gutenberg section text and record the unchanged source compilation in their manifests. The downloaded source states a Project Gutenberg License/public-domain basis for use in the United States; users outside the United States should check local law. The manifests preserve that licensing note rather than treating it as a silent repository-wide assumption.

Current witnesses:

```text
Hymn 23 to Zeus
  Greek edition: data/tlg0013/tlg023/tlg0013.tlg023.perseus-grc2.xml
  English translation: Project Gutenberg eBook #348 section XXIII, derived TEI wrapper

Hymn 7 to Dionysus
  Greek edition: data/tlg0013/tlg007/tlg0013.tlg007.perseus-grc2.xml
  English translation: Project Gutenberg eBook #348 section VII, derived TEI wrapper
```

Hymn 7 to Dionysus was selected as the narrative source because it is short, self-contained, and has identifiable characters, objects, transformations, and a complete beginning-to-ending action sequence involving Dionysus, pirates, the helmsman, the ship, divine signs, and the sailors' transformation into dolphins.

The Greek TEI headers identify the 1914 Evelyn-White edition in *Hesiod, the Homeric Hymns and Homerica*. The Perseus repository license file is CC-BY-SA-4.0. The manifests preserve the uncertainty that the selected Greek TEI files do not contain a per-file license statement and that Perseus materials can vary by component.

Greek editions, the unchanged Project Gutenberg English compilation, and the derived English TEI wrappers are separate source records. The English witnesses are used for deterministic semantic fact extraction where appropriate, while the Greek witnesses remain the original-language source for candidate boundaries and parallel evidence. The pipeline does not claim verified line-by-line equivalence beyond the cited passage evidence stored in the generated facts.

Candidate boundaries:

```text
homeric-hymn-23-zeus
  all four Greek lines of the short invocation

homeric-hymn-7-dionysus
  the complete 59-line Greek hymn as one self-contained narrative
```

Fact extraction for real sources is deterministic and offline. It uses curated source-supported assertions embedded in the real-source runner, and every entity, relationship, state, and event cites Greek and/or English passage IDs. The runner does not add motives, conflicts, morals, classic storyline labels, dialogue, scene plans, storyboards, or video instructions.

Open review items are written when the text or normalization requires human judgment. Current examples include the identity nuance around "Tyrsenian pirates" and the damaged/gapped address in Hymn 7 line 55.

## Variants

Conflicting accounts are preserved as separate source variants within a myth family:

```text
myth family
  → source variant
  → source passages
  → normalized events
```

The corpus layer does not correct one ancient source using another and does not synthesize a combined canonical narrative.

## Review And Validation

Review queues are JSON files in `corpus/review/`. Typical issues include unresolved names, ambiguous normalization, alias collisions, unsupported actions, uncertain boundaries, invalid causal links, and possible duplicate myths.

Validation produces a machine-readable JSON report and a terminal summary. It detects malformed JSON, schema failures, missing licenses or revisions, checksum changes, duplicate passage IDs, invalid passage references, unknown entity IDs, alias collisions, events without evidence, invalid event references, unresolved normalization, invalid statuses, and duplicate myth IDs.

For real sources, validation also checks translation witness provenance such as translator and publication metadata, and keeps open review items visible as report warnings rather than silently approving them.

## Later Integration

Normalized myth records are designed so a future story generator can consume them. That future generator, and any connection to storyboard or rendering, should be implemented as a separate phase.

Current limitations:

```text
- Mixed-content TEI is parsed with the existing XML parser; editorial notes can affect extracted English passage text order in complex lines.
- Real-source semantic extraction is curated and deterministic, not a general Greek NLP extractor.
- Greek and English witness alignment is evidence-based but not a full critical alignment model.
- Review queues are JSON only; there is no review UI.
```

## Public-Domain Compilation Layer

A public-domain retelling is not an ancient textual witness.

Multiple retellings of the same myth remain separate source variants.

The corpus subsystem is not connected to story generation or rendering.

The bulk layer currently ingests three Project Gutenberg mythology compilations:

```text
H. A. Guerber, Myths of Greece and Rome, Project Gutenberg #39250
E. M. Berens, Myths and Legends of Ancient Greece and Rome, Project Gutenberg #22381
Emilie K. Baker, Stories of Old Greece and Rome, Project Gutenberg #45489
```

Each raw UTF-8 text file is preserved unchanged under `corpus/sources/raw/gutenberg/`. The runner removes Project Gutenberg boilerplate only in deterministic derived TEI files under `corpus/sources/derived/`; it does not rewrite, modernize, summarize, or paraphrase the source prose. The manifests record ebook number, release/update dates where available, original publication year, source URL, retrieval date, Project Gutenberg License/public-domain basis in the United States, raw checksum, and derived conversion metadata.

Candidate segmentation uses source structure first: headings, chapters, explicit section breaks, and non-story markers. Tables of contents, prefaces, illustration captions, indexes, footnotes, biographies, literary commentary, deity profiles without an episode, and other publishing matter are retained in the inventory as non-story material rather than treated as production episodes.

Bulk processing has distinct stages:

```text
ingestion -> candidate detection -> normalization -> semantic qualification -> review -> approval
```

Schema validation only proves that JSON has the expected shape. It does not prove that a record is a useful myth narrative. A nonempty field is not evidence that the field is correct. The bulk runner may propose candidate interpretations, but it must not approve them automatically.

Bulk records now move through three separate stages:

```text
candidate detection
machine-proposed extraction
verified story record
```

Machine-generated extraction is never marked `approved`. Automated gates can decide whether a section is worth proposing, but a populated synopsis, event list, actor count, or evidence ID does not prove that the semantic interpretation is correct. Machine output remains `awaiting_review` until a stronger source-grounded review creates a separate verified record. Verified by source audit is not the same as human scholarly approval.

A production-ready bulk myth must include source-supported narrative content:

```text
named mythological participants
at least three meaningful ordered events unless the selected source is genuinely shorter
at least two actor-bearing events
a meaningful object, target, recipient, location, or event outcome
a synopsis
an opening situation
a central conflict, task, transformation, danger, pursuit, loss, test, or other change
a resolution or outcome
storyline beats
source evidence and short evidence excerpts
```

The runner does not count generic `was`, `were`, or `had` statements as primary plot events, and it does not create placeholder states such as `source-section`. It also avoids fixed-length narrative truncation: summaries and excerpts are shortened only at sentence boundaries, and likely fragments such as `and.`, `when.`, `to.`, `of.`, `the.`, or `,.` are blocked from verified records.

The current batch output is:

```text
total passages: 6292
total candidate sections: 917
valid narrative candidates: 291
non-story candidates: 626
machine-proposed records awaiting substantive source review: 248
source-audited records: 16
approved by human review: 0
ambiguous source-reviewed records: 13
rejected non-story source-reviewed records: 5
unresolved records requiring human review: 15
records restored for substantive review by PR #12: 258
open review items: probable duplicate and ambiguous family review queues
```

The verified seed records currently cover: The Story of Proserpina; Phryxus, Helle, and the Golden Fleece; The Heraclidae; Perseus and Medusa; Daedalus and Icarus; and The Story of Pandora. These records use `reviewStatus = "verified_by_source_audit"` and include `verification.method = "Codex source-grounded implementation review"`. Source-audited means the record's claims and structured fields were checked against the cited source passages. Source-audited does not mean human scholarly approval.

Verified records are built from `src/corpus/bulk/verified-records.js` and `src/corpus/bulk/verification-batch-01.js`, then validated by `src/corpus/bulk/evidence-validator.js`. Each verified event separates exact source wording from normalized interpretation:

```json
{
  "sourceText": "Exact verbatim source sentence or clause.",
  "normalizedStatement": "Conservative normalized description."
}
```

`sourceText` must occur verbatim in the cited passage. Entity evidence must cite a passage where the source name appears, or it must include an explicit coreference note. Evidence excerpts must be complete source sentences and every `supports` entry must include an evidence type and rationale. The audit report at `corpus/review/source-text-audit-report.json` fails the run if exact source text, sentence completeness, entity evidence, relationship endpoints, event references, alias normalization, boundary status, or substantive verification notes are invalid.

Numeric semantic certainty scores are not used for verified records. Verified records keep a pass/fail provenance checklist under `semanticQuality`, including `verificationLevel = "source_audited"`, the checks passed, failed checks, and limitations. Proposed machine records may still contain extraction confidence or ranking values; those values are triage signals, not correctness claims.

The normalized proposed records are deterministic automatic records. They preserve source provenance, candidate boundaries, evidence references, source-derived entity mappings, proposed narrative summaries, source excerpts, and ordered proposed events. The batch runner does not synthesize a canonical narrative across books; overlapping retellings are grouped by myth family and kept as distinct source variants.

Records generated by automation default to `awaiting_review`. After the PR #12 audit repair, most PR #12 classifications are restored as `awaiting_substantive_source_review`, meaning a generic classification pass touched the record but did not perform enough source reconstruction to support a final semantic outcome. Records that are clearly not stories are marked as rejected non-story candidates in the catalog. Records with narrative signals remain available for review or correction. `approved` is reserved for a future explicit human review workflow.

Relationships are extracted only when the selected source wording clearly states one, such as parentage, marriage, assistance, pursuit, or enmity. Missing relationships are not filled from general mythology.

Bulk outputs are written to:

```text
corpus/catalog/myth-inventory.json
corpus/catalog/bulk-ingestion-summary.json
corpus/catalog/approved-myths.json
corpus/catalog/proposed-myths.json
corpus/catalog/verified-myths.json
corpus/catalog/myths-awaiting-review.json
corpus/catalog/rejected-candidates.json
corpus/catalog/duplicate-and-variant-report.json
corpus/catalog/source-coverage-report.json
corpus/candidates/bulk/
corpus/extracted/bulk/
corpus/normalized/bulk/proposed/
corpus/normalized/bulk/verified/
corpus/review/bulk-validation-report.json
corpus/review/semantic-quality-report.json
corpus/review/source-text-audit-report.json
corpus/review/automated-structure-check.json
corpus/review/codex-source-verification.json
corpus/review/open-review-items.json
```

The final normalized bulk directory has two committed record sets: `corpus/normalized/bulk/proposed/` for recoverable machine-proposed records awaiting review or sample-level audit disposition, and `corpus/normalized/bulk/verified/` for source-audited records. Top-level `corpus/normalized/bulk/bulk-myth-*.myth.json` files are stale duplicate outputs from earlier pipeline versions and are removed by the runner. `corpus/catalog/approved-myths.json` is intentionally empty until a human review workflow exists. Proposed machine records are listed in `corpus/catalog/proposed-myths.json`; records needing substantive source reconstruction are listed in `corpus/catalog/myths-awaiting-review.json`. Source-audited records are listed in `corpus/catalog/verified-myths.json`. Rejected non-story candidates are listed in `corpus/catalog/rejected-candidates.json`.

## Batch source verification

The first controlled verification batch reviews exactly 20 machine-proposed records and writes its reproducible decision trail to:

```text
corpus/review/verification-priority.json
corpus/review/verification-batch-01.json
corpus/review/verification-batch-01-results.json
corpus/review/verification-progress.json
```

`verification-priority.json` ranks all proposed records using source-grounded review-priority criteria: clear title, known myth family, manageable passage span, identifiable actors, at least three meaningful evidence-linked events, visible conflict or transformation, source-supported outcome, low alias ambiguity, and avoidance of commentary, genealogy, index, title-page, or deity-profile material. The priority score is only a review-ordering aid. It is not a semantic certainty score and does not imply correctness.

`verification-batch-01.json` selects the first 20 records for manual source review. Selection favors short, self-contained or coherently bounded episodes from more than one source book, and it avoids spending batch slots on records already represented by the six seed verified stories. Selection for review does not imply that a record will pass verification.

Each selected record receives one outcome: `verified_by_source_audit`, `awaiting_review`, `ambiguous`, or `rejected_non_story`. A record becomes `verified_by_source_audit` only when the source passages support the title, family, scope, characters, relationships, narrative fields, and every structured event. A record remains unverified whenever a material source or interpretation uncertainty remains.

Batch 01 verified nine additional records: Cadmus Founds Thebes; Paris Abducts Helen; The Apple of Discord at the Wedding; Bacchus Lures Vulcan to Olympus; Diana and Endymion; Infant Hercules and the Serpents; The Calydonian Hunt; Oedipus and the Sphinx; and Bellerophon, Pegasus, and the Chimera. Seven selected records required later boundary work, and four selected records were marked `ambiguous` because their passage groups mix multiple episodes or embed a story inside taxonomy/profile material. No selected records were marked `approved`, and no human-approved records were created.

PR #12 later attempted a large continuous review of the remaining machine proposals in deterministic batches 02 through 07. That methodology failed: it changed statuses in bulk, but did not provide enough record-specific source reconstruction to support those statuses. The failed output files are archived, not current corpus decision files:

```text
corpus/review/archive/failed-bulk-review/verification-batch-02.json
corpus/review/archive/failed-bulk-review/verification-batch-02-results.json
...
corpus/review/archive/failed-bulk-review/verification-batch-07.json
corpus/review/archive/failed-bulk-review/verification-batch-07-results.json
corpus/review/archive/failed-bulk-review/verification-final-deferred-results.json
corpus/review/archive/failed-bulk-review/verification-program-final-report.json
```

The archive includes a README stating that the files are historical evidence only, are not authoritative, and must not be consumed by catalogs, audits, or downstream story-generation logic.

Future verification work should use small record-specific batches. Ten records per branch is the recommended maximum. A record is not source-verified merely because its passages were listed or its status was changed. Substantive source reconstruction requires record-specific corrections and exact passage evidence, including boundary analysis, title/family decision, character/entity review, event review, relationship review, and a rationale that names the specific record and source problem.

### PR #12 Audit Repair

PR #12 originally attempted to classify all remaining proposed records. A follow-up audit found that the batch-result rationales and correction notes were overwhelmingly generic. The audit reports are:

```text
corpus/review/pr12-audit-baseline.json
corpus/review/pr12-methodology-audit.json
corpus/review/pr12-reconstruction-sample.json
corpus/review/pr12-reconstruction-sample-results.json
corpus/review/pr12-audit-conclusion.json
corpus/review/pr12-templated-review-safeguards.json
```

The methodology audit records 278 reviewed records, 278 generic rationales, 278 generic correction sets, and zero substantive structured corrections in the PR #12 batch reports. It also records that the claimed manual inspections were mostly checklist-level findings rather than passage-specific reconstruction.

The repair selects a representative 20-record sample from PR #12 outcomes: five ambiguous records, five unresolved human-review records, five rejected non-story records, and five records chosen for apparent narrative strength. Each sample result includes record-specific passage evidence and explains why the original PR #12 decision was or was not defensible. No sample record became newly `verified_by_source_audit`.

Because the sample and methodology audit show a high templated-classification risk, `pr12-audit-conclusion.json` sets `recommendedAction = "fully_rebuild"` and `pr12BulkClassificationsTrustworthy = false`. The runner restores 258 non-sample records to `awaiting_substantive_source_review`; they remain proposed, recoverable records and are not treated as verified, ambiguous, rejected, or human-review-required until a later source-reconstruction method reviews them with record-specific evidence.

`awaiting_substantive_source_review` means the record is not never-seen, but the previous classification was not substantive enough to support a final semantic status. Future verification batches should begin from this queue and must document exact boundary, title, family, entity, event, relationship, and narrative corrections for each record reviewed.

Classification is not equivalent to reconstruction. A record remains unverified unless the reviewer reconstructs the source boundary and verifies the structured fields against exact cited passages. Records marked `unresolved_requires_human_review` must state the specific human decision needed; the status must not be used as a substitute for difficult reconstruction work.

### Reconstruction Batch 02

The first post-restoration reconstruction branch processes exactly ten source proposals from `awaiting_substantive_source_review` and stops. Its reports are:

```text
corpus/review/reconstruction-batch-02-selection.json
corpus/review/reconstruction-batch-02-results.json
corpus/review/reconstruction-batch-02-manual-inspection.json
```

The batch deliberately avoids PR #12's twenty-record audit sample. Selection favors recognizable, contiguous, tractable source sections from Berens and Guerber, but selection is not verification. Each selected record receives record-specific boundary analysis, title/family review, character/entity review, alias review, event review, relationship review, narrative correction notes, exact passage evidence, and a manual inspection entry.

Batch 02 outcomes:

```text
selected source proposals: 10
new source-audited records: 1
ambiguous records: 4
rejected non-story records: 0
unresolved records requiring human review: 5
remaining awaiting substantive source review: 248
```

The newly source-audited record is `bulk-verified-0016`, "Alcmaeon and the Necklace", reconstructed as a complete Berens section from ten contiguous passages. It rebuilds the machine proposal's sparse Apollo/Zeus extraction into source-supported entities, relationships, events, and narrative fields for Alcmaeon's revenge, punishment, deception, death, Calirrhoe's prayer, and the final deposition of Harmonia's necklace and veil at Delphi.

The other nine selected records are not discarded and are not treated as verified. They receive substantive final outcomes with specific reasons: multi-episode Golden Fleece and Perseus spans require human split decisions; Jason, the early Perseus setup, Greek returns from Troy, and a long Argonautic travel sequence are ambiguous boundaries; Daedalus/Icarus, Bellerophon, and Ulysses require human decisions about duplicate handling, omitted outcomes, or subepisode boundaries.

Only the ten selected source proposals leave the substantive-review queue. Unselected restored records remain unchanged. The approved catalog remains empty, and human-approved count remains zero.

The review checklist in `verification-batch-01-results.json` records boundary, title, family, character, alias, event, relationship, conflict, resolution, outcome, exact-source-text, and evidence-relevance checks for every selected record. It also documents five full manual inspections spanning different myth families. Subsequent batches should create a new deterministic selection report, review checklist, progress report, and source-audit update without changing the meaning of earlier batch records.

Source-audited means the record’s claims and structured fields were checked against the cited source passages. Source-audited does not mean human scholarly approval. Numeric semantic certainty scores are not used for verified records.

Committed generated outputs include raw-source manifests, derived TEI, passages, candidates, extracted facts, proposed normalized records, source-audited verified records, catalogs, and review reports. They are retained for reproducibility, source traceability, review workflow, catalog browsing, and verified-record evidence checks. They are deterministic and can be regenerated with `npm run corpus:bulk`.

To audit a verified record manually, open the record in `corpus/normalized/bulk/verified/`, then inspect each `sourceText` against the passage IDs in `corpus/passages/`. Check that scope describes omitted passages, that event actors are grammatical or explicitly resolved, that relationship endpoints are registered entities/objects/places, and that narrative fields cite evidence that actually supports the claim.

Run the semantic quality audit with:

```bash
find corpus/normalized/bulk -name '*.myth.json' -print0 |
  xargs -0 jq -s '{
    total_records: length,
    human_approved: ([.[] | select(.reviewStatus == "approved")] | length),
    verified_by_source_audit: ([.[] | select(.reviewStatus == "verified_by_source_audit")] | length),
    awaiting_review: ([.[] | select(.reviewStatus == "awaiting_review")] | length),
    fragment_like_summaries: ([.[] | select(((.narrative.synopsis // "") | test("(and|when|to|of|the)\\\\.$|,\\\\.$"; "i")))] | length)
  }'
```

The current deterministic extraction is still heuristic. It does not use a hosted model, it does not add unsupported facts from memory, and it may leave usable-looking but uncertain candidates in review when source-grounded verification has not been performed.
