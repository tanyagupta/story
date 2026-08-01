# Greek Mythology Corpus Pipeline

This layer extracts and normalizes source-supported myth records.
It does not generate stories, scene plans, storyboards, or videos.

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
npm run test:corpus
```

Derived approved records are not overwritten by stage commands unless `--force` is provided. Commands support explicit input and output paths and do not require network access. `npm run corpus:run` rebuilds the local fixture outputs under `corpus/`.

## TEI Support

The extractor handles common TEI structures including `text`, `body`, `div`, `p`, `l`, `lg`, `sp`, `speaker`, `milestone`, `pb`, `xml:id`, and `n`. It preserves source text, order, citations, deterministic passage IDs, and source pointers. Ambiguous or unsupported text-bearing structures are reported as warnings rather than silently discarded.

## Candidates

Candidate episodes group existing passage IDs. Candidate titles are working metadata, not source claims. Boundaries are intentionally human-reviewable; this implementation does not infer all episode boundaries automatically.

## Extraction And Normalization

The default fact extractor is deterministic and offline. It extracts structured facts only when supported by selected passages and requires evidence for every entity and event assertion. It does not add general mythological knowledge, infer motives, write narrative prose, or generate dialogue.

Entity normalization uses `corpus/normalized/entity-registry.json`. Source names are preserved alongside normalized IDs. Roman and Greek identities remain separate; optional reviewed links may connect them. Unknown or ambiguous names enter the review queue.

Action normalization uses `corpus/normalized/action-vocabulary.json`. Source wording is preserved in `sourceAction`, with a separate `action` field for normalized actions. Unknown actions remain unresolved and are queued for review.

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

## Later Integration

Normalized myth records are designed so a future story generator can consume them. That future generator, and any connection to storyboard or rendering, should be implemented as a separate phase.
