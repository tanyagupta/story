const { buildPassageAccess } = require("./evidence-validator");

const GENERATED_AT = new Date(0).toISOString();
const BATCH_ID = "reconstruction-batch-02";
const SELECTED_IDS = [
  "bulk-myth-0020",
  "bulk-myth-0014",
  "bulk-myth-0032",
  "bulk-myth-0087",
  "bulk-myth-0085",
  "bulk-myth-0091",
  "bulk-myth-0102",
  "bulk-myth-0105",
  "bulk-myth-0044",
  "bulk-myth-0025"
];

const ALCMAEON_PASSAGES = {
  p1: "gutenberg:ebooks:22381:330.330.1-330.330.1:b8c2236c",
  p2: "gutenberg:ebooks:22381:330.330.2-330.330.2:24a54dd5",
  p3: "gutenberg:ebooks:22381:330.330.3-330.330.3:bcd86bdc",
  p4: "gutenberg:ebooks:22381:330.330.4-330.330.4:d4a43b24",
  p5: "gutenberg:ebooks:22381:330.330.5-330.330.5:32dcfb33",
  p6: "gutenberg:ebooks:22381:330.330.6-330.330.6:e4c2d363",
  p7: "gutenberg:ebooks:22381:330.330.7-330.330.7:3f00a61f",
  p8: "gutenberg:ebooks:22381:330.330.8-330.330.8:9e33d1a6",
  p9: "gutenberg:ebooks:22381:330.330.9-330.330.9:4a265311",
  p10: "gutenberg:ebooks:22381:330.330.10-330.330.10:583f88a3"
};

