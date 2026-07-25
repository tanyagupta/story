const fs = require("fs");
const https = require("https");
const { URL } = require("url");
const { AiProvider } = require("./ai-provider");

const RUNWAY_API_BASE = "https://api.dev.runwayml.com/v1";
const RUNWAY_VERSION = "2024-11-06";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class RunwayApiError extends Error {
  constructor(message, statusCode, body) {
    super(message);
    this.name = "RunwayApiError";
    this.statusCode = statusCode;
    this.body = body;
  }
}

function requestJson(method, url, body, apiKey) {
  const parsed = new URL(url);
  const payload = body ? JSON.stringify(body) : null;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "X-Runway-Version": RUNWAY_VERSION,
    Accept: "application/json"
  };
  if (payload) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = Buffer.byteLength(payload);
  }

  return new Promise((resolve, reject) => {
    const req = https.request({
      method,
      hostname: parsed.hostname,
      path: `${parsed.pathname}${parsed.search}`,
      headers
    }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        let parsedBody = {};
        if (data.trim()) {
          try {
            parsedBody = JSON.parse(data);
          } catch (error) {
            reject(new Error(`Runway returned non-JSON response (${res.statusCode}): ${data.slice(0, 500)}`));
            return;
          }
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(
            new RunwayApiError(
              `Runway API ${method} ${url} failed with ${res.statusCode}: ${JSON.stringify(parsedBody)}`,
              res.statusCode,
              parsedBody
            )
          );
          return;
        }
        resolve({
          statusCode: res.statusCode,
          body: parsedBody
        });
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https
      .get(url, (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Download failed with ${res.statusCode}: ${url}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => {
          file.close(resolve);
        });
      })
      .on("error", reject);
  });
}

function taskOutputUrl(task) {
  const output = task.output || task.outputs || task.artifacts || [];
  const first = Array.isArray(output) ? output[0] : output;
  if (typeof first === "string") return first;
  return first && (first.url || first.uri || first.downloadUrl);
}

function truncatePrompt(prompt, maxLength) {
  const value = String(prompt || "").replace(/\s+/g, " ").trim();
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 24).replace(/\s+\S*$/, "")} [prompt truncated]`;
}

function runwayDurationForScene(sceneDuration) {
  return Number(sceneDuration || 0) <= 5 ? 5 : 10;
}

class RunwayProvider extends AiProvider {
  get name() {
    return "runway";
  }

  apiKey() {
    return process.env.RUNWAY_API_KEY || process.env.RUNWAYML_API_SECRET || "";
  }

  async isAvailable() {
    if (!this.apiKey()) {
      return { ok: false, reason: "RUNWAY_API_KEY is not set." };
    }
    return this.validateAuthentication();
  }

  async validateAuthentication() {
    const apiKey = this.apiKey();
    if (!apiKey) {
      return {
        ok: false,
        statusCode: null,
        reason: "RUNWAY_API_KEY is not set.",
        errorMessage: "Missing RUNWAY_API_KEY"
      };
    }
    try {
      const response = await requestJson("GET", `${RUNWAY_API_BASE}/organization`, null, apiKey);
      return {
        ok: true,
        statusCode: response.statusCode,
        reason: "Runway authentication succeeded.",
        organization: response.body
      };
    } catch (error) {
      return {
        ok: false,
        statusCode: error.statusCode || null,
        reason: "Runway authentication failed.",
        errorMessage: error.message,
        response: error.body || null
      };
    }
  }

  async renderScene(request) {
    const apiKey = this.apiKey();
    if (!apiKey) {
      throw new Error("RUNWAY_API_KEY is not set.");
    }

    const body = {
      model: this.config.model || "gen4.5",
      promptText: truncatePrompt(request.prompt, Number(this.config.promptMaxLength || 1000)),
      ratio: this.config.ratio || "1280:720",
      duration: runwayDurationForScene(request.scene.duration)
    };
    console.log(
      `Runway submit: scene=${request.scene.id} model=${body.model} requestedDuration=${request.scene.duration}s runwayDuration=${body.duration}s`
    );
    const createdResponse = await requestJson("POST", `${RUNWAY_API_BASE}/text_to_video`, body, apiKey);
    const created = createdResponse.body;
    const taskId = created.id || created.taskId;
    if (!taskId) {
      throw new Error(`Runway response did not include a task id: ${JSON.stringify(created)}`);
    }
    console.log(`Runway task submitted: scene=${request.scene.id} taskId=${taskId}`);

    const timeoutMs = Number(this.config.timeoutMs || 12 * 60 * 1000);
    const started = Date.now();
    let task = created;
    while (Date.now() - started < timeoutMs) {
      const taskResponse = await requestJson("GET", `${RUNWAY_API_BASE}/tasks/${encodeURIComponent(taskId)}`, null, apiKey);
      task = taskResponse.body;
      const status = String(task.status || "").toUpperCase();
      console.log(`Runway poll: scene=${request.scene.id} taskId=${taskId} status=${status || "UNKNOWN"}`);
      if (["SUCCEEDED", "SUCCESS", "COMPLETED"].includes(status)) {
        const url = taskOutputUrl(task);
        if (!url) {
          throw new Error(`Runway task completed without downloadable output: ${JSON.stringify(task)}`);
        }
        console.log(`Runway download: scene=${request.scene.id} taskId=${taskId} output=${request.outputPath}`);
        await downloadFile(url, request.outputPath);
        return Object.assign({}, request, {
          outputPath: request.outputPath,
          downloadedOutputPath: request.outputPath,
          provider: this.name,
          taskId,
          status,
          runwayDuration: body.duration,
          targetDuration: request.scene.duration
        });
      }
      if (["FAILED", "CANCELLED", "CANCELED"].includes(status)) {
        throw new Error(`Runway task ${taskId} ended with ${status}: ${JSON.stringify(task)}`);
      }
      await delay(Number(this.config.pollMs || 5000));
    }
    throw new Error(`Timed out waiting for Runway task ${taskId}. Last response: ${JSON.stringify(task)}`);
  }
}

module.exports = {
  RunwayProvider,
  RunwayApiError,
  runwayDurationForScene,
  RUNWAY_API_BASE,
  RUNWAY_VERSION
};
