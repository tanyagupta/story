const { AiProvider } = require("./ai-provider");

function createUnavailableProvider(name) {
  return class UnavailableProvider extends AiProvider {
    get name() {
      return name;
    }

    async isAvailable() {
      return {
        ok: false,
        reason: `${name} is a placeholder provider; no API integration is implemented yet.`
      };
    }

    async renderScene() {
      throw new Error(`${name} provider is not implemented yet.`);
    }
  };
}

module.exports = {
  VeoProvider: createUnavailableProvider("veo"),
  KlingProvider: createUnavailableProvider("kling"),
  LumaProvider: createUnavailableProvider("luma")
};
