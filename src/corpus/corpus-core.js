const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { XMLParser } = require("fast-xml-parser");
const Ajv = require("ajv");

const REVIEW_STATUSES = new Set(["open", "resolved", "dismissed"]);
const RECORD_REVIEW_STATUSES = new Set(["draft", "awaiting_review", "approved", "rejected"]);
const CANDIDATE_STATUSES = new Set(["awaiting_extraction", "extracting", "extracted", "approved", "rejected"]);
const ENTITY_BUCKETS = {
  deity: "characters",
  character: "characters",
  mortal: "characters",
  hero: "characters",
  place: "locations",
  location: "locations",
  object: "objects",
  creature: "creatures"
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value, options) {
  const opts = options || {};
  if (opts.noOverwrite && fs.existsSync(file)) {
    throw new Error(`Refusing to overwrite ${file}`);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!opts.dryRun) {
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  }
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function stableHash(value, length) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, length || 10);
}

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(node) {
  if (node === undefined || node === null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).filter(Boolean).join(" ");
  if (typeof node !== "object") return "";
  return Object.keys(node)
    .filter((key) => !key.startsWith("@_") && key !== "#comment")
    .map((key) => textOf(node[key]))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function slug(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-");
}

function attr(node, name) {
  if (!node) return undefined;
  return node[`@_${name}`] || node[`@_xml:${name}`] || (name === "xml:id" ? node["@_id"] : undefined);
}

function loadSchemaValidator(schemaDir) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  fs.readdirSync(schemaDir)
    .filter((file) => file.endsWith(".schema.json"))
    .forEach((file) => {
      const schema = readJson(path.join(schemaDir, file));
      ajv.addSchema(schema, schema.$id || file);
    });
  return ajv;
}

function validateWithSchema(schemaDir, schemaName, record) {
  const ajv = loadSchemaValidator(schemaDir);
  const validate = ajv.getSchema(schemaName) || ajv.getSchema(`${schemaName}.schema.json`);
  if (!validate) throw new Error(`Unknown schema ${schemaName}`);
  const valid = validate(record);
  return {
    valid,
    errors: valid ? [] : validate.errors.map((error) => ({
      path: error.instancePath || "/",
      message: error.message,
      keyword: error.keyword
    }))
  };
}

function validateManifest(manifest) {
  const required = ["sourceId", "repository", "commit", "file", "language", "work", "license", "licenseUrl", "retrievedAt"];
  required.forEach((field) => {
    if (manifest[field] === undefined || manifest[field] === null || manifest[field] === "") {
      throw new Error(`Source manifest is missing required field: ${field}`);
    }
  });
  if (!manifest.license || !manifest.licenseUrl) {
    throw new Error("Source manifest must include explicit license and licenseUrl; licenses are never inferred");
  }
}

function ingestSource(opts) {
  const manifest = readJson(opts.manifest);
  validateManifest(manifest);
  const checksum = sha256File(opts.source);
  const record = Object.assign({}, manifest, {
    rawSource: {
      path: path.relative(process.cwd(), opts.source),
      checksumAlgorithm: "sha256",
      checksum
    }
  });
  if (manifest.rawSource && manifest.rawSource.checksum && manifest.rawSource.checksum !== checksum) {
    throw new Error(`Raw source checksum mismatch for ${manifest.sourceId}: manifest has ${manifest.rawSource.checksum}, file has ${checksum}`);
  }
  writeJson(opts.out || opts.manifest, record, { dryRun: opts.dryRun });
  return record;
}

function parseTei(file) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    trimValues: true,
    parseTagValue: false,
    parseAttributeValue: false,
    removeNSPrefix: true
  });
  return parser.parse(fs.readFileSync(file, "utf8"));
}

function citationFromAncestors(ancestors, node, sequence) {
  const labels = ancestors.concat([node]).map((entry) => attr(entry, "n")).filter(Boolean);
  const xmlIds = ancestors.concat([node]).map((entry) => attr(entry, "xml:id")).filter(Boolean);
  return {
    book: labels.length > 1 ? String(labels[0]) : null,
    start: labels.length ? String(labels[labels.length - 1]) : String(sequence),
    end: labels.length ? String(labels[labels.length - 1]) : String(sequence),
    xmlIds
  };
}

