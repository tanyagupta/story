const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const SHAPE_TYPES = new Set(["rect", "text", "caption"]);
const ANIMATION_TYPES = new Set([
  "none",
  "slow_zoom_in",
  "slow_zoom_out",
  "pan_left",
  "pan_right",
  "pan_up",
  "pan_down",
  "fade_in",
  "fade_out",
  "slide_in",
  "slide_out",
  "custom"
]);
const TRANSITION_TYPES = new Set(["cut", "fade", "crossfade", "slide", "dip_to_black"]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Invalid storyboard: ${message}`);
  }
}

function assertPositiveInteger(value, name) {
  assert(Number.isInteger(value) && value > 0, `${name} must be a positive integer`);
}

function assertPositiveNumber(value, name) {
  assert(typeof value === "number" && Number.isFinite(value) && value > 0, `${name} must be a positive number`);
}

function assertNonNegativeNumber(value, name) {
  assert(typeof value === "number" && Number.isFinite(value) && value >= 0, `${name} must be a non-negative number`);
}

function assertVolume(value, name) {
  assert(typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1.5, `${name} must be a number from 0 to 1.5`);
}

function validateColor(value, name) {
  assert(typeof value === "string" && COLOR_PATTERN.test(value), `${name} must be a #RRGGBB color`);
}

function validatePair(value, name) {
  assert(Array.isArray(value) && value.length === 2, `${name} must be a two-value array`);
  assertNonNegativeNumber(value[0], `${name}[0]`);
  assertNonNegativeNumber(value[1], `${name}[1]`);
}

function validateAnimation(animation, location) {
  if (animation === undefined) return;
  assert(animation && typeof animation === "object" && !Array.isArray(animation), `${location} must be an object`);
  if (animation.type !== undefined) {
    assert(ANIMATION_TYPES.has(animation.type), `${location}.type must be a supported animation type`);
  }
  ["start", "duration", "start_x", "end_x", "start_y", "end_y", "start_scale", "end_scale", "start_opacity", "end_opacity"].forEach((field) => {
    if (animation[field] !== undefined) {
      assertNonNegativeNumber(animation[field], `${location}.${field}`);
    }
  });
  if (animation.easing !== undefined) {
    assert(["linear", "ease_in", "ease_out", "ease_in_out"].includes(animation.easing), `${location}.easing must be linear, ease_in, ease_out, or ease_in_out`);
  }
}

function validateShape(shape, sceneIndex, shapeIndex) {
  const location = `scenes[${sceneIndex}].shapes[${shapeIndex}]`;
  assert(shape && typeof shape === "object" && !Array.isArray(shape), `${location} must be an object`);
  assert(SHAPE_TYPES.has(shape.type), `${location}.type must be rect, text, or caption`);

  ["x", "y"].forEach((field) => {
    if (shape[field] !== undefined) {
      assertNonNegativeNumber(shape[field], `${location}.${field}`);
    }
  });

  ["width", "height", "size"].forEach((field) => {
    if (shape[field] !== undefined) {
      assertPositiveNumber(shape[field], `${location}.${field}`);
    }
  });

  if (shape.color !== undefined) {
    validateColor(shape.color, `${location}.color`);
  }

  if (shape.type === "text" || shape.type === "caption") {
    assert(typeof shape.text === "string" && shape.text.trim(), `${location}.text is required`);
  }
}

function validateLayer(layer, sceneIndex, layerIndex) {
  const location = `scenes[${sceneIndex}].layers[${layerIndex}]`;
  assert(layer && typeof layer === "object" && !Array.isArray(layer), `${location} must be an object`);
  assert(typeof layer.file === "string" && layer.file.trim(), `${location}.file is required`);
  if (layer.position !== undefined) validatePair(layer.position, `${location}.position`);
  ["x", "y", "z_index", "depth", "parallax", "scale", "opacity", "start", "end"].forEach((field) => {
    if (layer[field] !== undefined) {
      assertNonNegativeNumber(layer[field], `${location}.${field}`);
    }
  });
  validateAnimation(layer.animation, `${location}.animation`);
}

function validateAudioItem(item, location, requiredFile) {
  assert(item && typeof item === "object" && !Array.isArray(item), `${location} must be an object`);
  if (requiredFile || item.file !== undefined) {
    assert(typeof item.file === "string" && item.file.trim(), `${location}.file must be a non-empty string`);
  }
  if (item.text !== undefined) {
    assert(typeof item.text === "string" && item.text.trim(), `${location}.text must be a non-empty string`);
  }
  ["start", "offset", "delay", "fade_in", "fade_out", "trim_start", "trim_duration", "duration"].forEach((field) => {
    if (item[field] !== undefined) {
      assertNonNegativeNumber(item[field], `${location}.${field}`);
    }
  });
  if (item.volume !== undefined) {
    assertVolume(item.volume, `${location}.volume`);
  }
  if (item.loop !== undefined) {
    assert(typeof item.loop === "boolean", `${location}.loop must be boolean`);
  }
}

function validateCaption(caption, sceneIndex) {
  if (caption === undefined) return;
  const location = `scenes[${sceneIndex}].caption`;
  assert(caption && typeof caption === "object" && !Array.isArray(caption), `${location} must be an object`);
  assert(typeof caption.text === "string" && caption.text.trim(), `${location}.text is required`);
  ["start", "duration", "x", "y", "size"].forEach((field) => {
    if (caption[field] !== undefined) {
      assertNonNegativeNumber(caption[field], `${location}.${field}`);
    }
  });
}

