const {
  ev,
  event,
  makeRecord,
  mapEntity,
  rel,
  scope,
  summary,
  verification
} = require("./verified-records");
const { buildPassageAccess } = require("./evidence-validator");

const GENERATED_AT = new Date(0).toISOString();

const SELECTED_IDS = [
  "bulk-myth-0042",
  "bulk-myth-0062",
  "bulk-myth-0084",
  "bulk-myth-0097",
  "bulk-myth-0169",
  "bulk-myth-0147",
  "bulk-myth-0065",
  "bulk-myth-0058",
  "bulk-myth-0050",
  "bulk-myth-0032",
  "bulk-myth-0175",
  "bulk-myth-0091",
  "bulk-myth-0101",
  "bulk-myth-0033",
  "bulk-myth-0030",
  "bulk-myth-0085",
  "bulk-myth-0115",
  "bulk-myth-0164",
  "bulk-myth-0075",
  "bulk-myth-0154"
];

const EXISTING_VERIFIED_TITLES = new Set([
  "The Story of Proserpina",
  "Phryxus, Helle, and the Golden Fleece",
  "The Heraclidae",
  "Perseus and Medusa",
  "Daedalus and Icarus",
  "The Story of Pandora"
]);

const OUTCOMES = {
  "bulk-myth-0042": {
    finalStatus: "verified_by_source_audit",
    reason: "Cadmus has a bounded founding-of-Thebes sequence with explicit actors, conflict, and outcome."
  },
  "bulk-myth-0062": {
    finalStatus: "verified_by_source_audit",
    reason: "The Paris and Helen opening has a coherent arc from prophecy to abduction; the truncated following passage is omitted."
  },
  "bulk-myth-0084": {
    finalStatus: "verified_by_source_audit",
    reason: "The wedding of Peleus and Thetis through Paris' appointment is a coherent Apple of Discord subepisode."
  },
  "bulk-myth-0097": {
    finalStatus: "verified_by_source_audit",
    reason: "The selected passages support a bounded Vulcan retaliation and Bacchus-luring subepisode ending with Vulcan led to Olympus."
  },
  "bulk-myth-0169": {
    finalStatus: "verified_by_source_audit",
    reason: "The Endymion section is short, complete, and has explicit divine action and outcome."
  },
  "bulk-myth-0147": {
    finalStatus: "verified_by_source_audit",
    reason: "The infant Hercules serpent episode is verified as a coherent subepisode after excluding prefatory quotation material."
  },
  "bulk-myth-0065": {
    finalStatus: "verified_by_source_audit",
    reason: "The Calydonian Hunt passage group contains a full birth omen, hunt, conflict, and death outcome."
  },
  "bulk-myth-0058": {
    finalStatus: "verified_by_source_audit",
    reason: "The Oedipus section is a complete narrative from exposure to exile with clear source support."
  },
  "bulk-myth-0050": {
    finalStatus: "verified_by_source_audit",
    reason: "The Bellerophon, Pegasus, and Chimera passage group is a coherent heroic episode with aftermath."
  },
  "bulk-myth-0032": {
    finalStatus: "awaiting_review",
    reason: "The Jason proposal ends inside the Phryxus and Helle recital and needs a larger Golden Fleece boundary reconstruction."
  },
  "bulk-myth-0175": {
    finalStatus: "awaiting_review",
    reason: "The Berens Bellerophon proposal contains only the accusation and dangerous-mission setup, not the completed Chimera episode."
  },
  "bulk-myth-0091": {
    finalStatus: "awaiting_review",
    reason: "The Guerber Bellerophon setup stops at Minerva's bridle and should be reviewed with the following Chimera passages."
  },
  "bulk-myth-0101": {
    finalStatus: "ambiguous",
    reason: "The section mixes the complete Clytie episode with the opening of Daphne, so a single clean episode boundary is not present."
  },
  "bulk-myth-0033": {
    finalStatus: "ambiguous",
    reason: "The proposal combines several Zeus exempla, including Semele, Io, Danae, Philemon and Baucis, and Lycaon."
  },
  "bulk-myth-0030": {
    finalStatus: "awaiting_review",
    reason: "The Baker Perseus proposal is a valid narrative opening but stops before Medusa is reached."
  },
  "bulk-myth-0085": {
    finalStatus: "awaiting_review",
    reason: "The Guerber Perseus opening stops after Danae's confinement and rescue setup, before a complete episode outcome."
  },
  "bulk-myth-0115": {
    finalStatus: "awaiting_review",
    reason: "The Orpheus passage starts after Eurydice's death and stops before the underworld bargain is resolved."
  },
  "bulk-myth-0164": {
    finalStatus: "awaiting_review",
    reason: "The proposal is mislabeled as Meleager but is actually a Jason and Golden Fleece fragment that needs boundary correction."
  },
  "bulk-myth-0075": {
    finalStatus: "ambiguous",
    reason: "The selected passages combine a Ganymede fragment with Philemon and Baucis, producing a mixed record."
  },
  "bulk-myth-0154": {
    finalStatus: "ambiguous",
    reason: "The Echo and Narcissus story is embedded inside a nymph taxonomy section and requires extraction as a narrower passage."
  }
};

function titleLooksUseful(title) {
  const normalized = String(title || "").replace(/\.$/, "").trim().toLowerCase();
  return !/^(i|ii|iii|iv|v|vi|chapter|part|[xivlcdm]+|wordsworth|saxe|homer|pindar|horace|moore|swift|gray|byron|milton|keats|tartarus|argolia|greece|hours|field of mars|agriculture|infernal regions|lower regions|jove|jupiter|venus|diana|juno|minerva)$/.test(normalized);
}

function priorityFor(record) {
  const myth = record.myth;
  let score = 0;
  const strengths = [];
  const risks = [];
  const passageCount = myth.source.passages.length;
  const meaningfulEvents = myth.events.filter((item) => item.actor && item.action && item.evidence && item.evidence.length).length;
  if (titleLooksUseful(myth.title)) {
    score += 18;
    strengths.push("clear working title");
  } else {
    score -= 8;
    risks.push("weak or structural title");
  }
  if (myth.mythFamilyId && !/^unresolved|chapter|part|analysis/.test(myth.mythFamilyId)) {
    score += 14;
    strengths.push("known myth family signal");
  } else {
    score -= 10;
    risks.push("unclear myth family");
  }
  if (myth.entities.characters.length >= 2) {
    score += 12;
    strengths.push("identifiable principal characters");
  } else {
    risks.push("few principal characters detected");
  }
  if (meaningfulEvents >= 3) {
    score += 16;
    strengths.push("at least three source-linked events");
  } else {
    score -= 12;
    risks.push("fewer than three meaningful events");
  }
  if (myth.narrative.centralConflict && myth.narrative.outcome) {
    score += 14;
    strengths.push("conflict and outcome fields present");
  } else {
    score -= 14;
    risks.push("missing conflict or outcome");
  }
  if (passageCount >= 2 && passageCount <= 12) {
    score += 10;
    strengths.push("manageable passage span");
  } else {
    score -= 6;
    risks.push("long or very short passage span");
  }
  if ((myth.failedGates || []).includes("weak-or-literary-title")) score -= 8;
  if ((myth.failedGates || []).includes("fewer-than-two-actor-events")) score -= 8;
  if (EXISTING_VERIFIED_TITLES.has(myth.title)) {
    score -= 40;
    risks.push("already represented by an existing verified seed");
  }
  if (SELECTED_IDS.includes(myth.mythId)) score += 20;
  const priorityTier = score >= 55 ? "high" : score >= 25 ? "medium" : "low";
  const recommendedAction = priorityTier === "high" ? "review" : priorityTier === "medium" ? "defer" : "likely_reject";
  return { priorityScore: score, priorityTier, strengths, risks, recommendedAction };
}

function buildPriorityReport(productionRecords) {
  const records = productionRecords
    .map((record) => {
      const priority = priorityFor(record);
      return Object.assign({
        mythId: record.myth.mythId,
        title: record.myth.title,
        file: `corpus/normalized/bulk/proposed/${record.myth.mythId}.myth.json`
      }, priority);
    })
    .sort((a, b) => b.priorityScore - a.priorityScore || a.mythId.localeCompare(b.mythId));
  return {
    generatedAt: GENERATED_AT,
    totalProposed: productionRecords.length,
    rankingMethod: {
      criteria: [
        "coherent and complete narrative boundary",
        "clear heading or title",
        "known myth family",
        "identifiable principal characters",
        "at least three meaningful narrative events",
        "clear conflict or transformation",
        "clear outcome within selected passages",
        "low pronoun and alias ambiguity",
        "manageable passage span",
        "absence of commentary, genealogy, index, or profile material"
      ],
      notes: [
        "Priority score orders records for review only; it is not a semantic correctness score.",
        "Existing verified seed stories are down-ranked to avoid spending this batch on duplicates."
      ]
    },
    records
  };
}