function elementPath(ancestors, tag, index, node) {
  const parts = ancestors.map((entry) => {
    const label = attr(entry, "xml:id") || attr(entry, "n") || entry.__tag || "node";
    return `${entry.__tag || "node"}[${label}]`;
  });
  const own = attr(node, "xml:id") || attr(node, "n") || index;
  parts.push(`${tag}[${own}]`);
  return parts.join("/");
}

function passageId(manifest, citation, sequence, text) {
  const base = manifest.canonicalIdentifier || manifest.sourceId;
  const suffix = citation.book && citation.start ? `${citation.book}.${citation.start}` : `seq.${String(sequence).padStart(4, "0")}`;
  return `${base}:${suffix}-${suffix}:${stableHash(text, 8)}`;
}

function extractPassages(opts) {
  const manifest = readJson(opts.manifest);
  validateManifest(manifest);
  if (manifest.rawSource && manifest.rawSource.checksum) {
    const current = sha256File(opts.source);
    if (current !== manifest.rawSource.checksum) {
      throw new Error(`Raw source checksum changed for ${manifest.sourceId}`);
    }
  }
  const parsed = parseTei(opts.source);
  const warnings = [];
  const passages = [];
  let sequence = 0;
  const textBearing = new Set(["p", "l", "sp"]);
  const containers = new Set(["TEI", "teiHeader", "text", "body", "front", "back", "div", "lg", "sp"]);
  const ignored = new Set(["head", "speaker", "milestone", "pb", "note", "bibl", "titleStmt", "publicationStmt", "sourceDesc", "fileDesc", "encodingDesc", "profileDesc"]);

  function visit(node, tag, ancestors, siblingIndex) {
    if (!node || typeof node !== "object") return;
    if (tag === "milestone" || tag === "pb") {
      warnings.push({ level: "warning", type: "milestone", message: `<${tag}> retained as structural context only`, path: elementPath(ancestors, tag, siblingIndex, node) });
      return;
    }
    const current = Object.assign({ __tag: tag }, node);
    if (textBearing.has(tag)) {
      let text = normalizeText(textOf(node));
      if (tag === "sp" && node.speaker) {
        const speaker = normalizeText(textOf(node.speaker));
        const speech = asArray(node.p).concat(asArray(node.l)).map(textOf).filter(Boolean).join(" ");
        text = normalizeText([speaker ? `${speaker}:` : "", speech || text].join(" "));
      }
      if (text) {
        sequence += 1;
        const citation = citationFromAncestors(ancestors, node, sequence);
        passages.push({
          passageId: passageId(manifest, citation, sequence, text),
          sourceId: manifest.sourceId,
          citation: {
            book: citation.book,
            start: citation.start,
            end: citation.end
          },
          language: manifest.language,
          text,
          sequence,
          sourcePointers: {
            xmlId: attr(node, "xml:id") || null,
            elementPath: elementPath(ancestors, tag, siblingIndex, node)
          }
        });
      }
      return;
    }
    Object.keys(node).forEach((key) => {
      if (key.startsWith("@_") || key === "#text" || key === "#comment") return;
      const children = asArray(node[key]);
      children.forEach((child, index) => {
        if (!containers.has(key) && !textBearing.has(key) && !ignored.has(key) && normalizeText(textOf(child))) {
          warnings.push({ level: "warning", type: "unsupported-text-element", message: `Unsupported text-bearing element <${key}> was inspected`, path: elementPath(ancestors.concat([current]), key, index + 1, child) });
        }
        visit(child, key, ancestors.concat([current]), index + 1);
      });
    });
  }

  const root = parsed.TEI || parsed.teiCorpus || parsed;
  visit(root, parsed.TEI ? "TEI" : "root", [], 1);
  const duplicate = findDuplicate(passages.map((passage) => passage.passageId));
  if (duplicate) throw new Error(`Duplicate passage ID generated: ${duplicate}`);
  const result = { sourceId: manifest.sourceId, generatedAt: new Date(0).toISOString(), passages, warnings };
  if (opts.out) writeJson(opts.out, result, { dryRun: opts.dryRun });
  return result;
}

function findDuplicate(values) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return null;
}