const DECISIONS = {
  "bulk-myth-0020": {
    finalStatus: "unresolved_requires_human_review",
    titleAfter: "Golden Fleece Cycle: Phryxus, Jason, and Early Argonaut Voyage",
    mythFamilyAfter: "golden-fleece",
    evidenceNeedles: ["Athamas, king of Boeotia", "GIANTS AND DOLIONES"],
    sourceProblem: "The cited span begins with Athamas, Nephele, Helle, and Phryxus, then shifts through Jason's sacrifice and departure into Doliones material.",
    resolution: "Keep the restored proposal unverified; a human reviewer must choose whether to split the Phryxus/Helle origin, Jason's launch, Lemnos, and Doliones into separate records.",
    humanDecisionQuestion: "Should this span be split into multiple source-audited records rather than treated as one Golden Fleece episode?",
    selectionReason: "Recognizable Golden Fleece material with rich events, but it overlaps an existing verified seed and combines several subepisodes.",
    knownRisks: ["overlaps-existing-verified-golden-fleece-origin", "multi-episode-span"],
    characterCorrections: ["Remove Achilles, Apollo, Echo, Orpheus, and Hermes as principal characters for the complete span; the first passage supports Athamas, Nephele, Ino, Helle, and Phryxus, while later passages introduce Jason and the Argonauts."],
    aliasCorrections: ["No Greek/Roman alias normalization was accepted; Jason and Phryxus sections must be normalized separately."],
    eventCorrections: ["The machine events are not a single episode sequence because the first cited paragraph resolves Helle and Phryxus while later paragraphs start Jason's voyage."],
    relationshipCorrections: ["Athamas/Nephele parentage is source-supported in the opening paragraph, but it should not be attached to Jason departure events without a split."],
    narrativeCorrections: ["The synopsis must be rebuilt as separate source-supported arcs before any record can be verified."]
  },
  "bulk-myth-0014": {
    finalStatus: "unresolved_requires_human_review",
    titleAfter: "Perseus: Medusa, Atlas, Andromeda, and Phineus",
    mythFamilyAfter: "perseus-and-medusa",
    evidenceNeedles: ["Perseus, one of the most renowned", "Phineus, the king's brother"],
    sourceProblem: "The cited Perseus span includes genealogy, the Medusa quest, Atlas, Andromeda's rescue, and the opening of the Phineus conflict.",
    resolution: "Leave unverified until the section is split or explicitly accepted as a multi-episode Perseus record.",
    humanDecisionQuestion: "Should this source section be reconstructed as one multi-episode Perseus record or split into Medusa, Atlas, Andromeda, and Phineus records?",
    selectionReason: "Clear myth family and characters, but the cited boundary covers several recognizable Perseus episodes.",
    knownRisks: ["multi-episode-span", "overlaps-existing-perseus-verified-seed"],
    characterCorrections: ["Danae, Acrisius, Perseus, Medusa, Atlas, Andromeda, Cepheus, Cassiopeia, and Phineus need episode-specific roles; the machine list omits several principals and includes Jupiter in a Greek-source normalized context."],
    aliasCorrections: ["Jupiter should not be automatically collapsed with Zeus for this English retelling without preserving the Roman source form."],
    eventCorrections: ["The final cited passage begins a Phineus banquet conflict after Andromeda's rescue, so the extracted event chain crosses a boundary."],
    relationshipCorrections: ["Perseus/Andromeda betrothal and Phineus prior betrothal require exact sentence evidence before normalization."],
    narrativeCorrections: ["The title is too broad for the cited subevents unless a multi-episode scope is explicitly documented."]
  },
  "bulk-myth-0032": {
    finalStatus: "ambiguous",
    titleAfter: "Jason's Exile, Return, and the One-Sandaled Prophecy",
    mythFamilyAfter: "jason-and-argonauts",
    evidenceNeedles: ["At Iolcus, in Thessaly", "Where beauteous Helle found a watery grave"],
    sourceProblem: "The span starts with Jason's displacement by Pelias, continues through Juno's disguised test, and ends in contextual Helle quotation material before the Argonautic voyage fully begins.",
    resolution: "Classify as ambiguous because the record can be read either as Jason's origin subepisode or as the setup to the Argonaut quest.",
    humanDecisionQuestion: null,
    selectionReason: "Known Jason cycle from Guerber with contiguous passages and a clear central protagonist.",
    knownRisks: ["origin-versus-quest-boundary", "poetic-quotation-tail"],
    characterCorrections: ["Keep Jason, Pelias, Aeson, Alcimede, Chiron, and Juno as reviewed participants; Neptune and Helle are contextual rather than central in this boundary."],
    aliasCorrections: ["Juno remains the source form; no Hera normalization was accepted in this batch."],
    eventCorrections: ["The event sequence should end at Juno's promise or Pelias' demand, not at the Helle quotation, unless the record is widened to quest setup."],
    relationshipCorrections: ["Aeson and Alcimede's parent relation to Jason is supported by the opening sentence and should replace unrelated relationship guesses."],
    narrativeCorrections: ["The title 'JASON.' is too broad; the reconstructed title names the source-supported origin and one-sandaled prophecy boundary."]
  },
  "bulk-myth-0087": {
    finalStatus: "unresolved_requires_human_review",
    titleAfter: "Daedalus and Icarus: Escape from Crete",
    mythFamilyAfter: "daedalus-and-icarus",
    evidenceNeedles: ["Daedalus, a descendant of Erechtheus", "he fell into the sea and was drowned"],
    sourceProblem: "The cited section includes Daedalus' artisan profile, the Minotaur/Labyrinth context, the Icarus flight, and Sicily aftermath.",
    resolution: "Do not verify a duplicate; the corpus already has a source-audited Daedalus and Icarus record, so this proposal needs an explicit duplicate-or-variant decision.",
    humanDecisionQuestion: "Should this Berens proposal be merged with the existing verified Daedalus and Icarus seed or retained as a separate witness variant with profile material omitted?",
    selectionReason: "Short, recognizable episode likely to be usable after duplicate handling.",
    knownRisks: ["duplicate-of-existing-verified-record", "profile-material-in-boundary"],
    characterCorrections: ["Minotaur and Minos are contextual for Daedalus' imprisonment; the flight event centers on Daedalus and Icarus."],
    aliasCorrections: ["No alias correction is needed, but the duplicate relationship to the existing verified record must be recorded."],
    eventCorrections: ["The verified chain would begin with Daedalus' imprisonment/escape plan, not with his artisan biography."],
    relationshipCorrections: ["Daedalus and Icarus father/son relationship is source-supported by 'his young son Icarus' and should be used if this becomes a separate witness."],
    narrativeCorrections: ["Biography and aftermath should be omitted from a focused escape record or explicitly included in scope."]
  },
  "bulk-myth-0085": {
    finalStatus: "ambiguous",
    titleAfter: "Acrisius, Danae, and the Birth of Perseus",
    mythFamilyAfter: "perseus-and-medusa",
    evidenceNeedles: ["Acrisius and Danae", "Danae, in a brazen tower"],
    sourceProblem: "The proposed title says Perseus, but the cited Guerber span is the Acrisius and Danae setup rather than the Medusa episode.",
    resolution: "Classify as ambiguous because it is a coherent birth/setup fragment but not the Perseus-and-Medusa story implied by the family.",
    humanDecisionQuestion: null,
    selectionReason: "Contiguous early Perseus material from Guerber with low passage count.",
    knownRisks: ["partial-section", "title-family-too-broad"],
    characterCorrections: ["Perseus is not the acting protagonist in the cited setup; Acrisius, Danae, and Jupiter/Jove are the source-supported participants."],
    aliasCorrections: ["Jupiter/Jove must preserve the Roman-form source witness and not be silently collapsed to Zeus."],
    eventCorrections: ["Events should cover Acrisius confining Danae and Jupiter seeing her, not Perseus' later quest."],
    relationshipCorrections: ["Danae as daughter of Acrisius and mother of Perseus need exact evidence from surrounding passages before verification."],
    narrativeCorrections: ["The scope should be renamed as a birth/setup fragment rather than a complete Perseus story."]
  },
  "bulk-myth-0091": {
    finalStatus: "unresolved_requires_human_review",
    titleAfter: "Bellerophon Receives Minerva's Bridle",
    mythFamilyAfter: "bellerophon-and-pegasus",
    evidenceNeedles: ["Bellerophon, a brave young prince", "gave him a beautiful golden bridle"],
    sourceProblem: "The cited span reaches Minerva's gift of the bridle but stops before Pegasus is captured and before the Chimera episode resolves.",
    resolution: "Leave unverified until the boundary is expanded to include the Chimera outcome or narrowed to a bridle-receipt subepisode.",
    humanDecisionQuestion: "Should this record be a partial bridle subepisode or should adjacent passages be added for the Chimera conflict and outcome?",
    selectionReason: "Recognizable Bellerophon/Pegasus source material with clear protagonist and manageable length.",
    knownRisks: ["partial-before-resolution", "missing-chimera-outcome"],
    characterCorrections: ["Bellerophon, Proetus, Iobates, Minerva, Pegasus, and the Chimera require role separation; Argos is a location/court context, not a principal character."],
    aliasCorrections: ["Minerva should remain a Roman-form source witness unless a later normalization review maps it to Athena with provenance."],
    eventCorrections: ["The final cited event is the bridle gift; killing or defeating the Chimera is not supported within the selected span."],
    relationshipCorrections: ["Bellerophon's kinship to Sisyphus and relation to Proetus are stated but need exact relationship modeling before verification."],
    narrativeCorrections: ["Conflict is assigned, but resolution is absent from the selected passages."]
  },
  "bulk-myth-0102": {
    finalStatus: "ambiguous",
    titleAfter: "Returns from Troy: Agamemnon, Orestes, and Other Greek Homecomings",
    mythFamilyAfter: "trojan-war",
    evidenceNeedles: ["During the sacking of the city of Troy", "As Orestes grew up to manhood"],
    sourceProblem: "The section is a survey of several post-Troy returns and shifts from general Greek punishment to Agamemnon and Orestes.",
    resolution: "Classify as ambiguous because the source section is narrative but bundles several homecoming episodes.",
    humanDecisionQuestion: null,
    selectionReason: "Trojan War aftermath material from Berens with clear source heading but several subepisodes.",
    knownRisks: ["survey-section", "multi-episode-homecoming"],
    characterCorrections: ["Cassandra, Agamemnon, Clytemnestra, Aegisthus, Orestes, and Pylades must be separated by subepisode; Helen and Poseidon are not principal in the cited Orestes passage."],
    aliasCorrections: ["Aegisthus spelling and Clytemnestra source forms need preservation; no alias merge was accepted."],
    eventCorrections: ["The proposed event sequence should not treat all Greek returns as one protagonist-driven plot."],
    relationshipCorrections: ["Orestes' father relation to Agamemnon is source-supported, but it belongs to the Orestes revenge subepisode."],
    narrativeCorrections: ["A single synopsis would either overgeneralize Greek homecomings or omit the Agamemnon/Orestes substory."]
  },
  "bulk-myth-0105": {
    finalStatus: "unresolved_requires_human_review",
    titleAfter: "Ulysses' Early Wanderings after Troy",
    mythFamilyAfter: "odysseus-return",
    evidenceNeedles: ["The Greek chiefs, on their return from Troy", "Whoever tasted once of that sweet food"],
    sourceProblem: "The source introduces the whole Odyssey arc, then moves through early wanderings and quoted verse without a complete return-home outcome in the selected passages.",
    resolution: "Leave unverified pending a split into Cicones, Lotus-Eaters, Cyclops, or another bounded Odyssey subepisode.",
    humanDecisionQuestion: "Which Odyssey subepisode should this proposed span represent, and should quotation-only tail passages be excluded?",
    selectionReason: "Recognizable Ulysses/Odysseus source material from Guerber, but with a broad survey boundary.",
    knownRisks: ["broad-odyssey-survey", "quotation-tail"],
    characterCorrections: ["Ulysses/Odysseus is the central identity; companions are collective participants and need a stable group entity if used."],
    aliasCorrections: ["Ulysses and Odysseus must be preserved as source aliases with one normalized Greek identity only after explicit review."],
    eventCorrections: ["The selected events should not claim the full return to Ithaca because the cited span only begins the wanderings."],
    relationshipCorrections: ["No relationship should be promoted from this source span without exact wording."],
    narrativeCorrections: ["The narrative must be narrowed from 'Adventures of Ulysses' to a specific early wandering episode."]
  },
  "bulk-myth-0044": {
    finalStatus: "verified_by_source_audit",
    titleAfter: "Alcmaeon and the Necklace",
    mythFamilyAfter: "alcmaeon-and-the-necklace",
    evidenceNeedles: ["He therefore put her to death", "deposited as sacred offerings"],
    sourceProblem: "The cited Berens section is contiguous, headed as Alcmaeon and the necklace, and resolves its revenge-and-dedication arc inside the ten cited passages.",
    resolution: "Promote as a complete-section verified record after rebuilding entities, relationships, events, narrative fields, and exact evidence.",
    humanDecisionQuestion: null,
    selectionReason: "Compact complete Berens narrative with clear title, protagonist, object, conflict, resolution, and final deposition of the necklace and veil.",
    knownRisks: ["violent-revenge-episode", "group-entity-endpoints"],
    characterCorrections: ["Replace the machine proposal's Apollo/Zeus-only principal list with Alcmaeon, Eriphyle, Arsinoe, Calirrhoe, Achelous, Phegeus, Zeus, Apollo, and group entities for the sons of Phegeus and sons of Calirrhoe."],
    aliasCorrections: ["No Greek/Roman alias merge is needed; source names are preserved exactly and normalized to stable lowercase IDs."],
    eventCorrections: ["Rebuild the event chain from exact sentences: Eriphyle's death, divine punishment, Achelous' purification, Arsinoe's restoration of the treasures, Alcmaeon's death, Calirrhoe's prayer, Zeus' transformation, revenge, and deposition at Delphi."],
    relationshipCorrections: ["Add source-supported relationships for Amphiaraus as Alcmaeon's father, Arsinoe and Calirrhoe as spouses, Calirrhoe as mother of her sons, and Phegeus' sons as enemies of Alcmaeon."],
    narrativeCorrections: ["Rewrite synopsis, opening, conflict, resolution, and outcome around the source-supported necklace-and-veil arc instead of the machine's under-specified proposal."]
  },
  "bulk-myth-0025": {
    finalStatus: "ambiguous",
    titleAfter: "Argonauts from the Speaking Oak to Colchis",
    mythFamilyAfter: "jason-and-argonauts",
    evidenceNeedles: ["The Speaking Oak", "Arrival at Colchis"],
    sourceProblem: "The span runs from the Speaking Oak through multiple Argonaut stops and reaches Colchis, so it is a travel sequence rather than one compact story.",
    resolution: "Classify as ambiguous because it needs split decisions around Argo launch, intervening adventures, and arrival at Colchis.",
    humanDecisionQuestion: null,
    selectionReason: "High-scoring Jason material from Guerber with contiguous passages but substantial internal boundaries.",
    knownRisks: ["long-travel-sequence", "multiple-subepisode-boundaries"],
    characterCorrections: ["Cadmus is not a principal Argonaut in this span; Jason, Medea, Hercules, Juno, and Minerva require event-specific roles if retained."],
    aliasCorrections: ["Juno and Minerva source forms should not be silently converted to Greek names."],
    eventCorrections: ["Arrival at Colchis cannot serve as the resolution for earlier Speaking Oak or intervening island episodes without documented scope."],
    relationshipCorrections: ["Jason/Medea relationship evidence belongs near the Colchis passages and should not be retrofitted to earlier travel passages."],
    narrativeCorrections: ["The title 'Orphic Argonautics' is bibliographic/contextual; the source-supported title should name the actual included travel span."]
  }
};