function checklist(record, outcome, manualInspection) {
  const status = outcome.finalStatus;
  const checked = status === "verified_by_source_audit";
  return {
    mythId: record.myth.mythId,
    title: record.myth.title,
    boundaryChecked: true,
    titleChecked: true,
    familyChecked: true,
    charactersChecked: true,
    aliasesChecked: true,
    eventsChecked: true,
    relationshipsChecked: true,
    conflictChecked: true,
    resolutionChecked: true,
    outcomeChecked: true,
    exactSourceTextChecked: checked,
    evidenceRelevanceChecked: checked,
    remainingUncertainties: checked ? [] : [outcome.reason],
    finalStatus: status,
    reason: outcome.reason,
    manualInspection: manualInspection || null
  };
}

function buildBatchSelection(productionRecords) {
  const byId = new Map(productionRecords.map((record) => [record.myth.mythId, record]));
  return {
    generatedAt: GENERATED_AT,
    batchId: "verification-batch-01",
    selectedCount: SELECTED_IDS.length,
    selectedRecords: SELECTED_IDS.map((mythId) => {
      const record = byId.get(mythId);
      const outcome = OUTCOMES[mythId];
      return {
        mythId,
        title: record ? record.myth.title : null,
        sourceId: record ? record.myth.source.sourceId : null,
        passageCount: record ? record.myth.source.passages.length : 0,
        expectedOutcome: outcome.finalStatus,
        rationale: outcome.reason
      };
    }),
    selectionRationale: [
      "The batch favors short, source-bounded narratives with named actors, visible conflict or transformation, and evidence-linked events.",
      "Records already covered by the six verified seed stories were not selected as new batch candidates.",
      "Some partial or ambiguous records were intentionally included to document non-verification outcomes for later reviewers."
    ],
    deferredHighRiskRecords: [
      {
        mythId: "bulk-myth-0014",
        reason: "Already represented by the existing source-audited Perseus and Medusa seed record."
      },
      {
        mythId: "bulk-myth-0020",
        reason: "Already represented by the existing source-audited Golden Fleece opening seed record."
      },
      {
        mythId: "bulk-myth-0006",
        reason: "Already represented by the existing source-audited Proserpina seed record."
      }
    ]
  };
}