function buildCandidate(opts) {
  const passageDoc = readJson(opts.passages);
  const passageIds = new Set(passageDoc.passages.map((passage) => passage.passageId));
  const selected = opts.selected && opts.selected.length ? opts.selected : passageDoc.passages.map((passage) => passage.passageId);
  selected.forEach((id) => {
    if (!passageIds.has(id)) throw new Error(`Candidate references unknown passage: ${id}`);
  });
  const candidate = {
    candidateId: opts.candidateId || `candidate-${stableHash(selected.join("|"), 6)}`,
    sourceId: opts.sourceId || passageDoc.sourceId,
    title: opts.title || "Working title",
    passages: selected,
    status: opts.status || "awaiting_extraction",
    notes: opts.notes || []
  };
  if (!CANDIDATE_STATUSES.has(candidate.status)) throw new Error(`Invalid candidate status: ${candidate.status}`);
  if (opts.out) writeJson(opts.out, candidate, { dryRun: opts.dryRun, noOverwrite: opts.noOverwrite });
  return candidate;
}

function loadPassageMap(passagesFile) {
  const doc = readJson(passagesFile);
  const map = {};
  doc.passages.forEach((passage) => {
    map[passage.passageId] = passage;
  });
  return map;
}

function extractFacts(opts) {
  const candidate = readJson(opts.candidate);
  const passageMap = loadPassageMap(opts.passages);
  const registry = readJson(opts.registry);
  const vocabulary = readJson(opts.vocabulary);
  const entities = [];
  const events = [];
  const review = [];
  const allAliases = [];
  registry.entities.forEach((entity) => {
    entity.aliases.concat(entity.greekName ? [entity.greekName] : []).forEach((alias) => allAliases.push({ alias, entity }));
  });
  const passageTexts = candidate.passages.map((id) => {
    if (!passageMap[id]) throw new Error(`Candidate references missing passage: ${id}`);
    return passageMap[id];
  });
  passageTexts.forEach((passage) => {
    allAliases.forEach(({ alias, entity }) => {
      if (alias && passage.text.includes(alias) && !entities.some((item) => item.sourceName === alias && item.evidence[0].passageId === passage.passageId)) {
        entities.push({
          sourceName: alias,
          entityType: entity.entityType,
          roleInEpisode: "mentioned",
          evidence: [{ passageId: passage.passageId }],
          confidence: 0.75,
          reviewStatus: "awaiting_review"
        });
      }
    });
    asArray(vocabulary.actions).forEach((action) => {
    action.sourceForms.forEach((form) => {
      if (!passage.text.toLowerCase().includes(form.toLowerCase())) return;
        const presentEntities = allAliases
          .map(({ alias, entity }) => ({ alias, entity, index: alias ? passage.text.indexOf(alias) : -1 }))
          .filter((item) => item.alias && item.index >= 0);
        const actionIndex = passage.text.toLowerCase().indexOf(form.toLowerCase());
        const actorEntity = presentEntities
          .filter((item) => item.entity.entityType !== "object" && item.index <= actionIndex)
          .sort((a, b) => b.index - a.index)[0] || presentEntities.filter((item) => item.entity.entityType !== "object").sort((a, b) => a.index - b.index)[0];
        const object = presentEntities
          .filter((item) => item.entity.entityType === "object" && item.index >= actionIndex)
          .sort((a, b) => a.index - b.index)[0] || presentEntities.find((item) => item.entity.entityType === "object");
        const actor = actorEntity && actorEntity.alias;
        events.push({
          actorSourceName: actor || null,
          sourceAction: form,
          objectSourceName: object ? object.alias : null,
          targetSourceName: null,
          recipientSourceName: null,
          locationSourceName: null,
          causedBy: [],
          causes: [],
          evidence: [{ passageId: passage.passageId }],
          confidence: actor ? 0.7 : 0.45,
          reviewStatus: actor ? "awaiting_review" : "open"
        });
      });
    });
    const unknownMatch = passage.text.match(/\b(Phoibos|Phoebus)\b/);
    if (unknownMatch) {
      entities.push({
        sourceName: unknownMatch[1],
        entityType: "character",
        roleInEpisode: "mentioned",
        evidence: [{ passageId: passage.passageId }],
        confidence: 0.4,
        reviewStatus: "open"
      });
      review.push(reviewItem("entity", `${candidate.candidateId}:entity:${unknownMatch[1]}`, "ambiguous-normalization", unknownMatch[1], ["apollo"], [passage.passageId]));
    }
  });
  const factDoc = {
    candidateId: candidate.candidateId,
    entities,
    relationships: [],
    goals: [],
    events,
    initialState: [],
    finalState: [],
    causalLinks: [],
    reviewStatus: "awaiting_review",
    review
  };
  enforceEvidence(factDoc);
  if (opts.out) writeJson(opts.out, factDoc, { dryRun: opts.dryRun, noOverwrite: opts.noOverwrite });
  return factDoc;
}

