const path = require("path");

function normalizeKey(value) {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function collectGeminiKeys(env = process.env) {
  const inlineKeys = (env.GEMINI_API_KEYS || "")
    .split(",")
    .map(normalizeKey)
    .filter(Boolean);

  const indexedKeys = Object.keys(env)
    .filter((key) => /^GEMINI_API_KEY(_\d+)?$/.test(key))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
    .map((key) => normalizeKey(env[key]))
    .filter(Boolean);

  return [...new Set([...inlineKeys, ...indexedKeys])];
}

function getServerConfig(env = process.env) {
  return {
    host: env.HOST || "0.0.0.0",
    port: readNumber(env.PORT, 5001),
    modelName: normalizeKey(env.GEMINI_MODEL) || "gemini-2.5-flash",
    requestBodyLimit: normalizeKey(env.REQUEST_BODY_LIMIT) || "10mb",
    keyCooldownMs: readNumber(env.GEMINI_KEY_COOLDOWN_MS, 60_000),
    sharedGeminiKeys: collectGeminiKeys(env),
    staticDir: path.join(process.cwd(), "www"),
    feedbackLogPath: path.join(process.cwd(), "data", "feedback.log"),
  };
}

module.exports = {
  collectGeminiKeys,
  getServerConfig,
};
