function sceneDuration(scene, fallback) {
  const duration = Number(scene.duration);
  return Number.isFinite(duration) && duration > 0 ? duration : fallback;
}

function normalizeCharacterEntry(entry) {
  if (typeof entry === "string") {
    return { id: entry, actions: [] };
  }
  return Object.assign({ actions: [] }, entry || {});
}

function sceneDialogue(scene) {
  const dialogue = [];
  if (typeof scene.narration === "string" && scene.narration.trim()) {
    dialogue.push({
      speaker: "narrator",
      text: scene.narration.trim(),
      start: Number(scene.narration_start || 0.55)
    });
  }
  (scene.dialogue || []).forEach((line) => {
    if (line && String(line.text || "").trim()) {
      dialogue.push({
        speaker: String(line.character || "narrator").toLowerCase(),
        text: String(line.text).trim(),
        start: Number(line.start || 0.55)
      });
    }
  });
  return dialogue;
}

function storyboardSettings(storyboard) {
  const resolution = storyboard.resolution || [
    (storyboard.settings && storyboard.settings.width) || 1280,
    (storyboard.settings && storyboard.settings.height) || 720
  ];
  return {
    title: storyboard.title || "Untitled Storyboard",
    renderer: storyboard.renderer || "blender",
    width: Number(resolution[0] || 1280),
    height: Number(resolution[1] || 720),
    fps: Number(storyboard.fps || (storyboard.settings && storyboard.settings.fps) || 30),
    defaultDuration: Number((storyboard.settings && storyboard.settings.defaultDuration) || 5),
    style:
      (storyboard.ai && storyboard.ai.style) ||
      (storyboard.blender && storyboard.blender.style) ||
      "stylized cinematic storyboard animation"
  };
}

function parseStoryboardToSceneObjects(storyboard) {
  const settings = storyboardSettings(storyboard);
  let absoluteStart = 0;
  const scenes = (storyboard.scenes || []).map((scene, index) => {
    const blenderScene = scene.blender_scene || {};
    const duration = sceneDuration(scene, settings.defaultDuration);
    const sceneObject = {
      index,
      number: index + 1,
      id: scene.id || `scene-${index + 1}`,
      title: scene.title || `Scene ${index + 1}`,
      duration,
      absoluteStart,
      environment: blenderScene.environment || scene.environment || "storyboard stage",
      lighting: blenderScene.lighting || scene.lighting || "clean readable animated lighting",
      camera: blenderScene.camera || scene.camera || "medium cinematic camera move",
      transition: scene.transition || { type: "cut", duration: 0 },
      background: scene.background || "#16243a",
      characters: (blenderScene.characters || scene.characters || []).map(normalizeCharacterEntry),
      props: blenderScene.props || scene.props || [],
      audioCues: blenderScene.audio_cues || scene.audio_cues || [],
      dialogue: sceneDialogue(scene),
      caption:
        (scene.caption && scene.caption.text) ||
        ((scene.shapes || []).find((shape) => shape.type === "caption" || shape.type === "text") || {}).text ||
        ""
    };
    absoluteStart += duration;
    return sceneObject;
  });
  return {
    title: settings.title,
    settings,
    scenes,
    totalDuration: absoluteStart
  };
}

module.exports = {
  parseStoryboardToSceneObjects,
  sceneDialogue,
  storyboardSettings
};