function enforceEvidence(facts) {
  facts.entities.forEach((entity) => {
    if (!entity.evidence || !entity.evidence.length) throw new Error(`Entity assertion lacks evidence: ${entity.sourceName}`);
  });
  facts.events.forEach((event) => {
    if (!event.evidence || !event.evidence.length) throw new Error(`Event assertion lacks evidence: ${event.sourceAction}`);
  });
}

function reviewItem(recordType, recordId, issueType, sourceValue, suggestions, evidence) {
  return {
    reviewId: `review-${stableHash([recordType, recordId, issueType, sourceValue].join("|"), 8)}`,
    recordType,
    recordId,
    issueType,
    sourceValue,
    suggestions: suggestions || [],
    evidence: evidence || [],
    status: "open"
  };
}

function buildAliasIndex(registry) {
  const aliasIndex = {};
  const collisions = [];
  registry.entities.forEach((entity) => {
    entity.aliases.concat(entity.greekName ? [entity.greekName] : []).filter(Boolean).forEach((alias) => {
      const key = alias.toLowerCase();
      if (aliasIndex[key] && aliasIndex[key].id !== entity.id) {
        collisions.push({ alias, ids: [aliasIndex[key].id, entity.id] });
      } else {
        aliasIndex[key] = entity;
      }
    });
  });
  return { aliasIndex, collisions };
}

function normalizeEntities(opts) {
  const facts = readJson(opts.facts);
  const registry = readJson(opts.registry);
  const { aliasIndex, collisions } = buildAliasIndex(registry);
  const review = facts.review ? facts.review.slice() : [];
  collisions.forEach((collision) => {
    review.push(reviewItem("entity", collision.ids.join(":"), "conflicting-alias", collision.alias, collision.ids, []));
  });
  const entities = facts.entities.map((entity, index) => {
    const match = aliasIndex[String(entity.sourceName).toLowerCase()];
    if (!match) {
      review.push(reviewItem("entity", `${facts.candidateId}:entity-${index + 1}`, "unresolved-person-name", entity.sourceName, [], entity.evidence.map((item) => item.passageId)));
    }
    return Object.assign({}, entity, {
      normalizedId: match ? match.id : null,
      normalizationStatus: match ? "approved" : "unresolved"
    });
  });
  const result = Object.assign({}, facts, { entities, review });
  if (opts.out) writeJson(opts.out, result, { dryRun: opts.dryRun, noOverwrite: opts.noOverwrite });
  return result;
}

function normalizeEvents(opts) {
  const facts = readJson(opts.facts);
  const registry = readJson(opts.registry);
  const vocabulary = readJson(opts.vocabulary);
  const { aliasIndex } = buildAliasIndex(registry);
  const actionIndex = {};
  vocabulary.actions.forEach((action) => {
    action.sourceForms.forEach((form) => {
      if (actionIndex[form.toLowerCase()] && actionIndex[form.toLowerCase()] !== action.normalizedAction) {
        throw new Error(`Action form collision: ${form}`);
      }
      actionIndex[form.toLowerCase()] = action.normalizedAction;
    });
  });
  const review = facts.review ? facts.review.slice() : [];
  const events = facts.events.map((event, index) => {
    const normalizedAction = actionIndex[String(event.sourceAction).toLowerCase()] || null;
    if (!normalizedAction) {
      review.push(reviewItem("event", `${facts.candidateId}:event-${index + 1}`, "unsupported-action", event.sourceAction, [], event.evidence.map((item) => item.passageId)));
    }
    const normalized = {
      eventId: `event-${String(index + 1).padStart(3, "0")}`,
      actor: normalizeSourceName(event.actorSourceName, aliasIndex),
      action: normalizedAction,
      sourceAction: event.sourceAction,
      object: normalizeSourceName(event.objectSourceName, aliasIndex),
      target: normalizeSourceName(event.targetSourceName, aliasIndex),
      recipient: normalizeSourceName(event.recipientSourceName, aliasIndex),
      location: normalizeSourceName(event.locationSourceName, aliasIndex),
      causedBy: event.causedBy || [],
      causes: event.causes || [],
      evidence: event.evidence,
      reviewStatus: normalizedAction ? event.reviewStatus || "awaiting_review" : "open"
    };
    if (!normalized.evidence || !normalized.evidence.length) throw new Error(`Normalized event lacks evidence: ${normalized.eventId}`);
    return normalized;
  });
  const validIds = new Set(events.map((event) => event.eventId));
  events.forEach((event) => {
    event.causedBy.concat(event.causes).forEach((id) => {
      if (!validIds.has(id)) throw new Error(`Invalid event reference ${id} in ${event.eventId}`);
    });
  });
  const result = Object.assign({}, facts, { events, review });
  if (opts.out) writeJson(opts.out, result, { dryRun: opts.dryRun, noOverwrite: opts.noOverwrite });
  return result;
}