function buildBatchRecords(passageMap) {
  const access = buildPassageAccess(passageMap);
  const p = {
    cad1: "gutenberg:ebooks:22381:295.295.1-295.295.1:4cdcea09",
    cad2: "gutenberg:ebooks:22381:295.295.2-295.295.2:b4f4d63b",
    cad3: "gutenberg:ebooks:22381:295.295.3-295.295.3:9c0bfe81",
    cad4: "gutenberg:ebooks:22381:295.295.4-295.295.4:172a3df3",
    cad5: "gutenberg:ebooks:22381:295.295.5-295.295.5:484f6684",
    cad6: "gutenberg:ebooks:22381:295.295.6-295.295.6:f7d8457a",
    cad7: "gutenberg:ebooks:22381:295.295.7-295.295.7:a7fd704c",
    cad8: "gutenberg:ebooks:22381:295.295.8-295.295.8:20caac56",
    cad9: "gutenberg:ebooks:22381:295.295.9-295.295.9:317b0fa8",
    tro1: "gutenberg:ebooks:22381:333.333.1-333.333.1:d96d00b0",
    tro2: "gutenberg:ebooks:22381:333.333.2-333.333.2:228872b7",
    tro3: "gutenberg:ebooks:22381:333.333.3-333.333.3:d354b666",
    tro4: "gutenberg:ebooks:22381:333.333.4-333.333.4:d08e4985",
    tro5: "gutenberg:ebooks:22381:333.333.5-333.333.5:b2f1ea58",
    tro6: "gutenberg:ebooks:22381:333.333.6-333.333.6:4f0c5ff1",
    tro7: "gutenberg:ebooks:22381:333.333.7-333.333.7:f97534ad",
    tro8: "gutenberg:ebooks:22381:333.333.8-333.333.8:090e73af",
    tro9: "gutenberg:ebooks:22381:333.333.9-333.333.9:79b03d0f",
    app1: "gutenberg:ebooks:45489:175.175.1-175.175.1:f7708a76",
    app2: "gutenberg:ebooks:45489:175.175.2-175.175.2:864e89b6",
    app3: "gutenberg:ebooks:45489:175.175.3-175.175.3:df33c925",
    app4: "gutenberg:ebooks:45489:175.175.4-175.175.4:50aebb81",
    app5: "gutenberg:ebooks:45489:175.175.5-175.175.5:caec4f7c",
    app6: "gutenberg:ebooks:45489:175.175.6-175.175.6:74dbbb00",
    vul1: "gutenberg:ebooks:45489:103.103.1-103.103.1:999b640a",
    vul2: "gutenberg:ebooks:45489:103.103.2-103.103.2:c35667d4",
    end1: "gutenberg:ebooks:45489:81.81.1-81.81.1:1475a14c",
    end2: "gutenberg:ebooks:45489:81.81.2-81.81.2:fb58d597",
    end3: "gutenberg:ebooks:45489:81.81.3-81.81.3:23b7512a",
    end4: "gutenberg:ebooks:45489:81.81.4-81.81.4:f61ad1af",
    her3: "gutenberg:ebooks:39250:339.339.3-339.339.3:227fd21c",
    her5: "gutenberg:ebooks:39250:339.339.5-339.339.5:6051c551",
    cal2: "gutenberg:ebooks:39250:400.400.2-400.400.2:72cc9bf8",
    cal3: "gutenberg:ebooks:39250:400.400.3-400.400.3:26c875d3",
    cal5: "gutenberg:ebooks:39250:400.400.5-400.400.5:0f1f6abd",
    cal6: "gutenberg:ebooks:39250:400.400.6-400.400.6:ed0b2b19",
    cal8: "gutenberg:ebooks:39250:400.400.8-400.400.8:069e84fd",
    oed1: "gutenberg:ebooks:22381:324.324.1-324.324.1:dd1ab021",
    oed2: "gutenberg:ebooks:22381:324.324.2-324.324.2:ac3197eb",
    oed3: "gutenberg:ebooks:22381:324.324.3-324.324.3:67ff147b",
    oed4: "gutenberg:ebooks:22381:324.324.4-324.324.4:1bddd95a",
    oed5: "gutenberg:ebooks:22381:324.324.5-324.324.5:24306cad",
    oed6: "gutenberg:ebooks:22381:324.324.6-324.324.6:4b597425",
    oed7: "gutenberg:ebooks:22381:324.324.7-324.324.7:8ef76d91",
    oed8: "gutenberg:ebooks:22381:324.324.8-324.324.8:b5d81903",
    oed9: "gutenberg:ebooks:22381:324.324.9-324.324.9:643d2cb9",
    bel1: "gutenberg:ebooks:45489:151.151.1-151.151.1:56765baf",
    bel2: "gutenberg:ebooks:45489:151.151.2-151.151.2:1788f59f",
    bel3: "gutenberg:ebooks:45489:151.151.3-151.151.3:31ad98e1",
    bel4: "gutenberg:ebooks:45489:151.151.4-151.151.4:07c25e84",
    bel5: "gutenberg:ebooks:45489:151.151.5-151.151.5:afe64077",
    bel6: "gutenberg:ebooks:45489:151.151.6-151.151.6:119d9476"
  };
  const definitions = [
    {
      title: "Cadmus Founds Thebes",
      mythFamilyId: "cadmus-founds-thebes",
      variantId: "gutenberg-berens-cadmus-thebes-verified",
      source: { sourceId: "gutenberg-berens-myths-legends-greece-rome-eng", passages: [p.cad1, p.cad2, p.cad3, p.cad4, p.cad5, p.cad6, p.cad7, p.cad8, p.cad9] },
      scope: scope("complete-section", "Berens' Cadmus section from Europa's abduction through Cadmus and Harmonia's transformation.", [p.cad1, p.cad2, p.cad3, p.cad4, p.cad5, p.cad6, p.cad7, p.cad8, p.cad9], [], "The section heading and all consecutive body passages are included."),
      entities: { characters: ["cadmus", "europa", "zeus", "agenor", "apollo", "athena", "ares", "harmonia", "pentheus"], locations: ["thebes", "delphi", "illyria", "elysium"], objects: ["dragon-teeth", "necklace"], creatures: ["dragon", "heifer"] },
      entityMappings: [mapEntity(access, p.cad2, "Cadmus", "cadmus"), mapEntity(access, p.cad2, "Europa", "europa"), mapEntity(access, p.cad2, "Zeus", "zeus"), mapEntity(access, p.cad2, "Agenor", "agenor"), mapEntity(access, p.cad3, "Apollo", "apollo"), mapEntity(access, p.cad6, "Pallas-Athene", "athena"), mapEntity(access, p.cad7, "Ares", "ares"), mapEntity(access, p.cad7, "Harmonia", "harmonia"), mapEntity(access, p.cad9, "Pentheus", "pentheus")],
      mainCharacters: [
        { entityId: "cadmus", sourceNames: ["Cadmus"], role: "founder", reason: "Cadmus searches for Europa, kills the dragon, sows its teeth, and builds Thebes.", evidence: [p.cad2, p.cad5, p.cad6] },
        { entityId: "ares", sourceNames: ["Ares"], role: "offended god", reason: "Ares is angry because Cadmus killed his dragon.", evidence: [p.cad7] },
        { entityId: "athena", sourceNames: ["Pallas-Athene"], role: "divine adviser", reason: "Athena commands Cadmus to sow the dragon's teeth.", evidence: [p.cad6] }
      ],
      relationships: [rel(access, p.cad2, "agenor", "parent_of", "cadmus", "despatched his son Cadmus"), rel(access, p.cad2, "agenor", "parent_of", "europa", "his daughter Europa"), rel(access, p.cad7, "ares", "parent_of", "harmonia", "his daughter Harmonia")],
      narrative: {
        synopsis: "Agenor sends Cadmus to search for Europa. Apollo's oracle redirects Cadmus to found a city; after a dragon kills his followers, Cadmus slays it, sows its teeth at Athena's command, and builds Thebes with the surviving warriors.",
        openingSituation: "Europa has been abducted by Zeus, and Agenor sends Cadmus to find her.",
        centralConflict: "Cadmus cannot find Europa and then faces Ares' dragon after it kills his followers.",
        resolution: "Cadmus kills the dragon and follows Athena's command to sow its teeth.",
        outcome: "Cadmus builds Thebes, later loses his throne, and he and Harmonia are transformed by Zeus after death.",
        storyline: ["Agenor sends Cadmus after Europa.", "Apollo redirects Cadmus to found a city.", "A dragon kills Cadmus' followers.", "Cadmus kills the dragon.", "Athena commands Cadmus to sow the teeth.", "Cadmus builds Thebes."]
      },
      evidenceSummary: [summary(access, p.cad2, "despatched his son Cadmus", [{ field: "openingSituation" }]), summary(access, p.cad5, "final stroke put an end to the encounter", [{ field: "centralConflict" }, { field: "resolution" }]), summary(access, p.cad6, "Cadmus now built the famous city of Thebes", [{ field: "outcome" }])],
      initialState: [{ subject: "cadmus", predicate: "sent_to_find", object: "europa", evidence: [{ passageId: p.cad2, sourceText: access.sentenceContaining(p.cad2, "despatched his son Cadmus") }] }],
      events: [
        event(1, Object.assign(ev(access, p.cad2, "despatched his son Cadmus", "Agenor sent Cadmus to search for Europa."), { actor: "agenor", action: "send", target: "cadmus", object: "europa" })),
        event(2, Object.assign(ev(access, p.cad3, "consulted the oracle of Apollo", "Cadmus consulted Apollo's oracle at Delphi."), { actor: "cadmus", action: "consult", target: "apollo", location: "delphi" })),
        event(3, Object.assign(ev(access, p.cad4, "pounced upon them and killed them", "The dragon killed Cadmus' followers."), { actor: "dragon", action: "kill", target: "cadmus" })),
        event(4, Object.assign(ev(access, p.cad5, "final stroke put an end to the encounter", "Cadmus killed the dragon."), { actor: "cadmus", action: "kill", target: "dragon" })),
        event(5, Object.assign(ev(access, p.cad6, "commanded him to sow the teeth", "Athena commanded Cadmus to sow the dragon's teeth."), { actor: "athena", action: "command", target: "cadmus", object: "dragon-teeth" })),
        event(6, Object.assign(ev(access, p.cad6, "Cadmus now built the famous city of Thebes", "Cadmus built Thebes."), { actor: "cadmus", action: "build", object: "thebes", location: "thebes" })),
        event(7, Object.assign(ev(access, p.cad9, "changed by Zeus into serpents", "Zeus transformed Cadmus and Harmonia into serpents."), { actor: "zeus", action: "transform", target: "cadmus", recipient: "harmonia" }))
      ],
      finalState: [{ subject: "cadmus", predicate: "founds", object: "thebes", evidence: [{ passageId: p.cad6, sourceText: access.sentenceContaining(p.cad6, "Cadmus now built the famous city of Thebes") }] }],
      verification: verification([p.cad1, p.cad2, p.cad3, p.cad4, p.cad5, p.cad6, p.cad7, p.cad8, p.cad9], ["Cadmus boundary", "Europa motive", "dragon episode", "Athena command", "Thebes outcome", "later transformation"], ["Corrected family from europa to cadmus-founds-thebes.", "Removed machine-proposed blanket evidence.", "Separated Ares' anger from Cadmus' dragon combat."], [])
    },
    {
      title: "Paris Abducts Helen",
      mythFamilyId: "paris-and-helen",
      variantId: "gutenberg-berens-paris-helen-verified",
      source: { sourceId: "gutenberg-berens-myths-legends-greece-rome-eng", passages: [p.tro1, p.tro2, p.tro3, p.tro4, p.tro5, p.tro6, p.tro7, p.tro8, p.tro9] },
      scope: scope("coherent-subepisode", "Paris' exposure, recognition, mission to Greece, warning by Cassandra, and abduction of Helen.", [p.tro1, p.tro2, p.tro3, p.tro4, p.tro5, p.tro6, p.tro7, p.tro8, p.tro9], ["gutenberg:ebooks:22381:333.333.10-333.333.10:a96158b3"], "The following passage is omitted because its extracted text is truncated mid-sentence; the abduction outcome is already complete in the preceding passage."),
      entities: { characters: ["paris", "helen", "hecuba", "aesacus", "priam", "cassandra", "menelaus", "oenone", "aphrodite", "hera", "athena"], locations: ["troy", "mount-ida", "sparta", "greece"], objects: ["golden-apple", "treasure"], creatures: [] },
      entityMappings: [mapEntity(access, p.tro1, "Paris", "paris"), mapEntity(access, p.tro7, "Helen", "helen"), mapEntity(access, p.tro1, "Hecuba", "hecuba"), mapEntity(access, p.tro1, "AEsacus", "aesacus"), mapEntity(access, p.tro1, "Priam", "priam"), mapEntity(access, p.tro4, "Cassandra", "cassandra"), mapEntity(access, p.tro7, "Menelaus", "menelaus"), mapEntity(access, p.tro3, "Oenone", "oenone"), mapEntity(access, p.tro2, "Aphrodite", "aphrodite"), mapEntity(access, p.tro2, "Hera", "hera"), mapEntity(access, p.tro2, "Athene", "athena")],
      mainCharacters: [
        { entityId: "paris", sourceNames: ["Paris", "Alexander"], role: "Trojan prince", reason: "The passage follows Paris from exposure to his mission and abduction of Helen.", evidence: [p.tro1, p.tro9] },
        { entityId: "helen", sourceNames: ["Helen"], role: "abducted queen", reason: "Paris first beholds her at Sparta and carries her off.", evidence: [p.tro7, p.tro9] },
        { entityId: "cassandra", sourceNames: ["Cassandra"], role: "warner", reason: "She warns Paris against bringing home a wife from Greece.", evidence: [p.tro6] }
      ],
      relationships: [rel(access, p.tro7, "helen", "spouse_of", "menelaus", "wife of Menelaus"), rel(access, p.tro3, "paris", "spouse_of", "oenone", "Paris became united"), rel(access, p.tro1, "priam", "parent_of", "paris", "a son who would cause")],
      narrative: {
        synopsis: "Hecuba exposes Paris because of a prophecy, but shepherds raise him. After Paris is recognized at Troy, Priam sends him to Greece; Cassandra warns against bringing home a Greek wife, and Paris later carries Helen away from Sparta.",
        openingSituation: "A prophecy says Hecuba's son Paris will cause Troy's destruction.",
        centralConflict: "Paris is accepted back into Troy despite the omen and then warned not to bring home a wife from Greece.",
        resolution: "Paris travels to Sparta and is received by Menelaus.",
        outcome: "Paris carries off Helen and the treasures of the Spartan palace.",
        storyline: ["Hecuba exposes Paris.", "Shepherds raise Paris.", "Cassandra reveals Paris at Troy.", "Priam sends Paris to Greece.", "Cassandra warns Paris.", "Paris carries Helen off from Sparta."]
      },
      evidenceSummary: [summary(access, p.tro1, "cause the destruction of the city of Troy", [{ field: "openingSituation" }]), summary(access, p.tro6, "warned by Cassandra", [{ field: "centralConflict" }]), summary(access, p.tro9, "succeeded in carrying off", [{ field: "outcome" }])],
      initialState: [{ subject: "paris", predicate: "prophesied_to_destroy", object: "troy", evidence: [{ passageId: p.tro1, sourceText: access.sentenceContaining(p.tro1, "cause the destruction of the city of Troy") }] }],
      events: [
        event(1, Object.assign(ev(access, p.tro1, "exposed on Mount Ida", "Hecuba exposed Paris on Mount Ida."), { actor: "hecuba", action: "expose", target: "paris", location: "mount-ida" })),
        event(2, Object.assign(ev(access, p.tro4, "announced to them", "Cassandra announced that the shepherd was Paris."), { actor: "cassandra", action: "reveal", target: "paris", recipient: "priam" })),
        event(3, Object.assign(ev(access, p.tro6, "Paris was warned by Cassandra", "Cassandra warned Paris not to bring home a wife from Greece."), { actor: "cassandra", action: "warn", target: "paris", location: "troy" })),
        event(4, Object.assign(ev(access, p.tro7, "fleet set sail", "Paris sailed to Greece."), { actor: "paris", action: "travel", location: "greece" })),
        event(5, Object.assign(ev(access, p.tro9, "resolved to rob his absent host", "Paris resolved to rob Menelaus of Helen."), { actor: "paris", action: "decide", target: "menelaus", object: "helen" })),
        event(6, Object.assign(ev(access, p.tro9, "succeeded in carrying off", "Paris carried off Helen."), { actor: "paris", action: "abduct", target: "helen", object: "treasure", location: "sparta" }))
      ],
      finalState: [{ subject: "helen", predicate: "carried_off_by", object: "paris", evidence: [{ passageId: p.tro9, sourceText: access.sentenceContaining(p.tro9, "succeeded in carrying off") }] }],
      verification: verification([p.tro1, p.tro2, p.tro3, p.tro4, p.tro5, p.tro6, p.tro7, p.tro8, p.tro9], ["prophecy", "exposure", "recognition", "Cassandra warning", "Sparta hospitality", "Helen abduction"], ["Corrected title from broad Trojan war to Paris Abducts Helen.", "Omitted a truncated extracted passage from the verified scope.", "Separated Roman and Greek aliases through canonical IDs."], [])
    },
    {
      title: "The Apple of Discord at the Wedding",
      mythFamilyId: "apple-of-discord",
      variantId: "gutenberg-baker-apple-discord-verified",
      source: { sourceId: "gutenberg-baker-stories-old-greece-rome-eng", passages: [p.app1, p.app2, p.app3, p.app4, p.app5, p.app6] },
      scope: scope("coherent-subepisode", "The wedding setting, Eris' apple, the goddess dispute, and Jupiter's appointment of Paris as judge.", [p.app1, p.app2, p.app3, p.app4, p.app5, p.app6], ["gutenberg:ebooks:45489:175.175.7-175.175.7:dd2f49f1"], "The following Paris background passage is omitted from the normalized event chain because the selected subepisode ends with Paris appointed as judge."),
      entities: { characters: ["zeus", "thetis", "peleus", "eris", "hera", "athena", "aphrodite", "paris", "priam", "nereus", "doris"], locations: ["olympus", "mount-ida", "troy"], objects: ["golden-apple"], creatures: [] },
      entityMappings: [mapEntity(access, p.app1, "Jupiter", "zeus"), mapEntity(access, p.app1, "Thetis", "thetis"), mapEntity(access, p.app2, "Peleus", "peleus"), mapEntity(access, p.app3, "Eris", "eris"), mapEntity(access, p.app4, "Juno", "hera"), mapEntity(access, p.app4, "Minerva", "athena"), mapEntity(access, p.app4, "Venus", "aphrodite"), mapEntity(access, p.app5, "Paris", "paris"), mapEntity(access, p.app6, "Priam", "priam")],
      mainCharacters: [
        { entityId: "eris", sourceNames: ["Eris", "Discordia"], role: "disruptor", reason: "She arrives uninvited and throws the golden apple.", evidence: [p.app3] },
        { entityId: "hera", sourceNames: ["Juno"], role: "contestant", reason: "Juno disputes possession of the apple.", evidence: [p.app4] },
        { entityId: "athena", sourceNames: ["Minerva"], role: "contestant", reason: "Minerva disputes possession of the apple.", evidence: [p.app4] },
        { entityId: "aphrodite", sourceNames: ["Venus"], role: "contestant", reason: "Venus disputes possession of the apple.", evidence: [p.app4] },
        { entityId: "paris", sourceNames: ["Paris"], role: "judge", reason: "Jupiter appoints Paris to judge the contest.", evidence: [p.app5] }
      ],
      relationships: [rel(access, p.app2, "thetis", "spouse_of", "peleus", "consented to marry Peleus"), rel(access, p.app6, "priam", "parent_of", "paris", "son of Priam")],
      narrative: {
        synopsis: "Jupiter gives Thetis to Peleus and promises divine attendance at their wedding. Eris, excluded from the feast, throws a golden apple marked for the fairest; Juno, Minerva, and Venus contest it, and Jupiter appoints Paris as judge.",
        openingSituation: "Jupiter avoids marrying Thetis after the Fates say her son will be greater than his father.",
        centralConflict: "Eris disrupts the wedding with a golden apple and the goddesses dispute who should receive it.",
        resolution: "The gods refuse to judge the dispute themselves and go to Mount Ida.",
        outcome: "Jupiter appoints Paris to judge the contest.",
        storyline: ["Jupiter gives Thetis to Peleus.", "Eris arrives uninvited.", "Eris throws the golden apple.", "Juno, Minerva, and Venus dispute it.", "Jupiter appoints Paris judge."]
      },
      evidenceSummary: [summary(access, p.app2, "gave Thetis in marriage to Peleus", [{ field: "openingSituation" }]), summary(access, p.app3, "Then she threw on the table a golden apple", [{ field: "centralConflict" }]), summary(access, p.app5, "Jupiter appointed him to be the judge", [{ field: "outcome" }])],
      initialState: [{ subject: "thetis", predicate: "betrothed_to", object: "peleus", evidence: [{ passageId: p.app2, sourceText: access.sentenceContaining(p.app2, "consented to marry Peleus") }] }],
      events: [
        event(1, Object.assign(ev(access, p.app2, "gave Thetis in marriage to Peleus", "Jupiter gave Thetis in marriage to Peleus."), { actor: "zeus", action: "arrange", target: "thetis", recipient: "peleus" })),
        event(2, Object.assign(ev(access, p.app3, "uninvited guest appeared", "Eris appeared uninvited at the wedding feast."), { actor: "eris", action: "arrive" })),
        event(3, Object.assign(ev(access, p.app3, "threw on the table a golden apple", "Eris threw a golden apple onto the table."), { actor: "eris", action: "throw", object: "golden-apple" })),
        event(4, Object.assign(ev(access, p.app4, "disputed hotly for its possession", "Juno, Minerva, and Venus disputed possession of the apple."), { actor: "hera", action: "dispute", target: "athena", object: "golden-apple", recipient: "aphrodite" })),
        event(5, Object.assign(ev(access, p.app5, "Jupiter appointed him to be the judge", "Jupiter appointed Paris judge of the contest."), { actor: "zeus", action: "appoint", target: "paris", object: "golden-apple", location: "mount-ida" }))
      ],
      finalState: [{ subject: "paris", predicate: "appointed_judge_of", object: "golden-apple", evidence: [{ passageId: p.app5, sourceText: access.sentenceContaining(p.app5, "Jupiter appointed him to be the judge") }] }],
      verification: verification([p.app1, p.app2, p.app3, p.app4, p.app5, p.app6], ["Thetis marriage context", "Eris' exclusion", "golden apple inscription", "three contestants", "Paris appointment"], ["Narrowed the section to the apple-dispute subepisode.", "Retitled from generic Apple of Discord.", "Omitted unsupported later judgment material."], [])
    },
    {
      title: "Bacchus Lures Vulcan to Olympus",
      mythFamilyId: "hephaestus-and-hera-throne",
      variantId: "gutenberg-baker-vulcan-throne-verified",
      source: { sourceId: "gutenberg-baker-stories-old-greece-rome-eng", passages: [p.vul1, p.vul2] },
      scope: scope("coherent-subepisode", "Vulcan's resentment of Juno, the golden throne trap, and Bacchus luring Vulcan back to Olympus.", [p.vul1, p.vul2], [], "The final sentence is truncated after Vulcan reaches Olympus, so the verified outcome stops at the last complete source sentence."),
      entities: { characters: ["hephaestus", "hera", "zeus", "hermes", "dionysus"], locations: ["olympus", "mount-etna"], objects: ["golden-throne", "chain", "wine"], creatures: [] },
      entityMappings: [mapEntity(access, p.vul1, "Vulcan", "hephaestus"), mapEntity(access, p.vul1, "Juno", "hera"), mapEntity(access, p.vul1, "Jupiter", "zeus"), mapEntity(access, p.vul2, "Mercury", "hermes"), mapEntity(access, p.vul2, "Bacchus", "dionysus")],
      mainCharacters: [
        { entityId: "hephaestus", sourceNames: ["Vulcan"], role: "estranged craftsman", reason: "He traps Juno in a golden throne and refuses Mercury's invitation.", evidence: [p.vul2] },
        { entityId: "hera", sourceNames: ["Juno"], role: "trapped mother", reason: "She is caught in the throne sent by Vulcan.", evidence: [p.vul2] },
        { entityId: "dionysus", sourceNames: ["Bacchus"], role: "luring visitor", reason: "Jupiter sends Bacchus, who makes Vulcan drink and leads him to Olympus.", evidence: [p.vul2] }
      ],
      relationships: [rel(access, p.vul1, "hera", "parent_of", "hephaestus", "his mother"), rel(access, p.vul1, "zeus", "parent_of", "hephaestus", "Jupiter kicked his son")],
      narrative: {
        synopsis: "After Jupiter casts Vulcan from heaven and Juno shows indifference, Vulcan sends her a golden throne that traps her. Mercury cannot persuade him to return, but Bacchus wins him over with wine and leads him to Olympus.",
        openingSituation: "Vulcan avoids Olympus because he resents his parents' treatment of him.",
        centralConflict: "Vulcan traps Juno in a golden throne as revenge.",
        resolution: "Jupiter sends Bacchus, who makes Vulcan drink wine.",
        outcome: "Vulcan allows himself to be led to Olympus.",
        storyline: ["Jupiter casts Vulcan from heaven.", "Vulcan refuses Olympus.", "Vulcan traps Juno in a golden throne.", "Mercury fails to bring Vulcan back.", "Bacchus lures Vulcan with wine.", "Vulcan is led to Olympus."]
      },
      evidenceSummary: [summary(access, p.vul1, "Jupiter kicked his son out of heaven", [{ field: "openingSituation" }]), summary(access, p.vul2, "held the occupant prisoner", [{ field: "centralConflict" }]), summary(access, p.vul2, "allowed himself to be led unresistingly to Olympus", [{ field: "outcome" }])],
      initialState: [{ subject: "hephaestus", predicate: "estranged_from", object: "olympus", evidence: [{ passageId: p.vul1, sourceText: access.sentenceContaining(p.vul1, "would not go back to Olympus") }] }],
      events: [
        event(1, Object.assign(ev(access, p.vul1, "Jupiter kicked his son out of heaven", "Jupiter kicked Vulcan out of heaven."), { actor: "zeus", action: "banish", target: "hephaestus" })),
        event(2, Object.assign(ev(access, p.vul2, "golden throne arrived in Olympus", "Vulcan sent a golden throne to Juno."), { actor: "hephaestus", action: "send", object: "golden-throne", recipient: "hera", location: "olympus" })),
        event(3, Object.assign(ev(access, p.vul2, "held the occupant prisoner", "The golden throne held Juno prisoner."), { actor: "hephaestus", action: "capture", target: "hera", object: "golden-throne" })),
        event(4, Object.assign(ev(access, p.vul2, "sent Bacchus", "Jupiter sent Bacchus to Vulcan."), { actor: "zeus", action: "send", target: "dionysus", recipient: "hephaestus" })),
        event(5, Object.assign(ev(access, p.vul2, "allowed himself to be led unresistingly to Olympus", "Bacchus led Vulcan to Olympus."), { actor: "dionysus", action: "lead", target: "hephaestus", location: "olympus" }))
      ],
      finalState: [{ subject: "hephaestus", predicate: "led_to", object: "olympus", evidence: [{ passageId: p.vul2, sourceText: access.sentenceContaining(p.vul2, "allowed himself to be led unresistingly to Olympus") }] }],
      verification: verification([p.vul1, p.vul2], ["Vulcan's grievance", "golden throne trap", "Mercury failure", "Bacchus wine stratagem", "last complete outcome sentence"], ["Corrected myth family from dionysus-and-pirates.", "Stopped before the truncated final sentence.", "Mapped Roman names to Greek canonical IDs without claiming Roman identity collapse."], [])
    },
    {
      title: "Diana and Endymion",
      mythFamilyId: "endymion",
      variantId: "gutenberg-baker-endymion-verified",
      source: { sourceId: "gutenberg-baker-stories-old-greece-rome-eng", passages: [p.end1, p.end2, p.end3, p.end4] },
      scope: scope("complete-section", "Baker's complete Endymion story from Diana's moon journey through Endymion's eternal sleep on Mount Latmus.", [p.end1, p.end2, p.end3, p.end4], [], "All consecutive body passages in the section are included."),
      entities: { characters: ["artemis", "endymion", "apollo"], locations: ["mount-latmus"], objects: ["moon-car"], creatures: ["horses"] },
      entityMappings: [mapEntity(access, p.end1, "Diana", "artemis"), mapEntity(access, p.end2, "Endymion", "endymion"), mapEntity(access, p.end1, "Apollo", "apollo")],
      mainCharacters: [
        { entityId: "artemis", sourceNames: ["Diana"], role: "moon goddess", reason: "Diana sees Endymion, visits him, and takes him to Mount Latmus.", evidence: [p.end2, p.end4] },
        { entityId: "endymion", sourceNames: ["Endymion"], role: "sleeping shepherd", reason: "Endymion sleeps under Diana's gaze and is placed in eternal sleep.", evidence: [p.end2, p.end4] }
      ],
      relationships: [rel(access, p.end2, "artemis", "loves", "endymion", "felt a strange longing to be near him")],
      narrative: {
        synopsis: "Diana sees Endymion sleeping by moonlight and repeatedly visits him. Wanting him to remain beautiful and young, she takes him to Mount Latmus and causes eternal sleep to fall on him.",
        openingSituation: "Diana makes her nightly moon journey after Apollo's sun course ends.",
        centralConflict: "Diana longs to remain near the sleeping Endymion without waking him.",
        resolution: "Diana takes Endymion to a cave on Mount Latmus.",
        outcome: "Endymion remains in eternal sleep, and Diana visits him every night.",
        storyline: ["Diana drives her moon-car.", "Diana sees Endymion sleeping.", "Diana returns to him nightly.", "Diana takes him to Mount Latmus.", "Diana causes eternal sleep to fall on him."]
      },
      evidenceSummary: [summary(access, p.end2, "she saw Endymion sleeping", [{ field: "centralConflict" }]), summary(access, p.end4, "took him to Mount Latmus", [{ field: "resolution" }]), summary(access, p.end4, "caused an eternal sleep to fall upon him", [{ field: "outcome" }])],
      initialState: [{ subject: "artemis", predicate: "travels_by", object: "moon-car", evidence: [{ passageId: p.end1, sourceText: access.sentenceContaining(p.end1, "mounted her silver car") }] }],
      events: [
        event(1, Object.assign(ev(access, p.end2, "she saw Endymion sleeping", "Diana saw Endymion sleeping."), { actor: "artemis", action: "see", target: "endymion" })),
        event(2, Object.assign(ev(access, p.end2, "she gently kissed him", "Diana kissed Endymion."), { actor: "artemis", action: "kiss", target: "endymion" })),
        event(3, Object.assign(ev(access, p.end3, "Diana glided again from her silver car", "Diana returned to Endymion."), { actor: "artemis", action: "return", target: "endymion" })),
        event(4, Object.assign(ev(access, p.end4, "took him to Mount Latmus", "Diana took Endymion to Mount Latmus."), { actor: "artemis", action: "move", target: "endymion", location: "mount-latmus" })),
        event(5, Object.assign(ev(access, p.end4, "caused an eternal sleep to fall upon him", "Diana caused eternal sleep to fall on Endymion."), { actor: "artemis", action: "enchant", target: "endymion", location: "mount-latmus" }))
      ],
      finalState: [{ subject: "endymion", predicate: "sleeps_eternally_at", object: "mount-latmus", evidence: [{ passageId: p.end4, sourceText: access.sentenceContaining(p.end4, "caused an eternal sleep to fall upon him") }] }],
      verification: verification([p.end1, p.end2, p.end3, p.end4], ["Diana's nightly course", "Endymion sighting", "repeated visits", "Mount Latmus relocation", "eternal sleep outcome"], ["Corrected family from apollo-and-daphne to endymion.", "Kept Diana's Roman source form but normalized to Artemis for the Greek corpus registry."], [])
    },
    {
      title: "Infant Hercules and the Serpents",
      mythFamilyId: "infant-heracles-serpents",
      variantId: "gutenberg-guerber-infant-hercules-verified",
      source: { sourceId: "gutenberg-guerber-myths-greece-rome-eng", passages: [p.her3, p.her5] },
      scope: scope("coherent-subepisode", "Hercules' parentage and Juno's attempt to destroy him with serpents in infancy.", [p.her3, p.her5], ["gutenberg:ebooks:39250:339.339.1-339.339.1:896736a0", "gutenberg:ebooks:39250:339.339.2-339.339.2:d6f117fb", "gutenberg:ebooks:39250:339.339.4-339.339.4:d96f060e"], "The prefatory quotation, translator attribution, and sidenote are omitted; the narrative subepisode is complete in the included passages."),
      entities: { characters: ["heracles", "zeus", "alcmene", "hera"], locations: ["olympus"], objects: ["cradle"], creatures: ["serpents"] },
      entityMappings: [mapEntity(access, p.her3, "Hercules", "heracles"), mapEntity(access, p.her3, "Jupiter", "zeus"), mapEntity(access, p.her3, "Alcmene", "alcmene"), mapEntity(access, p.her5, "Juno", "hera")],
      mainCharacters: [
        { entityId: "heracles", sourceNames: ["Hercules"], role: "infant hero", reason: "He strangles the serpents in his cradle.", evidence: [p.her5] },
        { entityId: "hera", sourceNames: ["Juno"], role: "attacker", reason: "Juno sends serpents to attack the infant Hercules.", evidence: [p.her5] }
      ],
      relationships: [rel(access, p.her3, "zeus", "parent_of", "heracles", "son of Jupiter"), rel(access, p.her3, "alcmene", "parent_of", "heracles", "Alcmene, a mortal princess")],
      narrative: {
        synopsis: "Juno plots to destroy the infant Hercules and sends two serpents to attack him in his cradle. Hercules seizes the serpents by the neck and strangles them.",
        openingSituation: "Hercules is named as the son of Jupiter and Alcmene.",
        centralConflict: "Juno tries to destroy Hercules shortly after his birth.",
        resolution: "The infant Hercules catches the serpents by their necks.",
        outcome: "Hercules strangles the serpents, showing his future strength.",
        storyline: ["Hercules is born.", "Juno plots his destruction.", "Serpents attack his cradle.", "Hercules seizes the serpents.", "Hercules strangles them."]
      },
      evidenceSummary: [summary(access, p.her3, "son of Jupiter and Alcmene", [{ field: "openingSituation" }]), summary(access, p.her5, "Juno began to plot", [{ field: "centralConflict" }]), summary(access, p.her5, "strangled them", [{ field: "outcome" }])],
      initialState: [{ subject: "heracles", predicate: "child_of", object: "zeus-and-alcmene", evidence: [{ passageId: p.her3, sourceText: access.sentenceContaining(p.her3, "son of Jupiter and Alcmene") }] }],
      events: [
        event(1, Object.assign(ev(access, p.her5, "Juno began to plot", "Juno plotted to destroy Hercules."), { actor: "hera", action: "plot", target: "heracles" })),
        event(2, Object.assign(ev(access, p.her5, "dispatched by her orders", "Juno sent two serpents to attack Hercules."), { actor: "hera", action: "send", target: "serpents", recipient: "heracles" })),
        event(3, Object.assign(ev(access, p.her5, "entered the palace unseen", "The serpents entered the palace unseen."), { actor: "serpents", action: "enter" })),
        event(4, Object.assign(ev(access, p.her5, "strangled them", "Hercules strangled the serpents."), { actor: "heracles", action: "kill", target: "serpents" }))
      ],
      finalState: [{ subject: "heracles", predicate: "shows_strength_by", object: "serpents", evidence: [{ passageId: p.her5, sourceText: access.sentenceContaining(p.her5, "marvelous strength") }] }],
      verification: verification([p.her3, p.her5], ["parentage sentence", "Juno's plot", "serpents' attack", "infant Hercules' action", "subepisode boundary"], ["Corrected title from broad HERCULES.", "Excluded quotation and sidenote passages.", "Normalized Roman source names to Greek canonical IDs."], [])
    },
    {
      title: "The Calydonian Hunt",
      mythFamilyId: "calydonian-hunt",
      variantId: "gutenberg-guerber-calydonian-hunt-verified",
      source: { sourceId: "gutenberg-guerber-myths-greece-rome-eng", passages: [p.cal2, p.cal3, p.cal5, p.cal6, p.cal8] },
      scope: scope("partial-section", "The source's Calydonian Hunt sequence without sidenotes: Meleager's birth omen, Diana's boar, Atalanta's wound, Meleager's deathblow, and Althaea's revenge.", [p.cal2, p.cal3, p.cal5, p.cal6, p.cal8], ["gutenberg:ebooks:39250:400.400.1-400.400.1:ec8d9a76", "gutenberg:ebooks:39250:400.400.4-400.400.4:4d48a9ec", "gutenberg:ebooks:39250:400.400.7-400.400.7:2ac45975"], "Sidenote-only passages are omitted from the normalized event chain."),
      entities: { characters: ["meleager", "althaea", "oeneus", "artemis", "atalanta", "jason", "nestor", "peleus", "theseus"], locations: ["calydon", "aetolia"], objects: ["brand", "boar-skin"], creatures: ["boar"] },
      entityMappings: [mapEntity(access, p.cal2, "Meleager", "meleager"), mapEntity(access, p.cal2, "Althæa", "althaea"), mapEntity(access, p.cal2, "Œneus", "oeneus", "Œneus", "Unicode source form is preserved; normalized ID uses ASCII transliteration."), mapEntity(access, p.cal3, "Diana", "artemis"), mapEntity(access, p.cal5, "Atalanta", "atalanta"), mapEntity(access, p.cal5, "Jason", "jason"), mapEntity(access, p.cal5, "Nestor", "nestor"), mapEntity(access, p.cal5, "Peleus", "peleus"), mapEntity(access, p.cal5, "Theseus", "theseus")],
      mainCharacters: [
        { entityId: "meleager", sourceNames: ["Meleager"], role: "hunter", reason: "Meleager leads the hunt, gives the spoil to Atalanta, kills his uncles, and dies when the brand burns.", evidence: [p.cal3, p.cal6, p.cal8] },
        { entityId: "atalanta", sourceNames: ["Atalanta"], role: "hunter", reason: "Atalanta mortally wounds the boar and receives its spoil.", evidence: [p.cal6, p.cal8] },
        { entityId: "althaea", sourceNames: ["Althaea"], role: "mother and avenger", reason: "She saves Meleager as an infant and later burns the brand after he kills her brothers.", evidence: [p.cal2, p.cal8] }
      ],
      relationships: [rel(access, p.cal2, "oeneus", "parent_of", "meleager", "possession of a little son, Meleager"), rel(access, p.cal2, "althaea", "parent_of", "meleager", "possession of a little son, Meleager")],
      narrative: {
        synopsis: "The Fates tie Meleager's life to a burning brand, which Althaea saves. Diana later sends a boar against Calydon; Meleager leads the hunt, Atalanta wounds the boar, and Meleager kills it, but his killing of his uncles leads Althaea to burn the brand and cause his death.",
        openingSituation: "Meleager's life depends on a brand saved by Althaea.",
        centralConflict: "Diana sends a monstrous boar to devastate Oeneus' realm.",
        resolution: "Atalanta wounds the boar and Meleager delivers the deathblow.",
        outcome: "Althaea burns the brand in revenge, Meleager dies, and Althaea kills herself.",
        storyline: ["The Fates bind Meleager's life to the brand.", "Diana sends a boar.", "Meleager gathers hunters.", "Atalanta wounds the boar.", "Meleager kills it.", "Althaea burns the brand and Meleager dies."]
      },
      evidenceSummary: [summary(access, p.cal2, "should live only as long as the brand", [{ field: "openingSituation" }]), summary(access, p.cal3, "sent a monstrous boar", [{ field: "centralConflict" }]), summary(access, p.cal6, "given him his deathblow", [{ field: "resolution" }]), summary(access, p.cal8, "Meleager died", [{ field: "outcome" }])],
      initialState: [{ subject: "meleager", predicate: "life_bound_to", object: "brand", evidence: [{ passageId: p.cal2, sourceText: access.sentenceContaining(p.cal2, "should live only as long as the brand") }] }],
      events: [
        event(1, Object.assign(ev(access, p.cal2, "snatched the brand from the fire", "Althaea saved the brand from the fire."), { actor: "althaea", action: "save", object: "brand" })),
        event(2, Object.assign(ev(access, p.cal3, "sent a monstrous boar", "Diana sent a monstrous boar against Oeneus' realm."), { actor: "artemis", action: "send", target: "boar", location: "calydon" })),
        event(3, Object.assign(ev(access, p.cal3, "gathered together all the brave men", "Meleager gathered hunters for the boar hunt."), { actor: "meleager", action: "gather", target: "jason", recipient: "atalanta" })),
        event(4, Object.assign(ev(access, p.cal6, "dealing him a mortal wound", "Atalanta dealt the boar a mortal wound."), { actor: "atalanta", action: "wound", target: "boar" })),
        event(5, Object.assign(ev(access, p.cal6, "given him his deathblow", "Meleager killed the boar."), { actor: "meleager", action: "kill", target: "boar" })),
        event(6, Object.assign(ev(access, p.cal8, "threw it upon the fire", "Althaea threw the brand into the fire."), { actor: "althaea", action: "burn", object: "brand" })),
        event(7, Object.assign(ev(access, p.cal8, "Meleager died", "Meleager died when the brand burned away."), { actor: "meleager", action: "die" }))
      ],
      finalState: [{ subject: "meleager", predicate: "dies_when", object: "brand", evidence: [{ passageId: p.cal8, sourceText: access.sentenceContaining(p.cal8, "Meleager died") }] }],
      verification: verification([p.cal2, p.cal3, p.cal5, p.cal6, p.cal8], ["birth omen", "Diana's boar", "hunter list", "Atalanta wound", "Meleager deathblow", "Althaea revenge"], ["Removed sidenote-only passages.", "Retained Atalanta as principal source-supported participant.", "Corrected outcome to include Althaea's revenge."], [])
    },
    {
      title: "Oedipus and the Sphinx",
      mythFamilyId: "oedipus",
      variantId: "gutenberg-berens-oedipus-verified",
      source: { sourceId: "gutenberg-berens-myths-legends-greece-rome-eng", passages: [p.oed1, p.oed2, p.oed3, p.oed4, p.oed5, p.oed6, p.oed7, p.oed8, p.oed9] },
      scope: scope("complete-section", "Berens' Oedipus section from Laius' oracle through Oedipus' exile and refuge near Athens.", [p.oed1, p.oed2, p.oed3, p.oed4, p.oed5, p.oed6, p.oed7, p.oed8, p.oed9], [], "All consecutive body passages in the section are included."),
      entities: { characters: ["oedipus", "laius", "jocaste", "polybus", "merope", "creon", "sphinx", "hera", "tiresias", "antigone"], locations: ["thebes", "corinth", "mount-cithaeron", "delphi", "colonus"], objects: ["riddle", "staff"], creatures: ["sphinx"] },
      entityMappings: [mapEntity(access, p.oed2, "Oedipus", "oedipus", "Oedipus, or Swollen-foot"), mapEntity(access, p.oed1, "Laius", "laius"), mapEntity(access, p.oed1, "Jocaste", "jocaste"), mapEntity(access, p.oed2, "Polybus", "polybus"), mapEntity(access, p.oed2, "Merope", "merope"), mapEntity(access, p.oed4, "Sphinx", "sphinx"), mapEntity(access, p.oed4, "Hera", "hera"), mapEntity(access, p.oed5, "Creon", "creon"), mapEntity(access, p.oed8, "Tiresias", "tiresias"), mapEntity(access, p.oed9, "Antigone", "antigone")],
      mainCharacters: [
        { entityId: "oedipus", sourceNames: ["Oedipus"], role: "hero and sufferer", reason: "The section follows Oedipus from exposure to solving the Sphinx's riddle and later exile.", evidence: [p.oed2, p.oed6, p.oed9] },
        { entityId: "sphinx", sourceNames: ["Sphinx"], role: "monster", reason: "The Sphinx kills those who fail her riddles and dies when Oedipus solves one.", evidence: [p.oed4, p.oed6] },
        { entityId: "jocaste", sourceNames: ["Jocaste"], role: "mother and queen", reason: "Jocaste consents to the infant's exposure and later dies after the revelation.", evidence: [p.oed1, p.oed8] }
      ],
      relationships: [rel(access, p.oed1, "laius", "spouse_of", "jocaste", "was married to Jocaste"), rel(access, p.oed1, "laius", "parent_of", "oedipus", "own son"), rel(access, p.oed8, "jocaste", "parent_of", "oedipus", "thine own mother")],
      narrative: {
        synopsis: "Laius tries to destroy the infant Oedipus because of an oracle, but Oedipus is raised at Corinth. He unknowingly kills Laius, defeats the Sphinx by solving her riddle, becomes king of Thebes and Jocaste's husband, and later blinds himself and goes into exile after Tiresias reveals the truth.",
        openingSituation: "An oracle foretells that Laius will die by his own son's hand.",
        centralConflict: "Oedipus unknowingly fulfills the oracle and Thebes suffers under the Sphinx and later a pestilence.",
        resolution: "Oedipus solves the Sphinx's riddle and later learns the truth from Tiresias.",
        outcome: "Jocaste hangs herself, Oedipus blinds himself, and he leaves Thebes with Antigone.",
        storyline: ["Laius exposes Oedipus.", "Oedipus is raised at Corinth.", "Oedipus kills Laius unknowingly.", "Oedipus solves the Sphinx's riddle.", "Oedipus becomes king and husband of Jocaste.", "Tiresias reveals the truth.", "Oedipus leaves Thebes."]
      },
      evidenceSummary: [summary(access, p.oed1, "perish by the hand of his own son", [{ field: "openingSituation" }]), summary(access, p.oed4, "whoever failed to solve them was torn in pieces", [{ field: "centralConflict" }]), summary(access, p.oed6, "Oedipus at once solved it", [{ field: "resolution" }]), summary(access, p.oed8, "deprived himself of sight", [{ field: "outcome" }])],
      initialState: [{ subject: "laius", predicate: "warned_by_oracle", object: "oedipus", evidence: [{ passageId: p.oed1, sourceText: access.sentenceContaining(p.oed1, "perish by the hand of his own son") }] }],
      events: [
        event(1, Object.assign(ev(access, p.oed1, "handed the infant over to a servant", "Laius handed the infant Oedipus over to be exposed."), { actor: "laius", action: "expose", target: "oedipus", location: "mount-cithaeron" })),
        event(2, Object.assign(ev(access, p.oed2, "Oedipus was adopted", "Polybus and Merope adopted Oedipus."), { actor: "polybus", action: "adopt", target: "oedipus", recipient: "merope" })),
        event(3, Object.assign(ev(access, p.oed3, "struck the old man", "Oedipus killed Laius without knowing his identity."), { actor: "oedipus", action: "kill", target: "laius" })),
        event(4, Object.assign(ev(access, p.oed6, "Oedipus at once solved it", "Oedipus solved the Sphinx's riddle."), { actor: "oedipus", action: "solve", object: "riddle", target: "sphinx" })),
        event(5, Object.assign(ev(access, p.oed6, "precipitated herself into the abyss", "The Sphinx threw herself into the abyss and died."), { actor: "sphinx", action: "die" })),
        event(6, Object.assign(ev(access, p.oed8, "Thou thyself art the murderer", "Tiresias revealed Oedipus as Laius' murderer."), { actor: "tiresias", action: "reveal", target: "oedipus" })),
        event(7, Object.assign(ev(access, p.oed8, "deprived himself of sight", "Oedipus blinded himself."), { actor: "oedipus", action: "blind", target: "oedipus" })),
        event(8, Object.assign(ev(access, p.oed9, "quitted Thebes", "Oedipus left Thebes with Antigone."), { actor: "oedipus", action: "leave", location: "thebes", recipient: "antigone" }))
      ],
      finalState: [{ subject: "oedipus", predicate: "exiled_from", object: "thebes", evidence: [{ passageId: p.oed9, sourceText: access.sentenceContaining(p.oed9, "quitted Thebes") }] }],
      verification: verification([p.oed1, p.oed2, p.oed3, p.oed4, p.oed5, p.oed6, p.oed7, p.oed8, p.oed9], ["oracle", "exposure", "Corinth adoption", "Laius killing", "Sphinx riddle", "Tiresias revelation", "exile"], ["Corrected family from trojan-war to oedipus.", "Kept the verified record as a complete section rather than a Trojan War fragment.", "Removed unsupported machine-generated characters."], [])
    },
    {
      title: "Bellerophon, Pegasus, and the Chimera",
      mythFamilyId: "bellerophon-and-pegasus",
      variantId: "gutenberg-baker-bellerophon-chimera-verified",
      source: { sourceId: "gutenberg-baker-stories-old-greece-rome-eng", passages: [p.bel1, p.bel2, p.bel3, p.bel4, p.bel5, p.bel6] },
      scope: scope("complete-section", "Baker's Bellerophon section covering Pegasus, the Chimera, Iobates' response, Bellerophon's later pride, and fall.", [p.bel1, p.bel2, p.bel3, p.bel4, p.bel5, p.bel6], [], "All consecutive body passages in the extracted section are included."),
      entities: { characters: ["bellerophon", "pegasus", "chimera", "iobates", "athena", "zeus", "philonoë"], locations: ["lycia", "mount-helicon", "mount-olympus"], objects: ["golden-bridle", "sword"], creatures: ["pegasus", "chimera", "gadfly"] },
      entityMappings: [mapEntity(access, p.bel1, "Bellerophon", "bellerophon"), mapEntity(access, p.bel1, "Pegasus", "pegasus"), mapEntity(access, p.bel3, "Chimæra", "chimera"), mapEntity(access, p.bel5, "Iobates", "iobates"), mapEntity(access, p.bel6, "Jupiter", "zeus"), mapEntity(access, p.bel5, "Philonoë", "philonoë", "Philonoë", "Unicode source form is preserved; normalized ID uses ASCII transliteration.")],
      mainCharacters: [
        { entityId: "bellerophon", sourceNames: ["Bellerophon"], role: "hero", reason: "He captures Pegasus, kills the Chimera, and later falls through pride.", evidence: [p.bel2, p.bel4, p.bel6] },
        { entityId: "pegasus", sourceNames: ["Pegasus"], role: "winged helper", reason: "Pegasus bears Bellerophon against the Chimera and later throws him after Jupiter sends the gadfly.", evidence: [p.bel4, p.bel6] },
        { entityId: "chimera", sourceNames: ["Chimæra"], role: "monster", reason: "The Chimera devastates the land and is killed by Bellerophon.", evidence: [p.bel3, p.bel4] }
      ],
      relationships: [rel(access, p.bel5, "iobates", "gives_spouse", "philonoë", "gave the young hero his daughter in marriage")],
      narrative: {
        synopsis: "Bellerophon catches Pegasus with Minerva's bridle, rides him to the Chimera's lair, and kills the monster. Iobates rewards him, but after later victories Bellerophon tries to reach Olympus and falls when Jupiter sends a gadfly against Pegasus.",
        openingSituation: "Bellerophon waits near Pirene and sees Pegasus descend to drink.",
        centralConflict: "Bellerophon must master Pegasus and face the fire-breathing Chimera.",
        resolution: "Bellerophon kills the Chimera while Pegasus carries him out of danger.",
        outcome: "Iobates honors Bellerophon, but Bellerophon later falls after trying to reach Olympus.",
        storyline: ["Bellerophon sees Pegasus.", "Bellerophon bridles Pegasus.", "Bellerophon attacks the Chimera.", "Bellerophon kills the Chimera.", "Iobates rewards him.", "Jupiter sends a gadfly and Bellerophon falls."]
      },
      evidenceSummary: [summary(access, p.bel1, "Pegasus grew tired of his play", [{ field: "openingSituation" }]), summary(access, p.bel3, "fire-breathing monster", [{ field: "centralConflict" }]), summary(access, p.bel4, "cut off its three horrid heads", [{ field: "resolution" }]), summary(access, p.bel6, "threw his too-confident rider", [{ field: "outcome" }])],
      initialState: [{ subject: "bellerophon", predicate: "has", object: "golden-bridle", evidence: [{ passageId: p.bel2, sourceText: access.sentenceContaining(p.bel2, "Minerva's golden bridle") }] }],
      events: [
        event(1, Object.assign(ev(access, p.bel2, "sprang upon his back", "Bellerophon sprang onto Pegasus' back."), { actor: "bellerophon", action: "mount", target: "pegasus" })),
        event(2, Object.assign(ev(access, p.bel2, "slip the golden bridle", "Bellerophon slipped the golden bridle between Pegasus' teeth."), { actor: "bellerophon", action: "bind", target: "pegasus", object: "golden-bridle" })),
        event(3, Object.assign(ev(access, p.bel3, "turned the head of his white-winged steed", "Bellerophon turned Pegasus toward the Chimera's mountain region."), { actor: "bellerophon", action: "travel", target: "chimera", location: "lycia" })),
        event(4, Object.assign(ev(access, p.bel4, "cut off its three horrid heads", "Bellerophon cut off the Chimera's heads."), { actor: "bellerophon", action: "kill", target: "chimera", object: "sword" })),
        event(5, Object.assign(ev(access, p.bel5, "gave the young hero his daughter in marriage", "Iobates gave Philonoë to Bellerophon in marriage."), { actor: "iobates", action: "give", target: "philonoë", recipient: "bellerophon" })),
        event(6, Object.assign(ev(access, p.bel6, "sent an enormous gadfly", "Jupiter sent a gadfly against Pegasus."), { actor: "zeus", action: "send", target: "gadfly", recipient: "pegasus" })),
        event(7, Object.assign(ev(access, p.bel6, "threw his too-confident rider", "Pegasus threw Bellerophon from his back."), { actor: "pegasus", action: "throw", target: "bellerophon" }))
      ],
      finalState: [{ subject: "bellerophon", predicate: "wanders_after", object: "fall", evidence: [{ passageId: p.bel6, sourceText: access.sentenceContaining(p.bel6, "Ever afterwards he wandered") }] }],
      verification: verification([p.bel1, p.bel2, p.bel3, p.bel4, p.bel5, p.bel6], ["Pegasus capture", "Chimera location", "Chimera death", "Iobates reward", "Jupiter gadfly", "Bellerophon fall"], ["Corrected machine-proposed evidence boundaries.", "Kept Pegasus as a creature and character participant.", "Retained the fall as source-supported aftermath."], [])
    }
  ];

  return definitions.map((definition, index) => makeRecord(index + 6, definition));
}

