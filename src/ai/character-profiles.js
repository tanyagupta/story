const CHARACTER_PROFILES = {
  zeus: {
    name: "Zeus",
    role: "king of the Greek gods",
    appearance: "older stylized Greek god, white hair, full white beard, gold-trimmed white robes",
    personality: "commanding, protective, proud, expressive",
    motion: "broad theatrical gestures, heavy steps, lightning-charged hand poses"
  },
  hermes: {
    name: "Hermes",
    role: "swift messenger of Olympus",
    appearance: "younger stylized messenger, dark hair, short tunic, winged sandals",
    personality: "quick, playful, alert, warm",
    motion: "fast entrances, quick points, nimble turns, energetic head movement"
  },
  temple_guard: {
    name: "Temple Guard",
    role: "guardian of the ancient temple",
    appearance: "stylized guard with bronze helmet, simple cloak, spear, readable silhouette",
    personality: "watchful, cautious, honorable",
    motion: "upright stance, cautious steps, alert reactions"
  }
};

function characterProfile(id) {
  const key = String(id || "").toLowerCase().replace(/[-\s]+/g, "_");
  return CHARACTER_PROFILES[key] || {
    name: id || "Unknown character",
    role: "story character",
    appearance: "stylized animated human character with clear face and readable silhouette",
    personality: "expressive",
    motion: "clear body language and visible articulated movement"
  };
}

module.exports = {
  CHARACTER_PROFILES,
  characterProfile
};
