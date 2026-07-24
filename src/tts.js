const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const crypto = require("crypto");

function hashNarration(text, options) {
  return crypto
    .createHash("sha1")
    .update(JSON.stringify({ text, provider: options.provider, voice: options.voice, rate: options.rate }))
    .digest("hex");
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with ${code}: ${stderr.trim()}`));
      }
    });
  });
}

async function generateNarration(text, options, rootDir, logger) {
  const provider = options.provider || "disabled";
  if (provider === "disabled") {
    throw new Error("TTS narration text was provided, but tts.provider is disabled");
  }

  const cacheDir = path.resolve(rootDir, options.cache_dir || ".cache/tts");
  fs.mkdirSync(cacheDir, { recursive: true });
  const output = path.join(cacheDir, `${hashNarration(text, options)}.aiff`);
  if (fs.existsSync(output)) {
    logger(`Using cached TTS narration ${output}`);
    return output;
  }

  if (provider === "macos_say") {
    const args = ["-o", output];
    if (options.voice) args.push("-v", options.voice);
    if (options.rate) args.push("-r", String(options.rate));
    args.push(text);
    await runCommand("say", args);
    logger(`Generated local TTS narration ${output}`);
    return output;
  }

  throw new Error(`Unsupported local TTS provider: ${provider}`);
}

module.exports = {
  generateNarration
};
