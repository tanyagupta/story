class AiProvider {
  constructor(config) {
    this.config = config || {};
  }

  get name() {
    return "ai";
  }

  async isAvailable() {
    return { ok: false, reason: "Provider availability was not implemented." };
  }

  async renderScene() {
    throw new Error(`${this.name} provider did not implement renderScene()`);
  }
}

module.exports = {
  AiProvider
};
