const CANONICAL_ALIASES = {
  pluto: "hades",
  hades: "hades",
  jupiter: "zeus",
  zeus: "zeus",
  juno: "hera",
  hera: "hera",
  minerva: "athena",
  athena: "athena",
  mercury: "hermes",
  hermes: "hermes",
  neptune: "poseidon",
  poseidon: "poseidon",
  ceres: "demeter",
  demeter: "demeter",
  proserpina: "persephone",
  persephone: "persephone",
  hercules: "heracles",
  heracles: "heracles",
  venus: "aphrodite",
  aphrodite: "aphrodite",
  mars: "ares",
  ares: "ares",
  diana: "artemis",
  artemis: "artemis",
  vulcan: "hephaestus",
  hephaestus: "hephaestus",
  "pallas-athene": "athena"
};

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

function canonicalEntityId(name) {
  const key = slug(name);
  return CANONICAL_ALIASES[key] || key;
}

module.exports = {
  CANONICAL_ALIASES,
  canonicalEntityId,
  slug
};