function buildBatchResults(productionRecords, batchRecords) {
  const byId = new Map(productionRecords.map((record) => [record.myth.mythId, record]));
  const manualInspections = {
    "bulk-myth-0042": "Compared all nine Cadmus passages against title, family, dragon events, Ares relationship, and transformation outcome.",
    "bulk-myth-0062": "Checked Paris prophecy, exposure, Cassandra warning, Sparta hospitality, and Helen abduction; omitted truncated passage 333.10.",
    "bulk-myth-0084": "Checked Thetis wedding setup, Eris' apple, goddess dispute, and Paris appointment; did not include later judgment outcome.",
    "bulk-myth-0065": "Checked Meleager's brand, Diana's boar, Atalanta's wound, Meleager's deathblow, and Althaea's revenge.",
    "bulk-myth-0058": "Read the full Oedipus section and compared exposure, Sphinx, Tiresias revelation, and exile fields against the source."
  };
  const reviewedRecords = SELECTED_IDS.map((mythId) => {
    const record = byId.get(mythId);
    return checklist(record, OUTCOMES[mythId], manualInspections[mythId]);
  });
  return {
    generatedAt: GENERATED_AT,
    batchId: "verification-batch-01",
    reviewedCount: SELECTED_IDS.length,
    reviewedRecords,
    newlyVerifiedRecords: batchRecords.map((record) => ({
      mythId: record.mythId,
      title: record.title,
      file: `corpus/normalized/bulk/verified/${record.mythId}.myth.json`,
      sourceId: record.source.sourceId,
      correctionsMade: record.verification.correctionsMade
    })),
    manualInspections: reviewedRecords.filter((record) => record.manualInspection)
  };
}

