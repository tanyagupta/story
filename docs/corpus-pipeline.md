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
npm run test:corpus
```

Derived approved records are not overwritten by stage commands unless `--force` is provided. Commands support explicit input and output paths and do not require network access. `npm run corpus:run` rebuilds the local fixture outputs under `corpus/`.

`npm run corpus:real` rebuilds the committed real-source corpus outputs from local files only. It processes the selected Homeric Hymn witnesses, verifies or records checksums, extracts passages, writes candidates, emits evidence-backed facts, normalizes entities/events, writes review queues, and creates validation reports. It accepts an optional selector:

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

## TEI Support

The extractor handles common TEI structures including `text`, `body`, `div`, `p`, `l`, `lg`, `sp`, `speaker`, `milestone`, `pb`, `xml:id`, and `n`. It preserves source text, order, citations, deterministic passage IDs, and source pointers. Ambiguous or unsupported text-bearing structures are reported as warnings rather than silently discarded.

## Candidates

Candidate episodes group existing passage IDs. Candidate titles are working metadata, not source claims. Boundaries are intentionally human-reviewable; this implementation does not infer all episode boundaries automatically.

## Extraction And Normalization

The default fact extractor is deterministic and offline. It extracts structured facts only when supported by selected passages and requires evidence for every entity and event assertion. It does not add general mythological knowledge, infer motives, write narrative prose, or generate dialogue.

Entity normalization uses `corpus/normalized/entity-registry.json`. Source names are preserved alongside normalized IDs. Roman and Greek identities remain separate; optional reviewed links may connect them. Unknown or ambiguous names enter the review queue.

Action normalization uses `corpus/normalized/action-vocabulary.json`. Source wording is preserved in `sourceAction`, with a separate `action` field for normalized actions. Unknown actions remain unresolved and are queued for review.

## Real Sources

The first real sources are short Homeric Hymns from `PerseusDL/canonical-greekLit` at commit `91595f89e15b4d3000cd93efcf8990720c8be2b9`.

Current witnesses:

```text
Hymn 23 to Zeus
  Greek edition: data/tlg0013/tlg023/tlg0013.tlg023.perseus-grc2.xml
  English translation: data/tlg0013/tlg023/tlg0013.tlg023.perseus-eng2.xml

Hymn 7 to Dionysus
  Greek edition: data/tlg0013/tlg007/tlg0013.tlg007.perseus-grc2.xml
  English translation: data/tlg0013/tlg007/tlg0013.tlg007.perseus-eng2.xml
```

Hymn 7 to Dionysus was selected as the narrative source because it is short, self-contained, and has identifiable characters, objects, transformations, and a complete beginning-to-ending action sequence involving Dionysus, pirates, the helmsman, the ship, divine signs, and the sailors' transformation into dolphins.

The TEI headers identify the 1914 Evelyn-White edition/translation in *Hesiod, the Homeric Hymns and Homerica*. The repository license file is CC-BY-SA-4.0. The manifests also preserve the uncertainty that the selected TEI files do not contain a per-file license statement and that Perseus materials can vary by component.

Greek editions and English translations are separate source records. The English witnesses are used for deterministic semantic fact extraction where appropriate, while the Greek witnesses remain the original-language source for candidate boundaries and parallel evidence. The pipeline does not claim verified line-by-line equivalence beyond the cited passage evidence stored in the generated facts.

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