function sentence(access, passageId, needle) {
  return access.sentenceContaining(passageId, needle);
}

function mapEntity(access, passageId, sourceName, normalizedId, needle, note) {
  const sourceText = sentence(access, passageId, needle || sourceName);
  return {
    sourceName,
    normalizedId,
    normalizationStatus: "verified_by_source_audit",
    evidence: [{ passageId, sourceText, coreferenceNote: note || null }]
  };
}

function relationship(access, passageId, source, relationshipType, target, needle) {
  const sourceText = sentence(access, passageId, needle);
  return {
    source,
    relationship: relationshipType,
    target,
    sourceText,
    evidence: { passageId, sourceText },
    reviewStatus: "verified_by_source_audit"
  };
}

function event(access, index, passageId, needle, data) {
  const sourceText = sentence(access, passageId, needle);
  return Object.assign({
    eventId: `event-${String(index).padStart(3, "0")}`,
    sourceText,
    normalizedStatement: data.normalizedStatement,
    actor: data.actor,
    action: data.action,
    sourceAction: data.sourceAction || data.action,
    target: data.target || null,
    object: data.object || null,
    recipient: data.recipient || null,
    location: data.location || null,
    confidence: 0.9,
    causedBy: [],
    causes: [],
    evidence: [{ passageId, sourceText }],
    reviewStatus: "verified_by_source_audit"
  }, data);
}

