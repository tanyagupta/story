const { characterProfile } = require("./character-profiles");

function joinList(values) {
  return (values || []).filter(Boolean).join(", ");
}

function describeCharacter(character) {
  const profile = characterProfile(character.id || character.name);
  const actions = joinList(character.actions || []);
  const expression = character.expression ? `Expression: ${character.expression}.` : "";
  const entrance = character.entrance ? `Entrance: ${character.entrance}.` : "";
  return [
    `${profile.name}: ${profile.role}.`,
    `Appearance: ${profile.appearance}.`,
    `Personality and movement: ${profile.personality}; ${profile.motion}.`,
    entrance,
    expression,
    actions ? `Actions: ${actions}.` : ""
  ]
    .filter(Boolean)
    .join(" ");
}

class PromptBuilder {
  constructor(options) {
    this.options = Object.assign({
      aspectRatio: "16:9",
      style: "stylized toon Greek mythology explainer, clean animation, readable faces",
      negativePrompt:
        "photorealistic, horror, gore, blurry faces, unreadable text, distorted hands, extra limbs, static image"
    }, options || {});
  }

  buildScenePrompt(scene, storyboard) {
    const characters = scene.characters.map(describeCharacter).join(" ");
    const dialogue = scene.dialogue
      .map((line) => `${line.speaker}: "${line.text}"`)
      .join(" ");
    const audioCues = scene.audioCues.map((cue) => `${cue.type || cue.name} at ${cue.start || 0}s`).join(", ");
    return [
      `Create a ${scene.duration.toFixed(1)} second animated video clip for "${storyboard.title}".`,
      `Scene ${scene.number}: ${scene.title}.`,
      `Style: ${this.options.style}.`,
      `Aspect ratio: ${this.options.aspectRatio}.`,
      `Environment: ${scene.environment}.`,
      `Lighting: ${scene.lighting}.`,
      `Camera: ${scene.camera}; include visible camera motion.`,
      characters ? `Characters: ${characters}` : "Characters: stylized animated humans with expressive faces.",
      scene.props.length ? `Props: ${joinList(scene.props)}.` : "",
      scene.caption ? `On-screen caption idea: ${scene.caption}.` : "",
      dialogue ? `Dialogue/narration context: ${dialogue}` : "",
      audioCues ? `Sound cue timing context: ${audioCues}.` : "",
      `Motion must be animated, not a still image: walking, gestures, head turns, facial expression changes, and scene transition ${scene.transition.type || "cut"}.`,
      `Avoid: ${this.options.negativePrompt}.`
    ]
      .filter(Boolean)
      .join(" ");
  }

  buildStoryboardPrompts(sceneObjects) {
    return sceneObjects.scenes.map((scene) => ({
      scene,
      prompt: this.buildScenePrompt(scene, sceneObjects)
    }));
  }
}

module.exports = {
  PromptBuilder,
  describeCharacter
};