function validateTransition(transition, sceneIndex) {
  if (transition === undefined) return;
  const location = `scenes[${sceneIndex}].transition`;
  assert(transition && typeof transition === "object" && !Array.isArray(transition), `${location} must be an object`);
  assert(TRANSITION_TYPES.has(transition.type), `${location}.type must be cut, fade, crossfade, slide, or dip_to_black`);
  if (transition.duration !== undefined) {
    assertNonNegativeNumber(transition.duration, `${location}.duration`);
  }
}

function validateScene(scene, index, defaultDuration) {
  assert(scene && typeof scene === "object" && !Array.isArray(scene), `scenes[${index}] must be an object`);

  if (scene.id !== undefined) {
    assert(typeof scene.id === "string" && scene.id.trim(), `scenes[${index}].id must be a non-empty string`);
  }

  if (scene.title !== undefined) {
    assert(typeof scene.title === "string" && scene.title.trim(), `scenes[${index}].title must be a non-empty string`);
  }

  if (scene.duration !== undefined) {
    assertPositiveNumber(scene.duration, `scenes[${index}].duration`);
  } else {
    assertPositiveNumber(defaultDuration, "settings.defaultDuration");
  }

  if (scene.background !== undefined) {
    validateColor(scene.background, `scenes[${index}].background`);
  }

  if (scene.narration !== undefined) {
    if (typeof scene.narration === "string") {
      assert(scene.narration.trim(), `scenes[${index}].narration must not be empty`);
    } else {
      validateAudioItem(scene.narration, `scenes[${index}].narration`, false);
      assert(scene.narration.file || scene.narration.text, `scenes[${index}].narration requires file or text`);
    }
  }

  if (scene.shapes !== undefined) {
    assert(Array.isArray(scene.shapes), `scenes[${index}].shapes must be an array`);
    scene.shapes.forEach((shape, shapeIndex) => validateShape(shape, index, shapeIndex));
  }

  if (scene.layers !== undefined) {
    assert(Array.isArray(scene.layers), `scenes[${index}].layers must be an array`);
    scene.layers.forEach((layer, layerIndex) => validateLayer(layer, index, layerIndex));
  }

  assert(scene.shapes !== undefined || scene.layers !== undefined, `scenes[${index}] must define shapes or layers`);
  validateCaption(scene.caption, index);
  validateTransition(scene.transition, index);

  if (scene.sound_effects !== undefined) {
    assert(Array.isArray(scene.sound_effects), `scenes[${index}].sound_effects must be an array`);
    scene.sound_effects.forEach((item, itemIndex) => validateAudioItem(item, `scenes[${index}].sound_effects[${itemIndex}]`, true));
  }

  if (scene.ambient_audio !== undefined) {
    assert(Array.isArray(scene.ambient_audio), `scenes[${index}].ambient_audio must be an array`);
    scene.ambient_audio.forEach((item, itemIndex) => validateAudioItem(item, `scenes[${index}].ambient_audio[${itemIndex}]`, true));
  }
}

function validateStoryboard(storyboard) {
  assert(storyboard && typeof storyboard === "object" && !Array.isArray(storyboard), "root must be an object");
  assert(Array.isArray(storyboard.scenes) && storyboard.scenes.length > 0, "scenes must be a non-empty array");

  const settings = storyboard.settings || {};
  assert(settings && typeof settings === "object" && !Array.isArray(settings), "settings must be an object");

  if (storyboard.resolution !== undefined) {
    validatePair(storyboard.resolution, "resolution");
  }
  if (storyboard.fps !== undefined) {
    assertPositiveInteger(storyboard.fps, "fps");
  }
  if (settings.width !== undefined) {
    assertPositiveInteger(settings.width, "settings.width");
  }
  if (settings.height !== undefined) {
    assertPositiveInteger(settings.height, "settings.height");
  }
  if (settings.fps !== undefined) {
    assertPositiveInteger(settings.fps, "settings.fps");
  }
  if (settings.defaultDuration !== undefined) {
    assertPositiveNumber(settings.defaultDuration, "settings.defaultDuration");
  }
  if (settings.fontFile !== undefined) {
    assert(typeof settings.fontFile === "string" && settings.fontFile.trim(), "settings.fontFile must be a non-empty string");
  }

  if (storyboard.background_music !== undefined) {
    validateAudioItem(storyboard.background_music, "background_music", true);
    if (storyboard.background_music.duck_volume !== undefined) {
      assertVolume(storyboard.background_music.duck_volume, "background_music.duck_volume");
    }
  }
  if (storyboard.ambient_audio !== undefined) {
    validateAudioItem(storyboard.ambient_audio, "ambient_audio", true);
  }
  if (storyboard.full_narration !== undefined) {
    validateAudioItem(storyboard.full_narration, "full_narration", true);
  }
  if (storyboard.tts !== undefined) {
    assert(storyboard.tts && typeof storyboard.tts === "object" && !Array.isArray(storyboard.tts), "tts must be an object");
    if (storyboard.tts.enabled !== undefined) {
      assert(typeof storyboard.tts.enabled === "boolean", "tts.enabled must be boolean");
    }
  }

  storyboard.scenes.forEach((scene, index) => validateScene(scene, index, settings.defaultDuration || 3));
  return storyboard;
}

module.exports = {
  validateStoryboard
};