function evidenceSummary(access, passageId, needle, supports) {
  const sourceText = sentence(access, passageId, needle);
  return {
    passageId,
    sourceText,
    supports: supports.map((field) => ({
      field,
      evidenceType: "direct",
      rationale: `The exact source sentence directly supports ${field}.`
    }))
  };
}

function buildAlcmaeonVerifiedRecord(passageMap) {
  const access = buildPassageAccess(passageMap);
  const p = ALCMAEON_PASSAGES;
  return {
    mythId: "bulk-verified-0016",
    mythFamilyId: "alcmaeon-and-the-necklace",
    variantId: "gutenberg-berens-alcmaeon-necklace-verified",
    title: "Alcmaeon and the Necklace",
    source: {
      sourceId: "gutenberg-berens-myths-legends-greece-rome-eng",
      passages: Object.values(p)
    },
    scope: {
      type: "complete-section",
      description: "Complete Berens section covering Alcmaeon's vengeance on Eriphyle, divine punishment, deception over Harmonia's necklace and veil, Alcmaeon's death, Calirrhoe's prayer, and the revenge of her sons.",
      includedPassages: Object.values(p),
      omittedPassages: [],
      boundaryRationale: "The selected passages are contiguous under the source heading 'ALCMAEON AND THE NECKLACE.' and resolve with the necklace and veil deposited in Apollo's temple at Delphi."
    },
    entities: {
      characters: ["alcmaeon", "amphiaraus", "eriphyle", "arsinoe", "calirrhoe", "achelous", "phegeus", "sons-of-phegeus", "sons-of-calirrhoe", "zeus", "apollo", "gods"],
      locations: ["psophis", "delphi", "tegea"],
      objects: ["necklace-and-veil"],
      creatures: ["fury"]
    },
    entityMappings: [
      mapEntity(access, p.p1, "Alcmaeon", "alcmaeon"),
      mapEntity(access, p.p1, "Amphiaraus", "amphiaraus"),
      mapEntity(access, p.p1, "Eriphyle", "eriphyle"),
      mapEntity(access, p.p2, "Arsinoe", "arsinoe"),
      mapEntity(access, p.p4, "Calirrhoe", "calirrhoe"),
      mapEntity(access, p.p4, "Achelous", "achelous"),
      mapEntity(access, p.p6, "Phegeus", "phegeus"),
      mapEntity(access, p.p7, "sons of Phegeus", "sons-of-phegeus", "when the king informed his sons", "The source identifies them as Phegeus' sons through the preceding phrase 'king Phegeus' and the same sentence's 'the king informed his sons'."),
      mapEntity(access, p.p10, "sons of Calirrhoe", "sons-of-calirrhoe"),
      mapEntity(access, p.p9, "Zeus", "zeus"),
      mapEntity(access, p.p10, "Apollo", "apollo"),
      mapEntity(access, p.p2, "gods", "gods"),
      mapEntity(access, p.p2, "Furies", "fury")
    ],
    mainCharacters: [
      { entityId: "alcmaeon", sourceNames: ["Alcmaeon"], role: "doomed protagonist", reason: "He kills Eriphyle, wanders under punishment, deceives Arsinoe, and is killed by Phegeus' sons.", evidence: [p.p1, p.p7] },
      { entityId: "eriphyle", sourceNames: ["Eriphyle"], role: "victim of vengeance", reason: "Alcmaeon kills her for betraying Amphiaraus.", evidence: [p.p1] },
      { entityId: "calirrhoe", sourceNames: ["Calirrhoe"], role: "second wife and petitioner", reason: "She asks Zeus to mature her sons so they can avenge Alcmaeon.", evidence: [p.p9] },
      { entityId: "sons-of-phegeus", sourceNames: ["sons of Phegeus"], role: "killers of Alcmaeon", reason: "They ambush and kill Alcmaeon after learning of his treachery.", evidence: [p.p7] }
    ],
    relationships: [
      relationship(access, p.p1, "amphiaraus", "parent_of", "alcmaeon", "his father Amphiaraus"),
      relationship(access, p.p2, "arsinoe", "spouse_of", "alcmaeon", "bestowed upon him the hand of his daughter Arsinoe"),
      relationship(access, p.p4, "calirrhoe", "spouse_of", "alcmaeon", "Calirrhoe, the beautiful daughter of the river-god, who became united to him in marriage"),
      relationship(access, p.p9, "calirrhoe", "parent_of", "sons-of-calirrhoe", "her infant sons might grow at once to manhood"),
      relationship(access, p.p7, "sons-of-phegeus", "enemy_of", "alcmaeon", "fell upon him and despatched him")
    ],
    narrative: {
      synopsis: "Alcmaeon kills his mother Eriphyle to avenge Amphiaraus and is punished with madness and pursuit by a Fury. After Achelous purifies him, he marries Calirrhoe, deceives Arsinoe to recover Harmonia's necklace and veil, and is killed by the sons of Phegeus. Calirrhoe asks Zeus to mature her sons, who avenge Alcmaeon and deposit the fatal treasures in Apollo's temple at Delphi.",
      openingSituation: "Alcmaeon returns from the Theban expedition and resolves to avenge Amphiaraus by killing Eriphyle.",
      centralConflict: "The necklace and veil repeatedly drive betrayal and vengeance: Alcmaeon kills Eriphyle, deceives Arsinoe, and is killed by Phegeus' sons.",
      resolution: "Zeus grants Calirrhoe's prayer by transforming her sons into grown men, and they kill the sons of Phegeus.",
      outcome: "The sons of Calirrhoe return the necklace and veil to their mother, and Achelous commands that the objects be deposited in Apollo's temple at Delphi.",
      storyline: [
        "Alcmaeon kills Eriphyle for betraying Amphiaraus.",
        "The gods punish Alcmaeon with madness and pursuit.",
        "Achelous purifies Alcmaeon after he reaches new land.",
        "Alcmaeon deceives Arsinoe and recovers Harmonia's necklace and veil.",
        "The sons of Phegeus kill Alcmaeon.",
        "Zeus matures Calirrhoe's sons so they can avenge their father.",
        "The sons of Calirrhoe kill the sons of Phegeus and dedicate the treasures at Delphi."
      ]
    },
    evidenceSummary: [
      evidenceSummary(access, p.p1, "He therefore put her to death", ["openingSituation", "event-001"]),
      evidenceSummary(access, p.p6, "Arsinoe, deceived by his artful representations", ["centralConflict", "event-005"]),
      evidenceSummary(access, p.p9, "the children of yesterday became transformed into bearded men", ["resolution", "event-008"]),
      evidenceSummary(access, p.p10, "deposited as sacred offerings in the temple of Apollo at Delphi", ["outcome", "event-010"])
    ],
    initialState: [{
      subject: "alcmaeon",
      predicate: "seeks_vengeance_for",
      object: "amphiaraus",
      evidence: [{ passageId: p.p1, sourceText: sentence(access, p.p1, "desired him to be revenged") }]
    }],
    events: [
      event(access, 1, p.p1, "He therefore put her to death", { actor: "alcmaeon", action: "kill", sourceAction: "put to death", target: "eriphyle", normalizedStatement: "Alcmaeon killed Eriphyle to avenge Amphiaraus." }),
      event(access, 2, p.p2, "afflicted him with madness", { actor: "gods", action: "punish", sourceAction: "afflicted", target: "alcmaeon", recipient: "fury", normalizedStatement: "The gods punished Alcmaeon with madness and pursuit by a Fury." }),
      event(access, 3, p.p4, "finally purified of his crime", { actor: "achelous", action: "purify", sourceAction: "purified", target: "alcmaeon", normalizedStatement: "Achelous purified Alcmaeon after he found a new home." }),
      event(access, 4, p.p4, "Calirrhoe, the beautiful daughter", { actor: "alcmaeon", action: "marry", sourceAction: "became united", target: "calirrhoe", normalizedStatement: "Alcmaeon married Calirrhoe, daughter of Achelous." }),
      event(access, 5, p.p6, "Arsinoe, deceived by his artful representations", { actor: "arsinoe", action: "give", sourceAction: "restored", object: "necklace-and-veil", recipient: "alcmaeon", normalizedStatement: "Arsinoe restored the necklace and veil to Alcmaeon after his deception." }),
      event(access, 6, p.p7, "fell upon him and despatched him", { actor: "sons-of-phegeus", action: "kill", sourceAction: "despatched", target: "alcmaeon", normalizedStatement: "The sons of Phegeus ambushed and killed Alcmaeon." }),
      event(access, 7, p.p9, "implored Zeus", { actor: "calirrhoe", action: "petition", sourceAction: "implored", recipient: "zeus", normalizedStatement: "Calirrhoe asked Zeus to make her infant sons grown men so they could avenge Alcmaeon." }),
      event(access, 8, p.p9, "became transformed into bearded men", { actor: "zeus", action: "transform", sourceAction: "became transformed", target: "sons-of-calirrhoe", normalizedStatement: "Zeus answered by transforming Calirrhoe's children into grown men." }),
      event(access, 9, p.p10, "rushed upon them and slew them", { actor: "sons-of-calirrhoe", action: "kill", sourceAction: "slew", target: "sons-of-phegeus", location: "tegea", normalizedStatement: "The sons of Calirrhoe killed the sons of Phegeus at Tegea." }),
      event(access, 10, p.p10, "deposited as sacred offerings", { actor: "sons-of-calirrhoe", action: "dedicate", sourceAction: "deposited", object: "necklace-and-veil", recipient: "apollo", location: "delphi", normalizedStatement: "The sons of Calirrhoe deposited the necklace and veil as offerings in Apollo's temple at Delphi." })
    ],
    finalState: [{
      subject: "necklace-and-veil",
      predicate: "deposited_at",
      object: "delphi",
      evidence: [{ passageId: p.p10, sourceText: sentence(access, p.p10, "deposited as sacred offerings") }]
    }],
    interpretation: {
      themes: [],
      storyline: [
        "vengeance",
        "deception",
        "divine punishment"
      ]
    },
    variantLinks: [{
      type: "source-variant",
      sourceIds: ["gutenberg-berens-myths-legends-greece-rome-eng"],
      reviewStatus: "verified_by_source_audit"
    }],
    normalizationWarnings: [],
    semanticQuality: {
      passed: true,
      verificationLevel: "source_audited",
      checksPassed: [
        "exact_source_text",
        "entity_evidence",
        "event_references",
        "relationship_references",
        "narrative_boundary",
        "cross_field_consistency"
      ],
      failedChecks: [],
      limitations: ["Implementation source audit, not human scholarly approval."]
    },
    verification: {
      status: "verified_by_source_audit",
      method: "Codex source-grounded implementation review",
      passagesRead: Object.values(p),
      claimsChecked: [
        "Alcmaeon kills Eriphyle in revenge for Amphiaraus.",
        "The gods punish Alcmaeon with madness and a pursuing Fury.",
        "Achelous purifies Alcmaeon.",
        "Alcmaeon deceives Arsinoe to recover Harmonia's necklace and veil.",
        "The sons of Phegeus kill Alcmaeon.",
        "Calirrhoe asks Zeus to mature her sons.",
        "The sons of Calirrhoe avenge Alcmaeon and dedicate the necklace and veil at Delphi."
      ],
      correctionsMade: [
        "Replaced unsupported Apollo/Zeus-only machine entities with Alcmaeon, Eriphyle, Arsinoe, Calirrhoe, Achelous, Phegeus, Zeus, Apollo, and the two sons groups.",
        "Rebuilt ten events from exact complete source sentences.",
        "Changed the broad proposed event chain into a complete-section source audit with explicit boundary rationale.",
        "Added exact evidence for the necklace and veil as source-supported objects."
      ],
      remainingUncertainties: []
    },
    reviewStatus: "verified_by_source_audit"
  };
}