function normalizeSourceName(name, aliasIndex) {
  if (!name) return null;
  const match = aliasIndex[String(name).toLowerCase()];
  return match ? match.id : null;
}

function buildMythRecord(opts) {
  const candidate = readJson(opts.candidate);
  const normalized = readJson(opts.normalizedFacts);
  const registry = readJson(opts.registry);
  const registryById = {};
  registry.entities.forEach((entity) => {
    registryById[entity.id] = entity;
  });
  const buckets = { characters: [], locations: [], objects: [], creatures: [] };
  normalized.entities.forEach((entity) => {
    if (!entity.normalizedId || !registryById[entity.normalizedId]) return;
    const bucket = ENTITY_BUCKETS[registryById[entity.normalizedId].entityType] || "characters";
    if (buckets[bucket].indexOf(entity.normalizedId) < 0) buckets[bucket].push(entity.normalizedId);
  });
  const unresolved = asArray(normalized.review).filter((item) => item.status === "open");
  const myth = {
    mythId: opts.mythId || `myth-${stableHash(candidate.candidateId, 8)}`,
    mythFamilyId: opts.mythFamilyId || slug(candidate.title || candidate.candidateId),
    variantId: opts.variantId || `${candidate.sourceId}-variant`,
    title: opts.title || candidate.title,
    source: {
      sourceId: candidate.sourceId,
      passages: candidate.passages
    },
    entities: buckets,
    initialState: normalized.initialState || [],
    events: normalized.events,
    finalState: normalized.finalState || [],
    interpretation: {
      themes: [],
      storyline: null
    },
    variantLinks: opts.variantLinks || [],
    normalizationWarnings: unresolved,
    reviewStatus: unresolved.length ? "awaiting_review" : "approved"
  };
  myth.events.forEach((event) => {
    if (!event.evidence || !event.evidence.length) throw new Error(`Myth event lacks evidence: ${event.eventId}`);
  });
  if (opts.out) writeJson(opts.out, myth, { dryRun: opts.dryRun, noOverwrite: opts.noOverwrite });
  return myth;
}

