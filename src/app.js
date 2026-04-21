const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const { getServerConfig } = require("./config/app-config");
const { ApiError } = require("./lib/api-error");
const { ApiKeyRotator } = require("./services/api-key-rotator");
const { createGeminiService } = require("./services/gemini-service");
const { createFeedbackService } = require("./services/feedback-service");
const { createGenerateRouter } = require("./routes/generate");
const { createFeedbackRouter } = require("./routes/feedback");

dotenv.config();

const config = getServerConfig();
const keyRotator = new ApiKeyRotator(config.sharedGeminiKeys, config.keyCooldownMs);
const geminiService = createGeminiService({
  modelName: config.modelName,
  keyRotator,
  keyCooldownMs: config.keyCooldownMs,
});
const feedbackService = createFeedbackService({
  feedbackLogPath: config.feedbackLogPath,
});

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-custom-key"],
  })
);
app.use(express.json({ limit: config.requestBodyLimit }));

app.get("/api/status", (req, res) => {
  res.json({
    ok: true,
    model: config.modelName,
    keyPool: keyRotator.getPublicState(),
  });
});

app.use("/api/generate", createGenerateRouter({ geminiService, keyRotator }));
app.use("/generate", createGenerateRouter({ geminiService, keyRotator }));
app.use("/api/feedback", createFeedbackRouter({ feedbackService }));

app.get("/", (req, res) => {
  res.sendFile(path.join(config.staticDir, "home.html"));
});

app.use(express.static(config.staticDir, { index: false }));

app.use((req, res, next) => {
  next(
    new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`, {
      code: "ROUTE_NOT_FOUND",
    })
  );
});

app.use((error, req, res, next) => {
  const statusCode = error.statusCode || 500;

  if (error.retryAfterMs) {
    res.set("Retry-After", String(Math.ceil(error.retryAfterMs / 1000)));
  }

  if (statusCode >= 500) {
    console.error("Nexus backend error:", error);
  }

  res.status(statusCode).json({
    error: error.message || "Unexpected server error.",
    code: error.code || "INTERNAL_SERVER_ERROR",
    details: error.exposeDetails ? error.details : undefined,
  });
});

module.exports = app;