function compact(text, max) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).replace(/\s+\S*$/, "").trim()}.`;
}

function passageText(passageMap, passageId) {
  return passageMap[passageId] ? passageMap[passageId].text : "";
}

function evidenceForDecision(access, record, decision) {
  return (decision.evidenceNeedles || []).map((needle) => {
    const passageId = (record.myth.source.passages || []).find((id) => passageText(access.rawPassageMap, id).includes(needle));
    const sourceText = passageId ? sentence(access, passageId, needle) : passageText(access.rawPassageMap, record.myth.source.passages[0]);
    return {
      passageId: passageId || record.myth.source.passages[0],
      sourceText,
      supports: `Record-specific reconstruction finding for ${record.myth.mythId}: ${decision.sourceProblem}`
    };
  });
}

function buildResult(access, record, decision) {
  const myth = record.myth;
  const originalBoundary = myth.source.passages.slice();
  const exactEvidence = evidenceForDecision(access, record, decision);
  const finalBoundary = decision.finalStatus === "verified_by_source_audit"
    ? Object.values(ALCMAEON_PASSAGES)
    : originalBoundary;
  return {
    mythId: myth.mythId,
    originalStatus: "awaiting_substantive_source_review",
    finalStatus: decision.finalStatus,
    titleBefore: myth.title,
    titleAfter: decision.titleAfter,
    mythFamilyBefore: myth.mythFamilyId,
    mythFamilyAfter: decision.mythFamilyAfter,
    sourcePassagesRead: originalBoundary,
    boundaryAnalysis: {
      originalBoundary,
      finalBoundary,
      excludedPassages: decision.excludedPassages || [],
      specificProblems: [decision.sourceProblem],
      resolution: decision.resolution
    },
    characterCorrections: decision.characterCorrections,
    aliasCorrections: decision.aliasCorrections,
    eventCorrections: decision.eventCorrections,
    relationshipCorrections: decision.relationshipCorrections,
    narrativeCorrections: decision.narrativeCorrections,
    exactEvidence,
    remainingUncertainties: decision.humanDecisionQuestion ? [decision.humanDecisionQuestion] : [],
    humanDecisionQuestion: decision.humanDecisionQuestion,
    decisionRationale: `${myth.mythId} was reconstructed against ${myth.source.sourceId}. ${decision.sourceProblem} Final outcome: ${decision.finalStatus}; ${decision.resolution}`
  };
}

function buildSelection(recordsById) {
  return {
    generatedAt: GENERATED_AT,
    batchId: BATCH_ID,
    selectedCount: SELECTED_IDS.length,
    selectionCriteria: [
      "Start from records marked awaiting_substantive_source_review after PR #12 restoration.",
      "Exclude PR #12's twenty-record audit sample.",
      "Prioritize recognizable myth-family headings with contiguous or tractable passage spans.",
      "Include records from Berens and Guerber.",
      "Stop at exactly ten source proposals."
    ],
    selectedRecords: SELECTED_IDS.map((mythId) => {
      const record = recordsById.get(mythId);
      const decision = DECISIONS[mythId];
      return {
        mythId,
        title: record.myth.title,
        sourceId: record.myth.source.sourceId,
        file: `corpus/normalized/bulk/proposed/${mythId}.myth.json`,
        selectionReason: decision.selectionReason,
        knownRisks: decision.knownRisks
      };
    })
  };
}

function buildManualInspection(result, record) {
  return {
    mythId: result.mythId,
    inspectedAt: GENERATED_AT,
    finalStatus: result.finalStatus,
    findings: [
      `Boundary: ${result.boundaryAnalysis.resolution}`,
      `Title/family: "${result.titleBefore}" was reviewed as "${result.titleAfter}" in ${result.mythFamilyAfter}.`,
      `Characters/entities: ${result.characterCorrections[0]}`,
      `Aliases: ${result.aliasCorrections[0]}`,
      `Events: ${result.eventCorrections[0]}`,
      `Relationships: ${result.relationshipCorrections[0]}`,
      `Narrative: ${result.narrativeCorrections[0]}`,
      `Evidence: ${result.exactEvidence.map((item) => `${item.passageId} => ${compact(item.sourceText, 110)}`).join(" | ")}`
    ],
    sourceBoundaryConfirmed: result.finalStatus === "verified_by_source_audit",
    proposedFileReviewed: `corpus/normalized/bulk/proposed/${record.myth.mythId}.myth.json`
  };
}

function buildReconstructionBatch02({ productionRecords, passageMap }) {
  const access = buildPassageAccess(passageMap);
  access.rawPassageMap = passageMap;
  const recordsById = new Map(productionRecords.map((record) => [record.myth.mythId, record]));
  const missing = SELECTED_IDS.filter((mythId) => !recordsById.has(mythId));
  if (missing.length) throw new Error(`Missing reconstruction batch records: ${missing.join(", ")}`);
  const invalid = SELECTED_IDS.filter((mythId) => recordsById.get(mythId).myth.reviewStatus !== "awaiting_substantive_source_review");
  if (invalid.length) throw new Error(`Reconstruction batch records are not awaiting substantive review: ${invalid.join(", ")}`);

  const results = SELECTED_IDS.map((mythId) => buildResult(access, recordsById.get(mythId), DECISIONS[mythId]));
  const verifiedRecords = [buildAlcmaeonVerifiedRecord(passageMap)];
  const counts = {
    verifiedCount: results.filter((record) => record.finalStatus === "verified_by_source_audit").length,
    ambiguousCount: results.filter((record) => record.finalStatus === "ambiguous").length,
    rejectedCount: results.filter((record) => record.finalStatus === "rejected_non_story").length,
    humanReviewRequiredCount: results.filter((record) => record.finalStatus === "unresolved_requires_human_review").length
  };
  return {
    batchId: BATCH_ID,
    selectedIds: SELECTED_IDS.slice(),
    selection: buildSelection(recordsById),
    results: Object.assign({
      generatedAt: GENERATED_AT,
      batchId: BATCH_ID,
      selectedCount: SELECTED_IDS.length
    }, counts, {
      records: results
    }),
    manualInspection: {
      generatedAt: GENERATED_AT,
      batchId: BATCH_ID,
      inspectedCount: SELECTED_IDS.length,
      inspections: results.map((result) => buildManualInspection(result, recordsById.get(result.mythId)))
    },
    verifiedRecords,
    resultById: new Map(results.map((result) => [result.mythId, result])),
    finalStatusById: new Map(results.map((result) => [result.mythId, result.finalStatus]))
  };
}

module.exports = {
  BATCH_ID,
  SELECTED_IDS,
  buildReconstructionBatch02
};
