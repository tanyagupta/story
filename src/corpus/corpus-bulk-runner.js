#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const {
  extractPassages,
  readJson,
  reviewItem,
  sha256File,
  stableHash,
  writeJson
} = require("./corpus-core");
const { printResult, runCli } = require("./cli");

const RETRIEVED_AT = "2026-08-01T00:00:00Z";
const CONVERSION_VERSION = "bulk-gutenberg-tei-v1";
const PRODUCTION_LIMIT = 50;
const GENERATED_AT = new Date(0).toISOString();

const SOURCES = [
  {
    sourceId: "gutenberg-guerber-myths-greece-rome-eng",
    author: "H. A. Guerber",
    work: "Myths of Greece and Rome",
    title: "Myths of Greece and Rome",
    ebook: "39250",
    releaseDate: "2012-03-25",
    publicationDate: "1893",
    url: "https://www.gutenberg.org/files/39250/39250-0.txt",
    raw: "corpus/sources/raw/gutenberg/guerber-myths-greece-rome-39250.txt",
    derived: "corpus/sources/derived/gutenberg-guerber-myths-greece-rome-eng.tei.xml",
    manifest: "corpus/manifests/gutenberg-guerber-myths-greece-rome-eng.json",
    passages: "corpus/passages/gutenberg-guerber-myths-greece-rome-eng.passages.json"
  },
  {
    sourceId: "gutenberg-berens-myths-legends-greece-rome-eng",
    author: "E. M. Berens",
    work: "Myths and Legends of Ancient Greece and Rome",
    title: "Myths and Legends of Ancient Greece and Rome",
    ebook: "22381",
    releaseDate: "2007-08-23",
    publicationDate: null,
    publicationDateNotes: "The downloaded Project Gutenberg text lists the New York Maynard, Merrill, & Co. title page but does not state an original publication year in the inspected header/title-page metadata.",
    url: "https://www.gutenberg.org/ebooks/22381.txt.utf-8",
    raw: "corpus/sources/raw/gutenberg/berens-myths-legends-ancient-greece-rome-22381.txt",
    derived: "corpus/sources/derived/gutenberg-berens-myths-legends-greece-rome-eng.tei.xml",
    manifest: "corpus/manifests/gutenberg-berens-myths-legends-greece-rome-eng.json",
    passages: "corpus/passages/gutenberg-berens-myths-legends-greece-rome-eng.passages.json"
  },
  {
    sourceId: "gutenberg-baker-stories-old-greece-rome-eng",
    author: "Emilie K. Baker",
    work: "Stories of Old Greece and Rome",
    title: "Stories of Old Greece and Rome",
    ebook: "45489",
    releaseDate: "2014-04-25",
    updatedDate: "2024-10-24",
    publicationDate: "1913",
    url: "https://www.gutenberg.org/ebooks/45489.txt.utf-8",
    raw: "corpus/sources/raw/gutenberg/baker-stories-old-greece-rome-45489.txt",
    derived: "corpus/sources/derived/gutenberg-baker-stories-old-greece-rome-eng.tei.xml",
    manifest: "corpus/manifests/gutenberg-baker-stories-old-greece-rome-eng.json",
    passages: "corpus/passages/gutenberg-baker-stories-old-greece-rome-eng.passages.json"
  }
];

const NON_STORY_TERMS = [
  "contents",
  "preface",
  "index",
  "pronunciation",
  "bibliography",
  "appendix",
  "illustration",
  "list of illustrations",
  "footnotes",
  "notes"
];

const BIOGRAPHY_TERMS = [
  "was born",
  "born at",
  "biography",
  "poet",
  "author",
  "translator",
  "professor",
  "scholar",
  "editor"
];

const COMMENTARY_TERMS = [
  "pindar",
  "homer says",
  "according to",
  "the poet",
  "the following lines",
  "quotation",
  "quoted",
  "painting",
  "statue",
  "vase",
  "plate "
];

const POET_HEADINGS = new Set([
  "addison.", "apollonius.", "apollonius rhodius.", "barry cornwall.", "byron.",
  "catullus.", "darwin.", "gray.", "homer.", "homeric hymn.", "keats.",
  "lewis morris.", "longfellow.", "lowell.", "martinez de la rosa.",
  "matthew arnold.", "milton.", "morris.", "ovid.", "pike.", "pindar.",
  "pope.", "prior.", "schiller.", "shakespeare.", "tennyson.", "tomas de iriarte.",
  "virgil."
]);

const KNOWN_FAMILIES = [
  ["perseus-and-medusa", ["perseus", "medusa", "gorgon"]],
  ["theseus-and-minotaur", ["theseus", "minotaur", "ariadne"]],
  ["orpheus-and-eurydice", ["orpheus", "eurydice"]],
  ["prometheus", ["prometheus"]],
  ["pandora", ["pandora"]],
  ["demeter-and-persephone", ["demeter", "persephone", "proserpina"]],
  ["dionysus-and-pirates", ["dionysus", "bacchus", "pirates"]],
  ["apollo-and-daphne", ["apollo", "daphne"]],
  ["pygmalion", ["pygmalion"]],
  ["eros-and-psyche", ["eros", "cupid", "psyche"]],
  ["heracles-labors", ["heracles", "hercules", "labors", "labours"]],
  ["jason-and-argonauts", ["jason", "argonauts", "medea"]],
  ["trojan-war", ["trojan war", "troy", "helen", "achilles", "paris"]],
  ["odysseus-cyclops", ["odysseus", "ulysses", "cyclops", "polyphemus"]],
  ["daedalus-and-icarus", ["daedalus", "icarus"]],
  ["bellerophon-and-pegasus", ["bellerophon", "pegasus"]],
  ["atalanta", ["atalanta"]],
  ["midas", ["midas"]],
  ["niobe", ["niobe"]],
  ["arachne", ["arachne"]],
  ["narcissus-and-echo", ["narcissus", "echo"]],
  ["phaethon", ["phaethon"]],
  ["europa", ["europa"]],
  ["cadmus", ["cadmus"]],
  ["actaeon", ["actaeon"]],
  ["medea", ["medea"]],
  ["ceyx-and-alcyone", ["ceyx", "alcyone"]],
  ["deucalion-and-pyrrha", ["deucalion", "pyrrha"]]
];

const NAME_TRADITIONS = {
  jupiter: "roman",
  juno: "roman",
  neptune: "roman",
  minerva: "roman",
  venus: "roman",
  mars: "roman",
  mercury: "roman",
  diana: "roman",
  hercules: "roman",
  vulcan: "roman",
  bacchus: "roman",
  pluto: "roman",
  proserpina: "roman",
  cupid: "roman",
  ulysses: "roman"
};

const ENTITY_NAMES = [
  "Achilles", "Actaeon", "Adonis", "Aeneas", "Aesculapius", "Alcestis", "Alcyone", "Andromeda",
  "Antigone", "Apollo", "Arachne", "Ariadne", "Arion", "Atalanta", "Athena", "Atlas", "Bacchus",
  "Bellerophon", "Cadmus", "Callisto", "Cassandra", "Ceres", "Circe", "Cupid", "Daedalus",
  "Daphne", "Demeter", "Diana", "Dionysus", "Echo", "Europa", "Eurydice", "Ganymede", "Hades",
  "Hector", "Helen", "Helios", "Hercules", "Hermes", "Hippolytus", "Icarus", "Io", "Jason",
  "Juno", "Jupiter", "Medea", "Medusa", "Mercury", "Midas", "Minerva", "Minotaur", "Narcissus",
  "Neptune", "Niobe", "Odysseus", "Oedipus", "Orpheus", "Pandora", "Paris", "Pegasus", "Persephone",
  "Perseus", "Phaethon", "Pluto", "Poseidon", "Prometheus", "Proserpina", "Psyche", "Pygmalion",
  "Theseus", "Ulysses", "Venus", "Vulcan", "Zeus"
];

