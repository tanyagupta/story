const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const SHAPE_TYPES = new Set(["rect", "text", "caption"]);

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

function validateColor(value, name) {
  assert(typeof value === "string" && COLOR_PATTERN.test(value), `${name} must be a #RRGGBB color`);
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
    assert(typeof scene.narration === "string", `scenes[${index}].narration must be a string`);
  }

  assert(Array.isArray(scene.shapes), `scenes[${index}].shapes must be an array`);
  scene.shapes.forEach((shape, shapeIndex) => validateShape(shape, index, shapeIndex));
}

function validateStoryboard(storyboard) {
  assert(storyboard && typeof storyboard === "object" && !Array.isArray(storyboard), "root must be an object");
  assert(Array.isArray(storyboard.scenes) && storyboard.scenes.length > 0, "scenes must be a non-empty array");

  const settings = storyboard.settings || {};
  assert(settings && typeof settings === "object" && !Array.isArray(settings), "settings must be an object");

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

  storyboard.scenes.forEach((scene, index) => validateScene(scene, index, settings.defaultDuration || 3));
  return storyboard;
}

module.exports = {
  validateStoryboard
};
