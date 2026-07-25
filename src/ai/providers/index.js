const { MockProvider } = require("./mock-provider");
const { RunwayProvider } = require("./runway-provider");
const { VeoProvider, KlingProvider, LumaProvider } = require("./provider-stubs");

function createProvider(name, config) {
  const provider = String(name || "runway").toLowerCase();
  if (provider === "mock") return new MockProvider(config);
  if (provider === "runway") return new RunwayProvider(config);
  if (provider === "veo") return new VeoProvider(config);
  if (provider === "kling") return new KlingProvider(config);
  if (provider === "luma") return new LumaProvider(config);
  throw new Error(`Unknown AI provider: ${name}`);
}

module.exports = {
  createProvider,
  MockProvider,
  RunwayProvider,
  VeoProvider,
  KlingProvider,
  LumaProvider
};