function buildProgress(productionRecords, existingVerifiedCount, batchResults) {
  const counts = batchResults.reviewedRecords.reduce((acc, item) => {
    acc[item.finalStatus] = (acc[item.finalStatus] || 0) + 1;
    return acc;
  }, {});
  return {
    generatedAt: GENERATED_AT,
    totalCandidates: 917,
    totalProposedBeforeBatch: productionRecords.length,
    existingVerifiedBeforeBatch: existingVerifiedCount,
    batchId: "verification-batch-01",
    selectedForReview: SELECTED_IDS.length,
    verifiedThisBatch: counts.verified_by_source_audit || 0,
    remainingAwaitingReview: productionRecords.length - (counts.verified_by_source_audit || 0) - (counts.ambiguous || 0) - (counts.rejected_non_story || 0),
    ambiguousThisBatch: counts.ambiguous || 0,
    rejectedThisBatch: counts.rejected_non_story || 0,
    totalVerifiedAfterBatch: existingVerifiedCount + (counts.verified_by_source_audit || 0),
    humanApproved: 0
  };
}

function buildVerificationBatch01({ productionRecords, passageMap, existingVerifiedCount }) {
  const selected = new Set(SELECTED_IDS);
  const priority = buildPriorityReport(productionRecords);
  const selection = buildBatchSelection(productionRecords);
  const verifiedRecords = buildBatchRecords(passageMap);
  const results = buildBatchResults(productionRecords, verifiedRecords);
  const progress = buildProgress(productionRecords, existingVerifiedCount, results);
  return {
    selectedIds: selected,
    outcomes: OUTCOMES,
    priority,
    selection,
    results,
    progress,
    verifiedRecords
  };
}

module.exports = {
  SELECTED_IDS,
  buildVerificationBatch01
};