function uniqueReviewItems(items) {
  const seen = new Set();
  return asArray(items).filter((item) => {
    const key = item.reviewId || JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function validateCorpus(opts) {
  const schemaDir = opts.schemaDir || path.resolve(process.cwd(), "schemas");
  const report = { valid: true, errors: [], warnings: [] };
  function addError(type, file, message, details) {
    report.valid = false;
    report.errors.push({ type, file, message, details: details || null });
  }
  function validateFile(file, schemaName) {
    try {
      const result = validateWithSchema(schemaDir, schemaName, readJson(file));
      if (!result.valid) addError("schema", file, `Schema validation failed for ${schemaName}`, result.errors);
    } catch (error) {
      addError("malformed-json", file, error.message);
    }
  }
  asArray(opts.manifests).forEach((file) => {
    validateFile(file, "source-manifest.schema.json");
    const manifest = readJson(file);
    if (!manifest.license) addError("missing-license", file, "Missing source license");
    if (!manifest.commit) addError("missing-revision", file, "Missing exact source revision");
    if (manifest.rawSource && manifest.rawSource.path && manifest.rawSource.checksum) {
      const rawPath = path.resolve(process.cwd(), manifest.rawSource.path);
      if (fs.existsSync(rawPath) && sha256File(rawPath) !== manifest.rawSource.checksum) {
        addError("checksum", file, "Raw-source checksum changed");
      }
    }
  });
  const passageIds = new Set();
  asArray(opts.passages).forEach((file) => {
    validateFile(file, "passage.schema.json");
    readJson(file).passages.forEach((passage) => {
      if (passageIds.has(passage.passageId)) addError("duplicate-passage-id", file, `Duplicate passage ID ${passage.passageId}`);
      passageIds.add(passage.passageId);
    });
  });
  asArray(opts.candidates).forEach((file) => {
    validateFile(file, "candidate-episode.schema.json");
    readJson(file).passages.forEach((id) => {
      if (!passageIds.has(id)) addError("invalid-passage-reference", file, `Unknown passage ${id}`);
    });
  });
  const entityIds = new Set();
  asArray(opts.registries).forEach((file) => {
    const registry = readJson(file);
    const aliasMap = {};
    registry.entities.forEach((entity) => {
      if (entityIds.has(entity.id)) addError("duplicate-entity-id", file, `Duplicate entity ID ${entity.id}`);
      entityIds.add(entity.id);
      entity.aliases.concat(entity.greekName ? [entity.greekName] : []).forEach((alias) => {
        const key = alias.toLowerCase();
        if (aliasMap[key] && aliasMap[key] !== entity.id) addError("alias-collision", file, `Alias ${alias} maps to ${aliasMap[key]} and ${entity.id}`);
        aliasMap[key] = entity.id;
      });
    });
  });
  asArray(opts.extracted).forEach((file) => {
    validateFile(file, "extracted-facts.schema.json");
    const facts = readJson(file);
    facts.entities.forEach((entity) => {
      if (!entity.evidence || !entity.evidence.length) addError("missing-evidence", file, `Entity ${entity.sourceName} lacks evidence`);
    });
    facts.events.forEach((event) => {
      if (!event.evidence || !event.evidence.length) addError("missing-evidence", file, `Event ${event.sourceAction} lacks evidence`);
    });
  });
  const mythIds = new Set();
  asArray(opts.myths).forEach((file) => {
    validateFile(file, "normalized-myth.schema.json");
    const myth = readJson(file);
    if (mythIds.has(myth.mythId)) addError("duplicate-myth-id", file, `Duplicate myth ID ${myth.mythId}`);
    mythIds.add(myth.mythId);
    myth.source.passages.forEach((id) => {
      if (!passageIds.has(id)) addError("invalid-passage-reference", file, `Unknown myth passage ${id}`);
    });
    const eventIds = new Set(myth.events.map((event) => event.eventId));
    myth.events.forEach((event) => {
      if (!event.evidence || !event.evidence.length) addError("missing-evidence", file, `Event ${event.eventId} lacks evidence`);
      ["actor", "object", "target", "recipient", "location"].forEach((field) => {
        if (event[field] && !entityIds.has(event[field])) addError("unknown-entity-id", file, `Unknown entity ${event[field]} in ${event.eventId}`);
      });
      event.causedBy.concat(event.causes).forEach((id) => {
        if (!eventIds.has(id)) addError("invalid-event-reference", file, `Unknown event reference ${id}`);
      });
    });
    if (!RECORD_REVIEW_STATUSES.has(myth.reviewStatus)) addError("invalid-review-status", file, `Invalid review status ${myth.reviewStatus}`);
  });
  asArray(opts.review).forEach((file) => {
    const doc = readJson(file);
    asArray(doc.items || doc).forEach((item) => {
      if (!REVIEW_STATUSES.has(item.status)) addError("invalid-review-status", file, `Invalid review status ${item.status}`);
    });
  });
  if (opts.out) writeJson(opts.out, report, { dryRun: opts.dryRun });
  return report;
}

module.exports = {
  readJson,
  writeJson,
  sha256File,
  stableHash,
  ingestSource,
  extractPassages,
  buildCandidate,
  extractFacts,
  normalizeEntities,
  normalizeEvents,
  buildMythRecord,
  validateCorpus,
  validateWithSchema,
  reviewItem,
  uniqueReviewItems
};