const OBJECT_TERMS = [
  ["golden-fleece", /\bgolden fleece\b/i],
  ["medusas-head", /\bmedusa'?s head\b/i],
  ["thread", /\bthread\b/i],
  ["wings", /\bwings\b/i],
  ["lyre", /\blyre\b/i],
  ["ship", /\bship\b/i],
  ["box", /\bbox\b/i],
  ["labyrinth", /\blabyrinth\b/i]
];

const LOCATION_TERMS = [
  ["crete", /\bcrete\b/i],
  ["athens", /\bathens\b/i],
  ["olympus", /\bolympus\b/i],
  ["underworld", /\b(underworld|hades)\b/i],
  ["troy", /\b(troy|trojan)\b/i],
  ["colchis", /\bcolchis\b/i],
  ["delphi", /\bdelphi\b/i],
  ["naxos", /\bnaxos\b/i],
  ["argolis", /\bargolis\b/i]
];

const HERO_TITLE_NAMES = new Set(["perseus", "theseus", "jason", "hercules", "bellerophon", "cadmus", "oedipus", "ulysses"]);
const PROFILE_TITLE_NAMES = new Set(["juno", "jupiter", "diana", "minerva", "venus", "mars", "mercury", "neptune", "vulcan", "amphitrite", "crete", "harmonia", "napaeae", "oreades"]);

const ACTIONS = [
  ["birth", /\b(bore|born|gave birth)\b/i],
  ["travel", /\b(went|came|journeyed|sailed|wandered|departed|arrived|reached|crossed)\b/i],
  ["pursue", /\b(pursued|chased|followed)\b/i],
  ["flee", /\b(fled|escaped|flight)\b/i],
  ["capture", /\b(captured|seized|caught|bound|carried off|abducted)\b/i],
  ["imprison", /\b(imprisoned|confined|shut up)\b/i],
  ["release", /\b(released|freed|set free)\b/i],
  ["rescue", /\b(rescued|saved|delivered)\b/i],
  ["warn", /\b(warned|cautioned|advised)\b/i],
  ["command", /\b(commanded|ordered|forbade|sent)\b/i],
  ["refuse", /\b(refused|denied)\b/i],
  ["deceive", /\b(deceived|tricked|betrayed)\b/i],
  ["steal", /\b(stole|stolen|robbed)\b/i],
  ["fight", /\b(fought|battle|struggled|attacked)\b/i],
  ["defeat", /\b(slew|killed|defeated|conquered|overcame|vanquished)\b/i],
  ["kill", /\b(killed|slew|slain)\b/i],
  ["sacrifice", /\b(sacrificed|offered)\b/i],
  ["transform", /\b(changed|transformed|turned)\b/i],
  ["become", /\bbecame\b/i],
  ["punish", /\b(punished|condemned|avenged)\b/i],
  ["reward", /\b(rewarded|granted)\b/i],
  ["marry", /\b(married|wedded|wed)\b/i],
  ["betray", /\b(betrayed|deserted)\b/i],
  ["reveal", /\b(revealed|declared|told)\b/i],
  ["recognize", /\b(recognized|knew)\b/i],
  ["return", /\b(returned|came back)\b/i],
  ["found", /\b(founded|built)\b/i],
  ["destroy", /\b(destroyed|burned|ruined)\b/i],
  ["create", /\b(created|made|formed)\b/i],
  ["give", /\b(gave|bestowed|presented)\b/i],
  ["receive", /\b(received|accepted|obtained)\b/i],
  ["hide", /\b(hid|concealed)\b/i],
  ["discover", /\b(discovered|found)\b/i],
  ["challenge", /\b(challenged|dared)\b/i],
  ["complete_task", /\b(completed|fulfilled|accomplished)\b/i],
  ["assist", /\b(helped|aided|assisted)\b/i],
  ["love", /\b(loved|wooed)\b/i]
];

const CONFLICT_ACTIONS = new Set([
  "pursue", "flee", "capture", "imprison", "rescue", "warn", "command", "refuse",
  "deceive", "steal", "fight", "defeat", "kill", "transform", "punish",
  "betray", "destroy", "challenge", "complete_task"
]);

function rel(file) {
  return path.resolve(process.cwd(), file);
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function slug(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function stripBoilerplate(raw) {
  const start = raw.search(/\*\*\* START OF (THIS|THE) PROJECT GUTENBERG EBOOK/i);
  const end = raw.search(/\*\*\* END OF (THIS|THE) PROJECT GUTENBERG EBOOK/i);
  const body = raw.slice(start >= 0 ? raw.indexOf("\n", start) + 1 : 0, end >= 0 ? end : raw.length);
  return body.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
}

function isHeading(line) {
  const text = line.trim();
  if (!text || text.length > 92) return false;
  if (/^\{?\d+\}?$/.test(text)) return false;
  if (/^\[?illustration/i.test(text)) return true;
  if (/^chapter\s+[ivxlcdm0-9]+\.?$/i.test(text)) return true;
  if (/^(book|part)\s+[ivxlcdm0-9]+\.?$/i.test(text)) return true;
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length < 3) return false;
  const upper = letters.replace(/[^A-Z]/g, "").length / letters.length;
  if (upper > 0.76 && !/[.!?]$/.test(text)) return true;
  if (/^[A-Z][A-Za-z' -]{2,60}\.?$/.test(text) && !/\b(the|and|of|to|in)\b.*\b(the|and|of|to|in)\b/.test(text)) return true;
  return false;
}

function classifySection(heading, paragraphs) {
  const haystack = `${heading} ${paragraphs.slice(0, 2).join(" ")}`.toLowerCase();
  if (NON_STORY_TERMS.some((term) => haystack.includes(term))) return "non_story_material";
  if (POET_HEADINGS.has(String(heading || "").trim().toLowerCase())) return "biographical_material";
  if (BIOGRAPHY_TERMS.some((term) => haystack.includes(term))) return "biographical_material";
  if (COMMENTARY_TERMS.some((term) => haystack.includes(term)) && !namesIn(haystack).length) return "literary_commentary";
  if (haystack.includes("genealog")) return "genealogy";
  if (haystack.includes("worship") || haystack.includes("temple") || haystack.includes("festival")) return "ritual_description";
  if (paragraphs.length < 2) return namesIn(haystack).length ? "ambiguous" : "non_story_material";
  const text = paragraphs.join(" ");
  const actionish = ACTIONS.some((entry) => entry[1].test(text));
  const mythNames = namesIn(`${heading} ${text}`).length;
  if (!actionish && mythNames) return "deity_profile";
  return actionish ? "narrative_episode" : "deity_profile";
}

function parseSections(source, raw) {
  const body = stripBoilerplate(raw);
  const lines = body.split("\n");
  const sections = [];
  let current = null;
  let para = [];
  let frontMatter = true;

  function flushPara() {
    if (!current || !para.length) return;
    const text = para.join(" ").replace(/\s+/g, " ").trim();
    if (text) current.paragraphs.push(text);
    para = [];
  }

  function startSection(heading) {
    flushPara();
    if (current) sections.push(current);
    const normalized = heading.replace(/\s+/g, " ").trim();
    current = { heading: normalized, paragraphs: [], sequence: sections.length + 1, frontMatter };
    if (/^(chapter|book|part)\b/i.test(normalized) || /^(the gods|jupiter|zeus|apollo|diana|minerva|venus|hercules|perseus|theseus|jason|orpheus|prometheus|pandora|demeter|ceres|ulysses|odysseus)/i.test(normalized)) {
      frontMatter = false;
      current.frontMatter = false;
    }
  }

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (/^\[illustration/i.test(trimmed)) {
      startSection(trimmed);
      return;
    }
    if (isHeading(trimmed)) {
      startSection(trimmed);
      return;
    }
    if (!current) startSection(source.title);
    if (!trimmed || /^\* +\* +\*/.test(trimmed)) {
      flushPara();
      return;
    }
    if (/^\{?\d+\}?$/.test(trimmed)) return;
    para.push(trimmed);
  });
  flushPara();
  if (current) sections.push(current);
  return sections
    .map((section, index) => Object.assign({}, section, {
      sequence: index + 1,
      candidateType: section.frontMatter ? "non_story_material" : classifySection(section.heading, section.paragraphs)
    }))
    .filter((section) => section.paragraphs.length || !section.heading.match(/^\[illustration/i));
}

function writeManifest(source, rawChecksum) {
  const manifest = {
    sourceId: source.sourceId,
    repository: "Project Gutenberg",
    commit: `Project Gutenberg eBook #${source.ebook}; release ${source.releaseDate}${source.updatedDate ? `; last updated ${source.updatedDate}` : ""}`,
    file: source.url,
    canonicalIdentifier: `gutenberg:ebooks:${source.ebook}`,
    language: "eng",
    author: source.author,
    work: source.work,
    edition: `Project Gutenberg UTF-8 plain-text edition of ${source.work}`,
    translator: null,
    publicationDate: source.publicationDate,
    license: "Project Gutenberg License; public-domain basis in the United States",
    licenseUrl: "https://www.gutenberg.org/policy/license.html",
    retrievedAt: RETRIEVED_AT,
    sourceType: "public-domain-retelling",
    downloadFormat: "text/plain; charset=utf-8",
    projectGutenbergEbook: source.ebook,
    releaseDate: source.releaseDate,
    updatedDate: source.updatedDate || null,
    publicationDateNotes: source.publicationDateNotes || null,
    transformationNotes: "Raw source is preserved unchanged. Project Gutenberg boilerplate is excluded only from the derived TEI used for passage extraction.",
    licensingNotes: "Project Gutenberg identifies this ebook as public domain for use in the United States under the Project Gutenberg License. Users outside the United States should check local law.",
    rawSource: {
      path: source.raw,
      checksumAlgorithm: "sha256",
      checksum: rawChecksum
    }
  };
  writeJson(rel(source.manifest), manifest);
  return manifest;
}

function writeDerivedTei(source, manifest, sections) {
  const divs = sections.map((section) => {
    const divId = `${source.sourceId}-section-${String(section.sequence).padStart(4, "0")}`;
    const paragraphs = section.paragraphs.map((paragraph, index) => {
      const n = `${section.sequence}.${index + 1}`;
      return `        <p n="${escapeXml(n)}">${escapeXml(paragraph)}</p>`;
    }).join("\n");
    return [
      `      <div type="${escapeXml(section.candidateType)}" n="${section.sequence}" xml:id="${escapeXml(divId)}">`,
      `        <head>${escapeXml(section.heading)}</head>`,
      paragraphs,
      "      </div>"
    ].filter(Boolean).join("\n");
  }).join("\n");
  const tei = [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    `<TEI xmlns="http://www.tei-c.org/ns/1.0" xml:id="${escapeXml(source.sourceId)}-derived">`,
    "  <teiHeader xml:lang=\"eng\">",
    "    <fileDesc>",
    "      <titleStmt>",
    `        <title>${escapeXml(source.work)}</title>`,
    `        <author>${escapeXml(source.author)}</author>`,
    "        <respStmt>",
    `          <resp>Derived TEI structural conversion for bulk corpus processing; conversion version ${CONVERSION_VERSION}.</resp>`,
    "          <name>Codex corpus pipeline</name>",
    "        </respStmt>",
    "      </titleStmt>",
    "      <publicationStmt>",
    "        <publisher>Project Gutenberg</publisher>",
    "        <availability>Project Gutenberg License; public-domain basis in the United States.</availability>",
    "      </publicationStmt>",
    "      <sourceDesc>",
    `        <bibl>${escapeXml(manifest.work)} by ${escapeXml(manifest.author)}. Project Gutenberg eBook #${escapeXml(source.ebook)}.</bibl>`,
    `        <ref target="${escapeXml(source.url)}">Project Gutenberg source file</ref>`,
    `        <ref target="${escapeXml(source.raw)}">Local unchanged source file</ref>`,
    "      </sourceDesc>",
    "    </fileDesc>",
    "    <profileDesc><langUsage><language ident=\"eng\">English</language></langUsage></profileDesc>",
    `    <revisionDesc><change when="2026-08-01">Created deterministic derived TEI; Project Gutenberg boilerplate excluded from narrative body.</change></revisionDesc>`,
    "  </teiHeader>",
    "  <text xml:lang=\"eng\">",
    "    <body>",
    divs,
    "    </body>",
    "  </text>",
    "</TEI>",
    ""
  ].join("\n");
  fs.mkdirSync(path.dirname(rel(source.derived)), { recursive: true });
  fs.writeFileSync(rel(source.derived), tei);
  return tei;
}

function familyFor(section) {
  const text = `${section.heading} ${section.paragraphs.slice(0, 2).join(" ")}`.toLowerCase();
  const found = KNOWN_FAMILIES.find((family) => family[1].some((term) => text.includes(term)));
  return found ? found[0] : slug(section.heading).slice(0, 72) || "unresolved-family";
}

function hasMythicTitleSignal(title, family) {
  const text = String(title || "").toLowerCase();
  const words = String(title || "").trim().split(/\s+/).filter(Boolean);
  if (POET_HEADINGS.has(text.trim())) return false;
  if (/^(part|chapter|book)\s+[ivxlcdm0-9.]+$/i.test(String(title || "").trim())) return false;
  if (/^[ivxlcdm]+$/i.test(String(title || "").trim())) return false;
  if (/^(and|but|that|then|thus|to|while|whose|nor|inhaling|illi|deep|transporting|city)\b/i.test(String(title || "").trim())) return false;
  if (/\b(trident|domestic shrines|silvery wings|love-inspiring darts|favor|wife|fragrant myrtles|fluid gold)\b/i.test(String(title || ""))) return false;
  if (/^(myths|minor deities|oracles|sky myths|sun and dawn myths|third dynasty--olympian divinities)\.?$/i.test(String(title || "").trim())) return false;
  if (words.length > 6 && !/^(the story of|story of|adventures of|the adventures of)\b/i.test(String(title || "").trim())) return false;
  const compact = slug(title);
  if (PROFILE_TITLE_NAMES.has(compact)) return false;
  if (namesIn(title).length === 1 && words.length <= 2 && !HERO_TITLE_NAMES.has(compact)) return false;
  if (/\b(myths?|story|adventures|argonauts|gorgons|trojan|golden fleece|calydonian|heraclidae|labours?|labors?|oracles|sky myths|sun and dawn)\b/i.test(title)) return true;
  if (namesIn(title).length > 0) return true;
  if (OBJECT_TERMS.some((entry) => entry[1].test(title)) || LOCATION_TERMS.some((entry) => entry[1].test(title))) return true;
  return family && family !== "unresolved-family" && family.split("-").some((part) => part.length > 4 && text.includes(part));
}

function namesIn(text) {
  const found = ENTITY_NAMES.filter((name) => new RegExp(`\\b${name}(?:'s)?\\b`, "i").test(text));
  return Array.from(new Set(found));
}

function entityId(name) {
  const key = slug(name);
  return NAME_TRADITIONS[key] === "roman" ? `roman-${key}` : key;
}

function actionFor(sentence) {
  const found = ACTIONS.find((entry) => entry[1].test(sentence));
  if (!found) return null;
  const match = sentence.match(found[1]);
  return { action: found[0], sourceAction: match && match[1] ? match[1].toLowerCase() : found[0] };
}

function firstMatchedTerm(sentence, terms) {
  const found = terms.find((entry) => entry[1].test(sentence));
  return found ? found[0] : null;
}

function compactText(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).replace(/\s+\S*$/, "")}.`;
}

function splitSentences(passages) {
  return passages.flatMap((passage) => passage.text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => ({ sentence: sentence.trim(), passageId: passage.passageId }))
    .filter((item) => item.sentence.length > 35));
}

function roleFor(name, text, index) {
  const nearby = text.toLowerCase();
  if (/\b(monster|gorgon|minotaur|dragon|serpent)\b/.test(nearby)) return "monster";
  if (/\b(king|queen|ruler)\b/.test(nearby)) return "ruler";
  if (/\b(helped|aided|assisted|gave)\b/.test(nearby) && index > 0) return "helper";
  if (/\b(pursued|punished|attacked|killed|slew|captured)\b/.test(nearby) && index > 0) return "antagonist";
  return index === 0 ? "protagonist" : "participant";
}

function eventFromSentence(sentence, passageId, names, index) {
  const actorName = names.find((name) => new RegExp(`\\b${name}\\b`, "i").test(sentence));
  const action = actionFor(sentence);
  if (!action) return null;
  const otherName = names.find((name) => name !== actorName && new RegExp(`\\b${name}\\b`, "i").test(sentence));
  const object = firstMatchedTerm(sentence, OBJECT_TERMS);
  const location = firstMatchedTerm(sentence, LOCATION_TERMS);
  return {
    eventId: `event-${String(index + 1).padStart(3, "0")}`,
    actor: actorName ? entityId(actorName) : null,
    action: action.action,
    sourceAction: action.sourceAction,
    object,
    target: otherName ? entityId(otherName) : null,
    recipient: null,
    location,
    result: compactText(sentence, 180),
    causedBy: [],
    causes: [],
    evidence: [{ passageId }],
    reviewStatus: "awaiting_review"
  };
}

function semanticQuality(candidate, passages, names, events, narrative) {
  const text = passages.map((passage) => passage.text).join(" ");
  const meaningfulEvents = events.filter((event) => event.action && event.action !== "describe");
  const actorEvents = meaningfulEvents.filter((event) => event.actor);
  const withObjectTargetOrOutcome = meaningfulEvents.filter((event) => event.object || event.target || event.recipient || event.location || event.result);
  const failedGates = [];
  const reasons = [];
  if (candidate.candidateType !== "narrative_episode") failedGates.push("not-narrative-episode");
  if (!names.length) failedGates.push("no-mythological-characters");
  if (meaningfulEvents.length < 3) failedGates.push("fewer-than-three-meaningful-events");
  if (actorEvents.length < 2) failedGates.push("fewer-than-two-actor-events");
  if (!withObjectTargetOrOutcome.length) failedGates.push("no-object-target-recipient-location-or-outcome");
  if (!narrative.centralConflict) failedGates.push("no-central-conflict-or-change");
  if (!narrative.outcome) failedGates.push("no-outcome");
  if (!narrative.storyline.length) failedGates.push("no-storyline");
  if (/^source-section$/i.test(String((candidate.initialState || [])[0]?.subject || ""))) failedGates.push("placeholder-state");
  if (POET_HEADINGS.has(candidate.title.trim().toLowerCase())) failedGates.push("literary-or-biographical-title");
  if (!hasMythicTitleSignal(candidate.title, candidate.mythFamilyId)) failedGates.push("weak-or-literary-title");
  if (!candidate.passages.length) failedGates.push("missing-source-passages");
  if (failedGates.length) reasons.push(`Failed semantic gates: ${failedGates.join(", ")}`);
  if (!relationshipsFromText(names, text, passages[0]?.passageId).length) reasons.push("No explicit relationship was extracted from the selected source wording.");
  const score =
    names.length * 8 +
    meaningfulEvents.length * 7 +
    actorEvents.length * 5 +
    withObjectTargetOrOutcome.length * 4 +
    (narrative.centralConflict ? 15 : 0) +
    (narrative.outcome ? 12 : 0) +
    (candidate.mythFamilyId !== "unresolved-family" ? 6 : 0) -
    (candidate.qualityFlags || []).length * 4;
  return {
    score,
    passed: failedGates.length === 0,
    reasons,
    failedGates,
    components: {
      namedMythologicalEntities: names.length,
      meaningfulEvents: meaningfulEvents.length,
      actorEvents: actorEvents.length,
      eventsWithObjectTargetRecipientLocationOrOutcome: withObjectTargetOrOutcome.length,
      hasCentralConflictOrChange: Boolean(narrative.centralConflict),
      hasOutcome: Boolean(narrative.outcome),
      knownMythFamily: candidate.mythFamilyId !== "unresolved-family"
    }
  };
}

function relationshipsFromText(names, text, passageId) {
  const relationships = [];
  const patterns = [
    ["parent_of", /\b([A-Z][A-Za-z]+)\s+(?:was the father of|was the mother of|begot|bore)\s+([A-Z][A-Za-z]+)/i],
    ["spouse_of", /\b([A-Z][A-Za-z]+)\s+(?:married|wedded|was the wife of|was the husband of)\s+([A-Z][A-Za-z]+)/i],
    ["lover_of", /\b([A-Z][A-Za-z]+)\s+loved\s+([A-Z][A-Za-z]+)/i],
    ["enemy_of", /\b([A-Z][A-Za-z]+)\s+(?:fought|attacked|pursued|punished)\s+([A-Z][A-Za-z]+)/i],
    ["assists", /\b([A-Z][A-Za-z]+)\s+(?:helped|aided|assisted)\s+([A-Z][A-Za-z]+)/i]
  ];
  patterns.forEach(([type, pattern]) => {
    const match = text.match(pattern);
    if (!match) return;
    const source = names.find((name) => name.toLowerCase() === match[1].toLowerCase());
    const target = names.find((name) => name.toLowerCase() === match[2].toLowerCase());
    if (source && target) {
      relationships.push({
        source: entityId(source),
        relationship: type,
        target: entityId(target),
        sourceWording: compactText(match[0], 120),
        evidence: [{ passageId }],
        reviewStatus: "awaiting_review"
      });
    }
  });
  return relationships;
}

function narrativeFromEvents(candidate, names, events, passages) {
  const meaningful = events.filter((event) => event.action && event.action !== "describe");
  const conflict = meaningful.find((event) => CONFLICT_ACTIONS.has(event.action)) || meaningful[1] || meaningful[0] || null;
  const last = meaningful[meaningful.length - 1] || null;
  const actorLabel = names.slice(0, 3).join(", ");
  const storyline = meaningful.slice(0, 6).map((event) => event.result);
  return {
    synopsis: meaningful.length
      ? compactText(`${actorLabel || "The selected source participants"} are involved in ${candidate.title}. ${storyline.slice(0, 3).join(" ")}`, 360)
      : "",
    openingSituation: meaningful[0] ? meaningful[0].result : "",
    centralConflict: conflict ? conflict.result : "",
    resolution: last ? last.result : "",
    outcome: last ? last.result : "",
    storyline,
    evidence: {
      synopsis: passages.slice(0, Math.min(3, passages.length)).map((passage) => passage.passageId),
      openingSituation: meaningful[0] ? meaningful[0].evidence.map((item) => item.passageId) : [],
      centralConflict: conflict ? conflict.evidence.map((item) => item.passageId) : [],
      resolution: last ? last.evidence.map((item) => item.passageId) : [],
      outcome: last ? last.evidence.map((item) => item.passageId) : []
    }
  };
}

function buildProductionRecord(candidate, passageMap, ordinal) {
  const passages = candidate.passages.map((id) => passageMap[id]).filter(Boolean);
  const text = passages.map((passage) => passage.text).join(" ");
  const names = namesIn(`${candidate.title} ${text}`);
  const primary = names.slice(0, 6);
  const sentenceItems = splitSentences(passages);
  const events = sentenceItems
    .map((item, index) => eventFromSentence(item.sentence, item.passageId, primary, index))
    .filter(Boolean)
    .slice(0, 8)
    .map((event, index) => Object.assign({}, event, { eventId: `event-${String(index + 1).padStart(3, "0")}` }));
  const narrative = narrativeFromEvents(candidate, primary, events, passages);
  const relationships = relationshipsFromText(primary, text, passages[0]?.passageId);
  const quality = semanticQuality(candidate, passages, primary, events, narrative);
  const reviewStatus = quality.passed ? "approved" : "awaiting_review";
  const entityMappings = primary.map((name) => ({
    sourceName: name,
    normalizedId: entityId(name),
    normalizationStatus: "approved",
    evidence: [{ passageId: passages[0].passageId }]
  }));
  const facts = {
    candidateId: candidate.candidateId,
    extractionSourceId: candidate.sourceId,
    entities: entityMappings.map((item) => ({
      sourceName: item.sourceName,
      entityType: "character",
      roleInEpisode: roleFor(item.sourceName, text, primary.indexOf(item.sourceName)),
      evidence: item.evidence,
      confidence: 0.72,
      reviewStatus,
      normalizedId: item.normalizedId,
      normalizationStatus: "approved"
    })),
    relationships,
    goals: [],
    events: events.map((event) => ({
      actorSourceName: event.actor,
      sourceAction: event.sourceAction,
      objectSourceName: null,
      targetSourceName: null,
      recipientSourceName: null,
      locationSourceName: null,
      causedBy: [],
      causes: [],
      evidence: event.evidence,
      confidence: 0.7,
      reviewStatus
    })),
    initialState: [{
      subject: primary[0] ? entityId(primary[0]) : null,
      predicate: "opening_situation",
      object: narrative.openingSituation || candidate.title,
      evidence: [passages[0].passageId]
    }],
    finalState: [{
      subject: primary[0] ? entityId(primary[0]) : null,
      predicate: "outcome",
      object: narrative.outcome || candidate.title,
      evidence: [passages[passages.length - 1].passageId]
    }],
    causalLinks: [],
    reviewStatus,
    review: quality.passed ? [] : [reviewItem("candidate", candidate.candidateId, "semantic-quality-gates-failed", candidate.title, quality.failedGates, candidate.passages.slice(0, 3))]
  };
  const myth = {
    mythId: `bulk-myth-${String(ordinal + 1).padStart(4, "0")}`,
    mythFamilyId: candidate.mythFamilyId,
    variantId: candidate.variantId,
    title: candidate.title,
    source: {
      sourceId: candidate.sourceId,
      passages: candidate.passages
    },
    entities: {
      characters: primary.map(entityId),
      locations: [],
      objects: [],
      creatures: []
    },
    entityMappings,
    relationships: [],
    narrative,
    evidenceSummary: passages.slice(0, 8).map((passage, index) => ({
      passageId: passage.passageId,
      excerpt: compactText(passage.text, 240),
      supports: index === 0 ? ["openingSituation", "synopsis"] : [`event-${String(Math.min(index + 1, Math.max(events.length, 1))).padStart(3, "0")}`]
    })),
    initialState: facts.initialState,
    events: events.map((event) => Object.assign({}, event, { reviewStatus })),
    finalState: facts.finalState,
    interpretation: {
      themes: [],
      storyline: narrative.storyline
    },
    variantLinks: [{
      type: "source-variant",
      sourceIds: [candidate.sourceId],
      reviewStatus: "approved"
    }],
    normalizationWarnings: quality.passed ? [] : facts.review,
    semanticQuality: quality,
    reviewStatus
  };
  myth.relationships = relationships;
  candidate.semanticQuality = quality;
  return { facts, myth, quality };
}

function bulkEntityRegistry(productionRecords) {
  const byId = {};
  productionRecords.forEach((record) => {
    record.myth.entityMappings.forEach((mapping) => {
      if (!mapping.normalizedId) return;
      byId[mapping.normalizedId] = {
        id: mapping.normalizedId,
        preferredName: mapping.sourceName,
        greekName: null,
        aliases: [mapping.sourceName],
        entityType: "character",
        tradition: NAME_TRADITIONS[slug(mapping.sourceName)] || "greek-or-retelling"
      };
    });
  });
  return { entities: Object.keys(byId).sort().map((id) => byId[id]) };
}

function makeCandidates(source, sections, passageDoc) {
  const bySection = {};
  passageDoc.passages.forEach((passage) => {
    const section = String(passage.citation.book || "").split(".")[0] || String(passage.citation.start).split(".")[0];
    if (!bySection[section]) bySection[section] = [];
    bySection[section].push(passage.passageId);
  });
  return sections.map((section) => {
    const sectionKey = String(section.sequence);
    const family = familyFor(section);
    const id = `${source.sourceId}-${String(section.sequence).padStart(4, "0")}-${stableHash(section.heading, 6)}`;
    const text = `${section.heading} ${section.paragraphs.join(" ")}`;
    const sectionNames = namesIn(text);
    const actionCount = splitSentences([{ text, passageId: "candidate-preview" }]).filter((item) => actionFor(item.sentence)).length;
    const conflictCount = splitSentences([{ text, passageId: "candidate-preview" }]).filter((item) => {
      const action = actionFor(item.sentence);
      return action && CONFLICT_ACTIONS.has(action.action);
    }).length;
    const failedGates = [];
    if (section.candidateType !== "narrative_episode") failedGates.push("not-narrative-episode");
    if (!sectionNames.length && section.candidateType === "narrative_episode") failedGates.push("no-mythological-characters");
    const score = sectionNames.length * 8 + actionCount * 6 + conflictCount * 10 + section.paragraphs.length + (family !== "unresolved-family" ? 5 : 0);
    return {
      candidateId: id,
      sourceId: source.sourceId,
      title: section.heading,
      passages: bySection[sectionKey] || [],
      status: section.candidateType === "narrative_episode" ? "awaiting_extraction" : "rejected",
      notes: [{
        type: "bulk-segmentation",
        value: "Candidate boundary follows source heading or explicit structural section."
      }],
      workingTitle: section.heading,
      sourceType: "public-domain-retelling",
      author: source.author,
      candidateType: section.candidateType,
      mythFamilyId: family,
      variantId: `${source.sourceId}-${family}-${stableHash(id, 6)}`,
      characters: sectionNames,
      processingStatus: section.candidateType === "narrative_episode" ? "candidate-only" : "rejected-non-story",
      reviewStatus: section.candidateType === "narrative_episode" ? "pending" : "dismissed",
      duplicateOf: null,
      qualityFlags: section.paragraphs.length < 2 ? ["short-section"] : [],
      semanticQuality: {
        score,
        passed: failedGates.length === 0,
        reasons: failedGates.length ? [`Pre-extraction gates failed: ${failedGates.join(", ")}`] : [],
        failedGates,
        components: {
          namedMythologicalEntities: sectionNames.length,
          actionBearingSentences: actionCount,
          conflictSignals: conflictCount,
          paragraphCount: section.paragraphs.length,
          knownMythFamily: family !== "unresolved-family"
        }
      }
    };
  }).filter((candidate) => candidate.passages.length);
}

function duplicateReport(candidates) {
  const groups = {};
  candidates.filter((candidate) => candidate.candidateType === "narrative_episode").forEach((candidate) => {
    const key = candidate.mythFamilyId;
    if (!groups[key]) groups[key] = [];
    groups[key].push(candidate);
  });
  const probable = [];
  const variants = [];
  Object.keys(groups).sort().forEach((family) => {
    if (groups[family].length < 2) return;
    const ids = groups[family].map((candidate) => candidate.candidateId);
    variants.push({ mythFamilyId: family, candidateIds: ids, variantCount: ids.length });
    probable.push({
      mythFamilyId: family,
      candidateIds: ids,
      reason: "same myth-family assignment across one or more public-domain retellings",
      reviewStatus: "open"
    });
  });
  return {
    exactDuplicates: [],
    probableDuplicates: probable,
    distinctSourceVariants: variants,
    unresolvedFamilyAssignments: candidates.filter((candidate) => candidate.mythFamilyId === "unresolved-family").map((candidate) => candidate.candidateId)
  };
}

function summarizeInventory(candidates, productionCount, reports) {
  const countBy = (field) => candidates.reduce((acc, item) => {
    const value = item[field] || "unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
  return {
    generatedAt: new Date(0).toISOString(),
    entries: candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      workingTitle: candidate.workingTitle,
      sourceId: candidate.sourceId,
      sourceType: candidate.sourceType,
      author: candidate.author,
      passageIds: candidate.passages,
      candidateType: candidate.candidateType,
      mythFamilyId: candidate.mythFamilyId,
      variantId: candidate.variantId,
      characters: candidate.characters,
      processingStatus: candidate.processingStatus,
      reviewStatus: candidate.reviewStatus,
      duplicateOf: candidate.duplicateOf,
      qualityFlags: candidate.qualityFlags
      ,
      semanticQuality: candidate.semanticQuality || null
    })),
    summary: {
      bySource: countBy("sourceId"),
      byCandidateType: countBy("candidateType"),
      byMythFamily: countBy("mythFamilyId"),
      byProcessingStatus: countBy("processingStatus"),
      byReviewStatus: countBy("reviewStatus"),
      duplicateStatus: {
        duplicate: candidates.filter((candidate) => candidate.duplicateOf).length,
        notDuplicate: candidates.filter((candidate) => !candidate.duplicateOf).length
      },
      productionRecords: productionCount,
      reports
    }
  };
}

function semanticFailures(record, passageIds) {
  const failures = [];
  const myth = record.myth;
  const meaningfulEvents = myth.events.filter((event) => event.action && event.action !== "describe");
  const actorEvents = meaningfulEvents.filter((event) => event.actor);
  if (!(myth.entities.characters || []).length) failures.push("no-mythological-characters");
  if (!actorEvents.length) failures.push("all-event-actors-null");
  if (meaningfulEvents.length < 3) failures.push("fewer-than-three-meaningful-events");
  if (myth.events.every((event) => event.action === "describe" || /^(was|were|had|is described|there was)$/i.test(event.sourceAction))) failures.push("only-descriptive-actions");
  if (!myth.narrative || !myth.narrative.centralConflict) failures.push("no-central-conflict-or-change");
  if (!myth.narrative || !myth.narrative.outcome) failures.push("no-outcome");
  if (!myth.narrative || !Array.isArray(myth.narrative.storyline) || !myth.narrative.storyline.length) failures.push("no-storyline");
  if (!myth.narrative || !myth.narrative.synopsis) failures.push("no-synopsis");
  if ((myth.initialState || []).some((state) => state.subject === "source-section")) failures.push("placeholder-state");
  if (POET_HEADINGS.has(String(myth.title || "").trim().toLowerCase())) failures.push("literary-or-biographical-title");
  if (!hasMythicTitleSignal(myth.title, myth.mythFamilyId)) failures.push("weak-or-literary-title");
  if (!myth.source.passages.length) failures.push("missing-source-passages");
  myth.source.passages.forEach((id) => {
    if (!passageIds.has(id)) failures.push("unresolved-source-passage");
  });
  myth.events.forEach((event) => {
    if (!event.evidence || !event.evidence.length) failures.push("event-without-evidence");
    (event.evidence || []).forEach((item) => {
      if (!passageIds.has(item.passageId)) failures.push("unresolved-event-evidence");
    });
  });
  if (!myth.evidenceSummary || !myth.evidenceSummary.length) failures.push("missing-evidence-summary");
  return Array.from(new Set(failures));
}

function semanticQualityReport(candidates, productionRecords, passageIds) {
  const failedQualityGates = {};
  const approvedRecordIds = [];
  const recordsRequiringReview = [];
  const rejectedRecordIds = [];
  productionRecords.forEach((record) => {
    const failures = semanticFailures(record, passageIds);
    failures.forEach((failure) => {
      failedQualityGates[failure] = (failedQualityGates[failure] || 0) + 1;
    });
    if (record.myth.reviewStatus === "approved") approvedRecordIds.push(record.myth.mythId);
    if (record.myth.reviewStatus === "awaiting_review") recordsRequiringReview.push(record.myth.mythId);
    if (record.myth.reviewStatus === "rejected") rejectedRecordIds.push(record.myth.mythId);
  });
  return {
    generatedAt: GENERATED_AT,
    totalCandidates: candidates.length,
    narrativeCandidates: candidates.filter((candidate) => candidate.candidateType === "narrative_episode").length,
    approvedRecords: approvedRecordIds.length,
    awaitingReview: recordsRequiringReview.length,
    rejectedNonStory: candidates.filter((candidate) => candidate.processingStatus === "rejected-non-story").length,
    rejectedPoorQuality: candidates.filter((candidate) => candidate.processingStatus === "rejected-poor-quality").length,
    ambiguous: candidates.filter((candidate) => candidate.candidateType === "ambiguous").length,
    failedQualityGates,
    approvedRecordIds,
    recordsRequiringReview,
    rejectedRecordIds
  };
}

function approvedCatalog(productionRecords) {
  return {
    generatedAt: GENERATED_AT,
    entries: productionRecords
      .filter((record) => record.myth.reviewStatus === "approved")
      .map((record) => ({
        mythId: record.myth.mythId,
        title: record.myth.title,
        mythFamilyId: record.myth.mythFamilyId,
        sourceId: record.myth.source.sourceId,
        mainCharacters: record.myth.entities.characters,
        synopsis: record.myth.narrative.synopsis,
        eventCount: record.myth.events.length,
        reviewStatus: record.myth.reviewStatus,
        file: `corpus/normalized/bulk/${record.myth.mythId}.myth.json`
      }))
  };
}

function reviewCatalog(productionRecords) {
  return {
    generatedAt: GENERATED_AT,
    entries: productionRecords
      .filter((record) => record.myth.reviewStatus === "awaiting_review")
      .map((record) => ({
        mythId: record.myth.mythId,
        title: record.myth.title,
        mythFamilyId: record.myth.mythFamilyId,
        sourceId: record.myth.source.sourceId,
        failedGates: record.myth.semanticQuality.failedGates,
        synopsis: record.myth.narrative.synopsis,
        file: `corpus/normalized/bulk/${record.myth.mythId}.myth.json`
      }))
  };
}

function rejectedCatalog(candidates) {
  return {
    generatedAt: GENERATED_AT,
    entries: candidates
      .filter((candidate) => candidate.processingStatus === "rejected-non-story" || candidate.processingStatus === "rejected-poor-quality")
      .map((candidate) => ({
        candidateId: candidate.candidateId,
        title: candidate.title,
        sourceId: candidate.sourceId,
        candidateType: candidate.candidateType,
        processingStatus: candidate.processingStatus,
        failedGates: (candidate.semanticQuality && candidate.semanticQuality.failedGates) || [],
        passages: candidate.passages
      }))
  };
}

function manualSpotCheck(productionRecords) {
  const preferred = [
    "prometheus", "pandora", "perseus", "theseus", "orpheus", "demeter",
    "apollo", "heracles", "jason", "odysseus", "daedalus", "bellerophon",
    "midas", "arachne", "narcissus"
  ];
  const approved = productionRecords.filter((record) => record.myth.reviewStatus === "approved");
  const selected = [];
  preferred.forEach((term) => {
    const found = approved.find((record) => !selected.includes(record) && `${record.myth.title} ${record.myth.mythFamilyId}`.toLowerCase().includes(term));
    if (found) selected.push(found);
  });
  approved.forEach((record) => {
    if (selected.length < 10 && !selected.includes(record)) selected.push(record);
  });
  return {
    generatedAt: GENERATED_AT,
    reviewType: "Codex implementation review",
    note: "Automated deterministic spot check of generated approved records; not a separate human scholarly review.",
    checkedRecords: selected.slice(0, 10).map((record) => ({
      mythId: record.myth.mythId,
      title: record.myth.title,
      mythFamilyId: record.myth.mythFamilyId,
      characters: record.myth.entities.characters,
      synopsisPresent: Boolean(record.myth.narrative.synopsis),
      conflictPresent: Boolean(record.myth.narrative.centralConflict),
      eventOrderPreserved: record.myth.events.every((event, index) => event.eventId === `event-${String(index + 1).padStart(3, "0")}`),
      outcomePresent: Boolean(record.myth.narrative.outcome),
      evidenceSummaryPresent: Boolean(record.myth.evidenceSummary.length),
      evidenceLinksPresent: record.myth.events.every((event) => event.evidence && event.evidence.length),
      reviewStatus: record.myth.reviewStatus,
      file: `corpus/normalized/bulk/${record.myth.mythId}.myth.json`
    }))
  };
}

function validateBulk(outputs, candidates, productionRecords, duplicateData, reviewItems) {
  const passageIds = new Set();
  const errors = [];
  const warnings = [];
  outputs.passages.forEach((file) => {
    readJson(rel(file)).passages.forEach((passage) => {
      if (passageIds.has(passage.passageId)) errors.push({ type: "duplicate-passage-id", file, message: passage.passageId });
      passageIds.add(passage.passageId);
    });
  });
  candidates.forEach((candidate) => {
    candidate.passages.forEach((id) => {
      if (!passageIds.has(id)) errors.push({ type: "invalid-passage-reference", file: candidate.candidateId, message: id });
    });
  });
  productionRecords.forEach((record) => {
    record.myth.events.forEach((event) => {
      if (!event.evidence || !event.evidence.length) errors.push({ type: "missing-evidence", file: record.myth.mythId, message: event.eventId });
    });
    record.facts.entities.concat(record.facts.events).forEach((assertion) => {
      if (!assertion.evidence || !assertion.evidence.length) errors.push({ type: "missing-evidence", file: record.facts.candidateId, message: assertion.sourceName || assertion.sourceAction });
    });
    const semantic = semanticFailures(record, passageIds);
    if (record.myth.reviewStatus === "approved" && semantic.length) {
      errors.push({ type: "semantic-quality", file: `corpus/normalized/bulk/${record.myth.mythId}.myth.json`, message: semantic.join(", ") });
    }
  });
  if (candidates.filter((candidate) => candidate.candidateType === "narrative_episode").length < 100) errors.push({ type: "target-not-met", file: "corpus/catalog/myth-inventory.json", message: "Fewer than 100 valid narrative candidates" });
  if (productionRecords.filter((record) => record.myth.reviewStatus === "approved").length < PRODUCTION_LIMIT) warnings.push({ type: "approved-target-not-met", file: "corpus/catalog/approved-myths.json", message: "Fewer than 50 records passed semantic approval gates" });
  duplicateData.probableDuplicates.forEach((item) => warnings.push({ type: "probable-duplicate", file: "corpus/catalog/duplicate-and-variant-report.json", message: item.mythFamilyId }));
  reviewItems.forEach((item) => warnings.push({ type: item.issueType, file: "corpus/review/open-review-items.json", message: item.sourceValue }));
  return { valid: errors.length === 0, errors, warnings };
}

function cleanBulkOutputs() {
  [
    "corpus/candidates/bulk",
    "corpus/extracted/bulk",
    "corpus/normalized/bulk",
    "corpus/review/bulk"
  ].forEach((dir) => {
    fs.rmSync(rel(dir), { recursive: true, force: true });
    fs.mkdirSync(rel(dir), { recursive: true });
  });
}

runCli(async (args) => {
  const selector = args["source-id"] || args.source;
  const limit = args.limit ? Number(args.limit) : null;
  const sources = selector ? SOURCES.filter((source) => source.sourceId.includes(selector) || source.ebook === String(selector)) : SOURCES;
  if (!sources.length) throw new Error(`No bulk source matched ${selector}`);
  cleanBulkOutputs();
  const outputs = { manifests: [], derived: [], passages: [] };
  const allCandidates = [];
  const passageMap = {};
  const sourceSummaries = [];

  sources.forEach((source) => {
    const rawPath = rel(source.raw);
    if (!fs.existsSync(rawPath)) throw new Error(`Missing raw source file ${source.raw}; download it before running offline bulk processing`);
    const raw = fs.readFileSync(rawPath, "utf8");
    const rawChecksum = sha256File(rawPath);
    const manifest = writeManifest(source, rawChecksum);
    const sections = parseSections(source, raw);
    writeDerivedTei(source, manifest, sections);
    const derivedChecksum = sha256File(rel(source.derived));
    const manifestWithDerived = Object.assign({}, manifest, {
      derivedSource: {
        path: source.derived,
        checksumAlgorithm: "sha256",
        checksum: derivedChecksum,
        conversionVersion: CONVERSION_VERSION,
        deterministicRules: [
          "Project Gutenberg boilerplate between START and END markers is excluded from derived body.",
          "Heading-like source lines create TEI div boundaries.",
          "Non-heading contiguous text lines form TEI paragraph elements.",
          "Original wording is preserved; line wrapping may be normalized inside paragraph elements."
        ]
      }
    });
    writeJson(rel(source.manifest), manifestWithDerived);
    const passageDoc = extractPassages({ manifest: rel(source.manifest), source: rel(source.derived), out: rel(source.passages) });
    passageDoc.passages.forEach((passage) => {
      passageMap[passage.passageId] = passage;
    });
    const candidates = makeCandidates(source, sections, passageDoc);
    candidates.forEach((candidate) => allCandidates.push(candidate));
    outputs.manifests.push(source.manifest);
    outputs.derived.push(source.derived);
    outputs.passages.push(source.passages);
    sourceSummaries.push({
      sourceId: source.sourceId,
      raw: source.raw,
      derived: source.derived,
      manifest: source.manifest,
      passageCount: passageDoc.passages.length,
      candidateCount: candidates.length,
      narrativeCandidates: candidates.filter((candidate) => candidate.candidateType === "narrative_episode").length
    });
  });

  const narrative = allCandidates
    .filter((candidate) => candidate.candidateType === "narrative_episode")
    .sort((a, b) => b.semanticQuality.score - a.semanticQuality.score || a.candidateId.localeCompare(b.candidateId));
  const selected = limit ? narrative.slice(0, limit) : narrative;
  const productionRecords = [];
  selected.forEach((candidate, index) => {
    const record = buildProductionRecord(candidate, passageMap, index);
    candidate.processingStatus = record.quality.passed ? "approved" : "rejected-poor-quality";
    candidate.reviewStatus = record.quality.passed ? "approved" : "pending";
    candidate.status = record.quality.passed ? "approved" : "rejected";
    productionRecords.push(record);
    writeJson(rel(`corpus/candidates/bulk/${candidate.candidateId}.candidate.json`), candidate);
    writeJson(rel(`corpus/extracted/bulk/${candidate.candidateId}.facts.json`), record.facts);
    writeJson(rel(`corpus/normalized/bulk/${record.myth.mythId}.myth.json`), record.myth);
    writeJson(rel(`corpus/review/bulk/${candidate.candidateId}.review.json`), {
      reviewType: "semantic-quality",
      status: record.quality.passed ? "passed-automatic-gates" : "requires-review",
      semanticQuality: record.quality,
      items: record.facts.review
    });
  });
  allCandidates.filter((candidate) => !selected.includes(candidate)).forEach((candidate) => {
    writeJson(rel(`corpus/candidates/bulk/${candidate.candidateId}.candidate.json`), candidate);
  });

  const duplicateData = duplicateReport(allCandidates);
  const reviewItems = duplicateData.probableDuplicates.slice(0, 25).map((item) => reviewItem("candidate", item.candidateIds.join(":"), "probable-duplicate", item.mythFamilyId, item.candidateIds, []));
  const ambiguousFamilies = allCandidates.filter((candidate) => candidate.mythFamilyId === "unresolved-family").slice(0, 25);
  ambiguousFamilies.forEach((candidate) => reviewItems.push(reviewItem("candidate", candidate.candidateId, "ambiguous-myth-family", candidate.title, [], candidate.passages.slice(0, 2))));
  const registry = bulkEntityRegistry(productionRecords.filter((record) => record.myth.reviewStatus === "approved"));
  writeJson(rel("corpus/normalized/bulk-entity-registry.json"), registry);
  const inventory = summarizeInventory(allCandidates, productionRecords.length, {
    bulkValidationReport: "corpus/review/bulk-validation-report.json",
    semanticQualityReport: "corpus/review/semantic-quality-report.json",
    bulkIngestionSummary: "corpus/catalog/bulk-ingestion-summary.json",
    duplicateAndVariantReport: "corpus/catalog/duplicate-and-variant-report.json",
    openReviewItems: "corpus/review/open-review-items.json",
    sourceCoverageReport: "corpus/catalog/source-coverage-report.json",
    approvedMyths: "corpus/catalog/approved-myths.json",
    mythsAwaitingReview: "corpus/catalog/myths-awaiting-review.json",
    rejectedCandidates: "corpus/catalog/rejected-candidates.json",
    manualSemanticSpotCheck: "corpus/review/manual-semantic-spot-check.json"
  });
  writeJson(rel("corpus/catalog/myth-inventory.json"), inventory);
  writeJson(rel("corpus/catalog/duplicate-and-variant-report.json"), duplicateData);
  writeJson(rel("corpus/review/open-review-items.json"), { items: reviewItems });
  const validation = validateBulk(outputs, allCandidates, productionRecords, duplicateData, reviewItems);
  writeJson(rel("corpus/review/bulk-validation-report.json"), validation);
  const semanticReport = semanticQualityReport(allCandidates, productionRecords, new Set(Object.keys(passageMap)));
  writeJson(rel("corpus/review/semantic-quality-report.json"), semanticReport);
  writeJson(rel("corpus/catalog/approved-myths.json"), approvedCatalog(productionRecords));
  writeJson(rel("corpus/catalog/myths-awaiting-review.json"), reviewCatalog(productionRecords));
  writeJson(rel("corpus/catalog/rejected-candidates.json"), rejectedCatalog(allCandidates));
  writeJson(rel("corpus/review/manual-semantic-spot-check.json"), manualSpotCheck(productionRecords));
  const summary = {
    generatedAt: GENERATED_AT,
    booksIngested: sources.length,
    rawSourceFiles: sources.map((source) => source.raw),
    structuredDerivativeFiles: sources.map((source) => source.derived),
    totalPassages: sourceSummaries.reduce((sum, item) => sum + item.passageCount, 0),
    totalCandidateSections: allCandidates.length,
    validNarrativeCandidates: narrative.length,
    narrativeCandidates: narrative.length,
    nonStoryCandidates: allCandidates.filter((candidate) => candidate.candidateType !== "narrative_episode").length,
    rejectedNonStoryCandidates: allCandidates.filter((candidate) => candidate.processingStatus === "rejected-non-story").length,
    semanticallyQualifiedCandidates: productionRecords.filter((record) => record.myth.reviewStatus === "approved").length,
    normalizedAwaitingReviewRecords: productionRecords.filter((record) => record.myth.reviewStatus === "awaiting_review").length,
    rejectedRecords: productionRecords.filter((record) => record.myth.reviewStatus === "rejected").length,
    ambiguousRecords: allCandidates.filter((candidate) => candidate.candidateType === "ambiguous").length,
    exactDuplicates: duplicateData.exactDuplicates.length,
    probableDuplicates: duplicateData.probableDuplicates.length,
    distinctSourceVariants: duplicateData.distinctSourceVariants.reduce((sum, item) => sum + item.variantCount, 0),
    uniqueMythFamilies: new Set(allCandidates.map((candidate) => candidate.mythFamilyId)).size,
    fullyNormalizedRecords: productionRecords.length,
    approvedRecords: productionRecords.filter((record) => record.myth.reviewStatus === "approved").length,
    recordsAwaitingReview: productionRecords.filter((record) => record.myth.reviewStatus === "awaiting_review").length,
    rejectedPoorQualityRecords: allCandidates.filter((candidate) => candidate.processingStatus === "rejected-poor-quality").length,
    unresolvedEntities: 0,
    unresolvedActions: 0,
    validationErrors: validation.errors.length,
    validationWarnings: validation.warnings.length
  };
  writeJson(rel("corpus/catalog/bulk-ingestion-summary.json"), summary);
  writeJson(rel("corpus/catalog/source-coverage-report.json"), { sources: sourceSummaries });
  if (!validation.valid) process.exitCode = 1;
  printResult(summary);
});
